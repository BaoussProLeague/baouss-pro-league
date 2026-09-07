import { supabaseAdmin } from "../supabase";
import { fpl } from "../fpl";
import { runLmsForGw } from "./runLms";
import { runCaptaincyForGw } from "./runCaptaincy";
import { runDefGkForGw } from "./runDefGk";
import { logAdminActivity } from "../adminLog";
import { isSafeToComputeNow } from "../prizes/gwTiming";
import { isGwFinalizedFromStatus } from "../prizes/liveScores";

const COOLDOWN_MINUTES = 10;
const LMS_START_GW = 2; // matches runLms.js - nothing before this is ever relevant

const JOB_RUNNERS = {
  lms: runLmsForGw,
  captaincy: runCaptaincyForGw,
  defgk: runDefGkForGw,
};

// Recompute once a day as each day's matches settle (never while a match
// from this GW is literally in progress), keep doing that daily through
// however many days the gameweek spans, then lock permanently the moment
// FPL itself confirms the gameweek is fully done - the same signal that
// produces FPL's own "CONFIRMED" status, not a fixed hours-later guess.
// Locking on the real signal instead of a timer means it can never lock
// too early (numbers still shifting) or leave things unlocked long after
// FPL has genuinely finished.
async function processJobType(jobType, gw, fixtures, today, eventStatusData, bootstrapEvents) {
  const { data: lockRow } = await supabaseAdmin
    .from("gw_computation_locks")
    .select("*")
    .eq("gw", gw)
    .eq("job_type", jobType)
    .maybeSingle();

  if (lockRow?.locked) {
    return { ran: false, reason: "locked" };
  }

  if (!isSafeToComputeNow(fixtures)) {
    return { ran: false, reason: "match_in_progress" };
  }

  if (lockRow?.last_run_date === today) {
    return { ran: false, reason: "already_ran_today" };
  }

  const result = await JOB_RUNNERS[jobType](gw);

  // A refusal specifically caused by the GW not being ready yet doesn't
  // count as today's attempt - it can retry again on the very next
  // check rather than waiting until tomorrow. Every other outcome
  // (success, "already done," or a genuine different failure) does
  // count, so this can't spin forever retrying something broken for
  // unrelated reasons.
  const wasRefusedForTiming = ["gw_not_finished", "no_score_yet", "no_data"].includes(result?.status);
  if (wasRefusedForTiming) {
    return { ran: false, reason: result.status, result };
  }

  const shouldLock = isGwFinalizedFromStatus(eventStatusData, gw, bootstrapEvents);

  await supabaseAdmin.from("gw_computation_locks").upsert(
    {
      gw, job_type: jobType,
      last_run_at: new Date().toISOString(),
      last_run_date: today,
      locked: shouldLock,
      locked_at: shouldLock ? new Date().toISOString() : lockRow?.locked_at || null,
    },
    { onConflict: "gw,job_type" }
  );

  return { ran: true, result, locked: shouldLock };
}

export async function checkAndRunPendingJobs(source = "unknown") {
  // Trigger-on-visit could otherwise fire on every single page load if
  // several people are on the site at once - this cooldown means it
  // only actually does the (relatively expensive) check once every 10
  // minutes at most, regardless of how many visits happen in between.
  const { data: recent } = await supabaseAdmin
    .from("admin_activity_log")
    .select("created_at")
    .in("action", ["daily_cron", "auto_check"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (recent && recent[0]) {
    const minutesSince = (Date.now() - new Date(recent[0].created_at).getTime()) / 60000;
    if (minutesSince < COOLDOWN_MINUTES) {
      return { status: "cooldown", message: `Checked ${minutesSince.toFixed(1)} min ago - waiting out the ${COOLDOWN_MINUTES} min cooldown.` };
    }
  }

  const bootstrap = await fpl.bootstrap();
  let eventStatusData = null;
  try {
    eventStatusData = await fpl.eventStatus();
  } catch {
    // isGwFinalizedFromStatus falls back to finished+data_checked automatically
  }

  // The actual bug this fixes: this used to check only a single "current
  // gameweek," picked by a function designed to advance the moment that
  // gameweek finalizes - meaning the instant GW3 finalized, this started
  // asking "is GW4 ready?" and never once asked "did GW3's elimination
  // actually happen?" GW3 was skipped permanently, not delayed. This now
  // checks every started gameweek from LMS_START_GW onward, so a
  // gameweek that finalizes quickly (or an outage that causes a check to
  // be missed) can never fall through the cracks again - each one that
  // isn't yet locked gets its own attempt, independently.
  const now = new Date();
  const startedGws = bootstrap.events
    .filter((e) => e.id >= LMS_START_GW && new Date(e.deadline_time) <= now)
    .map((e) => e.id)
    .sort((a, b) => a - b);

  if (startedGws.length === 0) {
    return { status: "no_started_gw", message: "No gameweek has started yet this season." };
  }
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD, calendar day

  // Fixtures are cached per gw within this one run, so checking several
  // pending gameweeks across three job types doesn't refetch the same
  // gameweek's fixtures repeatedly.
  const fixturesCache = new Map();
  const getFixtures = async (gw) => {
    if (!fixturesCache.has(gw)) fixturesCache.set(gw, await fpl.fixtures(gw));
    return fixturesCache.get(gw);
  };

  const outcomesByJob = {};
  let anyRan = false;
  const summaryLines = [];

  for (const jobType of Object.keys(JOB_RUNNERS)) {
    outcomesByJob[jobType] = [];
    for (const gw of startedGws) {
      try {
        const fixtures = await getFixtures(gw);
        const outcome = await processJobType(jobType, gw, fixtures, today, eventStatusData, bootstrap.events);
        outcomesByJob[jobType].push({ gw, ...outcome });
        if (outcome.ran) anyRan = true;

        if (outcome.ran) {
          summaryLines.push(`${jobType} GW${gw}: ran${outcome.locked ? " (locked - final)" : ""} - ${outcome.result?.message || ""}`);
        } else if (outcome.reason === "match_in_progress") {
          summaryLines.push(`${jobType} GW${gw}: waiting, a match is live right now`);
        } else if (outcome.reason === "already_ran_today") {
          summaryLines.push(`${jobType} GW${gw}: already ran today`);
        } else if (outcome.reason === "locked") {
          // Already fully done - not worth a summary line every single
          // check, this would otherwise dominate the log forever.
        } else if (outcome.reason === "error") {
          summaryLines.push(`${jobType} GW${gw}: error - ${outcome.error}`);
        } else if (outcome.reason && outcome.reason !== "gw_not_finished" && outcome.reason !== "no_score_yet" && outcome.reason !== "no_data") {
          summaryLines.push(`${jobType} GW${gw}: skipped (${outcome.reason})`);
        }
      } catch (err) {
        outcomesByJob[jobType].push({ gw, ran: false, reason: "error", error: err.message });
        summaryLines.push(`${jobType} GW${gw}: error - ${err.message}`);
      }
    }
  }

  const summary = summaryLines.length > 0 ? summaryLines.join(" | ") : "nothing pending";

  await logAdminActivity(
    source === "cron" ? "daily_cron" : "auto_check",
    `[${source}] checked GW${startedGws.join(",")}: ${summary}`,
    { startedGws, outcomesByJob },
    true
  );

  return { status: anyRan ? "ok" : "no_action_needed", startedGws, summary };
}

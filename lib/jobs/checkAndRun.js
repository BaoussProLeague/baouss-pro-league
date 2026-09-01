import { supabaseAdmin } from "../supabase";
import { fpl } from "../fpl";
import { runLmsForGw } from "./runLms";
import { runCaptaincyForGw } from "./runCaptaincy";
import { runDefGkForGw } from "./runDefGk";
import { logAdminActivity } from "../adminLog";
import { isSafeToComputeNow } from "../prizes/gwTiming";
import { isGwFinalizedFromStatus, getEffectiveCurrentGw } from "../prizes/liveScores";

const COOLDOWN_MINUTES = 10;

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

  const currentGw = getEffectiveCurrentGw(bootstrap.events, eventStatusData);
  const now = new Date();
  const hasStarted = bootstrap.events.some((e) => e.id === currentGw && new Date(e.deadline_time) <= now);
  if (!currentGw || !hasStarted) {
    return { status: "no_started_gw", message: "No gameweek has started yet this season." };
  }
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD, calendar day

  const rawFixtures = await fpl.fixtures(currentGw);

  const outcomes = {};
  for (const jobType of Object.keys(JOB_RUNNERS)) {
    try {
      outcomes[jobType] = await processJobType(jobType, currentGw, rawFixtures, today, eventStatusData, bootstrap.events);
    } catch (err) {
      outcomes[jobType] = { ran: false, reason: "error", error: err.message };
    }
  }

  const anyRan = Object.values(outcomes).some((o) => o.ran);
  const summary = Object.entries(outcomes)
    .map(([job, o]) => {
      if (o.ran) return `${job}: ran${o.locked ? " (locked - final)" : ""} - ${o.result?.message || ""}`;
      if (o.reason === "match_in_progress") return `${job}: waiting, a match is live right now`;
      if (o.reason === "already_ran_today") return `${job}: already ran today`;
      if (o.reason === "locked") return `${job}: locked (final)`;
      if (o.reason === "error") return `${job}: error - ${o.error}`;
      return `${job}: skipped`;
    })
    .join(" | ");

  await logAdminActivity(
    source === "cron" ? "daily_cron" : "auto_check",
    `[${source}] GW${currentGw}: ${summary}`,
    { gw: currentGw, outcomes },
    true
  );

  return { status: anyRan ? "ok" : "no_action_needed", gw: currentGw, summary };
}

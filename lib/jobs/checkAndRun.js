import { supabaseAdmin } from "../supabase";
import { fpl } from "../fpl";
import { runLmsForGw } from "./runLms";
import { runCaptaincyForGw } from "./runCaptaincy";
import { runDefGkForGw } from "./runDefGk";
import { logAdminActivity } from "../adminLog";
import { isSafeToComputeNow, hoursSinceLastMatchKickoff } from "../prizes/gwTiming";

const COOLDOWN_MINUTES = 10;
const LOCK_HOURS_AFTER_LAST_MATCH = 24;

const JOB_RUNNERS = {
  lms: runLmsForGw,
  captaincy: runCaptaincyForGw,
  defgk: runDefGkForGw,
};

// Your exact workflow, not a single-shot "run once when finished":
// recompute once a day as each day's matches settle (never while a match
// from this GW is literally in progress), keep doing that daily through
// however many days the gameweek spans, then lock permanently 24 hours
// after the very last match - no more recomputing after that.
async function processJobType(jobType, gw, fixtures, today) {
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

  // The actual bug: this used to unconditionally record "ran today"
  // even when the job explicitly refused to act (e.g. LMS's own
  // gw_not_finished check) - meaning if automation happened to check in
  // during the gap between "no match currently live" and "FPL has
  // actually confirmed bonus points," it would lock itself out from
  // retrying again until the next calendar day, even though the
  // gameweek might genuinely finalize later that same day. Only a
  // refusal specifically caused by the GW not being ready yet should
  // skip recording today's attempt - every other outcome (success, or a
  // genuine different failure) still counts, so this can't spin forever
  // retrying something broken for unrelated reasons.
  const wasRefusedForTiming = ["gw_not_finished", "no_score_yet", "no_data"].includes(result?.status);
  if (wasRefusedForTiming) {
    return { ran: false, reason: result.status, result };
  }

  const hoursSince = hoursSinceLastMatchKickoff(fixtures);
  const shouldLock = hoursSince !== null && hoursSince >= LOCK_HOURS_AFTER_LAST_MATCH;

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
  const now = new Date();
  const startedEvents = bootstrap.events.filter((e) => new Date(e.deadline_time) <= now);
  if (startedEvents.length === 0) {
    return { status: "no_started_gw", message: "No gameweek has started yet this season." };
  }
  const currentGw = Math.max(...startedEvents.map((e) => e.id));
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD, calendar day

  const rawFixtures = await fpl.fixtures(currentGw);

  const outcomes = {};
  for (const jobType of Object.keys(JOB_RUNNERS)) {
    try {
      outcomes[jobType] = await processJobType(jobType, currentGw, rawFixtures, today);
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

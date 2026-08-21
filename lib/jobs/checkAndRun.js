import { supabaseAdmin } from "../supabase";
import { fpl } from "../fpl";
import { runLmsForGw } from "./runLms";
import { runCaptaincyForGw } from "./runCaptaincy";
import { runDefGkForGw } from "./runDefGk";
import { logAdminActivity } from "../adminLog";

const COOLDOWN_MINUTES = 10;

// `source` is just a label for the activity log ('cron' vs 'visit') so
// you can tell which trigger actually did the work if you're checking
// Admin later - the logic itself is identical either way.
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
  const finishedEvents = bootstrap.events.filter((e) => e.finished);
  if (finishedEvents.length === 0) {
    return { status: "no_finished_gw", message: "No gameweek has finished yet this season." };
  }
  const latestFinishedGw = Math.max(...finishedEvents.map((e) => e.id));

  const [{ data: lmsRows }, { data: capRows }, { data: defgkRows }] = await Promise.all([
    supabaseAdmin.from("lms_eliminations").select("gw_eliminated").order("gw_eliminated", { ascending: false }).limit(1),
    supabaseAdmin.from("captain_accuracy").select("gw").order("gw", { ascending: false }).limit(1),
    supabaseAdmin.from("def_gk_points_log").select("gw").order("gw", { ascending: false }).limit(1),
  ]);

  const jobs = [];
  if (!lmsRows?.[0] || lmsRows[0].gw_eliminated < latestFinishedGw) jobs.push(["lms", runLmsForGw(latestFinishedGw)]);
  if (!capRows?.[0] || capRows[0].gw < latestFinishedGw) jobs.push(["captaincy", runCaptaincyForGw(latestFinishedGw)]);
  if (!defgkRows?.[0] || defgkRows[0].gw < latestFinishedGw) jobs.push(["defgk", runDefGkForGw(latestFinishedGw)]);

  if (jobs.length === 0) {
    await logAdminActivity("auto_check", `[${source}] GW${latestFinishedGw} already up to date`, { gw: latestFinishedGw }, true);
    return { status: "up_to_date", message: `GW${latestFinishedGw} already processed for everything.` };
  }

  const settled = await Promise.allSettled(jobs.map(([, p]) => p));
  const summary = jobs.map(([name], i) => {
    const s = settled[i];
    return s.status === "fulfilled" ? `${name}: ${s.value.message}` : `${name}: failed - ${s.reason?.message}`;
  });

  const allOk = settled.every((s) => s.status === "fulfilled" && s.value.ok);
  await logAdminActivity(
    source === "cron" ? "daily_cron" : "auto_check",
    `[${source}] GW${latestFinishedGw}: ${summary.join(" | ")}`,
    { gw: latestFinishedGw },
    allOk
  );

  return { status: allOk ? "ok" : "partial", gw: latestFinishedGw, summary };
}

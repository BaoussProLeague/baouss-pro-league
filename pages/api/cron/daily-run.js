import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import { runLmsForGw } from "../../../lib/jobs/runLms";
import { runCaptaincyForGw } from "../../../lib/jobs/runCaptaincy";
import { runDefGkForGw } from "../../../lib/jobs/runDefGk";
import { logAdminActivity } from "../../../lib/adminLog";

// Vercel's Hobby (free) tier only allows a cron job to fire once a day,
// and gives it a 10-second timeout - both real limits, not things this
// code works around. This route is honest about that: it runs once a
// day, checks whichever gameweek most recently finished, and tries all
// three jobs for it if they haven't been recorded yet. If your league is
// large enough that this times out, the admin "Run All" button on the
// Admin page is the reliable fallback, not a backup you should never
// need - the fully automatic path is best-effort, not guaranteed.
//
// Registered as a Vercel Cron Job in vercel.json (runs once daily). Only
// Vercel itself (or someone with CRON_SECRET) can trigger this.

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const bootstrap = await fpl.bootstrap();
    const finishedEvents = bootstrap.events.filter((e) => e.finished);
    if (finishedEvents.length === 0) {
      return res.status(200).json({ status: "no_finished_gw", message: "No gameweek has finished yet this season." });
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
      return res.status(200).json({ status: "up_to_date", message: `GW${latestFinishedGw} already processed for everything.` });
    }

    const settled = await Promise.allSettled(jobs.map(([, p]) => p));
    const summary = jobs.map(([name], i) => {
      const s = settled[i];
      return s.status === "fulfilled" ? `${name}: ${s.value.message}` : `${name}: failed - ${s.reason?.message}`;
    });

    const allOk = settled.every((s) => s.status === "fulfilled" && s.value.ok);
    await logAdminActivity("daily_cron", `GW${latestFinishedGw} auto-check: ${summary.join(" | ")}`, { gw: latestFinishedGw }, allOk);

    res.status(200).json({ status: allOk ? "ok" : "partial", gw: latestFinishedGw, summary });
  } catch (err) {
    await logAdminActivity("daily_cron", `Failed: ${err.message}`, {}, false);
    res.status(500).json({ error: err.message });
  }
}

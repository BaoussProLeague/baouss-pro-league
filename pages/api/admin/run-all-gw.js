import { runLmsForGw } from "../../../lib/jobs/runLms";
import { runCaptaincyForGw } from "../../../lib/jobs/runCaptaincy";
import { runDefGkForGw } from "../../../lib/jobs/runDefGk";
import { logAdminActivity } from "../../../lib/adminLog";

// Runs LMS, Captain accuracy, and Def+GK for one gameweek in a single
// click. Run in parallel (not one after another) specifically because
// Vercel's free tier gives this function 10 seconds total - three jobs
// run sequentially would very likely blow through that for a league of
// any real size. Running them together only costs as long as the
// slowest one, not the sum of all three.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, gw } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  const gwNum = Number(gw);
  if (!gw || !Number.isInteger(gwNum) || gwNum < 1 || gwNum > 38) {
    return res.status(400).json({ error: "Gameweek must be a whole number between 1 and 38." });
  }

  const [lms, captaincy, defgk] = await Promise.allSettled([
    runLmsForGw(gwNum),
    runCaptaincyForGw(gwNum),
    runDefGkForGw(gwNum),
  ]);

  const summarize = (label, settled) => {
    if (settled.status === "rejected") return `${label}: failed - ${settled.reason?.message || "unknown error"}`;
    return `${label}: ${settled.value.message}`;
  };

  const messages = [
    summarize("LMS", lms),
    summarize("Captain accuracy", captaincy),
    summarize("Def+GK", defgk),
  ];

  const allOk = [lms, captaincy, defgk].every((r) => r.status === "fulfilled" && r.value.ok);
  await logAdminActivity("run_all_gw", `GW${gwNum} - Run All: ${messages.join(" | ")}`, { gw: gwNum }, allOk);

  res.status(200).json({ status: allOk ? "ok" : "partial", messages });
}

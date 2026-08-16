import { runLmsForGw } from "../../../lib/jobs/runLms";
import { logAdminActivity } from "../../../lib/adminLog";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, gw, round = 1 } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  const gwNum = Number(gw);
  if (!gw || !Number.isInteger(gwNum) || gwNum < 1 || gwNum > 38) {
    return res.status(400).json({ error: "Gameweek must be a whole number between 1 and 38." });
  }

  try {
    const result = await runLmsForGw(gwNum, round);
    await logAdminActivity("lms_elimination", result.message, { gw: gwNum }, result.ok);
    if (!result.ok) return res.status(400).json({ error: result.message });
    if (result.status === "manual_action_required" || result.status === "no_action") {
      return res.status(200).json({ status: result.status, message: result.message, candidates: result.data?.tied });
    }
    res.status(200).json({ status: "ok", eliminated: result.data?.rows });
  } catch (err) {
    await logAdminActivity("lms_elimination", `GW${gwNum}: failed - ${err.message}`, { gw: gwNum }, false);
    res.status(500).json({ error: `Couldn't run LMS elimination: ${err.message}` });
  }
}

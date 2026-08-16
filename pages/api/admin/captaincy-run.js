import { runCaptaincyForGw } from "../../../lib/jobs/runCaptaincy";
import { logAdminActivity } from "../../../lib/adminLog";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, gw } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  const gwNum = Number(gw);
  if (!gw || !Number.isInteger(gwNum) || gwNum < 1 || gwNum > 38) {
    return res.status(400).json({ error: "Gameweek must be a whole number between 1 and 38." });
  }

  try {
    const result = await runCaptaincyForGw(gwNum);
    await logAdminActivity("captaincy_run", result.message, { gw: gwNum }, result.ok);
    if (!result.ok) return res.status(400).json({ error: result.message });
    res.status(200).json({ status: "ok", recorded: result.data?.recorded });
  } catch (err) {
    await logAdminActivity("captaincy_run", `GW${gwNum}: failed - ${err.message}`, { gw: gwNum }, false);
    res.status(500).json({ error: `Couldn't run the captain accuracy check: ${err.message}` });
  }
}

import { runLmsForGw } from "../../../lib/jobs/runLms";
import { logAdminActivity } from "../../../lib/adminLog";

const LMS_START_GW = 2;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, gw } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  const gwNum = Number(gw);
  if (!gw || !Number.isInteger(gwNum) || gwNum < 1 || gwNum > 38) {
    return res.status(400).json({ error: "Gameweek must be a whole number between 1 and 38." });
  }
  if (gwNum < LMS_START_GW) {
    return res.status(400).json({ error: `LMS starts from GW${LMS_START_GW} per your rules doc - GW${gwNum} is before that and can't be run.` });
  }

  try {
    // round is no longer a caller-supplied option - runLmsForGw decides
    // it internally from the gameweek itself (round 2 from GW25 on),
    // which is what makes the round-2 starting pool computation reliably
    // correct rather than depending on every caller passing the right
    // value.
    const result = await runLmsForGw(gwNum);
    await logAdminActivity("lms_elimination", result.message, { gw: gwNum }, result.ok);
    if (!result.ok) return res.status(400).json({ error: result.message });
    if (result.status === "no_action") {
      return res.status(200).json({ status: result.status, message: result.message });
    }
    res.status(200).json({ status: "ok", eliminated: result.data?.rows, message: result.message });
  } catch (err) {
    await logAdminActivity("lms_elimination", `GW${gwNum}: failed - ${err.message}`, { gw: gwNum }, false);
    res.status(500).json({ error: `Couldn't run LMS elimination: ${err.message}` });
  }
}

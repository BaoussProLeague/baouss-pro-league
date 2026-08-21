import { supabaseAdmin } from "../../../lib/supabase";
import { captaincyLeaderboard } from "../../../lib/prizes/captaincy";
import { captainPointsLeaderboard } from "../../../lib/prizes/fromHistory";
import { computeRankDeltas } from "../../../lib/prizes/rankDelta";
import { setNoCache } from "../../../lib/noCacheHeaders";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const { data, error } = await supabaseAdmin.from("captain_accuracy").select("*");
    if (error) throw error;

    const rows = data || [];
    const maxGw = rows.length > 0 ? Math.max(...rows.map((r) => r.gw)) : 0;
    const prevRows = rows.filter((r) => r.gw < maxGw);

    const leaderboard = captaincyLeaderboard(rows);
    const captainPoints = captainPointsLeaderboard(rows);
    const prevLeaderboard = captaincyLeaderboard(prevRows);
    const prevCaptainPoints = captainPointsLeaderboard(prevRows);

    res.status(200).json({
      leaderboard,
      captainPoints,
      leaderboardDeltas: Object.fromEntries(computeRankDeltas(leaderboard, prevLeaderboard)),
      captainPointsDeltas: Object.fromEntries(computeRankDeltas(captainPoints, prevCaptainPoints)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

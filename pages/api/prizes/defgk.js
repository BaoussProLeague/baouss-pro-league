import { supabaseAdmin } from "../../../lib/supabase";
import { defGkLeaderboard } from "../../../lib/prizes/defgk";
import { computeRankDeltas } from "../../../lib/prizes/rankDelta";
import { setNoCache } from "../../../lib/noCacheHeaders";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const { data, error } = await supabaseAdmin.from("def_gk_points_log").select("*");
    if (error) throw error;

    const rows = data || [];
    const maxGw = rows.length > 0 ? Math.max(...rows.map((r) => r.gw)) : 0;
    const prevRows = rows.filter((r) => r.gw < maxGw);

    const leaderboard = defGkLeaderboard(rows);
    const prevLeaderboard = defGkLeaderboard(prevRows);

    res.status(200).json({
      leaderboard,
      deltas: Object.fromEntries(computeRankDeltas(leaderboard, prevLeaderboard)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

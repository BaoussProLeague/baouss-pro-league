import { supabaseAdmin } from "../../../lib/supabase";
import { captaincyLeaderboard } from "../../../lib/prizes/captaincy";
import { captainPointsLeaderboard } from "../../../lib/prizes/fromHistory";

export default async function handler(req, res) {
  try {
    const { data, error } = await supabaseAdmin.from("captain_accuracy").select("*");
    if (error) throw error;
    res.status(200).json({
      leaderboard: captaincyLeaderboard(data || []),
      captainPoints: captainPointsLeaderboard(data || []),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

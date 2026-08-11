import { supabaseAdmin } from "../../../lib/supabase";
import { captaincyLeaderboard } from "../../../lib/prizes/captaincy";

export default async function handler(req, res) {
  try {
    const { data, error } = await supabaseAdmin.from("captain_accuracy").select("*");
    if (error) throw error;
    res.status(200).json({ leaderboard: captaincyLeaderboard(data || []) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

import { supabaseAdmin } from "../../../lib/supabase";
import { defGkLeaderboard } from "../../../lib/prizes/defgk";

export default async function handler(req, res) {
  try {
    const { data, error } = await supabaseAdmin.from("def_gk_points_log").select("*");
    if (error) throw error;
    res.status(200).json({ leaderboard: defGkLeaderboard(data || []) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

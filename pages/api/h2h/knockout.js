import { supabaseAdmin } from "../../../lib/supabase";
import { setNoCache } from "../../../lib/noCacheHeaders";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const { data, error } = await supabaseAdmin
      .from("h2h_knockout_results")
      .select("*")
      .order("gw", { ascending: true });
    if (error) throw error;

    const byCup = { gold: [], silver: [] };
    for (const row of data || []) {
      byCup[row.cup].push(row);
    }
    res.status(200).json(byCup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

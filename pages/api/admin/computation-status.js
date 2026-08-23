import { supabaseAdmin } from "../../../lib/supabase";
import { setNoCache } from "../../../lib/noCacheHeaders";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const { data, error } = await supabaseAdmin
      .from("gw_computation_locks")
      .select("*")
      .order("gw", { ascending: false });
    if (error) throw error;
    res.status(200).json({ statuses: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

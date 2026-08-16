import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(req, res) {
  if (req.query.password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from("admin_activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    res.status(200).json({ logs: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

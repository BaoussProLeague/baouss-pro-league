import { supabaseAdmin } from "../../../lib/supabase";

// GET ?password=... (contains phone numbers - not public data)
export default async function handler(req, res) {
  const { password } = req.query;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from("registrations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.status(200).json({ registrations: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

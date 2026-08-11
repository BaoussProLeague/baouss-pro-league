import { supabaseAdmin } from "../../../lib/supabase";

// POST { password, entryId, entryName, paid }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, entryId, entryName, paid } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!entryId) return res.status(400).json({ error: "entryId is required" });

  try {
    const { error } = await supabaseAdmin.from("lms_rebuys").upsert({
      entry_id: entryId,
      entry_name: entryName,
      paid: !!paid,
      paid_at: paid ? new Date().toISOString() : null,
    });
    if (error) throw error;
    res.status(200).json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

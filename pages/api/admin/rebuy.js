import { supabaseAdmin } from "../../../lib/supabase";
import { logAdminActivity } from "../../../lib/adminLog";

// POST { password, entryId, entryName, paid }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, entryId, entryName, paid } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!entryId || !Number.isInteger(Number(entryId)) || Number(entryId) <= 0) {
    return res.status(400).json({ error: "Entry ID must be a positive whole number." });
  }
  if (!entryName || !entryName.trim()) {
    return res.status(400).json({ error: "Team name is required." });
  }

  try {
    const { error } = await supabaseAdmin.from("lms_rebuys").upsert({
      entry_id: entryId,
      entry_name: entryName,
      paid: !!paid,
      paid_at: paid ? new Date().toISOString() : null,
    });
    if (error) throw error;
    await logAdminActivity("lms_rebuy", `${entryName} rebought into LMS`, { entryId, entryName }, true);
    res.status(200).json({ status: "ok" });
  } catch (err) {
    await logAdminActivity("lms_rebuy", `Failed to save rebuy for ${entryName}: ${err.message}`, { entryId, entryName }, false);
    res.status(500).json({ error: `Couldn't save the rebuy: ${err.message}` });
  }
}

import { supabaseAdmin } from "../../../lib/supabase";
import { logAdminActivity } from "../../../lib/adminLog";

// POST { password, action: 'add' | 'delete', entryId, entryName, paid }
// Editing an existing rebuy is just re-saving it (upsert keyed on entryId),
// same as before - only delete needed a new explicit action.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, action = "add", entryId, entryName, paid } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!entryId || !Number.isInteger(Number(entryId)) || Number(entryId) <= 0) {
    return res.status(400).json({ error: "A team must be selected." });
  }

  try {
    if (action === "delete") {
      const { error } = await supabaseAdmin.from("lms_rebuys").delete().eq("entry_id", entryId);
      if (error) throw error;
      await logAdminActivity("lms_rebuy_deleted", `Rebuy entry for ${entryName || entryId} deleted`, { entryId }, true);
      return res.status(200).json({ status: "ok" });
    }

    if (!entryName || !entryName.trim()) {
      return res.status(400).json({ error: "Team name is required." });
    }

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
    await logAdminActivity("lms_rebuy_action_failed", err.message, req.body, false);
    res.status(500).json({ error: `Couldn't save the rebuy: ${err.message}` });
  }
}

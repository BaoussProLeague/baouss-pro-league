import { supabaseAdmin } from "../../../lib/supabase";
import { logAdminActivity } from "../../../lib/adminLog";

// POST { password, action: 'add' | 'delete', gw, label, prizeAmountInr, id }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, action = "add" } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (action === "delete") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id is required to delete a Mega GW." });
      const { error } = await supabaseAdmin.from("mega_gws").delete().eq("id", id);
      if (error) throw error;
      await logAdminActivity("mega_gw_deleted", `Mega GW entry ${id} deleted`, { id }, true);
      return res.status(200).json({ status: "ok" });
    }

    const { gw, label, prizeAmountInr } = req.body;
    const gwNum = Number(gw);
    if (!gw || !Number.isInteger(gwNum) || gwNum < 1 || gwNum > 38) {
      return res.status(400).json({ error: "Gameweek must be a whole number between 1 and 38." });
    }
    if (!label || !label.trim()) {
      return res.status(400).json({ error: "A label is required, e.g. \"Double Gameweek Special\"." });
    }

    const { error } = await supabaseAdmin.from("mega_gws").upsert(
      { gw: gwNum, label, prize_amount_inr: prizeAmountInr || null },
      { onConflict: "gw" }
    );
    if (error) throw error;
    await logAdminActivity("mega_gw_added", `GW${gwNum} marked as Mega GW: "${label}"`, req.body, true);
    res.status(200).json({ status: "ok" });
  } catch (err) {
    await logAdminActivity("mega_gw_action_failed", err.message, req.body, false);
    res.status(500).json({ error: `Couldn't save the Mega GW: ${err.message}` });
  }
}

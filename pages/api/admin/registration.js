import { supabaseAdmin } from "../../../lib/supabase";
import { logAdminActivity } from "../../../lib/adminLog";

// POST { password, action: 'add' | 'update' | 'delete', id, managerName, phone, fplTeamName, entryId, paymentMode, amount, currency, paidTo, paid, codeShared, notes }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, action = "add", id, ...fields } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (action === "delete") {
      if (!id) return res.status(400).json({ error: "id is required to delete a registration." });
      const { error } = await supabaseAdmin.from("registrations").delete().eq("id", id);
      if (error) throw error;
      await logAdminActivity("registration_deleted", `Registration ${id} deleted`, { id }, true);
      return res.status(200).json({ status: "ok" });
    }

    if (!fields.managerName) return res.status(400).json({ error: "Manager name is required." });
    if (!fields.phone) return res.status(400).json({ error: "Phone number is required." });
    if (!fields.fplTeamName) return res.status(400).json({ error: "FPL team name is required." });
    if (fields.amount === null || fields.amount === undefined || Number(fields.amount) <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number." });
    }

    const row = {
      manager_name: fields.managerName,
      phone: fields.phone || null,
      fpl_team_name: fields.fplTeamName || null,
      entry_id: fields.entryId || null,
      payment_mode: fields.paymentMode || null,
      amount: fields.amount || null,
      currency: fields.currency || null,
      paid_to: fields.paidTo || null,
      paid: !!fields.paid,
      paid_at: fields.paid ? new Date().toISOString() : null,
      code_shared: !!fields.codeShared,
      notes: fields.notes || null,
    };

    if (action === "update") {
      if (!id) return res.status(400).json({ error: "id is required to update a registration." });
      const { error } = await supabaseAdmin.from("registrations").update(row).eq("id", id);
      if (error) throw error;
      await logAdminActivity("registration_updated", `Registration ${id} (${fields.managerName}) updated`, fields, true);
      return res.status(200).json({ status: "ok" });
    }

    const { error } = await supabaseAdmin.from("registrations").insert(row);
    if (error) throw error;
    await logAdminActivity("registration_added", `${fields.managerName} (${fields.fplTeamName}) registered`, fields, true);
    res.status(200).json({ status: "ok" });
  } catch (err) {
    await logAdminActivity("registration_action_failed", err.message, req.body, false);
    res.status(500).json({ error: `Couldn't save the registration: ${err.message}` });
  }
}

import { supabaseAdmin } from "../../../lib/supabase";
import { logAdminActivity } from "../../../lib/adminLog";

// POST { password, managerName, phone, fplTeamName, entryId, paymentMode, amount, currency, paidTo, paid, codeShared, notes }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, ...fields } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!fields.managerName) return res.status(400).json({ error: "Manager name is required." });
  if (!fields.phone) return res.status(400).json({ error: "Phone number is required." });
  if (!fields.fplTeamName) return res.status(400).json({ error: "FPL team name is required." });
  if (fields.amount === null || fields.amount === undefined || Number(fields.amount) <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number." });
  }

  try {
    const { error } = await supabaseAdmin.from("registrations").insert({
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
    });
    if (error) throw error;
    await logAdminActivity("registration_added", `${fields.managerName} (${fields.fplTeamName}) registered`, fields, true);
    res.status(200).json({ status: "ok" });
  } catch (err) {
    await logAdminActivity("registration_added", `Failed to add ${fields.managerName}`, { error: err.message }, false);
    res.status(500).json({ error: `Couldn't save the registration: ${err.message}` });
  }
}

import { supabaseAdmin } from "../../../lib/supabase";

// POST { password, managerName, phone, fplTeamName, entryId, paymentMode, amount, currency, paidTo, paid, codeShared, notes }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, ...fields } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!fields.managerName) return res.status(400).json({ error: "managerName is required" });

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
    res.status(200).json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

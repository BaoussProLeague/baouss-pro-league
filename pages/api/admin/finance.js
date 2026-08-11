import { supabaseAdmin } from "../../../lib/supabase";

// GET  ?password=...                 -> pool config + all payouts
// POST { password, action: 'setPool' | 'upsertPayout', ...fields }
export default async function handler(req, res) {
  if (req.method === "GET") {
    if (req.query.password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const [{ data: pool }, { data: payouts }, { data: rebuys }] = await Promise.all([
        supabaseAdmin.from("prize_pool_config").select("*").eq("id", 1).single(),
        supabaseAdmin.from("prize_payouts").select("*").order("prize_key", { ascending: true }),
        supabaseAdmin.from("lms_rebuys").select("*").eq("paid", true),
      ]);

      const rebuyIncome = (rebuys || []).reduce((sum, r) => sum + (r.amount_inr || 0), 0);
      const totalPaidOut = (payouts || [])
        .filter((p) => p.paid)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalOwed = (payouts || [])
        .filter((p) => !p.paid)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      res.status(200).json({ pool, payouts: payouts || [], rebuyIncome, totalPaidOut, totalOwed });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === "POST") {
    const { password, action } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      if (action === "setPool") {
        const { totalPlayers, buyinInr, buyinUsd, adminFeesInr } = req.body;
        const { error } = await supabaseAdmin
          .from("prize_pool_config")
          .update({
            total_players: totalPlayers,
            buyin_inr: buyinInr,
            buyin_usd: buyinUsd,
            admin_fees_inr: adminFeesInr,
            updated_at: new Date().toISOString(),
          })
          .eq("id", 1);
        if (error) throw error;
        return res.status(200).json({ status: "ok" });
      }

      if (action === "upsertPayout") {
        const { prizeKey, prizeLabel, winnerEntryId, winnerName, amount, currency, assignedAdmin, paid } = req.body;
        const { error } = await supabaseAdmin.from("prize_payouts").upsert(
          {
            prize_key: prizeKey,
            prize_label: prizeLabel,
            winner_entry_id: winnerEntryId || null,
            winner_name: winnerName,
            amount,
            currency: currency || "INR",
            assigned_admin: assignedAdmin || null,
            paid: !!paid,
            paid_at: paid ? new Date().toISOString() : null,
          },
          { onConflict: "prize_key" }
        );
        if (error) throw error;
        return res.status(200).json({ status: "ok" });
      }

      res.status(400).json({ error: "Unknown action" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

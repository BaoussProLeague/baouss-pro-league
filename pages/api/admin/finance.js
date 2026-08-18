import { supabaseAdmin } from "../../../lib/supabase";
import { logAdminActivity } from "../../../lib/adminLog";

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
        if (totalPlayers === undefined || Number(totalPlayers) <= 0) {
          return res.status(400).json({ error: "Total players must be a positive number." });
        }
        if (buyinInr === undefined || Number(buyinInr) < 0) {
          return res.status(400).json({ error: "Buy-in INR must be zero or a positive number." });
        }
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
        await logAdminActivity("finance_pool_updated", `Pool set: ${totalPlayers} players @ ₹${buyinInr}`, req.body, true);
        return res.status(200).json({ status: "ok" });
      }

      if (action === "upsertPayout") {
        const { prizeKey, prizeLabel, winnerEntryId, winnerName, amount, currency, assignedAdmin, paid } = req.body;
        if (!prizeKey || !prizeLabel || !winnerName) {
          return res.status(400).json({ error: "Prize key, label, and winner name are all required." });
        }
        if (amount === undefined || Number(amount) <= 0) {
          return res.status(400).json({ error: "Amount must be a positive number." });
        }
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
        await logAdminActivity(
          "finance_payout_updated",
          `${winnerName} - ${prizeLabel} - ₹${amount} - ${paid ? "marked paid" : "recorded as owed"}`,
          req.body,
          true
        );
        return res.status(200).json({ status: "ok" });
      }

      if (action === "deletePayout") {
        const { prizeKey } = req.body;
        if (!prizeKey) return res.status(400).json({ error: "prizeKey is required to delete a payout." });
        const { error } = await supabaseAdmin.from("prize_payouts").delete().eq("prize_key", prizeKey);
        if (error) throw error;
        await logAdminActivity("finance_payout_deleted", `Payout "${prizeKey}" deleted`, { prizeKey }, true);
        return res.status(200).json({ status: "ok" });
      }

      res.status(400).json({ error: "Unknown action." });
    } catch (err) {
      await logAdminActivity("finance_action_failed", err.message, req.body, false);
      res.status(500).json({ error: `Couldn't save: ${err.message}` });
    }
  }
}

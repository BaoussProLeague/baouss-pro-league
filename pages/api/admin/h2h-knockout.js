import { supabaseAdmin } from "../../../lib/supabase";
import { logAdminActivity } from "../../../lib/adminLog";

// POST { password, action: 'add' | 'update' | 'delete', id, cup, round, gw, entryId1, entryId2, score1, score2, winnerEntryId }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, action = "add", id } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (action === "delete") {
      if (!id) return res.status(400).json({ error: "id is required to delete a knockout result." });
      const { error } = await supabaseAdmin.from("h2h_knockout_results").delete().eq("id", id);
      if (error) throw error;
      await logAdminActivity("h2h_knockout_deleted", `Knockout result ${id} deleted`, { id }, true);
      return res.status(200).json({ status: "ok" });
    }

    const { cup, round, gw, entryId1, entryId2, score1, score2, winnerEntryId } = req.body;
    if (!["gold", "silver"].includes(cup)) return res.status(400).json({ error: "Cup must be gold or silver." });
    if (!["r16", "qf", "sf", "final"].includes(round)) return res.status(400).json({ error: "Invalid round." });
    const gwNum = Number(gw);
    if (!gw || !Number.isInteger(gwNum) || gwNum < 1 || gwNum > 38) {
      return res.status(400).json({ error: "Gameweek must be a whole number between 1 and 38." });
    }
    if (!entryId1 || !entryId2 || !Number.isInteger(Number(entryId1)) || !Number.isInteger(Number(entryId2))) {
      return res.status(400).json({ error: "Both teams must be selected." });
    }
    if (Number(entryId1) === Number(entryId2)) {
      return res.status(400).json({ error: "The two teams in a fixture can't be the same team." });
    }

    const row = {
      cup, round, gw: gwNum,
      entry_id_1: entryId1, entry_id_2: entryId2,
      score_1: score1 ?? null, score_2: score2 ?? null,
      winner_entry_id: winnerEntryId ?? null,
    };

    if (action === "update") {
      if (!id) return res.status(400).json({ error: "id is required to update a knockout result." });
      const { error } = await supabaseAdmin.from("h2h_knockout_results").update(row).eq("id", id);
      if (error) throw error;
      await logAdminActivity("h2h_knockout_updated", `Knockout result ${id} updated`, req.body, true);
      return res.status(200).json({ status: "ok" });
    }

    const { error } = await supabaseAdmin.from("h2h_knockout_results").insert(row);
    if (error) throw error;
    await logAdminActivity("h2h_knockout_added", `${cup} ${round} GW${gwNum} result saved`, req.body, true);
    res.status(200).json({ status: "ok" });
  } catch (err) {
    await logAdminActivity("h2h_knockout_action_failed", err.message, req.body, false);
    res.status(500).json({ error: `Couldn't save the knockout result: ${err.message}` });
  }
}

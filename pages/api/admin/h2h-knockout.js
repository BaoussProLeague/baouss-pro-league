import { supabaseAdmin } from "../../../lib/supabase";

// POST { password, cup, round, gw, entryId1, entryId2, score1, score2, winnerEntryId }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, cup, round, gw, entryId1, entryId2, score1, score2, winnerEntryId } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!cup || !round || !gw || !entryId1 || !entryId2) {
    return res.status(400).json({ error: "cup, round, gw, entryId1, entryId2 are required" });
  }

  try {
    const { error } = await supabaseAdmin.from("h2h_knockout_results").insert({
      cup,
      round,
      gw: Number(gw),
      entry_id_1: entryId1,
      entry_id_2: entryId2,
      score_1: score1 ?? null,
      score_2: score2 ?? null,
      winner_entry_id: winnerEntryId ?? null,
    });
    if (error) throw error;
    res.status(200).json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

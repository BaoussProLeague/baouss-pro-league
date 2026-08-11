import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import { computeGwCaptaincy } from "../../../lib/prizes/captaincy";

// POST { password, gw }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, gw } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!gw) return res.status(400).json({ error: "gw is required" });

  try {
    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);
    const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));

    const results = await computeGwCaptaincy(simpleEntries, Number(gw));

    const rows = results.map((r) => ({
      entry_id: r.entry,
      entry_name: r.entryName,
      gw: r.gw,
      captain_element_id: r.captainElementId,
      captain_points: r.captainPoints,
      was_top_scorer_in_squad: r.wasTopScorerInSquad,
    }));

    const { error } = await supabaseAdmin
      .from("captain_accuracy")
      .upsert(rows, { onConflict: "entry_id,gw" });
    if (error) throw error;

    res.status(200).json({ status: "ok", recorded: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

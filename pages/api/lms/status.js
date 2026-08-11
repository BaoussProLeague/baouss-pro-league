import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";

// Returns: who is still alive, who's eliminated (and when), who's rebought.
// This reads state Supabase already has - it does NOT run the elimination
// engine live (that happens via /api/admin/lms-run, an admin-triggered
// action, since eliminations should be confirmed by a human before they're
// final - GW scores can still shift with late bonus points / VAR-style
// corrections for a day or two after the deadline).
export default async function handler(req, res) {
  try {
    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);

    const { data: eliminations } = await supabaseAdmin
      .from("lms_eliminations")
      .select("*")
      .order("gw_eliminated", { ascending: true });

    const { data: rebuys } = await supabaseAdmin.from("lms_rebuys").select("*");

    const eliminatedIds = new Set((eliminations || []).map((e) => e.entry_id));
    const stillAlive = entries.filter((e) => !eliminatedIds.has(e.entry));

    res.status(200).json({
      stillAliveCount: stillAlive.length,
      stillAlive: stillAlive.map((e) => ({ entry: e.entry, entryName: e.entry_name })),
      eliminations: eliminations || [],
      rebuys: rebuys || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

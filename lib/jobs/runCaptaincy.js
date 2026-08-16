import { supabaseAdmin } from "../supabase";
import { fpl } from "../fpl";
import { computeGwCaptaincy } from "../prizes/captaincy";

export async function runCaptaincyForGw(gwNum) {
  if (!process.env.FPL_CLASSIC_LEAGUE_ID) {
    return { ok: false, status: "config_error", message: "FPL_CLASSIC_LEAGUE_ID is not set." };
  }

  const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
  const { entries } = await fpl.allClassicEntries(leagueId);
  if (!entries || entries.length === 0) {
    return { ok: false, status: "no_entries", message: "No entries found for this classic league." };
  }
  const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));

  const results = await computeGwCaptaincy(simpleEntries, gwNum);
  if (results.length === 0) {
    return { ok: false, status: "no_data", message: `No picks found for GW${gwNum} - it probably hasn't started yet.` };
  }

  const rows = results.map((r) => ({
    entry_id: r.entry, entry_name: r.entryName, gw: r.gw,
    captain_element_id: r.captainElementId, captain_points: r.captainPoints,
    was_top_scorer_in_squad: r.wasTopScorerInSquad,
  }));

  const { error } = await supabaseAdmin.from("captain_accuracy").upsert(rows, { onConflict: "entry_id,gw" });
  if (error) return { ok: false, status: "db_error", message: error.message };

  return { ok: true, status: "ok", message: `GW${gwNum}: captain accuracy recorded for ${rows.length} managers.`, data: { recorded: rows.length } };
}

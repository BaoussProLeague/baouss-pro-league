import { supabaseAdmin } from "../supabase";
import { fpl } from "../fpl";
import { computeGwDefGk } from "../prizes/defgk";

export async function runDefGkForGw(gwNum) {
  if (!process.env.FPL_CLASSIC_LEAGUE_ID) {
    return { ok: false, status: "config_error", message: "FPL_CLASSIC_LEAGUE_ID is not set." };
  }

  const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
  const { entries } = await fpl.allClassicEntries(leagueId);
  if (!entries || entries.length === 0) {
    return { ok: false, status: "no_entries", message: "No entries found for this classic league." };
  }
  const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));

  const bootstrap = await fpl.bootstrap();
  const elementTypeById = new Map(bootstrap.elements.map((el) => [el.id, el.element_type]));

  const results = await computeGwDefGk(simpleEntries, gwNum, elementTypeById);
  const rows = results.map((r) => ({ entry_id: r.entry, entry_name: r.entryName, gw: r.gw, points: r.points }));

  const { error } = await supabaseAdmin.from("def_gk_points_log").upsert(rows, { onConflict: "entry_id,gw" });
  if (error) return { ok: false, status: "db_error", message: error.message };

  return { ok: true, status: "ok", message: `GW${gwNum}: Def+GK points recorded for ${rows.length} managers.`, data: { recorded: rows.length } };
}

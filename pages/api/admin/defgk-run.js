import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import { computeGwDefGk } from "../../../lib/prizes/defgk";
import { logAdminActivity } from "../../../lib/adminLog";

// POST { password, gw }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, gw } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const gwNum = Number(gw);
  if (!gw || !Number.isInteger(gwNum) || gwNum < 1 || gwNum > 38) {
    return res.status(400).json({ error: "Gameweek must be a whole number between 1 and 38." });
  }

  try {
    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);
    if (!entries || entries.length === 0) {
      return res.status(400).json({ error: "No entries found for this classic league - check FPL_CLASSIC_LEAGUE_ID." });
    }
    const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));

    const bootstrap = await fpl.bootstrap();
    const elementTypeById = new Map(bootstrap.elements.map((el) => [el.id, el.element_type]));

    const results = await computeGwDefGk(simpleEntries, gwNum, elementTypeById);

    const rows = results.map((r) => ({ entry_id: r.entry, entry_name: r.entryName, gw: r.gw, points: r.points }));
    const { error } = await supabaseAdmin.from("def_gk_points_log").upsert(rows, { onConflict: "entry_id,gw" });
    if (error) throw error;

    await logAdminActivity("defgk_run", `GW${gwNum}: Def+GK points recorded for ${rows.length} managers`, { gw: gwNum }, true);
    res.status(200).json({ status: "ok", recorded: rows.length });
  } catch (err) {
    await logAdminActivity("defgk_run", `GW${gwNum}: failed - ${err.message}`, { gw: gwNum }, false);
    res.status(500).json({ error: `Couldn't record Def+GK points: ${err.message}` });
  }
}

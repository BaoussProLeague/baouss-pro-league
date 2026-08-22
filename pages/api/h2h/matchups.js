import { fpl } from "../../../lib/fpl";
import { supabaseAdmin } from "../../../lib/supabase";
import { getLiveGwScoresFromStandings, gwStatus } from "../../../lib/prizes/liveScores";
import { setNoCache } from "../../../lib/noCacheHeaders";

export default async function handler(req, res) {
  setNoCache(res);

  try {
    const bootstrap = await fpl.bootstrap();
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    const currentGw = currentEvent ? currentEvent.id : 1;
    const status = gwStatus(currentEvent);

    const { data: thisWeek, error } = await supabaseAdmin
      .from("h2h_custom_fixtures")
      .select("*")
      .eq("gw", currentGw)
      .not("entry_id_2", "is", null); // exclude byes from the matchups view

    if (error) throw error;
    if (!thisWeek || thisWeek.length === 0) {
      return res.status(200).json({ gw: currentGw, status, matchups: [] });
    }

    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries: classicEntries } = await fpl.allClassicEntries(leagueId);
    const nameById = new Map(classicEntries.map((e) => [e.entry, e.entry_name]));

    let scoreById = new Map();
    if (status !== "upcoming") {
      const liveScores = getLiveGwScoresFromStandings(classicEntries);
      scoreById = new Map(liveScores.map((s) => [s.entry, s.points]));
    }

    const matchups = thisWeek.map((m) => ({
      entry1: { id: m.entry_id_1, name: nameById.get(m.entry_id_1) || `Entry ${m.entry_id_1}`, points: scoreById.get(m.entry_id_1) ?? null },
      entry2: { id: m.entry_id_2, name: nameById.get(m.entry_id_2) || `Entry ${m.entry_id_2}`, points: scoreById.get(m.entry_id_2) ?? null },
    }));

    res.status(200).json({ gw: currentGw, status, matchups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

import { fpl } from "../../../lib/fpl";
import { supabaseAdmin } from "../../../lib/supabase";
import { getLiveGwScoresFromStandings, gwStatus } from "../../../lib/prizes/liveScores";
import { setNoCache } from "../../../lib/noCacheHeaders";

const FIRST_H2H_GW = 2;
const LAST_H2H_GW = 30;

export default async function handler(req, res) {
  setNoCache(res);

  try {
    const bootstrap = await fpl.bootstrap();
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    const currentGw = currentEvent ? currentEvent.id : 1;

    // The schedule only covers GW2-GW30 - before GW2, there's nothing to
    // show for "this GW" specifically, which is exactly why the card was
    // silently disappearing before a ball had even been kicked in the
    // group stage. Default to the first real H2H gameweek instead of
    // showing nothing, and let the requested GW override that.
    const requestedGw = req.query.gw ? Number(req.query.gw) : Math.max(currentGw, FIRST_H2H_GW);
    const displayGw = Math.min(Math.max(requestedGw, FIRST_H2H_GW), LAST_H2H_GW);
    const targetEvent = bootstrap.events.find((e) => e.id === displayGw);
    const status = gwStatus(targetEvent);

    const { data: fixturesThisGw, error } = await supabaseAdmin
      .from("h2h_custom_fixtures")
      .select("*")
      .eq("gw", displayGw)
      .not("entry_id_2", "is", null); // exclude byes from the matchups view

    if (error) throw error;

    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries: classicEntries } = await fpl.allClassicEntries(leagueId);
    const nameById = new Map(classicEntries.map((e) => [e.entry, e.entry_name]));

    let scoreById = new Map();
    if (displayGw === currentGw && status !== "upcoming") {
      const liveScores = getLiveGwScoresFromStandings(classicEntries);
      scoreById = new Map(liveScores.map((s) => [s.entry, s.points]));
    }

    const matchups = (fixturesThisGw || []).map((m) => ({
      entry1: { id: m.entry_id_1, name: nameById.get(m.entry_id_1) || `Entry ${m.entry_id_1}`, points: scoreById.get(m.entry_id_1) ?? null },
      entry2: { id: m.entry_id_2, name: nameById.get(m.entry_id_2) || `Entry ${m.entry_id_2}`, points: scoreById.get(m.entry_id_2) ?? null },
    }));

    res.status(200).json({
      gw: displayGw,
      currentGw,
      firstGw: FIRST_H2H_GW,
      lastGw: LAST_H2H_GW,
      isCurrentGw: displayGw === currentGw,
      status,
      matchups,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

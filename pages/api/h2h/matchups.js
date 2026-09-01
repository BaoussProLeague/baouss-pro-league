import { fpl } from "../../../lib/fpl";
import { supabaseAdmin } from "../../../lib/supabase";
import { getLiveGwScoresFromStandings, gwStatus, getEffectiveCurrentGw } from "../../../lib/prizes/liveScores";
import { setNoCache } from "../../../lib/noCacheHeaders";

const FIRST_H2H_GW = 2;
const LAST_H2H_GW = 30;

export default async function handler(req, res) {
  setNoCache(res);

  try {
    const bootstrap = await fpl.bootstrap();
    // Same fix as the Classic fixtures card and the nav badge: FPL's own
    // is_current/is_next flags can lag behind genuine finalization,
    // which is exactly why this kept showing GW2 after it was actually
    // done. Using the shared, confirmed-accurate check instead.
    let eventStatusData = null;
    try {
      eventStatusData = await fpl.eventStatus();
    } catch {
      // getEffectiveCurrentGw falls back to finished+data_checked automatically
    }
    const currentGw = getEffectiveCurrentGw(bootstrap.events, eventStatusData) || 1;

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
    } else if (displayGw < currentGw) {
      // A genuinely past gameweek - history is fully reliable here, so
      // pull each manager's actual final score for it instead of
      // showing empty dashes. Only fetching for the managers who
      // actually appear in this gameweek's fixtures, not the whole
      // league, to keep this cheap.
      const entryIds = new Set();
      (fixturesThisGw || []).forEach((m) => {
        entryIds.add(m.entry_id_1);
        entryIds.add(m.entry_id_2);
      });
      const histories = await Promise.all(
        Array.from(entryIds).map(async (entryId) => {
          try {
            const h = await fpl.entryHistory(entryId);
            const row = h.current.find((r) => r.event === displayGw);
            return { entryId, points: row ? row.points : null };
          } catch {
            return { entryId, points: null };
          }
        })
      );
      scoreById = new Map(histories.map((h) => [h.entryId, h.points]));
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
      // Distinct from isCurrentGw on purpose: before GW2, the "default"
      // view is GW2 (the first gameweek that actually has fixtures), not
      // the literal current gameweek (GW1) - isCurrentGw stays reserved
      // for "is a match from this GW genuinely live right now", while
      // this one decides whether the Current jump-back button should
      // show at all.
      isDefaultGw: displayGw === Math.max(currentGw, FIRST_H2H_GW),
      status,
      matchups,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

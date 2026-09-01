import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { getLiveGwScoresFromStandings, gwStatus } from "../../../lib/prizes/liveScores";

// Returns: who is still alive, who's eliminated (and when), who's rebought.
// This reads state Supabase already has - it does NOT run the elimination
// engine live (that happens via /api/admin/lms-run, an admin-triggered
// action, since eliminations should be confirmed by a human before they're
// final - GW scores can still shift with late bonus points / VAR-style
// corrections for a day or two after the deadline).
export default async function handler(req, res) {
  setNoCache(res);
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

    // Purely informational - lets people watch who's currently trending
    // toward the bottom during a live gameweek. Does NOT feed into the
    // actual elimination decision, which only ever runs once the
    // gameweek is genuinely, fully finalized (see runLmsForGw).
    const bootstrap = await fpl.bootstrap();
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    const status = gwStatus(currentEvent);
    let livePointsByEntry = new Map();
    if (status !== "upcoming") {
      const liveScores = getLiveGwScoresFromStandings(entries);
      livePointsByEntry = new Map(liveScores.map((s) => [s.entry, s.points]));
    }

    res.status(200).json({
      currentGw: currentEvent ? currentEvent.id : null,
      gwIsLive: status === "live",
      stillAliveCount: stillAlive.length,
      stillAlive: stillAlive.map((e) => ({
        entry: e.entry,
        entryName: e.entry_name,
        currentGwPoints: livePointsByEntry.has(e.entry) ? livePointsByEntry.get(e.entry) : null,
      })),
      eliminations: eliminations || [],
      rebuys: rebuys || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

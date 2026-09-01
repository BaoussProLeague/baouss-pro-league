import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { getLiveGwScoresFromStandings, gwStatus, getEffectiveCurrentGw } from "../../../lib/prizes/liveScores";

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

    const bootstrap = await fpl.bootstrap();
    let eventStatusData = null;
    try {
      eventStatusData = await fpl.eventStatus();
    } catch {
      // getEffectiveCurrentGw falls back to finished+data_checked automatically
    }
    const currentGw = getEffectiveCurrentGw(bootstrap.events, eventStatusData);
    const currentEvent = bootstrap.events.find((e) => e.id === currentGw);
    const status = gwStatus(currentEvent);

    // The actual bug: this showed live points/danger for the current
    // gameweek even after that gameweek's elimination had already been
    // decided and recorded - the danger zone concept doesn't mean
    // anything once the actual decision is already locked in. Checking
    // whether THIS gameweek already has an elimination row is what
    // correctly turns the danger display off once it's genuinely done,
    // rather than continuing to show stale "who might be eliminated"
    // data for a decision that's already been made.
    const alreadyDecidedForCurrentGw = (eliminations || []).some((e) => e.gw_eliminated === currentGw);
    const eliminationPending = status === "live" && !alreadyDecidedForCurrentGw;

    let livePointsByEntry = new Map();
    if (eliminationPending) {
      const liveScores = getLiveGwScoresFromStandings(entries);
      livePointsByEntry = new Map(liveScores.map((s) => [s.entry, s.points]));
    }

    res.status(200).json({
      currentGw,
      gwIsLive: eliminationPending,
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

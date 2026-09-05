import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { getLiveGwScoresFromStandings, gwStatus, getEffectiveCurrentGw } from "../../../lib/prizes/liveScores";
import { withFallbackCache } from "../../../lib/prizes/fallbackCache";
import { isFplDownError } from "../../../lib/fplErrors";

// Returns: who is still alive, who's eliminated (and when), who's rebought.
// This reads state Supabase already has - it does NOT run the elimination
// engine live (that happens via /api/admin/lms-run, an admin-triggered
// action, since eliminations should be confirmed by a human before they're
// final - GW scores can still shift with late bonus points / VAR-style
// corrections for a day or two after the deadline).
export default async function handler(req, res) {
  setNoCache(res);
  try {
    // Eliminations and rebuys live entirely in our own database - they
    // don't need FPL to be up at all, so they always load first and
    // always return, regardless of what happens below. This is exactly
    // what was missing before: FPL being briefly down was taking the
    // whole page blank, including the parts that had nothing to do with
    // FPL in the first place.
    const { data: eliminations } = await supabaseAdmin
      .from("lms_eliminations")
      .select("*")
      .order("gw_eliminated", { ascending: true });
    const { data: rebuys } = await supabaseAdmin.from("lms_rebuys").select("*");

    let stillAliveResult = null;
    let fplUnavailable = false;
    let stale = false;
    let staleSince = null;

    try {
      const { data, stale: isStale, staleSince: since } = await withFallbackCache("lms_still_alive", async () => {
        const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
        const { entries } = await fpl.allClassicEntries(leagueId);

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

        // The confirmed bug: event_total can still carry over the
        // PREVIOUS gameweek's number in the gap between deadline and
        // kickoff, rather than genuinely reflecting 0 for the new one -
        // proven by seeing old scores show up before any match had
        // started. Checking whether a match has actually begun is what
        // correctly forces 0 during that gap instead of trusting a
        // field that hasn't caught up yet.
        const gwFixtures = currentGw ? await fpl.fixtures(currentGw) : [];
        const fixturesStarted = gwFixtures.some((f) => f.started);

        const eliminatedIds = new Set((eliminations || []).map((e) => e.entry_id));
        const stillAlive = entries.filter((e) => !eliminatedIds.has(e.entry));

        // Same fix as before: don't show live/danger points for a
        // gameweek whose elimination has already been decided.
        const alreadyDecidedForCurrentGw = (eliminations || []).some((e) => e.gw_eliminated === currentGw);
        const eliminationPending = status === "live" && !alreadyDecidedForCurrentGw;

        let livePointsByEntry = new Map();
        if (eliminationPending) {
          const liveScores = getLiveGwScoresFromStandings(entries, fixturesStarted);
          livePointsByEntry = new Map(liveScores.map((s) => [s.entry, s.points]));
        }

        // Sorted by current gameweek points, highest first - this used
        // to just inherit Classic League's own rank ordering (since it
        // came straight from Classic standings, unsorted), which is
        // exactly why it looked like the Classic League order instead
        // of the actual LMS-relevant one. Whoever's actually in the most
        // danger (lowest score) now genuinely sits at the bottom.
        const sortedStillAlive = [...stillAlive].sort((a, b) => {
          const pa = livePointsByEntry.has(a.entry) ? livePointsByEntry.get(a.entry) : Infinity;
          const pb = livePointsByEntry.has(b.entry) ? livePointsByEntry.get(b.entry) : Infinity;
          return pb - pa;
        });

        return {
          currentGw,
          gwIsLive: eliminationPending,
          stillAliveCount: stillAlive.length,
          stillAlive: sortedStillAlive.map((e) => ({
            entry: e.entry,
            entryName: e.entry_name,
            currentGwPoints: livePointsByEntry.has(e.entry) ? livePointsByEntry.get(e.entry) : null,
          })),
        };
      });
      stillAliveResult = data;
      stale = isStale;
      staleSince = since;
    } catch (err) {
      if (!isFplDownError(err.message)) throw err;
      // FPL is down AND we've never successfully cached this before -
      // still return the eliminations table below rather than fail the
      // whole request.
      fplUnavailable = true;
    }

    res.status(200).json({
      ...(stillAliveResult || { currentGw: null, gwIsLive: false, stillAliveCount: null, stillAlive: [] }),
      fplUnavailable,
      stale,
      staleSince,
      eliminations: eliminations || [],
      rebuys: rebuys || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

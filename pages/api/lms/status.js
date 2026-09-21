import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { getLiveGwScoresFromStandings, gwStatus, getEffectiveCurrentGw } from "../../../lib/prizes/liveScores";
import { eliminationsThisWeekFor } from "../../../lib/prizes/lms";
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
          // The other half of this fix: the frontend used to only know
          // "the single lowest score," with zero concept of how many
          // people actually get eliminated this week. Exposing the real
          // number here (same shared source the elimination engine
          // itself uses) is what lets the danger highlight correctly
          // flag the bottom 2 during a 2-elimination week instead of
          // just 1.
          eliminationsThisWeek: eliminationPending ? eliminationsThisWeekFor(currentGw) : null,
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
      ...(stillAliveResult || { currentGw: null, gwIsLive: false, eliminationsThisWeek: null, stillAliveCount: null, stillAlive: [] }),
      fplUnavailable,
      stale,
      staleSince,
      eliminations: await withCurrentScores(eliminations || [], stillAliveResult?.currentGw),
      rebuys: rebuys || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// The actual fix, not a one-off correction: FPL's own "confirmed" signal
// isn't a literal guarantee nothing will ever change again - a rare late
// stat correction can still land even after that (proven directly: El
// Pistolero's stored elimination score of 47 vs. their real 48, days
// after the gameweek supposedly finalized). Rather than trust a frozen
// snapshot forever and need a manual fix every time this happens, this
// re-checks the TRUE current score for anyone eliminated recently -
// where a late correction is still realistically possible - and shows
// that instead. Anything eliminated further back is trusted as-is:
// FPL doesn't reach back and revise gameweeks from many weeks ago, and
// re-fetching the entire season's worth of eliminations on every page
// load would be real, unnecessary cost for no real benefit.
const RECHECK_WINDOW_GWS = 3;

async function withCurrentScores(eliminations, currentGw) {
  if (eliminations.length === 0 || !currentGw) return eliminations;

  const recentCutoff = currentGw - RECHECK_WINDOW_GWS;
  const recent = eliminations.filter((e) => e.gw_eliminated >= recentCutoff);
  if (recent.length === 0) return eliminations;

  const currentScores = await Promise.all(
    recent.map(async (e) => {
      try {
        const h = await fpl.entryHistory(e.entry_id);
        const row = h.current.find((r) => r.event === e.gw_eliminated);
        return { entry_id: e.entry_id, gw_eliminated: e.gw_eliminated, points: row ? row.points : null };
      } catch {
        return null; // falls back to the stored value below
      }
    })
  );
  const currentByKey = new Map(
    currentScores.filter(Boolean).map((s) => [`${s.entry_id}-${s.gw_eliminated}`, s.points])
  );

  return eliminations.map((e) => {
    const current = currentByKey.get(`${e.entry_id}-${e.gw_eliminated}`);
    // The actual fix: last time, this silently REPLACED the displayed
    // score with whatever FPL currently reports - which meant a decision
    // that was entirely correct at the moment it was made (using
    // whatever score FPL had confirmed at the time) could later look
    // bizarre and unexplained if FPL's data shifted afterward, with zero
    // indication anything had changed. That's exactly what caused the
    // confusion here. Now both values are kept, clearly separate: what
    // the decision was actually based on stays untouched, and a
    // corrected value only ever appears as a distinctly-flagged note.
    const hasCorrection = current !== undefined && current !== null && current !== e.gw_score;
    return {
      ...e,
      score_at_decision: e.gw_score,
      corrected_score: hasCorrection ? current : null,
    };
  });
}

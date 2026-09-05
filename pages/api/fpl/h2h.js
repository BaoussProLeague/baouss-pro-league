import { fpl } from "../../../lib/fpl";
import { supabaseAdmin } from "../../../lib/supabase";
import { loadAllHistories } from "../../../lib/prizes/fromHistory";
import { computeCustomH2hStandings } from "../../../lib/prizes/customH2h";
import { computeRankDeltas } from "../../../lib/prizes/rankDelta";
import { getLiveGwScoresFromStandings, gwStatus, isGwFinalizedFromStatus, getEffectiveCurrentGw } from "../../../lib/prizes/liveScores";
import { withFallbackCache } from "../../../lib/prizes/fallbackCache";
import { isFplDownError } from "../../../lib/fplErrors";
import { setNoCache } from "../../../lib/noCacheHeaders";

const GROUP_STAGE_LAST_GW = 30;

// Self-hosted H2H, entirely independent of FPL's own H2H league (which
// you called obsolete once some managers missed its join deadline).
// Fixtures come from our own generated schedule (see
// /api/admin/generate-h2h-fixtures); results come from comparing each
// pair's real Classic gameweek score.
export default async function handler(req, res) {
  setNoCache(res);
  try {
    // Fixtures live entirely in our own database and don't need FPL to
    // be up - this always loads and always returns, regardless of
    // whether the FPL-dependent standings below succeed.
    const { data: fixtures, error: fixturesError } = await supabaseAdmin
      .from("h2h_custom_fixtures")
      .select("*");
    if (fixturesError) throw fixturesError;

    if (!fixtures || fixtures.length === 0) {
      return res.status(200).json({
        currentGw: null,
        groupStageOver: false,
        groupStageSnapshotGw: null,
        hasStarted: false,
        fixturesGenerated: false,
        standings: [],
        cupQualification: { gold: [], silver: [] },
      });
    }

    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    let standingsResult = null;
    let fplUnavailable = false;
    let stale = false;
    let staleSince = null;

    try {
      const { data, stale: isStale, staleSince: since } = await withFallbackCache("h2h_standings", async () => {
        const { entries } = await fpl.allClassicEntries(leagueId);
        const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));
        const histories = await loadAllHistories(simpleEntries);

        const bootstrap = await fpl.bootstrap();

        // Fetched once here and reused for both "what's the current gw"
        // and "which gameweeks are fully completed" below - same signal
        // FPL's own site uses for its "PROVISIONAL" label, replacing
        // is_current/is_next, which can lag behind genuine finalization
        // (that lag is exactly what caused standings to disagree with
        // the matchups view about what gameweek was "current").
        let eventStatusData = null;
        try {
          eventStatusData = await fpl.eventStatus();
        } catch {
          // isGwFinalizedFromStatus falls back to finished+data_checked automatically
        }
        const currentGw = getEffectiveCurrentGw(bootstrap.events, eventStatusData) || 1;
        const currentEvent = bootstrap.events.find((e) => e.id === currentGw);
        const groupStageOver = currentGw > GROUP_STAGE_LAST_GW;
        const status = gwStatus(currentEvent);

        // The actual bug: standings were always including the current
        // gameweek's fixtures, live score and all - which meant a
        // genuinely still-changing scoreline got immediately converted
        // into a final, points-awarding win/draw/loss before the match
        // was actually decided. A live SCORE is fine to show (that's
        // what the matchups view does, correctly) - but standings are a
        // declared RESULT, and that should only ever come from a
        // gameweek that's genuinely, fully finished. This finds the most
        // recent gameweek that actually is, and freezes standings there
        // until the current one joins it.
        const eventsWithMatches = bootstrap.events.filter((e) => gwStatus(e) !== "upcoming");
        const completedGws = eventsWithMatches
          .filter((e) => isGwFinalizedFromStatus(eventStatusData, e.id, bootstrap.events))
          .map((e) => e.id);
        const lastCompletedGw = completedGws.length > 0 ? Math.max(...completedGws) : 0;

        let liveScoresMap = null;
        if (status !== "upcoming" && !groupStageOver) {
          // Same fix as everywhere else: event_total can carry over the
          // previous gameweek's number until a match actually starts.
          const rawFixturesForGw = await fpl.fixtures(currentGw);
          const fixturesStarted = rawFixturesForGw.some((f) => f.started);
          const liveScores = getLiveGwScoresFromStandings(entries, fixturesStarted);
          liveScoresMap = new Map(liveScores.map((s) => [s.entry, s]));
        }

        const uptoGw = groupStageOver ? GROUP_STAGE_LAST_GW : lastCompletedGw;
        const ranked = computeCustomH2hStandings(fixtures, histories, uptoGw, currentGw, liveScoresMap);

        // Last week's standings, purely to diff against this week's for
        // the rank-change arrows - frozen once the group stage itself is
        // frozen.
        const prevCompletedGws = completedGws.filter((g) => g < lastCompletedGw);
        const prevUptoGw = groupStageOver ? GROUP_STAGE_LAST_GW : (prevCompletedGws.length > 0 ? Math.max(...prevCompletedGws) : 0);
        const rankedPrev = computeCustomH2hStandings(fixtures, histories, prevUptoGw, currentGw, liveScoresMap);
        const deltas = computeRankDeltas(ranked, rankedPrev);

        const gold = ranked.slice(0, 16);
        const silver = ranked.slice(16, 32);

        return {
          currentGw,
          groupStageOver,
          groupStageSnapshotGw: groupStageOver ? GROUP_STAGE_LAST_GW : null,
          hasStarted: ranked.length > 0,
          standings: ranked.map((r, i) => ({
            entry: r.entry,
            entryName: r.entryName,
            rank: i + 1,
            played: r.played,
            won: r.won,
            drawn: r.drawn,
            lost: r.lost,
            points: r.points,
            delta: deltas.get(r.entry) ?? null,
          })),
          cupQualification: {
            gold: gold.map((r, i) => ({ entry: r.entry, entryName: r.entryName, rank: i + 1 })),
            silver: silver.map((r, i) => ({ entry: r.entry, entryName: r.entryName, rank: i + 17 })),
          },
        };
      });
      standingsResult = data;
      stale = isStale;
      staleSince = since;
    } catch (err) {
      if (!isFplDownError(err.message)) throw err;
      fplUnavailable = true;
    }

    res.status(200).json({
      ...(standingsResult || {
        currentGw: null, groupStageOver: false, groupStageSnapshotGw: null,
        hasStarted: false, standings: [], cupQualification: { gold: [], silver: [] },
      }),
      fixturesGenerated: true,
      fplUnavailable,
      stale,
      staleSince,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

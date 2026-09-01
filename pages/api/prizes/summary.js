import { fpl } from "../../../lib/fpl";
import {
  loadAllHistories, teamValue, benchPoints, firstToThreshold,
  managerOfTheMonth, rankJumpByMonth, comebackKing, leastTransferCost, wildcardVision,
} from "../../../lib/prizes/fromHistory";
import { chipPrizes } from "../../../lib/prizes/chips";
import { buildMonthGwMap } from "../../../lib/monthCalendar";
import { getLiveGwScoresFromStandings, getLiveBenchPointsFromPicks, gwStatus, isAnyMatchLive, getLatestStartedGw } from "../../../lib/prizes/liveScores";
import { computeRankDeltas } from "../../../lib/prizes/rankDelta";
import { setNoCache } from "../../../lib/noCacheHeaders";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);
    const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));
    const histories = await loadAllHistories(simpleEntries);

    const bootstrap = await fpl.bootstrap();
    const monthGwMap = buildMonthGwMap(bootstrap.events);
    let eventStatusData = null;
    try {
      eventStatusData = await fpl.eventStatus();
    } catch {
      // getEffectiveCurrentGw / isGwFinalizedFromStatus fall back to finished+data_checked automatically
    }
    // getLatestStartedGw, not getEffectiveCurrentGw - every prize here
    // tracks "current/live contribution," not "which gameweek's
    // fixtures to default-show." Using the fixtures-style advance-early
    // logic caused MOTM to jump to GW3/September the instant GW2
    // finalized, showing 0 for everyone since September has no data yet.
    const currentGw = getLatestStartedGw(bootstrap.events) || 1;
    const currentEvent = bootstrap.events.find((e) => e.id === currentGw);
    const status = gwStatus(currentEvent);
    // Bug found during audit: this only subtracted a gameweek for
    // "upcoming" status, treating "live" the same as "completed" - so
    // during a live gameweek, "last played" pointed at the gameweek
    // that's still being played, not the last one that actually
    // finished. Now that comebackKing is live-aware, currentGw itself
    // (not this) is what's actually passed to it - this value stays for
    // anything that genuinely needs "last fully completed gameweek."
    const lastPlayedGw = status === "completed" ? currentGw : Math.max(1, currentGw - 1);
    const prevGw = Math.max(1, currentGw - 1);

    // The actual bug: gating this on status === "live" trusted FPL's own
    // "gameweek finished" flag as proof that history had caught up too -
    // but those are two separate FPL backend processes, and the flag can
    // flip before history actually has. That left a real window where
    // status said "completed" (so this never ran) while history was
    // still missing that GW's row entirely - the number just froze wrong
    // with nothing left to correct it. Fetching this whenever the GW has
    // started (not just while "live") closes that gap - each prize's own
    // check for "does history already have this row" (see benchPoints,
    // managerOfTheMonth, etc.) decides whether to actually use it, so
    // this is never wasted once history genuinely catches up.
    let liveNow = false;
    let liveScoresMap = null;
    let liveBenchMap = null;
    if (status !== "upcoming") {
      const rawFixtures = await fpl.fixtures(currentGw);
      liveNow = isAnyMatchLive(rawFixtures);
      const liveScores = getLiveGwScoresFromStandings(entries);
      liveScoresMap = new Map(liveScores.map((s) => [s.entry, s]));
      const liveBench = await getLiveBenchPointsFromPicks(simpleEntries, currentGw);
      liveBenchMap = new Map(liveBench.map((s) => [s.entry, s]));
    }

    // Standings with rank, needed for top-half eligibility on a couple of prizes
    const standingsForRank = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name, rank: e.rank }));
    const topHalfCutoff = Math.ceil(entries.length / 2);

    const motmByMonth = managerOfTheMonth(histories, monthGwMap, status !== "upcoming" ? currentGw : null, liveScoresMap);
    const rankJumpByMonthResult = rankJumpByMonth(histories, monthGwMap, bootstrap.events, status !== "upcoming" ? currentGw : null, liveScoresMap, eventStatusData);

    // Current month's leaders, for a quick "who's leading right now" view
    const monthEntries = Object.entries(monthGwMap).sort(([, a], [, b]) => Math.min(...a) - Math.min(...b));
    const currentMonthEntry = monthEntries.find(([, gws]) => gws.includes(currentGw)) || monthEntries[monthEntries.length - 1];
    // Rank Jump specifically has no valid baseline in the season's first
    // calendar month - flagged separately so the UI can show the exact
    // "starts next month, this month is the baseline" message rather
    // than a generic "no data yet."
    const rankJumpIsFirstMonth = monthEntries.length > 0 && currentMonthEntry && currentMonthEntry[0] === monthEntries[0][0];

    const teamValueNow = teamValue(histories);
    const benchPointsNow = benchPoints(histories, null, status !== "upcoming" ? currentGw : null, liveBenchMap);
    const leastTransferCostNow = leastTransferCost(histories, standingsForRank, topHalfCutoff);

    const teamValuePrev = teamValue(histories, prevGw);
    const benchPointsPrev = benchPoints(histories, prevGw);
    const leastTransferCostPrev = leastTransferCost(histories, standingsForRank, topHalfCutoff, prevGw);

    res.status(200).json({
      currentGw,
      gwStatus: status,
      liveNow,
      teamValue: teamValueNow,
      benchPoints: benchPointsNow,
      first1499: firstToThreshold(histories, 1499, status !== "upcoming" ? currentGw : null, liveScoresMap, liveNow),
      chips: chipPrizes(histories, status !== "upcoming" ? currentGw : null, liveScoresMap, liveNow),
      wildcardVision: wildcardVision(histories, status !== "upcoming" ? currentGw : null, liveScoresMap),
      leastTransferCost: leastTransferCostNow,
      comebackKing: currentGw > 19 ? comebackKing(histories, currentGw, topHalfCutoff, status !== "upcoming" ? currentGw : null, liveScoresMap) : [],
      motm: motmByMonth,
      rankJumpByMonth: rankJumpByMonthResult,
      currentMonth: currentMonthEntry ? currentMonthEntry[0] : null,
      rankJumpIsFirstMonth,
      topHalfCutoff,
      totalManagers: entries.length,
      deltas: {
        teamValue: Object.fromEntries(computeRankDeltas(teamValueNow, teamValuePrev)),
        benchPoints: Object.fromEntries(computeRankDeltas(benchPointsNow, benchPointsPrev)),
        leastTransferCost: Object.fromEntries(computeRankDeltas(leastTransferCostNow, leastTransferCostPrev)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

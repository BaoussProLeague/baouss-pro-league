import { fpl } from "../../../lib/fpl";
import {
  loadAllHistories, teamValue, benchPoints, firstToThreshold,
  managerOfTheMonth, rankJumpByMonth, comebackKing, leastTransferCost, wildcardVision,
} from "../../../lib/prizes/fromHistory";
import { chipPrizes } from "../../../lib/prizes/chips";
import { buildMonthGwMap } from "../../../lib/monthCalendar";
import { getLiveGwScoresFromStandings, gwStatus, isAnyMatchLive } from "../../../lib/prizes/liveScores";
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
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    const currentGw = currentEvent ? currentEvent.id : 1;
    const status = gwStatus(currentEvent);
    const lastPlayedGw = Math.max(1, currentGw - (status === "upcoming" ? 1 : 0));
    const prevGw = Math.max(1, currentGw - 1);

    // "Is anything actually happening right now" - the single source of
    // truth for whether a LIVE badge on a prize card is honest.
    let liveNow = false;
    let liveScoresMap = null;
    if (status === "live") {
      const rawFixtures = await fpl.fixtures(currentGw);
      liveNow = isAnyMatchLive(rawFixtures);
      const liveScores = getLiveGwScoresFromStandings(entries);
      liveScoresMap = new Map(liveScores.map((s) => [s.entry, s]));
    }

    // Standings with rank, needed for top-half eligibility on a couple of prizes
    const standingsForRank = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name, rank: e.rank }));
    const topHalfCutoff = Math.ceil(entries.length / 2);

    const motmByMonth = managerOfTheMonth(histories, monthGwMap);
    const rankJumpByMonthResult = rankJumpByMonth(histories, monthGwMap);

    // Current month's leaders, for a quick "who's leading right now" view
    const monthEntries = Object.entries(monthGwMap);
    const currentMonthEntry = monthEntries.find(([, gws]) => gws.includes(currentGw)) || monthEntries[monthEntries.length - 1];

    const teamValueNow = teamValue(histories);
    const benchPointsNow = benchPoints(histories);
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
      first1499: firstToThreshold(histories, 1499),
      chips: chipPrizes(histories, status === "live" ? currentGw : null, liveScoresMap),
      wildcardVision: wildcardVision(histories),
      leastTransferCost: leastTransferCostNow,
      comebackKing: currentGw > 19 ? comebackKing(histories, lastPlayedGw, topHalfCutoff) : [],
      motm: motmByMonth,
      rankJumpByMonth: rankJumpByMonthResult,
      currentMonth: currentMonthEntry ? currentMonthEntry[0] : null,
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

import { fpl } from "../../../lib/fpl";
import {
  loadAllHistories, teamValue, benchPoints, firstToThreshold,
  managerOfTheMonth, rankJumpByMonth, comebackKing, leastTransferCost, wildcardVision,
} from "../../../lib/prizes/fromHistory";
import { chipPrizes } from "../../../lib/prizes/chips";
import { buildMonthGwMap } from "../../../lib/monthCalendar";

export default async function handler(req, res) {
  try {
    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);
    const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));
    const histories = await loadAllHistories(simpleEntries);

    const bootstrap = await fpl.bootstrap();
    const monthGwMap = buildMonthGwMap(bootstrap.events);
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    const currentGw = currentEvent ? currentEvent.id : 1;
    const lastPlayedGw = Math.max(1, currentGw - (currentEvent && currentEvent.is_current ? 0 : 1));

    // Standings with rank, needed for top-half eligibility on a couple of prizes
    const standingsForRank = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name, rank: e.rank }));
    const topHalfCutoff = Math.ceil(entries.length / 2);

    const motmByMonth = managerOfTheMonth(histories, monthGwMap);
    const rankJumpByMonthResult = rankJumpByMonth(histories, monthGwMap);

    // Current month's leaders, for a quick "who's leading right now" view
    const monthEntries = Object.entries(monthGwMap);
    const currentMonthEntry = monthEntries.find(([, gws]) => gws.includes(currentGw)) || monthEntries[monthEntries.length - 1];

    res.status(200).json({
      teamValue: teamValue(histories),
      benchPoints: benchPoints(histories),
      first1499: firstToThreshold(histories, 1499),
      chips: chipPrizes(histories),
      wildcardVision: wildcardVision(histories),
      leastTransferCost: leastTransferCost(histories, standingsForRank, topHalfCutoff),
      comebackKing: currentGw > 19 ? comebackKing(histories, lastPlayedGw, topHalfCutoff) : [],
      motm: motmByMonth,
      rankJumpByMonth: rankJumpByMonthResult,
      currentMonth: currentMonthEntry ? currentMonthEntry[0] : null,
      topHalfCutoff,
      totalManagers: entries.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

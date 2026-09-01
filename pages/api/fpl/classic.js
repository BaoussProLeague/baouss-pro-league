import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { loadAllHistories, managerOfTheMonth } from "../../../lib/prizes/fromHistory";
import { buildMonthGwMap } from "../../../lib/monthCalendar";
import { getLiveGwScoresFromStandings, gwStatus, getLatestStartedGw } from "../../../lib/prizes/liveScores";

export default async function handler(req, res) {
  setNoCache(res);
  const leagueId = req.query.id || process.env.FPL_CLASSIC_LEAGUE_ID;
  if (!leagueId) {
    return res.status(400).json({ error: "Missing classic league id. Set FPL_CLASSIC_LEAGUE_ID or pass ?id=" });
  }
  try {
    const { league, entries } = await fpl.allClassicEntries(leagueId);

    // Current month's running total (live), reusing the exact same
    // computation Manager of the Month already uses - one source of
    // truth for "points this calendar month" instead of two versions
    // that could drift apart.
    const bootstrap = await fpl.bootstrap();
    // getLatestStartedGw, not getEffectiveCurrentGw - month-tracking
    // needs "the latest gameweek genuinely underway," not "the next
    // gameweek to default-show fixtures for." Using the fixtures-style
    // advance-early logic here was exactly what caused this to jump to
    // GW3/September the instant GW2 finalized, showing 0 for everyone
    // since September has no data yet.
    const currentGw = getLatestStartedGw(bootstrap.events);
    const currentEvent = bootstrap.events.find((e) => e.id === currentGw);
    const status = gwStatus(currentEvent);

    const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));
    const histories = await loadAllHistories(simpleEntries);
    const monthGwMap = buildMonthGwMap(bootstrap.events);

    let liveScoresMap = null;
    if (status !== "upcoming") {
      const liveScores = getLiveGwScoresFromStandings(entries);
      liveScoresMap = new Map(liveScores.map((s) => [s.entry, s]));
    }

    const monthEntries = Object.entries(monthGwMap).sort(([, a], [, b]) => Math.min(...a) - Math.min(...b));
    const currentMonthEntry = monthEntries.find(([, gws]) => gws.includes(currentGw));
    const monthByEntry = new Map();
    if (currentMonthEntry) {
      const motmAllMonths = managerOfTheMonth(histories, { [currentMonthEntry[0]]: currentMonthEntry[1] }, currentGw, liveScoresMap);
      (motmAllMonths[currentMonthEntry[0]] || []).forEach((r) => monthByEntry.set(r.entry, r.points));
    }

    res.status(200).json({
      league: { id: league.id, name: league.name },
      currentMonthLabel: currentMonthEntry ? currentMonthEntry[0] : null,
      standings: entries.map((e) => ({
        entry: e.entry,
        entryName: e.entry_name,
        managerName: e.player_name,
        rank: e.rank,
        lastRank: e.last_rank,
        totalPoints: e.total,
        gwPoints: e.event_total,
        monthPoints: monthByEntry.has(e.entry) ? monthByEntry.get(e.entry) : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

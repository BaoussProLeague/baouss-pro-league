import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { loadAllHistories, managerOfTheMonth } from "../../../lib/prizes/fromHistory";
import { buildMonthGwMap } from "../../../lib/monthCalendar";
import { getLiveGwScoresFromStandings, gwStatus, getLatestStartedGw } from "../../../lib/prizes/liveScores";
import { withFallbackCache } from "../../../lib/prizes/fallbackCache";
import { isFplDownError } from "../../../lib/fplErrors";

export default async function handler(req, res) {
  setNoCache(res);
  const leagueId = req.query.id || process.env.FPL_CLASSIC_LEAGUE_ID;
  if (!leagueId) {
    return res.status(400).json({ error: "Missing classic league id. Set FPL_CLASSIC_LEAGUE_ID or pass ?id=" });
  }
  try {
    // Same fallback-cache pattern as H2H and LMS - this was the
    // confirmed gap: Classic League had no fallback at all, so any FPL
    // outage took the whole page blank instead of showing the last
    // known-good standings with a clear "showing a snapshot from X"
    // notice.
    let result = null;
    let fplUnavailable = false;
    let stale = false;
    let staleSince = null;

    try {
      const { data, stale: isStale, staleSince: since } = await withFallbackCache("classic_standings", async () => {
        const { league, entries } = await fpl.allClassicEntries(leagueId);

        const bootstrap = await fpl.bootstrap();
        // getLatestStartedGw, not getEffectiveCurrentGw - month-tracking
        // needs "the latest gameweek genuinely underway," not "the next
        // gameweek to default-show fixtures for."
        const currentGw = getLatestStartedGw(bootstrap.events);
        const currentEvent = bootstrap.events.find((e) => e.id === currentGw);
        const status = gwStatus(currentEvent);

        const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));
        const histories = await loadAllHistories(simpleEntries);
        const monthGwMap = buildMonthGwMap(bootstrap.events);

        let liveScoresMap = null;
        if (status !== "upcoming") {
          // Same fix as everywhere else: event_total can carry over the
          // previous gameweek's number until a match actually starts.
          const gwFixtures = currentGw ? await fpl.fixtures(currentGw) : [];
          const fixturesStarted = gwFixtures.some((f) => f.started);
          const liveScores = getLiveGwScoresFromStandings(entries, fixturesStarted);
          liveScoresMap = new Map(liveScores.map((s) => [s.entry, s]));
        }

        const monthEntries = Object.entries(monthGwMap).sort(([, a], [, b]) => Math.min(...a) - Math.min(...b));
        const currentMonthEntry = monthEntries.find(([, gws]) => gws.includes(currentGw));
        const monthByEntry = new Map();
        if (currentMonthEntry) {
          const motmAllMonths = managerOfTheMonth(histories, { [currentMonthEntry[0]]: currentMonthEntry[1] }, currentGw, liveScoresMap);
          (motmAllMonths[currentMonthEntry[0]] || []).forEach((r) => monthByEntry.set(r.entry, r.points));
        }

        return {
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
        };
      });
      result = data;
      stale = isStale;
      staleSince = since;
    } catch (err) {
      if (!isFplDownError(err.message)) throw err;
      fplUnavailable = true;
    }

    res.status(200).json({
      ...(result || { league: null, currentMonthLabel: null, standings: [] }),
      fplUnavailable,
      stale,
      staleSince,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

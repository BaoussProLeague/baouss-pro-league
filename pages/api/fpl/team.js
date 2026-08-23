import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";

// Same anti-copying rule FPL enforces on their own site: a manager's
// picks for a gameweek that hasn't locked yet are only visible to that
// manager, never to anyone else - otherwise you could peek at a rival's
// team before your own deadline. This route only ever serves a GW whose
// deadline has already passed; it refuses anything else server-side,
// not just in the UI, so there's no way to bypass it by hitting the API
// directly with a future GW number.
export default async function handler(req, res) {
  setNoCache(res);
  const { entryId, gw } = req.query;
  if (!entryId) return res.status(400).json({ error: "entryId is required." });

  try {
    const bootstrap = await fpl.bootstrap();
    const now = new Date();
    const lockedEvents = bootstrap.events.filter((e) => new Date(e.deadline_time) <= now);
    if (lockedEvents.length === 0) {
      return res.status(400).json({ error: "No gameweek has locked yet this season - nothing to show." });
    }
    const latestLockedGw = Math.max(...lockedEvents.map((e) => e.id));

    const requestedGw = gw ? Number(gw) : latestLockedGw;
    if (!Number.isInteger(requestedGw) || requestedGw < 1 || requestedGw > 38) {
      return res.status(400).json({ error: "Invalid gameweek." });
    }
    if (requestedGw > latestLockedGw) {
      return res.status(403).json({
        error: `GW${requestedGw} hasn't locked yet - team views only become available once a gameweek's deadline has passed, same as on the official FPL site.`,
      });
    }

    const [entry, picksData, live, rawFixtures] = await Promise.all([
      fpl.entry(entryId),
      fpl.entryPicks(entryId, requestedGw),
      fpl.eventLive(requestedGw),
      fpl.fixtures(requestedGw),
    ]);

    const elementsById = new Map(bootstrap.elements.map((el) => [el.id, el]));
    const teamsById = new Map(bootstrap.teams.map((t) => [t.id, t]));
    const livePointsById = new Map(live.elements.map((el) => [el.id, el.stats.total_points]));

    // Maps each team to its opponent this GW, and whether that fixture has
    // actually kicked off yet - lets a player show "vs OPP (H)" instead of
    // a misleading "0" before their match has even started.
    const teamFixture = new Map();
    for (const f of rawFixtures) {
      const homeTeam = teamsById.get(f.team_h);
      const awayTeam = teamsById.get(f.team_a);
      // Same fix as the main fixtures route: finished_provisional flips
      // true at full time, while finished waits for bonus points to be
      // officially confirmed (can be 30-90 min later). Using the wrong
      // one here wasn't the direct cause of bench showing 0 - that gate
      // only checks `started` - but it was still wrong and worth fixing
      // now that I've found it, rather than leaving it inconsistent.
      teamFixture.set(f.team_h, { opponent: awayTeam ? awayTeam.short_name : "TBC", isHome: true, started: f.started, finished: f.finished_provisional });
      teamFixture.set(f.team_a, { opponent: homeTeam ? homeTeam.short_name : "TBC", isHome: false, started: f.started, finished: f.finished_provisional });
    }

    const chip = picksData.active_chip; // 'wildcard' | 'freehit' | 'bboost' | '3xc' | null
    const benchBoostActive = chip === "bboost";

    const buildPlayer = (pick) => {
      const el = elementsById.get(pick.element);
      const team = el ? teamsById.get(el.team) : null;
      const basePoints = livePointsById.get(pick.element) || 0;
      const fixture = el ? teamFixture.get(el.team) : null;
      return {
        elementId: pick.element,
        name: el ? el.web_name : `Player ${pick.element}`,
        photoCode: el && el.photo ? el.photo.replace(".jpg", "") : null,
        teamShort: team ? team.short_name : "",
        teamCode: team ? team.code : null,
        elementType: el ? el.element_type : null, // 1 GK, 2 DEF, 3 MID, 4 FWD
        isCaptain: pick.is_captain,
        isViceCaptain: pick.is_vice_captain,
        multiplier: pick.multiplier,
        basePoints,
        livePoints: basePoints * pick.multiplier,
        fixture: fixture
          ? { label: `${fixture.isHome ? "vs" : "@"} ${fixture.opponent}`, started: fixture.started, finished: fixture.finished }
          : null,
      };
    };

    const startingXI = picksData.picks.filter((p) => p.position <= 11).map(buildPlayer);
    const bench = picksData.picks.filter((p) => p.position > 11).map(buildPlayer);

    const totalLivePoints =
      startingXI.reduce((sum, p) => sum + p.livePoints, 0) +
      (benchBoostActive ? bench.reduce((sum, p) => sum + p.livePoints, 0) : 0);

    res.status(200).json({
      gw: requestedGw,
      latestLockedGw,
      managerName: `${entry.player_first_name || ""} ${entry.player_last_name || ""}`.trim(),
      teamName: entry.name,
      chip,
      totalLivePoints,
      startingXI,
      bench,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

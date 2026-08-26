import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { gwStatus } from "../../../lib/prizes/liveScores";

// Pulls goal scorers and bonus points (BPS-based) out of a fixture's raw
// `stats` array. FPL structures this as one entry per stat type, each with
// separate home/away arrays of { value, element } - not the friendliest
// shape to consume directly, so this flattens it into something a
// component can just render.
function extractStats(fixtureStats, elementsById) {
  const findStat = (identifier) => (fixtureStats || []).find((s) => s.identifier === identifier);

  const namesFor = (statIdentifier, side) => {
    const stat = findStat(statIdentifier);
    if (!stat) return [];
    return (stat[side] || []).map((entry) => {
      const player = elementsById.get(entry.element);
      const name = player ? player.web_name : `Player ${entry.element}`;
      return entry.value > 1 ? `${name} (${entry.value})` : name;
    });
  };

  // `bonus` only populates once bonus points are officially confirmed
  // (usually shortly after full time). Before that, `bps` gives the live
  // BPS ranking - FPL awards 3/2/1 to the top three distinct BPS scores,
  // so this reconstructs the same provisional bonus a viewer would see on
  // the official site mid-match.
  const provisionalBonus = (side) => {
    const bpsStat = findStat("bps");
    if (!bpsStat) return [];
    const entries = (bpsStat[side] || []).slice().sort((a, b) => b.value - a.value);
    const distinctValues = [...new Set(entries.map((e) => e.value))].slice(0, 3);
    const points = [3, 2, 1];
    const result = [];
    distinctValues.forEach((val, i) => {
      entries.filter((e) => e.value === val).forEach((e) => {
        const player = elementsById.get(e.element);
        result.push({ name: player ? player.web_name : `Player ${e.element}`, points: points[i] });
      });
    });
    return result;
  };

  const bonusStat = findStat("bonus");

  return {
    homeScorers: namesFor("goals_scored", "h"),
    awayScorers: namesFor("goals_scored", "a"),
    homeAssists: namesFor("assists", "h"),
    awayAssists: namesFor("assists", "a"),
    homeOwnGoals: namesFor("own_goals", "h"),
    awayOwnGoals: namesFor("own_goals", "a"),
    homeYellow: namesFor("yellow_cards", "h"),
    awayYellow: namesFor("yellow_cards", "a"),
    homeRed: namesFor("red_cards", "h"),
    awayRed: namesFor("red_cards", "a"),
    homeSaves: namesFor("saves", "h"),
    awaySaves: namesFor("saves", "a"),
    bonusConfirmed: !!bonusStat,
    homeBonus: bonusStat ? namesFor("bonus", "h").map((n) => ({ name: n, points: null })) : provisionalBonus("h"),
    awayBonus: bonusStat ? namesFor("bonus", "a").map((n) => ({ name: n, points: null })) : provisionalBonus("a"),
  };
}

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const bootstrap = await fpl.bootstrap();

    // Same fix as everywhere else: FPL's own is_current/is_next flags
    // can lag behind the real state of a gameweek (a gameweek that's
    // genuinely fully finished can still be flagged "current" for a
    // while). Determining this ourselves - the first gameweek that
    // isn't yet "completed" by our own real check - is what actually
    // makes the display advance to GW2's fixtures the moment GW1 is
    // truly done, instead of continuing to show a finished gameweek.
    const sortedEvents = [...bootstrap.events].sort((a, b) => a.id - b.id);
    const defaultEvent = sortedEvents.find((e) => gwStatus(e) !== "completed") || sortedEvents[sortedEvents.length - 1];
    if (!defaultEvent) {
      return res.status(200).json({ gw: null, fixtures: [] });
    }

    const requestedGw = req.query.gw ? Number(req.query.gw) : defaultEvent.id;
    const currentEvent = bootstrap.events.find((e) => e.id === requestedGw) || defaultEvent;
    const gw = currentEvent.id;
    const minGw = Math.min(...bootstrap.events.map((e) => e.id));
    const maxGw = Math.max(...bootstrap.events.map((e) => e.id));

    const teamsById = new Map(
      bootstrap.teams.map((t) => [t.id, { name: t.name, shortName: t.short_name, code: t.code }])
    );
    const elementsById = new Map(bootstrap.elements.map((e) => [e.id, e]));

    const raw = await fpl.fixtures(gw);
    const fixtures = raw
      .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time))
      .map((f) => {
        const stats = f.started ? extractStats(f.stats, elementsById) : null;
        return {
          id: f.id,
          kickoff: f.kickoff_time,
          started: f.started,
          // finished_provisional flips true right at full time - the
          // score is locked in. `finished` waits for bonus points to be
          // officially confirmed, which can take 30-90 minutes after the
          // final whistle - using that one was exactly why a genuinely
          // over match kept showing LIVE. Bonus confirmation status is
          // still tracked separately below for the bonus points display.
          finished: f.finished_provisional,
          bonusConfirmed: f.finished,
          minutes: f.minutes,
          home: teamsById.get(f.team_h) || { name: "TBC", shortName: "TBC" },
          away: teamsById.get(f.team_a) || { name: "TBC", shortName: "TBC" },
          homeScore: f.team_h_score,
          awayScore: f.team_a_score,
          stats,
        };
      });

    res.status(200).json({
      gw, gwName: currentEvent.name, fixtures,
      isDefaultGw: gw === defaultEvent.id,
      minGw, maxGw,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

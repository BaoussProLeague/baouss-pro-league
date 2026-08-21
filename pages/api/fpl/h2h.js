import { fpl } from "../../../lib/fpl";
import { computeH2hStandingsAtGw } from "../../../lib/prizes/h2hSnapshot";
import { computeRankDeltas } from "../../../lib/prizes/rankDelta";
import { setNoCache } from "../../../lib/noCacheHeaders";

const GROUP_STAGE_LAST_GW = 30;

export default async function handler(req, res) {
  setNoCache(res);
  const leagueId = req.query.id || process.env.FPL_H2H_LEAGUE_ID;
  if (!leagueId) {
    return res.status(400).json({ error: "Missing H2H league id. Set FPL_H2H_LEAGUE_ID or pass ?id=" });
  }
  try {
    const bootstrap = await fpl.bootstrap();
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    const currentGw = currentEvent ? currentEvent.id : 1;
    const groupStageOver = currentGw > GROUP_STAGE_LAST_GW;

    const { league } = await fpl.allH2hEntries(leagueId);
    const allMatches = await fpl.allH2hMatches(leagueId);

    const uptoGw = groupStageOver ? GROUP_STAGE_LAST_GW : currentGw;
    const ranked = computeH2hStandingsAtGw(allMatches, uptoGw);
    // Last week's standings, purely to diff against this week's for the
    // rank-change arrows - frozen once the group stage itself is frozen.
    const prevUptoGw = groupStageOver ? GROUP_STAGE_LAST_GW : Math.max(1, currentGw - 1);
    const rankedPrev = computeH2hStandingsAtGw(allMatches, prevUptoGw);
    const deltas = computeRankDeltas(ranked, rankedPrev);

    const gold = ranked.slice(0, 16);
    const silver = ranked.slice(16, 32);

    res.status(200).json({
      league: { id: league.id, name: league.name },
      currentGw,
      groupStageOver,
      groupStageSnapshotGw: groupStageOver ? GROUP_STAGE_LAST_GW : null,
      // If nobody's played a match yet, `ranked` is empty regardless of
      // how many managers have joined - that's a "matches haven't
      // started" state, not a manager-count problem, and the page should
      // say so rather than guessing at a reason.
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
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

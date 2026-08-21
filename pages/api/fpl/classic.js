import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";

export default async function handler(req, res) {
  setNoCache(res);
  const leagueId = req.query.id || process.env.FPL_CLASSIC_LEAGUE_ID;
  if (!leagueId) {
    return res.status(400).json({ error: "Missing classic league id. Set FPL_CLASSIC_LEAGUE_ID or pass ?id=" });
  }
  try {
    const { league, entries } = await fpl.allClassicEntries(leagueId);
    res.status(200).json({
      league: { id: league.id, name: league.name },
      standings: entries.map((e) => ({
        entry: e.entry,
        entryName: e.entry_name,
        managerName: e.player_name,
        rank: e.rank,
        lastRank: e.last_rank,
        totalPoints: e.total,
        gwPoints: e.event_total,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

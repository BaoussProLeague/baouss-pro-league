import { fpl } from "../../../lib/fpl";

export default async function handler(req, res) {
  const leagueId = req.query.id || process.env.FPL_H2H_LEAGUE_ID;
  if (!leagueId) {
    return res.status(400).json({ error: "Missing H2H league id. Set FPL_H2H_LEAGUE_ID or pass ?id=" });
  }
  try {
    const { league, entries } = await fpl.allH2hEntries(leagueId);
    const bootstrap = await fpl.bootstrap();
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    const gold = entries.filter((e) => e.rank <= 16);
    const silver = entries.filter((e) => e.rank > 16 && e.rank <= 32);
    res.status(200).json({
      league: { id: league.id, name: league.name },
      currentGw: currentEvent ? currentEvent.id : null,
      standings: entries.map((e) => ({
        entry: e.entry,
        entryName: e.entry_name,
        managerName: e.player_name,
        rank: e.rank,
        played: e.matches_played,
        won: e.matches_won,
        drawn: e.matches_drawn,
        lost: e.matches_lost,
        points: e.total, // H2H league points (3/1/0), not FPL points
      })),
      cupQualification: {
        gold: gold.map((e) => ({ entry: e.entry, entryName: e.entry_name, rank: e.rank })),
        silver: silver.map((e) => ({ entry: e.entry, entryName: e.entry_name, rank: e.rank })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

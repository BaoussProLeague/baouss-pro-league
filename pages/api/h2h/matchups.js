import { fpl } from "../../../lib/fpl";
import { getLiveGwScores, gwStatus } from "../../../lib/prizes/liveScores";

export default async function handler(req, res) {
  const leagueId = req.query.id || process.env.FPL_H2H_LEAGUE_ID;
  if (!leagueId) return res.status(400).json({ error: "Missing H2H league id." });

  try {
    const bootstrap = await fpl.bootstrap();
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    const currentGw = currentEvent ? currentEvent.id : 1;
    const status = gwStatus(currentEvent);

    const allMatches = await fpl.allH2hMatches(leagueId);
    const thisWeek = allMatches.filter((m) => m.event === currentGw && m.entry_1_entry && m.entry_2_entry);

    if (thisWeek.length === 0) {
      return res.status(200).json({ gw: currentGw, status, matchups: [] });
    }

    // Same staleness issue as the chip/Mega GW bug: match points on this
    // endpoint don't reliably reflect a still-in-progress gameweek, so
    // live scores are computed the same reliable way as everywhere else
    // in the app rather than trusted from the match record directly.
    const entrySet = new Map();
    thisWeek.forEach((m) => {
      entrySet.set(m.entry_1_entry, m.entry_1_name);
      entrySet.set(m.entry_2_entry, m.entry_2_name);
    });
    const entries = Array.from(entrySet.entries()).map(([entry, entryName]) => ({ entry, entryName }));

    const liveScores = status === "upcoming" ? [] : await getLiveGwScores(entries, currentGw);
    const scoreById = new Map(liveScores.map((s) => [s.entry, s.points]));

    const matchups = thisWeek.map((m) => ({
      entry1: { id: m.entry_1_entry, name: m.entry_1_name, points: scoreById.get(m.entry_1_entry) ?? null },
      entry2: { id: m.entry_2_entry, name: m.entry_2_name, points: scoreById.get(m.entry_2_entry) ?? null },
    }));

    res.status(200).json({ gw: currentGw, status, matchups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

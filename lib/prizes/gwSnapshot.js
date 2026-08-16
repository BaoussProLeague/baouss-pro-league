import { fpl } from "../fpl";

// Both stats here only need THIS gameweek's picks for every manager, not
// the whole season - so unlike Captain Points or Def+GK (which need
// every GW), this is cheap enough to compute live on every page load.
// Picks are fetched in parallel to keep this well inside Vercel's
// function timeout even for a full-sized league.
export async function computeGwSnapshot(entries, gw, webNameById) {
  const allPicks = await Promise.all(
    entries.map(async (e) => {
      try {
        const picks = await fpl.entryPicks(e.entry, gw);
        return { entry: e.entry, picks };
      } catch {
        return null;
      }
    })
  );

  const captainCounts = new Map(); // player name -> count
  const chipCounts = { wildcard: 0, freehit: 0, bboost: 0, "3xc": 0 };

  for (const row of allPicks) {
    if (!row) continue;
    const captainPick = (row.picks.picks || []).find((p) => p.is_captain);
    if (captainPick) {
      const name = webNameById.get(captainPick.element) || `Player ${captainPick.element}`;
      captainCounts.set(name, (captainCounts.get(name) || 0) + 1);
    }
    const chip = row.picks.active_chip;
    if (chip && chip in chipCounts) chipCounts[chip] += 1;
  }

  const totalWithCaptain = Array.from(captainCounts.values()).reduce((a, b) => a + b, 0);
  const captainPickAggregate = Array.from(captainCounts.entries())
    .map(([name, count]) => ({ name, count, pct: totalWithCaptain > 0 ? Math.round((count / totalWithCaptain) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  return { captainPickAggregate, chipsUsedThisGw: chipCounts };
}

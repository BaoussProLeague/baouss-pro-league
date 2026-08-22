// Every fixture's result comes from comparing the two managers' actual
// Classic gameweek scores for that GW - the same `history` data already
// loaded for Team Value, Bench Points, and every other prize, so this
// adds no extra API calls. A GW with no history row yet for either
// manager simply hasn't been played - that fixture is skipped rather
// than counted as 0-0.
export function computeCustomH2hStandings(fixtures, histories, uptoGw) {
  const historyByEntry = new Map(histories.map((h) => [h.entry, h]));
  const stats = new Map();

  const touch = (entryId) => {
    if (!stats.has(entryId)) {
      const h = historyByEntry.get(entryId);
      stats.set(entryId, {
        entry: entryId,
        entryName: h ? h.entryName : `Entry ${entryId}`,
        played: 0, won: 0, drawn: 0, lost: 0, points: 0, pointsFor: 0,
      });
    }
    return stats.get(entryId);
  };

  for (const fx of fixtures) {
    if (fx.gw > uptoGw) continue;

    // A bye counts as a played week with no result either way - it's
    // not a win (nobody should be rewarded league points for sitting
    // out), just a week that doesn't count against them either.
    if (!fx.entry_id_2) {
      continue;
    }

    const h1 = historyByEntry.get(fx.entry_id_1);
    const h2 = historyByEntry.get(fx.entry_id_2);
    const row1 = h1?.history.find((r) => r.event === fx.gw);
    const row2 = h2?.history.find((r) => r.event === fx.gw);
    if (!row1 || !row2) continue; // this GW hasn't been played yet

    const a = touch(fx.entry_id_1);
    const b = touch(fx.entry_id_2);
    const p1 = row1.points, p2 = row2.points;

    a.played += 1; b.played += 1;
    a.pointsFor += p1; b.pointsFor += p2;

    if (p1 > p2) { a.won += 1; b.lost += 1; a.points += 3; }
    else if (p2 > p1) { b.won += 1; a.lost += 1; b.points += 3; }
    else { a.drawn += 1; b.drawn += 1; a.points += 1; b.points += 1; }
  }

  return Array.from(stats.values()).sort(
    (x, y) => y.points - x.points || y.pointsFor - x.pointsFor || x.entry - y.entry
  );
}

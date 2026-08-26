// Every fixture's result comes from comparing the two managers' actual
// Classic gameweek scores for that GW - the same `history` data already
// loaded for Team Value, Bench Points, and every other prize.
//
// liveScoresMap is the fallback for the current gameweek's fixtures when
// history doesn't have a row for it yet (same reliable Classic-standings
// source used everywhere else in the app) - without this, this week's
// H2H matches were silently excluded from standings entirely until FPL's
// history data caught up, sometimes well after the gameweek itself had
// finished.
//
// Tiebreak confirmed against FPL's own documented H2H rule: ties on
// league points are broken by "overall FPL score" - each manager's real
// season-long total, not just points scored within H2H fixtures
// specifically. Reconstructed from each history row's own cumulative
// total_points field as of the gameweek being evaluated (GW30 once the
// group stage is frozen, not whatever the season total happens to be
// later on).
export function computeCustomH2hStandings(fixtures, histories, uptoGw, currentGw = null, liveScoresMap = null) {
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

  const scoreFor = (entryId, gw) => {
    const h = historyByEntry.get(entryId);
    const row = h?.history.find((r) => r.event === gw);
    if (row) return row.points;
    if (gw === currentGw && liveScoresMap && liveScoresMap.has(entryId)) {
      return liveScoresMap.get(entryId).points;
    }
    return null;
  };

  // The official tiebreak field: cumulative season total as of uptoGw,
  // not just points scored in this manager's H2H fixtures.
  const overallTotalAt = (entryId, gw) => {
    const h = historyByEntry.get(entryId);
    if (!h) return 0;
    const rowsUpTo = h.history.filter((r) => r.event <= gw);
    const lastRow = rowsUpTo[rowsUpTo.length - 1];
    let total = lastRow ? lastRow.total_points : 0;
    if (gw === currentGw && liveScoresMap && liveScoresMap.has(entryId) && (!lastRow || lastRow.event < gw)) {
      total += liveScoresMap.get(entryId).points;
    }
    return total;
  };

  for (const fx of fixtures) {
    if (fx.gw > uptoGw) continue;

    // A bye counts as a played week with no result either way - it's
    // not a win (nobody should be rewarded league points for sitting
    // out), just a week that doesn't count against them either.
    if (!fx.entry_id_2) {
      continue;
    }

    const p1 = scoreFor(fx.entry_id_1, fx.gw);
    const p2 = scoreFor(fx.entry_id_2, fx.gw);
    if (p1 === null || p2 === null) continue; // this GW hasn't been played yet, and no live data either

    const a = touch(fx.entry_id_1);
    const b = touch(fx.entry_id_2);

    a.played += 1; b.played += 1;
    a.pointsFor += p1; b.pointsFor += p2;

    if (p1 > p2) { a.won += 1; b.lost += 1; a.points += 3; }
    else if (p2 > p1) { b.won += 1; a.lost += 1; b.points += 3; }
    else { a.drawn += 1; b.drawn += 1; a.points += 1; b.points += 1; }
  }

  return Array.from(stats.values())
    .map((s) => ({ ...s, overallTotal: overallTotalAt(s.entry, uptoGw) }))
    .sort((x, y) => y.points - x.points || y.overallTotal - x.overallTotal || x.entry - y.entry);
}

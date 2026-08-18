// Two jobs, one function:
// 1. Fixes the gold/silver bug: instead of trusting FPL's raw `rank` field
//    (which can be tied, or null for brand-new entries - either way unsafe
//    to compare with <=), this computes a definitive, tie-broken order
//    directly from match results every time.
// 2. Enables the GW30 freeze: FPL's own H2H league keeps generating and
//    scoring fixtures for GW31 onward regardless of our custom knockout
//    rule, so reading "current" standings after GW30 would silently drift
//    as those irrelevant later matches get counted. Reconstructing the
//    standings AS OF GW30 specifically, from full match history, gives a
//    permanent, accurate snapshot - and it works even if nobody manually
//    "freezes" anything at the right moment, since it's just arithmetic
//    over historical data that never changes.

export function computeH2hStandingsAtGw(matches, uptoGw) {
  const stats = new Map();
  const touch = (entryId, name) => {
    if (!stats.has(entryId)) {
      stats.set(entryId, { entry: entryId, entryName: name, played: 0, won: 0, drawn: 0, lost: 0, points: 0, pointsFor: 0 });
    }
    return stats.get(entryId);
  };

  for (const m of matches) {
    if (m.event > uptoGw) continue;
    if (!m.entry_1_entry || !m.entry_2_entry) continue; // bye / incomplete fixture

    const a = touch(m.entry_1_entry, m.entry_1_name);
    const b = touch(m.entry_2_entry, m.entry_2_name);
    a.played += 1;
    b.played += 1;
    a.pointsFor += m.entry_1_points || 0;
    b.pointsFor += m.entry_2_points || 0;

    if (m.entry_1_points > m.entry_2_points) {
      a.won += 1; b.lost += 1; a.points += 3;
    } else if (m.entry_1_points < m.entry_2_points) {
      b.won += 1; a.lost += 1; b.points += 3;
    } else {
      a.drawn += 1; b.drawn += 1; a.points += 1; b.points += 1;
    }
  }

  // Definitive, always-unique ordering: league points, then points-for as
  // a tiebreak, then entry ID as a final deterministic tiebreak so the
  // gold/silver line never has an ambiguous boundary.
  return Array.from(stats.values()).sort(
    (x, y) => y.points - x.points || y.pointsFor - x.pointsFor || x.entry - y.entry
  );
}

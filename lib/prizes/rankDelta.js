// current/previous: arrays already sorted best-to-worst, each item having
// an `entry` field. Position in the array IS the rank - no separate rank
// field needed. Returns Map(entry -> 'up' | 'down' | 'same' | null).
// null means "wasn't present last week" (e.g. just joined, or this
// prize's eligibility just started) - no arrow shown for that case,
// since "moved up" is meaningless without a real previous position.
export function computeRankDeltas(current, previous) {
  const prevRank = new Map(previous.map((row, i) => [row.entry, i + 1]));
  const deltas = new Map();
  current.forEach((row, i) => {
    const curRank = i + 1;
    const prev = prevRank.get(row.entry);
    if (prev === undefined) {
      deltas.set(row.entry, null);
      return;
    }
    if (curRank < prev) deltas.set(row.entry, "up");
    else if (curRank > prev) deltas.set(row.entry, "down");
    else deltas.set(row.entry, "same");
  });
  return deltas;
}

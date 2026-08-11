// Perfect Captaincy: rewards managers whose captain pick was actually
// their squad's top scorer that gameweek (accuracy, not just raw captain
// points total - two different skills). Needs each manager's picks for
// the GW (captain flag + multiplier) and each player's live GW score -
// this is the expensive, per-GW-per-manager call pattern, so like LMS
// it's computed incrementally via an admin action once a GW is locked,
// not recomputed live on every page load.

import { fpl } from "../fpl";

export async function computeGwCaptaincy(entries, gw) {
  // entries: [{ entry, entryName }]
  const live = await fpl.eventLive(gw);
  const livePointsByElement = new Map(live.elements.map((el) => [el.id, el.stats.total_points]));

  const results = [];
  for (const m of entries) {
    const picks = await fpl.entryPicks(m.entry, gw);
    const captainPick = picks.picks.find((p) => p.is_captain);
    if (!captainPick) continue;

    // Only compare against the starting XI (positions 1-11), matching
    // how "your squad" reads in the rules - bench players don't count
    // against the captain's accuracy since they weren't in the frame.
    const startingXI = picks.picks.filter((p) => p.position <= 11);
    const scores = startingXI.map((p) => ({
      element: p.element,
      points: livePointsByElement.get(p.element) || 0,
    }));

    const topScore = Math.max(...scores.map((s) => s.points));
    const captainRawPoints = livePointsByElement.get(captainPick.element) || 0;
    const wasTopScorer = captainRawPoints >= topScore && captainRawPoints > 0;

    results.push({
      entry: m.entry,
      entryName: m.entryName,
      gw,
      captainElementId: captainPick.element,
      captainPoints: captainRawPoints,
      wasTopScorerInSquad: wasTopScorer,
    });
  }
  return results;
}

// Aggregates already-recorded rows (from captain_accuracy table) into a
// leaderboard: most gameweeks with a "perfect" captain call.
export function captaincyLeaderboard(rows) {
  const byEntry = new Map();
  for (const r of rows) {
    if (!byEntry.has(r.entry_id)) {
      byEntry.set(r.entry_id, { entry: r.entry_id, entryName: r.entry_name, perfectCalls: 0, gwsTracked: 0 });
    }
    const agg = byEntry.get(r.entry_id);
    agg.gwsTracked += 1;
    if (r.was_top_scorer_in_squad) agg.perfectCalls += 1;
  }
  return Array.from(byEntry.values()).sort((a, b) => b.perfectCalls - a.perfectCalls);
}

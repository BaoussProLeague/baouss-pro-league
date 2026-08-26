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

    // FPL's own rule, confirmed: if the designated captain doesn't play
    // at all, the armband effectively passes to the vice-captain, who
    // gets the multiplier instead. The `is_captain` flag never moves to
    // reflect this - it stays on whoever was originally picked, even
    // though they may have scored 0 for not playing at all. Finding
    // "the captain" via that flag would silently evaluate the wrong
    // player exactly when it matters most. The `multiplier` field is
    // FPL's own real-time source of truth for who actually received the
    // bonus, so that's what determines it here instead.
    const effectiveCaptainPick = picks.picks.reduce(
      (best, p) => (!best || p.multiplier > best.multiplier ? p : best),
      null
    );
    const captainPick = effectiveCaptainPick && effectiveCaptainPick.multiplier >= 2
      ? effectiveCaptainPick
      : picks.picks.find((p) => p.is_captain); // fallback: neither captain nor VC played, FPL applies no multiplier to anyone
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
    // Per your call: follow the rules doc literally - a genuine tie for
    // highest counts as correct, even if that tie happens to be at 0
    // (the whole starting XI having a blank gameweek). No exception for
    // that case; the rule doesn't carve one out, so neither does this.
    const wasTopScorer = captainRawPoints >= topScore;

    // Two different numbers for two different prizes, deliberately kept
    // separate: Perfect Captaincy needs the RAW score (matches the rules
    // doc - "before the captaincy multiplier"), while the Captain Points
    // prize needs what was actually AWARDED - doubled normally, tripled
    // if Triple Captain was active. Reusing one number for both was the
    // bug; picks.multiplier is FPL's own source of truth for which
    // multiplier actually applied, so it's used directly rather than
    // assumed from whether the chip was active.
    const captainMultiplier = captainPick.multiplier;
    const captainAwardedPoints = captainRawPoints * captainMultiplier;

    results.push({
      entry: m.entry,
      entryName: m.entryName,
      gw,
      captainElementId: captainPick.element,
      captainPoints: captainRawPoints,
      captainAwardedPoints,
      captainMultiplier,
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

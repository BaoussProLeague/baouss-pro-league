// LMS logic, matching the rules doc:
// - Starts GW2. Each GW, whoever scores lowest (incl. hits) among REMAINING
//   players is eliminated. Ties -> Set Rules (total points, then bench
//   points, then captain points, then coin toss) - here we flag ties for
//   manual admin resolution rather than silently picking one, since a coin
//   toss can't be automated fairly without a defined random seed policy.
// - Eliminated on/before GW21 -> eligible for INR 500 rebuy.
// - GW22-24: break.
// - GW25: rebuys + GW21 survivors merge and LMS resumes as "round 2".
//
// This function is meant to be called GW-by-GW as the season progresses
// (e.g. from a cron/admin action after each GW's scores go final), building
// up lms_eliminations in Supabase. It does NOT try to replay the whole
// season in one shot from history, because "lowest score among remaining
// players" depends on who was still alive at each point in time - state
// that has to be tracked incrementally, not recomputed after the fact.

export function computeGwElimination(remainingManagers, gwScoresByEntry) {
  // remainingManagers: [{ entry, entryName }]
  // gwScoresByEntry: Map(entry -> { points, benchPoints, captainPoints })
  const scored = remainingManagers.map((m) => ({
    ...m,
    ...gwScoresByEntry.get(m.entry),
  }));

  const lowest = Math.min(...scored.map((m) => m.points));
  const candidates = scored.filter((m) => m.points === lowest);

  if (candidates.length === 1) {
    return { eliminated: candidates, tie: false };
  }

  // Tie-break per Set Rules: total points (season-to-date) is rule #1 but
  // GW score IS the total-points-for-this-GW context here, so we fall
  // through to bench points, then captain points, per the rules doc.
  const byBench = candidates.filter(
    (m) => m.benchPoints === Math.min(...candidates.map((c) => c.benchPoints))
  );
  if (byBench.length === 1) return { eliminated: byBench, tie: false, tieBrokenBy: "bench_points" };

  const byCaptain = byBench.filter(
    (m) => m.captainPoints === Math.min(...byBench.map((c) => c.captainPoints))
  );
  if (byCaptain.length === 1) return { eliminated: byCaptain, tie: false, tieBrokenBy: "captain_points" };

  // Still tied after bench + captain -> needs a coin toss, flag for admin
  return { eliminated: byCaptain, tie: true, tieBrokenBy: "coin_toss_required" };
}

export function isRebuyEligible(gwEliminated, lastEligibleGw = 21) {
  return gwEliminated <= lastEligibleGw;
}

// Builds the round-2 starting pool: GW21 survivors (never eliminated in
// round 1 by end of GW21) + anyone who paid the rebuy fee.
export function buildRound2Pool(round1Eliminations, round1StillAlive, rebuys) {
  const paidRebuyIds = new Set(rebuys.filter((r) => r.paid).map((r) => r.entry_id));
  const rebuyManagers = round1Eliminations.filter(
    (e) => e.gw_eliminated <= 21 && paidRebuyIds.has(e.entry_id)
  );
  return [...round1StillAlive, ...rebuyManagers];
}

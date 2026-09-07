// LMS logic, matching the rules doc:
// - Starts GW2. Each GW, whoever scores lowest (incl. hits) among REMAINING
//   players is eliminated. Ties -> Set Rules (total points, then bench
//   points, then captain points, then random draw for 3+ still tied).
// - Eliminated on/before GW21 -> eligible for INR 500 rebuy.
// - GW22-24: break.
// - GW25: rebuys + GW21 survivors merge and LMS resumes as "round 2".
//
// Split into two stages on purpose: points + bench points are already in
// hand from FPL's history endpoint (cheap), but captain points need an

export const LMS_START_GW = 2;
const ROUND1_ELIMINATIONS_PER_WEEK = 2;
const ROUND2_ELIMINATIONS_PER_WEEK = 1; // placeholder - revisit after GW24 rebuy numbers are final

// The single source of truth for "how many people get eliminated this
// gameweek" - used by both the actual elimination engine (runLms.js) and
// the live status display (lms/status.js, for the "in danger" highlight).
// Having this in one shared place is what makes it structurally
// impossible for the two to disagree with each other again - previously
// the status page had no concept of this number at all and just
// hardcoded "the single lowest score," which is exactly why it kept
// showing only 1 person in danger during a 2-elimination week.
export function eliminationsThisWeekFor(gwNum) {
  const round = gwNum >= 25 ? 2 : 1;
  if (round === 2) return ROUND2_ELIMINATIONS_PER_WEEK;
  if (gwNum === LMS_START_GW) return 1; // GW2 specifically stayed at 1, per your call
  return ROUND1_ELIMINATIONS_PER_WEEK;
}

// extra picks fetch per manager - so we only pay that cost on the rare
// gameweek where points AND bench points are both tied. Resolving this in
// one combined pass (like the old version tried to) meant the captain
// tie-break could never actually fire, since there was no clean signal
// for "we need more data" versus "here's the final answer."

export function resolveByPointsAndBench(remainingManagers, gwScoresByEntry) {
  const scored = remainingManagers.map((m) => ({ ...m, ...gwScoresByEntry.get(m.entry) }));

  const lowest = Math.min(...scored.map((m) => m.points));
  const candidates = scored.filter((m) => m.points === lowest);
  if (candidates.length === 1) {
    return { decided: true, eliminated: candidates[0], tieBrokenBy: null };
  }

  const lowestBench = Math.min(...candidates.map((c) => c.benchPoints));
  const byBench = candidates.filter((m) => m.benchPoints === lowestBench);
  if (byBench.length === 1) {
    return { decided: true, eliminated: byBench[0], tieBrokenBy: "bench_points" };
  }

  // Still tied - caller needs to fetch captain points for exactly these
  // candidates and call resolveByCaptainOrRandom.
  return { decided: false, tiedCandidates: byBench };
}

export function resolveByCaptainOrRandom(tiedCandidatesWithCaptainPoints) {
  const lowestCaptain = Math.min(...tiedCandidatesWithCaptainPoints.map((c) => c.captainPoints));
  const byCaptain = tiedCandidatesWithCaptainPoints.filter((c) => c.captainPoints === lowestCaptain);

  if (byCaptain.length === 1) {
    return { eliminated: byCaptain[0], tieBrokenBy: "captain_points", tieCandidates: null };
  }

  // Still tied after points, bench points, AND captain points - per your
  // call, resolve with a random draw among everyone still tied. The full
  // tied list is returned so it can be logged for a transparent audit
  // trail - if someone questions an elimination, you can show exactly
  // who was in the draw.
  const pickIndex = Math.floor(Math.random() * byCaptain.length);
  return {
    eliminated: byCaptain[pickIndex],
    tieBrokenBy: "random_draw",
    tieCandidates: byCaptain.map((c) => ({ entry: c.entry, entryName: c.entryName })),
  };
}

export function isRebuyEligible(gwEliminated, lastEligibleGw = 21) {
  return gwEliminated <= lastEligibleGw;
}

// Builds the round-2 starting pool: GW21 survivors (never eliminated in
// round 1 by end of GW21) + anyone who paid the rebuy fee.
export function buildRound2Pool(round1Eliminations, round1StillAlive, rebuys) {
  const paidRebuyIds = new Set(rebuys.filter((r) => r.paid).map((r) => r.entry_id));
  const rebuyManagers = round1Eliminations
    .filter((e) => e.gw_eliminated <= 21 && paidRebuyIds.has(e.entry_id))
    // Normalized to the same { entry, entryName } shape as
    // round1StillAlive - these came from raw elimination rows
    // (entry_id/entry_name), and mixing the two shapes in one array
    // would silently break every downstream lookup that expects
    // `.entry` (score lookups, elimination checks, tie-break logic all
    // read `.entry` uniformly) for exactly the rebought managers this
    // function exists to bring back.
    .map((e) => ({ entry: e.entry_id, entryName: e.entry_name }));
  return [...round1StillAlive, ...rebuyManagers];
}

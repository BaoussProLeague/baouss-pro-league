import { fpl } from "../fpl";

// Your exact workflow: run once a day as each day's matches settle
// (bonus points included), keep re-running daily throughout a multi-day
// gameweek, and lock permanently 24 hours after that gameweek's very
// last match - no more recomputing after that.

// "Is it safe to compute right now" - checks whether any match from this
// GW is literally in progress at this exact moment. If nothing's
// currently live, whatever HAS finished has real, settled numbers (via
// finished_provisional), and whatever hasn't started yet will just
// legitimately show 0 for today, to be topped up on a later day's run.
// This is more precise than estimating "X hours after kickoff" - it
// checks the actual state, not a guess about it.
export function isSafeToComputeNow(fixtures) {
  return !fixtures.some((f) => f.started && !f.finished_provisional);
}

// "Has enough time passed to lock permanently" - this one DOES need an
// estimate, since there's no "is it truly final" flag to check directly.
// 24 hours from the last match's kickoff, plus a buffer for the match
// itself, is the safety margin you specified.
export function hoursSinceLastMatchKickoff(fixtures) {
  if (!fixtures || fixtures.length === 0) return null;
  const lastKickoff = Math.max(...fixtures.map((f) => new Date(f.kickoff_time).getTime()));
  const estimatedMatchEnd = lastKickoff + 2.5 * 60 * 60 * 1000; // 2.5h covers 90 min + stoppage + buffer
  return (Date.now() - estimatedMatchEnd) / (60 * 60 * 1000);
}

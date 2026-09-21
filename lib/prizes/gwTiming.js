import { fpl } from "../fpl";

// Your exact workflow: run once a day as each day's matches settle
// (bonus points included), keep re-running daily throughout a multi-day
// gameweek, and lock permanently once it's genuinely safe to trust the
// final numbers - no more recomputing after that.

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

// "Has enough time passed for auto-substitutions to have settled" - this
// is a genuinely separate FPL process from bonus point confirmation,
// confirmed directly: a starting player who recorded 0 minutes gets
// auto-subbed for a bench player only AFTER all of that gameweek's
// matches have finished, and FPL's own documentation describes this as
// happening "typically the morning after the last match" - which can be
// LATER than when bonus points for that day are individually confirmed.
// A manager's real total score depends on which 11 players actually
// counted, so trusting bonus-confirmation alone as "final" was exactly
// the gap that let an elimination run on a score that later jumped by a
// full auto-subbed player's worth of points. 14 hours from the last
// match's estimated end comfortably covers "the next morning" even for
// an evening kickoff, without requiring a needlessly long wait.
const AUTO_SUB_SAFETY_HOURS = 14;

export function hoursSinceLastMatchKickoff(fixtures) {
  if (!fixtures || fixtures.length === 0) return null;
  const lastKickoff = Math.max(...fixtures.map((f) => new Date(f.kickoff_time).getTime()));
  const estimatedMatchEnd = lastKickoff + 2.5 * 60 * 60 * 1000; // 2.5h covers 90 min + stoppage + buffer
  return (Date.now() - estimatedMatchEnd) / (60 * 60 * 1000);
}

// The combined, actually-safe gate for anything that locks in a final
// number (LMS eliminations especially, since that's irreversible) -
// requires BOTH bonus points confirmed AND enough time for FPL's
// separate auto-substitution process to have run. Neither signal alone
// was sufficient; this is what closes the gap both had.
export function isSafeForFinalScores(fixtures) {
  const hoursSince = hoursSinceLastMatchKickoff(fixtures);
  return hoursSince !== null && hoursSince >= AUTO_SUB_SAFETY_HOURS;
}


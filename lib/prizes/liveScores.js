import { fpl } from "../fpl";

// You confirmed the exact proof needed here: the Classic League page
// showed a manager's live score correctly (29), while a Prizes card
// showed the same manager at 27 - both were supposedly "live," but only
// one actually was. Classic standings' `event_total` field is the one
// that's genuinely live (it's exactly what /api/fpl/classic already
// displays correctly). The picks endpoint's embedded entry_history,
// which this used to pull from, turned out to lag behind it. Rather than
// keep three different code paths each computing "current score" their
// own way, everything that needs a live score now reads from this one
// proven-correct source - and since classic standings are usually
// already being fetched anyway, this is also cheaper: no extra API calls
// per manager, just reading a field that's already there.
export function getLiveGwScoresFromStandings(classicEntries) {
  return classicEntries.map((e) => ({
    entry: e.entry,
    entryName: e.entry_name,
    points: e.event_total ?? 0,
  }));
}

// Determines the season's true current state from FPL's own event flags,
// not by inferring it from whether some data happens to exist yet - that
// inference is exactly what caused the Mega GW status bug (a gameweek
// looked "completed" the instant it started, since SOME score data
// existed, when in fact nothing had finished).
export function gwStatus(event) {
  if (!event) return "upcoming";
  const now = new Date();
  if (new Date(event.deadline_time) > now) return "upcoming";
  if (event.finished) return "completed";
  return "live";
}

// Is there an actual match being played right now, this instant? Used to
// decide whether a "LIVE" badge is honest on a prize card - a prize only
// gets that badge when something about it can genuinely change in the
// next few minutes, not just because it's gameweek week in general.
export function isAnyMatchLive(fixtures) {
  return (fixtures || []).some((f) => f.started && !f.finished);
}

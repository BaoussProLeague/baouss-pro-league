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

// Bench Points has no equivalent field in Classic standings (that only
// gives total score, not the bench/starting split), so unlike everything
// else this has to come from each manager's own picks - the same method
// the team view page already uses reliably, computed ourselves from raw
// picks + live player scores rather than trusted from any FPL
// pre-aggregated field. This is the one live-patch in the app that
// genuinely costs one extra API call per manager - only runs while a
// gameweek is actually live, not on every page load.
export async function getLiveBenchPointsFromPicks(entries, gw) {
  const live = await fpl.eventLive(gw);
  const livePointsByElement = new Map(live.elements.map((el) => [el.id, el.stats.total_points]));

  const results = await Promise.all(
    entries.map(async (e) => {
      try {
        const picks = await fpl.entryPicks(e.entry, gw);
        const benchPicks = (picks.picks || []).filter((p) => p.position > 11);
        const benchPoints = benchPicks.reduce((sum, p) => sum + (livePointsByElement.get(p.element) || 0), 0);
        return { entry: e.entry, benchPoints };
      } catch {
        return { entry: e.entry, benchPoints: 0 };
      }
    })
  );
  return results;
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
  // Same fix as the fixtures route: finished_provisional flips true at
  // full time, while finished waits for bonus points (30-90 min later).
  // Using finished here meant the LIVE badge on Prizes cards stayed on
  // long after a match had genuinely ended - same class of bug, just a
  // second place it was hiding.
  return (fixtures || []).some((f) => f.started && !f.finished_provisional);
}

// This is the single, authoritative "is this gameweek's data genuinely
// safe to freeze prizes/LMS/H2H on" check - used everywhere that matters,
// instead of every feature deciding its own threshold independently.
//
// Confirmed via FPL's own documented event-status/ endpoint - the exact
// same signal that produces the "PROVISIONAL" labels on FPL's own site.
// A gameweek is only truly final once EVERY day within it shows bonus
// confirmed, which is often noticeably later than the last match ending -
// that gap is what was causing "the GW is over, why hasn't this updated"
// confusion.
//
// Split into a sync core (for checking many gameweeks against one
// already-fetched event-status response, without refetching per
// gameweek) and an async convenience wrapper (for callers that only need
// to check one).
export function isGwFinalizedFromStatus(eventStatusData, gwNum, bootstrapEvents) {
  const daysForThisGw = (eventStatusData?.status || []).filter((d) => d.event === gwNum);
  if (daysForThisGw.length > 0) {
    return daysForThisGw.every((d) => d.bonus_added === true);
  }
  // Fallback: FPL's own finished + data_checked flags on the event
  // itself - stricter than finished alone (which can flip before bonus
  // is truly confirmed), used only if event-status/ has no rows for this
  // gameweek yet (e.g. it hasn't started) or came back unexpectedly.
  const event = bootstrapEvents?.find((e) => e.id === gwNum);
  return !!(event && event.finished && event.data_checked);
}

export async function isGwFullyFinalized(gwNum, bootstrapEvents) {
  let eventStatus = null;
  try {
    eventStatus = await fpl.eventStatus();
  } catch {
    // handled by the fallback inside isGwFinalizedFromStatus
  }
  return isGwFinalizedFromStatus(eventStatus, gwNum, bootstrapEvents);
}

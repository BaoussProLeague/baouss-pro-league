import { fpl } from "../fpl";

// The bug this fixes: `/entry/{id}/history/` (used for season-cumulative
// prizes like Team Value, Bench Points) does not populate the CURRENT
// gameweek's row until that gameweek fully finishes - so anything reading
// from it mid-gameweek sees nothing, which read as "0 points" for chip
// prizes and the Mega GW race. But `/entry/{id}/event/{gw}/picks/` embeds
// its own `entry_history` object for that specific GW, and THAT updates
// live throughout play, hits and all. This is the one to use for "how is
// this manager doing right now, this GW."
export async function getLiveGwScores(entries, gw) {
  const results = await Promise.all(
    entries.map(async (e) => {
      try {
        const picks = await fpl.entryPicks(e.entry, gw);
        const eh = picks.entry_history || {};
        return {
          entry: e.entry,
          entryName: e.entryName,
          points: eh.points ?? 0,
          benchPoints: eh.points_on_bench ?? 0,
        };
      } catch {
        return { entry: e.entry, entryName: e.entryName, points: 0, benchPoints: 0 };
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
  return (fixtures || []).some((f) => f.started && !f.finished);
}

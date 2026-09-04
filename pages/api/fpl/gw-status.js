import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { isGwFinalizedFromStatus, getLatestStartedGw } from "../../../lib/prizes/liveScores";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const bootstrap = await fpl.bootstrap();
    // Same fix as everywhere else: is_current/is_next are FPL's own
    // internal flags and can lag behind reality - the moment a new
    // gameweek's deadline passes, it should be treated as current for
    // display purposes even before any of its data exists yet. That's
    // exactly what getLatestStartedGw checks: has this gameweek's
    // deadline actually passed, not whether FPL's own flag has caught up.
    const gw = getLatestStartedGw(bootstrap.events);

    let eventStatusData = null;
    try {
      eventStatusData = await fpl.eventStatus();
    } catch {
      // handled by the fallback below
    }

    const days = (eventStatusData?.status || [])
      .filter((d) => d.event === gw)
      .map((d) => ({ date: d.date, bonusAdded: d.bonus_added === true }));

    const finalized = gw ? isGwFinalizedFromStatus(eventStatusData, gw, bootstrap.events) : false;

    // Next deadline, for the countdown - whichever gameweek hasn't
    // locked yet.
    const nextEvent = bootstrap.events.find((e) => new Date(e.deadline_time) > new Date());

    res.status(200).json({
      gw,
      days,
      finalized,
      leaguesUpdated: eventStatusData?.leagues === "Updated",
      nextDeadline: nextEvent ? nextEvent.deadline_time : null,
      nextGw: nextEvent ? nextEvent.id : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

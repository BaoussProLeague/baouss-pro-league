import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { isGwFinalizedFromStatus } from "../../../lib/prizes/liveScores";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const bootstrap = await fpl.bootstrap();
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    const gw = currentEvent ? currentEvent.id : null;

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

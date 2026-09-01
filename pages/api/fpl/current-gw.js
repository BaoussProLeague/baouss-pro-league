import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { gwStatus, isGwFullyFinalized } from "../../../lib/prizes/liveScores";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const bootstrap = await fpl.bootstrap();
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    // Was using the old, looser check (event.finished alone) while the
    // Classic League status bar used the stricter, real one (matches
    // FPL's own "PROVISIONAL" signal) - that's exactly what produced the
    // nav badge saying LIVE while the status bar said Confirmed. Both
    // now read from the same source.
    let status = gwStatus(currentEvent);
    if (currentEvent && status === "live") {
      const finalized = await isGwFullyFinalized(currentEvent.id, bootstrap.events);
      if (finalized) status = "completed";
    }
    res.status(200).json({
      gw: currentEvent ? currentEvent.id : null,
      status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

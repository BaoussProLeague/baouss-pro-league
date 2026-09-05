import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { gwStatus, isGwFullyFinalized, getLatestStartedGw } from "../../../lib/prizes/liveScores";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const bootstrap = await fpl.bootstrap();
    // Same fix as gw-status.js and everywhere else - was still using
    // is_current/is_next here, which is exactly why the nav badge stayed
    // on GW2 after GW3's deadline had already passed.
    const gw = getLatestStartedGw(bootstrap.events);
    const currentEvent = bootstrap.events.find((e) => e.id === gw);
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

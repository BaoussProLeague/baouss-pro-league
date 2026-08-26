import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { gwStatus } from "../../../lib/prizes/liveScores";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const bootstrap = await fpl.bootstrap();
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    res.status(200).json({
      gw: currentEvent ? currentEvent.id : null,
      status: gwStatus(currentEvent),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

import { fpl } from "../../../lib/fpl";
import { computeGwSnapshot } from "../../../lib/prizes/gwSnapshot";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { getLatestStartedGw } from "../../../lib/prizes/liveScores";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const bootstrap = await fpl.bootstrap();
    // Same fix as everywhere else - was stuck on is_current/is_next,
    // which is exactly why this stayed on GW2's captain-pick snapshot
    // after GW3's deadline had already passed.
    const gw = getLatestStartedGw(bootstrap.events);
    if (!gw) {
      return res.status(200).json({ gw: null, captainPickAggregate: [], chipsUsedThisGw: null });
    }

    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);
    const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));

    const webNameById = new Map(bootstrap.elements.map((el) => [el.id, el.web_name]));

    const snapshot = await computeGwSnapshot(simpleEntries, gw, webNameById);
    res.status(200).json({ gw, totalManagers: entries.length, ...snapshot });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

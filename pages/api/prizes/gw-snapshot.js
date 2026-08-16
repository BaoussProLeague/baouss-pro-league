import { fpl } from "../../../lib/fpl";
import { computeGwSnapshot } from "../../../lib/prizes/gwSnapshot";

export default async function handler(req, res) {
  try {
    const bootstrap = await fpl.bootstrap();
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    if (!currentEvent) {
      return res.status(200).json({ gw: null, captainPickAggregate: [], chipsUsedThisGw: null });
    }
    const gw = currentEvent.id;

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

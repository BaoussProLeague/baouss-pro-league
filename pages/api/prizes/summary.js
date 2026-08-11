import { fpl } from "../../../lib/fpl";
import { loadAllHistories, teamValue, benchPoints, firstToThreshold } from "../../../lib/prizes/fromHistory";
import { chipPrizes } from "../../../lib/prizes/chips";

export default async function handler(req, res) {
  try {
    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);
    const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));
    const histories = await loadAllHistories(simpleEntries);

    res.status(200).json({
      teamValue: teamValue(histories),
      benchPoints: benchPoints(histories),
      first999: firstToThreshold(histories, 999),
      first1499: firstToThreshold(histories, 1499),
      chips: chipPrizes(histories), // best-of-two-activations per chip, per this season's 2-wildcard rule
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

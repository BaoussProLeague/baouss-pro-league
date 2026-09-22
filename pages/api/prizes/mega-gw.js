import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import { loadAllHistories } from "../../../lib/prizes/fromHistory";
import { megaGwResults } from "../../../lib/prizes/megaGw";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { gwStatus, getLiveHitCostsFromPicks } from "../../../lib/prizes/liveScores";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const { data: megaGws, error } = await supabaseAdmin.from("mega_gws").select("*").order("gw", { ascending: true });
    if (error) throw error;

    if (!megaGws || megaGws.length === 0) {
      return res.status(200).json({ megaGws: [] });
    }

    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);
    const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));
    const histories = await loadAllHistories(simpleEntries);
    const bootstrap = await fpl.bootstrap();

    // Same fix as everywhere else: event_total can carry over the
    // previous gameweek's number until a match actually starts. Fetched
    // once per distinct gw across all Mega GW rows, not per row.
    const distinctGws = [...new Set(megaGws.map((mg) => mg.gw))];
    const fixturesStartedByGw = new Map();
    const hitCostsByGw = new Map();
    await Promise.all(
      distinctGws.map(async (gw) => {
        const fixtures = await fpl.fixtures(gw);
        fixturesStartedByGw.set(gw, fixtures.some((f) => f.started));
        const event = bootstrap.events.find((e) => e.id === gw);
        // Only worth fetching hit costs for a genuinely live gameweek -
        // a completed one reads from history, which is already
        // corrected at the source.
        if (gwStatus(event) === "live") {
          hitCostsByGw.set(gw, await getLiveHitCostsFromPicks(entries, gw));
        }
      })
    );

    res.status(200).json({ megaGws: megaGwResults(megaGws, histories, bootstrap.events, entries, fixturesStartedByGw, hitCostsByGw) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import { loadAllHistories } from "../../../lib/prizes/fromHistory";
import { megaGwResults } from "../../../lib/prizes/megaGw";
import { setNoCache } from "../../../lib/noCacheHeaders";

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

    res.status(200).json({ megaGws: megaGwResults(megaGws, histories, bootstrap.events, entries) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

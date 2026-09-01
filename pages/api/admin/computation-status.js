import { supabaseAdmin } from "../../../lib/supabase";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { fpl } from "../../../lib/fpl";
import { gwStatus, isGwFinalizedFromStatus } from "../../../lib/prizes/liveScores";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const { data, error } = await supabaseAdmin
      .from("gw_computation_locks")
      .select("*")
      .order("gw", { ascending: false });
    if (error) throw error;

    // FPL's own status per gameweek - same signal as the Classic League
    // status card, shown here too so you can see at a glance whether
    // FPL itself has actually confirmed a gameweek, not just whether our
    // own automation has gotten to it yet.
    const bootstrap = await fpl.bootstrap();
    let eventStatusData = null;
    try {
      eventStatusData = await fpl.eventStatus();
    } catch {
      // isGwFinalizedFromStatus falls back to finished+data_checked automatically
    }
    const fplStatusFor = (gw) => {
      const event = bootstrap.events.find((e) => e.id === gw);
      const status = gwStatus(event);
      if (status === "upcoming") return "Not started";
      if (isGwFinalizedFromStatus(eventStatusData, gw, bootstrap.events)) return "Confirmed";
      return "In progress / provisional";
    };

    const statuses = (data || []).map((row) => ({ ...row, fplStatus: fplStatusFor(row.gw) }));

    res.status(200).json({ statuses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

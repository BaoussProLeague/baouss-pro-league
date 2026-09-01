import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import { buildRound2Pool } from "../../../lib/prizes/lms";
import { setNoCache } from "../../../lib/noCacheHeaders";

const LMS_START_GW = 2;

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);
    const allEntriesSimple = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));

    const { data: allEliminations } = await supabaseAdmin
      .from("lms_eliminations")
      .select("*")
      .order("gw_eliminated", { ascending: true });
    const { data: rebuys } = await supabaseAdmin.from("lms_rebuys").select("*");

    if (!allEliminations || allEliminations.length === 0) {
      return res.status(200).json({ gw: null, minGw: LMS_START_GW, maxGw: LMS_START_GW, scores: [] });
    }

    const maxEliminatedGw = Math.max(...allEliminations.map((e) => e.gw_eliminated));
    const requestedGw = req.query.gw ? Number(req.query.gw) : maxEliminatedGw;
    const gw = Math.min(Math.max(requestedGw, LMS_START_GW), maxEliminatedGw);

    const round = gw >= 25 ? 2 : 1;

    // Same starting-pool logic as the actual elimination engine - who
    // was even in contention for this specific gameweek. Round 2 isn't
    // "everyone," it's specifically GW21 survivors plus paid rebuys.
    let startingPool;
    if (round === 1) {
      startingPool = allEntriesSimple;
    } else {
      const round1Eliminations = allEliminations.filter((e) => e.round === 1);
      const round1EliminatedIds = new Set(round1Eliminations.map((e) => e.entry_id));
      const round1StillAlive = allEntriesSimple.filter((e) => !round1EliminatedIds.has(e.entry));
      startingPool = buildRound2Pool(round1Eliminations, round1StillAlive, rebuys || []);
    }

    // Alive at the start of this gameweek = not eliminated in this round
    // BEFORE this gameweek. Anyone eliminated exactly in this gameweek
    // is included too - their score is what got them eliminated.
    const eliminatedBeforeThisGw = new Set(
      allEliminations.filter((e) => e.round === round && e.gw_eliminated < gw).map((e) => e.entry_id)
    );
    const population = startingPool.filter((e) => !eliminatedBeforeThisGw.has(e.entry));
    const eliminatedThisGwIds = new Set(
      allEliminations.filter((e) => e.round === round && e.gw_eliminated === gw).map((e) => e.entry_id)
    );

    const scores = await Promise.all(
      population.map(async (m) => {
        try {
          const h = await fpl.entryHistory(m.entry);
          const row = h.current.find((r) => r.event === gw);
          return {
            entry: m.entry,
            entryName: m.entryName,
            points: row ? row.points : null,
            eliminatedThisGw: eliminatedThisGwIds.has(m.entry),
          };
        } catch {
          return { entry: m.entry, entryName: m.entryName, points: null, eliminatedThisGw: eliminatedThisGwIds.has(m.entry) };
        }
      })
    );
    scores.sort((a, b) => (a.points ?? Infinity) - (b.points ?? Infinity));

    res.status(200).json({
      gw,
      minGw: LMS_START_GW,
      maxGw: maxEliminatedGw,
      scores,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

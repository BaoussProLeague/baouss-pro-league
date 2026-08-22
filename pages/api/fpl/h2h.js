import { fpl } from "../../../lib/fpl";
import { supabaseAdmin } from "../../../lib/supabase";
import { loadAllHistories } from "../../../lib/prizes/fromHistory";
import { computeCustomH2hStandings } from "../../../lib/prizes/customH2h";
import { computeRankDeltas } from "../../../lib/prizes/rankDelta";
import { setNoCache } from "../../../lib/noCacheHeaders";

const GROUP_STAGE_LAST_GW = 30;

// Self-hosted H2H, entirely independent of FPL's own H2H league (which
// you called obsolete once some managers missed its join deadline).
// Fixtures come from our own generated schedule (see
// /api/admin/generate-h2h-fixtures); results come from comparing each
// pair's real Classic gameweek score.
export default async function handler(req, res) {
  setNoCache(res);
  try {
    const { data: fixtures, error: fixturesError } = await supabaseAdmin
      .from("h2h_custom_fixtures")
      .select("*");
    if (fixturesError) throw fixturesError;

    if (!fixtures || fixtures.length === 0) {
      return res.status(200).json({
        currentGw: null,
        groupStageOver: false,
        groupStageSnapshotGw: null,
        hasStarted: false,
        fixturesGenerated: false,
        standings: [],
        cupQualification: { gold: [], silver: [] },
      });
    }

    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);
    const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));
    const histories = await loadAllHistories(simpleEntries);

    const bootstrap = await fpl.bootstrap();
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    const currentGw = currentEvent ? currentEvent.id : 1;
    const groupStageOver = currentGw > GROUP_STAGE_LAST_GW;

    const uptoGw = groupStageOver ? GROUP_STAGE_LAST_GW : currentGw;
    const ranked = computeCustomH2hStandings(fixtures, histories, uptoGw);

    // Last week's standings, purely to diff against this week's for the
    // rank-change arrows - frozen once the group stage itself is frozen.
    const prevUptoGw = groupStageOver ? GROUP_STAGE_LAST_GW : Math.max(1, currentGw - 1);
    const rankedPrev = computeCustomH2hStandings(fixtures, histories, prevUptoGw);
    const deltas = computeRankDeltas(ranked, rankedPrev);

    const gold = ranked.slice(0, 16);
    const silver = ranked.slice(16, 32);

    res.status(200).json({
      currentGw,
      groupStageOver,
      groupStageSnapshotGw: groupStageOver ? GROUP_STAGE_LAST_GW : null,
      hasStarted: ranked.length > 0,
      fixturesGenerated: true,
      standings: ranked.map((r, i) => ({
        entry: r.entry,
        entryName: r.entryName,
        rank: i + 1,
        played: r.played,
        won: r.won,
        drawn: r.drawn,
        lost: r.lost,
        points: r.points,
        delta: deltas.get(r.entry) ?? null,
      })),
      cupQualification: {
        gold: gold.map((r, i) => ({ entry: r.entry, entryName: r.entryName, rank: i + 1 })),
        silver: silver.map((r, i) => ({ entry: r.entry, entryName: r.entryName, rank: i + 17 })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

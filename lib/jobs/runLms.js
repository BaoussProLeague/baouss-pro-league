import { supabaseAdmin } from "../supabase";
import { fpl } from "../fpl";
import { resolveByPointsAndBench, resolveByCaptainOrRandom } from "../prizes/lms";

// Runs the full LMS elimination check for one gameweek. Returns a plain
// { ok, status, message, data } shape rather than throwing, so callers
// (admin route, Run All button, daily cron) can all handle it the same
// way without try/catch boilerplate at every call site.
export async function runLmsForGw(gwNum, round = 1) {
  if (!process.env.FPL_CLASSIC_LEAGUE_ID) {
    return { ok: false, status: "config_error", message: "FPL_CLASSIC_LEAGUE_ID is not set." };
  }

  const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
  const { entries } = await fpl.allClassicEntries(leagueId);
  if (!entries || entries.length === 0) {
    return { ok: false, status: "no_entries", message: "No entries found for this classic league - check FPL_CLASSIC_LEAGUE_ID is correct." };
  }

  const { data: priorEliminations } = await supabaseAdmin
    .from("lms_eliminations")
    .select("entry_id")
    .eq("round", round);
  const eliminatedIds = new Set((priorEliminations || []).map((e) => e.entry_id));
  const remaining = entries
    .filter((e) => !eliminatedIds.has(e.entry))
    .map((e) => ({ entry: e.entry, entryName: e.entry_name }));

  if (remaining.length <= 1) {
    const message = remaining.length === 1
      ? `Only one manager remains (${remaining[0].entryName}) - they're your LMS winner, nothing left to eliminate.`
      : "No managers remaining to eliminate.";
    return { ok: true, status: "no_action", message };
  }

  const scoresByEntry = new Map();
  const missingScores = [];
  for (const m of remaining) {
    const h = await fpl.entryHistory(m.entry);
    const row = h.current.find((r) => r.event === gwNum);
    if (!row) missingScores.push(m.entryName);
    scoresByEntry.set(m.entry, { points: row ? row.points : null, benchPoints: row ? row.points_on_bench : null });
  }

  if (missingScores.length > 0) {
    return {
      ok: false,
      status: "no_score_yet",
      message: `GW${gwNum} has no recorded score yet for: ${missingScores.join(", ")}. The gameweek probably hasn't locked yet.`,
    };
  }

  // Stage 1: points, then bench points - both already in hand, no extra
  // API calls. Only escalates to stage 2 if genuinely still tied.
  const stage1 = resolveByPointsAndBench(remaining, scoresByEntry);

  let finalPick;
  if (stage1.decided) {
    finalPick = { eliminated: stage1.eliminated, tieBrokenBy: stage1.tieBrokenBy, tieCandidates: null };
  } else {
    // Stage 2: fetch captain points, but ONLY for the still-tied subset -
    // not every remaining manager, to keep this cheap.
    const withCaptainPoints = await Promise.all(
      stage1.tiedCandidates.map(async (m) => {
        const picks = await fpl.entryPicks(m.entry, gwNum);
        const captainPick = picks.picks.find((p) => p.is_captain);
        const live = await fpl.eventLive(gwNum);
        const playerLive = captainPick ? live.elements.find((el) => el.id === captainPick.element) : null;
        const captainPoints = playerLive ? playerLive.stats.total_points * captainPick.multiplier : 0;
        return { ...m, captainPoints };
      })
    );
    finalPick = resolveByCaptainOrRandom(withCaptainPoints);
  }

  const row = {
    entry_id: finalPick.eliminated.entry,
    entry_name: finalPick.eliminated.entryName,
    gw_eliminated: gwNum,
    gw_score: finalPick.eliminated.points,
    round,
    tie_broken_by: finalPick.tieBrokenBy,
    tie_candidates: finalPick.tieCandidates,
  };

  const { error } = await supabaseAdmin.from("lms_eliminations").insert(row);
  if (error) return { ok: false, status: "db_error", message: error.message };

  const tieNote = finalPick.tieBrokenBy === "random_draw"
    ? ` (tied with ${finalPick.tieCandidates.map((c) => c.entryName).join(", ")} through points, bench points, and captain points - resolved by random draw)`
    : finalPick.tieBrokenBy
    ? ` (tie broken by ${finalPick.tieBrokenBy.replace("_", " ")})`
    : "";

  return {
    ok: true,
    status: "ok",
    message: `GW${gwNum}: eliminated ${row.entry_name}${tieNote}.`,
    data: { rows: [row] },
  };
}

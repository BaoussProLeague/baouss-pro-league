import { supabaseAdmin } from "../supabase";
import { fpl } from "../fpl";
import { resolveByPointsAndBench, resolveByCaptainOrRandom, buildRound2Pool } from "../prizes/lms";

const LMS_START_GW = 2; // per your rules doc - LMS doesn't exist before this
const LMS_LAST_ELIGIBLE_FOR_REBUY = 21;
const LMS_BREAK_GWS = [22, 23, 24]; // no elimination happens during the break

// Runs the full LMS elimination check for one gameweek. Returns a plain
// { ok, status, message, data } shape rather than throwing, so callers
// (admin route, Run All button, daily cron) can all handle it the same
// way without try/catch boilerplate at every call site.
//
// `round` no longer needs to be passed in manually by the caller - it's
// determined here, directly from the gameweek, so there's exactly one
// place that decides "which round is this" instead of trusting every
// caller (manual button, Run All, daily automation) to pass the right
// value. Automation was never passing one at all before this fix, which
// meant it would have silently kept running round 1 logic forever, even
// past GW25.
export async function runLmsForGw(gwNum) {
  if (gwNum < LMS_START_GW) {
    return { ok: false, status: "before_lms_start", message: `LMS starts from GW${LMS_START_GW} - GW${gwNum} is before that, nothing should be eliminated for it.` };
  }
  if (LMS_BREAK_GWS.includes(gwNum)) {
    return { ok: true, status: "no_action", message: `GW${gwNum} is the rebuy break - no elimination happens this week. LMS resumes GW25.` };
  }

  const round = gwNum >= 25 ? 2 : 1;

  if (!process.env.FPL_CLASSIC_LEAGUE_ID) {
    return { ok: false, status: "config_error", message: "FPL_CLASSIC_LEAGUE_ID is not set." };
  }

  const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
  const { entries } = await fpl.allClassicEntries(leagueId);
  if (!entries || entries.length === 0) {
    return { ok: false, status: "no_entries", message: "No entries found for this classic league - check FPL_CLASSIC_LEAGUE_ID is correct." };
  }
  const allEntriesSimple = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));

  let startingPool;
  if (round === 1) {
    startingPool = allEntriesSimple;
  } else {
    // Round 2's starting pool is NOT "everyone" - it's specifically the
    // GW21 survivors plus whoever paid the rebuy fee (see rules doc).
    // Using the full manager list here (what the old code effectively
    // did, since it only ever filtered by round-2 eliminations, which
    // start empty) would have silently let every eliminated-in-round-1,
    // never-rebought manager back into contention at GW25.
    const { data: round1Eliminations } = await supabaseAdmin
      .from("lms_eliminations")
      .select("*")
      .eq("round", 1);
    const { data: rebuys } = await supabaseAdmin.from("lms_rebuys").select("*");

    const round1EliminatedIds = new Set((round1Eliminations || []).map((e) => e.entry_id));
    const round1StillAlive = allEntriesSimple.filter((e) => !round1EliminatedIds.has(e.entry));

    startingPool = buildRound2Pool(round1Eliminations || [], round1StillAlive, rebuys || []);
  }

  const { data: priorEliminations } = await supabaseAdmin
    .from("lms_eliminations")
    .select("entry_id")
    .eq("round", round);
  const eliminatedIds = new Set((priorEliminations || []).map((e) => e.entry_id));
  const remaining = startingPool.filter((e) => !eliminatedIds.has(e.entry));

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
        // Same fix as Perfect Captaincy/Captain Points: if the original
        // captain didn't play, FPL moves the multiplier to the
        // vice-captain - the is_captain flag never reflects that move.
        // Using it here would let an actual elimination hinge on the
        // wrong player's score.
        const effectiveCaptainPick = picks.picks.reduce(
          (best, p) => (!best || p.multiplier > best.multiplier ? p : best),
          null
        );
        const captainPick = effectiveCaptainPick && effectiveCaptainPick.multiplier >= 2
          ? effectiveCaptainPick
          : picks.picks.find((p) => p.is_captain);
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

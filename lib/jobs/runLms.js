import { supabaseAdmin } from "../supabase";
import { fpl } from "../fpl";
import { resolveByPointsAndBench, resolveByCaptainOrRandom, buildRound2Pool } from "../prizes/lms";
import { isGwFullyFinalized } from "../prizes/liveScores";

const LMS_START_GW = 2; // per your rules doc - LMS doesn't exist before this
const LMS_LAST_ELIGIBLE_FOR_REBUY = 21;
const LMS_BREAK_GWS = [22, 23, 24]; // no elimination happens during the break

// 2/week through round 1 (GW2-21), by your explicit call: more people
// eliminated pre-break means more rebuy-eligible managers, which grows
// the rebuy pot. Round 2's rate is deliberately left at 1/week for
// now - not because that's the right number, but because you asked to
// revisit it once the actual rebuy count is known (right before GW25).
// The real number needed depends on how many people rebuy, which is
// voluntary and genuinely unknown until then - see ROUND2_ELIMINATIONS
// below when that conversation happens.
const ROUND1_ELIMINATIONS_PER_WEEK = 2;
const ROUND2_ELIMINATIONS_PER_WEEK = 1; // placeholder - revisit after GW24 rebuy numbers are final

// Finds exactly one loser from a given pool for this gameweek, using the
// full points -> bench points -> captain points -> random draw cascade.
// Pulled out on its own so multi-elimination weeks can call it
// repeatedly against a shrinking pool - each call re-applies the whole
// cascade fresh to whoever's left, which correctly handles even a
// genuine 3-way tie at the bottom when 2 people need eliminating from it.
async function findOneLoser(remainingPool, gwNum, scoresByEntry) {
  const stage1 = resolveByPointsAndBench(remainingPool, scoresByEntry);
  if (stage1.decided) {
    return { eliminated: stage1.eliminated, tieBrokenBy: stage1.tieBrokenBy, tieCandidates: null };
  }

  const live = await fpl.eventLive(gwNum);
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
      const playerLive = captainPick ? live.elements.find((el) => el.id === captainPick.element) : null;
      const captainPoints = playerLive ? playerLive.stats.total_points * captainPick.multiplier : 0;
      return { ...m, captainPoints };
    })
  );
  return resolveByCaptainOrRandom(withCaptainPoints);
}

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

  // This is the actual fix for eliminations happening while the
  // gameweek is still live: an elimination is irreversible, so unlike
  // Captain Points/Def+GK (which are fine accumulating gradually), LMS
  // must never act on partial data - not "nothing's live right this
  // second" (which is true even before a single match has kicked off),
  // but genuinely, fully finished, bonus points confirmed. This check
  // lives here, inside the function itself, specifically so it applies
  // no matter who's calling it - the daily automation, the manual admin
  // button, or Run All - rather than trusting every caller to have
  // already verified it's safe.
  if (!process.env.FPL_CLASSIC_LEAGUE_ID) {
    return { ok: false, status: "config_error", message: "FPL_CLASSIC_LEAGUE_ID is not set." };
  }
  const bootstrap = await fpl.bootstrap();
  const event = bootstrap.events.find((e) => e.id === gwNum);
  // Upgraded from checking event.finished alone to the same signal FPL's
  // own site uses for its "PROVISIONAL" label - a gameweek being
  // "finished" doesn't mean every day within it has bonus confirmed.
  if (!(await isGwFullyFinalized(gwNum, bootstrap.events))) {
    return {
      ok: false,
      status: "gw_not_finished",
      message: `GW${gwNum} hasn't fully finished yet (FPL is still showing at least one day as provisional) - LMS refuses to run until it has. Nobody was eliminated.`,
    };
  }

  const round = gwNum >= 25 ? 2 : 1;
  // GW2 specifically stays at 1 elimination - per your call, that's
  // what you already told the league to expect before the 2/week rate
  // was announced. GW3 onward through the break runs at the full rate.
  const eliminationsThisWeek = round === 2
    ? ROUND2_ELIMINATIONS_PER_WEEK
    : gwNum === LMS_START_GW
    ? 1
    : ROUND1_ELIMINATIONS_PER_WEEK;

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

  // Never eliminate more people than are actually left - if the pool is
  // down to, say, 1 remaining during a 2/week week, eliminate that one
  // and stop, don't try to find a second loser from an empty pool.
  const actualEliminationCount = Math.min(eliminationsThisWeek, remaining.length - 1) || 1;

  let pool = remaining;
  const eliminatedRows = [];
  for (let i = 0; i < actualEliminationCount; i++) {
    const finalPick = await findOneLoser(pool, gwNum, scoresByEntry);
    eliminatedRows.push({
      entry_id: finalPick.eliminated.entry,
      entry_name: finalPick.eliminated.entryName,
      gw_eliminated: gwNum,
      gw_score: finalPick.eliminated.points,
      round,
      tie_broken_by: finalPick.tieBrokenBy,
      tie_candidates: finalPick.tieCandidates,
    });
    pool = pool.filter((m) => m.entry !== finalPick.eliminated.entry);
  }

  const { error } = await supabaseAdmin.from("lms_eliminations").insert(eliminatedRows);
  if (error) return { ok: false, status: "db_error", message: error.message };

  const describeRow = (row) => {
    const tieNote = row.tie_broken_by === "random_draw"
      ? " (tied through points, bench points, and captain points - resolved by random draw)"
      : row.tie_broken_by
      ? ` (tie broken by ${row.tie_broken_by.replace("_", " ")})`
      : "";
    return `${row.entry_name}${tieNote}`;
  };

  return {
    ok: true,
    status: "ok",
    message: `GW${gwNum}: eliminated ${eliminatedRows.map(describeRow).join("; ")}.`,
    data: { rows: eliminatedRows },
  };
}

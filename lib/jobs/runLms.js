import { supabaseAdmin } from "../supabase";
import { fpl } from "../fpl";
import { computeGwElimination } from "../prizes/lms";

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
    scoresByEntry.set(m.entry, {
      points: row ? row.points : null,
      benchPoints: row ? row.points_on_bench : null,
      captainPoints: null,
    });
  }

  if (missingScores.length > 0) {
    return {
      ok: false,
      status: "no_score_yet",
      message: `GW${gwNum} has no recorded score yet for: ${missingScores.join(", ")}. The gameweek probably hasn't locked yet.`,
    };
  }

  let result = computeGwElimination(remaining, scoresByEntry);

  if (result.tie && !result.tieBrokenBy) {
    for (const m of result.eliminated) {
      const picks = await fpl.entryPicks(m.entry, gwNum);
      const captainPick = picks.picks.find((p) => p.is_captain);
      const live = await fpl.eventLive(gwNum);
      const playerLive = captainPick ? live.elements.find((el) => el.id === captainPick.element) : null;
      const captainPoints = playerLive ? playerLive.stats.total_points * captainPick.multiplier : 0;
      scoresByEntry.get(m.entry).captainPoints = captainPoints;
    }
    result = computeGwElimination(remaining, scoresByEntry);
  }

  if (result.tie) {
    return {
      ok: true,
      status: "manual_action_required",
      message: `Still tied after points, bench points, and captain points: ${result.eliminated.map((e) => e.entryName).join(", ")}. Needs a manual coin toss.`,
      data: { tied: result.eliminated },
    };
  }

  const rows = result.eliminated.map((m) => ({
    entry_id: m.entry, entry_name: m.entryName, gw_eliminated: gwNum, gw_score: m.points, round,
  }));
  const { error } = await supabaseAdmin.from("lms_eliminations").insert(rows);
  if (error) return { ok: false, status: "db_error", message: error.message };

  return {
    ok: true,
    status: "ok",
    message: `GW${gwNum}: eliminated ${rows.map((r) => r.entry_name).join(", ")}.`,
    data: { rows },
  };
}

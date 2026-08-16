import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import { computeGwElimination } from "../../../lib/prizes/lms";
import { logAdminActivity } from "../../../lib/adminLog";

// POST { password, gw, round }
// Confirms and records the elimination for a given completed gameweek.
// Human-triggered on purpose - see status.js comment for why.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, gw, round = 1 } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const gwNum = Number(gw);
  if (!gw || !Number.isInteger(gwNum) || gwNum < 1 || gwNum > 38) {
    return res.status(400).json({ error: "Gameweek must be a whole number between 1 and 38." });
  }
  if (!process.env.FPL_CLASSIC_LEAGUE_ID) {
    return res.status(500).json({ error: "FPL_CLASSIC_LEAGUE_ID is not set - add it in Vercel's environment variables." });
  }

  try {
    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);

    if (!entries || entries.length === 0) {
      const msg = "No entries found for this classic league - check FPL_CLASSIC_LEAGUE_ID is correct.";
      await logAdminActivity("lms_elimination", `GW${gwNum}: ${msg}`, { gw: gwNum }, false);
      return res.status(400).json({ error: msg });
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
      const msg = remaining.length === 1
        ? `Only one manager remains (${remaining[0].entryName}) - they're your LMS winner, nothing left to eliminate.`
        : "No managers remaining to eliminate.";
      await logAdminActivity("lms_elimination", `GW${gwNum}: ${msg}`, { gw: gwNum }, false);
      return res.status(200).json({ status: "no_action", message: msg });
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
      const msg = `GW${gwNum} has no recorded score yet for: ${missingScores.join(", ")}. The gameweek probably hasn't started or finished yet - wait until it locks before running this.`;
      await logAdminActivity("lms_elimination", `GW${gwNum}: blocked, missing scores`, { gw: gwNum, missingScores }, false);
      return res.status(400).json({ error: msg });
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
      const msg = `Still tied after points, bench points, and captain points: ${result.eliminated.map((e) => e.entryName).join(", ")}. This needs a manual coin toss - decide the loser yourselves and record it directly, this route doesn't auto-resolve a true tie.`;
      await logAdminActivity("lms_elimination", `GW${gwNum}: unresolved tie`, { gw: gwNum, tied: result.eliminated }, false);
      return res.status(200).json({ status: "manual_action_required", message: msg, candidates: result.eliminated });
    }

    const rows = result.eliminated.map((m) => ({
      entry_id: m.entry,
      entry_name: m.entryName,
      gw_eliminated: gwNum,
      gw_score: m.points,
      round,
    }));

    const { error } = await supabaseAdmin.from("lms_eliminations").insert(rows);
    if (error) throw error;

    await logAdminActivity("lms_elimination", `GW${gwNum}: eliminated ${rows.map((r) => r.entry_name).join(", ")}`, { gw: gwNum, rows }, true);
    res.status(200).json({ status: "ok", eliminated: rows });
  } catch (err) {
    await logAdminActivity("lms_elimination", `GW${gwNum}: failed - ${err.message}`, { gw: gwNum }, false);
    res.status(500).json({ error: `Couldn't run LMS elimination: ${err.message}` });
  }
}

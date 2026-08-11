import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import { computeGwElimination } from "../../../lib/prizes/lms";

// POST { password, gw, round }
// Confirms and records the elimination for a given completed gameweek.
// Human-triggered on purpose - see status.js comment for why.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, gw, round = 1 } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!gw) return res.status(400).json({ error: "gw is required" });

  try {
    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);

    const { data: priorEliminations } = await supabaseAdmin
      .from("lms_eliminations")
      .select("entry_id")
      .eq("round", round);
    const eliminatedIds = new Set((priorEliminations || []).map((e) => e.entry_id));
    const remaining = entries
      .filter((e) => !eliminatedIds.has(e.entry))
      .map((e) => ({ entry: e.entry, entryName: e.entry_name }));

    // Pull each remaining manager's GW score, bench points, captain points
    // for the tie-break chain. entryHistory gives points + bench points
    // cheaply; captain points need the picks endpoint (only fetched for
    // managers involved in the tie, to keep calls low).
    const scoresByEntry = new Map();
    for (const m of remaining) {
      const h = await fpl.entryHistory(m.entry);
      const row = h.current.find((r) => r.event === Number(gw));
      scoresByEntry.set(m.entry, {
        points: row ? row.points : null,
        benchPoints: row ? row.points_on_bench : null,
        captainPoints: null, // filled in below only if needed for tie-break
      });
    }

    let result = computeGwElimination(remaining, scoresByEntry);

    if (result.tie && !result.tieBrokenBy) {
      // Need captain points to keep breaking the tie
      for (const m of result.eliminated) {
        const picks = await fpl.entryPicks(m.entry, gw);
        const captainPick = picks.picks.find((p) => p.is_captain);
        const live = await fpl.eventLive(gw);
        const playerLive = live.elements.find((el) => el.id === captainPick.element);
        const captainPoints = playerLive ? playerLive.stats.total_points * captainPick.multiplier : 0;
        scoresByEntry.get(m.entry).captainPoints = captainPoints;
      }
      result = computeGwElimination(remaining, scoresByEntry);
    }

    if (result.tie) {
      return res.status(200).json({
        status: "manual_action_required",
        message: "Still tied after bench + captain points. Resolve with a coin toss and call this route again with a manual override (not yet built - see README).",
        candidates: result.eliminated,
      });
    }

    const rows = result.eliminated.map((m) => ({
      entry_id: m.entry,
      entry_name: m.entryName,
      gw_eliminated: Number(gw),
      gw_score: m.points,
      round,
    }));

    const { error } = await supabaseAdmin.from("lms_eliminations").insert(rows);
    if (error) throw error;

    res.status(200).json({ status: "ok", eliminated: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

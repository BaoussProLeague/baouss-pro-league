import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import { generateRoundRobinSchedule } from "../../../lib/prizes/roundRobin";
import { logAdminActivity } from "../../../lib/adminLog";

const FIRST_GW = 2;
const NUM_ROUNDS = 29; // GW2 through GW30

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password, force } = req.body;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { count } = await supabaseAdmin
      .from("h2h_custom_fixtures")
      .select("id", { count: "exact", head: true });

    if (count > 0 && !force) {
      return res.status(400).json({
        error: `Fixtures already exist (${count} rows). Generating again would create a second, overlapping schedule. Pass force:true only if you're certain you want to wipe and regenerate - this is destructive and can't be undone.`,
        existingCount: count,
      });
    }

    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);
    if (entries.length < 4) {
      return res.status(400).json({ error: `Only ${entries.length} entries found - that seems too few to generate a real season from. Check FPL_CLASSIC_LEAGUE_ID before proceeding.` });
    }

    const teamIds = entries.map((e) => e.entry);
    const rounds = generateRoundRobinSchedule(teamIds, NUM_ROUNDS);

    const rows = [];
    rounds.forEach((pairings, roundIndex) => {
      const round = roundIndex + 1;
      const gw = FIRST_GW + roundIndex;
      pairings.forEach(([a, b]) => {
        rows.push({ round, gw, entry_id_1: a, entry_id_2: b });
      });
    });

    if (force && count > 0) {
      const { error: deleteError } = await supabaseAdmin.from("h2h_custom_fixtures").delete().neq("id", 0);
      if (deleteError) throw deleteError;
    }

    const { error: insertError } = await supabaseAdmin.from("h2h_custom_fixtures").insert(rows);
    if (insertError) throw insertError;

    await logAdminActivity(
      "h2h_fixtures_generated",
      `Generated ${rows.length} H2H fixtures across ${rounds.length} rounds for ${teamIds.length} teams`,
      { teamCount: teamIds.length, roundCount: rounds.length, fixtureCount: rows.length },
      true
    );

    res.status(200).json({
      status: "ok",
      teamCount: teamIds.length,
      roundCount: rounds.length,
      fixtureCount: rows.length,
    });
  } catch (err) {
    await logAdminActivity("h2h_fixtures_generation_failed", err.message, {}, false);
    res.status(500).json({ error: err.message });
  }
}

import * as XLSX from "xlsx";
import { supabaseAdmin } from "../../../lib/supabase";
import { fpl } from "../../../lib/fpl";
import {
  loadAllHistories, teamValue, benchPoints, firstToThreshold,
  leastTransferCost, wildcardVision,
} from "../../../lib/prizes/fromHistory";
import { chipPrizes } from "../../../lib/prizes/chips";

// GET ?password=... - returns an .xlsx file. One-way export for now, per
// your call; two-way sync with an editable sheet is a separate, larger
// piece to build later.
export default async function handler(req, res) {
  if (req.query.password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
    const { entries } = await fpl.allClassicEntries(leagueId);
    const simpleEntries = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name }));
    const histories = await loadAllHistories(simpleEntries);
    const topHalfCutoff = Math.ceil(entries.length / 2);
    const standingsForRank = entries.map((e) => ({ entry: e.entry, entryName: e.entry_name, rank: e.rank }));

    const wb = XLSX.utils.book_new();

    const addSheet = (name, rows) => {
      const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ note: "No data yet" }]);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    };

    addSheet(
      "Classic Standings",
      entries.map((e) => ({ Rank: e.rank, Manager: e.player_name, Team: e.entry_name, "Total Points": e.total }))
    );

    addSheet(
      "Team Value",
      teamValue(histories).map((r) => ({ Manager: r.entryName, "Team Value (£m)": r.value }))
    );
    addSheet(
      "Bench Points",
      benchPoints(histories).map((r) => ({ Manager: r.entryName, "Bench Points": r.benchPoints }))
    );
    addSheet(
      "Least Transfer Cost",
      leastTransferCost(histories, standingsForRank, topHalfCutoff).map((r) => ({ Manager: r.entryName, "Hit Cost": r.hitCost }))
    );
    addSheet(
      "Wildcard Vision",
      wildcardVision(histories).map((r) => ({ Manager: r.entryName, "5-GW Total": r.total, "Start GW": r.startGw, Complete: r.complete }))
    );

    const chips = chipPrizes(histories);
    for (const [key, chip] of Object.entries(chips)) {
      addSheet(chip.label, chip.leaderboard.map((r) => ({ Manager: r.entryName, Score: r.score, GW: r.gw })));
    }

    const { data: registrations } = await supabaseAdmin.from("registrations").select("*");
    addSheet(
      "Registrations",
      (registrations || []).map((r) => ({
        Manager: r.manager_name, Team: r.fpl_team_name, Phone: r.phone,
        Amount: r.amount, Currency: r.currency, "Paid To": r.paid_to, Paid: r.paid,
      }))
    );

    const { data: payouts } = await supabaseAdmin.from("prize_payouts").select("*");
    addSheet(
      "Finance - Payouts",
      (payouts || []).map((p) => ({
        Prize: p.prize_label, Winner: p.winner_name, Amount: p.amount,
        "Assigned Admin": p.assigned_admin, Paid: p.paid,
      }))
    );

    const { data: lmsElim } = await supabaseAdmin.from("lms_eliminations").select("*").order("gw_eliminated");
    addSheet(
      "LMS Eliminations",
      (lmsElim || []).map((e) => ({ "GW Out": e.gw_eliminated, Team: e.entry_name, Score: e.gw_score }))
    );

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="baouss-pro-league-export-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.status(200).send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

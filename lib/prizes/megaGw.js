// A completed Mega GW's winner comes from history data (already
// finalized, cheap). A LIVE one - deadline passed, gameweek not yet
// finished - needs live-computed scores instead, since history won't
// have that row populated yet. Status itself comes from FPL's own event
// flags (see gwStatus in liveScores.js), not from "does data exist" -
// that inference is what caused a GW to show "completed" the instant it
// started.

import { getLiveGwScoresFromStandings, gwStatus } from "./liveScores";

export function megaGwResults(megaGwRows, histories, events, rawClassicEntries) {
  const results = [];

  for (const mg of megaGwRows) {
    const event = events.find((e) => e.id === mg.gw);
    const status = gwStatus(event);

    let scored;
    if (status === "completed") {
      scored = histories
        .map((m) => {
          const row = m.history.find((h) => h.event === mg.gw);
          if (!row) return null;
          return { entry: m.entry, entryName: m.entryName, points: row.points };
        })
        .filter(Boolean);
    } else if (status === "live") {
      scored = getLiveGwScoresFromStandings(rawClassicEntries);
    } else {
      scored = [];
    }

    scored.sort((a, b) => b.points - a.points);

    results.push({
      id: mg.id,
      gw: mg.gw,
      label: mg.label,
      prizeAmountInr: mg.prize_amount_inr,
      status,
      leaderboard: scored.slice(0, 5),
    });
  }

  return results;
}

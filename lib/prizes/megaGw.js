// A completed Mega GW's winner comes from history data (already
// finalized, cheap). A LIVE one - deadline passed, gameweek not yet
// finished - needs live-computed scores instead, since history won't
// have that row populated yet. Status itself comes from FPL's own event
// flags (see gwStatus in liveScores.js), not from "does data exist" -
// that inference is what caused a GW to show "completed" the instant it
// started.

import { getLiveGwScoresFromStandings, gwStatus } from "./liveScores";

export function megaGwResults(megaGwRows, histories, events, rawClassicEntries, fixturesStartedByGw = new Map()) {
  const results = [];

  for (const mg of megaGwRows) {
    const event = events.find((e) => e.id === mg.gw);
    const status = gwStatus(event);

    let scored = [];
    if (status === "completed" || status === "live") {
      const fixturesStarted = fixturesStartedByGw.get(mg.gw) ?? true;
      const liveScores = getLiveGwScoresFromStandings(rawClassicEntries, fixturesStarted);
      const liveByEntry = new Map(liveScores.map((s) => [s.entry, s.points]));

      scored = histories
        .map((m) => {
          // Same fix as everywhere else: for the current gameweek
          // specifically, a history row existing doesn't mean it's
          // trustworthy - it could be a placeholder created right after
          // deadline, before a single match has been played. Live data
          // is checked first when this Mega GW's status is genuinely
          // "live" (not just "completed", where history is finalized and
          // trustworthy) - no separate currentGw needed here, since
          // status === "live" already means mg.gw IS the live gameweek.
          if (status === "live" && liveByEntry.has(m.entry)) {
            return { entry: m.entry, entryName: m.entryName, points: liveByEntry.get(m.entry) };
          }
          const row = m.history.find((h) => h.event === mg.gw);
          if (row) return { entry: m.entry, entryName: m.entryName, points: row.points };
          if (liveByEntry.has(m.entry)) return { entry: m.entry, entryName: m.entryName, points: liveByEntry.get(m.entry) };
          return null;
        })
        .filter(Boolean);
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

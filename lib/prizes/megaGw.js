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

    let scored = [];
    if (status === "completed" || status === "live") {
      // Same fix as everywhere else: don't trust "completed" as proof
      // history has actually caught up. Try history first (it's the
      // more authoritative source once available); for anyone missing a
      // row - whether the GW is genuinely still live, or sitting in that
      // brief window where it's just been marked finished but history
      // hasn't been recomputed yet - fall back to the live-verified
      // Classic standings score instead of silently dropping them from
      // the leaderboard.
      const liveScores = getLiveGwScoresFromStandings(rawClassicEntries);
      const liveByEntry = new Map(liveScores.map((s) => [s.entry, s.points]));

      scored = histories
        .map((m) => {
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

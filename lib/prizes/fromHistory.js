import { fpl } from "../fpl";

// Fetches entry history for every manager in the classic league once,
// and derives every prize below from that single data set. This keeps
// FPL API calls to O(managers) instead of O(managers * gameweeks).

export async function loadAllHistories(entries) {
  // entries: [{ entry, entryName, managerName }]
  const histories = await Promise.all(
    entries.map(async (e) => {
      const h = await fpl.entryHistory(e.entry);
      return { ...e, history: h.current, chips: h.chips, pastSeasons: h.past };
    })
  );
  return histories;
}

// --- Team Value ---
export function teamValue(histories) {
  const withValue = histories.map((m) => {
    const last = m.history[m.history.length - 1];
    return { entry: m.entry, entryName: m.entryName, value: last ? last.value / 10 : 0 };
  });
  return withValue.sort((a, b) => b.value - a.value);
}

// --- Bench Points (sum across the season) ---
export function benchPoints(histories) {
  const totals = histories.map((m) => ({
    entry: m.entry,
    entryName: m.entryName,
    benchPoints: m.history.reduce((sum, gw) => sum + (gw.points_on_bench || 0), 0),
  }));
  return totals.sort((a, b) => b.benchPoints - a.benchPoints);
}

// --- First to 999 / First to 1499 (live basis - first GW where cumulative total crosses threshold) ---
export function firstToThreshold(histories, threshold) {
  const results = histories
    .map((m) => {
      const hitGw = m.history.find((gw) => gw.total_points >= threshold);
      return hitGw ? { entry: m.entry, entryName: m.entryName, gwReached: hitGw.event, totalAtHit: hitGw.total_points } : null;
    })
    .filter(Boolean);
  return results.sort((a, b) => a.gwReached - b.gwReached);
}

// --- Manager of the Month ---
// monthGwMap: { "Aug": [1,2,3], "Sep": [4,5,6], ... }
export function managerOfTheMonth(histories, monthGwMap) {
  const results = {};
  for (const [month, gws] of Object.entries(monthGwMap)) {
    const scored = histories.map((m) => {
      const pts = m.history
        .filter((gw) => gws.includes(gw.event))
        .reduce((sum, gw) => sum + gw.points, 0); // gw.points already includes hits deducted
      return { entry: m.entry, entryName: m.entryName, points: pts };
    });
    scored.sort((a, b) => b.points - a.points);
    results[month] = scored;
  }
  return results;
}

// --- Highest Rank Jump over a month (needs overall_rank at month start/end) ---
export function rankJumpByMonth(histories, monthGwMap) {
  const results = {};
  for (const [month, gws] of Object.entries(monthGwMap)) {
    const firstGw = Math.min(...gws);
    const lastGw = Math.max(...gws);
    const scored = histories
      .map((m) => {
        const startRow = m.history.find((gw) => gw.event === firstGw - 1) || m.history.find((gw) => gw.event === firstGw);
        const endRow = m.history.find((gw) => gw.event === lastGw);
        if (!startRow || !endRow) return null;
        const jump = startRow.overall_rank - endRow.overall_rank; // positive = moved up
        return { entry: m.entry, entryName: m.entryName, jump, startRank: startRow.overall_rank, endRank: endRow.overall_rank };
      })
      .filter(Boolean);
    scored.sort((a, b) => b.jump - a.jump);
    results[month] = scored;
  }
  return results;
}

// --- Comeback King/Queen ---
// Requires: overall rank in the mini-league (not global FPL rank) at GW19 and GW38.
// You must snapshot the classic mini-league standings at GW19 yourself (see
// pages/api/lms/status.js pattern) since FPL doesn't retroactively give you
// "mini-league rank as of GW19" after the season has moved on - only current
// rank plus last_rank (one GW back). Snapshot is stored in league_config.gw19_snapshot.
export function comebackKing(gw19Snapshot, currentStandings, topHalfCutoffRank) {
  // gw19Snapshot / currentStandings: [{ entry, entryName, rank }]
  const startRankMap = new Map(gw19Snapshot.map((e) => [e.entry, e.rank]));
  const eligible = currentStandings.filter((e) => e.rank <= topHalfCutoffRank);
  const results = eligible
    .map((e) => {
      const startRank = startRankMap.get(e.entry);
      if (!startRank) return null;
      return { entry: e.entry, entryName: e.entryName, jump: startRank - e.rank, startRank, endRank: e.rank };
    })
    .filter(Boolean);
  return results.sort((a, b) => b.jump - a.jump);
}

// --- Least Transfer Cost (top half only) ---
export function leastTransferCost(histories, currentStandings, topHalfCutoffRank) {
  const eligibleIds = new Set(currentStandings.filter((e) => e.rank <= topHalfCutoffRank).map((e) => e.entry));
  const results = histories
    .filter((m) => eligibleIds.has(m.entry))
    .map((m) => {
      const totalHitCost = m.history.reduce((sum, gw) => sum + (gw.event_transfers_cost || 0), 0);
      return { entry: m.entry, entryName: m.entryName, hitCost: totalHitCost };
    });
  return results.sort((a, b) => a.hitCost - b.hitCost);
}

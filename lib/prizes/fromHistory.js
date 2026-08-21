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
// asOfGw, when given, uses that gameweek's value instead of the latest -
// this is what lets us compute "last week's leaderboard" to diff against
// today's for the rank-change arrows.
export function teamValue(histories, asOfGw = null) {
  const withValue = histories.map((m) => {
    const eligible = asOfGw ? m.history.filter((h) => h.event <= asOfGw) : m.history;
    const last = eligible[eligible.length - 1];
    return { entry: m.entry, entryName: m.entryName, value: last ? last.value / 10 : 0 };
  });
  return withValue.sort((a, b) => b.value - a.value);
}

// --- Bench Points (sum across the season) ---
export function benchPoints(histories, asOfGw = null) {
  const totals = histories.map((m) => {
    const eligible = asOfGw ? m.history.filter((h) => h.event <= asOfGw) : m.history;
    return {
      entry: m.entry,
      entryName: m.entryName,
      benchPoints: eligible.reduce((sum, gw) => sum + (gw.points_on_bench || 0), 0),
    };
  });
  return totals.sort((a, b) => b.benchPoints - a.benchPoints);
}

// --- First to X points (live basis - first GW where cumulative total crosses a threshold) ---
// Currently only used for First to 1499 - First to 999 was removed by request.
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
// monthGwMap: { "August": [1,2,3], "September": [4,5,6], ... } - built dynamically
// from live FPL gameweek deadline dates, see lib/monthCalendar.js.
export function managerOfTheMonth(histories, monthGwMap) {
  const results = {};
  for (const [month, gws] of Object.entries(monthGwMap)) {
    const scored = histories.map((m) => {
      const pts = m.history
        .filter((gw) => gws.includes(gw.event))
        .reduce((sum, gw) => sum + gw.points, 0); // gw.points already has hits deducted
      return { entry: m.entry, entryName: m.entryName, points: pts };
    });
    scored.sort((a, b) => b.points - a.points);
    results[month] = scored;
  }
  return results;
}

// --- Mini-league rank reconstruction ---
// This is the key fix: FPL's `overall_rank` field is your rank among every
// FPL player worldwide, not your rank inside this mini-league - using it
// for Rank Jump or Comeback King would be measuring the wrong thing
// entirely. Instead, since every manager's cumulative `total_points` at
// any past gameweek is already sitting in their history, we can
// reconstruct exactly where everyone stood *relative to each other* at
// any point in the season, on demand, with no live snapshot needed.
export function miniLeagueRankAtGw(histories, gw) {
  const rows = histories
    .map((m) => {
      const row = m.history.find((h) => h.event === gw);
      if (!row) return null;
      return { entry: m.entry, entryName: m.entryName, totalAtGw: row.total_points };
    })
    .filter(Boolean);
  rows.sort((a, b) => b.totalAtGw - a.totalAtGw);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

// --- Highest Rank Jump over a month (mini-league rank, not global FPL rank) ---
export function rankJumpByMonth(histories, monthGwMap) {
  const results = {};
  for (const [month, gws] of Object.entries(monthGwMap)) {
    const firstGw = Math.min(...gws);
    const lastGw = Math.max(...gws);
    const startRanks = miniLeagueRankAtGw(histories, firstGw - 1 >= 1 ? firstGw - 1 : firstGw);
    const endRanks = miniLeagueRankAtGw(histories, lastGw);
    const startMap = new Map(startRanks.map((r) => [r.entry, r.rank]));
    const endMap = new Map(endRanks.map((r) => [r.entry, r.rank]));

    const scored = histories
      .map((m) => {
        const startRank = startMap.get(m.entry);
        const endRank = endMap.get(m.entry);
        if (!startRank || !endRank) return null;
        return { entry: m.entry, entryName: m.entryName, jump: startRank - endRank, startRank, endRank };
      })
      .filter(Boolean)
      .filter((r) => r.jump > 0); // only managers who actually moved up are eligible, per your call
    scored.sort((a, b) => b.jump - a.jump);
    results[month] = scored;
  }
  return results;
}

// --- Comeback King/Queen ---
// GW19 and current/final mini-league rank, both reconstructed from history
// (see miniLeagueRankAtGw above) - no live snapshot required. Only
// managers finishing in the top half of the classic table are eligible.
export function comebackKing(histories, finalGw, topHalfCutoffRank) {
  const startRanks = miniLeagueRankAtGw(histories, 19);
  const endRanks = miniLeagueRankAtGw(histories, finalGw);
  const startMap = new Map(startRanks.map((r) => [r.entry, r.rank]));
  const eligibleEntries = endRanks.filter((r) => r.rank <= topHalfCutoffRank);

  const results = eligibleEntries
    .map((r) => {
      const startRank = startMap.get(r.entry);
      if (!startRank) return null;
      return { entry: r.entry, entryName: r.entryName, jump: startRank - r.rank, startRank, endRank: r.rank };
    })
    .filter(Boolean)
    .filter((r) => r.jump > 0); // only managers who actually moved up are eligible, per your call
  return results.sort((a, b) => b.jump - a.jump);
}

// --- Least Transfer Cost (top half only) ---
export function leastTransferCost(histories, currentStandings, topHalfCutoffRank, asOfGw = null) {
  const eligibleIds = new Set(currentStandings.filter((e) => e.rank <= topHalfCutoffRank).map((e) => e.entry));
  const results = histories
    .filter((m) => eligibleIds.has(m.entry))
    .map((m) => {
      const eligible = asOfGw ? m.history.filter((h) => h.event <= asOfGw) : m.history;
      const totalHitCost = eligible.reduce((sum, gw) => sum + (gw.event_transfers_cost || 0), 0);
      return { entry: m.entry, entryName: m.entryName, hitCost: totalHitCost };
    });
  return results.sort((a, b) => a.hitCost - b.hitCost);
}

// --- Wildcard Vision (5 GWs) ---
// Fully derivable from history + chips data already loaded for every other
// prize - no per-GW picks calls needed. Best of a manager's two wildcard
// activations this season, matching the chip-prize rule.
export function wildcardVision(histories) {
  const results = [];
  for (const m of histories) {
    const activations = (m.chips || []).filter((c) => c.name === "wildcard");
    let best = null;
    for (const act of activations) {
      const windowGws = [act.event, act.event + 1, act.event + 2, act.event + 3, act.event + 4];
      const rows = m.history.filter((h) => windowGws.includes(h.event));
      if (rows.length === 0) continue;
      const total = rows.reduce((sum, r) => sum + r.points, 0);
      const complete = rows.length === 5;
      if (!best || total > best.total) {
        best = { total, startGw: act.event, gwsCounted: rows.length, complete };
      }
    }
    if (best) {
      results.push({ entry: m.entry, entryName: m.entryName, ...best });
    }
  }
  return results.sort((a, b) => b.total - a.total);
}

// --- Captain Points (season total) ---
// Aggregates rows already recorded in captain_accuracy (populated by the
// admin-triggered captain accuracy check) - going-forward only, per your
// call, rather than backfilling the whole season in one expensive pass.
export function captainPointsLeaderboard(captainAccuracyRows) {
  const byEntry = new Map();
  for (const r of captainAccuracyRows) {
    if (!byEntry.has(r.entry_id)) {
      byEntry.set(r.entry_id, { entry: r.entry_id, entryName: r.entry_name, totalCaptainPoints: 0, gwsTracked: 0 });
    }
    const agg = byEntry.get(r.entry_id);
    agg.totalCaptainPoints += r.captain_points || 0;
    agg.gwsTracked += 1;
  }
  return Array.from(byEntry.values()).sort((a, b) => b.totalCaptainPoints - a.totalCaptainPoints);
}

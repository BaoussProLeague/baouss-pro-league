import { fpl } from "../fpl";
import { gwStatus } from "./liveScores";

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
// Same gap as MOTM/Wildcard Vision/First-to-1499/Comeback King: history
// doesn't have a row for the currently-live gameweek, so without this
// the season total silently excludes whatever's happening right now -
// exactly the discrepancy you caught (25 live this GW vs 19 shown as the
// season total, missing today's contribution entirely).
export function benchPoints(histories, asOfGw = null, currentGw = null, liveBenchMap = null) {
  const totals = histories.map((m) => {
    // Same fix as H2H: exclude the current gameweek's own row from the
    // base sum entirely rather than including it and only conditionally
    // adding live data - a placeholder row existing was silently
    // blocking the live add every time, since "the row exists" was
    // being read as "this GW is already accounted for."
    const eligible = (asOfGw ? m.history.filter((h) => h.event <= asOfGw) : m.history)
      .filter((h) => h.event !== currentGw);
    let total = eligible.reduce((sum, gw) => sum + (gw.points_on_bench || 0), 0);
    if (currentGw && liveBenchMap && liveBenchMap.has(m.entry) && (!asOfGw || currentGw <= asOfGw)) {
      total += liveBenchMap.get(m.entry).benchPoints;
    }
    return {
      entry: m.entry,
      entryName: m.entryName,
      benchPoints: total,
    };
  });
  return totals.sort((a, b) => b.benchPoints - a.benchPoints);
}

// --- First to X points (live basis - first GW where cumulative total crosses a threshold) ---
// Currently only used for First to 1499 - First to 999 was removed by request.
//
// Same reconstruction as everywhere else that needs "right now" accuracy:
// history doesn't have a row for the still-in-progress gameweek, so
// without this, someone crossing the threshold live wouldn't show up
// until that gameweek fully finishes - a real "race" prize showing a
// stale result is exactly the kind of thing worth getting right.
export function firstToThreshold(histories, threshold, currentGw = null, liveScoresMap = null, genuinelyLive = false) {
  const results = histories
    .map((m) => {
      // Exclude the current gameweek's own row from this search - same
      // reasoning as everywhere else: it may be a placeholder that
      // exists before any match has been played, and total_points being
      // a cumulative field means a stale placeholder could look like a
      // real crossing when it isn't yet. The live-reconstructed check
      // below is what actually handles the current gameweek correctly.
      const hitGw = m.history.find((gw) => gw.event !== currentGw && gw.total_points >= threshold);
      if (hitGw) {
        return { entry: m.entry, entryName: m.entryName, gwReached: hitGw.event, totalAtHit: hitGw.total_points };
      }
      // Not crossed yet as of the last finalized GW - check whether
      // today's live score pushes them over it right now.
      if (currentGw && liveScoresMap && liveScoresMap.has(m.entry)) {
        const prevRow = m.history.find((h) => h.event === currentGw - 1);
        const prevTotal = prevRow ? prevRow.total_points : 0;
        const liveTotal = prevTotal + liveScoresMap.get(m.entry).points;
        if (liveTotal >= threshold) {
          // Same fix as the chip prizes: "isLive" must mean a match is
          // genuinely in progress right now, not just "this used the
          // live-patched calculation path" - that path stays the
          // correct source of truth for days after the gameweek itself
          // has actually finished.
          return { entry: m.entry, entryName: m.entryName, gwReached: currentGw, totalAtHit: liveTotal, isLive: genuinelyLive };
        }
      }
      return null;
    })
    .filter(Boolean);
  return results.sort((a, b) => a.gwReached - b.gwReached);
}

// --- Manager of the Month ---
// monthGwMap: { "August": [1,2,3], "September": [4,5,6], ... } - built dynamically
// from live FPL gameweek deadline dates, see lib/monthCalendar.js.
export function managerOfTheMonth(histories, monthGwMap, currentGw = null, liveScoresMap = null) {
  const results = {};
  for (const [month, gws] of Object.entries(monthGwMap)) {
    const scored = histories.map((m) => {
      // Same bug as Mega GW and everything else that needs "right now"
      // accuracy: history doesn't have a row for the still-in-progress
      // gameweek yet, so it's excluded from the sum here and the live
      // score (proven correct against Classic standings) is added in
      // its place instead.
      let pts = m.history
        .filter((gw) => gws.includes(gw.event) && gw.event !== currentGw)
        .reduce((sum, gw) => sum + gw.points, 0);
      if (currentGw && gws.includes(currentGw) && liveScoresMap && liveScoresMap.has(m.entry)) {
        pts += liveScoresMap.get(m.entry).points;
      }
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
export function miniLeagueRankAtGw(histories, gw, currentGw = null, liveScoresMap = null) {
  const rows = histories
    .map((m) => {
      let totalAtGw;
      if (gw === currentGw && liveScoresMap && liveScoresMap.has(m.entry)) {
        // Same live-score substitution as everywhere else: reconstruct
        // this GW's cumulative total from the last FINALIZED total (from
        // history, which is trustworthy) plus this GW's live score -
        // rather than looking for a history row that doesn't exist yet
        // for a still-in-progress gameweek. Without this, the entire
        // current month's Rank Jump silently came back empty, not just
        // wrong - every manager's endRank lookup failed at once.
        const prevRow = m.history.find((h) => h.event === gw - 1);
        const prevTotal = prevRow ? prevRow.total_points : 0;
        totalAtGw = prevTotal + liveScoresMap.get(m.entry).points;
      } else {
        const row = m.history.find((h) => h.event === gw);
        if (!row) return null;
        totalAtGw = row.total_points;
      }
      return { entry: m.entry, entryName: m.entryName, totalAtGw };
    })
    .filter(Boolean);
  rows.sort((a, b) => b.totalAtGw - a.totalAtGw);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

// --- Highest Rank Jump over a month (mini-league rank, not global FPL rank) ---
export function rankJumpByMonth(histories, monthGwMap, events, currentGw = null, liveScoresMap = null) {
  const results = {};
  // Chronological order matters here - each month's baseline is
  // specifically "the previous calendar month," not just "one gameweek
  // earlier."
  const months = Object.entries(monthGwMap).sort(([, gwsA], [, gwsB]) => Math.min(...gwsA) - Math.min(...gwsB));

  for (let i = 0; i < months.length; i++) {
    const [month, gws] = months[i];

    if (i === 0) {
      // The season's first calendar month has no prior month to jump
      // from - there's no valid baseline, so this prize genuinely
      // doesn't exist for it yet, not just "no data yet." First eligible
      // month is the second one, using month 1's final standings as the
      // baseline.
      results[month] = [];
      continue;
    }

    const [, prevGws] = months[i - 1];
    const baselineGw = Math.max(...prevGws); // last GW of the previous month
    const lastGw = Math.max(...gws);

    // The baseline only locks once that gameweek is genuinely, fully
    // complete (same strict standard as everywhere else that had to
    // learn this the hard way) - not just "chronologically in the past."
    const baselineEvent = events.find((e) => e.id === baselineGw);
    const baselineLocked = baselineEvent && gwStatus(baselineEvent) === "completed";
    if (!baselineLocked) {
      results[month] = [];
      continue;
    }

    const startRanks = miniLeagueRankAtGw(histories, baselineGw, currentGw, liveScoresMap);
    const endRanks = miniLeagueRankAtGw(histories, lastGw, currentGw, liveScoresMap);
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
// (see miniLeagueRankAtGw above). Only managers finishing in the top half
// of the classic table are eligible.
//
// currentGw/liveScoresMap matter here more than they look: without them,
// asking for the currently-live gameweek's rank returns nothing at all
// for every single manager at once (the history row for an in-progress
// GW doesn't exist yet) - so during any live gameweek after GW19, this
// entire prize would show zero results, not just stale ones.
export function comebackKing(histories, finalGw, topHalfCutoffRank, currentGw = null, liveScoresMap = null) {
  const startRanks = miniLeagueRankAtGw(histories, 19, currentGw, liveScoresMap);
  const endRanks = miniLeagueRankAtGw(histories, finalGw, currentGw, liveScoresMap);
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
//
// Same gap as everywhere else: if the 5-GW window includes the currently
// live gameweek, that GW's contribution is missing from history and the
// running total silently undercounts until the GW finishes.
export function wildcardVision(histories, currentGw = null, liveScoresMap = null) {
  const results = [];
  for (const m of histories) {
    const activations = (m.chips || []).filter((c) => c.name === "wildcard");
    let best = null;
    for (const act of activations) {
      const windowGws = [act.event, act.event + 1, act.event + 2, act.event + 3, act.event + 4];
      // Same fix as everywhere else: exclude the current gameweek's row
      // from the base sum before adding live data, rather than summing
      // it in and only conditionally topping up - a placeholder row was
      // silently short-circuiting the live add every time.
      const rows = m.history.filter((h) => windowGws.includes(h.event) && h.event !== currentGw);
      let total = rows.reduce((sum, r) => sum + r.points, 0);
      let gwsCounted = rows.length;
      if (currentGw && windowGws.includes(currentGw) && liveScoresMap && liveScoresMap.has(m.entry)) {
        total += liveScoresMap.get(m.entry).points;
        gwsCounted += 1;
      }
      if (gwsCounted === 0) continue;
      const complete = gwsCounted === 5;
      if (!best || total > best.total) {
        best = { total, startGw: act.event, gwsCounted, complete };
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
      byEntry.set(r.entry_id, { entry: r.entry_id, entryName: r.entry_name, totalCaptainPoints: 0, gwsTracked: 0, tripleCaptainCount: 0 });
    }
    const agg = byEntry.get(r.entry_id);
    // Fall back to the raw x2 for any older row recorded before this was
    // tracked separately - only the going-forward rows get the real
    // multiplier (including x3 for Triple Captain), same as any other
    // going-forward-only admin data in this app.
    const awarded = r.captain_awarded_points ?? (r.captain_points || 0) * 2;
    agg.totalCaptainPoints += awarded;
    agg.gwsTracked += 1;
    if (r.captain_multiplier === 3) agg.tripleCaptainCount += 1;
  }
  return Array.from(byEntry.values()).sort((a, b) => b.totalCaptainPoints - a.totalCaptainPoints);
}

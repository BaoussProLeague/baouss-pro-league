// Most Points from Def + GK: needs to know which of each manager's 15
// picks were goalkeepers or defenders, and how many points those specific
// players scored that gameweek including their multiplier (so a defender
// captaincy counts double, matching what actually landed in the manager's
// total). Bench players ARE included per the rules doc ("bench players
// considered") - this is the one prize that genuinely can't be derived
// from bulk history data, hence going-forward-only per your call.

import { fpl } from "../fpl";

export async function computeGwDefGk(entries, gw, elementTypeById) {
  const live = await fpl.eventLive(gw);
  const livePointsByElement = new Map(live.elements.map((el) => [el.id, el.stats.total_points]));

  const results = [];
  for (const m of entries) {
    const picks = await fpl.entryPicks(m.entry, gw);
    const picksList = picks.picks || [];
    let total = 0;
    for (const p of picksList) {
      const type = elementTypeById.get(p.element); // 1 = GK, 2 = DEF
      if (type === 1 || type === 2) {
        const base = livePointsByElement.get(p.element) || 0;
        total += base * (p.multiplier || 1);
      }
    }
    results.push({ entry: m.entry, entryName: m.entryName, gw, points: total });
  }
  return results;
}

export function defGkLeaderboard(rows) {
  const byEntry = new Map();
  for (const r of rows) {
    if (!byEntry.has(r.entry_id)) {
      byEntry.set(r.entry_id, { entry: r.entry_id, entryName: r.entry_name, totalPoints: 0, gwsTracked: 0 });
    }
    const agg = byEntry.get(r.entry_id);
    agg.totalPoints += r.points || 0;
    agg.gwsTracked += 1;
  }
  return Array.from(byEntry.values()).sort((a, b) => b.totalPoints - a.totalPoints);
}

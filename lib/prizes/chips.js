// This season (2026/27) every manager gets 2 sets of chips - one usable
// before the GW19 deadline, one after. Per your call: each chip prize
// (Wildcard / Free Hit / Triple Captain / Bench Boost) has ONE winner,
// taken as the best of a manager's up-to-two activations of that chip.
//
// FPL's entry history response already includes a `chips` array
// ([{ name, event, time }]) for each manager at no extra API cost - so
// this reuses the same `histories` data loaded for every other prize
// (see loadAllHistories in fromHistory.js), no per-GW picks calls needed.

const CHIP_NAMES = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  "3xc": "Triple Captain",
  bboost: "Bench Boost",
};

export function chipPrizes(histories) {
  const results = {};

  for (const chipKey of Object.keys(CHIP_NAMES)) {
    const contenders = [];

    for (const m of histories) {
      const activations = (m.chips || []).filter((c) => c.name === chipKey);
      if (activations.length === 0) continue;

      let best = null;
      for (const act of activations) {
        const gwRow = m.history.find((h) => h.event === act.event);
        if (!gwRow) continue;
        const score = gwRow.points; // includes hits, per your rules doc
        if (!best || score > best.score) {
          best = { score, gw: act.event };
        }
      }
      if (best) {
        contenders.push({
          entry: m.entry,
          entryName: m.entryName,
          score: best.score,
          gw: best.gw,
          activationsCount: activations.length,
        });
      }
    }

    contenders.sort((a, b) => b.score - a.score);
    results[chipKey] = { label: CHIP_NAMES[chipKey], leaderboard: contenders };
  }

  return results;
}

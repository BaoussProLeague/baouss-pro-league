// A Mega GW's winner is just "highest net score that specific gameweek",
// which is already sitting in the same history data every other live
// prize uses - no extra API calls needed. What's actually admin-managed
// is *which* gameweeks count as Mega GWs (announced ahead of time per the
// rules doc), not the winner calculation itself.

export function megaGwResults(megaGwRows, histories) {
  return megaGwRows.map((mg) => {
    const scored = histories
      .map((m) => {
        const row = m.history.find((h) => h.event === mg.gw);
        if (!row) return null;
        return { entry: m.entry, entryName: m.entryName, points: row.points };
      })
      .filter(Boolean);
    scored.sort((a, b) => b.points - a.points);

    return {
      id: mg.id,
      gw: mg.gw,
      label: mg.label,
      prizeAmountInr: mg.prize_amount_inr,
      status: scored.length > 0 ? "completed" : "upcoming",
      leaderboard: scored.slice(0, 5),
    };
  });
}

// Groups gameweeks into calendar months using each event's actual deadline
// date from FPL's bootstrap-static - never hand-typed, so postponements,
// rearranged fixtures, or a season starting a week later than usual (like
// 2026/27) are automatically reflected instead of silently going stale.
//
// A gameweek is counted as part of the month its deadline falls in, per
// the rules doc ("GameWeek is considered to be part of the month in which
// it begins").

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function buildMonthGwMap(events) {
  const map = {}; // preserves insertion order, which will be chronological
  const sorted = [...events].sort((a, b) => a.id - b.id);

  for (const ev of sorted) {
    if (!ev.deadline_time) continue;
    const d = new Date(ev.deadline_time);
    const label = `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    if (!map[label]) map[label] = [];
    map[label].push(ev.id);
  }
  return map;
}

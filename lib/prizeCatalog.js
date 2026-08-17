// Every prize from the rules doc, plus Mega GW and Perfect Captaincy.
// `status` is honest about how each one is actually calculated:
//   'live'  = fully automatic, recalculated on every page load
//   'admin' = automatic, but needs an admin action to advance (LMS, H2H,
//             Captain Points, Def+GK) - going forward from whenever it's
//             first run, not backfilled
//   'planned' = in the rules, not built yet

export const PRIZE_CATALOG = [
  {
    key: "classic",
    label: "Classic League",
    status: "live",
    description:
      "The season-long leaderboard. Whoever finishes with the highest overall score - including every point lost to hits - takes it. The top 8 finishers are paid, and a tie is broken using the Set Rules order.",
  },
  {
    key: "lms",
    label: "Last Manager Standing + Rebuy",
    status: "admin",
    description:
      "A weekly knockout starting GW2: whoever scores lowest that gameweek (hits included) is out, until one manager is left standing. Anyone eliminated on or before GW21 can buy back in for ₹500 during the GW22-24 break, rejoining alongside whoever survived GW21 when play resumes at GW25. A tied lowest score is broken by the Set Rules order, and the loser of that tie is the one eliminated.",
  },
  {
    key: "h2h",
    label: "Head-to-Head League",
    status: "live",
    description:
      "Every manager plays a Champions League-style group stage against 29 random opponents through GW30. The top 32 split into a Gold Cup (ranks 1-16) and a Silver Cup (ranks 17-32), then it's straight knockout: Round of 16 at GW32, Quarter-Finals GW34, Semi-Finals GW36, and both Finals on GW38.",
  },
  {
    key: "teamValue",
    label: "Team Value",
    status: "live",
    description:
      "Whoever's squad is worth the most money at the end of the season wins. This rewards the manager who spotted rising players early and let their price growth quietly build value all year.",
  },
  {
    key: "captainPoints",
    label: "Captain Points",
    status: "admin",
    description:
      "The manager whose captain has earned the most points in total across the season, Triple Captain gameweeks included. This rewards consistently correct armband decisions, not just one big week. Tracked from whenever the admin first runs the captain check - earlier gameweeks aren't backfilled.",
  },
  {
    key: "megaGw",
    label: "Mega GW",
    status: "admin",
    description:
      "Specific gameweeks, announced at least one week ahead, where the highest net score (hits and any chip included) wins - regardless of where that manager sits in the overall table. Any number of Mega GWs can run across the season.",
  },
  {
    key: "wildcard",
    label: "Wildcard Chip",
    status: "live",
    description:
      "Highest score in the exact gameweek a Wildcard is activated. Everyone gets two Wildcards this season (one per half) - this prize takes the better of your two attempts.",
  },
  {
    key: "tripleCaptain",
    label: "Triple Captain Chip",
    status: "live",
    description:
      "Highest score in the gameweek a Triple Captain chip is played. Best of your two activations across the season.",
  },
  {
    key: "benchBoost",
    label: "Bench Boost Chip",
    status: "live",
    description:
      "Highest score in the gameweek a Bench Boost chip is played. Best of your two activations across the season.",
  },
  {
    key: "freeHit",
    label: "Free Hit Chip",
    status: "live",
    description:
      "Highest score in the gameweek a Free Hit chip is played. Best of your two activations across the season.",
  },
  {
    key: "comebackKing",
    label: "Comeback King/Queen",
    status: "live",
    description:
      "Whoever climbs the most places in the mini-league table between the end of GW19 and the end of the season wins - the biggest second-half turnaround. Only managers finishing in the top half of the final Classic table are eligible, and only an actual improvement counts - a manager who dropped or stayed level isn't in contention that period.",
  },
  {
    key: "leastTransferCost",
    label: "Least Transfer Cost (top half)",
    status: "live",
    description:
      "Among managers who finish in the top half of the Classic table, whoever loses the fewest points to extra-transfer hits across the whole season wins. Rewards patient, well-planned squad building over panic transfers.",
  },
  {
    key: "benchPoints",
    label: "Bench Points",
    status: "live",
    description:
      "The season-long total of points stranded on the bench, added up gameweek by gameweek after auto-substitutions are applied. Not a prize anyone's chasing on purpose - it just finds the manager whose bench quietly cost them the most.",
  },
  {
    key: "first999",
    label: "First to 999 Points",
    status: "live",
    description: "Whoever's cumulative score crosses 999 points first, tracked live as results come in.",
  },
  {
    key: "first1499",
    label: "First to 1499 Points",
    status: "live",
    description: "Whoever's cumulative score crosses 1499 points first, tracked live as results come in.",
  },
  {
    key: "wildcardVision",
    label: "Wildcard Vision (5 GWs)",
    status: "live",
    description:
      "Measures the payoff of a Wildcard, not just the week it's played: total points across the Wildcard gameweek and the four that follow. If a Wildcard is played too late for the full 5 gameweeks to finish before the season ends, that window still competes as 'in progress' rather than being excluded. Best of your two Wildcard windows this season.",
  },
  {
    key: "defGk",
    label: "Most Points from Def + GK",
    status: "admin",
    description:
      "Whoever's Defenders and Goalkeepers - bench included - have contributed the most points to their total across the season. A captained defender or goalkeeper's points count double, same as they would in your overall score. Tracked from whenever the admin first runs this check; earlier gameweeks aren't backfilled.",
  },
  {
    key: "rankJumpMonth",
    label: "Highest Rank Jump (per month)",
    status: "live",
    description:
      "For each calendar month, whoever climbs the most places in the mini-league table - measured against each other, not against the whole of FPL - takes that month's prize. Only an actual improvement counts; if nobody moved up that month, there's no winner for it.",
  },
  {
    key: "motm",
    label: "Manager of the Month",
    status: "live",
    description:
      "The highest points total (hits and chips included) within a single calendar month wins that month. A gameweek belongs to whichever month it kicks off in, per FPL's own schedule.",
  },
  {
    key: "perfectCaptaincy",
    label: "Perfect Captaincy",
    status: "admin",
    description:
      "Counts the gameweeks where your captain pick was genuinely your best-performing player in the starting XI that week - not just a high scorer, the actual top scorer. Rewards reading the week correctly, not just owning good players. Tracked from whenever the admin first runs this check.",
  },
];

export function statusLabel(status) {
  if (status === "live") return { text: "Live", className: "pill alive" };
  if (status === "admin") return { text: "Admin-updated", className: "pill admin" };
  return { text: "Not yet tracked", className: "pill out" };
}

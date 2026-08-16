// Every prize from the rules doc, plus Perfect Captaincy. `status` says
// honestly whether it's calculated live, or still needs building - shown
// on the Prizes page so nothing is silently missing.
//
// status: 'live' = calculated automatically right now
//         'admin' = calculated, but needs an admin action to update (LMS, captaincy, H2H bracket)
//         'planned' = in the rules, not built yet

export const PRIZE_CATALOG = [
  {
    key: "classic",
    label: "Classic League",
    status: "live",
    description:
      "Managers with the highest overall score (including hits for extra transfers) at the end of the season win. Top 8 places get paid. Ties resolved by Set Rules.",
  },
  {
    key: "lms",
    label: "Last Manager Standing + Rebuy",
    status: "admin",
    description:
      "Starts GW2. Each GW the lowest scorer (including hits) is eliminated, until one manager remains. Eliminated on/before GW21 can rebuy for ₹500 - break GW22-24, LMS resumes GW25 with rebuys plus GW21 survivors. Ties eliminate the loser per Set Rules.",
  },
  {
    key: "h2h",
    label: "Head-to-Head League",
    status: "live",
    description:
      "All teams in one H2H league (random order) through GW30. Top 32 split into Gold Cup (rank 1-16) and Silver Cup (rank 17-32), then single-leg knockouts: R16 (GW32) → QF (GW34) → SF (GW36) → Final (GW38).",
  },
  {
    key: "teamValue",
    label: "Team Value",
    status: "live",
    description:
      "Highest team value at end of season wins - rewards long-term vision in transfers that increase your squad's price over the year.",
  },
  {
    key: "captainPoints",
    label: "Captain Points",
    status: "planned",
    description:
      "Highest sum of captain points across the whole season, including Triple Captain points. Rewards consistently correct captain picks.",
  },
  {
    key: "megaGw",
    label: "Mega GW",
    status: "planned",
    description:
      "Highest score in specific pre-announced gameweeks, announced at least one GW ahead. Chips and Wildcard use is allowed and included net of hits. Any manager can win regardless of overall rank.",
  },
  {
    key: "wildcard",
    label: "Wildcard Chip",
    status: "live",
    description:
      "Highest score in the gameweek your Wildcard was activated. This season you get 2 wildcards (one per half) - the prize takes the best of your two activations.",
  },
  {
    key: "tripleCaptain",
    label: "Triple Captain Chip",
    status: "live",
    description:
      "Highest score in the gameweek your Triple Captain was activated. Best of your two activations this season.",
  },
  {
    key: "benchBoost",
    label: "Bench Boost Chip",
    status: "live",
    description:
      "Highest score in the gameweek your Bench Boost was activated. Best of your two activations this season.",
  },
  {
    key: "freeHit",
    label: "Free Hit Chip",
    status: "live",
    description:
      "Highest score in the gameweek your Free Hit was activated. Best of your two activations this season.",
  },
  {
    key: "comebackKing",
    label: "Comeback King/Queen",
    status: "planned",
    description:
      "Biggest positive jump in mini-league ranking from a GW19 snapshot to end of season. Only managers finishing in the top half of the classic table are eligible.",
  },
  {
    key: "leastTransferCost",
    label: "Least Transfer Cost (top half)",
    status: "live",
    description:
      "Fewest points lost to extra-transfer hits across the season, among managers who finish in the top half of the classic table. Rewards judicious planning.",
  },
  {
    key: "benchPoints",
    label: "Bench Points",
    status: "live",
    description:
      "Most points left on the bench across the whole season, GW1 to GW38, after auto-subs are applied. The unlucky-manager prize.",
  },
  {
    key: "first999",
    label: "First to 999 Points",
    status: "live",
    description: "First manager to reach 999 overall points, calculated live as the season progresses.",
  },
  {
    key: "first1499",
    label: "First to 1499 Points",
    status: "live",
    description: "First manager to reach 1499 overall points, calculated live as the season progresses.",
  },
  {
    key: "wildcardVision",
    label: "Wildcard Vision (5 GWs)",
    status: "planned",
    description:
      "Highest total across the Wildcard-activated GW plus the following 4 gameweeks. Rewards picking a squad with staying power, not just a one-week spike.",
  },
  {
    key: "defGk",
    label: "Most Points from Def + GK",
    status: "planned",
    description: "Most points scored by your Defenders and Goalkeepers combined, bench players included.",
  },
  {
    key: "rankJumpMonth",
    label: "Highest Rank Jump (per month)",
    status: "planned",
    description: "Biggest positive jump in Classic League ranking during each FPL calendar month.",
  },
  {
    key: "motm",
    label: "Manager of the Month",
    status: "planned",
    description:
      "Highest overall points (including hits and chips) for a given calendar month. GW is counted in the month it begins, per the official FPL calendar.",
  },
  {
    key: "perfectCaptaincy",
    label: "Perfect Captaincy",
    status: "admin",
    description:
      "Most gameweeks where your captain was actually your starting XI's top scorer that week - rewards captaincy accuracy, not just raw captain points.",
  },
];

export function statusLabel(status) {
  if (status === "live") return { text: "Live", className: "pill alive" };
  if (status === "admin") return { text: "Admin-updated", className: "pill" };
  return { text: "Not yet tracked", className: "pill out" };
}

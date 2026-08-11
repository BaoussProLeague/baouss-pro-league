// Server-side only. Never import this from a page component directly -
// always call it from pages/api/* so requests originate from the server,
// not the browser (the public FPL API does not send CORS headers, so
// direct browser fetches to fantasy.premierleague.com will fail).

const BASE = "https://fantasy.premierleague.com/api";

async function fplFetch(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      // FPL blocks requests with no user-agent on some edge nodes
      "User-Agent": "Mozilla/5.0 (BaoussProLeague/1.0)",
      Accept: "application/json",
    },
    // Cache bootstrap-static for a few minutes, live data should stay fresh
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`FPL API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const fpl = {
  // Master data: all players, teams, gameweeks (events), current GW
  bootstrap: () => fplFetch("/bootstrap-static/"),

  // Classic (overall points) league standings, paginated
  classicStandings: (leagueId, page = 1) =>
    fplFetch(`/leagues-classic/${leagueId}/standings/?page_standings=${page}`),

  // H2H league standings, paginated
  h2hStandings: (leagueId, page = 1) =>
    fplFetch(`/leagues-h2h/${leagueId}/standings/?page_standings=${page}`),

  // H2H fixtures/results for a given GW (used to build knockout rounds manually)
  h2hMatches: (leagueId, page = 1) =>
    fplFetch(`/leagues-h2h-matches/league/${leagueId}/?page=${page}`),

  // Single manager: overall history, GW-by-GW (points, bench points, value, transfers, rank)
  entryHistory: (entryId) => fplFetch(`/entry/${entryId}/history/`),

  // Single manager: basic profile
  entry: (entryId) => fplFetch(`/entry/${entryId}/`),

  // Single manager's picks + chip used + captain, for one GW
  entryPicks: (entryId, gw) => fplFetch(`/entry/${entryId}/event/${gw}/picks/`),

  // Live points for every player in a GW (needed for Def+GK, Mega GW verification)
  eventLive: (gw) => fplFetch(`/event/${gw}/live/`),

  // Fetch every page of classic standings (leagues can have >50 entries, paginated)
  allClassicEntries: async (leagueId) => {
    let page = 1;
    let entries = [];
    let hasNext = true;
    let leagueInfo = null;
    while (hasNext) {
      const data = await fpl.classicStandings(leagueId, page);
      leagueInfo = data.league;
      entries = entries.concat(data.standings.results);
      hasNext = data.standings.has_next;
      page += 1;
    }
    return { league: leagueInfo, entries };
  },

  allH2hEntries: async (leagueId) => {
    let page = 1;
    let entries = [];
    let hasNext = true;
    let leagueInfo = null;
    while (hasNext) {
      const data = await fpl.h2hStandings(leagueId, page);
      leagueInfo = data.league;
      entries = entries.concat(data.standings.results);
      hasNext = data.standings.has_next;
      page += 1;
    }
    return { league: leagueInfo, entries };
  },
};

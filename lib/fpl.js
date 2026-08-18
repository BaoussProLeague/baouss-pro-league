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

  // All fixtures for a given GW - kickoff times, live/finished status, scores
  fixtures: (gw) => fplFetch(`/fixtures/?event=${gw}`),

  // Fetch every page of classic standings (leagues can have >50 entries, paginated)
  allClassicEntries: async (leagueId) => {
    // FPL splits classic league members into two lists: `standings` for
    // managers who've had at least one scored gameweek, and `new_entries`
    // for managers who've joined but not played one yet. Pre-season,
    // EVERY manager sits in new_entries - reading only `standings` (as
    // this used to) looks technically correct but returns zero people
    // until GW1 actually finishes. Both need paginating and merging.
    let page = 1;
    let standingsEntries = [];
    let hasNextStandings = true;
    let leagueInfo = null;
    while (hasNextStandings) {
      const data = await fpl.classicStandings(leagueId, page);
      leagueInfo = data.league;
      standingsEntries = standingsEntries.concat(data.standings.results);
      hasNextStandings = data.standings.has_next;
      page += 1;
    }

    let newPage = 1;
    let newEntries = [];
    let hasNextNew = true;
    while (hasNextNew) {
      const data = await fpl.classicStandings(leagueId, newPage);
      newEntries = newEntries.concat(data.new_entries?.results || []);
      hasNextNew = data.new_entries?.has_next || false;
      newPage += 1;
    }

    // Managers with a scored gameweek take priority (they have real
    // rank/total data); anyone still only in new_entries gets sensible
    // zero-defaults so the rest of the app doesn't break on missing fields.
    const seen = new Set(standingsEntries.map((e) => e.entry));
    const newOnly = newEntries
      .filter((e) => !seen.has(e.entry))
      .map((e) => ({
        entry: e.entry,
        entry_name: e.entry_name,
        player_name: e.player_name || `${e.player_first_name || ""} ${e.player_last_name || ""}`.trim(),
        rank: null,
        last_rank: null,
        total: 0,
        event_total: 0,
      }));

    return { league: leagueInfo, entries: [...standingsEntries, ...newOnly] };
  },

  allH2hEntries: async (leagueId) => {
    // Same pre-season gap as classic: managers with no H2H matches
    // played yet sit in new_entries, not standings.
    let page = 1;
    let standingsEntries = [];
    let hasNextStandings = true;
    let leagueInfo = null;
    while (hasNextStandings) {
      const data = await fpl.h2hStandings(leagueId, page);
      leagueInfo = data.league;
      standingsEntries = standingsEntries.concat(data.standings.results);
      hasNextStandings = data.standings.has_next;
      page += 1;
    }

    let newPage = 1;
    let newEntries = [];
    let hasNextNew = true;
    while (hasNextNew) {
      const data = await fpl.h2hStandings(leagueId, newPage);
      newEntries = newEntries.concat(data.new_entries?.results || []);
      hasNextNew = data.new_entries?.has_next || false;
      newPage += 1;
    }

    const seen = new Set(standingsEntries.map((e) => e.entry));
    const newOnly = newEntries
      .filter((e) => !seen.has(e.entry))
      .map((e) => ({
        entry: e.entry,
        entry_name: e.entry_name,
        player_name: e.player_name || `${e.player_first_name || ""} ${e.player_last_name || ""}`.trim(),
        rank: null,
        rank_sort: null,
        total: 0,
        matches_played: 0,
        matches_won: 0,
        matches_drawn: 0,
        matches_lost: 0,
        points_for: 0,
      }));

    return { league: leagueInfo, entries: [...standingsEntries, ...newOnly] };
  },
};

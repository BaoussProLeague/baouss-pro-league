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
    // Live scores, fixture status, and the PL table must never be
    // cached - our own 60s client refresh already controls request
    // frequency, and Next.js's serverless caching layer was serving
    // stale responses far longer than intended (the stuck LIVE tag and
    // the PL table not reflecting a finished match both traced back to
    // this). Every FPL call is now always fetched fresh.
    cache: "no-store",
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
  // FPL's league standings endpoint actually paginates two independent
  // lists in one response - `standings` (managers with a scored GW) via
  // page_standings, and `new_entries` (joined but not yet scored) via a
  // SEPARATE param, page_new_entries. Both accepted together in one call.
  classicStandings: (leagueId, page = 1, newEntriesPage = 1) =>
    fplFetch(`/leagues-classic/${leagueId}/standings/?page_standings=${page}&page_new_entries=${newEntriesPage}`),

  // H2H league standings, paginated
  h2hStandings: (leagueId, page = 1, newEntriesPage = 1) =>
    fplFetch(`/leagues-h2h/${leagueId}/standings/?page_standings=${page}&page_new_entries=${newEntriesPage}`),

  // H2H fixtures/results for a given GW (used to build knockout rounds manually)
  h2hMatches: (leagueId, page = 1) =>
    fplFetch(`/leagues-h2h-matches/league/${leagueId}/?page=${page}`),

  // Every match ever played in the H2H league, all pages - needed to
  // reconstruct standings as of any past gameweek (see h2hSnapshot.js).
  allH2hMatches: async (leagueId) => {
    const MAX_PAGES = 100; // generous cap - a full season of H2H matches across a large league
    let page = 1;
    let matches = [];
    let hasNext = true;
    while (hasNext && page <= MAX_PAGES) {
      const data = await fpl.h2hMatches(leagueId, page);
      matches = matches.concat(data.results || []);
      hasNext = data.has_next || false;
      page += 1;
    }
    return matches;
  },

  // Single manager: overall history, GW-by-GW (points, bench points, value, transfers, rank)
  entryHistory: (entryId) => fplFetch(`/entry/${entryId}/history/`),

  // Single manager: basic profile
  entry: (entryId) => fplFetch(`/entry/${entryId}/`),

  // Single manager's picks + chip used + captain, for one GW
  entryPicks: (entryId, gw) => fplFetch(`/entry/${entryId}/event/${gw}/picks/`),

  // Full season history, upcoming fixtures, and career summary for one
  // player - powers the player detail page.
  elementSummary: (elementId) => fplFetch(`/element-summary/${elementId}/`),

  // Live points for every player in a GW (needed for Def+GK, Mega GW verification)
  eventLive: (gw) => fplFetch(`/event/${gw}/live/`),

  // All fixtures for a given GW - kickoff times, live/finished status, scores
  fixtures: (gw) => fplFetch(`/fixtures/?event=${gw}`),

  // Every fixture in the season, unfiltered - needed to compute the real
  // Premier League table (W/D/L/GF/GA/GD/Pts) from actual results rather
  // than trusting FPL's own precomputed team fields, which turned out to
  // lag behind individual fixture results.
  allFixtures: () => fplFetch(`/fixtures/`),

  // Fetch every page of classic standings (leagues can have >50 entries, paginated)
  allClassicEntries: async (leagueId) => {
    // FPL splits classic league members into two lists: `standings` for
    // managers who've had at least one scored gameweek, and `new_entries`
    // for managers who've joined but not played one yet. Pre-season,
    // EVERY manager sits in new_entries - reading only `standings` (as
    // this used to) looks technically correct but returns zero people
    // until GW1 actually finishes. Both need paginating and merging.
    //
    // Each list paginates via its OWN query param (page_standings vs
    // page_new_entries) - conflating them previously caused an infinite
    // loop once a league had enough managers to need more than one
    // new_entries page. MAX_PAGES is a hard backstop: no matter what FPL's
    // API does, this can never hang indefinitely again.
    const MAX_PAGES = 40; // 40 x 50 = 2000 entries, far beyond any realistic league size

    let page = 1;
    let standingsEntries = [];
    let hasNextStandings = true;
    let leagueInfo = null;
    while (hasNextStandings && page <= MAX_PAGES) {
      const data = await fpl.classicStandings(leagueId, page, 1);
      leagueInfo = data.league;
      standingsEntries = standingsEntries.concat(data.standings.results);
      hasNextStandings = data.standings.has_next;
      page += 1;
    }

    let newPage = 1;
    let newEntries = [];
    let hasNextNew = true;
    while (hasNextNew && newPage <= MAX_PAGES) {
      const data = await fpl.classicStandings(leagueId, 1, newPage);
      leagueInfo = leagueInfo || data.league;
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
    // played yet sit in new_entries, not standings. Same fix, same
    // hard cap - see allClassicEntries above for the full explanation.
    const MAX_PAGES = 40;

    let page = 1;
    let standingsEntries = [];
    let hasNextStandings = true;
    let leagueInfo = null;
    while (hasNextStandings && page <= MAX_PAGES) {
      const data = await fpl.h2hStandings(leagueId, page, 1);
      leagueInfo = data.league;
      standingsEntries = standingsEntries.concat(data.standings.results);
      hasNextStandings = data.standings.has_next;
      page += 1;
    }

    let newPage = 1;
    let newEntries = [];
    let hasNextNew = true;
    while (hasNextNew && newPage <= MAX_PAGES) {
      const data = await fpl.h2hStandings(leagueId, 1, newPage);
      leagueInfo = leagueInfo || data.league;
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

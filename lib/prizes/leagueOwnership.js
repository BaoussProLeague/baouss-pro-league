import { supabaseAdmin } from "../supabase";
import { fpl } from "../fpl";

// How many managers' picks to fetch at once. Keeps us well clear of FPL
// rate limits and of the serverless function's time budget.
const CHUNK_SIZE = 8;

// Builds (once per gameweek) a snapshot of every league manager's picks,
// reduced to two counts per player: how many managers selected them and
// how many captained them. Only the aggregated counts are stored.
//
// Called with the latest GW whose deadline has passed, so picks for it
// are final for the whole gameweek - no transfer or captain change can
// happen after the deadline, which is why one snapshot per GW is correct.
//
// Only cached when EVERY manager's picks were fetched. If any fetch failed,
// the partial result is returned for display but not saved, so the next
// request retries the full set instead of locking in gaps.
export async function getLeagueOwnershipSnapshot(gw) {
  const cacheKey = `picks-snapshot-gw${gw}`;

  const { data: cached } = await supabaseAdmin
    .from("fpl_data_cache")
    .select("data")
    .eq("cache_key", cacheKey)
    .maybeSingle();
  if (cached?.data) return cached.data;

  const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
  if (!leagueId) return null;

  const roster = await fpl.allClassicEntries(leagueId);
  const entryIds = roster.entries.map((e) => e.entry);

  const selectedBy = {};
  const captainedBy = {};
  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < entryIds.length; i += CHUNK_SIZE) {
    const chunk = entryIds.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map(async (entryId) => {
        try {
          return await fpl.entryPicks(entryId, gw);
        } catch {
          return null;
        }
      })
    );

    for (const picks of results) {
      if (!picks || !Array.isArray(picks.picks)) {
        failed += 1;
        continue;
      }
      fetched += 1;
      for (const p of picks.picks) {
        // Selected = anyone in the 15-man squad, including bench - same
        // definition FPL uses for "selected by".
        selectedBy[p.element] = (selectedBy[p.element] || 0) + 1;
        if (p.is_captain) {
          captainedBy[p.element] = (captainedBy[p.element] || 0) + 1;
        }
      }
    }
  }

  const snapshot = {
    gw,
    managersTotal: entryIds.length,
    managersCounted: fetched,
    takenAt: new Date().toISOString(),
    selectedBy,
    captainedBy,
  };

  if (failed === 0 && fetched > 0) {
    // Awaited (not fire-and-forget) - the serverless function can freeze
    // as soon as the response is sent, which would drop an unawaited write.
    const { error } = await supabaseAdmin
      .from("fpl_data_cache")
      .upsert({ cache_key: cacheKey, data: snapshot, updated_at: new Date().toISOString() }, { onConflict: "cache_key" });
    if (error) throw new Error(`Could not save picks snapshot: ${error.message}`);
  }

  return snapshot;
}

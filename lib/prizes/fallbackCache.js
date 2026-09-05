import { supabaseAdmin } from "../supabase";
import { isFplDownError } from "../fplErrors";

// Tries to compute fresh data via computeFn(). On success, saves a
// snapshot and returns it marked live. On failure - specifically FPL
// being temporarily down, not some other bug - falls back to the last
// successful snapshot if one exists, clearly marked stale with when it
// was actually last updated. A genuine (non-FPL-down) error still throws
// normally, since masking a real bug behind stale data would be worse
// than showing the error.
export async function withFallbackCache(cacheKey, computeFn) {
  try {
    const fresh = await computeFn();
    // Fire-and-forget - don't let a slow cache write hold up the response.
    supabaseAdmin
      .from("fpl_data_cache")
      .upsert({ cache_key: cacheKey, data: fresh, updated_at: new Date().toISOString() }, { onConflict: "cache_key" })
      .then(() => {})
      .catch(() => {});
    return { data: fresh, stale: false, staleSince: null };
  } catch (err) {
    if (!isFplDownError(err.message)) throw err;

    const { data: cached } = await supabaseAdmin
      .from("fpl_data_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached) {
      return { data: cached.data, stale: true, staleSince: cached.updated_at };
    }
    // FPL is down AND we've never successfully cached this before -
    // genuinely nothing to show, the original error is the honest answer.
    throw err;
  }
}

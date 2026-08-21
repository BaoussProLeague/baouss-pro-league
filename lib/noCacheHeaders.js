// Two different caches can go stale here, and they needed two different
// fixes. The earlier fix (cache: "no-store" in lib/fpl.js) stops OUR
// SERVER from getting a stale response when it asks FPL for data. This
// one stops VERCEL'S OWN EDGE NETWORK from caching the response our
// server then sends back to the browser - without it, Vercel can serve a
// cached copy of our API route's JSON even though the server-side fetch
// to FPL was itself fully fresh. Both were needed; this was the missing
// half.
export function setNoCache(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
}

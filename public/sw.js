// Deliberately minimal. This app is almost entirely live data - caching
// pages aggressively would mean showing stale scores after "installing"
// it, which defeats the point. This service worker exists mainly because
// Chrome on Android requires one to be registered before it'll offer the
// real "Install app" prompt - it doesn't try to cache anything beyond
// letting the browser know the app is installable.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API calls carry live scores and fixture state - they must never be
  // intercepted or served from any cache, browser or otherwise. Letting
  // the browser handle these natively (skip respondWith entirely) is the
  // only way to guarantee that, rather than trusting a passthrough fetch
  // to not accidentally use the HTTP cache.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(fetch(event.request, { cache: "no-store" }));
});

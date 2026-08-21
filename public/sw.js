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
  // Pass every request straight through to the network - no caching.
  event.respondWith(fetch(event.request));
});

// Minimal service worker — just enough for the browser to consider the app
// installable. This app is dynamic and auth-gated, so it deliberately does
// NOT cache pages or API responses; every request still goes to the network.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

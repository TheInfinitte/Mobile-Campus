/**
 * public/sw.js
 * WHAT: A small service worker that makes Mobile Campus installable as a PWA
 *       and gives a working offline page.
 * WHY : Students lose network constantly - in a lecture hall, on a bus, when
 *       data runs out. A cached app shell plus a friendly offline screen is far
 *       better than the browser's error dinosaur.
 *
 * WHAT IT CACHES:
 *   - The app shell (HTML of the main pages) so the app opens instantly.
 *   - Static assets (icons, the offline page).
 * WHAT IT DOES NOT CACHE:
 *   - API responses. Prices, listings and balances must always be fresh, so we
 *     never serve stale money data.
 */

// Bump this name whenever the cached files change - it forces an update.
const CACHE_NAME = "mobile-campus-v1";

// Files fetched and stored the moment the service worker installs.
const PRECACHE_URLS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/**
 * install
 * WHAT: Pre-caches the app shell.
 * WHY : After install the app can open with no network at all.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Activate immediately instead of waiting for every tab to close.
      .then(() => self.skipWaiting())
  );
});

/**
 * activate
 * WHAT: Deletes old caches from previous versions.
 * WHY : Without this, users would keep downloading an old shell forever and
 *       storage would grow on every release.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

/**
 * fetch
 * WHAT: Decides how each request is handled.
 * WHY : Three different strategies for three different kinds of request:
 *       1. Navigations (pages): try the network first so prices stay fresh,
 *          fall back to the cache, then to /offline.
 *       2. Static assets: cache first - they rarely change and are big.
 *       3. API calls: network only. Never serve stale data.
 */
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET. Payments and form posts must always hit the network.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip anything that is not our own origin (for example Cloudinary images).
  if (url.origin !== self.location.origin) return;

  // 3. API routes: always the network, never the cache.
  if (url.pathname.startsWith("/api/")) return;

  // 1. Page navigations.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Save a copy so the next offline visit works.
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          // Offline: try the cached page, otherwise show the offline screen.
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match("/offline");
          if (offline) return offline;
          // Last resort: a tiny inline page so the user is never stuck.
          return new Response(
            "<h1>You are offline</h1><p>Reconnect and try again.</p>",
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // 2. Static assets: cache first for speed.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful, basic responses.
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

/**
 * message
 * WHAT: Lets the page tell the service worker to update itself.
 * WHY : The "New version available - tap to update" banner in the app calls
 *       this so the user controls when the app refreshes.
 */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/// PayWatch Service Worker v4
/// Multi-strategy caching for instant page loads
///
/// Strategies:
///   Static assets (_next/static, fonts, icons) -> Cache-First (immutable)
///   Pages (navigation requests)                -> Stale-While-Revalidate (instant + bg refresh)
///   API routes                                 -> Network-Only (HTTP cache headers handle this)
///   External origins                           -> Pass-through

const CACHE_STATIC = 'pw-static-v4';
const CACHE_PAGES  = 'pw-pages-v4';
const ALL_CACHES   = [CACHE_STATIC, CACHE_PAGES];

const PRECACHE = [
  '/',
  '/overzicht',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ============================================================
// INSTALL
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_PAGES).then((cache) =>
      Promise.allSettled(PRECACHE.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

// ============================================================
// ACTIVATE — clean old caches (including v3 API cache)
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ============================================================
// FETCH
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept auth routes
  if (url.pathname.startsWith('/auth/')) return;

  // API routes: Network-Only. Browser HTTP cache (SHORT_CACHE headers) handles
  // short-lived caching. SW does NOT cache API responses because cached user data
  // would leak between accounts if someone logs out and another user logs in.
  if (url.pathname.startsWith('/api/')) return;

  // Static assets: Cache-First
  // _next/static files have content hashes — immutable, safe to serve forever
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    /\.(woff2?|ttf|otf|png|jpg|jpeg|webp|avif|svg|ico|css)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // Pages: Stale-While-Revalidate
  // Show cached page instantly, fetch fresh version in background
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(swr(request, CACHE_PAGES, event));
    return;
  }

  // Other same-origin assets (JS bundles loaded dynamically, etc.)
  event.respondWith(cacheFirst(request, CACHE_STATIC));
});

// ============================================================
// Cache-First: serve from cache, fetch only on miss
// ============================================================
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ============================================================
// Stale-While-Revalidate: cached instant + background refresh
// Uses event.waitUntil to keep SW alive during background fetch
// ============================================================
async function swr(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Background fetch: always run, updates cache for next visit
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Return cached immediately. Keep SW alive for background fetch via waitUntil.
    event.waitUntil(networkPromise);
    return cached;
  }

  // No cache — must wait for network
  const response = await networkPromise;
  if (response) return response;

  // Network failed + no cache — offline fallback
  if (request.mode === 'navigate') {
    const fallback = await cache.match('/');
    if (fallback) return fallback;
  }
  return new Response('Offline', { status: 503 });
}

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'PayWatch', {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.tag || 'paywatch-notification',
        data: { url: data.url || '/' },
        actions: data.actions || [],
        vibrate: [200, 100, 200],
      })
    );
  } catch {
    event.waitUntil(
      self.registration.showNotification('PayWatch', {
        body: event.data.text(),
        icon: '/icon-192.png',
      })
    );
  }
});

// ============================================================
// NOTIFICATION CLICK
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

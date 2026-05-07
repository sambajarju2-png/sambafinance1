/// PayWatch Service Worker v3
/// Multi-strategy caching for instant page loads on iOS + web
///
/// Strategies:
///   Static assets (_next/static, fonts, icons) -> Cache-First (immutable, hashed URLs)
///   Pages (navigation requests)                -> Stale-While-Revalidate (instant + fresh)
///   Read API (/api/bills, /api/analytics, etc) -> Stale-While-Revalidate (cached data + bg refresh)
///   Auth + mutations                           -> Network-Only (never cache)

const CACHE_STATIC = 'pw-static-v3';
const CACHE_PAGES  = 'pw-pages-v3';
const CACHE_API    = 'pw-api-v3';
const ALL_CACHES   = [CACHE_STATIC, CACHE_PAGES, CACHE_API];

const PRECACHE = [
  '/',
  '/overzicht',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// API routes safe to cache (GET only, user-specific read data)
const CACHEABLE_API = [
  '/api/bills',
  '/api/analytics',
  '/api/streak',
  '/api/community/posts',
  '/api/settings',
  '/api/notifications',
];

// API routes to NEVER cache
const NEVER_CACHE_API = [
  '/api/auth',
  '/api/chat',
  '/api/voice',
  '/api/revenuecat',
  '/api/stripe',
  '/api/bank/connect',
  '/api/bank/callback',
  '/api/gmail',
  '/api/outlook',
  '/api/push',
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
// ACTIVATE — clean old caches
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
// FETCH — route to right strategy
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/auth/')) return;

  // Static assets: Cache-First (hashed filenames = immutable)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    /\.(woff2?|ttf|otf|png|jpg|jpeg|webp|avif|svg|ico|css|js)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // API routes
  if (url.pathname.startsWith('/api/')) {
    if (NEVER_CACHE_API.some((p) => url.pathname.startsWith(p))) return;
    if (CACHEABLE_API.some((p) => url.pathname.startsWith(p))) {
      event.respondWith(staleWhileRevalidate(request, CACHE_API));
      return;
    }
    return;
  }

  // Page navigations: Stale-While-Revalidate (instant load from cache + bg refresh)
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(staleWhileRevalidate(request, CACHE_PAGES));
    return;
  }

  // Everything else
  event.respondWith(staleWhileRevalidate(request, CACHE_STATIC));
});

// ============================================================
// Cache-First: serve cached, only fetch on miss
// ============================================================
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const c = await caches.open(cacheName);
      c.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ============================================================
// Stale-While-Revalidate: serve cached instantly, refresh in background
// ============================================================
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  // Have cache? Return it now. Network updates cache in background for next visit.
  if (cached) return cached;

  // No cache — must wait for network
  const response = await networkFetch;
  if (response) return response;

  // Network failed, no cache — offline fallback
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

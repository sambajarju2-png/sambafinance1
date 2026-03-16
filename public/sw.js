/// PayWatch Service Worker
/// Handles: caching, offline fallback, push notifications (future)

const CACHE_NAME = 'paywatch-v2-cache-v1';

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ============================================================
// INSTALL — pre-cache app shell
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activate immediately (don't wait for old SW to finish)
  self.skipWaiting();
});

// ============================================================
// ACTIVATE — clean up old caches
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// ============================================================
// FETCH — network-first with cache fallback
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API routes (always go to network)
  if (url.pathname.startsWith('/api/')) return;

  // Skip auth routes
  if (url.pathname.startsWith('/auth/')) return;

  // Skip Supabase requests
  if (url.hostname.includes('supabase')) return;

  // Network-first strategy for pages
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If no cache match for a page request, return cached home
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// ============================================================
// PUSH — handle push notifications (ready for Step 25+)
// ============================================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options = {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'paywatch-notification',
      data: {
        url: data.url || '/',
      },
      actions: data.actions || [],
      vibrate: [200, 100, 200],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'PayWatch', options)
    );
  } catch {
    // Fallback for non-JSON push data
    event.waitUntil(
      self.registration.showNotification('PayWatch', {
        body: event.data.text(),
        icon: '/icon-192.png',
      })
    );
  }
});

// ============================================================
// NOTIFICATION CLICK — open the relevant page
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If app is already open, focus it and navigate
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(targetUrl);
    })
  );
});

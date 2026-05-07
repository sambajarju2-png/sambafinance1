/// PayWatch Service Worker v5
/// Fixed: Safari rejects cached redirects for navigation requests
/// Strategy: Cache-First for static only, Network-First for pages

const CACHE_STATIC = 'pw-static-v5';
const ALL_CACHES = [CACHE_STATIC];

// ============================================================
// INSTALL
// ============================================================
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ============================================================
// ACTIVATE — clean ALL old caches
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
// FETCH — minimal, safe strategy
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // NEVER intercept navigation requests — Safari throws
  // "Response served by service worker has redirections" if we cache
  // a redirect (e.g. / → /overzicht, / → /auth/login). Let the
  // browser handle all page navigations natively.
  if (request.mode === 'navigate') return;

  // NEVER intercept API or auth routes
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/auth/')) return;

  // Static assets only: Cache-First
  // _next/static has content-hashed filenames (immutable)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Other static files (fonts, icons, images in /public)
  if (/\.(woff2?|ttf|png|jpg|jpeg|webp|avif|svg|ico|css)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else: let browser handle normally
});

// ============================================================
// Cache-First for immutable static assets only
// ============================================================
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    // Only cache successful, non-redirect responses
    if (response.ok && !response.redirected) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
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

// ══════════════════════════════════════════════════
//  ContentFlow — Service Worker v4
//  GitHub Pages /contentflow/ subpath
//  PWABuilder + Play Store ready
// ══════════════════════════════════════════════════

const CACHE   = 'contentflow-v4';
const RUNTIME = 'contentflow-runtime-v4';

const PRECACHE = [
  '/contentflow/',
  '/contentflow/index.html',
  '/contentflow/manifest.json',
  '/contentflow/offline.html',
  '/contentflow/icons/icon-192.png',
  '/contentflow/icons/icon-512.png'
];

// Always use network for these domains
const NETWORK_ONLY = /firebase|gstatic\.com|googleapis\.com|fonts\.g/;

// ── Install ───────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => keys.filter(k => k !== CACHE && k !== RUNTIME))
      .then(old => Promise.all(old.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Always network-first for Firebase & Google APIs
  if (NETWORK_ONLY.test(url.hostname)) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            caches.open(RUNTIME).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for app shell, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => {
          if (e.request.mode === 'navigate') {
            return caches.match('/contentflow/index.html')
              .then(p => p || caches.match('/contentflow/offline.html'));
          }
          return new Response('Offline', { status: 503 });
        });
    })
  );
});

// ── Push Notifications ────────────────────────────
self.addEventListener('push', e => {
  const d = e.data?.json() || {};
  e.waitUntil(self.registration.showNotification(d.title || 'ContentFlow', {
    body: d.body || 'Check your content pipeline',
    icon: '/contentflow/icons/icon-192.png',
    badge: '/contentflow/icons/icon-96.png',
    tag: 'contentflow-push',
    data: { url: d.url || '/contentflow/' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('contentflow') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/contentflow/');
    })
  );
});

// Blood Trail Finder — Service Worker
// Caches the app shell for offline use in the field

const CACHE_NAME = 'bloodtrail-v2';
const SHELL = [
  '/blood-trail/',
  '/blood-trail/index.html',
  '/blood-trail/manifest.json',
  '/blood-trail/icon-192.png',
  '/blood-trail/icon-512.png'
];

// External resources to cache (Leaflet)
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
];

// Install: cache the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(SHELL).then(() =>
        // CDN resources are best-effort
        Promise.allSettled(CDN.map(url =>
          fetch(url).then(r => r.ok ? cache.put(url, r) : null)
        ))
      )
    ).then(() => self.skipWaiting())
  );
});

// Activate: clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML, cache-first for assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and cross-origin requests that aren't CDN
  if (e.request.method !== 'GET') return;
  const isCDN = url.hostname.includes('cdnjs.cloudflare.com');
  const isLocal = url.origin === self.location.origin;
  if (!isLocal && !isCDN) return;

  // Map tiles: network-only (too many to cache, need signal anyway)
  if (url.hostname.includes('arcgisonline') || url.hostname.includes('tile.openstreetmap') || url.hostname.includes('usgs.gov')) return;

  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    // HTML: network first, fall back to cache
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return r;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // Assets: cache first, fall back to network
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(r => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return r;
        });
      })
    );
  }
});

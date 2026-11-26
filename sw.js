'use strict';
// Service worker: keeps the game playable offline and installable.
// Strategy: app shell precached; navigations network-first so players always
// see the newest page; static assets stale-while-revalidate; api/ and data/
// (live config, stats, admin) never cached.
const VERSION = 'pwa-v1';
const CORE = [
  './', './index.html',
  './style.css', './enhancements.css',
  './engine.js', './visuals.js', './audio.js', './knowledge.js',
  './favicon.js', './game.js', './config.js', './sanitize-html.js',
  './site.js', './stats.js', './admin.js',
  './manifest.webmanifest',
  './assets/icon-180.png', './assets/icon-512.png'
];
const ASSET_PREFIX = '/assets/';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION)
    .then(cache => cache.addAll(CORE).catch(() => {}))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Live data must stay fresh: config, stats reporting, admin endpoints.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/data/')) return;
  // Navigations: network-first so an updated shell reaches the player, with
  // the cached page as the offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  // Images (portraits, rooms, accessories): cache-first, refresh in background.
  if (url.pathname.startsWith(ASSET_PREFIX)) {
    event.respondWith(caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200) caches.open(VERSION).then(cache => cache.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || network;
    }));
    return;
  }
  // Shell scripts and styles: stale-while-revalidate.
  event.respondWith(caches.match(req).then(cached => {
    const network = fetch(req).then(res => {
      if (res && res.status === 200) caches.open(VERSION).then(cache => cache.put(req, res.clone()));
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});

// Allow the page to activate an installed update immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

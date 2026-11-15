/* Offline support: keep the app shell in a cache, serve it from there, refresh it in the background. */
const CACHE = 'planirovk-v6';
const ASSETS = [
  './', './index.html', './app.css', './manifest.webmanifest',
  './js/01-core.js', './js/02-logic.js', './js/03-views.js', './js/04-views2.js', './js/05-sheets.js', './js/06-main.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache files one by one, so a single failed download does not cancel the rest
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => {
  if (e.data === 'offline-status') {
    caches.open(CACHE).then((c) => Promise.all(ASSETS.map((u) => c.match(u)))).then((hits) => {
      e.source && e.source.postMessage({ type: 'offline-status', ready: hits.every(Boolean) });
    });
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate';
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (isPage ? (await cache.match('./index.html')) || (await cache.match('./')) : undefined);
    const net = fetch(req).then((res) => { if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()); return res; });
    if (hit) { net.catch(() => null); return hit; }
    return net.catch(() => new Response('Нет подключения к интернету', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => (list.length ? list[0].focus() : self.clients.openWindow('./'))));
});

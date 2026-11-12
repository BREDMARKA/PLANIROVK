/* Offline support: serve the app shell from cache, refresh it in the background. */
const CACHE = 'planirovk-v1';
const ASSETS = [
  './', './index.html', './app.css', './manifest.webmanifest',
  './js/01-core.js', './js/02-logic.js', './js/03-views.js', './js/04-views2.js', './js/05-sheets.js', './js/06-main.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then((cache) => cache.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return hit || net;
    })),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => (list.length ? list[0].focus() : self.clients.openWindow('./'))));
});

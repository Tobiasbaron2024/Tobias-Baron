// Groschen Service Worker: App-Hülle offline verfügbar, Daten immer live
const CACHE = 'groschen-v5';
const SHELL = ['./', 'index.html', 'styles.css?v=1', 'theme.css?v=1', 'app.js?v=3', 'aktionen.js?v=1', 'plus.js?v=1', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-180.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match('index.html'))));
});

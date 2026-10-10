const CACHE = 'shiftly-v55';
const SHELL = ['plan-import.js?v=2', 'plan-import-core.js?v=1', 'plan-import-files.js?v=1', 'object-rates.js?v=1', 'wishes.js?v=9', 'wish-plan.js?v=1', 'icons/hamburg-werkschutz-512.png', 'scenes.js?v=1', 'images/hamburg-security-morgen.webp', 'images/hamburg-security-abend.webp', 'images/hamburg-speicherstadt.webp', 'images/hamburg-hafen.webp', 'dashboard-order.js?v=3', 'day-greeting.js?v=2', 'dashboard.js?v=7', 'daily-budget.js?v=2', 'groschen/plus.js?v=1', 'periods.js?v=1', './', 'index.html', 'style.css?v=39', 'app.js?v=51', 'urlaub.js?v=15', 'urlaub-mehrfach.js?v=1', 'features.js?v=19', 'fold.js?v=2', 'verkauf.js?v=4', 'lohn2026.js?v=1', 'calc.js?v=10', 'pdf.js?v=4', 'aktionen.js?v=2', 'manifest.webmanifest?v=2', 'icons/hamburg-werkschutz-192.png', 'icons/hamburg-werkschutz-180.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('shiftly-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Netz zuerst, bei fehlender Verbindung aus dem Speicher
  e.respondWith(fetch(e.request).then((r) => { const k = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, k)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});

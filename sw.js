const CACHE = 'ledger-v3';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js', './js/state.js', './js/engine.js', './js/tax.js', './js/taxdata.js',
  './js/format.js', './js/ui.js',
  './js/views/home.js', './js/views/budget.js', './js/views/flow.js', './js/views/goals.js', './js/views/plan.js',
  './assets/icon-192.png', './assets/icon-512.png', './assets/icon-180.png', './assets/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

/* The service worker: lets the game install as an app and open when the network is slow or gone.
   - the page, the code (src, vendor) and the icons: network first, the last good copy when the network fails, so an update always arrives and the game still opens in a tunnel;
   - everything else (the big city tiles, models, music, /api): not touched here, the browser's own cache handles them.
   Bump VERSION to drop the old copies. */
const VERSION = 'gfp-v1', SHELL = ['./', 'index.html', 'manifest.webmanifest', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  const mine = r.mode === 'navigate' || /\.(js|mjs|webmanifest)$/.test(u.pathname) || u.pathname.startsWith('/assets/icons/');
  if (!mine) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(r, copy)).catch(() => {}); } return res; }).catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});

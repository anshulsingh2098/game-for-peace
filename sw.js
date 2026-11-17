/* The service worker: lets the game install as an app and open when the network is slow or gone.
   - the page, the code (src, vendor) and the icons: network first, the last good copy when the network fails, so an update always arrives and the game still opens in a tunnel;
   - the assets (city tiles, models, textures, sounds, terrain, vendor libraries): CACHE FIRST, then quietly refreshed from the network (stale while revalidate), so the second visit and every later city tile are read from the device, not downloaded again; the newest 900 are kept;
   - /api and range requests: not touched.
   Bump VERSION to drop the old copies. */
const VERSION = 'gfp-v2', MAX_ASSETS = 900, SHELL = ['./', 'index.html', 'manifest.webmanifest', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
/* keep the cache from growing without end: drop the oldest entries past MAX_ASSETS */
async function trim(c) { try { const k = await c.keys(); for (let i = 0; i < k.length - MAX_ASSETS; i++) await c.delete(k[i]); } catch (e) { /* nothing to trim */ } }
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (/^\/(assets|vendor|music)\//.test(u.pathname) && !r.headers.has('range') && !/\.html?$/.test(u.pathname)) {
    e.respondWith(caches.open(VERSION).then(async c => { const hit = await c.match(r); const net = fetch(r).then(res => { if (res.ok) { c.put(r, res.clone()).then(() => trim(c)).catch(() => {}); } return res; }).catch(() => hit || Response.error()); return hit || net; })); return;
  }
  const mine = r.mode === 'navigate' || /\.(js|mjs|webmanifest)$/.test(u.pathname) || u.pathname.startsWith('/assets/icons/');
  if (!mine) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(r, copy)).catch(() => {}); } return res; }).catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});

/* The service worker: lets the game install as an app and open when the network is slow or gone.
   - the page, the code (src, vendor) and the icons: network first, the last good copy when the network fails, so an update always arrives and the game still opens in a tunnel;
   - the assets (city tiles, models, textures, sounds, terrain, vendor libraries): CACHE FIRST, then quietly refreshed from the network (stale while revalidate), so the second visit and every later city tile are read from the device, not downloaded again; the newest 900 are kept;
   - the DOWNLOAD button (ui/offline.js) sends 'offline-download' with a list of files; they go into the cache named OFFLINE, which is never trimmed and never deleted by an update of VERSION, so the game opens with no network;
   - /api and range requests: not touched.
   Bump VERSION to drop the old copies. */
const VERSION = 'gfp-v3', OFFLINE = 'gfp-offline', MAX_ASSETS = 900, SHELL = ['./', 'index.html', 'manifest.webmanifest', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== OFFLINE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
/* keep the cache from growing without end: drop the oldest entries past MAX_ASSETS */
async function trim(c) { try { const k = await c.keys(); for (let i = 0; i < k.length - MAX_ASSETS; i++) await c.delete(k[i]); } catch (e) { /* nothing to trim */ } }
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (/^\/(assets|vendor|music)\//.test(u.pathname) && !r.headers.has('range') && !/\.html?$/.test(u.pathname)) {
    e.respondWith(caches.open(VERSION).then(async c => { const hit = await caches.match(r); const net = fetch(r).then(res => { if (res.ok) { c.put(r, res.clone()).then(() => trim(c)).catch(() => {}); } return res; }).catch(() => hit || Response.error()); return hit || net; })); return;
  }
  const mine = r.mode === 'navigate' || /\.(js|mjs|webmanifest)$/.test(u.pathname) || u.pathname.startsWith('/assets/icons/');
  if (!mine) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(r, copy)).catch(() => {}); } return res; }).catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
/* the Download button: fetch the listed files (four at a time) into the OFFLINE cache and report progress to every open page */
async function say(msg) { const cs = await self.clients.matchAll({ includeUncontrolled: true }); cs.forEach(c => c.postMessage(msg)); }
async function downloadAll(group, files) {
  const c = await caches.open(OFFLINE); let done = 0, failed = 0, bytes = 0, next = 0;
  async function worker() {
    while (next < files.length) {
      const p = files[next++]; let ok = false;
      for (let t = 0; t < 3 && !ok; t++) { try { const res = await fetch(p, { cache: 'reload' }); if (res.ok) { bytes += +(res.headers.get('content-length') || 0); await c.put(p, res); ok = true; } } catch (e) { /* retry */ } }
      if (!ok) failed++; done++; if (done % 8 === 0 || done === files.length) await say({ type: 'offline-progress', group, done, total: files.length, bytes, failed });
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]); await say({ type: 'offline-done', group, done, total: files.length, failed });
}
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'offline-download' && Array.isArray(d.files)) e.waitUntil(downloadAll(d.group, d.files));
  if (d.type === 'offline-remove' && Array.isArray(d.files)) e.waitUntil(caches.open(OFFLINE).then(c => Promise.all(d.files.map(p => c.delete(p)))));
});

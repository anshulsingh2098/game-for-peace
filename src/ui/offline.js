/* "Download the game": keeps the game on this device so it opens with no network and no waiting.
   How: the deploy writes offline.json (every file, its size, and a group: 'core' = the game and the India map, 'delhi' = the city pack).
   The button asks the service worker (sw.js) to fetch the files into a cache that is never trimmed; progress comes back as messages.
   Pure helpers (plan, label) are tested in tools/selftest.mjs. Where there is no offline.json (a dev server) or no service worker (iPhone: install.js removes it),
   the button is not offered. */
export const GROUPS = { core: 'The game and the India map', delhi: 'Delhi, the full city' };
const KEY = 'gfp-offline';
const mb = n => (n / 1e6 >= 10 ? Math.round(n / 1e6) : Math.round(n / 1e5) / 10) + ' MB';
export const label = n => mb(n);
/* which files of a group still have to be downloaded, and how many bytes that is */
export function plan(manifest, group) {
  const files = ((manifest && manifest.files) || []).filter(f => f.g === group);
  return { files, bytes: files.reduce((s, f) => s + (f.s || 0), 0) };
}
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private window */ } };
let manifest = null;
export async function loadManifest() {
  if (manifest) return manifest;
  try { const r = await fetch('offline.json', { cache: 'no-cache' }); if (r.ok) { manifest = await r.json(); caches.open('gfp-offline').then(c => c.put('offline.json', new Response(JSON.stringify(manifest)))).catch(() => {}); } } catch (e) { try { const h = await caches.match('offline.json'); if (h) manifest = await h.json(); } catch (e2) { /* no copy */ } }
  return manifest;
}
/* 'none' | 'ready' (downloaded, current) | 'old' (downloaded, a newer build exists) */
export function stateOf(group, m) { const s = read()[group]; if (!s) return 'none'; return m && s !== m.version ? 'old' : 'ready'; }
export const supported = () => { try { return 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !!navigator.serviceWorker.controller || false; } catch (e) { return false; } };
/* ask the service worker to download a group; onProgress({done, total, bytes, failed}); resolves with { ok, failed } */
export async function download(group, onProgress) {
  const m = await loadManifest(); if (!m) return { ok: false, failed: 0, why: 'This copy of the game has no download list.' };
  const { files, bytes } = plan(m, group);
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); if (e.quota && e.usage != null && e.quota - e.usage < bytes * 1.1) return { ok: false, failed: 0, why: 'Not enough free space on this device (' + mb(bytes) + ' needed).' }; } } catch (e) { /* no estimate */ }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }
  const reg = await navigator.serviceWorker.ready; const sw = reg.active; if (!sw) return { ok: false, failed: 0, why: 'The game helper is not running yet: reload the page and try again.' };
  return new Promise(resolve => {
    const on = ev => { const d = ev.data; if (!d || d.group !== group) return;
      if (d.type === 'offline-progress') { try { onProgress && onProgress(d); } catch (e) { /* closed menu */ } }
      if (d.type === 'offline-done') { navigator.serviceWorker.removeEventListener('message', on); if (!d.failed) { const s = read(); s[group] = m.version; write(s); } resolve({ ok: !d.failed, failed: d.failed }); } };
    navigator.serviceWorker.addEventListener('message', on);
    sw.postMessage({ type: 'offline-download', group, files: files.map(f => f.p), version: m.version });
  });
}
/* remove the downloaded copy of a group (the browser keeps its own small cache either way) */
export async function remove(group) {
  const m = await loadManifest(); const reg = await navigator.serviceWorker.ready; if (reg.active) reg.active.postMessage({ type: 'offline-remove', files: plan(m, group).files.map(f => f.p) });
  const s = read(); delete s[group]; write(s);
}

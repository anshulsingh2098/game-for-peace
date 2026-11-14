/* Asset cache (N8): the bytes and parsed data of shared assets, separate from the three.js objects built from them. Pure JavaScript (the loader and disposer are passed in), so the
   self-test runs it headless.
   - acquire(key) gives the asset, loading it once however many callers ask (no duplicate loads); every acquire must be matched by one release.
   - While anyone holds an asset (refs > 0) it is pinned and never evicted. When the last holder releases, it stays as an idle entry (cheap to bring back) until trim() evicts idle
     entries, least recently used first, to get under maxBytes, or dispose() frees everything. Eviction calls dispose(key, value), where the owner frees GPU resources.
   - If every holder of an asset that is still loading releases it, the load is aborted (the loader gets an AbortSignal) and the entry is dropped.
   - A failed load is not cached: the next acquire tries again.
   Usage: const cache = new AssetCache({ load: async (key, signal) => ({ value, bytes }), dispose: (key, value) => {}, maxBytes: 64e6 }); const v = await cache.acquire('traffic:pack'); ... cache.release('traffic:pack'); */
export class AssetCache {
  constructor({ load, dispose = () => {}, maxBytes = 64 * 1048576, now = () => Date.now() }) {
    this.loadFn = load; this.disposeFn = dispose; this.maxBytes = maxBytes; this.now = now; this.map = new Map();
    this.stats = { loads: 0, hits: 0, failed: 0, aborted: 0, disposed: 0 };
  }
  acquire(key) {
    let e = this.map.get(key);
    if (e) { e.refs++; e.used = this.now(); this.stats.hits++; return e.state === 'ready' ? Promise.resolve(e.value) : e.promise; }
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : { signal: { aborted: false }, abort() { this.signal.aborted = true; } };
    e = { key, state: 'loading', refs: 1, bytes: 0, value: null, ctl, used: this.now(), promise: null }; this.map.set(key, e); this.stats.loads++;
    e.promise = Promise.resolve().then(() => this.loadFn(key, ctl.signal)).then(r => {
      if (this.map.get(key) !== e || ctl.signal.aborted) { if (r && r.value !== undefined && this.disposeFn) this.disposeFn(key, r.value); throw new Error('aborted ' + key); }
      e.state = 'ready'; e.value = r.value; e.bytes = r.bytes || 0; return e.value;
    }, err => { if (this.map.get(key) === e) { this.map.delete(key); this.stats.failed++; } throw err; });
    return e.promise;
  }
  release(key) {
    const e = this.map.get(key); if (!e || e.refs <= 0) return false; e.refs--; e.used = this.now();
    if (e.refs === 0 && e.state === 'loading') { e.ctl.abort(); this.map.delete(key); this.stats.aborted++; e.promise.catch(() => {}); }
    return true;
  }
  refs(key) { const e = this.map.get(key); return e ? e.refs : 0; }
  has(key) { const e = this.map.get(key); return !!e && e.state === 'ready'; }
  get bytes() { let n = 0; for (const e of this.map.values()) n += e.bytes; return n; }
  /* evict idle entries (refs 0), least recently used first, until under maxBytes (or all idle ones with all = true). Returns the keys evicted. */
  trim(all = false) {
    const out = []; const idle = [...this.map.values()].filter(e => e.refs === 0 && e.state === 'ready').sort((a, b) => a.used - b.used);
    for (const e of idle) { if (!all && this.bytes <= this.maxBytes) break; this.map.delete(e.key); this.disposeFn(e.key, e.value); this.stats.disposed++; out.push(e.key); }
    return out;
  }
  /* free everything, held or not (a world is being torn down) */
  dispose() { for (const e of this.map.values()) { if (e.state === 'loading') { e.ctl.abort(); e.promise.catch(() => {}); } else { this.disposeFn(e.key, e.value); this.stats.disposed++; } } this.map.clear(); }
  summary() { let held = 0, idle = 0, loading = 0; for (const e of this.map.values()) { if (e.state === 'loading') loading++; else if (e.refs > 0) held++; else idle++; } return { held, idle, loading, bytes: this.bytes, ...this.stats }; }
}

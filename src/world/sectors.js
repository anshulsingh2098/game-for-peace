/* World sectors (N8): the loading units of the world, separate from the terrain tiles. A sector is a square of the world (SECTOR_SIZE metres) with its own load state, so content
   other than terrain (shared assets now; navigation data, spawn profiles and interiors later) can be streamed by distance, direction of travel and importance. The terrain
   tile streamer (chunks.js) is NOT replaced: sectors sit above it. Pure JavaScript (the load and unload work is passed in), so the self-test runs it headless.

   States:  unrequested (not tracked)  ->  queued  ->  loading  ->  ready  ->  active  ->  (ready)  ->  unloading  ->  (unrequested)       and   failed (retried with a back-off).
   - A sector is wanted while it is within loadRadius of the player (or of the point the player reaches in `lookahead` seconds, so fast driving loads ahead) and stays wanted
     until it is beyond unloadRadius: the gap between the two radii is the hysteresis that stops sectors flickering at a threshold.
   - Requests wait in a queue ordered by priority (nearer first, ahead of the player first, important sectors first); at most maxConcurrent load at once and at most maxStarts start per
     update (a frame budget). A queued sector that is no longer wanted is cancelled for free; a loading one is aborted (the loader gets an AbortSignal).
   - A ready sector becomes active within activeRadius (and goes back to ready beyond activeRadius * 1.25) and calls activate / deactivate.
   - Pins keep a sector loaded while something needs it (an active mission, a vehicle parked there): unload waits until every pin is gone.
   - A failed load is marked failed and retried after 1 s, 2 s, 4 s ... (at most maxRetries times); retry(id) or a world reset starts over.
   Usage: const sm = new SectorManager({ load: async (sector, signal) => data, unload: (sector) => {}, activate, deactivate, bus }); each frame sm.update(x, z, { dx, dz, speed }, nowMs). */
export const SECTOR_SIZE = 512;
export const STATES = Object.freeze(['unrequested', 'queued', 'loading', 'ready', 'active', 'unloading', 'failed']);
export const sectorCoord = (v, size = SECTOR_SIZE) => Math.floor(v / size);
export const sectorId = (sx, sz) => sx + ',' + sz;

export class SectorManager {
  constructor({ size = SECTOR_SIZE, loadRadius = 900, unloadRadius = 1200, activeRadius = 600, lookahead = 4, maxConcurrent = 2, maxStarts = 2, maxRetries = 3, load, unload = () => {}, activate = () => {}, deactivate = () => {}, bus = null, meta = null, importance = null } = {}) {
    if (!(unloadRadius > loadRadius)) throw new Error('unloadRadius must be larger than loadRadius (the hysteresis)');
    Object.assign(this, { size, loadRadius, unloadRadius, activeRadius, lookahead, maxConcurrent, maxStarts, maxRetries, loadFn: load, unloadFn: unload, activateFn: activate, deactivateFn: deactivate, bus, metaFn: meta, importanceFn: importance });
    this.map = new Map(); this.loading = 0; this.now = 0; this.counts = { loaded: 0, unloaded: 0, aborted: 0, failed: 0, cancelled: 0 }; this.epoch = 0;
  }
  /* distance from a point to a sector's square (0 inside it) */
  dist(s, x, z) { const dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1); return Math.hypot(dx, dz); }
  make(sx, sz) {
    const s = { id: sectorId(sx, sz), sx, sz, x0: sx * this.size, z0: sz * this.size, x1: (sx + 1) * this.size, z1: (sz + 1) * this.size, state: 'queued', priority: 0, pins: new Set(), ctl: null, error: null, tries: 0, retryAt: 0, data: null, meta: null, epoch: this.epoch };
    if (this.metaFn) s.meta = this.metaFn(s); return s;
  }
  get(id) { return this.map.get(id) || null; }
  stateOf(id) { const s = this.map.get(id); return s ? s.state : 'unrequested'; }
  pin(id, owner) { const s = this.map.get(id); if (!s) return false; s.pins.add(owner); return true; }
  unpin(id, owner) { const s = this.map.get(id); if (!s) return false; return s.pins.delete(owner); }
  retry(id) { const s = this.map.get(id); if (s && s.state === 'failed') { s.tries = 0; s.retryAt = 0; s.state = 'queued'; } }

  update(px, pz, dir = null, nowMs = this.now) {
    this.now = nowMs; const ax = dir && dir.speed ? px + dir.dx * dir.speed * this.lookahead : px, az = dir && dir.speed ? pz + dir.dz * dir.speed * this.lookahead : pz;
    const R = Math.ceil((Math.max(this.loadRadius, this.unloadRadius) + (dir && dir.speed ? dir.speed * this.lookahead : 0)) / this.size) + 1, cx = sectorCoord(px, this.size), cz = sectorCoord(pz, this.size);
    // wanted: within loadRadius of the player or of the look-ahead point
    const rect = (sx, sz) => ({ x0: sx * this.size, z0: sz * this.size, x1: (sx + 1) * this.size, z1: (sz + 1) * this.size });
    for (let sx = cx - R; sx <= cx + R; sx++) for (let sz = cz - R; sz <= cz + R; sz++) {
      const id = sectorId(sx, sz); if (this.map.has(id)) continue; const r = rect(sx, sz);
      if (Math.min(this.dist(r, px, pz), this.dist(r, ax, az)) <= this.loadRadius) { this.map.set(id, this.make(sx, sz)); if (this.bus) this.bus.emit('sector:entered', { id }); }
    }
    for (const s of [...this.map.values()]) {
      const dp = this.dist(s, px, pz), da = this.dist(s, ax, az), d = Math.min(dp, da); s.dist = dp;
      const ahead = dir && dir.speed ? ((s.x0 + s.x1) / 2 - px) * dir.dx + ((s.z0 + s.z1) / 2 - pz) * dir.dz : 0;
      s.priority = d - Math.max(0, ahead) * 0.15 - (this.importanceFn ? this.importanceFn(s) : 0);
      if (s.state === 'queued') { if (d > this.loadRadius) { this.map.delete(s.id); this.counts.cancelled++; } }
      else if (s.state === 'loading') { if (d > this.unloadRadius) this.abort(s); }
      else if (s.state === 'failed') { if (d > this.unloadRadius) this.map.delete(s.id); else if (s.tries <= this.maxRetries && this.now >= s.retryAt) s.state = 'queued'; }
      else if (s.state === 'ready' || s.state === 'active') {
        if (d > this.unloadRadius && !s.pins.size) this.unloadOne(s);
        else if (s.state === 'ready' && dp <= this.activeRadius) { s.state = 'active'; this.activateFn(s); }
        else if (s.state === 'active' && dp > this.activeRadius * 1.25) { s.state = 'ready'; this.deactivateFn(s); }
      }
    }
    // start the best queued sectors within the budget
    const queued = [...this.map.values()].filter(s => s.state === 'queued').sort((a, b) => a.priority - b.priority || (a.sx - b.sx) || (a.sz - b.sz));
    let started = 0; for (const s of queued) { if (this.loading >= this.maxConcurrent || started >= this.maxStarts) break; this.start(s); started++; }
  }
  start(s) {
    s.state = 'loading'; this.loading++; const ctl = typeof AbortController !== 'undefined' ? new AbortController() : { signal: { aborted: false }, abort() { this.signal.aborted = true; } }; s.ctl = ctl; const epoch = this.epoch;
    Promise.resolve().then(() => this.loadFn(s, ctl.signal)).then(data => {
      if (epoch !== this.epoch || s.ctl !== ctl || ctl.signal.aborted || s.state !== 'loading') { if (data !== undefined) this.unloadFn({ ...s, data }); return; }
      this.loading--; s.ctl = null; s.data = data; s.state = 'ready'; s.error = null; this.counts.loaded++;
    }, err => {
      if (epoch !== this.epoch || s.ctl !== ctl || s.state !== 'loading') return;
      this.loading--; s.ctl = null; s.state = 'failed'; s.error = String(err && err.message || err); s.tries++; s.retryAt = this.now + 1000 * 2 ** (s.tries - 1); this.counts.failed++;
    });
  }
  abort(s) { if (s.ctl) s.ctl.abort(); s.ctl = null; if (s.state === 'loading') this.loading--; this.map.delete(s.id); this.counts.aborted++; }
  unloadOne(s) { s.state = 'unloading'; this.unloadFn(s); s.data = null; this.map.delete(s.id); this.counts.unloaded++; }
  /* drop everything now (world rebuilt, or a teleport you want to treat as a new start): loads in flight are aborted and their late results are freed */
  reset() { this.epoch++; for (const s of [...this.map.values()]) { if (s.state === 'loading') { if (s.ctl) s.ctl.abort(); } else if (s.state === 'active' || s.state === 'ready') { if (s.state === 'active') this.deactivateFn(s); this.unloadFn(s); } } this.map.clear(); this.loading = 0; }
  list(state) { return [...this.map.values()].filter(s => !state || s.state === state); }
  summary() { const by = {}; for (const st of STATES) by[st] = 0; for (const s of this.map.values()) by[s.state]++; return { ...by, loadingNow: this.loading, ...this.counts }; }
}

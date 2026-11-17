/* Runtime foundation (post-N6 plan, N7). Pure JavaScript (no three.js, no DOM), so the self-test runs all of it headless.
   Four small, separate tools; use only the ones a system needs:
   - GameRuntime: runs registered systems in a fixed, deterministic order through the phases init, fixedUpdate, update, render and dispose. It clamps the frame time (a hidden tab
     or a long stall never gives a simulation time spike), keeps a fixed-step accumulator for systems that need stable steps (never a burst of catch-up steps), and tears down in
     reverse order. Rendering stays independent of the fixed step.
   - EventBus: low-frequency events between systems (region changed, vehicle changed, a world was rebuilt). NOT for per-frame values: read those from the owning system.
   - Registry: typed, bounded tables of entities with stable handles. A handle is a number holding slot, type and a generation, so a handle kept after its entity was destroyed
     never resolves to whatever reused the slot.
   - Pool: a bounded reusable pool of one kind of short-lived object, with a complete reset on release.
   Handle layout (31 bits plus a domain number above them, always positive, 0 is "no entity"; a handle only resolves in the registry or pool that made it): domain * 2^31 + generation (11 bits) << 20 | type (4 bits) << 16 | slot (16 bits). The generation wraps after 2047 reuses of one slot, so a handle
   held across that many reuses of the same slot could in theory resolve again: do not keep handles for that long.
   Event naming: 'domain:event' in lower case (region:changed). The list below is the contract; a strict bus throws on a name that is not listed, which catches typos. */
export const EVENTS = Object.freeze([
  'region:changed',        // { from, to }            the location (region) the world is built for changed
  'world:rebuilt',         // { seed, location }      a new world (terrain, road, scenery) was built; systems holding world objects must drop and rebuild them
  'vehicle:changed',       // { id }                  the player's vehicle was switched
  'vehicle:entered',       // { handle }              (N14) the player got into a vehicle
  'vehicle:exited',        // { handle }              (N14) the player got out
  'mode:changed',          // { from, to }            drive, fly or ride
  'sector:entered',        // { id }                  (N8) the player entered a streaming sector
  'entity:removed',        // { handle, type }        an entity was destroyed or released
  'activity:started',      // { id }                  (N15) a point-to-point activity began
  'activity:finished',     // { id, outcome, time, rating }  (N15) it ended: done, failed or cancelled
  'runtime:resumed'        // { }                     the clock was reset after a hidden tab or a pause
]);

const SLOT_BITS = 16, TYPE_BITS = 4, GEN_BITS = 11, SLOT_MASK = (1 << SLOT_BITS) - 1, TYPE_MASK = (1 << TYPE_BITS) - 1, GEN_MASK = (1 << GEN_BITS) - 1;
export const handleSlot = h => h & SLOT_MASK;
export const handleType = h => (h >> SLOT_BITS) & TYPE_MASK;
export const handleGen = h => (h >> (SLOT_BITS + TYPE_BITS)) & GEN_MASK;
/* A handle also carries the DOMAIN of the registry or pool that made it (every instance gets its own number), above the 31 bits, so a handle from one registry never resolves in another (audit R05). Domain 0 is the first instance made, so its handles are the same numbers as before. */
const DOMAIN_STEP = 2147483648, DOMAIN_MAX = 1048576; let nextDomain = 0; const newDomain = () => { const d = nextDomain; nextDomain = (nextDomain + 1) % DOMAIN_MAX; return d; };
export const handleDomain = h => Math.floor(h / DOMAIN_STEP);
const makeHandle = (gen, type, slot, domain = 0) => domain * DOMAIN_STEP + ((gen << (SLOT_BITS + TYPE_BITS)) | (type << SLOT_BITS) | slot);

/* ---------- fixed-step accumulator ---------- */
export class FixedStepper {
  constructor({ step = 1 / 60, maxFrame = 0.1, maxSteps = 4 } = {}) { this.step = step; this.maxFrame = maxFrame; this.maxSteps = maxSteps; this.acc = 0; this.dropped = 0; }
  /* add one frame's time (seconds); returns the number of fixed steps to run now. Time beyond maxFrame, and a backlog beyond maxSteps steps, is dropped (counted in `dropped`), never replayed. */
  advance(dt) {
    if (!(dt > 0)) return 0;
    if (dt > this.maxFrame) { this.dropped += dt - this.maxFrame; dt = this.maxFrame; }
    this.acc += dt; let n = 0;
    while (this.acc >= this.step && n < this.maxSteps) { this.acc -= this.step; n++; }
    if (this.acc >= this.step) { this.dropped += this.acc - (this.acc % this.step); this.acc %= this.step; }
    return n;
  }
  get alpha() { return this.acc / this.step; }                  // how far into the next step the leftover time is (0..1), for drawing between steps
  reset() { this.acc = 0; }
}

/* ---------- event bus ---------- */
export class EventBus {
  constructor({ strict = true, onError = e => console.error(e) } = {}) { this.strict = strict; this.onError = onError; this.map = new Map(); }
  check(name) { if (this.strict && !EVENTS.includes(name)) throw new Error('unknown event "' + name + '" (add it to EVENTS in core/runtime.js)'); }
  /* subscribe; returns the function that unsubscribes (call it from the owner's dispose) */
  on(name, fn) { this.check(name); let l = this.map.get(name); if (!l) this.map.set(name, l = []); l.push(fn); return () => this.off(name, fn); }
  once(name, fn) { const off = this.on(name, p => { off(); fn(p); }); return off; }
  off(name, fn) { const l = this.map.get(name); if (!l) return; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); if (!l.length) this.map.delete(name); }
  /* call the handlers in subscription order; a handler that throws does not stop the others. Handlers added during an emit run from the next one. */
  emit(name, payload) { this.check(name); const l = this.map.get(name); if (!l) return 0; const copy = l.slice(); for (const fn of copy) { try { fn(payload); } catch (e) { this.onError(e); } } return copy.length; }
  listenerCount(name) { if (name) return (this.map.get(name) || []).length; let n = 0; for (const l of this.map.values()) n += l.length; return n; }
  clear() { this.map.clear(); }
}

/* ---------- typed registry with stable handles ---------- */
export class Registry {
  /* types: { name: capacity } (at most 16 types, capacity at most 65535 each) */
  constructor(types, bus = null) {
    this.bus = bus; this.domain = newDomain(); this.names = Object.keys(types); if (this.names.length > TYPE_MASK + 1) throw new Error('too many entity types');
    this.t = this.names.map((name, id) => { const cap = types[name]; if (!(cap > 0 && cap <= SLOT_MASK)) throw new Error('bad capacity for ' + name); return { name, id, cap, gen: new Uint16Array(cap).fill(1), obj: new Array(cap).fill(null), free: Array.from({ length: cap }, (_, i) => cap - 1 - i), live: 0 }; });
  }
  type(name) { const i = this.names.indexOf(name); if (i < 0) throw new Error('unknown entity type ' + name); return this.t[i]; }
  /* store obj; returns its handle, or 0 if the type is full (the bound is hard: the caller decides what to do) */
  create(name, obj) { const T = this.type(name); if (!T.free.length) return 0; const slot = T.free.pop(); T.obj[slot] = obj; T.live++; return makeHandle(T.gen[slot], T.id, slot, this.domain); }
  /* the entity for a handle, or null if the handle is 0, of another registry, destroyed or stale */
  get(h) { if (!h || handleDomain(h) !== this.domain) return null; const T = this.t[handleType(h)]; if (!T) return null; const s = handleSlot(h); return s < T.cap && T.gen[s] === handleGen(h) ? T.obj[s] : null; }
  alive(h) { return this.get(h) !== null; }
  /* remove an entity; its handle (and every copy of it) stops resolving at once. Returns the object, or null if the handle was not live. */
  destroy(h) {
    const o = this.get(h); if (o === null) return null; const T = this.t[handleType(h)], s = handleSlot(h);
    T.obj[s] = null; T.gen[s] = (T.gen[s] + 1) & GEN_MASK || 1; T.free.push(s); T.live--; if (this.bus) this.bus.emit('entity:removed', { handle: h, type: T.name }); return o;
  }
  count(name) { return this.type(name).live; }
  capacity(name) { return this.type(name).cap; }
  forEach(name, fn) { const T = this.type(name); for (let s = 0; s < T.cap; s++) if (T.obj[s] !== null) fn(T.obj[s], makeHandle(T.gen[s], T.id, s, this.domain)); }
  clear(name) { for (const T of name ? [this.type(name)] : this.t) for (let s = 0; s < T.cap; s++) if (T.obj[s] !== null) this.destroy(makeHandle(T.gen[s], T.id, s, this.domain)); }
}

/* ---------- bounded object pool ---------- */
export class Pool {
  /* make(): a new object; reset(obj): put it back to its blank state (it must clear EVERY field a user can set); cap: the most objects alive at once */
  constructor({ cap, make, reset, type = 15 }) {
    if (!(cap > 0 && cap <= SLOT_MASK)) throw new Error('bad pool capacity'); this.cap = cap; this.domain = newDomain(); this.make = make; this.resetFn = reset; this.type = type;
    this.gen = new Uint16Array(cap).fill(1); this.obj = new Array(cap).fill(null); this.used = new Uint8Array(cap); this.free = Array.from({ length: cap }, (_, i) => cap - 1 - i); this.live = 0; this.created = 0; this.reused = 0; this.high = 0;
  }
  /* an object ready to use and its handle; null when the pool is full (bounded: the caller drops the spawn) */
  acquire() {
    if (!this.free.length) return null; const slot = this.free.pop(); let o = this.obj[slot]; if (o === null) { o = this.obj[slot] = this.make(); this.created++; } else this.reused++;
    this.used[slot] = 1; this.live++; if (this.live > this.high) this.high = this.live; return { handle: makeHandle(this.gen[slot], this.type, slot, this.domain), obj: o };
  }
  get(h) { if (!h || handleDomain(h) !== this.domain) return null; const s = handleSlot(h); return s < this.cap && this.used[s] && this.gen[s] === handleGen(h) && handleType(h) === this.type ? this.obj[s] : null; }
  /* hand an object back: reset, and every old handle for it stops resolving. Returns false for a handle that is not live (already released, stale), so double release is harmless. */
  release(h) {
    const o = this.get(h); if (o === null) return false; const s = handleSlot(h); this.resetFn(o); this.used[s] = 0; this.gen[s] = (this.gen[s] + 1) & GEN_MASK || 1; this.free.push(s); this.live--; return true;
  }
  releaseAll() { for (let s = 0; s < this.cap; s++) if (this.used[s]) this.release(makeHandle(this.gen[s], this.type, s, this.domain)); }
  stats() { return { cap: this.cap, live: this.live, created: this.created, reused: this.reused, high: this.high }; }
}

/* ---------- the runtime ---------- */
export class GameRuntime {
  /* maxFrame: longest frame time (s) any system ever sees. fixedStep: step for fixedUpdate systems. */
  constructor({ fixedStep = 1 / 60, maxFrame = 0.05, maxSteps = 4, bus = new EventBus() } = {}) {
    this.bus = bus; this.stepper = new FixedStepper({ step: fixedStep, maxFrame, maxSteps }); this.maxFrame = maxFrame; this.systems = []; this.sorted = []; this.seq = 0; this.last = null; this.started = false; this.frames = 0; this.discarded = 0; this.lastDt = 0; this.lastSteps = 0; this.disposed = false;
  }
  /* sys: { name, order = 0, init(rt), fixedUpdate(step, rt), update(dt, nowMs, rt), render(nowMs, rt), dispose(rt) }; every method is optional. Lower order runs first; ties keep the order of adding. */
  add(sys) {
    if (!sys || !sys.name) throw new Error('a system needs a name'); if (this.systems.some(s => s.sys.name === sys.name)) throw new Error('duplicate system ' + sys.name);
    const e = { sys, order: sys.order || 0, seq: this.seq++, inited: false }; this.systems.push(e); this.sorted = this.systems.slice().sort((a, b) => a.order - b.order || a.seq - b.seq);
    if (this.started) this.initOne(e); return sys;
  }
  get(name) { const e = this.systems.find(s => s.sys.name === name); return e ? e.sys : null; }
  names() { return this.sorted.map(e => e.sys.name); }
  initOne(e) { if (e.inited) return; e.inited = true; if (e.sys.init) e.sys.init(this); }
  start() { this.started = true; for (const e of this.sorted) this.initOne(e); return this; }
  /* remove one system now (its dispose runs) */
  remove(name) { const i = this.systems.findIndex(s => s.sys.name === name); if (i < 0) return false; const [e] = this.systems.splice(i, 1); this.sorted = this.sorted.filter(x => x !== e); const was = e.inited; e.inited = false; if (was && e.sys.dispose) e.sys.dispose(this); return true; }        // inited goes false first: a frame already running keeps its old list and must not update or render a disposed system
  /* all wall time thrown away so far (seconds): frame gaps clamped here plus what the stepper dropped (audit R16) */
  get droppedTime() { return this.stepper.dropped + this.discarded; }
  /* forget the last frame time: the next frame has dt 0. Call it when the tab was hidden or the game was paused, so no time spike follows. */
  resetClock() { this.last = null; this.stepper.reset(); this.bus.emit('runtime:resumed', {}); }
  /* run one frame at time nowMs (performance.now() style). Returns { dt, steps }. */
  frame(nowMs) {
    let dt = this.last === null ? 0 : (nowMs - this.last) / 1000; this.last = nowMs; if (!(dt > 0)) dt = 0; if (dt > this.maxFrame) { this.discarded += dt - this.maxFrame; dt = this.maxFrame; }
    const steps = this.stepper.advance(dt), step = this.stepper.step;
    for (let k = 0; k < steps; k++) for (const e of this.sorted) if (e.inited && e.sys.fixedUpdate) e.sys.fixedUpdate(step, this);
    for (const e of this.sorted) if (e.inited && e.sys.update) e.sys.update(dt, nowMs, this);
    for (const e of this.sorted) if (e.inited && e.sys.render) e.sys.render(nowMs, this);
    this.frames++; this.lastDt = dt; this.lastSteps = steps; return { dt, steps };
  }
  /* dispose every system in the reverse of the update order, then drop every event listener. A system that throws does not stop the others; the first error is rethrown at the end. */
  dispose() {
    if (this.disposed) return; this.disposed = true; let err = null;
    for (const e of this.sorted.slice().reverse()) if (e.inited && e.sys.dispose) { try { e.sys.dispose(this); } catch (x) { err = err || x; } }
    this.systems.length = 0; this.sorted = []; this.bus.clear(); if (err) throw err;
  }
}

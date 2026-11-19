/* Tuning: lets the tuner dashboard (tuner.html) change numbers and colours in the running game without code changes.
   Every number or colour inside a registered root object becomes a setting, addressed by a path such as
     vehicles.car.body.mass     world.terrain.hills.amp     times.day.li     weather.rain.fogMul     surfaces.grass.grip
   (arrays of objects that have an `id` are addressed by that id, other arrays by index).
   A set of overrides is a plain map { path: value }. It is applied on top of the defaults, saved as settings.json, and replaced as a whole on
   every change, so a path that disappears from the map goes back to its default.
   Pure module (no three.js, no DOM), so it runs in the self-test. main.js registers the roots and applies overrides. */
const roots = new Map();                                        // name -> { get, defaults }
export const overrides = {};                                    // path -> value currently applied
const clone = v => JSON.parse(JSON.stringify(v));

/* `ref` is an object, or a function returning the current object (the world config is replaced on every regenerate) */
export function registerRoot(name, ref) { const get = typeof ref === 'function' ? ref : () => ref; roots.set(name, { get, defaults: clone(get()) }); }

const SKIP = new Set(['flat', 'blend', 'style', 'file', 'name', 'tag', 'desc', 'mask', 'label', 'names', 'id', 'seed', 'location', 'view', 'paint', 'lights', 'eye', 'shadow', 'circles']);
const isObj = v => v && typeof v === 'object';
const isColour = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const key = (o, i) => Array.isArray(o) ? (isObj(o[i]) && o[i].id ? o[i].id : String(i)) : i;
const child = (o, k) => Array.isArray(o) ? (o.find(v => isObj(v) && v.id === k) ?? o[+k]) : o[k];
function walk(o, path) { let cur = o; for (const k of path) { if (!isObj(cur)) return undefined; cur = child(cur, k); } return cur; }

export function getValue(path) { const [r, ...rest] = path.split('.'), R = roots.get(r); return R ? walk(R.get(), rest) : undefined; }
function write(path, v, from) {
  const [r, ...rest] = path.split('.'), R = roots.get(r); if (!R) return false;
  const last = rest.pop(), parent = walk(R.get(), rest); if (!isObj(parent)) return false;
  const val = from === 'default' ? walk(R.defaults, [...rest, last]) : v;
  if (Array.isArray(parent) && !(isObj(parent.find(x => isObj(x) && x.id === last)))) parent[+last] = val; else parent[last] = val;
  return true;
}

/* ---- ranges for the sliders: exact for the settings that matter, a guess from the default for the rest ---- */
const HINTS = {
  mass: [50, 40000, 10], steerMax: [0.05, 1.2, 0.01], Top: [20, 500, 1], Speed: [0, 100, 1], Accel: [0, 100, 1], Handling: [0, 100, 1], Grip: [0, 100, 1],
  brake: [1, 30, 0.1], revAccel: [0.5, 8, 0.1], revTop: [1, 30, 0.5], aero: [0, 6, 0.01], lean: [0, 1.5, 0.01], cg: [0.2, 2.5, 0.01], wheelR: [0.15, 1.2, 0.01],
  track: [0.3, 3, 0.01], front: [0.3, 8, 0.01], rear: [0.3, 8, 0.01], radius: [0.2, 3, 0.01], secs: [1, 30, 0.5], cooldown: [1, 90, 1], back: [2, 40, 0.5], up: [0.5, 15, 0.1], look: [0, 12, 0.1],
  li: [0, 8, 0.05], hi: [0, 4, 0.05], fogMul: [0.05, 2, 0.01], cloud: [0, 1, 0.01], dark: [0, 1, 0.01], light: [0, 1.5, 0.01], rain: [0, 1, 0.01], snow: [0, 1, 0.01], wet: [0, 1, 0.01],
  stars: [0, 1, 0.01], ca: [0, 1, 0.01], grip: [0, 1.5, 0.01], drag: [0, 0.3, 0.001], maxGrade: [0.02, 0.4, 0.005], hardGrade: [0.02, 0.5, 0.005], minRadius: [20, 400, 1],
  toughness: [0.3, 6, 0.05], debris: [0, 1, 0.01], burnSeconds: [5, 300, 1], smokeSeconds: [10, 600, 5], lossK: [0.0005, 0.02, 0.0001], lossPow: [0.5, 3, 0.01], maxHit: [0.05, 1, 0.01], count: [0, 12, 1], range: [5, 120, 1], parked: [0, 1, 1],
  sun: [-1, 1, 0.01], sunCol: [0, 1.5, 0.01], cc: [0, 1.5, 0.01],
  seaLevel: [-200, 5000, 1], treeline: [0, 6000, 1], snowline: [0, 8000, 1], trees: [0, 0.05, 0.0001], rocks: [0, 0.01, 0.0001], bushes: [0, 0.02, 0.0001], tufts: [0, 0.05, 0.0001]
};
function range(k, v) {
  if (HINTS[k]) return HINTS[k];
  const a = Math.abs(v), step = Number.isInteger(v) && a >= 5 ? 1 : a === 0 ? 0.01 : a < 0.1 ? 0.001 : a < 1 ? 0.01 : a < 20 ? 0.05 : 1;
  return [v < 0 ? v * 3 : 0, v === 0 ? 1 : v > 0 ? Math.max(v * 3, v + 1) : 0, step];
}
const pretty = k => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

/* every setting as { path, group, label, type: 'number' | 'colour', value, def, min, max, step } */
export function describe() {
  const out = [];
  for (const [name, R] of roots) {
    (function visit(o, p) {
      for (const [i, v] of (Array.isArray(o) ? o.map((x, n) => [n, x]) : Object.entries(o))) {
        const k = key(o, i); if (SKIP.has(k) && !Array.isArray(o)) continue;
        const q = [...p, k], full = [name, ...q].join('.'), dv = walk(R.defaults, q), vec = Array.isArray(o) && typeof v === 'number';      // vec: one number of a short array such as a colour or direction
        if (typeof v === 'number' && Number.isFinite(v)) {
          const base = vec ? p[p.length - 1] : k, [min, max, step] = range(base, dv ?? v);
          out.push({ path: full, group: [name, ...(vec ? p.slice(0, -1) : p)].join(' / '), label: vec ? pretty(base) + ' ' + (+k + 1) : pretty(k), type: 'number', value: v, def: dv ?? v, min: Math.min(min, v, dv ?? v), max: Math.max(max, v, dv ?? v), step });
        } else if (isColour(v)) out.push({ path: full, group: [name, ...p].join(' / '), label: pretty(k), type: 'colour', value: v, def: isColour(dv) ? dv : v });
        else if (isObj(v)) visit(v, q);
      }
    })(R.get(), []);
  }
  return out;
}

/* replace the whole set of overrides; returns the paths that changed or went back to default */
export function setOverrides(map) {
  const changed = [];
  for (const p of Object.keys(overrides)) if (!(p in map)) { write(p, null, 'default'); delete overrides[p]; changed.push(p); }
  for (const [p, v] of Object.entries(map)) if (overrides[p] !== v && write(p, v)) { overrides[p] = v; changed.push(p); }
  return changed;
}
/* put the overrides that belong to the world onto a freshly built config (called after every regenerate) */
export function applyWorld(config) {
  for (const [p, v] of Object.entries(overrides)) if (p.startsWith('world.')) { const rest = p.split('.').slice(1), last = rest.pop(), parent = walk(config, rest); if (isObj(parent)) parent[last] = v; }
  return config;
}

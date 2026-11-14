/* WorldConfig: the seed plus every number that shapes the generated world, in one plain object.
   It can be saved, shared as text and edited live (the world config tool is built on this). Distances are metres. */
export const DEFAULT_CONFIG = {
  seed: 'peace',
  location: 'default',          // id of the location profile this world was made from (see world/locations.js)
  water: { color: '#1d4a5a' },
  terrain: {
    seaLevel: 0,
    seabed: -38,                 // depth far out at sea
    lowland: 12,                 // height of flat inland ground
    continent: { scale: 7000, rise: 70 },                       // very large shapes: where land and sea are, and how far the interior rises
    coast: { lo: -0.40, hi: -0.20 },                             // continent noise range over which seabed becomes land
    warp: { scale: 1500, amp: 190 },                            // bends everything so coasts and valleys are not blobby
    hills: { scale: 820, amp: 46, octaves: 5, lacunarity: 2.05, gain: 0.5 },
    mountains: { maskScale: 4200, start: 0.02, full: 0.42, scale: 4500, amp: 470, octaves: 5, gain: 0.4, sharp: 1.7 },   // gain below 0.5 keeps fine ridges from turning into cliffs
    detail: { scale: 62, amp: 1.4, octaves: 2 }
  },
  palette: {                     // multiplied by the ground texture, so "white" is above 1
    grass: [0.62, 0.74, 0.30], grass2: [0.34, 0.50, 0.18], dry: [0.66, 0.60, 0.34], alpine: [0.50, 0.50, 0.33],
    rock: [0.50, 0.47, 0.43], sand: [0.80, 0.71, 0.50], seabed: [0.26, 0.33, 0.30], snow: [1.5, 1.55, 1.68],
    treeline: 210, snowline: 340
  },
  road: {
    style: 'two-lane',                                          // cross-section: two-lane, highway, boulevard, dirt, gravel (world/roadstyles.js)
    step: 20, minRadius: 75,                                    // routing step and the tightest bend allowed
    look: 12, scout: 15, spread: 0.9, swing: 2.0,               // short-range steps looked ahead; long-range scouting distance (x 100 m); half-width of the steering cone; how far (radians) an arm may ever swing from its first bearing
    maxGrade: 0.08, hardGrade: 0.13, lastGrade: 0.2, maxCut: 14, smooth: 3, clearance: 2.5, maxAlt: 190,   // grade the router aims to stay under, grade never exceeded, height averaging (nodes each side), height kept above the sea, altitude the router avoids
    flat: 9, blend: 46, sink: 0.3,                              // grading: level out to 'flat' metres from the centre line, natural again by 'blend'
    wTurn: 8, wJerk: 14, wWander: 5, wBearing: 12, wGrade: 90, wSteep: 4000, wWater: 80, wHigh: 3, wCross: 5    // router cost weights
  },
  scatter: { trees: 0.0075, rocks: 0.0005, bushes: 0.0012, tufts: 0.009, clearRoad: 10, pineBias: 0, tint: null },      // scenery per square metre, and the strip kept clear beside the road
  view: {
    tile: 128,                                                  // tile edge
    rings: [{ r: 1, res: 64 }, { r: 3, res: 32 }, { r: 8, res: 16 }],   // level-of-detail rings: tiles out to r (in tiles) use res cells per edge
    far: { tile: 512, r: 9, res: 8, sink: 10 },                 // coarse horizon tiles beyond the rings, so distant mountains are visible
    scenery: { near: 1, far: 4, density: 1 },                   // tiles out to 'near' get grass and bushes; out to 'far' get trees and rocks
    budgetMs: 4,                                                // tile building time allowed per frame
    rebase: 1024                                                // re-centre the render origin when the player is this far from it
  }
};

export const VIEW_PRESETS = {
  low:  { rings: [{ r: 1, res: 32 }, { r: 2, res: 16 }, { r: 4, res: 8 }], far: { tile: 512, r: 5, res: 8, sink: 12 }, scenery: { near: 1, far: 2, density: 0.5 } },
  med:  { rings: [{ r: 1, res: 64 }, { r: 3, res: 32 }, { r: 8, res: 16 }], far: { tile: 512, r: 9, res: 8, sink: 10 }, scenery: { near: 1, far: 4, density: 1 } },
  high: { rings: [{ r: 2, res: 64 }, { r: 5, res: 32 }, { r: 12, res: 16 }], far: { tile: 512, r: 14, res: 16, sink: 8 }, scenery: { near: 2, far: 6, density: 1 } }
};

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
export function clone(v) { return JSON.parse(JSON.stringify(v)); }
/* deep-merge `over` onto a copy of `base`; arrays are replaced whole */
export function merge(base, over) {
  const out = clone(base);
  if (!isObj(over)) return out;
  for (const k of Object.keys(over)) out[k] = isObj(over[k]) && isObj(out[k]) ? merge(out[k], over[k]) : clone(over[k]);
  return out;
}
export function makeConfig(over) { return merge(DEFAULT_CONFIG, over); }

/* share codes: the config as compact text that survives a URL */
export function encodeConfig(cfg) { return btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function decodeConfig(code) {
  try { const b = code.replace(/-/g, '+').replace(/_/g, '/'); return makeConfig(JSON.parse(decodeURIComponent(escape(atob(b))))); } catch (e) { return null; }
}

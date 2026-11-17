/* The city enclave (docs/CITY_PACK.md section 3): the Delhi pack drawn at 1:1 around the player and answered to the car physics. Tiles of 1 km stream in around the player (fetched one or two at a time, built one per
   frame) and out again behind; each is five meshes (tilemesh.js). The ground is flat (the engine's terrain is configured flat for a city, see cityConfig), so the streets lie in the ground plane and flyovers are
   decks above it, answered to the vehicle physics through `deckMesh` / `deck`. Streets, buildings and stations register in the keep-out registry. Browser only. */
import * as THREE from 'three';
import { CityPack, footprintRect } from './pack.js';
import { buildTile, makeMaterials } from './tilemesh.js';

/* the world config of a city: the region's palette and plants, on flat land (no hills, no sea) with the engine's own placeholder road parked far away (the engine always has one road; here it only gives the vehicle code something to ask) */
export function cityConfig(base, seed) {
  const T = base.terrain, flatT = { ...T, seaLevel: 0, seabed: -40, lowland: 8, continent: { ...T.continent, rise: 0 }, coast: { lo: -9, hi: -8 }, hills: { ...T.hills, amp: 0 }, mountains: { ...T.mountains, amp: 0 }, detail: { ...T.detail, amp: 0 } };
  return { ...base, location: 'default', seed, terrain: flatT, palette: { ...base.palette, grass: [0.6, 0.55, 0.42], grass2: [0.5, 0.48, 0.36], dry: [0.62, 0.56, 0.42] }, scatter: { ...base.scatter, trees: 0.0006, rocks: 0, bushes: 0.0004, tufts: 0.002, clearRoad: 6 },
    road: { ...base.road, style: 'two-lane', start: { x: -200000, z: 0, y: 8 }, guide: [0, 0, 300, 0, 600, 0, 900, 0] } };
}

const RADIUS = 1300, KEEP = 1900, CELL = 16;
export class CityWorld {
  constructor(scene, origin, terrain, { base = 'assets/cities/delhi' } = {}) {
    this.scene = scene; this.origin = origin; this.terrain = terrain; this.ko = terrain.keepout; this.gy = terrain.base(0, 0); this.pack = new CityPack(base); this.group = new THREE.Group(); scene.add(this.group);
    this.mats = makeMaterials(); this.tiles = new Map(); this.loading = new Map(); this.ready = []; this.circ = new Map(); this.deckCells = new Map(); this.stats = { tiles: 0, buildings: 0, streets: 0, ms: 0, loaded: 0, failed: 0 }; this.labels = new Map();
  }
  async init() {
    await this.pack.init(); const { landmarks } = this.pack;
    for (const l of landmarks) if (l.footprint && l.footprint.length >= 6) { const station = (l.type || '').includes('station') || /station|terminal/.test(l.id); this.ko.add('city:lm:' + l.id, station ? 'station' : 'landmark', footprintRect(l.footprint, l.yaw || 0)); }       // landmarks and stations claim their ground
    this.pack.nearestStreet = (x, z) => this.nearestStreet(x, z); return this;
  }
  tileKey(tx, tz) { return tx + '_' + tz; }
  /* call every frame: wanted tiles are fetched, one is built per frame, far ones are dropped */
  update(px, pz) {
    const S = this.pack.size, tx0 = Math.floor((px - RADIUS) / S), tx1 = Math.floor((px + RADIUS) / S), tz0 = Math.floor((pz - RADIUS) / S), tz1 = Math.floor((pz + RADIUS) / S), want = [];
    for (let i = tx0; i <= tx1; i++) for (let j = tz0; j <= tz1; j++) { const k = this.tileKey(i, j); if (this.tiles.has(k) || this.loading.has(k) || !this.pack.hasTile(i, j)) continue; const d = Math.hypot(Math.max(i * S - px, 0, px - (i + 1) * S), Math.max(j * S - pz, 0, pz - (j + 1) * S)); if (d < RADIUS) want.push([d, i, j]); }
    want.sort((a, b) => a[0] - b[0]); for (const [, i, j] of want) { if (this.loading.size >= 3) break; this.fetchTile(i, j); }
    if (this.ready.length) { this.ready.sort((a, b) => Math.hypot((a.tx + 0.5) * S - px, (a.tz + 0.5) * S - pz) - Math.hypot((b.tx + 0.5) * S - px, (b.tz + 0.5) * S - pz)); const t = this.ready.shift(), k = this.tileKey(t.tx, t.tz); this.loading.delete(k); if (!this.tiles.has(k)) this.build(t); }
    for (const [k, t] of this.tiles) { const d = Math.hypot(Math.max(t.tx * S - px, 0, px - (t.tx + 1) * S), Math.max(t.tz * S - pz, 0, pz - (t.tz + 1) * S)); if (d > KEEP) this.drop(k); }
  }
  fetchTile(tx, tz) { const k = this.tileKey(tx, tz); this.loading.set(k, true); this.pack.tile(tx, tz).then(t => { if (t && this.loading.has(k)) this.ready.push(t); else this.loading.delete(k); }).catch(e => { this.stats.failed++; console.warn('city tile', k, e); this.loading.delete(k); }); }
  build(tile) {
    const t0 = performance.now(), S = this.pack.size, k = this.tileKey(tile.tx, tile.tz), { M, out } = buildTile(tile, { G: this.pack.G, lm: this.pack.lm, gy: this.gy, size: S });
    const grp = new THREE.Group(), meshes = []; for (const name of ['ground', 'park', 'walk', 'road', 'mark', 'bldg']) { if (M[name].empty) continue; const m = new THREE.Mesh(M[name].geometry(), this.mats[name]); m.receiveShadow = name === 'ground' || name === 'road'; m.matrixAutoUpdate = false; m.updateMatrix(); grp.add(m); meshes.push(m); }
    grp.position.set(tile.tx * S - this.origin.x, 0, tile.tz * S - this.origin.z); this.group.add(grp);
    /* the registry: the streets and buildings of this tile (one notification of the scenery for the whole tile, not one per claim) */
    const owner = 'city:tile:' + k, L = this.ko.listeners.slice(); this.ko.listeners.length = 0; let bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const c of out.claims) { const cl = this.ko.add(owner, c.kind || 'road', c.shape, { layer: c.layer || 0 }); bb = [Math.min(bb[0], cl.bb[0]), Math.min(bb[1], cl.bb[1]), Math.max(bb[2], cl.bb[2]), Math.max(bb[3], cl.bb[3])]; }
    for (const f of L) this.ko.listeners.push(f); if (bb[0] < Infinity) for (const f of L) f(bb);
    /* the cars: wall circles by 16 m cell */
    const cells = new Map(), c = out.circles; for (let i = 0; i < c.length; i += 3) { const key = this.ck(Math.floor(c[i] / CELL), Math.floor(c[i + 1] / CELL)); let l = cells.get(key); if (!l) cells.set(key, l = []); l.push(i); }
    const dk = []; for (const d of out.decks) for (let i = 0; i < d.pos.length; i += 6) dk.push({ x: (d.pos[i] + d.pos[i + 3]) / 2, z: (d.pos[i + 2] + d.pos[i + 5]) / 2, y: d.pos[i + 1], hw: d.hw });
    const deckCells = new Map(); for (const q of dk) { const key = this.ck(Math.floor(q.x / 6), Math.floor(q.z / 6)); let l = deckCells.get(key); if (!l) deckCells.set(key, l = []); l.push(q); }
    const labels = out.labels.map(l => this.label(grp, l, tile)); this.tiles.set(k, { tx: tile.tx, tz: tile.tz, streets: tile.streets, grp, meshes, owner, circ: { arr: c, cells }, decks: out.decks, deckCells, labels });
    this.stats.loaded++; this.stats.ms = performance.now() - t0; this.refreshStats();
  }
  ck(i, j) { return (i + 8192) * 16384 + (j + 8192); }
  label(grp, l, tile) {
    if (this.labels.has(l.id) && this.labels.get(l.id).parent) return null; const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d'); g.fillStyle = 'rgba(10,14,22,0.72)'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#fff'; g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let t = l.text; while (g.measureText(t).width > 490 && t.length > 6) t = t.slice(0, -2); g.fillText(t === l.text ? t : t + '…', 256, 48);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true, fog: false })); sp.scale.set(36, 6.75, 1); sp.position.set(l.x - tile.tx * this.pack.size, l.y, l.z - tile.tz * this.pack.size); grp.add(sp); this.labels.set(l.id, sp); return sp;
  }
  drop(k) {
    const t = this.tiles.get(k); if (!t) return; this.group.remove(t.grp); for (const m of t.meshes) m.geometry.dispose(); for (const l of t.labels) if (l) { this.labels.delete([...this.labels].find(([, v]) => v === l)?.[0]); l.material.map.dispose(); l.material.dispose(); }
    const L = this.ko.listeners.slice(); this.ko.listeners.length = 0; this.ko.removeOwner(t.owner); for (const f of L) this.ko.listeners.push(f); this.tiles.delete(k); this.refreshStats();
  }
  refreshStats() { let b = 0, s = 0; for (const t of this.tiles.values()) { for (const m of t.meshes) if (m.material === this.mats.bldg) b += m.geometry.index.count / 3; s += t.decks.length; } this.stats.tiles = this.tiles.size; this.stats.tris = b; this.stats.decks = s; }
  reposition() { for (const t of this.tiles.values()) t.grp.position.set(t.tx * this.pack.size - this.origin.x, 0, t.tz * this.pack.size - this.origin.z); }
  /* the vehicle physics asks: wall circles of the buildings near (x, z) */
  near(x, z, r) {
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL), j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL), S = this.pack.size, out = [];
    for (let tx = Math.floor((x - r) / S); tx <= Math.floor((x + r) / S); tx++) for (let tz = Math.floor((z - r) / S); tz <= Math.floor((z + r) / S); tz++) { const t = this.tiles.get(this.tileKey(tx, tz)); if (!t) continue; const a = t.circ.arr;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = t.circ.cells.get(this.ck(i, j)); if (l) for (const n of l) if (Math.abs(a[n] - x) < r + a[n + 2] && Math.abs(a[n + 1] - z) < r + a[n + 2]) out.push({ x: a[n], z: a[n + 1], r: a[n + 2] }); } }
    return out.length ? [out] : [];
  }
  /* deck triangles of the flyovers around (cx, cz) for the physics, in world metres: { pos, idx } or null */
  deckMesh(cx, cz, half) {
    const pos = [], idx = [];
    for (const t of this.tiles.values()) for (const d of t.decks) { const p = d.pos; let near = false; for (let i = 0; i < p.length; i += 6) if (Math.abs(p[i] - cx) < half + 20 && Math.abs(p[i + 2] - cz) < half + 20) { near = true; break; } if (!near) continue; const base = pos.length / 3; for (let i = 0; i < p.length; i++) pos.push(p[i]); for (const v of d.idx) idx.push(base + v); }
    return idx.length ? { pos, idx } : null;
  }
  /* the deck height over (x, z) or NaN: the nearest deck sample within its half width */
  deck(x, z) {
    const i = Math.floor(x / 6), j = Math.floor(z / 6); let best = NaN, bd = Infinity;
    for (const t of this.tiles.values()) { if (!t.decks.length) continue; for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) { const l = t.deckCells.get(this.ck(a, b)); if (l) for (const q of l) { const d = Math.hypot(q.x - x, q.z - z); if (d < q.hw + 1.5 && d < bd) { bd = d; best = q.y; } } } }
    return best;
  }
  /* the nearest street point to (x, z) among the loaded tiles, and its heading: for "back to the road" */
  nearestStreet(x, z) {
    const S = this.pack.size, G = this.pack.G; let best = null, bd = Infinity;
    for (const t of this.tiles.values()) for (const s of t.streets || []) { const cls = G.classes[G.cls[s.id]]; if (G.layer[s.id] !== 0 || cls === 'footway' || cls === 'cycleway') continue; const p = s.pts; for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L2 = dx * dx + dz * dz, f = L2 ? Math.max(0, Math.min(1, ((x - p[i]) * dx + (z - p[i + 1]) * dz) / L2)) : 0, qx = p[i] + dx * f, qz = p[i + 1] + dz * f, d = Math.hypot(qx - x, qz - z); if (d < bd) { bd = d; best = { x: qx, z: qz, yaw: Math.atan2(dz, dx), d, id: s.id }; } } }
    void S; return best;
  }
  summary() { const s = this.stats; return 'city        tiles ' + s.tiles + ' loading ' + this.loading.size + ' queued ' + this.ready.length + '  buildings ' + (s.tris / 1000).toFixed(0) + 'k tris  decks ' + s.decks + '  last tile ' + s.ms.toFixed(0) + ' ms'; }
}

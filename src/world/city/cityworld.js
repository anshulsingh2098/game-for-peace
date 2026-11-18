/* The city enclave (docs/CITY_PACK.md section 3): the Delhi pack drawn at 1:1 around the player and answered to the car physics. Tiles of 1 km stream in around the player (fetched one or two at a time, built one per
   frame) and out again behind; each is five meshes (tilemesh.js). The ground is flat (the engine's terrain is configured flat for a city, see cityConfig), so the streets lie in the ground plane and flyovers are
   decks above it, answered to the vehicle physics through `deckMesh` / `deck`. Streets, buildings and stations register in the keep-out registry. Browser only. */
import * as THREE from 'three';
import { CityPack, footprintRect } from './pack.js';
import { buildTileSteps, makeMaterials } from './tilemesh.js';
import { CityTraffic } from './citytraffic.js';
import { CityPeds } from './citypeds.js';
import { CityTransit } from './transit.js';
import { installCutHoles } from './cuts.js';
import { buildSkyline } from './skyline.js';
import { CityLandmarks } from './landmarks/index.js';
import { loadIdentity } from './identity.js';
import { StreetArt } from './streetart.js';
import { CityBuses } from './citybus.js';
import { WX } from '../../env/environment.js';

/* the world config of a city: the region's palette and plants, on flat land (no hills, no sea) with the engine's own placeholder road parked far away (the engine always has one road; here it only gives the vehicle code something to ask) */
export function cityConfig(base, seed) {
  const T = base.terrain, flatT = { ...T, seaLevel: -30, seabed: -60, lowland: 8, continent: { ...T.continent, rise: 0 }, coast: { lo: -9, hi: -8 }, hills: { ...T.hills, amp: 0 }, mountains: { ...T.mountains, amp: 0 }, detail: { ...T.detail, amp: 0 } };
  return { ...base, location: 'default', seed, terrain: flatT, palette: { ...base.palette, grass: [0.56, 0.53, 0.45], grass2: [0.54, 0.51, 0.44], dry: [0.57, 0.53, 0.45] }, scatter: { ...base.scatter, trees: 0, rocks: 0, bushes: 0, tufts: 0.0006, clearRoad: 6, shadows: false },
    road: { ...base.road, style: 'two-lane', start: { x: -200000, z: 0, y: 8 }, guide: [0, 0, 300, 0, 600, 0, 900, 0] } };
}

const NO_INFILL = typeof location !== 'undefined' && new URLSearchParams(location.search).has('noinfill'), NO_FILLERS = typeof location !== 'undefined' && new URLSearchParams(location.search).get('fillers') === '0', NO_FACADES = typeof location !== 'undefined' && new URLSearchParams(location.search).get('facades') === '0', NO_ROOFS = typeof location !== 'undefined' && new URLSearchParams(location.search).get('roofs') === '0', NO_PAINT = typeof location !== 'undefined' && new URLSearchParams(location.search).get('paint') === '0', KERB_WALL = false, SHADOW_D = 200, CELLED = { infill: 250, infillShop: 250, roof: 250, walk: 250, prop: 250, mark: 500, sign: 500, ban: 500, ad: 500 }, LOD_OF = { infill: 520, infillShop: 520, roof: 350, walk: 450, prop: 350, mark: 400, sign: 280, ban: 280, ad: 350 }, RADIUS = 1300, KEEP = 1900, CELL = 16, SLICE_MS = 3, FAR = 3800, LOD_NEAR = 450;                 // the detailed ring, when it is dropped, a tile's size, the budget of a frame for meshing, the far skyline radius, the radius of lane marks and kerbs
export class CityWorld {
  constructor(scene, origin, terrain, { base = 'assets/cities/delhi' } = {}) {
    this.base = base; this.scene = scene; this.origin = origin; this.terrain = terrain; this.ko = terrain.keepout; this.gy = terrain.base(0, 0) + 0.3;       /* the city stands 30 cm above the engine's own flat terrain: two ground planes at one height flicker */ this.pack = new CityPack(base); this.group = new THREE.Group(); scene.add(this.group);
    this.mats = makeMaterials(); this.mats.roof = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.25 }); this.mats.infill = this.mats.bldg; this.mats.infillShop = this.mats.shop; this.far = new Map(); this.farLoading = new Set(); this.retry = new Map(); this.cutCells = new Map(); this.openCuts = []; this.cuts = installCutHoles([this.mats.ground, this.mats.park, this.mats.walk]); this.tiles = new Map(); this.loading = new Map(); this.ready = []; this.circ = new Map(); this.geomMap = new Map(); this.onStreets = null; this.deckCells = new Map(); this.stats = { tiles: 0, buildings: 0, streets: 0, ms: 0, loaded: 0, failed: 0 }; this.labels = new Map();
  }
  async init() {
    await this.pack.init(); const { landmarks } = this.pack;
    await this.initLife(); this.traffic = new CityTraffic(this.scene, this.origin, this.pack.G, this.identity); this.peds = new CityPeds(this.scene, this.origin, this.traffic, this); this.traffic.peds = this.peds.list; this.transit = new CityTransit(this); await this.transit.init(); if (this.identity) { this.buses = new CityBuses(this).init(); this.traffic.buses = this.buses.list; this.traffic.onMode = m => this.buses.setMode(m); } const bs = this.transit.data && this.transit.data.bus && this.transit.data.bus.stops; if (bs) for (const q of bs) { const k = Math.floor(q[0] / this.pack.size) + '_' + Math.floor(q[1] / this.pack.size); let l = this.stops.get(k); if (!l) this.stops.set(k, l = []); l.push(q); }     // the Delhi Metro (transit*.js, D6)
    for (const l of landmarks) if (l.footprint && l.footprint.length >= 6) { const station = (l.type || '').includes('station') || /station|terminal/.test(l.id); this.ko.add('city:lm:' + l.id, station ? 'station' : 'landmark', footprintRect(l.footprint, l.yaw || 0)); }       // landmarks and stations claim their ground
    this.lmx = new CityLandmarks(this).init();                                                                                                   // the landmark models (landmarks/, D8): they replace the plain extruded footprints
    this.pack.nearestStreet = (x, z) => this.nearestStreet(x, z); return this;
  }
  /* D7: the identity of the city (identity.json), the canvas art and the bus stops by tile; without them the city is drawn plain */
  async initLife() {
    this.stops = new Map(); this.life = false; this.month = (() => { const m = /[?&]month=(\d+)/.exec(location.search); return m ? Math.max(1, Math.min(12, +m[1])) : new Date().getMonth() + 1; })();
    if (/[?&]life=off/.test(location.search)) return;                                   // ?life=off: the plain city (the street life costs draw calls and triangles; docs/DELHI_LOOK.md section 9)
    try { this.identity = await loadIdentity(this.base, this.pack.M.origin); this.art = new StreetArt(this.identity); this.mats.sign = this.art.mats.sign; this.mats.ad = this.art.mats.ad; this.mats.ban = this.art.mats.ban; this.mats.prop = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.25 }); this.life = true; const mo = this.identity.month(this.month), haze = Math.max(mo.smog || 0, mo.fog || 0, (mo.dust || 0) * 0.8); WX.clear.fogMul = 1 - 0.45 * haze; WX.overcast.fogMul = Math.min(WX.overcast.fogMul, 0.75 - 0.2 * haze); }       // the month's haze (identity.json sky): a clear day in November smog sees less far than one in August
    catch (e) { console.warn('identity.json not loaded, plain city:', e); }
  }
  tileKey(tx, tz) { return tx + '_' + tz; }
  /* call every frame: wanted tiles are fetched, one is built per frame, far ones are dropped */
  update(px, pz, dt = 0.016, py) {
    this.traffic.update(dt, px, pz, undefined, py); if (this.buses) this.buses.update(dt, px, pz, this.gy); this.transit.update(px, pz, dt); this.peds.update(dt, px, pz, this.gy); this.cuts.set(this.openCuts, this.origin, px, pz); this.lmx.update(px, pz);
    const S = this.pack.size, tx0 = Math.floor((px - RADIUS) / S), tx1 = Math.floor((px + RADIUS) / S), tz0 = Math.floor((pz - RADIUS) / S), tz1 = Math.floor((pz + RADIUS) / S), want = [];
    for (let i = tx0; i <= tx1; i++) for (let j = tz0; j <= tz1; j++) { const k = this.tileKey(i, j); if (this.tiles.has(k) || this.loading.has(k) || !this.pack.hasTile(i, j)) continue; { const r = this.retry.get(k); if (r && performance.now() < r.at) continue; }      // a tile that failed waits 1 s, 2 s, 4 s ... (at most 30 s) before it is asked for again (audit R10)
    const d = Math.hypot(Math.max(i * S - px, 0, px - (i + 1) * S), Math.max(j * S - pz, 0, pz - (j + 1) * S)); if (d < RADIUS) want.push([d, i, j]); }
    want.sort((a, b) => a[0] - b[0]); for (const [, i, j] of want) { if (this.loading.size >= 3) break; this.fetchTile(i, j); }
    if (this.job) this.stepJob(px, pz); else if (this.ready.length) { this.ready.sort((a, b) => Math.hypot((a.tx + 0.5) * S - px, (a.tz + 0.5) * S - pz) - Math.hypot((b.tx + 0.5) * S - px, (b.tz + 0.5) * S - pz)); const t = this.ready.shift(), k = this.tileKey(t.tx, t.tz); this.loading.delete(k); if (!this.tiles.has(k)) this.startJob(t); }
    this.updateFar(px, pz);
    for (const [k, t] of this.tiles) { const d = Math.hypot(Math.max(t.tx * S - px, 0, px - (t.tx + 1) * S), Math.max(t.tz * S - pz, 0, pz - (t.tz + 1) * S)); if (d > KEEP) this.drop(k); else for (const m of t.meshes) { const c = m.userData.cell, dm = c ? Math.hypot(Math.max(t.tx * S + c.x0 - px, 0, px - (t.tx * S + c.x1)), Math.max(t.tz * S + c.z0 - pz, 0, pz - (t.tz * S + c.z1))) : d; if (m.userData.near) m.visible = dm < (m.userData.lod || LOD_NEAR); if (m.userData.bld) m.castShadow = dm < SHADOW_D; } }
  }
  /* the far skyline: tiles beyond the detailed ring, as boxes of their tall and big buildings (skyline.js), one fetched at a time while nothing else is loading */
  updateFar(px, pz) {
    const S = this.pack.size; for (const [k, f] of this.far) { const d = Math.hypot((f.tx + 0.5) * S - px, (f.tz + 0.5) * S - pz); if (d > FAR + 700 || this.tiles.has(k)) { this.group.remove(f.mesh); if (f.mesh.geometry) f.mesh.geometry.dispose(); this.far.delete(k); } }
    if (this.loading.size || this.job || this.farLoading.size >= 2) return; const tx0 = Math.floor((px - FAR) / S), tx1 = Math.floor((px + FAR) / S), tz0 = Math.floor((pz - FAR) / S), tz1 = Math.floor((pz + FAR) / S); let best = null, bd = Infinity;
    for (let i = tx0; i <= tx1; i++) for (let j = tz0; j <= tz1; j++) { const k = this.tileKey(i, j); if (this.tiles.has(k) || this.far.has(k) || this.farLoading.has(k) || !this.pack.hasTile(i, j)) continue; const d = Math.hypot((i + 0.5) * S - px, (j + 0.5) * S - pz); if (d < FAR && d < bd) { bd = d; best = [i, j, k]; } }
    if (!best) return; const [i, j, k] = best; this.farLoading.add(k);
    this.pack.tile(i, j).then(t => { this.farLoading.delete(k); if (!t || this.tiles.has(k)) return; const g = buildSkyline(t, { gy: this.gy, size: S, dense: bd < 2800 }); if (!g) { this.far.set(k, { tx: i, tz: j, mesh: new THREE.Object3D(), empty: true }); return; } const m = new THREE.Mesh(g, this.mats.sky); m.matrixAutoUpdate = false; m.position.set(i * S - this.origin.x, 0, j * S - this.origin.z); m.updateMatrix(); this.group.add(m); this.far.set(k, { tx: i, tz: j, mesh: m }); }).catch(() => { this.farLoading.delete(k); });
  }
  fetchTile(tx, tz) { const k = this.tileKey(tx, tz); this.loading.set(k, true); this.pack.tile(tx, tz).then(t => { if (t && this.loading.has(k)) { this.ready.push(t); this.retry.delete(k); } else this.loading.delete(k); }).catch(e => { this.stats.failed++; console.warn('city tile', k, e); this.loading.delete(k); const n = (this.retry.get(k) || { n: 0 }).n + 1; this.retry.set(k, { n, at: performance.now() + Math.min(30000, 1000 * 2 ** (n - 1)) }); }); }
  /* a tile is meshed in slices of about SLICE_MS a frame (tilemesh.js buildTileSteps), then added to the scene in one go */
  startJob(tile) { this.job = { tile, t0: performance.now(), cpu: 0, gen: buildTileSteps(tile, { infill: !NO_INFILL, fillers: !NO_FILLERS, roofs: !NO_ROOFS, facades: !NO_FACADES, paint: NO_PAINT ? false : undefined, G: this.pack.G, lm: this.pack.lm, gy: this.gy, size: this.pack.size, skip: this.lmx.skip, life: this.life && { identity: this.identity, art: this.art, month: this.month, stops: this.stops.get(tile.tx + '_' + tile.tz) || [] }, yieldNow: () => performance.now() > this.deadline }) }; this.stepJob(); }
  stepJob() {
    const j = this.job, t = performance.now(); this.deadline = t + SLICE_MS; const r = j.gen.next(); const dt = performance.now() - t; j.cpu += dt; j.slice = Math.max(j.slice || 0, dt);
    if (r.done) { this.job = null; const t1 = performance.now(); this.build(j.tile, r.value.M, r.value.out); const bt = performance.now() - t1; this.stats.ms = j.cpu + bt; this.stats.buildMs = bt; this.stats.buildMax = Math.max(this.stats.buildMax || 0, bt); this.stats.sliceMax = Math.max(this.stats.sliceMax || 0, j.slice || 0); this.stats.slices = (this.stats.slices || 0) + 1; }
  }
  flagMesh(m, name) { m.receiveShadow = name !== 'sky' && !name.startsWith('bldg') || name === 'bldg'; m.matrixAutoUpdate = false; m.updateMatrix(); m.userData.near = name === 'mark' || name === 'walk' || name === 'sign' || name === 'ad' || name === 'ban' || name === 'prop' || name === 'infill' || name === 'infillShop' || name === 'roof'; m.userData.bld = name.startsWith('bldg') || name === 'shop'; m.userData.lod = LOD_OF[name] || LOD_NEAR; m.castShadow = m.userData.bld; }
  build(tile, M, out) {
    const S = this.pack.size, k = this.tileKey(tile.tx, tile.tz);
    const grp = new THREE.Group(), meshes = []; for (const name of ['ground', 'park', 'walk', 'road', 'mark', 'bldg', 'bldgO', 'bldgG', 'shop', 'sign', 'ad', 'ban', 'prop', 'infill', 'infillShop', 'roof']) { if (!M[name] || M[name].empty) continue; const cs = CELLED[name]; if (cs) { for (const c of M[name].cells(cs)) { const m = new THREE.Mesh(c.geo, this.mats[name]); this.flagMesh(m, name); m.userData.cell = { x0: c.gx * cs, z0: c.gz * cs, x1: (c.gx + 1) * cs, z1: (c.gz + 1) * cs }; grp.add(m); meshes.push(m); } continue; } const m = new THREE.Mesh(M[name].geometry(), this.mats[name]); m.receiveShadow = name !== 'sky' && !name.startsWith('bldg') || name === 'bldg'; m.matrixAutoUpdate = false; m.updateMatrix(); m.userData.near = name === 'mark' || name === 'walk' || name === 'sign' || name === 'ad' || name === 'ban' || name === 'prop' || name === 'infill' || name === 'infillShop' || name === 'roof'; m.userData.bld = name.startsWith('bldg') || name === 'shop'; m.castShadow = m.userData.bld; grp.add(m); meshes.push(m); }
    grp.position.set(tile.tx * S - this.origin.x, 0, tile.tz * S - this.origin.z); this.group.add(grp);
    /* the registry: the streets and buildings of this tile (one notification of the scenery for the whole tile, not one per claim) */
    const owner = 'city:tile:' + k, L = this.ko.listeners.slice(); this.ko.listeners.length = 0; let bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const c of out.claims) { const cl = this.ko.add(owner, c.kind || 'road', c.shape, { layer: c.layer || 0 }); bb = [Math.min(bb[0], cl.bb[0]), Math.min(bb[1], cl.bb[1]), Math.max(bb[2], cl.bb[2]), Math.max(bb[3], cl.bb[3])]; }
    for (const f of L) this.ko.listeners.push(f); if (bb[0] < Infinity) for (const f of L) f(bb);
    /* the cars: wall circles by 16 m cell */
    const cells = new Map(), c = out.circles; for (let i = 0; i < c.length; i += 3) { const key = this.ck(Math.floor(c[i] / CELL), Math.floor(c[i + 1] / CELL)); let l = cells.get(key); if (!l) cells.set(key, l = []); l.push(i); }
    const dk = []; for (const d of out.decks) for (let i = 0; i < d.pos.length; i += 6) dk.push({ x: (d.pos[i] + d.pos[i + 3]) / 2, z: (d.pos[i + 2] + d.pos[i + 5]) / 2, y: d.pos[i + 1], hw: d.hw });
    const deckCells = new Map(); for (const q of dk) { const key = this.ck(Math.floor(q.x / 6), Math.floor(q.z / 6)); let l = deckCells.get(key); if (!l) deckCells.set(key, l = []); l.push(q); }
    const labels = out.labels.map(l => this.label(grp, l, tile)); this.tiles.set(k, { tx: tile.tx, tz: tile.tz, streets: tile.streets, grp, meshes, owner, circ: { arr: c, cells }, decks: out.decks, deckCells, labels, stalls: out.stallPts });
    const ckeys = []; for (const c of out.cuts) { c.id = k; const n = Math.max(1, Math.ceil(Math.hypot(c.x1 - c.x0, c.z1 - c.z0) / 3)); for (let q = 0; q <= n; q++) { const key = this.ck(Math.floor((c.x0 + (c.x1 - c.x0) * q / n) / 6), Math.floor((c.z0 + (c.z1 - c.z0) * q / n) / 6)); let l = this.cutCells.get(key); if (!l) this.cutCells.set(key, l = []); if (l[l.length - 1] !== c) { l.push(c); ckeys.push(key); } } if (c.open) this.openCuts.push(c); }
    this.tiles.get(k).cuts = out.cuts; this.tiles.get(k).ckeys = ckeys;
    for (const s of tile.streets) { if (s.pts.length < 4) continue; let l = this.geomMap.get(s.id); if (!l) this.geomMap.set(s.id, l = []); l.push({ k, pts: s.pts }); } if (this.onStreets) this.onStreets();
    this.traffic.addTile(k, tile.streets, this.gy); this.stats.loaded++; this.refreshStats();
  }
  ck(i, j) { return (i + 8192) * 16384 + (j + 8192); }
  label(grp, l, tile) {
    if (this.labels.has(l.id) && this.labels.get(l.id).parent) return null; const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d'); g.fillStyle = 'rgba(10,14,22,0.72)'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#fff'; g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let t = l.text; while (g.measureText(t).width > 490 && t.length > 6) t = t.slice(0, -2); g.fillText(t === l.text ? t : t + '…', 256, 48);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true, fog: false })); sp.scale.set(36, 6.75, 1); sp.position.set(l.x - tile.tx * this.pack.size, l.y, l.z - tile.tz * this.pack.size); grp.add(sp); this.labels.set(l.id, sp); return sp;
  }
  drop(k) {
    const t = this.tiles.get(k); if (!t) return; this.group.remove(t.grp); for (const m of t.meshes) m.geometry.dispose(); for (const l of t.labels) if (l) { this.labels.delete([...this.labels].find(([, v]) => v === l)?.[0]); l.material.map.dispose(); l.material.dispose(); }
    const L = this.ko.listeners.slice(); this.ko.listeners.length = 0; this.ko.removeOwner(t.owner); for (const f of L) this.ko.listeners.push(f); if (t.cuts && t.cuts.length) { const dead = new Set(t.cuts); for (const key of new Set(t.ckeys)) { const l = this.cutCells.get(key); if (l) { const n = l.filter(c => !dead.has(c)); if (n.length) this.cutCells.set(key, n); else this.cutCells.delete(key); } } this.openCuts = this.openCuts.filter(c => !dead.has(c)); }
    this.traffic.removeTile(k); for (const s of t.streets) { const l = this.geomMap.get(s.id); if (l) { const n = l.filter(q => q.k !== k); if (n.length) this.geomMap.set(s.id, n); else this.geomMap.delete(s.id); } } this.tiles.delete(k); this.refreshStats();
  }
  refreshStats() { let b = 0, s = 0; for (const t of this.tiles.values()) { for (const m of t.meshes) if (m.userData.bld) b += m.geometry.index.count / 3; s += t.decks.length; } this.stats.tiles = this.tiles.size; this.stats.tris = b; this.stats.decks = s; }
  setNight(on) { if (on !== this.night) { this.night = on; this.mats.setNight(on); this.lmx.setNight(on); if (this.art) this.art.setNight(on); } }
  reposition() { for (const t of this.tiles.values()) t.grp.position.set(t.tx * this.pack.size - this.origin.x, 0, t.tz * this.pack.size - this.origin.z); for (const f of this.far.values()) { f.mesh.position.set(f.tx * this.pack.size - this.origin.x, 0, f.tz * this.pack.size - this.origin.z); f.mesh.updateMatrix(); } this.transit.reposition(); this.lmx.reposition(); }
  /* the loaded geometry of street edge `id` as flat points running a -> b (pieces from several tiles are chained), or null when no tile with it is loaded: for the GPS route line and autodrive */
  edgeGeom(id) {
    const l = this.geomMap.get(id); if (!l) return null; const G = this.pack.G, A = G.a[id], ax = G.xz[A * 2], az = G.xz[A * 2 + 1]; if (l.length === 1) { const p = l[0].pts; return Math.hypot(p[0] - ax, p[1] - az) <= Math.hypot(p[p.length - 2] - ax, p[p.length - 1] - az) ? p : this.rev(p); }
    const left = l.map(q => q.pts), out = []; let cx = ax, cz = az; while (left.length) { let bi = 0, bf = true, bd = Infinity; left.forEach((p, i) => { const d0 = Math.hypot(p[0] - cx, p[1] - cz), d1 = Math.hypot(p[p.length - 2] - cx, p[p.length - 1] - cz); if (d0 < bd) { bd = d0; bi = i; bf = true; } if (d1 < bd) { bd = d1; bi = i; bf = false; } }); const p = left.splice(bi, 1)[0], q = bf ? p : this.rev(p); for (let i = 0; i < q.length; i++) out.push(q[i]); cx = q[q.length - 2]; cz = q[q.length - 1]; }
    return out;
  }
  rev(p) { const o = []; for (let i = p.length - 2; i >= 0; i -= 2) o.push(p[i], p[i + 1]); return o; }
  /* the vehicle physics asks: wall circles of the buildings near (x, z) */
  near(x, z, r) {
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL), j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL), S = this.pack.size, out = [];
    for (let tx = Math.floor((x - r) / S); tx <= Math.floor((x + r) / S); tx++) for (let tz = Math.floor((z - r) / S); tz <= Math.floor((z + r) / S); tz++) { const t = this.tiles.get(this.tileKey(tx, tz)); if (!t) continue; const a = t.circ.arr;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = t.circ.cells.get(this.ck(i, j)); if (l) for (const n of l) if ((KERB_WALL || a[n + 2] > 0) && Math.abs(a[n] - x) < r + Math.abs(a[n + 2]) && Math.abs(a[n + 1] - z) < r + Math.abs(a[n + 2])) out.push({ x: a[n], z: a[n + 1], r: Math.abs(a[n + 2]), y: this.gy, kerb: a[n + 2] < 0 }); } }
    const tc = this.traffic.circles(x, z, r).concat(this.peds.circles(x, z, r), this.transit.circles(x, z, r), this.lmx.circles(x, z, r), this.buses ? this.buses.circles(x, z, r) : []); return out.length || tc.length ? [out.concat(tc)] : [];
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
    const td = this.transit.ok ? this.transit.deckAt(x, z) : NaN; return td === td && !(best > td) ? td : best;
  }
  /* the ground height at (x, z): the flat ground, lowered inside an underpass strip (the cut and the covered trench; a roof deck above the covered part carries the cars crossing over) */
  groundAt(x, z) {
    if (!this.cutCells.size) return this.gy; const i = Math.floor(x / 6), j = Math.floor(z / 6); let best = 0, bd = Infinity;
    for (let a = i - 2; a <= i + 2; a++) for (let b = j - 2; b <= j + 2; b++) { const l = this.cutCells.get(this.ck(a, b)); if (l) for (const c of l) { const dx = c.x1 - c.x0, dz = c.z1 - c.z0, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((x - c.x0) * dx + (z - c.z0) * dz) / L2)) : 0, d = Math.hypot(c.x0 + dx * t - x, c.z0 + dz * t - z); if (d < c.phw && d < bd) { bd = d; best = c.d0 + (c.d1 - c.d0) * t; } } }
    return this.gy - best;
  }
  /* the nearest street point to (x, z) among the loaded tiles, and its heading: for "back to the road" */
  nearestStreet(x, z) {
    const S = this.pack.size, G = this.pack.G; let best = null, bd = Infinity;
    for (const t of this.tiles.values()) for (const s of t.streets || []) { const cls = G.classes[G.cls[s.id]]; if (G.layer[s.id] !== 0 || cls === 'footway' || cls === 'cycleway') continue; const p = s.pts; for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L2 = dx * dx + dz * dz, f = L2 ? Math.max(0, Math.min(1, ((x - p[i]) * dx + (z - p[i + 1]) * dz) / L2)) : 0, qx = p[i] + dx * f, qz = p[i + 1] + dz * f, d = Math.hypot(qx - x, qz - z); if (d < bd) { bd = d; best = { x: qx, z: qz, yaw: Math.atan2(dz, dx), d, id: s.id }; } } }
    void S; return best;
  }
  summary() { const s = this.stats; return 'city        tiles ' + s.tiles + ' loading ' + this.loading.size + ' queued ' + this.ready.length + '  buildings ' + (s.tris / 1000).toFixed(0) + 'k tris  decks ' + s.decks + '  last tile ' + s.ms.toFixed(0) + ' ms\n' + this.transit.summary() + (this.buses && this.buses.ok ? '\n' + this.buses.summary() : ''); }
}

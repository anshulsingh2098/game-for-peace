/* The road you see: a ribbon mesh built from a RoadStyle along the routed centre line, in 200 m pieces
   that come and go around the player. Lane markings are a second mesh just above the surface. */
import * as THREE from 'three';
import { Bridges } from './bridges.js';
import { Tunnels } from './tunnels.js';
import { Retaining } from './retaining.js';
import { District } from './district.js';
import { Highway } from './highway.js';
import { PORTAL_W } from './router.js';

export { TWO_LANE } from './roadstyles.js';          // styles are data in roadstyles.js: see there for the cross-section format

/* texture sets: material key -> [file in assets (CC0, ambientCG), metres one texture tile covers] */
const MATERIALS = { asphalt: ['roads/asphalt', 3], gravel: ['roads/gravel', 1.8], dirt: ['ground/sand', 2], pave: ['roads/pavement', 2], grass: ['ground/grass', 2.5] };
const loader = new THREE.TextureLoader();
function roadMaterial(key) {
  const [file, size] = MATERIALS[key], load = (kind, srgb) => {
    const t = loader.load(`assets/${file}_${kind}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / size, 1 / size); t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  return new THREE.MeshStandardMaterial({ vertexColors: true, map: load('color', true), normalMap: load('normal'), roughnessMap: load('rough'), roughness: 0.95, metalness: 0, envMapIntensity: 0.2,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
}

const ROWS = 40;                                                // rows per piece; a row every road.ds metres

export class RoadMesh {
  constructor(scene, road, style, origin, extras = {}) {
    this.road = road; this.style = style; this.origin = origin; this.len = ROWS * road.ds; this.pieces = new Map(); this.range = 2200;
    this.mats = {};                                             // one material per texture set
    for (const key of Object.keys(MATERIALS)) this.mats[key] = roadMaterial(key);
    this.matKeys = Object.keys(this.mats); this.matList = this.matKeys.map(k => this.mats[k]);
    for (const mt of this.matList) mt.color = this.mats.asphalt.color;                         // one shared tint colour, so the weather's wet-road dimming reaches every material
    /* the weather (env.attach) drives ONE material: this stand-in forwards every change to all of them */
    this.surface = new Proxy(this.mats.asphalt, { set: (t, k, v) => { for (const mt of this.matList) if (k !== 'color') mt[k] = v; return true; } });
    this.paint = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
    this.group = new THREE.Group(); scene.add(this.group); this._p = {};
    this.bridges = new Bridges(scene, road, road.t, style, origin, ROWS);                     // decks, rails and piers where the road crosses water
    this.retaining = new Retaining(scene, road, road.t, style, origin, ROWS);                  // stone walls where the road is cut into a steep hill or runs along a drop
    this.district = extras.district ? new District(scene, road, road.t, style, origin, ROWS, { spec: extras.district, seed: extras.seed || 'district', blocked: extras.blocked || (() => false) }) : null;      // buildings, sidewalks, crossings and street furniture where the region is built up
    this.highway = new Highway(scene, road, road.t, style, origin, ROWS, { seed: extras.seed || 'highway', dests: extras.dests || [], gates: extras.gates || [] });      // guardrails, km stones, sign gantries and toll plazas on national highways
    this.tunnels = new Tunnels(scene, road, style, origin, ROWS);                              // tubes and portals where the road goes through a mountain
  }
  /* keep pieces within range of road distance s; build at most a few per frame */
  update(s) {
    this.bridges.update(s); this.tunnels.update(s); this.retaining.update(s); if (this.district) this.district.update(s); this.highway.update(s);
    const r = this.road, L = this.len, lo = Math.floor(Math.max(r.sMin + L, s - this.range) / L), hi = Math.floor(Math.min(r.sMax - L, s + this.range) / L) - 1;
    for (const [k, p] of this.pieces) if (k < lo - 1 || k > hi + 1) { this.drop(p); this.pieces.delete(k); }
    const t0 = performance.now(), mid = Math.floor(s / L);
    for (let d = 0; d <= hi - lo + 1; d++) for (const k of d ? [mid + d, mid - d] : [mid]) {
      if (k < lo || k > hi || this.pieces.has(k)) continue;
      this.pieces.set(k, this.build(k)); if (performance.now() - t0 > 3) return;
    }
  }
  build(k) {
    const r = this.road, st = this.style, p = this._p, s0 = k * this.len, o = r.at(s0, {}), ox = o.x, oz = o.z, nc = st.cols.length;
    const pos = [], col = [], uv = [], idxBy = {}, mk = k => (st.mats || {})[k] || 'asphalt', lp = [], lc = [], li = [];
    const bridged = []; for (let row = 0; row <= ROWS; row++) bridged.push(r.bridgeW(s0 + row * r.ds) === 1 || r.tunnelW(s0 + row * r.ds) >= PORTAL_W);       // rows on a bridge (see bridges.js)
    for (let row = 0; row <= ROWS; row++) {
      const s = s0 + row * r.ds; r.at(s, p); const nx = -p.tz, nz = p.tx;          // nx, nz: unit vector pointing to the right of travel
      for (const [t, drop, kind, u] of st.cols) { pos.push(p.x + nx * t - ox, p.y - drop, p.z + nz * t - oz); col.push(...st.colour[kind]); uv.push(t, s); }
      const onBridge = row < ROWS && bridged[row] && bridged[row + 1];                              // on a bridge the verge beyond the rails is left out
      if (row < ROWS) for (const [a, b] of st.strips) { if (onBridge && (Math.abs(st.cols[a][0]) > st.shoulder + 0.01 || Math.abs(st.cols[b][0]) > st.shoulder + 0.01)) continue; const ma = mk(st.cols[a][2]), mb = mk(st.cols[b][2]), mm = ma === mb ? ma : ma === 'asphalt' ? mb : ma; const A = row * nc + a, B = row * nc + b, C = A + nc, D = B + nc; (idxBy[mm] || (idxBy[mm] = [])).push(A, B, C, B, D, C); }
      for (const ln of st.lines) if (!ln.dash) {
        const v = lp.length / 3; for (const tt of [ln.t - ln.w / 2, ln.t + ln.w / 2]) { lp.push(p.x + nx * tt - ox, p.y + 0.035, p.z + nz * tt - oz); lc.push(...st.colour.line); }
        if (row < ROWS) li.push(v, v + 1, v + 2 * this.solid, v + 1, v + 2 * this.solid + 1, v + 2 * this.solid);
      }
    }
    for (const ln of st.lines) if (ln.dash) {                     // dashes are placed by road distance, so they line up across pieces
      const period = ln.dash[0] + ln.dash[1];
      for (let s = Math.ceil(s0 / period) * period; s < s0 + this.len; s += period) {
        const v = lp.length / 3, cuts = 2;
        for (let c = 0; c <= cuts; c++) { r.at(s + ln.dash[0] * c / cuts, p); const nx = -p.tz, nz = p.tx; for (const tt of [ln.t - ln.w / 2, ln.t + ln.w / 2]) { lp.push(p.x + nx * tt - ox, p.y + 0.035, p.z + nz * tt - oz); lc.push(...st.colour.line); } }
        for (let c = 0; c < cuts; c++) { const a = v + c * 2; li.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
    }
    const idx = [], groups = []; for (const [i, k] of this.matKeys.entries()) { const a = idxBy[k] || []; if (a.length) { groups.push([idx.length, a.length, i]); idx.push(...a); } }
    const geo = (P, C, I, U) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); if (U) g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); if (U) for (const [g0, n0, m0] of groups) g.addGroup(g0, n0, m0); g.computeVertexNormals(); return g; };
    const grp = new THREE.Group(); const rs = new THREE.Mesh(geo(pos, col, idx, uv), this.matList); rs.receiveShadow = true; grp.add(rs, new THREE.Mesh(geo(lp, lc, li), this.paint));
    grp.userData = { x: ox, z: oz }; grp.position.set(ox - this.origin.x, 0, oz - this.origin.z); this.group.add(grp); return grp;
  }
  get solid() { return this.style.lines.filter(l => !l.dash).length; }
  drop(grp) { this.group.remove(grp); for (const m of grp.children) m.geometry.dispose(); }
  reposition() { for (const g of this.pieces.values()) g.position.set(g.userData.x - this.origin.x, 0, g.userData.z - this.origin.z); this.bridges.reposition(); this.tunnels.reposition(); this.retaining.reposition(); this.highway.reposition(); if (this.district) this.district.reposition(); }
  dispose() { this.bridges.dispose(); this.tunnels.dispose(); this.retaining.dispose(); this.highway.dispose(); if (this.district) this.district.dispose(); for (const g of this.pieces.values()) this.drop(g); this.pieces.clear(); this.group.parent && this.group.parent.remove(this.group); for (const mt of this.matList) { for (const t of [mt.map, mt.normalMap, mt.roughnessMap]) t && t.dispose(); mt.dispose(); } this.paint.dispose(); }
}

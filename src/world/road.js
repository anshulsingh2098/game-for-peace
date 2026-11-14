/* The road you see: a ribbon mesh built from a RoadStyle along the routed centre line, in 200 m pieces
   that come and go around the player. Lane markings are a second mesh just above the surface. */
import * as THREE from 'three';
import { asphaltTex } from './textures.js';

export { TWO_LANE } from './roadstyles.js';          // styles are data in roadstyles.js: see there for the cross-section format

const ROWS = 40;                                                // rows per piece; a row every road.ds metres

export class RoadMesh {
  constructor(scene, road, style, origin) {
    this.road = road; this.style = style; this.origin = origin; this.len = ROWS * road.ds; this.pieces = new Map(); this.range = 2200;
    this.surface = new THREE.MeshStandardMaterial({ vertexColors: true, map: asphaltTex(), roughness: 0.95, metalness: 0, envMapIntensity: 0.2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    this.paint = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
    this.group = new THREE.Group(); scene.add(this.group); this._p = {};
  }
  /* keep pieces within range of road distance s; build at most a few per frame */
  update(s) {
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
    const pos = [], col = [], uv = [], idx = [], lp = [], lc = [], li = [];
    for (let row = 0; row <= ROWS; row++) {
      const s = s0 + row * r.ds; r.at(s, p); const nx = -p.tz, nz = p.tx;          // nx, nz: unit vector pointing to the right of travel
      for (const [t, drop, kind, u] of st.cols) { pos.push(p.x + nx * t - ox, p.y - drop, p.z + nz * t - oz); col.push(...st.colour[kind]); uv.push(u, s / 9); }
      if (row < ROWS) for (const [a, b] of st.strips) { const A = row * nc + a, B = row * nc + b, C = A + nc, D = B + nc; idx.push(A, B, C, B, D, C); }
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
    const geo = (P, C, I, U) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); if (U) g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); return g; };
    const grp = new THREE.Group(); const rs = new THREE.Mesh(geo(pos, col, idx, uv), this.surface); rs.receiveShadow = true; grp.add(rs, new THREE.Mesh(geo(lp, lc, li), this.paint));
    grp.userData = { x: ox, z: oz }; grp.position.set(ox - this.origin.x, 0, oz - this.origin.z); this.group.add(grp); return grp;
  }
  get solid() { return this.style.lines.filter(l => !l.dash).length; }
  drop(grp) { this.group.remove(grp); for (const m of grp.children) m.geometry.dispose(); }
  reposition() { for (const g of this.pieces.values()) g.position.set(g.userData.x - this.origin.x, 0, g.userData.z - this.origin.z); }
  dispose() { for (const g of this.pieces.values()) this.drop(g); this.pieces.clear(); this.group.parent && this.group.parent.remove(this.group); this.surface.dispose(); this.paint.dispose(); }
}

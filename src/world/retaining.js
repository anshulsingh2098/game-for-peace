/* Retaining walls and parapets where the road is cut into a steep hillside or runs along a drop (Master Plan N3). Visual only: the heightfield already stops the car at the foot of a
   cutting, and the drop is not reachable past the parapet's line without leaving the road.
   - Cut: where the land climbs more than CUT_RISE metres within 3 m of the edge of the levelled road bed, a stone wall stands on the bed's edge, as high as the climb (at most
     CUT_MAX) with a coping on top, so the hill meets the road in a wall and not in a stretched texture.
   - Fill: where the land falls away more than FILL_DROP metres, a low stone parapet (0.9 m) runs along the road edge with a wall face going down.
   Rows on bridges and in tunnels are skipped. One merged mesh per piece of road, same piece scheme as bridges.js. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export const CUT_RISE = 1.4, CUT_MAX = 4.5, FILL_DROP = 1.8, FILL_DEPTH = 5, PARAPET = 0.9;
export class Retaining {
  constructor(scene, road, terrain, style, origin, rows) {
    this.road = road; this.t = terrain; this.style = style; this.origin = origin; this.rows = rows; this.len = rows * road.ds; this.pieces = new Map(); this.range = 1500;
    this.mat = new THREE.MeshStandardMaterial({ color: 0x8d877b, roughness: 0.95, metalness: 0, envMapIntensity: 0.3, side: THREE.DoubleSide, flatShading: true });
    this.cap = new THREE.MeshStandardMaterial({ color: 0xb5afa3, roughness: 0.9, metalness: 0, envMapIntensity: 0.3, side: THREE.DoubleSide });
    this.group = new THREE.Group(); scene.add(this.group); this._p = {};
  }
  update(s) {
    const r = this.road, L = this.len, lo = Math.floor(Math.max(r.sMin + L, s - this.range) / L), hi = Math.floor(Math.min(r.sMax - L, s + this.range) / L) - 1;
    for (const [k, p] of this.pieces) if (k < lo - 1 || k > hi + 1) { this.drop(p); this.pieces.delete(k); }
    for (let k = lo; k <= hi; k++) if (!this.pieces.has(k)) { this.pieces.set(k, this.build(k)); return; }
  }
  /* what the roadside looks like at road distance s on a side (+1 left, -1 right): { kind: 'cut' | 'fill' | null, h (wall or drop height) } */
  probe(s, side, p) {
    const r = this.road; r.at(s, p); if (r.carriedW(s) > 0.01) return null;
    const dw = r.g.flat - 0.4, nx = -p.tz * side, nz = p.tx * side, H = d => this.t.height(p.x + nx * d, p.z + nz * d), h0 = H(dw), h3 = H(dw + 3), rise = h3 - h0;
    if (rise > CUT_RISE) return { kind: 'cut', d: dw, y: p.y, top: Math.min(CUT_MAX, rise + 0.3) };
    if (rise < -FILL_DROP) return { kind: 'fill', d: this.style.outer + 0.35, y: p.y, top: Math.min(FILL_DEPTH, -rise * 0.8) };
    return null;
  }
  build(k) {
    const r = this.road, ds = r.ds, s0 = k * this.len, n = this.rows, o = r.at(s0, {}), ox = o.x, oz = o.z, p = this._p, wall = [], coping = [];
    const quad = (A, a, b, c, d) => { const v = A.P.length / 3; A.P.push(...a, ...b, ...c, ...d); A.I.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }, W = { P: [], I: [] }, C = { P: [], I: [] };
    for (const side of [1, -1]) {
      let prev = null;
      for (let row = 0; row <= n; row++) {
        const s = s0 + row * ds, q = this.probe(s, side, p); let cur = null;
        if (q) { const nx = -p.tz * side, nz = p.tx * side, at = (d, y) => [p.x + nx * d - ox, y, p.z + nz * d - oz]; cur = { q, kind: q.kind, at }; cur.pos = { x: p.x, z: p.z, nx, nz }; }
        if (prev && cur && prev.kind === cur.kind) {
          const a = prev, b = cur, A = a.q, B = b.q, cut = a.kind === 'cut', inner = (e, d) => d;
          if (cut) { quad(W, a.at(A.d, A.y - 0.4), a.at(A.d, A.y + A.top), b.at(B.d, B.y - 0.4), b.at(B.d, B.y + B.top)); quad(C, a.at(A.d - 0.7, A.y + A.top), a.at(A.d + 0.2, A.y + A.top), b.at(B.d - 0.7, B.y + B.top), b.at(B.d + 0.2, B.y + B.top)); }
          else {
            quad(W, a.at(A.d, A.y + PARAPET), a.at(A.d, A.y - A.top), b.at(B.d, B.y + PARAPET), b.at(B.d, B.y - B.top));            // outer face, from the parapet top down the drop
            quad(W, a.at(A.d - 0.4, A.y), a.at(A.d - 0.4, A.y + PARAPET), b.at(B.d - 0.4, B.y), b.at(B.d - 0.4, B.y + PARAPET));      // inner face, toward the road
            quad(C, a.at(A.d - 0.4, A.y + PARAPET), a.at(A.d + 0.05, A.y + PARAPET), b.at(B.d - 0.4, B.y + PARAPET), b.at(B.d + 0.05, B.y + PARAPET));
          }
        }
        prev = cur;
      }
    }
    if (!W.P.length) return null;
    const grp = new THREE.Group();
    for (const [A, m] of [[W, this.mat], [C, this.cap]]) { if (!A.P.length) continue; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(A.P, 3)); g.setIndex(A.I); g.computeVertexNormals(); const me = new THREE.Mesh(g, m); me.castShadow = true; me.receiveShadow = true; grp.add(me); }
    grp.userData = { x: ox, z: oz }; grp.position.set(ox - this.origin.x, 0, oz - this.origin.z); this.group.add(grp); return grp;
  }
  drop(grp) { if (!grp) return; this.group.remove(grp); grp.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  reposition() { for (const g of this.pieces.values()) if (g) g.position.set(g.userData.x - this.origin.x, 0, g.userData.z - this.origin.z); }
  dispose() { for (const g of this.pieces.values()) this.drop(g); this.pieces.clear(); this.group.parent && this.group.parent.remove(this.group); this.mat.dispose(); this.cap.dispose(); }
}

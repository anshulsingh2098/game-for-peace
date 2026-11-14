/* Bridges: a concrete deck, rails and piers drawn along the stretches where the road is over water (Road.bridgeW === 1).
   Built from boxes and flat strips in the same plain materials as the landmarks, so they match the rest of the game, and they follow
   the road's curve. Pieces come and go around the player like the road mesh (same 200 m pieces). */
import * as THREE from 'three';

const DECK = 0.9;                                               // thickness of the deck slab (m)
const PIER_EVERY = 26, PIER_W = 1.5, POST_EVERY = 4;            // pier spacing, pier thickness along the road, rail post spacing (m)

export class Bridges {
  constructor(scene, road, terrain, style, origin, rows) {
    this.road = road; this.terrain = terrain; this.style = style; this.origin = origin; this.rows = rows; this.len = rows * road.ds; this.pieces = new Map(); this.range = 1800;
    const m = (color, rough = 0.95) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, envMapIntensity: 0.3, side: THREE.DoubleSide });
    this.concrete = m(0xb9b4aa); this.rail = m(0xd4cfc4); this.pier = m(0xa49f95);
    this.postGeo = new THREE.BoxGeometry(0.2, 1, 0.2); this.pierGeo = new THREE.BoxGeometry(1, 1, 1);
    this.group = new THREE.Group(); scene.add(this.group); this._p = {};
  }
  update(s) {
    const r = this.road, L = this.len, lo = Math.floor(Math.max(r.sMin + L, s - this.range) / L), hi = Math.floor(Math.min(r.sMax - L, s + this.range) / L) - 1;
    for (const [k, p] of this.pieces) if (k < lo - 1 || k > hi + 1) { this.drop(p); this.pieces.delete(k); }
    for (let k = lo; k <= hi; k++) if (!this.pieces.has(k)) { this.pieces.set(k, this.build(k)); return; }                 // one piece a frame is plenty
  }
  build(k) {
    const r = this.road, ds = r.ds, s0 = k * this.len, p = this._p, W = this.style.shoulder, n = this.rows;
    const o = r.at(s0, {}), ox = o.x, oz = o.z, runs = []; let run = null;
    for (let row = 0; row <= n; row++) {                                                            // contiguous rows that are on a bridge
      if (r.bridgeW(s0 + row * ds) === 1) { if (!run) runs.push(run = []); run.push(row); } else run = null;
    }
    if (!runs.length) return null;
    const grp = new THREE.Group(), slab = { P: [], I: [] }, rails = { P: [], I: [] }, posts = [], piers = [];
    const quad = (g, a, b, c, d) => { const v = g.P.length / 3; g.P.push(...a, ...b, ...c, ...d); g.I.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); };
    for (const rows of runs) for (let i = 0; i + 1 < rows.length; i++) {
      const pts = [rows[i], rows[i + 1]].map(row => { const s = s0 + row * ds; r.at(s, p); const nx = -p.tz, nz = p.tx; return { s, x: p.x - ox, z: p.z - oz, y: p.y, nx, nz, wx: p.x, wz: p.z, th: p.th }; });
      const at = (q, t, dy) => [q.x + q.nx * t, q.y + dy, q.z + q.nz * t], [A, B] = pts, top = -0.04, bot = -DECK;
      quad(slab, at(A, -W, top), at(A, -W, bot), at(B, -W, top), at(B, -W, bot));                       // left side of the slab
      quad(slab, at(A, -W, bot), at(A, W, bot), at(B, -W, bot), at(B, W, bot));                         // underside
      quad(slab, at(A, W, bot), at(A, W, top), at(B, W, bot), at(B, W, top));                           // right side
      for (const side of [-1, 1]) {                                                                     // a thin top rail on each edge: top and both faces
        const t0 = side * (W - 0.12), t1 = side * (W - 0.02);
        quad(rails, at(A, t0, 0.97), at(A, t1, 0.97), at(B, t0, 0.97), at(B, t1, 0.97));
        quad(rails, at(A, t0, 0.8), at(A, t0, 0.97), at(B, t0, 0.8), at(B, t0, 0.97));
        quad(rails, at(A, t1, 0.97), at(A, t1, 0.8), at(B, t1, 0.97), at(B, t1, 0.8));
      }
      for (const q of pts) {                                                                            // posts and piers sit at fixed road distances, so pieces line up
        if (Math.floor(q.s / POST_EVERY) !== Math.floor((q.s - ds) / POST_EVERY)) for (const side of [-1, 1]) posts.push([q.x + q.nx * side * (W - 0.07), q.y, q.z + q.nz * side * (W - 0.07), q.th]);
        if (Math.floor(q.s / PIER_EVERY) !== Math.floor((q.s - ds) / PIER_EVERY)) {
          const seabed = this.terrain.base(q.wx, q.wz) - 1.2, top = q.y - DECK, h = top - seabed;
          if (h > 0.4 && !piers.some(e => e[5] === q.s)) piers.push([q.x, seabed + h / 2, q.z, q.th, h, q.s]);
        }
      }
    }
    const mesh = (g, mat) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(g.P, 3)); geo.setIndex(g.I); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };
    if (slab.P.length) grp.add(mesh(slab, this.concrete)); if (rails.P.length) grp.add(mesh(rails, this.rail));
    const inst = (geo, mat, list, fit) => {
      if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
      list.forEach((it, i) => { fit(it, pos, e, sc); q.setFromEuler(e); m4.compose(pos, q, sc); im.setMatrixAt(i, m4); }); im.castShadow = true; im.receiveShadow = true; grp.add(im);
    };
    inst(this.postGeo, this.rail, posts, ([x, y, z, th], pos, e, sc) => { pos.set(x, y + 0.45, z); e.set(0, -th, 0); sc.set(1, 0.9, 1); });
    inst(this.pierGeo, this.pier, piers, ([x, y, z, th, h], pos, e, sc) => { pos.set(x, y, z); e.set(0, -th, 0); sc.set(PIER_W, h, 2 * W - 0.6); });
    grp.userData = { x: ox, z: oz }; grp.position.set(ox - this.origin.x, 0, oz - this.origin.z); this.group.add(grp); return grp;
  }
  drop(grp) { if (!grp) return; this.group.remove(grp); grp.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.geometry && o.geometry !== this.postGeo && o.geometry !== this.pierGeo) o.geometry.dispose(); }); }
  reposition() { for (const g of this.pieces.values()) if (g) g.position.set(g.userData.x - this.origin.x, 0, g.userData.z - this.origin.z); }
  dispose() { for (const g of this.pieces.values()) this.drop(g); this.pieces.clear(); this.group.parent && this.group.parent.remove(this.group); for (const m of [this.concrete, this.rail, this.pier]) m.dispose(); this.postGeo.dispose(); this.pierGeo.dispose(); }
}

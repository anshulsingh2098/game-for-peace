/* Tunnels: where Road.tunnelRise says the mountain over the road is deep enough, a concrete tube follows the road, with a lamp row
   and an arched portal wall at each end. The terrain above is left whole (see Road.tunnelW), so the tube is hidden until you drive in.
   Same flat materials as the bridges and landmarks; same 200 m pieces as the road mesh. */
import * as THREE from 'three';

export const COVER = 0.8;                                       // metres of earth over the road before the tube (and its portal wall) starts
const WALL = 4.3, ARCH = 4.3, LAMP_EVERY = 14, ARC_N = 10;     // straight wall height, arch rise (so 8.6 m clear in the middle), lamp spacing

export class Tunnels {
  constructor(scene, road, style, origin, rows) {
    this.road = road; this.style = style; this.origin = origin; this.rows = rows; this.len = rows * road.ds; this.pieces = new Map(); this.range = 1800;
    const m = (color, rough = 0.95) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, envMapIntensity: 0.3, side: THREE.DoubleSide });
    this.wall = m(0x8f8b83); this.portal = m(0xb9b4aa); this.lamp = new THREE.MeshBasicMaterial({ color: 0xfff0c0 });
    this.lampGeo = new THREE.BoxGeometry(0.5, 0.14, 1.1);
    this.group = new THREE.Group(); scene.add(this.group); this._p = {};
    const W = style.shoulder + 0.8; this.W = W;                                     // inside half-width of the tube
    this.section = [[-W, -0.4], [-W, WALL]]; for (let i = 1; i <= ARC_N; i++) { const a = Math.PI - Math.PI * i / ARC_N; this.section.push([Math.cos(a) * W, WALL + Math.sin(a) * ARCH]); } this.section.push([W, -0.4]);
  }
  update(s) {
    const r = this.road, L = this.len, lo = Math.floor(Math.max(r.sMin + L, s - this.range) / L), hi = Math.floor(Math.min(r.sMax - L, s + this.range) / L) - 1;
    for (const [k, p] of this.pieces) if (k < lo - 1 || k > hi + 1) { this.drop(p); this.pieces.delete(k); }
    for (let k = lo; k <= hi; k++) if (!this.pieces.has(k)) { this.pieces.set(k, this.build(k)); return; }
  }
  build(k) {
    const r = this.road, ds = r.ds, s0 = k * this.len, p = this._p, n = this.rows, sec = this.section, W = this.W, o = r.at(s0, {}), ox = o.x, oz = o.z;
    const inTube = s => r.tunnelRise(s) >= COVER, runs = []; let run = null;
    for (let row = 0; row <= n; row++) { if (inTube(s0 + row * ds)) { if (!run) runs.push(run = []); run.push(row); } else run = null; }
    if (!runs.length) return null;
    const grp = new THREE.Group(), P = [], I = [], lamps = [];
    const frame = row => { const s = s0 + row * ds; r.at(s, p); return { s, x: p.x - ox, y: p.y, z: p.z - oz, nx: -p.tz, nz: p.tx, tx: p.tx, tz: p.tz }; };
    for (const rows of runs) {
      const fr = rows.map(frame);
      for (let i = 0; i + 1 < fr.length; i++) {
        const A = fr[i], B = fr[i + 1];
        for (let j = 0; j + 1 < sec.length; j++) {
          const v = P.length / 3; for (const q of [A, B]) for (const [t, y] of [sec[j], sec[j + 1]]) P.push(q.x + q.nx * t, q.y + y, q.z + q.nz * t);
          I.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
        }
      }
      for (const q of fr) if (Math.floor(q.s / LAMP_EVERY) !== Math.floor((q.s - ds) / LAMP_EVERY)) lamps.push([q.x, q.y + WALL + ARCH - 0.25, q.z, Math.atan2(q.tx, q.tz)]);
      for (const [idx, atStart] of [[0, true], [rows.length - 1, false]]) {                          // a portal wall where the tube really begins or ends (not at a piece edge)
        const row = rows[idx], edge = atStart ? row === 0 : row === n; if (edge) continue;
        const q = fr[idx], th = Math.atan2(q.tx, q.tz), shape = new THREE.Shape(), hole = new THREE.Path();
        shape.moveTo(-W - 2.4, -2); shape.lineTo(W + 2.4, -2); shape.lineTo(W + 2.4, 11); shape.lineTo(-W - 2.4, 11); shape.lineTo(-W - 2.4, -2);
        hole.moveTo(-W, -0.4); hole.lineTo(-W, WALL); hole.absellipse(0, WALL, W, ARCH, Math.PI, 0, true); hole.lineTo(W, -0.4); hole.lineTo(-W, -0.4); shape.holes.push(hole);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false, curveSegments: 14 }), m = new THREE.Mesh(geo, this.portal);
        m.rotation.y = th; m.position.set(q.x - Math.sin(th) * (atStart ? 0 : 1.2), q.y, q.z - Math.cos(th) * (atStart ? 0 : 1.2)); m.castShadow = true; m.receiveShadow = true; grp.add(m);
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setIndex(I); geo.computeVertexNormals();
    const tube = new THREE.Mesh(geo, this.wall); tube.receiveShadow = true; grp.add(tube);
    if (lamps.length) {
      const im = new THREE.InstancedMesh(this.lampGeo, this.lamp, lamps.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
      lamps.forEach(([x, y, z, th], i) => { pos.set(x, y, z); e.set(0, th, 0); q.setFromEuler(e); m4.compose(pos, q, sc); im.setMatrixAt(i, m4); }); grp.add(im);
    }
    grp.userData = { x: ox, z: oz }; grp.position.set(ox - this.origin.x, 0, oz - this.origin.z); this.group.add(grp); return grp;
  }
  drop(grp) { if (!grp) return; this.group.remove(grp); grp.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.geometry) o.geometry.dispose(); }); }
  reposition() { for (const g of this.pieces.values()) if (g) g.position.set(g.userData.x - this.origin.x, 0, g.userData.z - this.origin.z); }
  dispose() { for (const g of this.pieces.values()) this.drop(g); this.pieces.clear(); this.group.parent && this.group.parent.remove(this.group); for (const m of [this.wall, this.portal, this.lamp]) m.dispose(); this.lampGeo.dispose(); }
}

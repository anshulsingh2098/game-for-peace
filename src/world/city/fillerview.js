/* Draws the fillers of fillers.js (Phase P1) into the tile's existing merged meshes, so they cost no extra draw calls: the paving or lawn goes into the pavement mesher (`walk`) or the park mesher,
   trees and parked cars into the street-life prop mesher (`prop`, vertex coloured). Needs three.js only for colours. All positions are tile-local (x - tile corner). */
import * as THREE from 'three';
import { tree, box } from './streetlife.js';

const PAVE = { courtyard: [0x8f8777, 0x9a9282, 0x857e70], forecourt: [0x9b968a, 0xa29c90, 0x8e897e], plaza: [0xb9b3a3, 0xc2bcad, 0xaaa496], parking: [0x4c4c4f, 0x545457, 0x444447], garden: [0x6f9a48, 0x66903f, 0x78a04f] };
const CAR = [0xf2f2f0, 0xf2f2f0, 0xc9ccd1, 0x2b2e36, 0x9c1f24, 0x2f4f8a, 0x7b7f86, 0xd8c9a0];
const col = new Map(), C = hex => { let c = col.get(hex); if (!c) col.set(hex, c = new THREE.Color(hex)); return c; };
const UNDER = new THREE.Color(0x17181a), LIFT = 0.02;                                                   // under the roads (0.05) and the pavements (0.03), over the block ground (0)

/* recs: from fillerRects; ctx: { M (the tile's meshers; prop is optional), X, Z (world to tile-local), gy, identity, rnd (optional) } */
export function addFillers(recs, ctx) {
  const { M, X, Z, gy, identity: ID } = ctx; let nt = 0, nc = 0;
  for (const r of recs) {
    const pal = PAVE[r.kind] || PAVE.forecourt, c = C(pal[Math.floor(r.hue * pal.length) % pal.length]), m = r.kind === 'garden' && M.park ? M.park : M.walk, rr = r.ring;
    const a = m.v(X(rr[0]), gy + LIFT, Z(rr[1]), 0, 1, 0, c, rr[0] / 11, rr[1] / 11), b = m.v(X(rr[2]), gy + LIFT, Z(rr[3]), 0, 1, 0, c, rr[2] / 11, rr[3] / 11), d = m.v(X(rr[4]), gy + LIFT, Z(rr[5]), 0, 1, 0, c, rr[4] / 11, rr[5] / 11), e = m.v(X(rr[6]), gy + LIFT, Z(rr[7]), 0, 1, 0, c, rr[6] / 11, rr[7] / 11);
    m.tri(a, b, d, 0, 1, 0); m.tri(a, d, e, 0, 1, 0);
    if (!M.prop) continue;
    if (ID && r.trees.length) {
      const A = ID.area(ID.areaNameAt(r.cx, r.cz)), ids = (A.trees && A.trees.species) || [];
      for (const [x, z, k] of r.trees) { const sp = ids.length ? ID.species.get(ids[Math.floor(k * ids.length) % ids.length]) : null; if (!sp || sp.id === 'bougainvillea') continue; tree(M.prop, X(x), gy + LIFT, Z(z), sp, k, false); nt++; }
    }
    for (const [x, z, yaw, ci] of r.cars) {                                                           // a lower body and a cabin, the long side along (cos yaw, sin yaw)
      const ux = Math.cos(yaw), uz = Math.sin(yaw), body = C(CAR[ci % CAR.length]), glass = C(0x3a4652), lx = X(x), lz = Z(z);
      box(M.prop, lx, gy + LIFT, lz, 3.5, 0.4, 1.5, ux, uz, UNDER); box(M.prop, lx, gy + LIFT + 0.32, lz, 4.2, 0.5, 1.75, ux, uz, body); box(M.prop, lx - ux * 0.25, gy + LIFT + 0.82, lz - uz * 0.25, 2.0, 0.48, 1.5, ux, uz, glass, body); nc++;       // dark underbody (the wheels), the body, a smaller cabin
    }
  }
  return { trees: nt, cars: nc };
}

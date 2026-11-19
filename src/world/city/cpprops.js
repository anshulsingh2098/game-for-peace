/* L6 (docs/CP_LANDMARKS.md): landmark props of Connaught Place built at the OpenStreetMap points of the places: four petrol stations (canopy, columns, dispensers, a small office, a lit board), the Palika Bazaar gates (a kiosk with an arched stair opening and a board), and the Prachin Hanuman Mandir (a small stepped-roof shrine with a flag). Flat colours on the `junk` mesh (junkBox, tilemesh.js) and the lettering on the emissive `cpbrand` mesh (specialUV, cpfacade.js). Each prop is built only by the tile that contains its point and only if the point is not inside a building. Names are the game names (BHARAT PETROL, PALIKA BAZAAR GATE). */
import * as THREE from 'three';
import { specialUV } from './cpfacade.js';

export const CP_FUEL = [[1224, -1999], [1252, -1946], [855, -2331], [1206, -1752]];
export const CP_PALIKA = [[986, -1930], [953, -1953], [1018, -1883], [1027, -1931]];
export const CP_MANDIR = [[588, -1829]];
const inRing = (r, x, z) => { let ins = false; const n = r.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = r[i * 2], zi = r[i * 2 + 1], xj = r[j * 2], zj = r[j * 2 + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } return ins; };

/* a board facing yaw direction (cos, sin): two-sided quad of w x h at height y, centre (cx, cz) */
function board(m, X, Z, cx, cz, y, w, h, yaw, id) {
  const tx = -Math.sin(yaw), tz = Math.cos(yaw), uv = specialUV(id), W = new THREE.Color(0xffffff);
  for (const sg of [1, -1]) { const nx = Math.cos(yaw) * sg, nz = Math.sin(yaw) * sg, u0 = sg > 0 ? uv[0] : uv[2], u1 = sg > 0 ? uv[2] : uv[0], o = 0.03 * sg, a = [cx + tx * w / 2 * sg + nx * 0.03, cz + tz * w / 2 * sg + nz * 0.03], b = [cx - tx * w / 2 * sg + nx * 0.03, cz - tz * w / 2 * sg + nz * 0.03]; void o;
    const v0 = m.v(X(a[0]), y, Z(a[1]), nx, 0, nz, W, u0, uv[1]), v1 = m.v(X(b[0]), y, Z(b[1]), nx, 0, nz, W, u1, uv[1]), v2 = m.v(X(b[0]), y + h, Z(b[1]), nx, 0, nz, W, u1, uv[3]), v3 = m.v(X(a[0]), y + h, Z(a[1]), nx, 0, nz, W, u0, uv[3]); m.tri(v0, v1, v2, nx, 0, nz); m.tri(v0, v2, v3, nx, 0, nz); }
}

/* J: the junk mesher, m: the cpbrand mesher, junkBox: tilemesh.js junkBox, tile: the decoded tile, ox, oz: its world origin, size: its side, yawAt(x, z): the direction of the nearest street (radians), out: the tile output (collision circles) */
export function cpProps(J, m, X, Z, gy, ox, oz, size, tile, junkBox, yawAt, out) {
  const col = h => new THREE.Color(h), here = (x, z) => x >= ox && x < ox + size && z >= oz && z < oz + size && !tile.buildings.some(b => b.ring && inRing(b.ring, x, z));
  /* the nearest free ground to a point: the point itself, then rings of 6 m up to 60 m, where no building covers the footprint corners (r metres round it) and the nearest street is at least r + 8 m away; null when none */
  const free = (x0, z0, r, rb = r) => { for (let ring = 0; ring <= 10; ring++) for (let k = 0; k < (ring ? 8 + ring * 4 : 1); k++) { const a = k / (ring ? 8 + ring * 4 : 1) * Math.PI * 2, x = x0 + Math.cos(a) * ring * 6, z = z0 + Math.sin(a) * ring * 6; if (!(x >= ox + 12 && x < ox + size - 12 && z >= oz + 12 && z < oz + size - 12)) continue; const yaw = yawAt(x, z); if (yawAt.d < r + 8) continue; let ok = true; for (const [dx, dz] of [[0, 0], [rb, 0], [-rb, 0], [0, rb], [0, -rb], [rb * 0.7, rb * 0.7], [-rb * 0.7, rb * 0.7], [rb * 0.7, -rb * 0.7], [-rb * 0.7, -rb * 0.7]]) if (tile.buildings.some(b => b.ring && inRing(b.ring, x + dx, z + dz))) { ok = false; break; } if (ok) return [x, z, yaw]; } return null; };
  const y0 = gy + 0.04, placed = []; let n = 0;
  for (const [fx, fz] of CP_FUEL) { if (!(fx >= ox && fx < ox + size && fz >= oz && fz < oz + size)) continue; const sp = free(fx, fz, 9, 18); if (!sp || placed.some(q => Math.hypot(q[0] - sp[0], q[1] - sp[1]) < 40)) continue; placed.push(sp); const [x, z, yaw] = sp, c = Math.cos(yaw), s = Math.sin(yaw), P = (a, b) => [x + a * c - b * s, z + a * s + b * c];
    /* canopy 14 x 8 m on four columns, 5.2 m up, a red and blue band on its edge; two islands with two dispensers each; a small office; a lit board on a pole */
    junkBox(J, X, Z, x, y0 + 5.0, z, 14, 0.5, 8, yaw, col(0xf2efe8)); junkBox(J, X, Z, x, y0 + 5.0, z, 14.2, 0.18, 8.2, yaw, col(0xc4202e)); junkBox(J, X, Z, x, y0 + 5.35, z, 14.2, 0.16, 8.2, yaw, col(0x1d4a9a));
    for (const [a, b] of [[-5.5, -3], [5.5, -3], [-5.5, 3], [5.5, 3]]) { const q = P(a, b); junkBox(J, X, Z, q[0], y0, q[1], 0.5, 5.0, 0.5, yaw, col(0xe8e4da)); out.circles.push(q[0], q[1], 0.5); }
    for (const b of [-1.7, 1.7]) { const q = P(0, b); junkBox(J, X, Z, q[0], y0, q[1], 7, 0.25, 0.9, yaw, col(0x8d8a84)); for (const a of [-1.8, 1.8]) { const d = P(a, b); junkBox(J, X, Z, d[0], y0 + 0.25, d[1], 0.55, 1.4, 0.45, yaw, col(0xc4202e)); junkBox(J, X, Z, d[0], y0 + 1.1, d[1], 0.4, 0.4, 0.5, yaw, col(0x2a2d33)); } }
    { const q = P(-3, 6.5); junkBox(J, X, Z, q[0], y0, q[1], 4.0, 2.8, 3.0, yaw, col(0xe9e4d6)); junkBox(J, X, Z, q[0], y0 + 2.8, q[1], 4.3, 0.2, 3.3, yaw, col(0x6b6e72)); }
    { const q = P(6.5, 6); junkBox(J, X, Z, q[0], y0, q[1], 0.25, 6.0, 0.25, yaw, col(0x6b6e72)); board(m, X, Z, q[0], q[1], y0 + 5.0, 3.6, 0.9, yaw + Math.PI / 2, 'fuel'); }
    board(m, X, Z, P(0, 4.15)[0], P(0, 4.15)[1], y0 + 4.9, 8.0, 0.8, yaw + Math.PI / 2, 'fuel'); n++; }
  for (const [gx, gz] of CP_PALIKA) { if (!(gx >= ox && gx < ox + size && gz >= oz && gz < oz + size)) continue; const sp = free(gx, gz, 3, 8); if (!sp) continue; const [x, z, yaw] = sp, c = Math.cos(yaw), s = Math.sin(yaw), P = (a, b) => [x + a * c - b * s, z + a * s + b * c];
    /* a kiosk 4.5 x 3.2 m, 3.4 m high, a dark arched stair opening on its front, a flat roof slab and the board on top */
    junkBox(J, X, Z, x, y0, z, 4.5, 3.4, 3.2, yaw, col(0xd9d2c0)); junkBox(J, X, Z, x, y0 + 3.4, z, 5.0, 0.3, 3.7, yaw, col(0x8d8a84));
    { const q = P(0, 1.62); junkBox(J, X, Z, q[0], y0, q[1], 2.0, 2.6, 0.12, yaw, col(0x16130f)); junkBox(J, X, Z, q[0], y0 + 2.6, q[1], 1.5, 0.35, 0.12, yaw, col(0x16130f)); }
    { const q = P(0, 1.75); board(m, X, Z, q[0], q[1], y0 + 3.75, 4.4, 0.7, yaw + Math.PI / 2, 'palika'); }
    out.circles.push(x, z, 2.4); n++; }
  for (const [mx, mz] of CP_MANDIR) { if (!(mx >= ox && mx < ox + size && mz >= oz && mz < oz + size)) continue; const sp = free(mx, mz, 5, 9); if (!sp) continue; const [x, z, yaw] = sp;
    /* a small shrine: a cream base 6 x 5 m, a porch, a stepped saffron roof of five tiers with a gold finial, and a red flag on a pole */
    junkBox(J, X, Z, x, y0, z, 6, 3.2, 5, yaw, col(0xeadfc6)); junkBox(J, X, Z, x, y0 + 3.2, z, 6.3, 0.25, 5.3, yaw, col(0xc9b48a));
    for (let k = 0; k < 5; k++) { const w = 4.6 - k * 0.8; junkBox(J, X, Z, x, y0 + 3.45 + k * 0.9, z, w, 0.9, w * 0.85, yaw, col(k % 2 ? 0xe8791e : 0xf08a2a)); }
    junkBox(J, X, Z, x, y0 + 7.95, z, 0.35, 0.6, 0.35, yaw, col(0xe6b84a)); junkBox(J, X, Z, x + 3.8, y0, z, 0.12, 7.5, 0.12, yaw, col(0x8d8a84)); junkBox(J, X, Z, x + 3.8, y0 + 6.3, z + 0.5, 0.05, 0.9, 1.0, yaw, col(0xc4202e));
    out.circles.push(x, z, 3.2); n++; }
  return n;
}

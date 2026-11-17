/* Geometry helpers for the Metro (D6): a "soup" of flat-shaded triangles with vertex colours (merged into one mesh), boxes, slanted slabs, and extrusion of a cross-section along a resampled route.
   Coordinates in: x, z in pack metres (the soup subtracts its own origin), y in metres over the ground. Browser only (three.js). */
import * as THREE from 'three';

export const C = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
export class Soup {
  constructor(ox, oz) { this.ox = ox; this.oz = oz; this.p = []; this.n = []; this.c = []; this.uv = null; }
  tri(a, b, c, col, uv) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const L = Math.hypot(nx, ny, nz); if (L < 1e-9) return; nx /= L; ny /= L; nz /= L;
    for (const v of [a, b, c]) { this.p.push(v[0] - this.ox, v[1], v[2] - this.oz); this.n.push(nx, ny, nz); this.c.push(col[0], col[1], col[2]); }
    if (uv) { if (!this.uv) this.uv = []; this.uv.push(...uv); }
  }
  quad(a, b, c, d, col, uv) { this.tri(a, b, c, col, uv && [uv[0], uv[1], uv[2], uv[3], uv[4], uv[5]]); this.tri(a, c, d, col, uv && [uv[0], uv[1], uv[4], uv[5], uv[6], uv[7]]); }
  get empty() { return !this.p.length; }
  get tris() { return this.p.length / 9; }
  geometry() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); if (this.uv && this.uv.length === this.p.length / 3 * 2) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.computeBoundingSphere(); return g; }
}

/* a frame: origin (x, z), unit tangent (tx, tz); n = (-tz, tx). pt(F, u, l, y) is the point u along and l across. */
export const frame = (x, z, tx, tz) => ({ x, z, tx, tz });
export const pt = (F, u, l, y) => [F.x + F.tx * u - F.tz * l, y, F.z + F.tz * u + F.tx * l];
/* a box in a frame: along u0..u1, across l0..l1, height y0..y1 (the six faces; the bottom too unless `open`) */
export function fbox(S, F, u0, u1, l0, l1, y0, y1, col, colTop) {
  const P = (u, l, y) => pt(F, u, l, y), top = colTop || col;
  S.quad(P(u0, l0, y1), P(u1, l0, y1), P(u1, l1, y1), P(u0, l1, y1), top);
  S.quad(P(u0, l0, y0), P(u0, l1, y0), P(u1, l1, y0), P(u1, l0, y0), col);
  S.quad(P(u0, l0, y0), P(u1, l0, y0), P(u1, l0, y1), P(u0, l0, y1), col); S.quad(P(u0, l1, y0), P(u0, l1, y1), P(u1, l1, y1), P(u1, l1, y0), col);
  S.quad(P(u0, l0, y0), P(u0, l0, y1), P(u0, l1, y1), P(u0, l1, y0), col); S.quad(P(u1, l0, y0), P(u1, l1, y0), P(u1, l1, y1), P(u1, l0, y1), col);
}
/* a slanted slab from (x0, z0) at top height y0 to (x1, z1) at y1, width w across, thickness th below the top (stairs, escalators, ramps) */
export function slab(S, x0, z0, y0, x1, z1, y1, w, th, col, colTop) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2, top = colTop || col;
  const A = [x0 + nx, y0, z0 + nz], B = [x0 - nx, y0, z0 - nz], Cc = [x1 - nx, y1, z1 - nz], D = [x1 + nx, y1, z1 + nz], d = v => [v[0], v[1] - th, v[2]];
  S.quad(A, B, Cc, D, top); S.quad(d(A), d(D), d(Cc), d(B), col); S.quad(A, D, d(D), d(A), col); S.quad(B, d(B), d(Cc), Cc, col); S.quad(A, d(A), d(B), B, col); S.quad(D, Cc, d(Cc), d(D), col);
}
/* a vertical prism with `k` sides (a pier) from y0 to y1, radius r, at (x, z) */
export function prism(S, x, z, y0, y1, r, col, k = 8) {
  for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2, b = (i + 1) / k * Math.PI * 2, ax = x + Math.cos(a) * r, az = z + Math.sin(a) * r, bx = x + Math.cos(b) * r, bz = z + Math.sin(b) * r; S.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], col); }
}
/* extrude a cross-section along route R from sample i0 to i1: ring = [[l, y], ...] across and over the rail top (y), edge colours cols[k] for the edge k to k+1 (closed rings wrap). dy lifts it (rail height is R.h). */
export function extrude(S, R, i0, i1, ring, cols, closed = true, dyExtra = 0) {
  const m = ring.length, edges = closed ? m : m - 1, P = i => { const nx = -R.tz[i], nz = R.tx[i], h = R.h[i] + dyExtra, o = new Array(m); for (let k = 0; k < m; k++) o[k] = [R.x[i] + nx * ring[k][0], h + ring[k][1], R.z[i] + nz * ring[k][0]]; return o; };
  let a = P(i0); for (let i = i0 + 1; i <= i1; i++) { const b = P(i); for (let k = 0; k < edges; k++) { const k2 = (k + 1) % m; S.quad(a[k], a[k2], b[k2], b[k], cols[k % cols.length]); } a = b; }
}

/* walkable surface pieces along route R from s0 to s1, across own-lateral L0..L1, at height y over the ground: a piece every 12 m, each in the frame of the track there, so a curved platform is followed (push into `list`) */
export function walkAlong(list, R, s0, s1, L0, L1, y) {
  for (let a = s0; a < s1; a += 12) { const q = R.at(a + 6); list.push({ x: q.x, z: q.z, tx: q.tx, tz: q.tz, u0: -7, u1: 7, l0: L0, l1: L1, ya: y, yb: y }); }
}

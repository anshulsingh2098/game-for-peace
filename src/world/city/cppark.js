/* Rajiv Chowk Central Park, rebuilt from the owner's two aerial photos (22 Nov 2026; layout notes in docs/CP_LANDMARKS.md section 5). The OSM polygon (way 164675825, centre x 1042, z -2104, radius about 118 m) has no inner detail, so the layout comes from the photos: a red-pink sandstone outer ring path, an inner ring, eight radial paths, a stepped amphitheatre of concentric terraces in the middle with a flat stage, white domed pavilions on the paths, lawns between. The flag pole stands where the game already had it. Flat colours on the walk mesh (paths), the plaza mesh (the terraces) and the junk mesh (pavilions); each segment is built by the tile that holds its midpoint, so the park crosses the tile edge at x 1000 without a gap. */
import * as THREE from 'three';

export const PARK = { x: 1042, z: -2104, R: 118, ring1: [103, 107.5], ring2: [60, 63.5], bowl: [12, 34], radials: 8 };
const PINK = new THREE.Color(0xd08c78), PINK2 = new THREE.Color(0xb8715c), EDGE = new THREE.Color(0xe9dccc), STAGE = new THREE.Color(0xc27c68);

export function cpPark(M, X, Z, gy, ox, oz, size, junkBox, out) {
  const mine = (x, z) => x >= ox && x < ox + size && z >= oz && z < oz + size, cx = PARK.x, cz = PARK.z;
  if (cx + PARK.R < ox || cx - PARK.R >= ox + size || cz + PARK.R < oz || cz - PARK.R >= oz + size) return 0;
  const W = M.walk, PL = M.plaza, yw = gy + 0.045; let tris = 0;
  const wv = (x, y, z, c) => W.v(X(x), y, Z(z), 0, 1, 0, c, x / 4, z / 4), pv = (x, y, z, nx, ny, nz, c) => PL.v(X(x), y, Z(z), nx, ny, nz, c, x / 4.8, z / 4.8);
  /* a flat ring band r0..r1 at height y on the walk mesh, 80 segments */
  const band = (r0, r1, y, col, a0 = 0, a1 = Math.PI * 2, N = 80) => { for (let k = 0; k < N; k++) { const t0 = a0 + (a1 - a0) * k / N, t1 = a0 + (a1 - a0) * (k + 1) / N, tm = (t0 + t1) / 2; if (!mine(cx + Math.cos(tm) * (r0 + r1) / 2, cz + Math.sin(tm) * (r0 + r1) / 2)) continue;
    const p = [[r0, t0], [r1, t0], [r1, t1], [r0, t1]].map(([r, t]) => wv(cx + Math.cos(t) * r, y, cz + Math.sin(t) * r, col)); W.tri(p[0], p[2], p[1], 0, 1, 0); W.tri(p[0], p[3], p[2], 0, 1, 0); tris += 2; } };
  /* the two ring paths with pale kerb lines on both edges */
  for (const [r0, r1] of [PARK.ring1, PARK.ring2]) { band(r0, r1, yw, PINK); band(r0 - 0.3, r0, yw + 0.004, EDGE); band(r1, r1 + 0.3, yw + 0.004, EDGE); }
  /* eight radial paths, 3.2 m wide, from the bowl to the outer ring, at 22.5 + 45 k degrees */
  for (let k = 0; k < PARK.radials; k++) { const a = (22.5 + 45 * k) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), nxp = -sa, nzp = ca, r0 = PARK.bowl[1] + 0.5, r1 = PARK.ring1[0] + 0.2, L = r1 - r0, n = Math.ceil(L / 8);
    for (let j = 0; j < n; j++) { const s0 = r0 + L * j / n, s1 = r0 + L * (j + 1) / n, mx = cx + ca * (s0 + s1) / 2, mz = cz + sa * (s0 + s1) / 2; if (!mine(mx, mz)) continue; const hw = 1.6;
      const p = [[s0, -hw], [s1, -hw], [s1, hw], [s0, hw]].map(([s, w]) => wv(cx + ca * s + nxp * w, yw, cz + sa * s + nzp * w, PINK)); W.tri(p[0], p[1], p[2], 0, 1, 0); W.tri(p[0], p[2], p[3], 0, 1, 0); tris += 2; } }
  /* the amphitheatre: a flat stage disc of 12 m radius, then six concentric terraces 3.7 m wide, each 0.22 m higher than the one inside, treads in pink, risers darker, a pale lip on every tread edge */
  const R0 = PARK.bowl[0], R1 = PARK.bowl[1], nT = 6, dw = (R1 - R0) / nT, N = 72, y0 = gy + 0.05, dh = 0.22;
  for (let k = 0; k < N; k++) { const t0 = Math.PI * 2 * k / N, t1 = Math.PI * 2 * (k + 1) / N, tm = (t0 + t1) / 2; if (!mine(cx + Math.cos(tm) * 20, cz + Math.sin(tm) * 20)) continue;
    const cc = (r, t) => [cx + Math.cos(t) * r, cz + Math.sin(t) * r], q = (r, t, y, c, nx, ny, nz) => pv(cc(r, t)[0], y, cc(r, t)[1], nx, ny, nz, c);
    { const c = [q(0, t0, y0 + 0.01, STAGE, 0, 1, 0), q(R0, t0, y0 + 0.01, STAGE, 0, 1, 0), q(R0, t1, y0 + 0.01, STAGE, 0, 1, 0)]; PL.tri(c[0], c[2], c[1], 0, 1, 0); tris++; }
    for (let i = 0; i < nT; i++) { const ra = R0 + dw * i, rb = ra + dw, ya = y0 + dh * (i + 1), nxr = -Math.cos(tm), nzr = -Math.sin(tm);
      const t = [q(ra, t0, ya, i % 2 ? PINK : PINK2, 0, 1, 0), q(rb, t0, ya, i % 2 ? PINK : PINK2, 0, 1, 0), q(rb, t1, ya, i % 2 ? PINK : PINK2, 0, 1, 0), q(ra, t1, ya, i % 2 ? PINK : PINK2, 0, 1, 0)]; PL.tri(t[0], t[2], t[1], 0, 1, 0); PL.tri(t[0], t[3], t[2], 0, 1, 0);
      const rs = [q(ra, t0, ya - dh, PINK2, nxr, 0, nzr), q(ra, t1, ya - dh, PINK2, nxr, 0, nzr), q(ra, t1, ya, PINK2, nxr, 0, nzr), q(ra, t0, ya, PINK2, nxr, 0, nzr)]; PL.tri(rs[0], rs[2], rs[1], nxr, 0, nzr); PL.tri(rs[0], rs[3], rs[2], nxr, 0, nzr);
      const lp = [q(rb - 0.28, t0, ya + 0.004, EDGE, 0, 1, 0), q(rb, t0, ya + 0.004, EDGE, 0, 1, 0), q(rb, t1, ya + 0.004, EDGE, 0, 1, 0), q(rb - 0.28, t1, ya + 0.004, EDGE, 0, 1, 0)]; PL.tri(lp[0], lp[2], lp[1], 0, 1, 0); PL.tri(lp[0], lp[3], lp[2], 0, 1, 0); tris += 6; } }
  /* the outer terrace edge down to the lawn */
  /* six white domed pavilions on the radial paths at r = 86 m (angles 22.5 + 60 k degrees): a round slab, four slender columns, a stepped white dome and a finial */
  const white = new THREE.Color(0xf1ede2), cream = new THREE.Color(0xe4dccb), gold = new THREE.Color(0xd9b24a);
  for (let k = 0; k < 6; k++) { const a = (22.5 + 60 * k) * Math.PI / 180, x = cx + Math.cos(a) * 86, z = cz + Math.sin(a) * 86; if (!mine(x, z)) continue; const yaw = a, y = gy + 0.05;
    junkBox(M.junk, X, Z, x, y, z, 5.6, 0.35, 5.6, yaw, cream); junkBox(M.junk, X, Z, x, y, z, 5.6, 0.35, 5.6, yaw + Math.PI / 4, cream);
    for (const [dx, dz] of [[-2, -2], [2, -2], [2, 2], [-2, 2]]) { const c = Math.cos(yaw), s = Math.sin(yaw); junkBox(M.junk, X, Z, x + dx * c - dz * s, y + 0.35, z + dx * s + dz * c, 0.32, 3.2, 0.32, yaw, white); }
    junkBox(M.junk, X, Z, x, y + 3.55, z, 5.8, 0.3, 5.8, yaw, white); junkBox(M.junk, X, Z, x, y + 3.55, z, 5.8, 0.3, 5.8, yaw + Math.PI / 4, white);
    for (let i = 0; i < 4; i++) { const w = 4.6 - i * 1.1; junkBox(M.junk, X, Z, x, y + 3.85 + i * 0.55, z, w, 0.55, w, yaw, white); junkBox(M.junk, X, Z, x, y + 3.85 + i * 0.55, z, w, 0.55, w, yaw + Math.PI / 4, white); }
    junkBox(M.junk, X, Z, x, y + 6.05, z, 0.22, 0.7, 0.22, yaw, gold); out.circles.push(x, z, 3.0); tris += 70; }
  /* keep the scattered trees off the paths and the bowl: one tile (the one with the park centre) registers the claims */
  if (mine(cx, cz) && out.claims) { const ring = r => { const pts = []; for (let k = 0; k <= 48; k++) pts.push(cx + Math.cos(k / 48 * Math.PI * 2) * r, cz + Math.sin(k / 48 * Math.PI * 2) * r); return pts; };
    out.claims.push({ kind: 'building', shape: { t: 'circle', x: cx, z: cz, r: PARK.bowl[1] + 2 }, layer: 0, owner: 'street' }, { kind: 'building', shape: { t: 'line', pts: ring((PARK.ring1[0] + PARK.ring1[1]) / 2), hw: 3.2 }, layer: 0, owner: 'street' }, { kind: 'building', shape: { t: 'line', pts: ring((PARK.ring2[0] + PARK.ring2[1]) / 2), hw: 3.2 }, layer: 0, owner: 'street' });
    for (let k = 0; k < PARK.radials; k++) { const a = (22.5 + 45 * k) * Math.PI / 180; out.claims.push({ kind: 'building', shape: { t: 'line', pts: [cx + Math.cos(a) * 36, cz + Math.sin(a) * 36, cx + Math.cos(a) * 104, cz + Math.sin(a) * 104], hw: 2.6 }, layer: 0, owner: 'street' }); } }
  return tris;
}

/* is (x, z) on a path, in the bowl or on a pavilion of Central Park: the scattered park trees keep off these (streetlife.js) */
export function onParkPath(x, z) {
  const dx = x - PARK.x, dz = z - PARK.z, r = Math.hypot(dx, dz); if (r > PARK.R) return false; if (r < PARK.bowl[1] + 2.5) return true;
  if (Math.abs(r - (PARK.ring1[0] + PARK.ring1[1]) / 2) < 3.6 || Math.abs(r - (PARK.ring2[0] + PARK.ring2[1]) / 2) < 3.6) return true;
  if (r > PARK.bowl[1] && r < PARK.ring1[0] + 1) { const step = Math.PI / 4, a = Math.atan2(dz, dx) - 22.5 * Math.PI / 180, d = Math.abs(((a % step) + step * 1.5) % step - step / 2) * (-1), ang = Math.abs(((a % step) + step) % step); const da = Math.min(ang, step - ang); if (da * r < 3.0) return true; }
  for (let k = 0; k < 6; k++) { const a = (22.5 + 60 * k) * Math.PI / 180; if (Math.hypot(x - (PARK.x + Math.cos(a) * 86), z - (PARK.z + Math.sin(a) * 86)) < 5) return true; }
  return false;
}

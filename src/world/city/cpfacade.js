/* Connaught Place facade pieces (owner's photos R1 to R4, 20 Nov 2026): the brand-board band along the front of the arcade (a deep fascia of red, blue, black and white panels with lettering that glows at night), and the drum corner blocks with a cornice ring and a dome. Own geometry and an atlas drawn in code; the brand names are INVENTED (the owner's decision of 19 Nov: names may be used as plain lettering, no logos or trade dress are copied, and these are not real shops). The functions only fill a `Mesher` (tilemesh.js) so tilemesh.js needs a few hook lines and this file holds the rest. */
import * as THREE from 'three';

export const BRANDS = [
  ['URBAN THREAD', 0xc4202e, 0xffffff], ['KAFE NOIR', 0x15161a, 0xf2d27a], ['SPORTLINE', 0x1d5bb8, 0xffffff], ['TECHMART', 0xf2f0ea, 0x1d1d22], ['BLUE ORCHID', 0x1f4aa0, 0xffffff], ['SILK & SAGE', 0x2e2a30, 0xe8d6b0], ['ROYAL BAZAAR', 0x7a1a22, 0xf5e6b8], ['NOVA MOBILES', 0xe9791c, 0xffffff],
  ['GREEN LEAF', 0x1f6a3a, 0xffffff], ['SHOE STREET', 0xc4202e, 0xffffff], ['PIXEL WORLD', 0x15161a, 0x6fd0ff], ['SWEET TOOTH', 0xd9418a, 0xffffff], ['DENIM CO', 0x1d5bb8, 0xffffff], ['SPICE ROUTE', 0xb3341c, 0xfff0c8], ['OPTICA', 0xf2f0ea, 0x1d1d22], ['GOLDEN CROWN', 0x2e2a30, 0xe6b84a],
  ['LITTLE LOOM', 0x5a2a86, 0xffffff], ['CITY PHARMA', 0x1f6a3a, 0xffffff], ['BOOK NOOK', 0xf5e6b8, 0x4a1c14], ['FRESH BITES', 0xe9791c, 0xffffff], ['ELECTRO HUB', 0x1d5bb8, 0xffffff], ['MODA', 0x15161a, 0xffffff], ['TEA HOUSE', 0x1f6a3a, 0xf5e6b8], ['GADGET GURU', 0xc4202e, 0xffffff],
  ['CAFE MODERN', 0x2e2a30, 0xffffff], ['STYLE HUB', 0x5a2a86, 0xffffff], ['KIDS KORNER', 0xf2c230, 0x1d1d22], ['HOME & HEARTH', 0x7a1a22, 0xffffff], ['SUPER SPORTS', 0x1d5bb8, 0xffffff], ['SAREE PALACE', 0xc4202e, 0xf5e6b8], ['LENS CRAFT', 0x15161a, 0xffffff], ['FOOD COURT', 0xe9791c, 0x1d1d22],
];
const CELL_W = 256, CELL_H = 64, COLS = 4, ROWS = 8, ROWS_ALL = 9;      /* 8 rows of boards and a last row whose first cell is the warm lamp patch */
export const BRAND_COUNT = BRANDS.length;

/* the brand atlas: one 1024 x 512 canvas of 32 boards; the same canvas is the emissive map, so the boards glow at night */
export function makeBrandAtlas() {
  const c = document.createElement('canvas'); c.width = CELL_W * COLS; c.height = CELL_H * ROWS_ALL; const g = c.getContext('2d');
  BRANDS.forEach(([name, bg, fg], i) => {
    const x = (i % COLS) * CELL_W, y = Math.floor(i / COLS) * CELL_H, hex = h => '#' + h.toString(16).padStart(6, '0');
    g.fillStyle = hex(bg); g.fillRect(x, y, CELL_W, CELL_H); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.strokeRect(x + 3, y + 3, CELL_W - 6, CELL_H - 6);
    g.fillStyle = hex(fg); g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 34; g.font = 'bold ' + fs + 'px Arial,Helvetica,sans-serif'; while (g.measureText(name).width > CELL_W - 30 && fs > 12) { fs -= 2; g.font = 'bold ' + fs + 'px Arial,Helvetica,sans-serif'; } g.fillText(name, x + CELL_W / 2, y + CELL_H / 2 + 2);
  });
  { const x = 0, y = ROWS * CELL_H, gr = g.createRadialGradient(x + CELL_W / 2, y + CELL_H / 2, 4, x + CELL_W / 2, y + CELL_H / 2, CELL_W / 2); gr.addColorStop(0, '#fff3c4'); gr.addColorStop(0.6, '#ffd27a'); gr.addColorStop(1, '#ffb347'); g.fillStyle = gr; g.fillRect(x, y, CELL_W, CELL_H); }      // the warm lamp patch
  return c;
}
export function brandUV(i) { const k = ((i % BRAND_COUNT) + BRAND_COUNT) % BRAND_COUNT, x = (k % COLS) * CELL_W, y = Math.floor(k / COLS) * CELL_H, W = CELL_W * COLS, H = CELL_H * ROWS_ALL; return [(x + 2) / W, 1 - (y + CELL_H - 2) / H, (x + CELL_W - 2) / W, 1 - (y + 2) / H]; }

/* the material: the atlas as colour and as emissive map (intensity 0 by day, raised at night by tilemesh.js setNight), a little glow always so the lettering stays crisp */
export function makeBrandMaterial() {
  const tex = new THREE.CanvasTexture(makeBrandAtlas()); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12, roughness: 0.6, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.3 }); m.userData.kit = true; return m;
}

/* the brand-board band along one arcade front: from point a to point b (x, z), at height y0, `h` tall, facing (nx, nz), one board a bay of about `bay` metres, each a different brand. `key` varies the choice by building. */
export function brandBand(m, X, Z, ax, az, bx, bz, nx, nz, y0, h, bay, key) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 3) return 0; const n = Math.max(1, Math.round(L / bay)), tx = dx / L, tz = dz / L, w = L / n - 0.25; let q = 0;
  for (let k = 0; k < n; k++) { const uMid = (k + 0.5) * L / n, cx = ax + tx * uMid + nx * 0.06, cz = az + tz * uMid + nz * 0.06, uv0 = brandUV(Math.floor(((key * 7 + k * 5 + Math.floor(key / 3)) % 1000 + 1000) % BRAND_COUNT)), uv = (tx * nz - tz * nx) < 0 ? [uv0[2], uv0[1], uv0[0], uv0[3]] : uv0;      /* seen from outside the wall the texture must run left to right: the viewer's right is (nz, -nx), so a wall running the other way gets the picture turned round (it read mirrored on half the walls) */ const W = new THREE.Color(0xffffff);
    const v0 = m.v(X(cx - tx * w / 2), y0, Z(cz - tz * w / 2), nx, 0, nz, W, uv[0], uv[1]), v1 = m.v(X(cx + tx * w / 2), y0, Z(cz + tz * w / 2), nx, 0, nz, W, uv[2], uv[1]), v2 = m.v(X(cx + tx * w / 2), y0 + h, Z(cz + tz * w / 2), nx, 0, nz, W, uv[2], uv[3]), v3 = m.v(X(cx - tx * w / 2), y0 + h, Z(cz - tz * w / 2), nx, 0, nz, W, uv[0], uv[3]); m.tri(v0, v1, v2, nx, 0, nz); m.tri(v0, v2, v3, nx, 0, nz); q++; }
  return q;
}

/* a drum corner block (photo R1): a round tower at a building's corner from the ground to 2.4 m over the roof, a cornice ring, a dome cap and three dark arched window slots on the street side. B is the building mesh (blank texture area 0.06). (vx, vz) the ring vertex, (ox, oz) the unit vector pointing out of the building at that corner. */
export function drumCorner(B, X, Z, vx, vz, ox, oz, y0, y1, wc, dark) {
  const R = 3.3, cx = vx - ox * R * 0.55, cz = vz - oz * R * 0.55, N = 12, top = y1 + 2.4, uv = 0.06, ring = wc.clone().multiplyScalar(1.1), cap = wc.clone().multiplyScalar(0.85);
  const V = (x, y, z, nx, ny, nz, c) => B.v(X(x), y, Z(z), nx, ny, nz, c, uv, uv);
  for (let k = 0; k < N; k++) { const a0 = k * Math.PI * 2 / N, a1 = (k + 1) * Math.PI * 2 / N, am = (a0 + a1) / 2, nx = Math.cos(am), nz = Math.sin(am);
    const p0 = [cx + Math.cos(a0) * R, cz + Math.sin(a0) * R], p1 = [cx + Math.cos(a1) * R, cz + Math.sin(a1) * R], q0 = V(p0[0], y0, p0[1], nx, 0, nz, wc), q1 = V(p1[0], y0, p1[1], nx, 0, nz, wc), q2 = V(p1[0], top, p1[1], nx, 0, nz, wc), q3 = V(p0[0], top, p0[1], nx, 0, nz, wc); B.tri(q0, q1, q2, nx, 0, nz); B.tri(q0, q2, q3, nx, 0, nz);
    const Rr = R + 0.45, r0 = [cx + Math.cos(a0) * Rr, cz + Math.sin(a0) * Rr], r1 = [cx + Math.cos(a1) * Rr, cz + Math.sin(a1) * Rr], c0 = V(r0[0], top - 0.4, r0[1], nx, 0, nz, ring), c1 = V(r1[0], top - 0.4, r1[1], nx, 0, nz, ring), c2 = V(r1[0], top + 0.35, r1[1], nx, 0, nz, ring), c3 = V(r0[0], top + 0.35, r0[1], nx, 0, nz, ring); B.tri(c0, c1, c2, nx, 0, nz); B.tri(c0, c2, c3, nx, 0, nz);
    const t0 = V(r0[0], top + 0.35, r0[1], 0, 1, 0, ring), t1 = V(r1[0], top + 0.35, r1[1], 0, 1, 0, ring), t2 = V(cx + Math.cos(a1) * R * 0.8, top + 0.35, cz + Math.sin(a1) * R * 0.8, 0, 1, 0, cap), t3 = V(cx + Math.cos(a0) * R * 0.8, top + 0.35, cz + Math.sin(a0) * R * 0.8, 0, 1, 0, cap); B.tri(t0, t1, t2, 0, 1, 0); B.tri(t0, t2, t3, 0, 1, 0);
    const apex = V(cx, top + 2.4, cz, nx * 0.6, 0.8, nz * 0.6, cap), d0 = V(cx + Math.cos(a0) * R * 0.8, top + 0.35, cz + Math.sin(a0) * R * 0.8, nx * 0.6, 0.8, nz * 0.6, cap), d1 = V(cx + Math.cos(a1) * R * 0.8, top + 0.35, cz + Math.sin(a1) * R * 0.8, nx * 0.6, 0.8, nz * 0.6, cap); B.tri(d0, d1, apex, nx * 0.6, 0.8, nz * 0.6); }
  /* arched windows on the street side (photo R1): three a floor, each a dark rectangle with a half-round head, a white sill with a small balustrade block under it; a triangular pediment over the middle of the cornice */
  const px = -oz, pz = ox, sill = wc.clone().multiplyScalar(1.12);
  for (const [off, w2] of [[-1.7, 0.8], [0, 1.0], [1.7, 0.8]]) for (let f = 0; f < 2; f++) { const yb = y1 - 6.4 + f * 3.5; if (yb < y0 + 4.6) continue; const wx = cx + ox * (R + 0.05) + px * off * 0.85, wz = cz + oz * (R + 0.05) + pz * off * 0.85, hw2 = w2 / 2, hStraight = 1.5;
    { const sx0 = cx + ox * (R + 0.03) + px * off * 0.85, sz0 = cz + oz * (R + 0.03) + pz * off * 0.85, fw = hw2 + 0.2, y0f = yb - 0.1, yS = yb + hStraight + 0.05;      // the surround: a lighter frame a little larger than the window and just behind it
      const fa = V(sx0 - px * fw, y0f, sz0 - pz * fw, ox, 0, oz, ring), fb = V(sx0 + px * fw, y0f, sz0 + pz * fw, ox, 0, oz, ring), fc = V(sx0 + px * fw, yS, sz0 + pz * fw, ox, 0, oz, ring), fd = V(sx0 - px * fw, yS, sz0 - pz * fw, ox, 0, oz, ring); B.tri(fa, fb, fc, ox, 0, oz); B.tri(fa, fc, fd, ox, 0, oz);
      const fh = V(sx0, yS, sz0, ox, 0, oz, ring); let fp = fd; for (let k3 = 1; k3 <= 4; k3++) { const an = Math.PI * k3 / 4, ex = sx0 - px * fw * Math.cos(an), ez = sz0 - pz * fw * Math.cos(an), ey = yS + fw * Math.sin(an), cu = V(ex, ey, ez, ox, 0, oz, ring); B.tri(fh, fp, cu, ox, 0, oz); fp = cu; } }
    const a = V(wx - px * hw2, yb, wz - pz * hw2, ox, 0, oz, dark), b = V(wx + px * hw2, yb, wz + pz * hw2, ox, 0, oz, dark), c2 = V(wx + px * hw2, yb + hStraight, wz + pz * hw2, ox, 0, oz, dark), d = V(wx - px * hw2, yb + hStraight, wz - pz * hw2, ox, 0, oz, dark); B.tri(a, b, c2, ox, 0, oz); B.tri(a, c2, d, ox, 0, oz);
    const hub = V(wx, yb + hStraight, wz, ox, 0, oz, dark); let prev = d; for (let k2 = 1; k2 <= 6; k2++) { const an = Math.PI * k2 / 6, ex = wx - px * hw2 * Math.cos(an), ez = wz - pz * hw2 * Math.cos(an), ey = yb + hStraight + hw2 * Math.sin(an), cur = V(ex, ey, ez, ox, 0, oz, dark); B.tri(hub, prev, cur, ox, 0, oz); prev = cur; }
    const sx = wx + ox * 0.1, sz = wz + oz * 0.1, sw = w2 + 0.5, s0 = V(sx - px * sw / 2, yb - 0.4, sz - pz * sw / 2, ox, 0, oz, sill), s1 = V(sx + px * sw / 2, yb - 0.4, sz + pz * sw / 2, ox, 0, oz, sill), s2 = V(sx + px * sw / 2, yb, sz + pz * sw / 2, ox, 0, oz, sill), s3 = V(sx - px * sw / 2, yb, sz - pz * sw / 2, ox, 0, oz, sill); B.tri(s0, s1, s2, ox, 0, oz); B.tri(s0, s2, s3, ox, 0, oz);
    const t0 = V(sx - px * sw / 2, yb, sz - pz * sw / 2, 0, 1, 0, sill), t1 = V(sx + px * sw / 2, yb, sz + pz * sw / 2, 0, 1, 0, sill), t2 = V(sx + px * sw / 2 - ox * 0.12, yb, sz + pz * sw / 2 - oz * 0.12, 0, 1, 0, sill), t3 = V(sx - px * sw / 2 - ox * 0.12, yb, sz - pz * sw / 2 - oz * 0.12, 0, 1, 0, sill); B.tri(t0, t1, t2, 0, 1, 0); B.tri(t0, t2, t3, 0, 1, 0); }
  { const pb = top + 0.35, pcx = cx + ox * (R + 0.2), pcz = cz + oz * (R + 0.2), hwp = 1.9, ph = 1.35, f0 = V(pcx - px * hwp, pb, pcz - pz * hwp, ox, 0, oz, ring), f1 = V(pcx + px * hwp, pb, pcz + pz * hwp, ox, 0, oz, ring), f2 = V(pcx, pb + ph, pcz, ox, 0, oz, ring); B.tri(f0, f1, f2, ox, 0, oz);
    const dpt = 0.45, g0 = V(pcx - px * hwp - ox * dpt, pb, pcz - pz * hwp - oz * dpt, 0, 1, 0, cap), g1 = V(pcx - ox * dpt, pb + ph, pcz - oz * dpt, 0, 1, 0, cap), g2 = V(pcx + px * hwp - ox * dpt, pb, pcz + pz * hwp - oz * dpt, 0, 1, 0, cap); B.tri(f0, g0, g1, 0, 1, 0); B.tri(f0, g1, f2, 0, 1, 0); B.tri(f1, f2, g1, 0, 1, 0); B.tri(f1, g1, g2, 0, 1, 0); }
}

/* the upper facade of an arcade wall (photos R1 and R3): a projecting string course at each floor line (every 4 m above the arcade) and a pilaster every second bay (7.2 m), from the arcade slab to under the roof edge. a, b the wall's end points, (nx, nz) the outward normal, yBase the top of the arcade slab, yTop the roof, wc the wall colour, in the building mesh (blank texture area 0.06). About 20 triangles a wall. */
export function facadeBands(B, X, Z, ax, az, bx, bz, nx, nz, yBase, yTop, wc) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 8 || yTop - yBase < 4.5) return 0; const tx = dx / L, tz = dz / L, uv = 0.06, course = wc.clone().multiplyScalar(1.12), pil = wc.clone().multiplyScalar(1.07), V = (x, y, z, ny, nxx, nzz, c) => B.v(X(x), y, Z(z), nxx, ny, nzz, c, uv, uv); let tris = 0;
  for (let y = yBase + 4.0; y < yTop - 1.0; y += 4.0) { const d0 = 0.28, a0 = V(ax, y, az, 0, nx, nz, course), b0 = V(bx, y, bz, 0, nx, nz, course), a1 = V(ax + nx * d0, y, az + nz * d0, 0, nx, nz, course), b1 = V(bx + nx * d0, y, bz + nz * d0, 0, nx, nz, course), a2 = V(ax + nx * d0, y + 0.32, az + nz * d0, 0, nx, nz, course), b2 = V(bx + nx * d0, y + 0.32, bz + nz * d0, 0, nx, nz, course);
    B.tri(a1, b1, b2, nx, 0, nz); B.tri(a1, b2, a2, nx, 0, nz); const a3 = V(ax, y + 0.32, az, 1, 0, 0, course), b3 = V(bx, y + 0.32, bz, 1, 0, 0, course); B.tri(a2, b2, b3, 0, 1, 0); B.tri(a2, b3, a3, 0, 1, 0); tris += 4; void a0; void b0; }
  const nb = Math.floor(L / 7.2); for (let j = 1; j <= nb; j++) { const u = j * 7.2; if (u > L - 1.2) break; const cx = ax + tx * u, cz = az + tz * u, hw = 0.3, dp = 0.22, y0 = yBase, y1 = yTop - 0.5;
    const f0 = V(cx - tx * hw + nx * dp, y0, cz - tz * hw + nz * dp, 0, nx, nz, pil), f1 = V(cx + tx * hw + nx * dp, y0, cz + tz * hw + nz * dp, 0, nx, nz, pil), f2 = V(cx + tx * hw + nx * dp, y1, cz + tz * hw + nz * dp, 0, nx, nz, pil), f3 = V(cx - tx * hw + nx * dp, y1, cz - tz * hw + nz * dp, 0, nx, nz, pil); B.tri(f0, f1, f2, nx, 0, nz); B.tri(f0, f2, f3, nx, 0, nz); tris += 2;
    for (const sg of [-1, 1]) { const s0 = V(cx + tx * hw * sg, y0, cz + tz * hw * sg, 0, tx * sg, tz * sg, pil), s1 = V(cx + tx * hw * sg + nx * dp, y0, cz + tz * hw * sg + nz * dp, 0, tx * sg, tz * sg, pil), s2 = V(cx + tx * hw * sg + nx * dp, y1, cz + tz * hw * sg + nz * dp, 0, tx * sg, tz * sg, pil), s3 = V(cx + tx * hw * sg, y1, cz + tz * hw * sg, 0, tx * sg, tz * sg, pil); B.tri(s0, s1, s2, tx * sg, 0, tz * sg); B.tri(s0, s2, s3, tx * sg, 0, tz * sg); tris += 2; } }
  return tris;
}

/* a vertical blade sign on an arcade column (photo R2): a narrow board standing out from the column at right angles to the wall, two-sided, with the brand lettering running up the board. (cx, cz) the column, (nx, nz) the outward normal of the wall, (tx, tz) along it, y0 its bottom, `key` picks the brand. */
export function bladeSign(m, X, Z, cx, cz, nx, nz, tx, tz, y0, key) {
  const uv = brandUV(((key * 11 + 3) % 1000 + 1000) % BRAND_COUNT), W = new THREE.Color(0xffffff), d0 = 0.45, d1 = 1.35, h = 2.1;
  const sgn = tx * nz - tz * nx;      /* which way round the lettering must run depends on the wall's direction (a viewer at the -t side has +n on their left when sgn < 0): the side facing -t reads right with the plain mapping when sgn < 0, the side facing +t with the turned one, and the other way round when sgn >= 0 */
  for (const [side, flip] of [[0.02, sgn < 0], [-0.02, sgn >= 0]]) { const sx = tx * side, sz = tz * side, P = (d, y) => [cx + nx * d + sx, y, cz + nz * d + sz], p0 = P(d0, y0), p1 = P(d1, y0), p2 = P(d1, y0 + h), p3 = P(d0, y0 + h), nn = flip ? -1 : 1;
    const uvs = flip ? [[uv[0], uv[3]], [uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]]] : [[uv[0], uv[1]], [uv[0], uv[3]], [uv[2], uv[3]], [uv[2], uv[1]]];
    const v = [p0, p1, p2, p3].map((p, i) => m.v(X(p[0]), p[1], Z(p[2]), tx * nn, 0, tz * nn, W, uvs[i][0], uvs[i][1])); m.tri(v[0], v[1], v[2], tx * nn, 0, tz * nn); m.tri(v[0], v[2], v[3], tx * nn, 0, tz * nn); }
  return 4;
}

/* the warm lamp patch: the uv of the lamp cell of the atlas (the same emissive map as the boards, so it glows at night and is a plain pale patch by day) */
export function lampUV() { const W = CELL_W * COLS, H = CELL_H * ROWS_ALL, y = ROWS * CELL_H; return [4 / W, 1 - (y + CELL_H - 4) / H, (CELL_W - 4) / W, 1 - (y + 4) / H]; }

/* a small horizontal glowing patch facing down, centred at (cx, y, cz), w along (tx, tz) and d across; X and Z map world to mesh coordinates (identity for a mesher that already works in tile-local metres) */
export function glowQuad(m, X, Z, cx, y, cz, w, d, tx, tz) {
  const uv = lampUV(), W = new THREE.Color(0xffffff), nx = -tz, nz = tx, P = [[-1, -1, 0, 1], [1, -1, 2, 1], [1, 1, 2, 3], [-1, 1, 0, 3]].map(([a, b, iu, iv]) => m.v(X(cx + tx * a * w / 2 + nx * b * d / 2), y, Z(cz + tz * a * w / 2 + nz * b * d / 2), 0, -1, 0, W, uv[iu], uv[iv]));
  m.tri(P[0], P[1], P[2], 0, -1, 0); m.tri(P[0], P[2], P[3], 0, -1, 0); return 2;
}
/* soffit lights under an arcade slab: one warm panel per bay, along the wall from (ax, az) (direction (tx, tz), outward normal (nx, nz)), at the slab underside height y */
export function soffitLights(m, X, Z, ax, az, tx, tz, nx, nz, l, D, y, bays) {
  let q = 0; for (let k = 0; k < bays; k++) { const u = (k + 0.5) * l / bays; q += glowQuad(m, X, Z, ax + tx * u + nx * D * 0.62, y - 0.03, az + tz * u + nz * D * 0.62, 0.9, 0.6, tx, tz); } return q;
}

/* Light pools (owner: "light on the walk"). A real light per lamp is too costly for a city, so the warm light of the soffit panels and the street lamps is a soft round gradient ADDED onto the ground under each one (additive blending, no depth write). Off by day (the material is hidden), switched on at night by tilemesh.js setNight. Own gradient drawn in code. */
export function makeLightMaterial() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -10, side: THREE.DoubleSide, toneMapped: false }); m.visible = false; return m;
}
const WARM = new THREE.Color(1.0, 0.76, 0.42);
/* one pool: a square of `size` metres centred at (cx, y, cz) facing up; X and Z map world to mesh coordinates */
export function lightPool(m, X, Z, cx, y, cz, size, sizeZ = size) {
  const h = size / 2, hz = sizeZ / 2, P = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]].map(([a, b, u, v]) => m.v(X(cx + a * h), y, Z(cz + b * hz), 0, 1, 0, WARM, u, v));
  m.tri(P[0], P[1], P[2], 0, 1, 0); m.tri(P[0], P[2], P[3], 0, 1, 0); return 2;
}
/* the pools under an arcade's soffit lights: one a bay on the walk, oriented along the wall (a square footprint is rotated by using the wall's axes) */
export function arcadePools(m, X, Z, ax, az, tx, tz, nx, nz, l, D, y, bays) {
  const W = WARM; let q = 0; for (let k = 0; k < bays; k++) { const u = (k + 0.5) * l / bays, cx = ax + tx * u + nx * D * 0.8, cz = az + tz * u + nz * D * 0.8, w = l / bays * 1.5, d = 6.6;
    const P = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]].map(([a, b, uu, vv]) => m.v(X(cx + tx * a * w / 2 + nx * b * d / 2), y, Z(cz + tz * a * w / 2 + nz * b * d / 2), 0, 1, 0, W, uu, vv)); m.tri(P[0], P[1], P[2], 0, 1, 0); m.tri(P[0], P[2], P[3], 0, 1, 0); q += 2; }
  return q;
}

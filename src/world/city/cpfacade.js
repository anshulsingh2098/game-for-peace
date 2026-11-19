/* Connaught Place facade pieces (owner's photos R1 to R4, 20 Nov 2026): the brand-board band along the front of the arcade (a deep fascia of red, blue, black and white panels with lettering that glows at night), and the drum corner blocks with a cornice ring and a dome. Own geometry and an atlas drawn in code; the brand names are INVENTED (the owner's decision of 19 Nov: names may be used as plain lettering, no logos or trade dress are copied, and these are not real shops). The functions only fill a `Mesher` (tilemesh.js) so tilemesh.js needs a few hook lines and this file holds the rest. */
import * as THREE from 'three';

export const BRANDS = [
  ['URBAN THREAD', 0xc4202e, 0xffffff], ['KAFE NOIR', 0x15161a, 0xf2d27a], ['SPORTLINE', 0x1d5bb8, 0xffffff], ['TECHMART', 0xf2f0ea, 0x1d1d22], ['BLUE ORCHID', 0x1f4aa0, 0xffffff], ['SILK & SAGE', 0x2e2a30, 0xe8d6b0], ['ROYAL BAZAAR', 0x7a1a22, 0xf5e6b8], ['NOVA MOBILES', 0xe9791c, 0xffffff],
  ['GREEN LEAF', 0x1f6a3a, 0xffffff], ['SHOE STREET', 0xc4202e, 0xffffff], ['PIXEL WORLD', 0x15161a, 0x6fd0ff], ['SWEET TOOTH', 0xd9418a, 0xffffff], ['DENIM CO', 0x1d5bb8, 0xffffff], ['SPICE ROUTE', 0xb3341c, 0xfff0c8], ['OPTICA', 0xf2f0ea, 0x1d1d22], ['GOLDEN CROWN', 0x2e2a30, 0xe6b84a],
  ['LITTLE LOOM', 0x5a2a86, 0xffffff], ['CITY PHARMA', 0x1f6a3a, 0xffffff], ['BOOK NOOK', 0xf5e6b8, 0x4a1c14], ['FRESH BITES', 0xe9791c, 0xffffff], ['ELECTRO HUB', 0x1d5bb8, 0xffffff], ['MODA', 0x15161a, 0xffffff], ['TEA HOUSE', 0x1f6a3a, 0xf5e6b8], ['GADGET GURU', 0xc4202e, 0xffffff],
  ['CAFE MODERN', 0x2e2a30, 0xffffff], ['STYLE HUB', 0x5a2a86, 0xffffff], ['KIDS KORNER', 0xf2c230, 0x1d1d22], ['HOME & HEARTH', 0x7a1a22, 0xffffff], ['SUPER SPORTS', 0x1d5bb8, 0xffffff], ['SAREE PALACE', 0xc4202e, 0xf5e6b8], ['LENS CRAFT', 0x15161a, 0xffffff], ['FOOD COURT', 0xe9791c, 0x1d1d22],
];
const CELL_W = 256, CELL_H = 64, COLS = 4, ROWS = 8;
export const BRAND_COUNT = BRANDS.length;

/* the brand atlas: one 1024 x 512 canvas of 32 boards; the same canvas is the emissive map, so the boards glow at night */
export function makeBrandAtlas() {
  const c = document.createElement('canvas'); c.width = CELL_W * COLS; c.height = CELL_H * ROWS; const g = c.getContext('2d');
  BRANDS.forEach(([name, bg, fg], i) => {
    const x = (i % COLS) * CELL_W, y = Math.floor(i / COLS) * CELL_H, hex = h => '#' + h.toString(16).padStart(6, '0');
    g.fillStyle = hex(bg); g.fillRect(x, y, CELL_W, CELL_H); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.strokeRect(x + 3, y + 3, CELL_W - 6, CELL_H - 6);
    g.fillStyle = hex(fg); g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 34; g.font = 'bold ' + fs + 'px Arial,Helvetica,sans-serif'; while (g.measureText(name).width > CELL_W - 30 && fs > 12) { fs -= 2; g.font = 'bold ' + fs + 'px Arial,Helvetica,sans-serif'; } g.fillText(name, x + CELL_W / 2, y + CELL_H / 2 + 2);
  });
  return c;
}
export function brandUV(i) { const k = ((i % BRAND_COUNT) + BRAND_COUNT) % BRAND_COUNT, x = (k % COLS) * CELL_W, y = Math.floor(k / COLS) * CELL_H, W = CELL_W * COLS, H = CELL_H * ROWS; return [(x + 2) / W, 1 - (y + CELL_H - 2) / H, (x + CELL_W - 2) / W, 1 - (y + 2) / H]; }

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
  /* three dark window slots (tall, narrow) on the street side, one above the other level of each upper floor */
  const px = -oz, pz = ox;
  for (const [off, w2] of [[-1.6, 0.7], [0, 0.9], [1.6, 0.7]]) for (let f = 0; f < 2; f++) { const yb = y1 - 6.2 + f * 3.4; if (yb < y0 + 4.6) continue; const wx = cx + ox * (R + 0.04) + px * off * 0.85, wz = cz + oz * (R + 0.04) + pz * off * 0.85;
    const a = V(wx - px * w2 / 2, yb, wz - pz * w2 / 2, ox, 0, oz, dark), b = V(wx + px * w2 / 2, yb, wz + pz * w2 / 2, ox, 0, oz, dark), c2 = V(wx + px * w2 / 2, yb + 2.2, wz + pz * w2 / 2, ox, 0, oz, dark), d = V(wx - px * w2 / 2, yb + 2.2, wz - pz * w2 / 2, ox, 0, oz, dark); B.tri(a, b, c2, ox, 0, oz); B.tri(a, c2, d, ox, 0, oz); }
}

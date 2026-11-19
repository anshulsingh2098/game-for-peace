/* Connaught Place facade pieces (owner's photos R1 to R4, 20 Nov 2026): the brand-board band along the front of the arcade (a deep fascia of red, blue, black and white panels with lettering that glows at night), and the drum corner blocks with a cornice ring and a dome. Own geometry and an atlas drawn in code; the brand names are INVENTED (the owner's decision of 19 Nov: names may be used as plain lettering, no logos or trade dress are copied, and these are not real shops). The functions only fill a `Mesher` (tilemesh.js) so tilemesh.js needs a few hook lines and this file holds the rest. */
import * as THREE from 'three';
import { CP_PLACES } from './cpplaces.js';

export const BRANDS = [
  ['URBAN THREAD', 0xc4202e, 0xffffff], ['KAFE NOIR', 0x15161a, 0xf2d27a], ['SPORTLINE', 0x1d5bb8, 0xffffff], ['TECHMART', 0xf2f0ea, 0x1d1d22], ['BLUE ORCHID', 0x1f4aa0, 0xffffff], ['SILK & SAGE', 0x2e2a30, 0xe8d6b0], ['ROYAL BAZAAR', 0x7a1a22, 0xf5e6b8], ['NOVA MOBILES', 0xe9791c, 0xffffff],
  ['GREEN LEAF', 0x1f6a3a, 0xffffff], ['SHOE STREET', 0xc4202e, 0xffffff], ['PIXEL WORLD', 0x15161a, 0x6fd0ff], ['SWEET TOOTH', 0xd9418a, 0xffffff], ['DENIM CO', 0x1d5bb8, 0xffffff], ['SPICE ROUTE', 0xb3341c, 0xfff0c8], ['OPTICA', 0xf2f0ea, 0x1d1d22], ['GOLDEN CROWN', 0x2e2a30, 0xe6b84a],
  ['LITTLE LOOM', 0x5a2a86, 0xffffff], ['CITY PHARMA', 0x1f6a3a, 0xffffff], ['BOOK NOOK', 0xf5e6b8, 0x4a1c14], ['FRESH BITES', 0xe9791c, 0xffffff], ['ELECTRO HUB', 0x1d5bb8, 0xffffff], ['MODA', 0x15161a, 0xffffff], ['TEA HOUSE', 0x1f6a3a, 0xf5e6b8], ['GADGET GURU', 0xc4202e, 0xffffff],
  ['CAFE MODERN', 0x2e2a30, 0xffffff], ['STYLE HUB', 0x5a2a86, 0xffffff], ['KIDS KORNER', 0xf2c230, 0x1d1d22], ['HOME & HEARTH', 0x7a1a22, 0xffffff], ['SUPER SPORTS', 0x1d5bb8, 0xffffff], ['SAREE PALACE', 0xc4202e, 0xf5e6b8], ['LENS CRAFT', 0x15161a, 0xffffff], ['FOOD COURT', 0xe9791c, 0x1d1d22],
];
const CELL_W = 256, CELL_H = 64, COLS = 4, ROWS = 8, ROWS_ALL = 9;      /* 8 rows of boards and a last row whose first cell is the warm lamp patch */
export const BRAND_COUNT = BRANDS.length;
/* L2 (docs/CP_LANDMARKS.md): the named places of CP as extra boards. Atlas cells for them sit below the lamp row, 5 columns of 192 x 48; an index of 1000 + k means place k. */
const PCELL_W = 192, PCELL_H = 48, PCOLS = 5, PLACE_NAMES = [], PLACE_KIND = [], PLACE_OF = new Map(); for (const [n, kind] of CP_PLACES) if (!PLACE_OF.has(n)) { PLACE_OF.set(n, PLACE_NAMES.length); PLACE_NAMES.push(n); PLACE_KIND.push(kind); }
const PBASE_Y = 9 * 64, SP_Y = PBASE_Y + Math.ceil(PLACE_NAMES.length / PCOLS) * PCELL_H, ATLAS_H = SP_Y + 320 + 64 * 2 + 48 * 2 + 64;      /* L3: below the place cells a strip for the cinema: the big letters (1024 x 96), the canopy board (512 x 64), two solid cells (yellow, gold) and three film posters (128 x 160) */
const SPECIAL = { letters: [0, SP_Y, 1024, 96], canopy: [0, SP_Y + 96, 512, 64], yellow: [520, SP_Y + 100, 16, 16], gold: [560, SP_Y + 100, 16, 16], poster0: [0, SP_Y + 160, 128, 160], poster1: [136, SP_Y + 160, 128, 160], poster2: [272, SP_Y + 160, 128, 160], palika: [600, SP_Y + 96, 400, 64], fuel: [410, SP_Y + 160, 400, 64], newbook: [410, SP_Y + 230, 400, 64], statesman: [600, SP_Y + 230, 400, 64], letters_odeon: [0, SP_Y + 320, 1024, 64], letters_rivolo: [0, SP_Y + 384, 1024, 64], canopy_odeon: [0, SP_Y + 448, 512, 48], canopy_rivolo: [0, SP_Y + 496, 512, 48], jeevan: [600, SP_Y + 544, 400, 64] };
export function specialUV(id) { const [x, y, w, h] = SPECIAL[id], W = 1024; return [(x + 1) / W, 1 - (y + h - 1) / ATLAS_H, (x + w - 1) / W, 1 - (y + 1) / ATLAS_H]; }
/* a board style by kind and by name (a deterministic pick): cafes brown and cream, bars black with a neon colour, restaurants deep red, green or blue with cream, food counters red and yellow, the cinema black and gold */
const PSTYLE = { cafe: [[0x4a2c1a, 0xf5e6c8], [0x1f5a3c, 0xf5e6c8], [0x2b1d14, 0xe8c27a]], bar: [[0x15161a, 0xff5fa8], [0x15161a, 0x5fd0ff], [0x1b1030, 0xffd45f]], restaurant: [[0x7a1a22, 0xf5e6b8], [0x1d3f6a, 0xf5ecd8], [0x2e5a2a, 0xf5ecd8], [0x3a2a24, 0xe8c27a]], food: [[0xc4202e, 0xffd23a], [0xe9791c, 0xffffff], [0xf2c230, 0x8a1c1c], [0x1f5bb8, 0xffffff]], cinema: [[0x111111, 0xe6b84a]] };
const pstyle = (name, kind) => { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; const l = PSTYLE[kind] || PSTYLE.restaurant; return l[h % l.length]; };
/* which board of an arcade front shows which place: a place belongs to the board nearest to it when it lies within 18 m of the board line and between its ends; the other boards keep the invented generic brands. Returns an array of n brand indices (generic 0..31 or 1000 + place). */
export function assignBoards(ax, az, bx, bz, n, key) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, tx = dx / L, tz = dz / L, out = new Array(n), best = new Array(n).fill(18);
  for (let k = 0; k < n; k++) out[k] = brandIndex(key, k);
  for (const [name, , x, z] of CP_PLACES) { const u = (x - ax) * tx + (z - az) * tz, d = Math.abs(-(x - ax) * tz + (z - az) * tx); if (u < 0 || u > L || d > 18) continue; const k = Math.min(n - 1, Math.floor(u / L * n)); if (d < best[k]) { best[k] = d; out[k] = 1000 + PLACE_OF.get(name); } }
  return out;
}
export function boardColour(i) { return i >= 1000 ? pstyle(PLACE_NAMES[i - 1000], PLACE_KIND[i - 1000])[0] : BRANDS[i][1]; }

/* the brand atlas: one 1024 x 512 canvas of 32 boards; the same canvas is the emissive map, so the boards glow at night */
export function makeBrandAtlas() {
  const c = document.createElement('canvas'); c.width = CELL_W * COLS; c.height = ATLAS_H; const g = c.getContext('2d');
  BRANDS.forEach(([name, bg, fg], i) => {
    const x = (i % COLS) * CELL_W, y = Math.floor(i / COLS) * CELL_H, hex = h => '#' + h.toString(16).padStart(6, '0');
    g.fillStyle = hex(bg); g.fillRect(x, y, CELL_W, CELL_H); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.strokeRect(x + 3, y + 3, CELL_W - 6, CELL_H - 6);
    g.fillStyle = hex(fg); g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 34; g.font = 'bold ' + fs + 'px Arial,Helvetica,sans-serif'; while (g.measureText(name).width > CELL_W - 30 && fs > 12) { fs -= 2; g.font = 'bold ' + fs + 'px Arial,Helvetica,sans-serif'; } g.fillText(name, x + CELL_W / 2, y + CELL_H / 2 + 2);
  });
  { const x = 0, y = ROWS * CELL_H, gr = g.createRadialGradient(x + CELL_W / 2, y + CELL_H / 2, 4, x + CELL_W / 2, y + CELL_H / 2, CELL_W / 2); gr.addColorStop(0, '#fff3c4'); gr.addColorStop(0.6, '#ffd27a'); gr.addColorStop(1, '#ffb347'); g.fillStyle = gr; g.fillRect(x, y, CELL_W, CELL_H); }      // the warm lamp patch
  PLACE_NAMES.forEach((name, k) => { const [bg, fg] = pstyle(name, PLACE_KIND[k]), x = (k % PCOLS) * PCELL_W, y = PBASE_Y + Math.floor(k / PCOLS) * PCELL_H, hex = h => '#' + h.toString(16).padStart(6, '0');
    g.fillStyle = hex(bg); g.fillRect(x, y, PCELL_W, PCELL_H); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, PCELL_W - 4, PCELL_H - 4);
    g.fillStyle = hex(fg); g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 26; g.font = 'bold ' + fs + 'px Arial,Helvetica,sans-serif'; while (g.measureText(name.toUpperCase()).width > PCELL_W - 18 && fs > 10) { fs -= 2; g.font = 'bold ' + fs + 'px Arial,Helvetica,sans-serif'; } g.fillText(name.toUpperCase(), x + PCELL_W / 2, y + PCELL_H / 2 + 1); });
  { const [lx, ly, lw, lh] = SPECIAL.letters; g.fillStyle = '#16120e'; g.fillRect(lx, ly, lw, lh); g.fillStyle = '#e8b83a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 84px Georgia,serif'; g.fillText('P V X   P L A Z A', lw / 2, ly + lh / 2 + 4);
    const [cx, cy, cw, ch] = SPECIAL.canopy; g.fillStyle = '#f0c020'; g.fillRect(cx, cy, cw, ch); g.fillStyle = '#1a1208'; g.font = 'bold 36px Arial,Helvetica,sans-serif'; g.fillText('PVX PLAZA CINEMA  TICKETS', cx + cw / 2, cy + ch / 2 + 2);
    { const [qx, qy, qw, qh] = SPECIAL.palika; g.fillStyle = '#1d4a7a'; g.fillRect(qx, qy, qw, qh); g.fillStyle = '#f5ecd8'; g.font = 'bold 38px Arial,Helvetica,sans-serif'; g.fillText('PALIKA BAZAAR  GATE', qx + qw / 2, qy + qh / 2 + 2); g.strokeStyle = '#f5ecd8'; g.lineWidth = 3; g.strokeRect(qx + 3, qy + 3, qw - 6, qh - 6); }
    { const [qx, qy, qw, qh] = SPECIAL.fuel; g.fillStyle = '#c4202e'; g.fillRect(qx, qy, qw, qh / 2); g.fillStyle = '#1d4a9a'; g.fillRect(qx, qy + qh / 2, qw, qh / 2); g.fillStyle = '#ffffff'; g.font = 'bold 34px Arial,Helvetica,sans-serif'; g.fillText('BHARAT PETROL', qx + qw / 2, qy + qh / 4 + 1); g.font = 'bold 22px Arial,Helvetica,sans-serif'; g.fillText('PETROL   DIESEL   CNG', qx + qw / 2, qy + qh * 0.75 + 1); }
    { const [qx, qy, qw, qh] = SPECIAL.newbook; g.fillStyle = '#f4f1ea'; g.fillRect(qx, qy, qw, qh); g.fillStyle = '#7a1a22'; g.font = 'bold 44px Arial,Helvetica,sans-serif'; g.fillText('NEW BOOK LAND', qx + qw / 2, qy + qh / 2 + 2); g.fillStyle = '#1d4a8a'; g.fillRect(qx, qy, qw, 5); g.fillRect(qx, qy + qh - 5, qw, 5); }
    { const [qx, qy, qw, qh] = SPECIAL.statesman; g.fillStyle = '#d8c9ac'; g.fillRect(qx, qy, qw, qh); g.fillStyle = '#2b2218'; g.font = 'bold 34px Georgia,serif'; g.fillText('STATESMAN HOUSE', qx + qw / 2, qy + qh / 2 + 2); g.strokeStyle = '#2b2218'; g.lineWidth = 3; g.strokeRect(qx + 4, qy + 4, qw - 8, qh - 8); }
    for (const [id, text, fg, bg] of [['letters_odeon', 'O D E Y O N', '#e8b83a', '#17120d'], ['letters_rivolo', 'R I V O L O', '#e6d9a8', '#3a1214']]) { const [qx, qy, qw, qh] = SPECIAL[id]; g.fillStyle = bg; g.fillRect(qx, qy, qw, qh); g.fillStyle = fg; g.font = 'bold 54px Georgia,serif'; g.fillText(text, qx + qw / 2, qy + qh / 2 + 3); }
    for (const [id, text, bg] of [['canopy_odeon', 'ODEYON CINEMA  TICKETS', '#d9e2ee'], ['canopy_rivolo', 'RIVOLO CINEMA  TICKETS', '#e8d6a0']]) { const [qx, qy, qw, qh] = SPECIAL[id]; g.fillStyle = bg; g.fillRect(qx, qy, qw, qh); g.fillStyle = '#1a1208'; g.font = 'bold 30px Arial,Helvetica,sans-serif'; g.fillText(text, qx + qw / 2, qy + qh / 2 + 2); }
    { const [qx, qy, qw, qh] = SPECIAL.jeevan; g.fillStyle = '#1f2a3a'; g.fillRect(qx, qy, qw, qh); g.fillStyle = '#e9e2cf'; g.font = 'bold 36px Arial,Helvetica,sans-serif'; g.fillText('JEEVAN BHARATI', qx + qw / 2, qy + qh / 2 + 2); }
    g.fillStyle = '#f5c518'; g.fillRect(...SPECIAL.yellow); g.fillStyle = '#e8b83a'; g.fillRect(...SPECIAL.gold);
    const posters = [['#7a1c1c', '#f0b030', 'DHOOM', 'NIGHTS'], ['#12304f', '#8fd0ff', 'RAJA', 'RETURNS'], ['#3a1850', '#ff9ad0', 'CHAI', 'AUR PYAAR']];
    posters.forEach(([bg, fg, t1, t2], i) => { const [px, py, pw, ph] = SPECIAL['poster' + i], gr = g.createLinearGradient(px, py, px, py + ph); gr.addColorStop(0, bg); gr.addColorStop(1, '#0b0b10'); g.fillStyle = gr; g.fillRect(px, py, pw, ph);
      g.fillStyle = fg; g.globalAlpha = 0.35; g.beginPath(); g.ellipse(px + pw / 2, py + ph * 0.42, pw * 0.3, ph * 0.28, 0, 0, 7); g.fill(); g.fillRect(px + pw * 0.22, py + ph * 0.6, pw * 0.56, ph * 0.2); g.globalAlpha = 1;
      g.fillStyle = fg; g.font = 'bold 26px Arial,Helvetica,sans-serif'; g.fillText(t1, px + pw / 2, py + ph * 0.84); g.font = 'bold 15px Arial,Helvetica,sans-serif'; g.fillText(t2, px + pw / 2, py + ph * 0.93); g.strokeStyle = fg; g.lineWidth = 2; g.strokeRect(px + 3, py + 3, pw - 6, ph - 6); }); }
  return c;
}
export function brandUV(i) {
  if (i >= 1000) { const k = i - 1000, x = (k % PCOLS) * PCELL_W, y = PBASE_Y + Math.floor(k / PCOLS) * PCELL_H, W = CELL_W * COLS; return [(x + 2) / W, 1 - (y + PCELL_H - 2) / ATLAS_H, (x + PCELL_W - 2) / W, 1 - (y + 2) / ATLAS_H]; }
  return brandUV0(i);
}
function brandUV0(i) { const k = ((i % BRAND_COUNT) + BRAND_COUNT) % BRAND_COUNT, x = (k % COLS) * CELL_W, y = Math.floor(k / COLS) * CELL_H, W = CELL_W * COLS, H = ATLAS_H; return [(x + 2) / W, 1 - (y + CELL_H - 2) / H, (x + CELL_W - 2) / W, 1 - (y + 2) / H]; }

/* the material: the atlas as colour and as emissive map (intensity 0 by day, raised at night by tilemesh.js setNight), a little glow always so the lettering stays crisp */
export function makeBrandMaterial() {
  const tex = new THREE.CanvasTexture(makeBrandAtlas()); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12, roughness: 0.6, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.3 }); m.userData.kit = true; return m;
}

/* the brand-board band along one arcade front: from point a to point b (x, z), at height y0, `h` tall, facing (nx, nz), one board a bay of about `bay` metres, each a different brand. `key` varies the choice by building. */
export function brandBand(m, X, Z, ax, az, bx, bz, nx, nz, y0, h, bay, key, upper = false) {      /* upper: the second row of boards on the wall over the arcade (photos P1 and P2): generic brands only, every second bay, set 7 cm off the wall */
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 3) return 0; const n = Math.max(1, Math.round(L / bay)), tx = dx / L, tz = dz / L, w = L / n - 0.25, IDX = upper ? Array.from({ length: n }, (_, k) => brandIndex(key + 77, k)) : assignBoards(ax, az, bx, bz, n, key); let q = 0;
  for (let k = 0; k < n; k++) { if (upper && k % 2) continue; const uMid = (k + 0.5) * L / n, cx = ax + tx * uMid + nx * (upper ? 0.32 : 0.06), cz = az + tz * uMid + nz * (upper ? 0.32 : 0.06), uv0 = brandUV(IDX[k]), uv = (tx * nz - tz * nx) < 0 ? [uv0[2], uv0[1], uv0[0], uv0[3]] : uv0;      /* seen from outside the wall the texture must run left to right: the viewer's right is (nz, -nx), so a wall running the other way gets the picture turned round (it read mirrored on half the walls) */ const W = new THREE.Color(0xffffff);
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
    /* the underside of the cornice ring (seen from the street the ring was an open collar, which read as slanted flaps), shaft side to ring edge, facing down */
    const u0 = V(cx + Math.cos(a0) * R, top - 0.4, cz + Math.sin(a0) * R, 0, -1, 0, ring), u1 = V(cx + Math.cos(a1) * R, top - 0.4, cz + Math.sin(a1) * R, 0, -1, 0, ring), u2 = V(r1[0], top - 0.4, r1[1], 0, -1, 0, ring), u3 = V(r0[0], top - 0.4, r0[1], 0, -1, 0, ring); B.tri(u0, u2, u1, 0, -1, 0); B.tri(u0, u3, u2, 0, -1, 0);
    /* a two-tier dome (a drum, then a rounded cap, then a finial) instead of one thin cone */
    const nn = [nx * 0.7, 0.7, nz * 0.7], P = (rr, yy, a) => V(cx + Math.cos(a) * R * rr, top + yy, cz + Math.sin(a) * R * rr, nn[0], nn[1], nn[2], cap);
    const tiers = [[0.8, 0.35], [0.74, 0.75], [0.56, 1.35], [0.3, 1.85], [0.04, 2.15]];
    for (let q = 0; q + 1 < tiers.length; q++) { const e0 = P(tiers[q][0], tiers[q][1], a0), e1 = P(tiers[q][0], tiers[q][1], a1), f1 = P(tiers[q + 1][0], tiers[q + 1][1], a1), f0 = P(tiers[q + 1][0], tiers[q + 1][1], a0); B.tri(e0, e1, f1, nn[0], nn[1], nn[2]); B.tri(e0, f1, f0, nn[0], nn[1], nn[2]); } }
  const fin = (yy, hh) => { for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, a2 = a + Math.PI / 2; const p0 = V(cx + Math.cos(a) * 0.12, top + yy, cz + Math.sin(a) * 0.12, 0, 0, 1, ring), p1 = V(cx + Math.cos(a2) * 0.12, top + yy, cz + Math.sin(a2) * 0.12, 0, 0, 1, ring), p2 = V(cx, top + yy + hh, cz, 0, 1, 0, ring); B.tri(p0, p1, p2, 0, 1, 0); } }; fin(2.1, 1.1);
  /* arched windows on the street side (photo R1): three a floor, each a dark rectangle with a half-round head, a white sill with a small balustrade block under it; a triangular pediment over the middle of the cornice */
  const px = -oz, pz = ox, sill = wc.clone().multiplyScalar(1.12);
  for (const [off, w2] of [[-1.7, 0.8], [0, 1.0], [1.7, 0.8]]) for (let f = 0; f < 2; f++) { const yb = y1 - 6.4 + f * 3.5; if (yb < y0 + 4.6) continue; const wx = cx + ox * (R + 0.05) + px * off * 0.85, wz = cz + oz * (R + 0.05) + pz * off * 0.85, hw2 = w2 / 2, hStraight = 1.5;
    { const sx0 = cx + ox * (R + 0.03) + px * off * 0.85, sz0 = cz + oz * (R + 0.03) + pz * off * 0.85, fw = hw2 + 0.2, y0f = yb - 0.1, yS = yb + hStraight + 0.05;      // the surround: a lighter frame a little larger than the window and just behind it
      const fa = V(sx0 - px * fw, y0f, sz0 - pz * fw, ox, 0, oz, ring), fb = V(sx0 + px * fw, y0f, sz0 + pz * fw, ox, 0, oz, ring), fc = V(sx0 + px * fw, yS, sz0 + pz * fw, ox, 0, oz, ring), fd = V(sx0 - px * fw, yS, sz0 - pz * fw, ox, 0, oz, ring); B.tri(fa, fb, fc, ox, 0, oz); B.tri(fa, fc, fd, ox, 0, oz);
      const fh = V(sx0, yS, sz0, ox, 0, oz, ring); let fp = fd; for (let k3 = 1; k3 <= 4; k3++) { const an = Math.PI * k3 / 4, ex = sx0 - px * fw * Math.cos(an), ez = sz0 - pz * fw * Math.cos(an), ey = yS + fw * Math.sin(an), cu = V(ex, ey, ez, ox, 0, oz, ring); B.tri(fh, fp, cu, ox, 0, oz); fp = cu; } }
    const a = V(wx - px * hw2, yb, wz - pz * hw2, ox, 0, oz, dark), b = V(wx + px * hw2, yb, wz + pz * hw2, ox, 0, oz, dark), c2 = V(wx + px * hw2, yb + hStraight, wz + pz * hw2, ox, 0, oz, dark), d = V(wx - px * hw2, yb + hStraight, wz - pz * hw2, ox, 0, oz, dark); B.tri(a, b, c2, ox, 0, oz); B.tri(a, c2, d, ox, 0, oz);
    const hub = V(wx, yb + hStraight, wz, ox, 0, oz, dark); let prev = d; for (let k2 = 1; k2 <= 6; k2++) { const an = Math.PI * k2 / 6, ex = wx - px * hw2 * Math.cos(an), ez = wz - pz * hw2 * Math.cos(an), ey = yb + hStraight + hw2 * Math.sin(an), cur = V(ex, ey, ez, ox, 0, oz, dark); B.tri(hub, prev, cur, ox, 0, oz); prev = cur; }
    const sx = wx + ox * 0.1, sz = wz + oz * 0.1, sw = w2 + 0.5, Vu = (x, y, z, c, u, v) => B.v(X(x), y, Z(z), ox, 0, oz, c, u, v), s0 = Vu(sx - px * sw / 2, yb - 0.4, sz - pz * sw / 2, sill, 0.059, 0.031), s1 = Vu(sx + px * sw / 2, yb - 0.4, sz + pz * sw / 2, sill, 0.191, 0.031), s2 = Vu(sx + px * sw / 2, yb, sz + pz * sw / 2, sill, 0.191, 0.082), s3 = Vu(sx - px * sw / 2, yb, sz - pz * sw / 2, sill, 0.059, 0.082);      /* the sill block shows the balustrade strip (rail and posts) of the CP facade texture: no extra triangles for the posts */ B.tri(s0, s1, s2, ox, 0, oz); B.tri(s0, s2, s3, ox, 0, oz);
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
export function lampUV() { const W = CELL_W * COLS, H = ATLAS_H, y = ROWS * CELL_H; return [4 / W, 1 - (y + CELL_H - 4) / H, (CELL_W - 4) / W, 1 - (y + 4) / H]; }

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
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 192, 2, 64, 192, 64);      /* the bottom half (v 0 to 0.5): the round pool; the top half (v 0.5 to 1): a vertical wash, bright at the top and fading downward, soft at the sides (light spilling down a column or a wall) */
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 128, 128, 128);
  const vg = g.createLinearGradient(0, 0, 0, 128); vg.addColorStop(0, 'rgba(255,255,255,0.95)'); vg.addColorStop(0.5, 'rgba(255,255,255,0.35)'); vg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = vg; g.fillRect(0, 0, 128, 128);
  g.save(); g.beginPath(); g.rect(0, 0, 128, 128); g.clip();      /* destination-in clears everything outside the shape, so it is confined to the top half or it would erase the pool below */
  g.globalCompositeOperation = 'destination-in'; const hg = g.createLinearGradient(0, 0, 128, 0); hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.3, 'rgba(255,255,255,1)'); hg.addColorStop(0.7, 'rgba(255,255,255,1)'); hg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hg; g.fillRect(0, 0, 128, 128); g.globalCompositeOperation = 'source-over'; g.restore();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -10, side: THREE.DoubleSide, toneMapped: false }); m.visible = false; return m;
}
const WARM = new THREE.Color(1.0, 0.76, 0.42);
/* one pool: a square of `size` metres centred at (cx, y, cz) facing up; X and Z map world to mesh coordinates */
export function lightPool(m, X, Z, cx, y, cz, size, sizeZ = size) {
  const h = size / 2, hz = sizeZ / 2, P = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 0.5], [-1, 1, 0, 0.5]].map(([a, b, u, v]) => m.v(X(cx + a * h), y, Z(cz + b * hz), 0, 1, 0, WARM, u, v));
  m.tri(P[0], P[1], P[2], 0, 1, 0); m.tri(P[0], P[2], P[3], 0, 1, 0); return 2;
}
/* the pools under an arcade's soffit lights: one a bay on the walk, oriented along the wall (a square footprint is rotated by using the wall's axes) */
export function arcadePools(m, X, Z, ax, az, tx, tz, nx, nz, l, D, y, bays) {
  const W = WARM; let q = 0; for (let k = 0; k < bays; k++) { const u = (k + 0.5) * l / bays, cx = ax + tx * u + nx * D * 0.8, cz = az + tz * u + nz * D * 0.8, w = l / bays * 1.5, d = 6.6;
    const P = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 0.5], [-1, 1, 0, 0.5]].map(([a, b, uu, vv]) => m.v(X(cx + tx * a * w / 2 + nx * b * d / 2), y, Z(cz + tz * a * w / 2 + nz * b * d / 2), 0, 1, 0, W, uu, vv)); m.tri(P[0], P[1], P[2], 0, 1, 0); m.tri(P[0], P[2], P[3], 0, 1, 0); q += 2; }
  return q;
}

/* The CP facade texture (phase 2 of docs/DELHI_MAIN_PLAN.md): 4 bays by 4 storeys on 256 px, a bay 3.6 m wide and a storey 4.0 m tall, so a floor is 64 px and the texture's floor lines fall exactly on the string courses (the walls of CP blocks are mapped from the top of the arcade band, y = 7.3 m, see tilemesh.js). Rows from the bottom: 0 the first upper floor: tall arched windows with white surrounds and a balustrade rail with posts; 1 and 2 rectangular windows with lintels, sills and green louvred shutters; 3 the arcade zone seen behind the columns (plain stucco, a darker band). Returns [colour canvas, emissive canvas] (lit windows glow warm at night). The texel at (0.06, 0.06) stays plain wall: the drum corner blocks use it as their blank area. Own work, drawn in code. */
export function cpFacadeTextures(rnd) {
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = 256; return c; }, cv = mk(), ev = mk(), g = cv.getContext('2d'), e = ev.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256); e.fillStyle = '#000'; e.fillRect(0, 0, 256, 256);
  const lit = () => { const t = rnd(); return t < 0.45 ? '#ffd58a' : t < 0.6 ? '#bfe3ff' : null; };
  for (let k = 0; k < 4; k++) for (let q = 0; q < 4; q++) { const x = q * 64, y = (3 - k) * 64;         // cell: k the storey from the bottom, canvas y grows downward
    if (k === 3) { g.fillStyle = '#ece6d8'; g.fillRect(x, y, 64, 64); g.fillStyle = '#d6cfbd'; g.fillRect(x, y + 40, 64, 10); continue; }
    g.fillStyle = '#e4dfd2'; g.fillRect(x, y, 3, 64); g.fillRect(x + 61, y, 3, 64);                                                                   // the bay edges (pilaster shadow)
    const wx = x + 21, ww = 22, wy = y + 16, wh = 36, c = lit();
    if (k === 0) { g.fillStyle = '#f4f2ea'; g.fillRect(wx - 3, wy + 9, ww + 6, wh - 9 + 3); g.beginPath(); g.arc(x + 32, wy + 9, 14, Math.PI, 0); g.fill();                 // the surround, arched
      g.fillStyle = '#33465c'; g.fillRect(wx, wy + 9, ww, wh - 9); g.beginPath(); g.arc(x + 32, wy + 9, 11, Math.PI, 0); g.fill(); g.fillStyle = '#c9c8c0'; g.fillRect(x + 31, wy - 2, 2, wh + 2); g.fillRect(wx, wy + 22, ww, 1);
      if (c) { e.fillStyle = c; e.fillRect(wx + 1, wy + 9, ww - 2, wh - 11); e.beginPath(); e.arc(x + 32, wy + 9, 10, Math.PI, 0); e.fill(); }
      g.fillStyle = '#e9e5d8'; g.fillRect(wx - 6, y + 43, ww + 12, 2);                                                                              // the balustrade rail
      g.fillStyle = '#dcd7c8'; for (let p = 0; p < 8; p++) g.fillRect(wx - 5 + p * 5, y + 45, 2, 9); g.fillRect(wx - 6, y + 54, ww + 12, 2); }
    else { g.fillStyle = '#f0ede2'; g.fillRect(wx - 3, wy - 5, ww + 6, 5); g.fillRect(wx - 2, wy + wh, ww + 4, 3);                                    // lintel and sill
      g.fillStyle = '#33465c'; g.fillRect(wx, wy, ww, wh); g.fillStyle = '#c9c8c0'; g.fillRect(x + 31, wy, 2, wh); g.fillRect(wx, wy + 14, ww, 1);
      if (c) { e.fillStyle = c; e.fillRect(wx + 1, wy + 1, ww - 2, wh - 2); }
      for (const sx of [wx - 9, wx + ww + 1]) { g.fillStyle = '#5b7a55'; g.fillRect(sx, wy - 1, 8, wh + 2); g.fillStyle = '#46603f'; for (let l2 = 0; l2 < 12; l2++) g.fillRect(sx + 1, wy + l2 * 3, 6, 1); } }
    g.fillStyle = '#cfc9bb'; g.fillRect(x, y + 61, 64, 3);                                                                                            // the floor line (a string course goes here)
  }
  /* F1b (docs/CP_FIX_PLAN.md): weathering over the whole facade texture: a tonal wash per cell, rain streaks running down from every sill and from the corners of the surrounds, damp and soot along the floor line, green-grey mould patches, and darker bay edges. Alpha-blended greys on top of the clean drawing, kept inside each 64 px cell so the texture still tiles. Colour map only. */
  g.save();
  for (let k = 0; k < 3; k++) for (let q = 0; q < 4; q++) { const x = q * 64, y = (3 - k) * 64, wx = x + 21, ww = 22, wy = y + 16, wh = 36;
    g.fillStyle = 'rgba(70,62,50,' + (0.03 + 0.08 * rnd()).toFixed(3) + ')'; g.fillRect(x, y, 64, 64);                                                     // a tonal wash
    for (let st = 0; st < 5; st++) { const sx = wx - 2 + rnd() * (ww + 4), len = 10 + rnd() * 26, w = 1 + Math.floor(rnd() * 3), a = 0.14 + 0.2 * rnd(); const gr = g.createLinearGradient(0, y + wy - y + wh + 3, 0, Math.min(y + 62, wy + wh + 3 + len)); gr.addColorStop(0, 'rgba(60,54,44,' + a.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(60,54,44,0)'); g.fillStyle = gr; g.fillRect(sx, wy + wh + 3, w, Math.min(len, y + 62 - (wy + wh + 3))); }        // streaks from the sill
    for (const sx of [wx - 3, wx + ww + 2]) { const len = 8 + rnd() * 16, gr = g.createLinearGradient(0, wy, 0, wy + len); gr.addColorStop(0, 'rgba(55,50,42,0.2)'); gr.addColorStop(1, 'rgba(55,50,42,0)'); g.fillStyle = gr; g.fillRect(sx, wy - 4, 2, len); }     // down the edges of the surround
    { const gr = g.createLinearGradient(0, y + 46, 0, y + 64); gr.addColorStop(0, 'rgba(50,46,38,0)'); gr.addColorStop(1, 'rgba(50,46,38,' + (0.12 + 0.12 * rnd()).toFixed(3) + ')'); g.fillStyle = gr; g.fillRect(x, y + 46, 64, 18); }      // damp and soot above the floor line
    if (rnd() < 0.5) { const mx = x + 10 + rnd() * 44, my = y + 8 + rnd() * 8, mr = 6 + rnd() * 6, gr = g.createRadialGradient(mx, my, 0, mx, my, mr); gr.addColorStop(0, 'rgba(70,86,60,' + (0.1 + 0.08 * rnd()).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(70,86,60,0)'); g.fillStyle = gr; g.fillRect(Math.max(x, mx - mr), Math.max(y, my - mr), Math.min(2 * mr, x + 64 - Math.max(x, mx - mr)), Math.min(2 * mr, y + 64 - Math.max(y, my - mr))); }      // a mould patch under the string course
    g.fillStyle = 'rgba(60,54,44,0.12)'; g.fillRect(x, y, 2, 64); g.fillRect(x + 62, y, 2, 64); }
  g.restore();
  return [cv, ev];
}

/* a deep roof cornice for a CP wall (phase 2): three stacked projecting bands (0.25, 0.5 and 0.7 m out, 0.35, 0.3 and 0.3 m tall) just under the roof edge, in the building mesh (blank area 0.06); about 12 triangles a wall. From a to b, outward normal (nx, nz), the roof edge at y1. */
export function roofCornice(B, X, Z, ax, az, bx, bz, nx, nz, y1, wc) {
  const uv = 0.06, c = wc.clone().multiplyScalar(1.1), d = wc.clone().multiplyScalar(0.9); let tris = 0;
  const V = (x, y, z, ny, nxx, nzz, col2) => B.v(X(x), y, Z(z), nxx, ny, nzz, col2, uv, uv);
  for (const [off, h, y] of [[0.25, 0.35, y1 - 1.0], [0.5, 0.3, y1 - 0.65], [0.7, 0.3, y1 - 0.35]]) {
    const a0 = V(ax + nx * off, y, az + nz * off, 0, nx, nz, d), b0 = V(bx + nx * off, y, bz + nz * off, 0, nx, nz, d), b1 = V(bx + nx * off, y + h, bz + nz * off, 0, nx, nz, c), a1 = V(ax + nx * off, y + h, az + nz * off, 0, nx, nz, c); B.tri(a0, b0, b1, nx, 0, nz); B.tri(a0, b1, a1, nx, 0, nz);
    const t0 = V(ax, y + h, az, 1, 0, 0, c), t1 = V(bx, y + h, bz, 1, 0, 0, c); B.tri(a1, b1, t1, 0, 1, 0); B.tri(a1, t1, t0, 0, 1, 0); tris += 4; }
  return tris;
}

/* light spilling down a column (phase 3): a vertical additive wash in front of each arcade column, bright under the soffit light and fading toward the foot; (cx, cz) the column, (nx, nz) outward normal, (tx, tz) along the wall, y0 the ground. 2 triangles. */
export function columnWash(m, X, Z, cx, cz, nx, nz, tx, tz, y0) {
  const px = cx + nx * 0.46, pz = cz + nz * 0.46, w = 0.8, yb = y0 + 2.0, yt = y0 + 5.5, P = [[-1, yb, 0.5], [1, yb, 0.5], [1, yt, 1], [-1, yt, 1]].map(([a, y, v], i) => m.v(X(px + tx * a * w), y, Z(pz + tz * a * w), nx, 0, nz, WARM, i === 0 || i === 3 ? 0 : 1, v));
  m.tri(P[0], P[1], P[2], nx, 0, nz); m.tri(P[0], P[2], P[3], nx, 0, nz); return 2;
}
/* the same on the wall behind the arcade: one wash a bay, from the soffit (height yTop) down 3.2 m, on the wall plane pushed 6 cm out. */
export function wallWash(m, X, Z, ax, az, tx, tz, nx, nz, l, bays, yTop) {
  let q = 0; for (let k = 0; k < bays; k++) { const u = (k + 0.5) * l / bays, cx = ax + tx * u + nx * 0.06, cz = az + tz * u + nz * 0.06, w = l / bays * 0.6, P = [[-1, yTop - 3.2, 0.5], [1, yTop - 3.2, 0.5], [1, yTop - 0.05, 1], [-1, yTop - 0.05, 1]].map(([a, y, v], i) => m.v(X(cx + tx * a * w), y, Z(cz + tz * a * w), nx, 0, nz, WARM, i === 0 || i === 3 ? 0 : 1, v)); m.tri(P[0], P[1], P[2], nx, 0, nz); m.tri(P[0], P[2], P[3], nx, 0, nz); q += 2; }
  return q;
}

/* which brand the board number k of a wall with key `key` shows (shared by the band and its reflection, so they always agree) */
export function brandIndex(key, k) { return Math.floor(((key * 7 + k * 5 + Math.floor(key / 3)) % 1000 + 1000) % BRAND_COUNT); }

/* Wet reflections on the paving at night (phase 4 of docs/DELHI_MAIN_PLAN.md): in front of every board, a soft streak of the board's own colour on the plaza, brightest at the arcade and fading outward, as the glowing board would shine on wet stone. Additive, night only (the `cplight` mesh). From a to b along the arcade front, outward normal (nx, nz), at ground height y, `reach` metres out, a streak a board wide (same bays as brandBand). 2 triangles a board. */
export function boardReflections(m, X, Z, ax, az, bx, bz, nx, nz, y, bay, key, reach = 8) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 3) return 0; const n = Math.max(1, Math.round(L / bay)), tx = dx / L, tz = dz / L, w = L / n - 0.25, IDX = assignBoards(ax, az, bx, bz, n, key); let q = 0;
  for (let k = 0; k < n; k++) { const bg = boardColour(IDX[k]), col = new THREE.Color(bg).multiplyScalar(1.7), u = (k + 0.5) * L / n, cx = ax + tx * u, cz = az + tz * u;
    const P = [[-1, 0, 0.5], [1, 0, 0.5], [1, 1, 1], [-1, 1, 1]].map(([a, d, v], i) => { const off = d ? 0.4 : 0.4 + reach; return m.v(X(cx + tx * a * w / 2 + nx * off), y, Z(cz + tz * a * w / 2 + nz * off), 0, 1, 0, col, i === 0 || i === 3 ? 0 : 1, v); });      // d 1 = the edge at the arcade (bright), d 0 = the far edge (faded)
    m.tri(P[0], P[1], P[2], 0, 1, 0); m.tri(P[0], P[2], P[3], 0, 1, 0); q += 2; }
  return q;
}

/* A Delhi palm picture for the tree-card system (phase 5 of docs/DELHI_MAIN_PLAN.md): 512 x 1024, transparent, drawn in code (no outside image, no licence): a slim tapered trunk with ring marks, a crown of 17 arching fronds with leaflets, a few dead fronds hanging under the crown. Proportions as the other Delhi pictures expect (tilemesh and streetlife place a card by the crown width and the tree height): the crown spans 86 percent of the width, the tree 86 percent of the height, the foot 2 percent above the bottom. Seeded, so it is the same every time. */
export function makePalmCanvas() {
  const W = 512, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  let seed = 90210; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const cx = 258, cy = 300, foot = 1004;                                                                           // crown centre and trunk foot
  const trunk = t => ({ x: 256 + (cx - 256) * t * t + 6 * Math.sin(t * 3.1), y: foot + (cy - foot) * t, w: 24 - 11 * t });
  g.lineCap = 'round'; for (let i = 0; i < 60; i++) { const a = trunk(i / 60), b = trunk((i + 1) / 60); const lg = g.createLinearGradient(a.x - a.w / 2, 0, a.x + a.w / 2, 0); lg.addColorStop(0, '#5a4128'); lg.addColorStop(0.5, '#8a6a47'); lg.addColorStop(1, '#4d3822'); g.strokeStyle = lg; g.lineWidth = a.w + 1; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y + 1); g.stroke(); }
  g.strokeStyle = 'rgba(40,28,16,0.55)'; g.lineWidth = 2; for (let y = foot - 8; y > cy + 10; y -= 15) { const t = (foot - y) / (foot - cy), a = trunk(t); g.beginPath(); g.moveTo(a.x - a.w / 2, y); g.quadraticCurveTo(a.x, y + 4, a.x + a.w / 2, y); g.stroke(); }          // the ring marks
  const GREENS = ['#2f6a2c', '#3f7d34', '#4f9040', '#2a5c2a', '#5aa047'];
  const frond = (ang, L, droop, dead) => {
    const dx = Math.cos(ang), dy = Math.sin(ang), pt = t => ({ x: cx + dx * L * t, y: cy + dy * L * t + droop * L * t * t });
    g.strokeStyle = dead ? '#7a5a34' : '#3a6a2c'; g.lineWidth = dead ? 3 : 4; g.beginPath(); g.moveTo(cx, cy); for (let i = 1; i <= 20; i++) { const p = pt(i / 20); g.lineTo(p.x, p.y); } g.stroke();
    for (let t = 0.1; t < 1; t += dead ? 0.07 : 0.032) { const a = pt(t), b = pt(Math.min(1, t + 0.02)), tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl, len = (dead ? 14 : 30) * (1 - 0.6 * t) * (0.8 + 0.4 * rnd());
      for (const side of [-1, 1]) { const ca = Math.cos(0.95 * side), sa = Math.sin(0.95 * side), lx = ux * ca - uy * sa, ly = ux * sa + uy * ca + 0.45; const n = Math.hypot(lx, ly); g.strokeStyle = dead ? '#8a6a3c' : GREENS[Math.floor(rnd() * GREENS.length)]; g.lineWidth = dead ? 2 : 3.2; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(a.x + lx / n * len, a.y + ly / n * len); g.stroke(); } } };
  for (let i = 0; i < 3; i++) frond(Math.PI / 2 + (i - 1) * 0.5 + (rnd() - 0.5) * 0.2, 90 + 30 * rnd(), 0.2, true);                         // dead fronds hanging
  for (let i = 0; i < 17; i++) { const a = -Math.PI + 0.12 + (Math.PI - 0.24) * (i / 16) + (rnd() - 0.5) * 0.12, up = Math.abs(Math.sin(a)); frond(a, 190 + 40 * (1 - up) + 24 * rnd(), 0.35 + 0.5 * (1 - up), false); }          // the live crown: tips spread to 86 percent of the width
  g.fillStyle = '#6a4c2a'; g.beginPath(); g.ellipse(cx, cy + 4, 15, 20, 0, 0, 7); g.fill(); g.fillStyle = '#4d6a2a'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(cx + (rnd() - 0.5) * 20, cy - 8 - rnd() * 12, 6, 14, (rnd() - 0.5) * 0.8, 0, 7); g.fill(); }          // the crown shaft and the spear leaves
  return c;
}

/* a leaf texture for the clipped hedges (GTA gap list item 2): 128 x 128, tileable, dark and light green specks and small leaf shapes on a mid green; the vertex colour tints it per hedge piece. Own work, drawn in code. */
export function makeLeafCanvas() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); let seed = 4242; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  g.fillStyle = '#4d7f35'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 520; i++) { const x = rnd() * S, y = rnd() * S, r = 2 + rnd() * 4, t = rnd(), col = t < 0.3 ? '#2f5a26' : t < 0.7 ? '#5f9a40' : '#7bb653', a = rnd() * 3.14;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.fillStyle = col; g.beginPath(); g.ellipse(x + dx, y + dy, r, r * 0.55, a, 0, 7); g.fill(); } }
  return c;
}

/* L3 (docs/CP_LANDMARKS.md, owner's photos P4 and P5): the cinema front of a CP block. OSM puts "PVR Plaza Cinema" at x 1044, z -2356; the game calls it PVX Plaza. The facade piece is built on the wall edge nearest to that point. */
export const CINEMA = { x: 1044, z: -2356 };
/* the cinemas of CP (OSM points; game names: PVX Plaza, Odeyon, Rivolo; the Regal is not in the map data): each gets this front on the wall edge nearest to its point, with its own letters and canopy board */
export const CINEMAS = [{ x: 1044, z: -2356, letters: 'letters', canopy: 'canopy' }, { x: 1180, z: -2270, letters: 'letters_odeon', canopy: 'canopy_odeon' }, { x: 716, z: -1901, letters: 'letters_rivolo', canopy: 'canopy_rivolo' }];
export function cinemaEdge(ax, az, bx, bz, l) {
  if (l < 14) return null; const dx = bx - ax, dz = bz - az, tx = dx / l, tz = dz / l;
  for (const c of CINEMAS) { const u = (c.x - ax) * tx + (c.z - az) * tz, d = Math.abs(-(c.x - ax) * tz + (c.z - az) * tx); if (u > 4 && u < l - 4 && d < 14) return { u, letters: c.letters, canopy: c.canopy }; }
  return null;
}
/* the front: a dark band with the gold letters across the top, three lit poster frames, a yellow canopy over the street front with its board, a lit strip, and a few air conditioner boxes on the roof. B: the building mesh (flat colours), m: the emissive board mesh (cpbrand). Spans about 26 m of the edge, centred on the cinema's point, clipped to the edge. */
export function cinemaFront(B, m, X, Z, ax, az, bx, bz, nx, nz, l, y0, y1, wc, cin) {
  const dx = bx - ax, dz = bz - az, tx = dx / l, tz = dz / l, W = Math.min(l - 2, 26), u0 = Math.max(1, Math.min(l - 1 - W, cin.u - W / 2)), u1 = u0 + W, sgn = (tx * nz - tz * nx) < 0, WH = new THREE.Color(0xffffff);
  const P = (u, d, y) => [ax + tx * u + nx * d, y, az + tz * u + nz * d];
  const quadSP = (id, a, b, c, dd, ny) => { const uv0 = specialUV(id), uv = sgn ? [uv0[2], uv0[1], uv0[0], uv0[3]] : uv0, v0 = m.v(X(a[0]), a[1], Z(a[2]), nx, ny, nz, WH, uv[0], uv[1]), v1 = m.v(X(b[0]), b[1], Z(b[2]), nx, ny, nz, WH, uv[2], uv[1]), v2 = m.v(X(c[0]), c[1], Z(c[2]), nx, ny, nz, WH, uv[2], uv[3]), v3 = m.v(X(dd[0]), dd[1], Z(dd[2]), nx, ny, nz, WH, uv[0], uv[3]); m.tri(v0, v1, v2, nx, ny, nz); m.tri(v0, v2, v3, nx, ny, nz); };
  const solid = (a, b, c, dd, col, n0, n1, n2) => { const v0 = B.v(X(a[0]), a[1], Z(a[2]), n0, n1, n2, col, 0.06, 0.06), v1 = B.v(X(b[0]), b[1], Z(b[2]), n0, n1, n2, col, 0.06, 0.06), v2 = B.v(X(c[0]), c[1], Z(c[2]), n0, n1, n2, col, 0.06, 0.06), v3 = B.v(X(dd[0]), dd[1], Z(dd[2]), n0, n1, n2, col, 0.06, 0.06); B.tri(v0, v1, v2, n0, n1, n2); B.tri(v0, v2, v3, n0, n1, n2); };
  const top = y1 - 0.6, yBand = top - 2.2;
  /* a blank wall panel over the windows (photos P4 and P5 show an unbroken white wall above the street front), 4 cm off the facade */
  solid(P(u0, 0.04, y0 + 4.3), P(u1, 0.04, y0 + 4.3), P(u1, 0.04, top), P(u0, 0.04, top), wc.clone().multiplyScalar(1.03), nx, 0, nz);
  /* the dark band with the letters, 1.8 m proud of nothing: 7 cm off the wall, 2.2 m tall, as wide as the front; the letters run across it */
  quadSP(cin.letters || 'letters', P(u0, 0.08, yBand), P(u1, 0.08, yBand), P(u1, 0.08, top), P(u0, 0.08, top), 0);
  /* three poster frames of 3.6 x 4.7 m at 4 m storey height above the canopy: a dark frame behind each, the poster in front */
  const pw = 3.6, ph = 4.7, gap = (W - 3 * pw) / 4, yp = Math.max(y0 + 6.2, yBand - ph - 1.0), dark = new THREE.Color(0x1c1a18);
  for (let k = 0; k < 3; k++) { const a = u0 + gap + k * (pw + gap), b = a + pw; solid(P(a - 0.2, 0.05, yp - 0.2), P(b + 0.2, 0.05, yp - 0.2), P(b + 0.2, 0.05, yp + ph + 0.2), P(a - 0.2, 0.05, yp + ph + 0.2), dark, nx, 0, nz);
    quadSP('poster' + k, P(a, 0.09, yp), P(b, 0.09, yp), P(b, 0.09, yp + ph), P(a, 0.09, yp + ph), 0); }
  /* the yellow canopy: a slab 2.3 m out at 3.6 m, 0.55 m thick; its front carries the board; a lit strip under the posters */
  const yc = y0 + 3.6, yel = new THREE.Color(0xe8b520), D = 2.3;
  solid(P(u0, 0, yc), P(u1, 0, yc), P(u1, D, yc), P(u0, D, yc), yel.clone().multiplyScalar(0.7), 0, -1, 0); solid(P(u0, 0, yc + 0.55), P(u0, D, yc + 0.55), P(u1, D, yc + 0.55), P(u1, 0, yc + 0.55), yel, 0, 1, 0);
  quadSP(cin.canopy || 'canopy', P(u0, D + 0.02, yc), P(u1, D + 0.02, yc), P(u1, D + 0.02, yc + 0.55), P(u0, D + 0.02, yc + 0.55), 0);
  quadSP('yellow', P(u0, 0.1, yp - 0.9), P(u1, 0.1, yp - 0.9), P(u1, 0.1, yp - 0.7), P(u0, 0.1, yp - 0.7), 0);
  /* air conditioner boxes on the roof */
  const roof = new THREE.Color(0x8d9096); for (let k = 0; k < 4; k++) { const cu = u0 + 3 + k * (W - 6) / 3, hx = 0.9, hz = 0.7, y = y1; const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => P(cu + a * hx, -1.6 + b * hz, y)), qt = q.map(p => [p[0], y + 1.1, p[2]]);
    for (let e = 0; e < 4; e++) { const a = q[e], b = q[(e + 1) % 4], at = qt[e], bt = qt[(e + 1) % 4], nx2 = (b[2] - a[2]), nz2 = -(b[0] - a[0]), nl = Math.hypot(nx2, nz2) || 1; solid(a, b, bt, at, roof, nx2 / nl, 0, nz2 / nl); } solid(qt[0], qt[1], qt[2], qt[3], roof.clone().multiplyScalar(1.1), 0, 1, 0); }
}

/* L4 (docs/CP_LANDMARKS.md, owner's photos P2 and P3): the pavilion of a long CP front. A central block 14 m wide that stands 0.9 m proud of the wall, with paired pilasters at both ends, a round-headed gate in the ground floor, a large arched window with a fan light and a balustrade band on the first floor, an attic over the roof line with its own small arched window and a triangular pediment; a railing along the whole roof edge (P2) and three small roof-garden trees (P3). All flat colours on the building mesh B. (ax, az)-(bx, bz) the wall edge, (nx, nz) outward, l its length, y0 the ground, y1 the roof line, wc the wall colour. */
export function pavilion(B, X, Z, ax, az, bx, bz, nx, nz, l, y0, y1, wc, key) {
  const tx = (bx - ax) / l, tz = (bz - az) / l, uc = l / 2, hw = 7, P = (u, d, y) => [ax + tx * u + nx * d, y, az + tz * u + nz * d];
  const solid = (a, b, c, dd, col, n0, n1, n2) => { const v0 = B.v(X(a[0]), a[1], Z(a[2]), n0, n1, n2, col, 0.06, 0.06), v1 = B.v(X(b[0]), b[1], Z(b[2]), n0, n1, n2, col, 0.06, 0.06), v2 = B.v(X(c[0]), c[1], Z(c[2]), n0, n1, n2, col, 0.06, 0.06), v3 = B.v(X(dd[0]), dd[1], Z(dd[2]), n0, n1, n2, col, 0.06, 0.06); B.tri(v0, v1, v2, n0, n1, n2); B.tri(v0, v2, v3, n0, n1, n2); };
  const front = (u0, u1, d, ya, yb, col) => solid(P(u0, d, ya), P(u1, d, ya), P(u1, d, yb), P(u0, d, yb), col, nx, 0, nz);
  const side = (u, d0, d1, ya, yb, col, sg) => solid(P(u, d0, ya), P(u, d1, ya), P(u, d1, yb), P(u, d0, yb), col, tx * sg, 0, tz * sg);
  const arch = (uc2, d, yb, w, h, col) => {      /* a round-headed opening: a rectangle up to h - w/2, then a half circle of radius w/2 (8 steps) */
    const r = w / 2, yr = yb + h - r; front(uc2 - r, uc2 + r, d, yb, yr, col); const c = P(uc2, d, yr);
    for (let k = 0; k < 8; k++) { const a0 = Math.PI * k / 8, a1 = Math.PI * (k + 1) / 8, p0 = P(uc2 + Math.cos(a0) * r, d, yr + Math.sin(a0) * r), p1 = P(uc2 + Math.cos(a1) * r, d, yr + Math.sin(a1) * r), v0 = B.v(X(c[0]), c[1], Z(c[2]), nx, 0, nz, col, 0.06, 0.06), v1 = B.v(X(p0[0]), p0[1], Z(p0[2]), nx, 0, nz, col, 0.06, 0.06), v2 = B.v(X(p1[0]), p1[1], Z(p1[2]), nx, 0, nz, col, 0.06, 0.06); B.tri(v0, v1, v2, nx, 0, nz); } };
  const white = wc.clone().multiplyScalar(1.12), pale = wc.clone().multiplyScalar(1.04), dark = new THREE.Color(0x141c2c), gate = new THREE.Color(0x120f0c), ys = y0 + 6.1, D = 0.9;
  /* the projecting block and its sides */
  front(uc - hw, uc + hw, D, ys, y1, pale); side(uc - hw, 0, D, ys, y1, pale, -1); side(uc + hw, 0, D, ys, y1, pale, 1);
  /* paired pilasters at both ends, on the front, 0.5 m wide, a little proud */
  { const col = (u, d, ya, yb, r) => { const N = 8, c = P(u, d, 0); for (let k = 0; k < N; k++) { const t0 = k * Math.PI * 2 / N, t1 = (k + 1) * Math.PI * 2 / N, tm = (t0 + t1) / 2, wx = Math.cos(tm), wz = Math.sin(tm), p = (t, y) => [c[0] + Math.cos(t) * r, y, c[2] + Math.sin(t) * r]; solid(p(t0, ya), p(t1, ya), p(t1, yb), p(t0, yb), white, wx, 0, wz); } };      /* F1: round shafts, not flat pilasters (docs/CP_FIX_PLAN.md) */
    for (const sg of [-1, 1]) for (const o of [0.75, 1.6]) col(uc + sg * (hw - o), D + 0.3, ys, y1 + 0.2, 0.3); }
  /* the round-headed gate in the ground floor (on the arcade's back wall) with a white surround */
  arch(uc, 0.05, y0, 4.2, 4.9, white); arch(uc, 0.09, y0, 3.6, 4.5, gate);
  /* the large arched window with the fan light on the first floor, white surround, dark glass, five spokes, a balustrade band under it */
  const yw = ys + 1.5; arch(uc, D + 0.04, yw, 4.1, 4.9, white); arch(uc, D + 0.08, yw + 0.25, 3.5, 4.4, dark);
  const cy = yw + 0.25 + 4.4 - 1.75; for (let k = 1; k <= 5; k++) { const a = Math.PI * k / 6, p0 = [uc, cy], p1 = [uc + Math.cos(a) * 1.75, cy + Math.sin(a) * 1.75]; const w2 = 0.05, dx = p1[0] - p0[0], dy = p1[1] - p0[1], dl = Math.hypot(dx, dy), ox = -dy / dl * w2, oy = dx / dl * w2; solid(P(p0[0] - ox, D + 0.12, p0[1] - oy), P(p1[0] - ox, D + 0.12, p1[1] - oy), P(p1[0] + ox, D + 0.12, p1[1] + oy), P(p0[0] + ox, D + 0.12, p0[1] + oy), white, nx, 0, nz); }
  front(uc - 2.4, uc + 2.4, D + 0.1, ys + 0.3, ys + 1.3, white); for (let k = 0; k < 9; k++) { const u = uc - 2.2 + k * 0.55; front(u - 0.08, u + 0.08, D + 0.12, ys + 0.3, ys + 1.2, dark); }
  /* the attic: 2.6 m over the roof line with a small arched window, a cornice slab and a triangular pediment */
  const ya = y1; front(uc - hw + 1, uc + hw - 1, D, ya, ya + 2.6, pale); side(uc - hw + 1, 0, D, ya, ya + 2.6, pale, -1); side(uc + hw - 1, 0, D, ya, ya + 2.6, pale, 1);
  arch(uc, D + 0.04, ya + 0.3, 2.2, 2.1, white); arch(uc, D + 0.07, ya + 0.45, 1.8, 1.8, dark);
  const cu0 = uc - hw + 0.6, cu1 = uc + hw - 0.6; front(cu0, cu1, D + 0.45, ya + 2.6, ya + 2.95, white); solid(P(cu0, 0, ya + 2.95), P(cu1, 0, ya + 2.95), P(cu1, D + 0.45, ya + 2.95), P(cu0, D + 0.45, ya + 2.95), white, 0, 1, 0);
  { const a0 = P(cu0, D + 0.3, ya + 2.95), a1 = P(cu1, D + 0.3, ya + 2.95), ap = P(uc, D + 0.3, ya + 4.7), v0 = B.v(X(a0[0]), a0[1], Z(a0[2]), nx, 0, nz, pale, 0.06, 0.06), v1 = B.v(X(a1[0]), a1[1], Z(a1[2]), nx, 0, nz, pale, 0.06, 0.06), v2 = B.v(X(ap[0]), ap[1], Z(ap[2]), nx, 0, nz, pale, 0.06, 0.06); B.tri(v0, v1, v2, nx, 0, nz); }
  /* the roof railing along the whole edge, outside the pavilion: a top rail and posts every 2.4 m */
  const rail = new THREE.Color(0x5b5e63); front(0.4, uc - hw - 0.2, 0.15, y1 + 0.95, y1 + 1.03, rail); front(uc + hw + 0.2, l - 0.4, 0.15, y1 + 0.95, y1 + 1.03, rail);
  for (let u = 0.4; u < l - 0.3; u += 2.4) { if (u > uc - hw - 0.3 && u < uc + hw + 0.3) continue; front(u - 0.05, u + 0.05, 0.15, y1, y1 + 1.0, rail); }
  /* three small roof-garden trees behind the railing: a trunk and a green octahedron each */
  const trunk = new THREE.Color(0x5a4630), leaf = new THREE.Color(0x3f7a38);
  for (let k = 0; k < 3; k++) { const u = uc + (k - 1) * 9.5 + ((key * 7 + k * 3) % 5 - 2) * 0.4, c = P(u, -1.8, y1 + 1.6), r = 1.1 + ((key + k) % 3) * 0.25, E = [P(u + r, -1.8, y1 + 1.6), P(u, -1.8 + r, y1 + 1.6), P(u - r, -1.8, y1 + 1.6), P(u, -1.8 - r, y1 + 1.6)], T = P(u, -1.8, y1 + 1.6 + r), Bo = P(u, -1.8, y1 + 1.6 - r);
    front(u - 0.08, u + 0.08, -1.8, y1, y1 + 1.6, trunk); for (let e = 0; e < 4; e++) { const a = E[e], b = E[(e + 1) % 4]; for (const apex of [T, Bo]) { const nn = [(a[0] + b[0]) / 2 - c[0], (apex[1] - c[1]), (a[2] + b[2]) / 2 - c[2]], nl = Math.hypot(...nn) || 1, v0 = B.v(X(a[0]), a[1], Z(a[2]), nn[0] / nl, nn[1] / nl, nn[2] / nl, leaf, 0.06, 0.06), v1 = B.v(X(b[0]), b[1], Z(b[2]), nn[0] / nl, nn[1] / nl, nn[2] / nl, leaf, 0.06, 0.06), v2 = B.v(X(apex[0]), apex[1], Z(apex[2]), nn[0] / nl, nn[1] / nl, nn[2] / nl, leaf, 0.06, 0.06); B.tri(v0, v1, v2, nn[0] / nl, nn[1] / nl, nn[2] / nl); B.tri(v0, v2, v1, -nn[0] / nl, -nn[1] / nl, -nn[2] / nl); } } }
}

/* R7 of docs/CP_REFERENCES.md (owner's photo, 21 Nov 2026; session note of 22 Nov): the corner of a CP block is topped by a SQUARE pavilion, not a dome: about 6 m a side, rising 5 m above the roof line, two paired slender round columns on each street face (0.45 m across, 4 m tall) in front of a recessed cream wall, a flat entablature slab and a thin top cornice, and a balustrade along both roof fronts. (vx, vz) the corner vertex, (d1x, d1z) and (d2x, d2z) unit vectors from it along the two walls, y1 the roof line, wc the wall colour. Flat colours on the building mesh B. */
export function cornerPavilion(B, X, Z, vx, vz, d1x, d1z, d2x, d2z, y1, wc) {
  let bx = d1x + d2x, bz = d1z + d2z; const bl = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl;      /* the bisector, pointing into the building */
  const half = 3.3, cx = vx + bx * 4.4, cz = vz + bz * 4.4, a1 = [d1x, d1z], a2 = [-d1z, d1x]; if (a2[0] * bx + a2[1] * bz < 0) { a2[0] = -a2[0]; a2[1] = -a2[1]; }
  const white = wc.clone().multiplyScalar(1.12), pale = wc.clone().multiplyScalar(1.03), rail = wc.clone().multiplyScalar(1.08), shade = wc.clone().multiplyScalar(0.8);
  const V = (x, y, z, nx, ny, nz, c) => B.v(X(x), y, Z(z), nx, ny, nz, c, 0.06, 0.06), Q = (p, q, r, t, nx, ny, nz, c) => { const v0 = V(p[0], p[1], p[2], nx, ny, nz, c), v1 = V(q[0], q[1], q[2], nx, ny, nz, c), v2 = V(r[0], r[1], r[2], nx, ny, nz, c), v3 = V(t[0], t[1], t[2], nx, ny, nz, c); B.tri(v0, v1, v2, nx, ny, nz); B.tri(v0, v2, v3, nx, ny, nz); };
  const P = (u, w, y, h = half) => [cx + a1[0] * u * h + a2[0] * w * h, y, cz + a1[1] * u * h + a2[1] * w * h];
  const slab = (h, ya, yb, c) => { const k = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; for (let e = 0; e < 4; e++) { const [u0, w0] = k[e], [u1, w1] = k[(e + 1) % 4], nx = (u0 + u1) / 2 * a1[0] + (w0 + w1) / 2 * a2[0], nz = (u0 + u1) / 2 * a1[1] + (w0 + w1) / 2 * a2[1]; Q(P(u0, w0, ya, h), P(u1, w1, ya, h), P(u1, w1, yb, h), P(u0, w0, yb, h), nx, 0, nz, c); } Q(P(-1, -1, yb, h), P(1, -1, yb, h), P(1, 1, yb, h), P(-1, 1, yb, h), 0, 1, 0, c); };
  slab(1 + 0.3 / half, y1, y1 + 0.5, white);                       /* the base slab */
  slab(1 - 0.5 / half, y1 + 0.5, y1 + 4.4, pale);                  /* the recessed wall */
  slab(1 + 0.35 / half, y1 + 4.4, y1 + 4.9, white); slab(1 + 0.6 / half, y1 + 4.9, y1 + 5.12, white);      /* the entablature and the thin top cornice */
  const col = (x, z, ya, yb, r) => { const N = 8; for (let k = 0; k < N; k++) { const t0 = k * Math.PI * 2 / N, t1 = (k + 1) * Math.PI * 2 / N, nm = (t0 + t1) / 2, nx = Math.cos(nm), nz = Math.sin(nm); Q([x + Math.cos(t0) * r, ya, z + Math.sin(t0) * r], [x + Math.cos(t1) * r, ya, z + Math.sin(t1) * r], [x + Math.cos(t1) * r, yb, z + Math.sin(t1) * r], [x + Math.cos(t0) * r, yb, z + Math.sin(t0) * r], nx, 0, nz, white); } };
  /* paired columns on the two faces that look out of the building (normal against the bisector): at 0.25 and 0.7 of each side, on the plinth */
  for (const [nxv, nzv, tu] of [[a2[0], a2[1], 1], [-a2[0], -a2[1], 1], [a1[0], a1[1], 0], [-a1[0], -a1[1], 0]]) { if (nxv * bx + nzv * bz > -0.2) continue;
    for (const f of [-0.78, -0.5, 0.5, 0.78]) { const u = tu ? f : (nxv * a1[0] + nzv * a1[1]) > 0 ? 1 : -1, w = tu ? (nxv * a2[0] + nzv * a2[1]) > 0 ? 1 : -1 : f, c = P(u, w, 0), dx = nxv * 0.45, dz = nzv * 0.45; col(c[0] + dx * 0, c[2] + dz * 0, y1 + 0.5, y1 + 4.4, 0.27); } }
  /* a balustrade along both roof fronts for 9 m from the corner: a top rail and posts every 0.7 m */
  for (const [dx, dz] of [[d1x, d1z], [d2x, d2z]]) { const nx = -dz * (dx * bz - dz * bx > 0 ? -1 : 1), nz = dx * (dx * bz - dz * bx > 0 ? -1 : 1); void nx; void nz;
    for (let u = 0.6; u < 9; u += 0.7) { const x = vx + dx * u, z = vz + dz * u, w = 0.06, tx = dx * w, tz = dz * w, ox = -dz * w, oz = dx * w; Q([x - tx - ox, y1, z - tz - oz], [x + tx - ox, y1, z + tz - oz], [x + tx - ox, y1 + 0.95, z + tz - oz], [x - tx - ox, y1 + 0.95, z - tz - oz], -dz, 0, dx, rail); Q([x + tx + ox, y1, z + tz + oz], [x - tx + ox, y1, z - tz + oz], [x - tx + ox, y1 + 0.95, z - tz + oz], [x + tx + ox, y1 + 0.95, z + tz + oz], dz, 0, -dx, rail); }
    const e = [vx + dx * 0.6, vz + dz * 0.6], f = [vx + dx * 9, vz + dz * 9], ox = -dz * 0.1, oz = dx * 0.1; Q([e[0] - ox, y1 + 0.95, e[1] - oz], [f[0] - ox, y1 + 0.95, f[1] - oz], [f[0] + ox, y1 + 0.95, f[1] + oz], [e[0] + ox, y1 + 0.95, e[1] + oz], 0, 1, 0, rail); }
  void shade;
}
/* R8: a warm white wash on the first-floor wall above the arcade slab at night, brightest at the slab and fading upward (additive, the cplight mesh). From a to b along the wall, outward normal (nx, nz), from y to y + 4 m, one panel a bay. */
export function upperWash(m, X, Z, ax, az, bx, bz, nx, nz, y, bay) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 4) return 0; const n = Math.max(1, Math.round(L / bay)), tx = dx / L, tz = dz / L; let q = 0;
  for (let k = 0; k < n; k++) { const u = (k + 0.5) * L / n, cx = ax + tx * u + nx * 0.4, cz = az + tz * u + nz * 0.4, w = L / n * 0.5, P = [[-1, y, 1], [1, y, 1], [1, y + 4.2, 0.5], [-1, y + 4.2, 0.5]].map(([a, yy, v], i) => m.v(X(cx + tx * a * w), yy, Z(cz + tz * a * w), nx, 0, nz, WARM, i === 0 || i === 3 ? 0 : 1, v)); m.tri(P[0], P[1], P[2], nx, 0, nz); m.tri(P[0], P[2], P[3], nx, 0, nz); q += 2; }
  return q;
}

/* Roofs for the Delhi city (Phase P3 of docs/DELHI_POLISH_PLAN.md, "roofs and parapets"): what stands on and around a flat Delhi roof, drawn into one extra mesher (`roof`) that the city world shows only near the player
   (cells of 250 m, hidden beyond about 350 m), so the far city does not pay for it.
     - a parapet along the roof edge (outer face and top cap): a plain flat roof was a bare slab; real roofs have a wall around the terrace, high in the old city, a pale cornice-like lip at Connaught Place;
     - black and blue-grey water tanks (cylinders), usually two or three on a residential roof; none on the Lutyens bungalows or the glass offices, which get a plant room box instead;
     - air-conditioner outdoor units on commercial roofs; TV antennas and a dish on residential ones; a stair head.
   Counts and sizes follow the area style (identity.json area name: oldDelhi, market, village, default, dda, cp, lutyens, business). Deterministic from the building id; bounded per tile.
   Pure geometry through the Mesher API (m.v, m.tri), no three.js: `tools/selftest.mjs` runs it. Colours are plain { r, g, b } in linear light. */
const lin = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4, C = hex => ({ r: lin((hex >> 16 & 255) / 255), g: lin((hex >> 8 & 255) / 255), b: lin((hex & 255) / 255) }), mul = (c, k) => ({ r: c.r * k, g: c.g * k, b: c.b * k }), mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
const hash = n => { let h = (n | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const TANK = [C(0x17191b), C(0x1d2024), C(0x24323f), C(0x2e3a3f)], AC = C(0xc9ccd0), PLANT = C(0x8d9094), METAL = C(0x6d7378), STAIR = C(0xb8b0a2);
/* by area style: parapet height (m), water tanks (min, max), AC units (min, max), antennas 0..1 chance, stair head chance */
export const ROOF = {
  oldDelhi: { par: 1.1, tanks: [1, 3], ac: [0, 2], ant: 0.7, stair: 0.45 },
  market: { par: 1.0, tanks: [1, 2], ac: [1, 4], ant: 0.5, stair: 0.4 },
  village: { par: 0.9, tanks: [1, 3], ac: [0, 1], ant: 0.8, stair: 0.35 },
  default: { par: 0.9, tanks: [1, 2], ac: [0, 2], ant: 0.5, stair: 0.4 },
  dda: { par: 1.0, tanks: [2, 4], ac: [0, 1], ant: 0.3, stair: 0.8 },
  cp: { par: 1.1, tanks: [0, 1], ac: [1, 3], ant: 0.1, stair: 0.3 },
  lutyens: { par: 0.4, tanks: [0, 0], ac: [0, 1], ant: 0.1, stair: 0.1 },
  business: { par: 0.6, tanks: [0, 0], ac: [1, 3], ant: 0, stair: 0.6, plant: true },
};
export const CAPS = { items: 3000 };

function pip(r, x, z) { let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { const xi = r[i], zi = r[i + 1], xj = r[j], zj = r[j + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
/* an axis-aligned box standing on y0: 5 faces (no bottom), 10 triangles */
function box(m, X, Z, cx, y0, cz, sx, sy, sz, c, cTop) {
  const x0 = X(cx - sx / 2), x1 = X(cx + sx / 2), z0 = Z(cz - sz / 2), z1 = Z(cz + sz / 2), y1 = y0 + sy, f = (a, b, c2, d, nx, ny, nz, col) => { const v0 = m.v(a[0], a[1], a[2], nx, ny, nz, col), v1 = m.v(b[0], b[1], b[2], nx, ny, nz, col), v2 = m.v(c2[0], c2[1], c2[2], nx, ny, nz, col), v3 = m.v(d[0], d[1], d[2], nx, ny, nz, col); m.tri(v0, v1, v2, nx, ny, nz); m.tri(v0, v2, v3, nx, ny, nz); };
  f([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, c); f([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, c); f([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, c); f([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, c); f([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, cTop || c);
}
/* an 8-sided water tank (a Sintex cylinder): sides and a top */
function cylinder(m, X, Z, cx, y0, cz, r, h, c) {
  const N = 6, v = []; for (let k = 0; k < N; k++) { const a = k / N * 6.2832, px = X(cx + Math.cos(a) * r), pz = Z(cz + Math.sin(a) * r); v.push([px, pz, Math.cos(a), Math.sin(a)]); }
  for (let k = 0; k < N; k++) { const a = v[k], b = v[(k + 1) % N], nx = (a[2] + b[2]) / 2, nz = (a[3] + b[3]) / 2, q0 = m.v(a[0], y0, a[1], nx, 0, nz, c), q1 = m.v(b[0], y0, b[1], nx, 0, nz, c), q2 = m.v(b[0], y0 + h, b[1], nx, 0, nz, c), q3 = m.v(a[0], y0 + h, a[1], nx, 0, nz, c); m.tri(q0, q1, q2, nx, 0, nz); m.tri(q0, q2, q3, nx, 0, nz); }
  const top = mul(c, 1.35), c0 = m.v(X(cx), y0 + h + 0.12, Z(cz), 0, 1, 0, top), ring = v.map(p => m.v(p[0], y0 + h, p[1], 0, 1, 0, top)); for (let k = 0; k < N; k++) m.tri(c0, ring[k], ring[(k + 1) % N], 0, 1, 0);          // a slightly domed lid
}

/* m: the roof mesher; b: the building { id, ring (flat x, z), height }; o: { X, Z (world to tile-local), y1 (roof height, world), wall ({r,g,b}), area (style name), counts, hgt } */
export function roofDetail(m, b, o) {
  const r = b.ring.length > 2 && b.ring[0] === b.ring[b.ring.length - 2] && b.ring[1] === b.ring[b.ring.length - 1] ? b.ring.slice(0, -2) : b.ring, n = r.length / 2; if (n < 3 || n > 40) return 0;
  const S = ROOF[o.area] || ROOF.default, { X, Z, y1, wall, counts } = o; let tri0 = m.i.length / 3; if (counts.items >= CAPS.items) return 0;
  let a2 = 0, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a2 += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; x0 = Math.min(x0, r[i * 2]); x1 = Math.max(x1, r[i * 2]); z0 = Math.min(z0, r[i * 2 + 1]); z1 = Math.max(z1, r[i * 2 + 1]); }
  const ccw = a2 > 0, area = Math.abs(a2) / 2; if (area < 25) return 0;
  /* the parapet: an outer face and a cap (the roof material is double sided, so the inside shows too); half of the infill buildings get one */
  if (o.light && hash(b.id * 3 + 1) >= 0.5) return 0;
  const P = S.par * (0.85 + 0.3 * hash(b.id * 3)), T = 0.28, soft = mix(wall, { r: 0.62, g: 0.62, b: 0.6 }, 0.55), cOut = mul(soft, 0.92), cCap = mul(soft, 1.22);       // the wall colour is tinted onto a white facade texture, so on a bare roof mesh it looks too saturated: pull it toward a light grey
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ax = r[i * 2], az = r[i * 2 + 1], bx = r[j * 2], bz = r[j * 2 + 1], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz); if (l < 1.5) continue;
    let nx = dz / l, nz = -dx / l; if (!ccw) { nx = -nx; nz = -nz; }                              // outward
    const ix = -nx * T, iz = -nz * T, ya = y1, yb = y1 + P;
    const q = (p0, p1, p2, p3, nrm, col) => { const v0 = m.v(X(p0[0]), p0[1], Z(p0[2]), nrm[0], nrm[1], nrm[2], col), v1 = m.v(X(p1[0]), p1[1], Z(p1[2]), nrm[0], nrm[1], nrm[2], col), v2 = m.v(X(p2[0]), p2[1], Z(p2[2]), nrm[0], nrm[1], nrm[2], col), v3 = m.v(X(p3[0]), p3[1], Z(p3[2]), nrm[0], nrm[1], nrm[2], col); m.tri(v0, v1, v2, nrm[0], nrm[1], nrm[2]); m.tri(v0, v2, v3, nrm[0], nrm[1], nrm[2]); };
    q([ax, ya, az], [bx, ya, bz], [bx, yb, bz], [ax, yb, az], [nx, 0, nz], cOut);                              // outer face
    q([ax, yb, az], [bx, yb, bz], [bx + ix, yb, bz + iz], [ax + ix, yb, az + iz], [0, 1, 0], cCap);              // the cap
  }
  if (n > 12) return m.i.length / 3 - tri0;       // a curved or many-cornered footprint (an arcade, a crescent) gets the parapet only
  if (o.light) { counts.items++; counts.tris += m.i.length / 3 - tri0; return m.i.length / 3 - tri0; }       // infill buildings get the parapet only
  /* things on the roof: positions inside the polygon, 1.6 m from every wall (four probes), not overlapping one another */
  const placed = [], spot = (rad, k) => { for (let t = 0; t < 14; t++) { const x = x0 + (x1 - x0) * hash(b.id * 31 + k * 7 + t * 13), z = z0 + (z1 - z0) * hash(b.id * 17 + k * 11 + t * 19), g = rad + 1.6; if (!pip(r, x, z) || !pip(r, x + g, z) || !pip(r, x - g, z) || !pip(r, x, z + g) || !pip(r, x, z - g)) continue; if (placed.some(p => Math.hypot(p[0] - x, p[1] - z) < p[2] + rad + 0.3)) continue; placed.push([x, z, rad]); return [x, z]; } return null; };
  const rng = (lo, hi, k) => lo + Math.floor((hi - lo + 1) * hash(b.id * 41 + k * 5)), y = y1 + 0.02;
  const nTank = Math.min(rng(S.tanks[0], Math.min(S.tanks[1], 2), 1), Math.floor(area / 30)); for (let k = 0; k < nTank; k++) { const rad = 0.5 + 0.25 * hash(b.id * 3 + k), p = spot(rad, k); if (p) cylinder(m, X, Z, p[0], y, p[1], rad, 1.0 + 0.5 * hash(b.id * 5 + k), TANK[Math.floor(hash(b.id * 9 + k) * TANK.length)]); }
  if (S.plant && area > 80) { const p = spot(2.0, 20); if (p) box(m, X, Z, p[0], y, p[1], 4 + hash(b.id) * 3, 2.2, 3 + hash(b.id + 1) * 2, PLANT, mul(PLANT, 1.2)); }        // a plant room on an office roof
  if (hash(b.id * 13 + 7) < S.stair * 0.7 && area > 60) { const p = spot(1.4, 30); if (p) box(m, X, Z, p[0], y, p[1], 2.6, 2.5, 2.2, STAIR, mul(STAIR, 1.15)); }
  const nAC = hash(b.id * 29 + 5) < 0.45 ? Math.min(2, rng(Math.max(1, S.ac[0]), Math.max(1, S.ac[1]), 2)) : 0; for (let k = 0; k < nAC; k++) { const p = spot(0.6, 40 + k); if (p) box(m, X, Z, p[0], y, p[1], 0.9, 0.7, 0.8, AC, mul(AC, 1.1)); }
  if (hash(b.id * 23 + 3) < S.ant * 0.55) { const p = spot(0.6, 60); if (p) { box(m, X, Z, p[0], y, p[1], 0.07, 3.0, 0.07, METAL); box(m, X, Z, p[0], y + 2.5, p[1], 1.1, 0.05, 0.05, METAL); } }
  const added = m.i.length / 3 - tri0; counts.items++; counts.tris += added; return added;
}

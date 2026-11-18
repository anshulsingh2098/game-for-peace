/* Facade relief for the Delhi city (Phase P3 of docs/DELHI_POLISH_PLAN.md, "balconies, wall AC units, arcades"): what sticks out of a wall that faces a street, drawn into the same near-only mesher as the roofs
   (`roof`: cells of 250 m, hidden beyond about 350 m).
     - balconies on the upper floors (a slab and a railing), more in DDA flats and the old city, almost none in Lutyens' bungalows and Connaught Place's white blocks;
     - air-conditioner outdoor units on the wall under the windows (the Delhi look: boxes on brackets everywhere);
     - a cornice band under the roof edge on Connaught Place, Lutyens and government blocks;
     - Connaught Place's colonnade: columns along the ground floor with a soffit slab over the pavement, on street faces with room for it (never where the street is closer than 6.5 m to the wall);
       the columns have collision circles.
   Only walls of 5 m or more that face a street within 14 m. Counts are capped per building and per tile. Deterministic from the building id and the wall. Pure geometry through the Mesher API, no three.js:
   `tools/selftest.mjs` runs it. Colours are plain { r, g, b } in linear light. */
const lin = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4, C = hex => ({ r: lin((hex >> 16 & 255) / 255), g: lin((hex >> 8 & 255) / 255), b: lin((hex & 255) / 255) }), mul = (c, k) => ({ r: c.r * k, g: c.g * k, b: c.b * k }), mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
const hash = n => { let h = (n | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const RAIL = [C(0x3d4045), C(0x5a4a3e), C(0x2f4a3a), C(0x6b6f74)], AC = [C(0xd2d5d8), C(0xc4c7ca), C(0xe3e4e2)], STONE = C(0xd9d4c6);
/* by area style: balcony chance per bay, wall AC chance per bay, cornice, colonnade */
export const FACADE = {
  oldDelhi: { balc: 0.22, ac: 0.20, cornice: false, colonnade: false },
  market: { balc: 0.12, ac: 0.20, cornice: false, colonnade: false },
  village: { balc: 0.16, ac: 0.12, cornice: false, colonnade: false },
  default: { balc: 0.16, ac: 0.16, cornice: false, colonnade: false },
  dda: { balc: 0.32, ac: 0.14, cornice: false, colonnade: false },
  cp: { balc: 0.05, ac: 0.12, cornice: true, colonnade: true },
  lutyens: { balc: 0.04, ac: 0.08, cornice: true, colonnade: false },
  business: { balc: 0, ac: 0.05, cornice: true, colonnade: false },
};
export const CAPS = { items: 6000, perBuilding: 9, colonnade: 700 };
export const STREET_NEAR = 14, ARCADE_MIN = 6.5, BAY = 3.6, STOREY = 3.2;

/* an index of the street centre lines of a tile: dist(x, z) -> the distance to the nearest one within `far` metres, else Infinity */
export function streetIndex(tile, G, far = STREET_NEAR + 2) {
  const CELL = 24, grid = new Map(); for (const s of tile.streets || []) { const cls = G.classes[G.cls[s.id]]; if (G.layer[s.id] < 0 || cls === 'steps') continue; const p = s.pts;
    for (let i = 0; i + 3 < p.length; i += 2) { const seg = [p[i], p[i + 1], p[i + 2], p[i + 3]]; for (let a = Math.floor((Math.min(p[i], p[i + 2]) - far) / CELL); a <= Math.floor((Math.max(p[i], p[i + 2]) + far) / CELL); a++) for (let b = Math.floor((Math.min(p[i + 1], p[i + 3]) - far) / CELL); b <= Math.floor((Math.max(p[i + 1], p[i + 3]) + far) / CELL); b++) { const k = a + ',' + b; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(seg); } } }
  return (x, z) => { const l = grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)); if (!l) return Infinity; let best = Infinity; for (const [x0, z0, x1, z1] of l) { const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2)) : 0, d = Math.hypot(x0 + dx * t - x, z0 + dz * t - z); if (d < best) best = d; } return best <= far ? best : Infinity; };
}

/* an oriented box standing on y0: width w along (ux, uz), depth d across it; 5 faces */
function obox(m, X, Z, cx, y0, cz, ux, uz, w, h, d, c, cTop) {
  const fx = -uz, fz = ux, hx = w / 2, hz = d / 2, y1 = y0 + h, P = (i, j, y) => [X(cx + ux * hx * i + fx * hz * j), y, Z(cz + uz * hx * i + fz * hz * j)];
  const f = (a, b, c2, e, nx, ny, nz, col) => { const v0 = m.v(a[0], a[1], a[2], nx, ny, nz, col), v1 = m.v(b[0], b[1], b[2], nx, ny, nz, col), v2 = m.v(c2[0], c2[1], c2[2], nx, ny, nz, col), v3 = m.v(e[0], e[1], e[2], nx, ny, nz, col); m.tri(v0, v1, v2, nx, ny, nz); m.tri(v0, v2, v3, nx, ny, nz); };
  f(P(-1, 1, y0), P(1, 1, y0), P(1, 1, y1), P(-1, 1, y1), fx, 0, fz, c); f(P(1, -1, y0), P(-1, -1, y0), P(-1, -1, y1), P(1, -1, y1), -fx, 0, -fz, c); f(P(1, 1, y0), P(1, -1, y0), P(1, -1, y1), P(1, 1, y1), ux, 0, uz, c); f(P(-1, -1, y0), P(-1, 1, y0), P(-1, 1, y1), P(-1, -1, y1), -ux, 0, -uz, c); f(P(-1, -1, y1), P(1, -1, y1), P(1, 1, y1), P(-1, 1, y1), 0, 1, 0, cTop || c);
}
function column(m, X, Z, cx, y0, cz, r, h, c) {
  const N = 6; const v = []; for (let k = 0; k < N; k++) { const a = k / N * 6.2832; v.push([X(cx + Math.cos(a) * r), Z(cz + Math.sin(a) * r), Math.cos(a), Math.sin(a)]); }
  for (let k = 0; k < N; k++) { const a = v[k], b = v[(k + 1) % N], nx = (a[2] + b[2]) / 2, nz = (a[3] + b[3]) / 2, q0 = m.v(a[0], y0, a[1], nx, 0, nz, c), q1 = m.v(b[0], y0, b[1], nx, 0, nz, c), q2 = m.v(b[0], y0 + h, b[1], nx, 0, nz, c), q3 = m.v(a[0], y0 + h, a[1], nx, 0, nz, c); m.tri(q0, q1, q2, nx, 0, nz); m.tri(q0, q2, q3, nx, 0, nz); }
}

/* m: the detail mesher; b: { id, ring, use, height }; o: { X, Z, y0 (ground), y1 (roof), wall ({r,g,b}), area, dist (streetIndex), counts, circles (array to push [x, z, r] into) } */
export function facadeDetail(m, b, o) {
  const ring = b.ring, r = ring.length > 2 && ring[0] === ring[ring.length - 2] && ring[1] === ring[ring.length - 1] ? ring.slice(0, -2) : ring, n = r.length / 2; if (n < 3 || n > 40) return 0;
  const S = FACADE[o.area] || FACADE.default, { X, Z, y0, y1, wall, dist, counts } = o, hgt = y1 - y0; if (hgt < 6 || counts.items >= CAPS.items) return 0;
  const tri0 = m.i.length / 3, levels = Math.max(1, Math.round(hgt / STOREY)); let a2 = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a2 += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; } const ccw = a2 > 0;
  const soft = mix(wall, { r: 0.62, g: 0.62, b: 0.6 }, 0.5), slab = mul(soft, 0.95), cornice = mul(mix(wall, { r: 0.7, g: 0.7, b: 0.68 }, 0.6), 1.1); let used = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ax = r[i * 2], az = r[i * 2 + 1], bx = r[j * 2], bz = r[j * 2 + 1], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz); if (l < 5) continue;
    const ux = dx / l, uz = dz / l; let nx = uz, nz = -ux; if (!ccw) { nx = -nx; nz = -nz; }                  // outward normal of this wall
    const mx = ax + dx / 2, mz = az + dz / 2, wallD = dist(mx + nx * 4, mz + nz * 4) + 4;                                  // the street must lie on the outward side, so look 4 m out from the middle: the street is about this far from the wall
    if (!(wallD <= STREET_NEAR)) continue;
    /* the cornice: a band that sticks out 0.25 m just under the roof edge */
    if (S.cornice && hgt >= 8) { const cx = mx + nx * 0.12, cz = mz + nz * 0.12; obox(m, X, Z, cx, y1 - 0.75, cz, ux, uz, l, 0.4, 0.26, cornice, mul(cornice, 1.12)); used++; }
    /* the colonnade: columns along the ground floor over the pavement and a soffit slab */
    if (S.colonnade && (b.use === 'commercial' || b.use === 'retail') && hgt >= 8 && l >= 10 && wallD >= ARCADE_MIN && counts.colonnade < CAPS.colonnade) {
      const depth = 1.5; obox(m, X, Z, mx + nx * (depth / 2), y0 + 3.35, mz + nz * (depth / 2), ux, uz, l - 2, 0.3, depth, STONE, mul(STONE, 1.05));
      for (let s = 1.5; s <= l - 1.5; s += 4.2) { const px = ax + ux * s + nx * (depth - 0.25), pz = az + uz * s + nz * (depth - 0.25); column(m, X, Z, px, y0, pz, 0.28, 3.4, STONE); o.circles.push(px, pz, 0.32); counts.colonnade++; }
      used += 4;
    }
    /* balconies and wall ACs, bay by bay on the upper floors */
    const bays = Math.floor((l - 1.6) / BAY); if (bays < 1) continue;
    for (let k = 0; k < bays && used < CAPS.perBuilding; k++) {
      const c = 0.8 + (k + 0.5) * BAY, px = ax + ux * c, pz = az + uz * c;
      for (let f = 1; f < levels && used < CAPS.perBuilding; f++) {
        const roll = hash(b.id * 131 + i * 17 + k * 7 + f * 3);
        if (roll < S.balc && f >= 1) { const yb = y0 + f * STOREY, rail = RAIL[Math.floor(hash(b.id * 7 + i) * RAIL.length)]; obox(m, X, Z, px + nx * 0.5, yb, pz + nz * 0.5, ux, uz, 2.0, 0.14, 1.0, slab, mul(slab, 1.1)); obox(m, X, Z, px + nx * 0.98, yb + 0.14, pz + nz * 0.98, ux, uz, 2.0, 0.85, 0.05, rail); used++; }
        else if (roll < S.balc + S.ac) { const yb = y0 + f * STOREY + 0.9; obox(m, X, Z, px + nx * 0.22 + ux * 0.9, yb, pz + nz * 0.22 + uz * 0.9, ux, uz, 0.75, 0.5, 0.38, AC[Math.floor(hash(b.id + k + f) * AC.length)]); used++; }
      }
    }
  }
  const added = m.i.length / 3 - tri0; counts.items += used; counts.tris += added; return added;
}

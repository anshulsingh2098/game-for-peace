/* The far skyline of a city (WORK_REMAINING 12.2): beyond the detailed radius a tile is not built, only its tall or big buildings as plain boxes (the box round the footprint, flat colour by use, no windows, no collision,
   no claims), at most MAX per tile, so the city does not end in a wall of fog at 1.3 km. One mesh per tile; a few thousand triangles. Vertices are relative to the tile corner like tilemesh.js. */
import * as THREE from 'three';

const MAX = 260, MAX_DENSE = 650, COL = { residential: 0xb9a384, commercial: 0xa9a59a, office: 0x8aa0b2, retail: 0xc7b79a, civic: 0xc9b88c, religious: 0xdcc9a0, industrial: 0x9d9a92, hotel: 0xc8bda5, transit: 0xb7a58a, other: 0xbfb5a0 };
export const heightOf = b => Math.max(3, b.height || (b.levels ? b.levels * 3.2 : 9));

/* the buildings worth drawing from afar, biggest first: height at least 15 m or a footprint of 700 m2 and up; each { x0, z0, x1, z1, h, use } (the box round the footprint, in tile metres) */
export function skylineBoxes(tile, size, dense) {
  const ox = tile.tx * size, oz = tile.tz * size, out = [];
  for (const b of tile.buildings || []) {
    const r = b.ring; if (!r || r.length < 6) continue; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); }
    const w = x1 - x0, d = z1 - z0, h = heightOf(b); if (w < 6 || d < 6 || w > 400 || d > 400) continue; if (dense ? w * d < 90 : h < 15 && w * d < 700) continue;
    out.push({ x0: x0 - ox, z0: z0 - oz, x1: x1 - ox, z1: z1 - oz, h, use: b.use, k: h * Math.sqrt(w * d) });
  }
  out.sort((a, b) => b.k - a.k); return out.slice(0, dense ? MAX_DENSE : MAX);
}

export function buildSkyline(tile, { gy, size, dense }) {
  const boxes = skylineBoxes(tile, size, dense); if (!boxes.length) return null; const P = [], N = [], C = [], I = [], c = new THREE.Color();
  const face = (a, b, c2, d, nx, ny, nz, col) => { const v = P.length / 3; for (const q of [a, b, c2, d]) { P.push(q[0], q[1], q[2]); N.push(nx, ny, nz); C.push(col.r, col.g, col.b); } I.push(v, v + 1, v + 2, v, v + 2, v + 3); };
  for (const q of boxes) {
    c.setHex(COL[q.use] || COL.other); const k = 0.82 + 0.18 * ((q.x0 * 7.3 + q.z0 * 3.1) % 1 + 1) % 1; c.multiplyScalar(k); const y0 = gy, y1 = gy + q.h, { x0, z0, x1, z1 } = q;
    face([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], 0, 0, -1, c); face([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], 0, 0, 1, c); face([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], -1, 0, 0, c); face([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], 1, 0, 0, c);
    face([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], 0, 1, 0, c.clone().multiplyScalar(0.85));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); return g;
}

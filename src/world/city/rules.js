/* Generation rules that fix a CLASS of map irregularity everywhere at once (found by tools/audit_city.mjs; see docs/CITY_AUDIT.md). Pure (no three.js), so selftest can run them.
   Rule list (add a rule here, add its class to the audit, and every tile in every city gets it):
   - transit_in_park    a `transit` building (a Metro or railway station mapped as a building, often underground) lying 40 percent or more on a park is not extruded: it stood as a solid block over open ground
   - street_building    a mapped building that a ground road's centre line runs through for 15 m or more, or comes within 1.3 m of for 6 m or more, is not drawn (a building mapped on a road; a landmark is kept) */
const pip = (r, x, z) => { let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { if ((r[i + 1] > z) !== (r[j + 1] > z) && x < (r[j] - r[i]) * (z - r[i + 1]) / (r[j + 1] - r[i + 1]) + r[i]) c = !c; } return c; };
const bb = r => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); } return [x0, x1, z0, z1]; };
const ROADS = new Set(['primary', 'secondary', 'tertiary', 'residential']);

/* the buildings of a decoded tile that the rules leave out: a Set of the building objects. G: the graph columns (class, layer of each street). */
export function buildingsToSkip(tile, G) {
  const out = new Set(), blds = (tile.buildings || []).filter(b => b.ring && b.ring.length >= 6 && !b.landmark).map(b => ({ b, r: b.ring, x: bb(b.ring) }));
  const parks = (tile.parks || []).map(p => ({ r: p.ring, x: bb(p.ring) }));
  for (const e of blds) {                                                              // transit_in_park
    if (e.b.use !== 'transit' || !parks.length) continue; let tot = 0, h = 0; const [x0, x1, z0, z1] = e.x;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const x = x0 + (x1 - x0) * (i + .5) / 8, z = z0 + (z1 - z0) * (j + .5) / 8; if (!pip(e.r, x, z)) continue; tot++; for (const p of parks) if (x >= p.x[0] && x <= p.x[1] && z >= p.x[2] && z <= p.x[3] && pip(p.r, x, z)) { h++; break; } }
    if (tot >= 6 && h / tot >= 0.4) out.add(e.b);
  }
  const CELL = 32, grid = new Map(); for (const e of blds) for (let i = Math.floor(e.x[0] / CELL); i <= Math.floor(e.x[1] / CELL); i++) for (let j = Math.floor(e.x[2] / CELL); j <= Math.floor(e.x[3] / CELL); j++) { const k = i + ',' + j; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(e); }
  const NEAR = 1.3;                                                                    // a facade closer than this to a street's centre line leaves no room for a car (about 0.9 m half width)
  for (const s of tile.streets || []) {                                                // street_building
    const cls = G.classes[G.cls[s.id]]; if (G.layer[s.id] !== 0 || !ROADS.has(cls)) continue; const p = s.pts, runs = new Map(), close = new Map();
    for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L = Math.hypot(dx, dz), nx = -dz / (L || 1) * NEAR, nz = dx / (L || 1) * NEAR; for (let d = 0; d < L; d += 3) { const x = p[i] + dx * d / L, z = p[i + 1] + dz * d / L, l = grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)); if (l) for (const e of l) {
      if (x < e.x[0] - NEAR || x > e.x[1] + NEAR || z < e.x[2] - NEAR || z > e.x[3] + NEAR) continue;
      if (pip(e.r, x, z)) { runs.set(e.b, (runs.get(e.b) || 0) + 3); close.set(e.b, (close.get(e.b) || 0) + 3); } else if (pip(e.r, x + nx, z + nz) || pip(e.r, x - nx, z - nz)) close.set(e.b, (close.get(e.b) || 0) + 3); } } }
    for (const [b, len] of runs) if (len >= 15) out.add(b);
    for (const [b, len] of close) if (len >= 6) out.add(b);                            // street_building_edge: a facade within NEAR of the centre line for 6 m or more (about 2 % of the buildings) is a building mapped onto the road (tools/drive_streets.mjs found the car stopped dead by such walls)
  }
  return out;
}

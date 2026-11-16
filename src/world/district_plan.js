/* District plan (N11): where the buildings, sidewalks, crossings and street furniture of a built-up region go, for one piece of road. Pure JavaScript (no three.js), so the self-test
   checks the layout; `district.js` turns the plan into meshes. Deterministic: the same region, seed and piece always give the same plan.
   Layout rules, per side of the road, from the carriageway outwards:
     carriageway | shoulder | sidewalk (lateral shoulder + 0.1 .. frontage - 0.3) | frontage line at lateral FRONT (shoulder + 3.2) | building plots, each w wide, DEPTH deep
   - A plot is skipped on a bridge or in a tunnel, where the ground is not level with the road (within LEVEL m) or is water, inside a landmark zone (`blocked`), or on a sharp bend.
   - Plots follow the road's tangent; widths 8 to 16 m with occasional lanes (gaps of 5 to 7 m) between them; floors, style and colours from the region's `district` data.
   - Street furniture on the sidewalk: lamp posts every 36 m, a bus shelter every 300 m, vendor stalls along the 'market' frontage, signal poles at crossings.
   - Crossings are the navigation graph's crossings (navgraph.crossingAt), so painted zebras and routable crossings are the same places.
   - Obstacle circles ({ x, z, r, slide }) along each building front, for the world.near contract the vehicle physics uses. */
import { alea } from '../core/rng.js';
import { crossingAt, STEP } from './navgraph.js';
export const FRONT_GAP = 3.2, DEPTH = 12, LEVEL = 2.2, LAMP_EVERY = 36, SHELTER_EVERY = 300, FLOOR_H = 3.2, GROUND_H = 4;
export const PALETTES = {
  colonial: [0xe9d8b4, 0xd9b98a, 0xcf9d72, 0xe4c9a6, 0xc98a62], 'art-deco': [0xf0c9b4, 0xbfe0d0, 0xf2e2a6, 0xe8b6c4, 0xb9d3ea, 0xf4efe2], modern: [0xcfd5db, 0xaeb8c2, 0xe4e6e8, 0x9fb1c4], mixed: [0xe2cba6, 0xc8b8a0, 0xd8a890, 0xb9c4c8], mughal: [0xd9a98a, 0xe6c6a4, 0xcd8f6c], 'old-city': [0xd9b690, 0xc7956d, 0xe3c7a2]
};
export const SHOP = [0xd94f3c, 0x2f7fb8, 0xf0b429, 0x3f9d6a, 0x8e4f9e, 0xe07a2f, 0x2b3a67];

/* spec: the region's `district`: { styles: [names], floors: [min, max], market: bool }; returns the plan for road distance [s0, s1) */
export function planPiece({ road, terrain, seed, k, s0, s1, spec, blocked = () => false }) {
  const st = road.style, sea = terrain.seaLevel, plots = [], furniture = [], circles = [], p = {}, q = {}, front = st.shoulder + FRONT_GAP;
  const crossings = []; for (let i = Math.ceil(s0 / STEP); i * STEP < s1; i++) if (crossingAt(road, i, p)) crossings.push(i);
  for (const side of [1, -1]) {
    const R = alea(seed, 'district', k, side); let s = s0 + R() * 4;
    while (s < s1 - 6) {
      let w = 8 + R() * 8, gap = R() < 0.14 ? 5 + R() * 2 : R() * 1.2; if (s + w > s1) w = s1 - s; if (w < 6) break;
      const sc = s + w / 2, floors = Math.round(spec.floors[0] + R() * (spec.floors[1] - spec.floors[0])), style = spec.styles[Math.floor(R() * spec.styles.length)], colour = Math.floor(R() * 64), shop = Math.floor(R() * 64), extras = R();
      const ok = (() => {
        if (road.bridgeW(sc) > 0 || road.tunnelW(sc) > 0.01 || road.bridgeW(s) > 0 || road.bridgeW(s + w) > 0) return false;
        road.at(sc, p); const nx = -p.tz * side, nz = p.tx * side; road.at(s, q); const th0 = q.th; road.at(s + w, q); if (Math.abs(Math.atan2(Math.sin(q.th - th0), Math.cos(q.th - th0))) > 0.06) return false;
        for (const [a, b] of [[front + 0.5, -w / 2], [front + 0.5, w / 2], [front + DEPTH - 0.5, -w / 2], [front + DEPTH - 0.5, w / 2], [front + DEPTH / 2, 0]]) {
          const x = p.x + nx * a + p.tx * b, z = p.z + nz * a + p.tz * b, h = terrain.base(x, z); if (h < sea + 1 || Math.abs(h - p.y) > LEVEL || blocked(x, z)) return false;
        } return true;
      })();
      if (ok) {
        road.at(sc, p); const nx = -p.tz * side, nz = p.tx * side, d = DEPTH + (extras > 0.7 ? 4 : 0), cx = p.x + nx * (front + d / 2), cz = p.z + nz * (front + d / 2);
        plots.push({ side, s: sc, w, d, floors, style, colour, shop, extras, x: cx, z: cz, y: p.y, th: p.th, tx: p.tx, tz: p.tz, nx, nz, tx: p.tx, tz: p.tz, front });
        for (let u = -w / 2 + 2; u <= w / 2 - 2 + 0.01; u += 4) circles.push({ x: p.x + nx * (front + 1.5) + p.tx * u, z: p.z + nz * (front + 1.5) + p.tz * u, r: 2.4, slide: true, y: p.y });
        if (w < 8.5) circles.push({ x: p.x + nx * (front + 1.5), z: p.z + nz * (front + 1.5), r: 2.4, slide: true, y: p.y });
      }
      s += w + gap;
    }
    // furniture on the sidewalk
    const walk = st.shoulder + 1.4;
    for (let m = Math.ceil(s0 / LAMP_EVERY); m * LAMP_EVERY < s1; m++) { const sl = m * LAMP_EVERY + (side > 0 ? 0 : LAMP_EVERY / 2); if (sl < s0 || sl >= s1 || road.bridgeW(sl) > 0 || road.tunnelW(sl) > 0.01) continue; road.at(sl, p); if (blocked(p.x - p.tz * side * walk, p.z + p.tx * side * walk)) continue; furniture.push({ type: 'lamp', side, s: sl, lat: side * walk, x: p.x - p.tz * side * walk, z: p.z + p.tx * side * walk, y: p.y, th: p.th, tx: p.tx, tz: p.tz }); }
    for (let m = Math.ceil(s0 / SHELTER_EVERY); m * SHELTER_EVERY < s1; m++) { const ss = m * SHELTER_EVERY + 60; if (ss < s0 || ss >= s1 || side < 0 || road.bridgeW(ss) > 0 || road.tunnelW(ss) > 0.01) continue; road.at(ss, p); if (crossings.some(i => Math.abs(i * STEP - ss) < 30)) continue; if (blocked(p.x - p.tz * side * walk, p.z + p.tx * side * walk)) continue; furniture.push({ type: 'shelter', side, s: ss, x: p.x - p.tz * side * (walk + 0.6), z: p.z + p.tx * side * (walk + 0.6), y: p.y, th: p.th, tx: p.tx, tz: p.tz }); }
    if (spec.market) for (let ss = Math.ceil(s0 / 22) * 22 + 7; ss < s1; ss += 22) { if (road.bridgeW(ss) > 0 || road.tunnelW(ss) > 0.01 || crossings.some(i => Math.abs(i * STEP - ss) < 14)) continue; const rr = alea(seed, 'stall', k, side, ss); if (rr() > 0.55) continue; road.at(ss, p); const lat = front - 1.2; if (blocked(p.x - p.tz * side * lat, p.z + p.tx * side * lat)) continue; furniture.push({ type: 'stall', side, s: ss, x: p.x - p.tz * side * lat, z: p.z + p.tx * side * lat, y: p.y, th: p.th, tx: p.tx, tz: p.tz, colour: Math.floor(rr() * 64) }); }
  }
  for (const i of crossings) { road.at(i * STEP, p); for (const side of [1, -1]) { const lat = st.shoulder + 0.9; furniture.push({ type: 'signal', side, s: i * STEP, x: p.x - p.tz * side * lat + p.tx * 2.2, z: p.z + p.tx * side * lat + p.tz * 2.2, y: p.y, th: p.th, tx: p.tx, tz: p.tz, signalled: ['boulevard', 'highway'].includes(st.id) }); } }
  return { plots, furniture, circles, crossings };
}

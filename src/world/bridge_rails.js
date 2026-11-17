/* Collision for bridge rails. The vehicle physics asks world.near(x, z, r) for lists of circles {x, z, r} (world coordinates, metres) and pushes the car out of them
   (see collide() in src/vehicle/rapier-vehicle.js: the same contract trees, rocks and landmarks use). This answers with a circle every metre along both rails of every
   bridge stretch (Road.bridgeW === 1) near the point, at the same lateral offset the drawn rail has (half the deck width less 0.07 m, see bridges.js). The circles carry slide: true (the vehicle scrapes along them instead of stopping, see collide()) and are
   small (RAIL_R) so the car meets the rail where it sees it, not a metre before it.
   Pure (no three.js), so the self-test can check it.
   Usage: const near = createRails(road, style.shoulder); near(x, z, r) -> [list of circles]; the list is reused between calls, do not keep it. */
export const RAIL_R = 0.35, RAIL_STEP = 1;

export function createRails(road, deckHalf) {
  const p = {}, out = [], lists = [out], off = deckHalf - 0.07; let hint = 0, lx = 1e9, lz = 1e9, lr = -1;
  const clampS = s => Math.max(road.sMin + 5, Math.min(road.sMax - 5, s));
  return function near(x, z, r) {
    if (Math.abs(x - lx) + Math.abs(z - lz) < 0.4 && r === lr) return lists;             // hardly moved since the last answer
    lx = x; lz = z; lr = r; out.length = 0;
    let bs = hint, bd = Infinity;
    for (let s = hint - 20; s <= hint + 20; s += 2) { const q = clampS(s); road.at(q, p); const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bs = q; } }
    if (bd > 30 * 30) { bs = road.closestS(x, z, hint); road.at(bs, p); bd = (p.x - x) ** 2 + (p.z - z) ** 2; }      // far from the last place (a reset): search the whole road once
    hint = bs;
    if (Math.sqrt(bd) > deckHalf + r + 2) return lists;                                   // nowhere near the road
    for (let s = Math.floor((bs - r - 3) / RAIL_STEP) * RAIL_STEP; s <= bs + r + 3; s += RAIL_STEP) {
      const q = clampS(s); if (road.bridgeW(q) !== 1) continue;
      road.at(q, p); const nx = -p.tz, nz = p.tx;
      out.push({ x: p.x + nx * off, z: p.z + nz * off, r: RAIL_R, slide: true, y: p.y }, { x: p.x - nx * off, z: p.z - nz * off, r: RAIL_R, slide: true, y: p.y });
    }
    return lists;
  };
}

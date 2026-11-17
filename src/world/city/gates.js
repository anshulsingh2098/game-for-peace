/* Which India road a city pack's gate belongs to (WORK_REMAINING 12.7). The pack's gates are named after OpenStreetMap refs (NH44, NH148A...) that are not always the India skeleton's numbers, and some have none, so the
   match is by direction: each gate (x, z in the pack's metres from the city centre) takes the arm of the India network (a road through the city and the next city along it) that leaves the city in the same direction,
   with a bonus when the NH numbers agree. Pure; `net` is a RoadNetwork. Returns the gates with `road` (skeleton road id) and `toward` (the next city along it, the way out). */
export function mapGates(net, cityId, gates) {
  const c = net.cities.get(cityId); if (!c) return gates.map(g => ({ ...g, road: null, toward: null, score: -9 }));
  const arms = net.junctionChoices(cityId).map(a => { const t = net.cities.get(a.toward), dx = t.x - c.x, dz = t.z - c.z, L = Math.hypot(dx, dz) || 1; return { ...a, ux: dx / L, uz: dz / L }; }), norm = s => (s || '').replace(/\s+/g, '');
  return gates.map(g => { const L = Math.hypot(g.x, g.z) || 1; let best = null, bs = -9; for (const a of arms) { const sc = (g.x * a.ux + g.z * a.uz) / L + (g.india && a.nh && norm(g.india) === norm(a.nh) ? 0.35 : 0); if (sc > bs) { bs = sc; best = a; } } return { ...g, road: best ? best.road : null, toward: best ? best.toward : null, score: bs }; });
}
/* the gate to enter by: the best of the mapped gates for a car on India road `roadId` heading `yaw` (game yaw, the direction of travel; a gate's `bearing` is the direction you enter by, in the pack's clockwise-from-north convention) */
export function pickGate(gates, roadId, yaw, nh) {
  const yawOf = b => Math.atan2(-Math.cos(b), Math.sin(b)); let best = null, bs = -9;
  for (const g of gates) { const sc = Math.cos(yaw - yawOf(g.bearing)) + (roadId && g.road === roadId ? 1 : 0) + (nh && g.india && g.india.replace(/\s+/g, '') === nh ? 0.3 : 0) + (g.india ? 0.05 : 0); if (sc > bs) { bs = sc; best = g; } }
  return best;
}

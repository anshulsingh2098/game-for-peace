/* Checks every location profile: land statistics, and that a road can be built through it within the grade, radius and clearance limits.
   Run: node tools/locations_check.mjs [id]   (prints a line per location and seed) */
import { LOCATIONS, locationConfig } from '../src/world/locations.js';
import { createTerrain } from '../src/world/terrain.js';
import { Road } from '../src/world/router.js';

const only = process.argv[2], seeds = ['peace', 'coast', 'alps', 'kilo'];
for (const L of LOCATIONS) {
  if (only && L.id !== only) continue;
  for (const seed of seeds) {
    const cfg = locationConfig(L.id, seed), t = createTerrain(cfg), sea = cfg.terrain.seaLevel; let wet = 0, steep = 0, lo = 1e9, hi = -1e9, N = 0;
    for (let i = 0; i < 6400; i++) {
      const x = (i % 80) * 250 - 10000, z = Math.floor(i / 80) * 250 - 10000, h = t.base(x, z); N++; lo = Math.min(lo, h - sea); hi = Math.max(hi, h - sea); if (h < sea) wet++;
      else if (Math.hypot(t.base(x + 1, z) - h, t.base(x, z + 1) - h) > 1) steep++;
    }
    let msg = '';
    try {
      const r = new Road(t, cfg); r.ensure(-4000, 4000); t.attachRoad(r); let maxG = 0, over = 0, minR = 1e9, low = 1e9, hiR = -1e9, prev = null, water = 0, n = 0;
      for (let s = r.sMin + 40; s < r.sMax - 40; s += 5) { const p = r.at(s, {}); maxG = Math.max(maxG, Math.abs(p.slope)); if (Math.abs(p.slope) > cfg.road.hardGrade + 0.005) over++; low = Math.min(low, p.y - sea); hiR = Math.max(hiR, p.y - sea); n++; if (p.y - sea < 3.2) water++;
        if (prev !== null) { const k = Math.abs(Math.atan2(Math.sin(p.th - prev), Math.cos(p.th - prev))) / 5; if (k > 0) minR = Math.min(minR, 1 / k); } prev = p.th; }
      let bridge = 0, tunnel = 0; for (let s = r.sMin + 40; s < r.sMax - 40; s += 5) { if (r.bridgeW(s) === 1) bridge += 5; if (r.tunnelW(s) === 1) tunnel += 5; }
      msg = `road ${((r.sMax - r.sMin) / 1000).toFixed(1)} km, grade ${(maxG * 100).toFixed(1)}% (${(over / n * 100).toFixed(1)}% of the road over the hard limit), min radius ${minR.toFixed(0)} m, altitude ${low.toFixed(0)}..${hiR.toFixed(0)} m, bridge ${(bridge / (r.sMax - r.sMin) * 100).toFixed(0)}%, tunnel ${(tunnel / (r.sMax - r.sMin) * 100).toFixed(0)}%, near-water ${(water / n * 100).toFixed(0)}%`;
    } catch (e) { msg = 'ROAD FAILED: ' + e.message; }
    console.log(`${L.id.padEnd(10)} ${seed.padEnd(6)} land ${lo.toFixed(0)}..${hi.toFixed(0)} m above water, water ${(wet / N * 100).toFixed(0)}%, steep ${(steep / Math.max(1, N - wet) * 100).toFixed(1)}% | ${msg}`);
  }
}

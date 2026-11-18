/* Scripted street driving for the Delhi city (Phase P2 of docs/DELHI_POLISH_PLAN.md): drives the real Rapier car along many real routes through the real tiles, headless, and reports every place
   where something stopped it (an invisible wall, a prop in the carriageway, a kerb it cannot cross, a building wall too near the street).
   It builds the pack tiles with the game's own mesher (buildings, infill, fillers, street life with its poles, stalls and shelters), collects the obstacle circles the physics would see, plans a route between two
   random street nodes in a sample area (ground-level streets only), and follows it with a pure-pursuit driver at about 30 km/h. A trip is `done` when the car reaches the end, `stalled` when it makes less than 1 m
   of progress in 4 s, `timeout` when it takes three times as long as expected. For each stall it prints where, the street, and the nearest obstacle circles (a wall of a building or a free-standing prop).
   Not covered: flyover decks and underpasses (ground routes only), traffic and pedestrians, the decks' own physics. Geometry of curved streets comes from the tile's street pieces where there is one piece per street.
   Usage:  node tools/drive_streets.mjs [--trips 150] [--seed 1] [--area oldDelhi,cp,...] [--json] [--quiet]      (read only; nothing is written; exit code 1 when any trip stalled) */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
const V = new URL('../vendor/three/', import.meta.url).href;          // the game maps `three` with an import map in the page; Node needs the same mapping
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { if (s === 'three') return n(${JSON.stringify(V + 'three.module.js')}, c); if (s.startsWith('three/addons/')) return n(${JSON.stringify(V + 'addons/')} + s.slice(13), c); return n(s, c); }`));
const pack = await import('../src/world/city/pack.js'), { Identity } = await import('../src/world/city/identity.js'), tm = await import('../src/world/city/tilemesh.js'), { CityRouter, routePolyline } = await import('../src/world/city/citynav.js');
const { RapierVehicle, initRapier } = await import('../src/vehicle/rapier-vehicle.js'), { vehicleParams } = await import('../src/vehicle/physics.js'), { VEHICLES } = await import('../src/vehicle/defs.js');

const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TRIPS = +arg('--trips', 150), SEED = +arg('--seed', 1), AREAS = arg('--area', 'oldDelhi,karolbagh,cp,lajpat,lutyens').split(','), SPEED = 8.3, quiet = args.includes('--quiet');
const dir = fileURLToPath(new URL('../assets/cities/delhi/', import.meta.url)), SIZE = 1000, GY = 0;
const M = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8')), G = pack.decodeGraphColumns(JSON.parse(readFileSync(dir + 'graph.json', 'utf8'))), ID = new Identity(JSON.parse(readFileSync(dir + 'identity.json', 'utf8')), M.origin);
const LM = new Map(JSON.parse(readFileSync(dir + 'landmarks.json', 'utf8')).landmarks.map(l => [l.id, l])), have = new Set(M.tiles.map(t => t.tx + '_' + t.tz));
const CELLA = { u0: 0, v0: 0, u1: 1, v1: 1 }, art = { signFor: () => CELLA, adFor: () => CELLA, bannerFor: () => CELLA };       // the sign textures are not needed to know where the props stand
const rng = (() => { let q = SEED * 2654435761 >>> 0 || 1; return () => (q = (q * 1664525 + 1013904223) >>> 0) / 4294967296; })();

/* ---- tiles: built on demand with the game's mesher; their obstacle circles are kept in 16 m cells, with the buildings' rings to tell a wall from a free-standing prop ---- */
const tiles = new Map();
function tileData(tx, tz) {
  const k = tx + '_' + tz; if (tiles.has(k)) return tiles.get(k); if (!have.has(k)) { tiles.set(k, null); return null; }
  const tile = pack.decodeTile(JSON.parse(readFileSync(dir + 'tiles/' + k + '.json', 'utf8')), SIZE), rings = (tile.buildings || []).map(b => b.ring).filter(r => r && r.length >= 6);
  const r = tm.buildTile(tile, { G, lm: LM, gy: GY, size: SIZE, life: { identity: ID, art, month: 11, stops: [] } }), c = r.out.circles, cells = new Map(), all = [];
  for (let i = 0; i < c.length; i += 3) { const o = { x: c[i], z: c[i + 1], r: Math.abs(c[i + 2]), kerb: c[i + 2] < 0, y: GY }; all.push(o); const key = Math.floor(o.x / 16) + ',' + Math.floor(o.z / 16); let l = cells.get(key); if (!l) cells.set(key, l = []); l.push(o); }
  const pieces = new Map(); for (const s of tile.streets || []) { let l = pieces.get(s.id); if (!l) pieces.set(s.id, l = []); l.push(s.pts); }
  const d = { tile, cells, all, rings, pieces, out: r.out }; tiles.set(k, d); return d;
}
function circlesNear(x, z, r) {
  const out = []; for (let i = Math.floor((x - r - 4) / 16); i <= Math.floor((x + r + 4) / 16); i++) for (let j = Math.floor((z - r - 4) / 16); j <= Math.floor((z + r + 4) / 16); j++) {
    const t = tileData(Math.floor(i * 16 / SIZE), Math.floor(j * 16 / SIZE)); if (!t) continue; const l = t.cells.get(i + ',' + j); if (l) for (const o of l) if (Math.abs(o.x - x) < r + o.r && Math.abs(o.z - z) < r + o.r) out.push(o); }
  return out;
}
const world = { height: () => GY, surface: () => 'asphalt', near: (x, z, r) => { const l = circlesNear(x, z, r).filter(o => !o.kerb); return l.length ? [l] : []; }, seaLevel: -100 };      // kerbs are mountable (negative radius in the game); only walls and props stop a car
const geom = e => {                                                                                         // a street's own shape: all its pieces from the tiles around, joined a -> b in order of distance from its start node; null when they do not join
  const a = G.a[e], b = G.b[e], ax = G.xz[a * 2], az = G.xz[a * 2 + 1], bx = G.xz[b * 2], bz = G.xz[b * 2 + 1];
  for (const [x, z] of [[ax, az], [bx, bz], [(ax + bx) / 2, (az + bz) / 2]]) tileData(Math.floor(x / SIZE), Math.floor(z / SIZE));
  const lx = Math.min(ax, bx) - 5, hx = Math.max(ax, bx) + 5, lz = Math.min(az, bz) - 5, hz = Math.max(az, bz) + 5; const pieces = [];
  for (let tx = Math.floor(lx / SIZE); tx <= Math.floor(hx / SIZE); tx++) for (let tz = Math.floor(lz / SIZE); tz <= Math.floor(hz / SIZE); tz++) { const t = tileData(tx, tz); if (t) for (const p of t.pieces.get(e) || []) pieces.push(p); }
  if (!pieces.length) return null; if (pieces.length === 1) return pieces[0]; pieces.sort((p, q) => Math.hypot(p[0] - ax, p[1] - az) - Math.hypot(q[0] - ax, q[1] - az));
  let out = pieces[0].slice(); for (let k = 1; k < pieces.length; k++) { const q = pieces[k]; if (Math.hypot(q[0] - out[out.length - 2], q[1] - out[out.length - 1]) > 2) return null; out = out.concat(q.slice(Math.hypot(q[0] - out[out.length - 2], q[1] - out[out.length - 1]) < 0.01 ? 2 : 0)); } return out;
};
const pip = (r, x, z) => { let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { const xi = r[i], zi = r[i + 1], xj = r[j], zj = r[j + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const wallOrProp = o => { const t = tileData(Math.floor(o.x / SIZE), Math.floor(o.z / SIZE)); if (!t) return 'unknown'; for (const ring of t.rings) { let near = false; for (let i = 0; i < ring.length && !near; i += 2) if (Math.abs(ring[i] - o.x) < 6 && Math.abs(ring[i + 1] - o.z) < 6) near = true; if (near && (pip(ring, o.x, o.z) || (() => { let md = 1e9; for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) { const dx = ring[i] - ring[j], dz = ring[i + 1] - ring[j + 1], L2 = dx * dx + dz * dz, tt = L2 ? Math.max(0, Math.min(1, ((o.x - ring[j]) * dx + (o.z - ring[j + 1]) * dz) / L2)) : 0; md = Math.min(md, Math.hypot(o.x - (ring[j] + dx * tt), o.z - (ring[j + 1] + dz * tt))); } return md < 2.5; })())) return 'building wall'; } return 'free-standing prop'; };

/* how far (x, z) is from the centre line of the nearest drivable street piece of the tiles around it, and that street's half width: tells a prop that really stands in a carriageway from one the route merely cut a corner into */
function streetClearance(x, z) {
  let best = { d: 1e9, hw: 0, cls: '' };
  for (let tx = Math.floor((x - 30) / SIZE); tx <= Math.floor((x + 30) / SIZE); tx++) for (let tz = Math.floor((z - 30) / SIZE); tz <= Math.floor((z + 30) / SIZE); tz++) { const t = tileData(tx, tz); if (!t) continue;
    for (const s of t.tile.streets || []) { const cls = G.classes[G.cls[s.id]]; if (cls === 'footway' || cls === 'cycleway' || cls === 'steps' || cls === 'path' || cls === 'pedestrian' || G.layer[s.id] !== 0) continue; const p = s.pts;
      for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L2 = dx * dx + dz * dz, f = L2 ? Math.max(0, Math.min(1, ((x - p[i]) * dx + (z - p[i + 1]) * dz) / L2)) : 0, d = Math.hypot(p[i] + dx * f - x, p[i + 1] + dz * f - z); if (d < best.d) best = { d, hw: pack.pieceWidth(G, s) / 2, cls }; } } }
  return best;
}
/* ---- routes: between two random street nodes near a sample area, ground level only ---- */
const R = new CityRouter(G), zones = AREAS.map(a => ID.zones.find(z => z.area === a)).filter(Boolean); if (!zones.length) { console.error('no sample area found'); process.exit(2); }
function trip(i) {
  for (let tries = 0; tries < 40; tries++) {
    const z = zones[i % zones.length], a = R.nearest(z.x + (rng() - 0.5) * 1400, z.z + (rng() - 0.5) * 1400), b = R.nearest(z.x + (rng() - 0.5) * 2200, z.z + (rng() - 0.5) * 2200); if (a < 0 || b < 0 || a === b) continue;
    const d = Math.hypot(G.xz[a * 2] - G.xz[b * 2], G.xz[a * 2 + 1] - G.xz[b * 2 + 1]); if (d < 250 || d > 1500) continue;
    const r = R.routeNodes(a, b); if (!r || r.edges.length < 3 || r.edges.some(e => G.layer[e] !== 0)) continue;
    for (const n of r.nodes) tileData(Math.floor(G.xz[n * 2] / SIZE), Math.floor(G.xz[n * 2 + 1] / SIZE));
    const pl = routePolyline(G, r, geom); if (pl.length >= 4) return { area: z.area, a, b, r, pl };
  } return null;
}

/* ---- the driver: pure pursuit on the polyline ---- */
await initRapier(); const V0 = VEHICLES[0], params = vehicleParams(V0.body, V0.stats);
function cumulative(p) { const c = [0]; for (let i = 2; i < p.length; i += 2) c.push(c[c.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1])); return c; }
function pointAt(p, cum, s) { if (s <= 0) return [p[0], p[1]]; const n = cum.length; if (s >= cum[n - 1]) return [p[(n - 1) * 2], p[(n - 1) * 2 + 1]]; let k = 1; while (cum[k] < s) k++; const f = (s - cum[k - 1]) / (cum[k] - cum[k - 1] || 1); return [p[(k - 1) * 2] + (p[k * 2] - p[(k - 1) * 2]) * f, p[(k - 1) * 2 + 1] + (p[k * 2 + 1] - p[(k - 1) * 2 + 1]) * f]; }
function closest(p, cum, x, z, s0) { let k = 1; while (k < cum.length - 1 && cum[k] < s0 - 25) k++; k--; let best = s0, bd = 1e18; for (; k + 1 < cum.length && cum[k] < s0 + 70; k++) { const ax = p[k * 2], az = p[k * 2 + 1], dx = p[k * 2 + 2] - ax, dz = p[k * 2 + 3] - az, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0, d = Math.hypot(ax + dx * t - x, az + dz * t - z); if (d < bd) { bd = d; best = cum[k] + t * Math.sqrt(L2); } } return Math.max(s0 - 3, best); }       // the nearest point of the route within a window around the last progress, never going back more than 3 m
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function calibrate() { const ph = new RapierVehicle(params, V0.id, world); ph.reset(0, 0, 0, GY); let y0 = 0; for (let t = 0; t < 3; t += 1 / 60) { ph.step(1 / 60, { steer: 0.5, throttle: t < 1.5 ? 1 : 0.3, brake: 0 }); if (t > 1.5 && !y0) y0 = ph.yaw; } const s = Math.sign(wrap(ph.yaw - y0) || ph.yaw); ph.free(); return s || 1; }
const STEER_SIGN = calibrate();

function drive(t) {
  const p = t.pl, cum = cumulative(p), total = cum[cum.length - 1], ph = new RapierVehicle(params, V0.id, world), res = { area: t.area, metres: Math.round(total), result: 'done', stall: null };
  const a0 = Math.atan2(p[3] - p[1], p[2] - p[0]); ph.reset(p[0], p[1], a0, GY); let s = 0, lastProg = 0, lastT = 0, time = 0; const limit = total / (SPEED * 0.45) + 20;
  while (time < limit) {
    const look = 5 + 0.5 * Math.abs(ph.u), tgt = pointAt(p, cum, Math.min(total, s + look)), err = wrap(Math.atan2(tgt[1] - ph.z, tgt[0] - ph.x) - ph.yaw), steer = Math.max(-1, Math.min(1, STEER_SIGN * err * 1.6));
    const slow = Math.abs(err) > 0.5 ? 3 : SPEED, thr = ph.u < slow ? 1 : 0, brk = ph.u > slow + 1.5 ? 0.6 : 0;
    ph.step(1 / 30, { steer, throttle: thr, brake: brk }); time += 1 / 30; s = closest(p, cum, ph.x, ph.z, s);
    if (!Number.isFinite(ph.x + ph.z)) { res.result = 'physics blew up'; break; }
    if (s > total - 6) break;
    { const q = pointAt(p, cum, s); if (Math.hypot(q[0] - ph.x, q[1] - ph.z) > 25) { res.result = 'lost the route'; res.stall = { x: Math.round(ph.x), z: Math.round(ph.z), at: Math.round(s) + ' of ' + Math.round(total) + ' m', street: '', cls: '', speed: +ph.u.toFixed(1), headingError: +err.toFixed(2), offRoute: +Math.hypot(q[0] - ph.x, q[1] - ph.z).toFixed(1), blockedBy: [] }; break; } }
    if (s - lastProg > 1) { lastProg = s; lastT = time; } else if (time - lastT > 4) { res.result = 'stalled'; const near = circlesNear(ph.x, ph.z, 7).filter(o => !o.kerb).map(o => ({ d: Math.hypot(o.x - ph.x, o.z - ph.z) - o.r, o })).sort((a, b) => a.d - b.d).slice(0, 3), E = R.nearestEdge(ph.x, ph.z), nm = E && G.names && G.name ? G.names[G.name[E.e]] : null;
      res.stall = { x: Math.round(ph.x), z: Math.round(ph.z), at: Math.round(s) + ' of ' + Math.round(total) + ' m', street: nm ? (nm.en || nm.ref || '') : '', cls: E ? G.classes[G.cls[E.e]] : '', speed: +ph.u.toFixed(1), headingError: +err.toFixed(2), offRoute: +Math.hypot(pointAt(p, cum, s)[0] - ph.x, pointAt(p, cum, s)[1] - ph.z).toFixed(1), blockedBy: near.map(q => ({ what: wallOrProp(q.o), dist: +q.d.toFixed(1), r: +q.o.r.toFixed(2), at: [Math.round(q.o.x), Math.round(q.o.z)], ...(() => { const c = streetClearance(q.o.x, q.o.z); const inside = c.d < c.hw + q.o.r * 0.5, free = c.hw + c.d - q.o.r; return { fromCentre: +c.d.toFixed(1), halfWidth: +c.hw.toFixed(1), freeBeside: +free.toFixed(1), inCarriageway: inside && free < 2.4, bump: inside && free >= 2.4 }; })() })) }; break; }
  }
  if (res.result === 'done' && s <= total - 6) res.result = 'timeout'; ph.free(); return res;
}

const results = []; let made = 0, t0 = performance.now();
for (let i = 0; made < TRIPS && i < TRIPS * 4; i++) { const t = trip(i); if (!t) continue; made++; const r = drive(t); results.push(r); if (!quiet && r.result !== 'done') console.log(`trip ${made} (${r.area}, ${r.metres} m): ${r.result}` + (r.stall ? ` at (${r.stall.x}, ${r.stall.z}) ${r.stall.at}, ${r.stall.cls} ${r.stall.street}; speed ${r.stall.speed}, heading error ${r.stall.headingError}, ${r.stall.offRoute} m off the route; solid obstacles within 7 m: ` + (r.stall.blockedBy.map(b => `${b.what} ${b.dist} m (r ${b.r}, ${b.fromCentre} m from the street's centre line, half width ${b.halfWidth}${b.inCarriageway ? ', IN THE CARRIAGEWAY' : b.bump ? ', a bump with ' + b.freeBeside + ' m free beside it' : ''})`).join('; ') || 'none') : '')); }
const count = k => results.filter(r => r.result === k).length, by = {}; let real = 0, artefact = 0; for (const r of results) if (r.stall) { const b = r.stall.blockedBy[0]; if (b) { const kind = b.what + (b.inCarriageway ? ' IN THE CARRIAGEWAY' : b.bump ? ' in the lane (a car can steer round it)' : ' beside the street'); by[kind] = (by[kind] || 0) + 1; if (b.inCarriageway) real++; else artefact++; } }
if (args.includes('--json')) console.log(JSON.stringify({ trips: results.length, done: count('done'), stalled: count('stalled'), timeout: count('timeout'), stalledBy: by, results }, null, 1));
else console.log(`\n${results.length} trips, ${results.reduce((a, r) => a + r.metres, 0)} m driven in ${((performance.now() - t0) / 1000).toFixed(0)} s: ${count('done')} done, ${count('stalled')} stalled, ${count('timeout')} timeout, ${results.length - count('done') - count('stalled') - count('timeout')} other` + (Object.keys(by).length ? `; stalls were blocked by: ${Object.entries(by).map(([k, v]) => v + ' ' + k).join(', ')}` : '') + (real + artefact ? `
${real} stalls are real (an obstacle that leaves less than 2.4 m of the street's carriageway free); ${artefact} are not blockers (a bump the centre-line driver does not steer round, or the route cut a corner)` : ''));
process.exit(real > 0 ? 1 : 0);

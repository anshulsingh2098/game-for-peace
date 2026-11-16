/* Highway furniture plan (docs/INDIA_MAP_PLAN.md section 8): where the guardrails, kilometre stones, overhead sign gantries and toll plazas of an Indian national highway go, for one piece of road.
   Pure JavaScript (no three.js), so the self-test checks the layout; highway.js turns the plan into meshes. Only the 'nh6' road style gets any (other styles return an empty plan).
   Rules: guardrail on both outer edges every RAIL_STEP m; a kilometre stone every STONE_EVERY m on both sides; a sign gantry every GANTRY_EVERY m spanning both carriageways (posts on both
   outer verges and in the median), its two boards listing the destinations nearest the region, in English and Hindi; a toll plaza every TOLL_EVERY m, TOLL_LEN m long, with islands between
   the lanes. Nothing on a bridge, in a tunnel or on a sharp bend; no rail inside or near a toll plaza. Positions are world metres; `lat` is the lateral offset from the centre line
   (positive to the right of travel, the convention of road.at's tz, -tx). Deterministic for a seed. */
import { alea } from '../core/rng.js';
export const RAIL_STEP = 4, STONE_EVERY = 1000, GANTRY_EVERY = 1500, TOLL_EVERY = 7000, TOLL_LEN = 16, TOLL_OFFSET = 1800, GANTRY_OFFSET = 700, RAIL_LAT_GAP = 0.45, SIGN_SCALE = 25, ROAD_SCALE = 100;

const clear = (road, s) => road.bridgeW(s) <= 0 && road.tunnelW(s) <= 0.01;
export function tollAt(s0, s1) { const out = []; for (let m = Math.floor((s0 - TOLL_LEN - TOLL_OFFSET) / TOLL_EVERY); m * TOLL_EVERY + TOLL_OFFSET < s1; m++) { const s = m * TOLL_EVERY + TOLL_OFFSET; if (s + TOLL_LEN > s0 && s < s1) out.push(s); } return out; }
export function bendAt(road, s, len) { const p = {}, q = {}; road.at(s, p); road.at(s + len, q); return Math.abs(Math.atan2(Math.sin(q.th - p.th), Math.cos(q.th - p.th))); }

/* the toll plazas of the road within [s0, s1) that can really be built (level, no bridge, no tunnel, no bend): shared by the plan and by the traffic, so cars slow where the plaza is */
export function validTolls(road, s0, s1) { const out = []; for (const s of tollAt(s0 - TOLL_LEN, s1 + TOLL_LEN)) if (clear(road, s) && clear(road, s + TOLL_LEN) && clear(road, s + TOLL_LEN / 2) && bendAt(road, s, TOLL_LEN) < 0.03) out.push(s); return out; }
/* speed limit (m/s) for a car whose distance ahead to the plaza entrance is d (negative: already inside): 4 m/s through the booths, easing back to free speed 120 m before */
export const tollCap = d => d <= 0 ? 4 : Math.min(40, 4 + d * 0.3);

/* road, seed, k (piece number), s0..s1, dests: [{ en, hi, km }] from india_network.destinationsFor */
export function planHighway({ road, seed, k, s0, s1, dests = [], arcAt = null }) {
  const st = road.style, plan = { rails: [], stones: [], gantries: [], tolls: [], circles: [] }; if (st.id !== 'nh6') return plan;
  const p = {}, tolls = validTolls(road, s0 - TOLL_LEN, s1 + TOLL_LEN);
  const nearToll = s => tolls.some(t => s > t - 36 && s < t + TOLL_LEN + 36);
  const edge = st.shoulder + RAIL_LAT_GAP, at = (s, lat) => { road.at(s, p); return { x: p.x + p.tz * lat, z: p.z - p.tx * lat, y: p.y, tx: p.tx, tz: p.tz }; };
  for (let s = Math.ceil(s0 / RAIL_STEP) * RAIL_STEP; s < s1; s += RAIL_STEP) {
    if (!clear(road, s) || !clear(road, s + RAIL_STEP) || nearToll(s)) continue;
    for (const side of [1, -1]) { const a = at(s, side * edge), b = at(s + RAIL_STEP, side * edge); plan.rails.push({ s, side, x: a.x, z: a.z, y: a.y, x2: b.x, z2: b.z, y2: b.y }); plan.circles.push({ x: a.x, z: a.z, r: 0.45, slide: true }); }
  }
  for (let m = Math.ceil(s0 / STONE_EVERY); m * STONE_EVERY < s1; m++) { const s = m * STONE_EVERY; if (!clear(road, s) || nearToll(s)) continue; for (const side of [1, -1]) { const a = at(s, side * (edge + 0.9)); plan.stones.push({ s, side, km: m, x: a.x, z: a.z, y: a.y, tx: a.tx, tz: a.tz }); } }
  for (let m = Math.ceil((s0 - GANTRY_OFFSET) / GANTRY_EVERY); m * GANTRY_EVERY + GANTRY_OFFSET < s1; m++) {
    const s = m * GANTRY_EVERY + GANTRY_OFFSET; if (s < s0 || !clear(road, s) || nearToll(s) || bendAt(road, s - 6, 12) > 0.05) continue;
    const posts = [-edge - 0.8, 0, edge + 0.8].map(lat => ({ lat, ...at(s, lat) })), arc = arcAt && s >= 0 ? arcAt(s) : s, up = dests.filter(x => x.alongM !== undefined && x.alongM > arc + 300);
    /* a road that follows a real highway (dests with alongM, the distance along it in game metres): the board names the next cities and the real distance still to go (game metres x scale / 1000); otherwise the nearest places, with a distance that counts down */
    const along = up.length > 0, pool = along ? up : dests.filter(x => x.alongM === undefined), d = pool.length ? (along ? pool[0] : pool[Math.abs(m) % pool.length]) : null;
    const kmLeft = d ? (along ? Math.max(1, Math.round((d.alongM - arc) * ROAD_SCALE / 1000)) : Math.max(1, Math.round(d.km / SIGN_SCALE - ((s / 1000) % Math.max(2, d.km / SIGN_SCALE * 0.9))))) : 0;
    const d2 = pool.length > 1 ? (along ? pool[1] : pool[(Math.abs(m) + 1) % pool.length]) : d, kmRight = d2 ? (along ? Math.max(1, Math.round((d2.alongM - arc) * ROAD_SCALE / 1000)) : Math.max(1, Math.round(d2.km / SIGN_SCALE - ((s / 1000) % Math.max(2, d2.km / SIGN_SCALE * 0.9))))) : 0;
    plan.gantries.push({ s, posts, tx: posts[1].tx, tz: posts[1].tz, y: posts[1].y, sign: d ? { en: d.en, hi: d.hi, km: kmLeft } : null, sign2: d2 ? { en: d2.en, hi: d2.hi, km: kmRight } : null });
    for (const q of posts) plan.circles.push({ x: q.x, z: q.z, r: 0.6, slide: true });
  }
  for (const s of tolls) {
    if (s < s0 || s >= s1) continue; const lines = [2.4, 5.9, 9.4, 12.9].flatMap(l => [l, -l]), c = at(s + TOLL_LEN / 2, 0);
    plan.tolls.push({ s, len: TOLL_LEN, x: c.x, z: c.z, y: c.y, tx: c.tx, tz: c.tz, islands: lines.map(lat => ({ lat, ...at(s + TOLL_LEN / 2, lat) })) });
    for (const lat of lines) for (let u = 1.5; u < TOLL_LEN; u += 3.5) { const a = at(s + u, lat); plan.circles.push({ x: a.x, z: a.z, r: 0.7, slide: true }); }
  }
  return plan;
}

/* The trains the control office runs in a day (pure): real timetable trains from the TrainBook (departure time of day from the timetable, the stops it names, routes over the real network), goods trains
   between far stations, and Mumbai suburban shuttles. Each service is a route (steps and segments from the ControlGraph), its stops in route coordinates with booked arrival and departure times (seconds
   after the first departure: free running time plus the recovery allowance plus the halt), and its vehicle (consist, length, speed, acceleration). The game clock runs RAIL_SPEED railway minutes per second, so a timetable
   minute is one second of control time. Booked running times are computed from the game's own train performance, not copied from the printed timetable (the map is 1:100, so printed times cannot be kept;
   docs/RAIL_CONTROL.md). */
import { STYLES } from './rail.js';
import { RAIL_SPEED, styleOf } from './rail_timetable.js';
import { consist, lengthOf, hash } from './train_consist.js';
import { PRIORITY, SIG, classOf, legTime } from './rail_control_signals.js';


/* control seconds per railway minute: one minute on the station boards is this many seconds of simulation (a game day is 1440 times this). The real timetable cannot be run at the board's one second per minute
   on a map drawn 1:100 with full length trains: the lines would hold only a fraction of the trains; 8 lets the whole network run with a few percent of trains held at a signal at any time (tools/ and docs/RAIL_CONTROL.md) */
export const CLOCK_K = 8;

function vehicle(style, real, seed) {
  const S = STYLES[style], cs = consist(style, real, seed), len = cs.items.reduce((a, it) => a + lengthOf(it.kind), 0);
  return { S, cs, len };
}
/* the stop head position at the platform the train will use on arrival: the end of the last real block of the arrival step (before the stub of a loop) */
function stopX(r, stepIdx) {
  let k = r.segs.length - 1; while (k >= 0 && !(r.segs[k].type === 'blk' && r.segs[k].step === stepIdx)) k--; if (k < 0) return null; if (r.segs[k].blk.stub && k > 0 && r.segs[k - 1].type === 'blk') k--; return r.segs[k].b - 3;
}
const uturn = steps => { for (let i = 1; i < steps.length; i++) if (steps[i].edge === steps[i - 1].edge) return true; return false; };

/* stations: array of node ids (the stops), prio, style ... -> service or null */
export function makeService(net, graph, { id, n, name, style, prio, real = null, local = null, nodes, dep, dwell, seed, once = false, cities }) {
  const steps = []; const legEnd = [];
  for (let k = 1; k < nodes.length; k++) { if (nodes[k - 1] === nodes[k]) continue; const st = net.route(nodes[k - 1], nodes[k]); if (!st) return null; for (const s of st) steps.push(s); legEnd.push(steps.length - 1); }
  if (!steps.length || uturn(steps)) return null;
  const r = graph.segsFor(steps), v = vehicle(style, real, seed), S = v.S;
  let first = v.len + 4; if (r.total < first + 120) return null;
  const stops = [{ x: first, node: nodes[0], city: cities ? cities[0] : null, arrRel: 0, depRel: 0, dwell: 0 }]; let prevX = first, t = 0; const stopNodes = nodes.filter((m, i) => i === 0 || m !== nodes[i - 1]);
  for (let k = 0; k < legEnd.length; k++) {
    const x = stopX(r, legEnd[k]); if (x === null || x < prevX + 60) { if (k === legEnd.length - 1) { if (x !== null && x > prevX + 20) { /* keep the last stop */ } else return null; } else continue; }
    const run = legTime(x - prevX, S.vmax, S.accel, S.brake) * (1 + SIG.RECOVERY), last = k === legEnd.length - 1, dw = last ? 0 : (dwell === undefined ? S.dwell : dwell);
    t = stops[stops.length - 1].depRel + run; stops.push({ x, node: stopNodes[k + 1], city: cities ? cities[k + 1] : null, arrRel: t, depRel: t + dw, dwell: dw }); prevX = x;
  }
  if (stops.length < 2) return null;
  stops[0].dep = dep;
  return { id, n, name, style, prio, real, local, route: r, stops, len: v.len, vmax: S.vmax, accel: S.accel, brake: S.brake, dwell: S.dwell, cs: v.cs, once, seed };
}

/* services of a day. opts: freight (count), suburban (headway s, 0 for none), seed */
export function buildServices(net, book, graph, { freight = 120, suburban = 90, seed = 7, maxTrains = 1e9, k = 1 / RAIL_SPEED } = {}) {
  const MIN = k, out = []; let skipped = 0;
  if (book) book.trains.forEach((t, i) => {
    if (out.length >= maxTrains) return;
    const stn = t.stops.map(s => ({ s, n: net.byCity.get(s[0]) })).filter(o => o.n); if (stn.length < 2) { skipped++; return; }
    const m = t.stops[0][2] !== null && t.stops[0][2] !== undefined ? t.stops[0][2] : t.stops[0][1], dep = (((m % 1440) + 1440) % 1440) * MIN;
    const style = styleOf(t), svc = makeService(net, graph, { id: 'T' + t.n, n: t.n, name: t.name, style, prio: PRIORITY[classOf(t)], real: t, nodes: stn.map(o => o.n.id), dep, seed: i * 7919 + 13, cities: stn.map(o => o.s[0]) });
    if (svc) out.push(svc); else skipped++;
  });
  const S = net.stations, rnd = (a, b) => hash(seed * 1000 + a, b);
  for (let i = 0, g = 0; i < freight && g < freight * 30 && S.length > 1; g++) {
    const a = S[Math.floor(rnd(g, 1) * S.length)], b = S[Math.floor(rnd(g, 2) * S.length)]; if (a === b) continue; const st = net.route(a.id, b.id); if (!st || st.reduce((x, s) => x + s.edge.len, 0) < 3000) continue;
    const svc = makeService(net, graph, { id: 'F' + i, n: 'F' + i, name: 'Goods ' + a.city + ' to ' + b.city, style: 'freight', prio: PRIORITY.freight, nodes: [a.id, b.id], dep: rnd(g, 3) * 1440 * MIN, seed: g * 31 + 5, cities: [a.city, b.city] }); if (svc) { out.push(svc); i++; }
  }
  if (suburban > 0) { const mum = net.byCity.get('mumbai'); if (mum) {
    const near = S.filter(n => n !== mum).map(n => ({ n, d: Math.hypot(n.x - mum.x, n.z - mum.z) })).filter(o => o.d < 4000).sort((a, b) => a.d - b.d).slice(0, 2);
    near.forEach((o, pi) => { const style = pi % 2 ? 'emu_cr' : 'emu_wr'; for (let q = 0, d0 = 20 + pi * 40; d0 < 1440 * MIN - 120; q++, d0 += suburban) {
      const fwd = q % 2 === 0, svc = makeService(net, graph, { id: 'L' + pi + '_' + q, n: 'L' + pi + q, name: (style === 'emu_wr' ? 'Western' : 'Central') + ' local', style, prio: PRIORITY.suburban, nodes: fwd ? [mum.id, o.n.id] : [o.n.id, mum.id], dep: d0, seed: pi * 977 + q, cities: fwd ? ['mumbai', o.n.city] : [o.n.city, 'mumbai'] }); if (svc) { svc.local = { id: style === 'emu_wr' ? 'WR' : 'CR', name: style === 'emu_wr' ? 'Western Line' : 'Central Line', kind: 'local', livery: style }; out.push(svc); } } });
  } }
  out.skipped = skipped; return out;
}

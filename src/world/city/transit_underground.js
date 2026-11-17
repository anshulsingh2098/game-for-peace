/* Underground Metro stations you can walk into (D6): a station box under the street, built from the same station record as the elevated kit. Per underground line at the station: an island platform (or two side
   platforms) 1 m over the rail at -11 m, flat grey ceiling with light strips, columns, walls at the open sides, glass platform screen doors, the two tracks with a dark tunnel mouth 30 m past the platforms,
   name boards, round signs, a departure board; a concourse above the platform ends (floor 5 m down, wall-to-wall, ribs in the line colour on its ceiling, as in the Rajiv Chowk photos), a stair from each end
   of the platform up to the concourse, and from every entrance kiosk a stair down (and a corridor, where the kiosk is not over the concourse) to the concourse. Everything below ground is lit by an emissive
   material; the city's ground meshes are made two-sided (transit.js) so the street is the ceiling seen from below. Nothing between stations is drawn (no tunnel). Heights: platform surface -10, concourse floor -5.
   References looked at (Google Images, Commons; looked at only): Rajiv Chowk (yellow radial ceiling ribs, grey ceiling with light strips, platform screen doors, hanging blue and white signs). Browser only. */
import { C, fbox, frame, pt, slab, extrude, walkAlong, flight, gates } from './transit_geo.js';
import { platformLen, lineColour, UG_H } from './transit_plan.js';

const PLAT = C(0x8f8c86), PLAT_SIDE = C(0x6d6a65), TACT = C(0xe6b800), CEIL = C(0x9ea3a8), LIGHT = C(0xf4f6f8), WALLC = C(0xd2cec5), COLU = C(0x7b7f84), BED = C(0x3b3a38), RAILC = C(0x8d9298), DARK = C(0x050506), GLASS = C(0xa8d4e6), STAIR = C(0x77746e), FLOORC = C(0xb9b5ac);
const FL = { step: C(0x9c9890), tread: C(0xc9c5bb), belt: C(0x2d3034), rail: C(0x15171a) }, PW = 4.0, EDGE = 1.5, ISLAND_MIN = 8, DEPTH = -5.0, PY = -10;
const PSD_LINES = new Set(['pink', 'magenta', 'yellow', 'violet', 'airport', 'grey']);        // assumption: the data does not say which stations have screen doors

export function buildUnderground(K, T, items, X) {
  const { lit, glass, names, signs, bq, depQuads, claims } = X; K.ug = { anchors: [], dbg: [] };
  for (const it of items) {
    if (Math.abs(it.tracks[0].p.h - UG_H) > 0.6) continue;       // the profile did not reach the underground height here: no interior
    const A = it.tracks[0], Fi = frame(A.p.x, A.p.z, A.p.tx, A.p.tz), toF = (x, z) => ({ u: (x - Fi.x) * Fi.tx + (z - Fi.z) * Fi.tz, l: -(x - Fi.x) * Fi.tz + (z - Fi.z) * Fi.tx });
    const Lp = platformLen(it.line.id), psd = PSD_LINES.has(it.line.id), g = (+it.line.track.gauge || 1435) / 2000, ts = it.tracks.map(t => ({ ...t, l: toF(t.p.x, t.p.z).l, sg: t.p.tx * Fi.tx + t.p.tz * Fi.tz >= 0 ? 1 : -1 })).sort((a, b) => a.l - b.l), plats = [];       // sg: see transit_station.js
    for (let i = 0; i + 1 < ts.length; i++) { const gap = ts[i + 1].l - ts[i].l; if (gap >= ISLAND_MIN && it.per.layout !== 'side') plats.push({ t: ts[i], l0: EDGE, l1: gap - EDGE, edges: [0, 1] }); }
    if (!plats.length) { plats.push({ t: ts[0], l0: -EDGE - PW, l1: -EDGE, edges: [1] }); plats.push({ t: ts[ts.length - 1], l0: EDGE, l1: EDGE + PW, edges: [0] }); }
    let lo = Infinity, hi = -Infinity, bu0 = Infinity, bu1 = -Infinity; const rows = [], holes = [], col = lineColour(it.line), colRgb = C(col);
    for (const p of plats) {
      const R = p.t.R, q0 = R.at(p.t.s), sg = p.t.sg, L0 = sg > 0 ? p.l0 : -p.l1, L1 = sg > 0 ? p.l1 : -p.l0, sa = p.t.s - Lp / 2, sb = p.t.s + Lp / 2, i0 = R.indexAt(sa), i1 = Math.min(R.n - 1, R.indexAt(sb) + 1);
      extrude(lit, R, i0, i1, [[L0, -1.0], [L1, -1.0], [L1, 1.0], [L0, 1.0]], [PLAT_SIDE, PLAT_SIDE, PLAT, PLAT_SIDE], true);
      for (const ed of [0, 1]) if (!p.edges.includes(ed)) { const l = sg * (ed ? p.l1 : p.l0); extrude(lit, R, i0, i1, [[l, 1.0], [l, 5.2]], [WALLC], false); }
      for (const ed of p.edges) { const l = sg * (ed ? p.l1 : p.l0), d = sg * (ed ? 0.6 : -0.6); extrude(lit, R, i0, i1, [[l, 1.012], [l - d, 1.012]], [TACT], false); if (psd) extrude(glass, R, i0, i1, [[l + sg * (ed ? -0.05 : 0.05), 1.0], [l + sg * (ed ? -0.05 : 0.05), 3.2]], [GLASS], false); }
      lo = Math.min(lo, p.t.l + p.l0); hi = Math.max(hi, p.t.l + p.l1); rows.push({ p, R, sg, mid: (p.l0 + p.l1) / 2 });
      for (const e of [sa, sb]) { const q = R.at(e), f = toF(q.x, q.z); bu0 = Math.min(bu0, f.u); bu1 = Math.max(bu1, f.u); }
      walkAlong(K.walk, R, sa, sb, L0, L1, q0.h + 1.0);
      K.ug.dbg.push({ line: it.line.id, tl: +p.t.l.toFixed(1), sg, l0: p.l0, l1: p.l1, n: plats.length, edges: p.edges.join('') });
      if (p === plats[0] || p === plats[plats.length - 1]) { const sgn = p === plats[0] ? 1 : -1, fwd = q0.tx * Fi.tx + q0.tz * Fi.tz >= 0, endS = (sgn > 0) === fwd ? 1 : -1, c = p.edges.length === 2 ? (p.l0 + p.l1) / 2 : p.l0 > 0 ? p.l0 + 2.5 : p.l1 - 2.5; holes.push({ sgn, R, sg, c, endS, sE: p.t.s + endS * Lp / 2, l: p.t.l + c }); }
    }
    /* tracks (bed and rails) 30 m past the platforms, side walls, ceiling and its light strips, columns, the dark mouths of the tunnel */
    const Ra = ts[0].R, sa0 = ts[0].s, lb = ts[0].l, sgA = ts[0].sg, ext = 30, ia = Ra.indexAt(sa0 - Lp / 2 - ext), ib = Math.min(Ra.n - 1, Ra.indexAt(sa0 + Lp / 2 + ext) + 1);
    for (const t of ts) { const R = t.R, a = R.indexAt(t.s - Lp / 2 - ext), b = Math.min(R.n - 1, R.indexAt(t.s + Lp / 2 + ext) + 1); extrude(lit, R, a, b, [[-2.0, -0.4], [2.0, -0.4]], [BED], false); for (const sg of [-1, 1]) extrude(lit, R, a, b, [[sg * g - 0.06, 0.0], [sg * g + 0.06, 0.0]], [RAILC], false); }
    extrude(lit, Ra, ia, ib, [[sgA * (lo - 0.3 - lb), -1.5], [sgA * (hi + 0.3 - lb), -1.5], [sgA * (hi + 0.3 - lb), -1.0], [sgA * (lo - 0.3 - lb), -1.0]], [PLAT_SIDE, BED, PLAT_SIDE, PLAT_SIDE], true);       // the floor of the box (seen from above or the side there is nothing below)
    for (const l of [lo - 0.3, hi + 0.3]) extrude(lit, Ra, ia, ib, [[sgA * (l - lb), -1.2], [sgA * (l - lb), 5.6]], [WALLC], false);
    const c0 = Ra.indexAt(sa0 - Lp / 2 + 16), c1 = Math.min(Ra.n - 1, Ra.indexAt(sa0 + Lp / 2 - 16) + 1), ceilRing = [[sgA * (lo - 0.3 - lb), 5.2], [sgA * (hi + 0.3 - lb), 5.2], [sgA * (hi + 0.3 - lb), 5.6], [sgA * (lo - 0.3 - lb), 5.6]];
    extrude(lit, Ra, c0, c1, ceilRing, [CEIL], true); extrude(lit, Ra, ia, Ra.indexAt(sa0 - Lp / 2), ceilRing, [CEIL], true); extrude(lit, Ra, Ra.indexAt(sa0 + Lp / 2), ib, ceilRing, [CEIL], true);
    for (const t of ts) extrude(lit, Ra, ia, ib, [[sgA * (t.l - lb) - 0.25, 5.19], [sgA * (t.l - lb) + 0.25, 5.19]], [LIGHT], false);
    for (const r of rows) extrude(lit, Ra, ia, ib, [[sgA * (r.p.t.l + r.mid - lb) - 0.25, 5.19], [sgA * (r.p.t.l + r.mid - lb) + 0.25, 5.19]], [LIGHT], false);
    for (let u = -Lp / 2 + 8; u < Lp / 2 - 12; u += 9) { const q = Ra.at(sa0 + u), F = frame(q.x, q.z, q.tx, q.tz); for (const r of rows) { const l = sgA * (r.p.t.l + (r.p.edges.length === 2 ? r.mid : r.p.l0 > 0 ? r.p.l1 - 0.3 : r.p.l0 + 0.3) - lb); fbox(lit, F, -0.3, 0.3, l - 0.3, l + 0.3, q.h + 1.0, q.h + 5.2, COLU); } }
    for (const e of [sa0 - Lp / 2 - ext, sa0 + Lp / 2 + ext]) { const q = Ra.at(e), F = frame(q.x, q.z, q.tx, q.tz); lit.quad(pt(F, 0, sgA * (lo - 0.3 - lb), q.h - 1), pt(F, 0, sgA * (hi + 0.3 - lb), q.h - 1), pt(F, 0, sgA * (hi + 0.3 - lb), q.h + 5.6), pt(F, 0, sgA * (lo - 0.3 - lb), q.h + 5.6), DARK); }
    /* boards, round signs, a departure board per platform end */
    for (const r of rows) {
      for (const f of [-0.33, -0.1, 0.12, 0.34]) { const q = r.R.at(r.p.t.s + f * Lp), F = { x: q.x, z: q.z, tx: q.tx, tz: q.tz }, l = r.sg * (r.p.l1 <= 0 ? r.p.l0 + 1.0 : r.p.l1 - 1.0); bq(names, pt(F, -3, l, q.h + 3.0), pt(F, 3, l, q.h + 3.0), 1.5); }
      for (const f of [-0.22, 0.22]) { const q = r.R.at(r.p.t.s + f * Lp), F = { x: q.x, z: q.z, tx: q.tx, tz: q.tz }, l = r.sg * r.mid; fbox(lit, F, -0.05, 0.05, l - 0.05, l + 0.05, q.h + 1.0, q.h + 2.2, COLU); for (const [P0, P1] of [[pt(F, 0.06, l - 0.55, q.h + 2.2), pt(F, 0.06, l + 0.55, q.h + 2.2)], [pt(F, -0.06, l + 0.55, q.h + 2.2), pt(F, -0.06, l - 0.55, q.h + 2.2)]]) signs.quad(P0, P1, [P1[0], P1[1] + 1.1, P1[2]], [P0[0], P0[1] + 1.1, P0[2]], [1, 1, 1], [0, 0, 1, 0, 1, 1, 0, 1]); }
    }
    for (const r of rows.slice(0, 2)) { const q = r.R.at(r.p.t.s - 0.2 * Lp), F = { x: q.x, z: q.z, tx: q.tx, tz: q.tz }; depQuads.push([pt(F, 0, r.sg * r.mid - 1.6, q.h + 2.3), pt(F, 0, r.sg * r.mid + 1.6, q.h + 2.3)]); }
    /* the concourse: floor at -5 over the platform ends, walls up to the street, ribs in the line colour under the street; floor pieces leave a stair well at each platform end */
    const u0 = bu0 + 1, u1 = bu1 - 1, l0 = lo - 4, l1 = hi + 4, uc = (u0 + u1) / 2, lc = (l0 + l1) / 2, floor = (ua, ub, la, lb2) => { if (ub - ua < 0.1 || lb2 - la < 0.1) return; fbox(lit, Fi, ua, ub, la, lb2, DEPTH - 0.3, DEPTH, WALLC, FLOORC); K.walk.push({ x: Fi.x, z: Fi.z, tx: Fi.tx, tz: Fi.tz, u0: ua, u1: ub, l0: la, l1: lb2, ya: DEPTH, yb: DEPTH }); };
    const uA = u0 + (holes.some(h => h.sgn < 0) ? 15 : 0), uB = u1 - (holes.some(h => h.sgn > 0) ? 15 : 0); floor(uA, uB, l0, l1);
    for (const h of holes) { const at = off => { const q = h.R.at(h.sE - h.endS * off), l = h.sg * h.c; return [q.x - q.tz * l, q.z + q.tx * l]; }, lowP = at(16), topP = at(2), ue = h.sgn > 0 ? u1 : u0, hl = Math.max(l0 + 2, Math.min(l1 - 2, toF(topP[0], topP[1]).l)), ua = h.sgn > 0 ? uB : u0, ub = h.sgn > 0 ? u1 : uA;
      floor(ua, ub, l0, hl - 1.3); floor(ua, ub, hl + 1.3, l1); floor(Math.min(ue, ue - h.sgn * 1), Math.max(ue, ue - h.sgn * 1), hl - 1.3, hl + 1.3);
      const f = [lowP[0], 0, lowP[1]], t = [topP[0], 0, topP[1]], dx = t[0] - f[0], dz = t[2] - f[2], L = Math.hypot(dx, dz);
      flight(lit, f[0], f[2], PY, t[0], t[2], DEPTH, FL); K.walk.push({ x: f[0], z: f[2], tx: dx / L, tz: dz / L, u0: 0, u1: L, l0: -1.2, l1: 1.2, ya: PY, yb: DEPTH }); }
    const wall = (ua, la, ub, lb2) => lit.quad(pt(Fi, ua, la, DEPTH), pt(Fi, ub, lb2, DEPTH), pt(Fi, ub, lb2, -0.05), pt(Fi, ua, la, -0.05), WALLC);
    wall(u0, l0, u1, l0); wall(u0, l1, u1, l1); wall(u0, l0, u0, l1); wall(u1, l0, u1, l1);
    for (let u = u0 + 3; u < u1; u += 6) fbox(lit, Fi, u - 0.4, u + 0.4, l0, l1, -0.45, -0.05, colRgb, colRgb);
    gates(lit, Fi, uc - 4, lc - 3, DEPTH, 5); gates(lit, Fi, uc + 4, lc - 3, DEPTH, 5);       // two lines of fare gates (entry and exit)
    const cp = pt(Fi, uc, lc, 0); K.access.push({ x: cp[0], z: cp[2] }); claims.push({ kind: 'station', layer: 0, shape: { t: 'rect', x: cp[0], z: cp[2], hx: (u1 - u0) / 2, hz: (l1 - l0) / 2, yaw: Math.atan2(Fi.tz, Fi.tx) } });
    K.ug.anchors.push({ Fi, u0, u1, l0, l1 });
  }
  /* interchange: the concourses of the lines at this station joined by a corridor (floor at -5) from centre to centre */
  { const an = K.ug.anchors, ctr = a => pt(a.Fi, (a.u0 + a.u1) / 2, (a.l0 + a.l1) / 2, 0); for (let i = 1; i < an.length; i++) { const A0 = ctr(an[0]), B0 = ctr(an[i]), dx = B0[0] - A0[0], dz = B0[2] - A0[2], L = Math.hypot(dx, dz); if (L < 5) continue; const F = frame(A0[0], A0[2], dx / L, dz / L);
    fbox(lit, F, 0, L, -2.5, 2.5, DEPTH - 0.32, DEPTH - 0.02, WALLC, FLOORC); fbox(lit, F, 0, L, -2.6, -2.5, DEPTH, -0.05, WALLC); fbox(lit, F, 0, L, 2.5, 2.6, DEPTH, -0.05, WALLC); K.walk.push({ x: A0[0], z: A0[2], tx: dx / L, tz: dz / L, u0: 0, u1: L, l0: -2.5, l1: 2.5, ya: DEPTH - 0.02, yb: DEPTH - 0.02 }); } }
  /* from a kiosk at (x, z): a stair down (11 m) and, where the concourse is further away, a corridor to its nearest wall */
  K.ug.connect = (x, z, lit2) => {
    let best = null, bd = Infinity; for (const a of K.ug.anchors) { const du = (x - a.Fi.x) * a.Fi.tx + (z - a.Fi.z) * a.Fi.tz, dl = -(x - a.Fi.x) * a.Fi.tz + (z - a.Fi.z) * a.Fi.tx, cu = Math.max(a.u0, Math.min(a.u1, du)), cl = Math.max(a.l0, Math.min(a.l1, dl)), d = Math.hypot(du - cu, dl - cl); if (d < bd) { bd = d; best = { a, cu, cl, du, dl }; } }
    if (!best) return; const a = best.a, tgt = pt(a.Fi, best.cu, best.cl, 0), over = bd < 0.5, cen = pt(a.Fi, (a.u0 + a.u1) / 2, (a.l0 + a.l1) / 2, 0); let dx = (over ? cen[0] : tgt[0]) - x, dz = (over ? cen[2] : tgt[2]) - z, D = Math.hypot(dx, dz); if (D < 1) { dx = a.Fi.tx; dz = a.Fi.tz; D = 1; } dx /= D; dz /= D;
    const run = 11, ex = x + dx * run, ez = z + dz * run; flight(lit2, x, z, 0, ex, ez, DEPTH, FL); K.walk.push({ x, z, tx: dx, tz: dz, u0: 0, u1: run, l0: -1.3, l1: 1.3, ya: 0, yb: DEPTH });
    const len = over ? 0 : D - run; if (len > 0.5) { const F = frame(ex, ez, dx, dz); fbox(lit2, F, 0, len, -2.0, 2.0, DEPTH - 0.3, DEPTH, WALLC, FLOORC); fbox(lit2, F, 0, len, -2.1, -2.0, DEPTH, -0.05, WALLC); fbox(lit2, F, 0, len, 2.0, 2.1, DEPTH, -0.05, WALLC); K.walk.push({ x: ex, z: ez, tx: dx, tz: dz, u0: 0, u1: len, l0: -2.0, l1: 2.0, ya: DEPTH, yb: DEPTH }); }
  };
}

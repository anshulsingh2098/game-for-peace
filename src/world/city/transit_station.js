/* A Delhi Metro station (package D6). Built when you come near, from the station record and the routes that call there (transit_plan.js):
   elevated: side platforms outside the tracks (or an island platform where the tracks are 8 m or more apart), a barrel roof over all of it, roof columns, name boards, a departure board, a concourse in the
   viaduct under the platforms (5.5 m over the street), stair towers on both sides where the registry says the ground is free, wide hammer-head piers (transit.js); pink and magenta get glass platform screen doors
   (assumption: the data does not say). Interchanges are ONE structure: the concourse spans the platforms of every elevated line there. At grade: platforms and roof only. Underground: nothing above ground but the
   entrance kiosks (at the OSM entrance positions, moved off streets and buildings up to 12 m) with a dark stair opening. Name boards in Hindi and English, the line colours as bands. The look is guesswork
   (docs/DELHI_TRANSIT.md section 9). Browser only. */
import * as THREE from 'three';
import { Soup, C, fbox, frame, pt, slab, extrude, walkAlong, flight, gates } from './transit_geo.js';
import { buildUnderground } from './transit_underground.js';
import { kitOf, platformLen, lineColour, nextArrival, DWELL, RAIL_H, GIRDER } from './transit_plan.js';

const PLAT = C(0xa7a29a), PLAT_SIDE = C(0x8f8b83), PLAT_DK = C(0x6f6c66), TACTILE = C(0xe6b800), ROOF = [C(0x4b525a), C(0x7b848c)], COL = C(0x2e3a52), STEEL = C(0x9aa0a6), GLASS = C(0xa8d4e6), GLAZE = C(0x7e9db0), WALL = C(0xd8d2c4), BAND = C(0x9a968e), DARK = C(0x0d0f12), STAIR = C(0x6d6a65), STAIR_T = C(0xcfd5d9);
const FL = { step: C(0x8e8a82), tread: C(0xc4c0b6), belt: C(0x2d3034), rail: C(0x15171a) }, PW = 4.0, EDGE = 1.5, ISLAND_MIN = 8;

const px = (F, u, l) => pt(F, u, l, 0);
function fit(g, text, font, max, size) { let s = size; do { g.font = font.replace('#', s); s -= 4; } while (g.measureText(text).width > max && s > 20); }
/* the station name board: white, the line colours as a band, a disc with the station code, Hindi over English */
function nameTexture(st, colours) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#f5f4ef'; g.fillRect(0, 0, 1024, 256);
  const w = 1024 / colours.length; colours.forEach((h, i) => { g.fillStyle = h; g.fillRect(i * w, 0, w, 26); g.fillRect(i * w, 230, w, 26); });
  g.fillStyle = colours[0]; g.beginPath(); g.arc(122, 128, 84, 0, 7); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fit(g, st.code, 'bold #px system-ui, sans-serif', 130, 50); g.fillText(st.code, 122, 128);
  g.fillStyle = '#14161a'; if (st.name.hi) { fit(g, st.name.hi, 'bold #px "Noto Sans Devanagari","Kohinoor Devanagari","Devanagari Sangam MN","Mangal",system-ui,sans-serif', 740, 92); g.fillText(st.name.hi, 600, 92); }
  fit(g, st.name.en, 'bold #px system-ui, "Helvetica Neue", sans-serif', 740, 74); g.fillText(st.name.en, 600, st.name.hi ? 176 : 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* the round platform sign (photo: Laxmi Nagar): a white disc with a ring in the line colour (red in the photo), Hindi over English inside */
function roundTexture(st, colour) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#f7f6f2'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.strokeStyle = colour; g.lineWidth = 22; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
  g.fillStyle = '#14161a'; g.textAlign = 'center'; g.textBaseline = 'middle'; if (st.name.hi) { fit(g, st.name.hi, 'bold #px "Noto Sans Devanagari","Kohinoor Devanagari","Devanagari Sangam MN","Mangal",system-ui,sans-serif', 170, 44); g.fillText(st.name.hi, 128, 100); } fit(g, st.name.en, 'bold #px system-ui, sans-serif', 170, 32); g.fillText(st.name.en, 128, st.name.hi ? 150 : 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export class StationKit {
  constructor(T, e) {
    this.T = T; this.e = e; this.group = new THREE.Group(); this.circles = []; this.access = []; this.tris = 0; this.calls = 0; this.lastDep = -9; this.tex = []; this.geos = []; this.walk = [];
    const st = e.st, ox = st.x, oz = st.z, solid = new Soup(ox, oz), glass = new Soup(ox, oz), names = new Soup(ox, oz), dep = new Soup(ox, oz), signs = new Soup(ox, oz), lit = new Soup(ox, oz), claims = [];
    this.items = []; for (const per of st.per) { const calls = e.calls.filter(c => c.R.line === per.line); if (!calls.length) continue; const tr = []; for (const c of calls) { const p = c.R.at(c.s); if (!tr.some(q => Math.hypot(q.p.x - p.x, q.p.z - p.z) < 2.5)) tr.push({ R: c.R, s: c.s, p: { ...p } }); } this.items.push({ per, line: T.lineOf.get(per.line), kit: kitOf(per), tracks: tr, colour: lineColour(T.lineOf.get(per.line)) }); }
    if (!this.items.length) return;
    this.colours = [...new Set(this.items.map(i => i.colour))]; this.nameTex = nameTexture(st, this.colours); this.tex.push(this.nameTex);
    const lead = this.items.find(i => i.kit !== 'underground') || this.items[0], A = lead.tracks[0], Fa = frame(A.p.x, A.p.z, A.p.tx, A.p.tz), up = this.items.some(i => i.kit === 'underground');
    const toFrame = (x, z) => ({ u: (x - Fa.x) * Fa.tx + (z - Fa.z) * Fa.tz, l: -(x - Fa.x) * Fa.tz + (z - Fa.z) * Fa.tx });
    const UVQ = [0, 0, 1, 0, 1, 1, 0, 1];
    const bq = (S, P0, P1, hgt) => { S.quad(P0, P1, [P1[0], P1[1] + hgt, P1[2]], [P0[0], P0[1] + hgt, P0[2]], [1, 1, 1], UVQ); S.quad(P1, P0, [P0[0], P0[1] + hgt, P0[2]], [P1[0], P1[1] + hgt, P1[2]], [1, 1, 1], UVQ); };       // a board readable from both sides (two quads back to back, each reads left to right from its own side)
    const free = (x, z, hx, hz, yaw, m = 0.6) => { const r = Math.min(hx, hz) + m * 0.3, c = Math.cos(yaw), sn = Math.sin(yaw); for (const u of [0, hx * 0.6, -hx * 0.6]) if (T.blocked(x + c * u, z + sn * u, r)) return false; return true; };
    const box = { u0: Infinity, u1: -Infinity, l0: Infinity, l1: -Infinity }, depQuads = [], holes = [];

    /* platforms, roof, boards of every line that has track above ground here */
    for (const it of this.items) {
      if (it.kit === 'underground') continue; const Lp = platformLen(it.line.id), psd = it.line.id === 'pink' || it.line.id === 'magenta', ts = it.tracks.map(t => ({ ...t, l: toFrame(t.p.x, t.p.z).l, sg: t.p.tx * Fa.tx + t.p.tz * Fa.tz >= 0 ? 1 : -1 })).sort((a, b) => a.l - b.l), plats = [];       // sg: +1 when the track runs the same way as the lead track (its own lateral axis then points the same way), -1 when opposite
      for (let i = 0; i + 1 < ts.length; i++) { const gap = ts[i + 1].l - ts[i].l; if (gap >= ISLAND_MIN && it.per.layout !== 'side') plats.push({ t: ts[i], l0: EDGE, l1: gap - EDGE, edges: [0, 1] }); }       // an island platform between tracks 8 m or more apart
      if (!plats.length) { plats.push({ t: ts[0], l0: -EDGE - PW, l1: -EDGE, edges: [1] }); plats.push({ t: ts[ts.length - 1], l0: EDGE, l1: EDGE + PW, edges: [0] }); }       // else a side platform outside each outer track
      let lo = Infinity, hi = -Infinity; const rows = [];
      for (const p of plats) {
        const R = p.t.R, q0 = R.at(p.t.s), sg = p.t.sg, L0 = sg > 0 ? p.l0 : -p.l1, L1 = sg > 0 ? p.l1 : -p.l0; let sa = p.t.s - Lp / 2, sb = p.t.s + Lp / 2;
        if (it === lead && it.kit === 'elevated' && Math.abs(q0.h - RAIL_H) < 0.6 && (p === plats[0] || p === plats[plats.length - 1])) {       // the stair to the platform comes up at this platform's end in the lead direction: the platform stops 15 m short there and the concourse reaches under the gap
          const sgn = p === plats[0] ? 1 : -1, fwd = q0.tx * Fa.tx + q0.tz * Fa.tz > 0, endS = (sgn > 0) === fwd ? 1 : -1; if (endS > 0) sb -= 15; else sa += 15;
          const c = p.edges.length === 2 ? (p.l0 + p.l1) / 2 : p.l0 > 0 ? p.l0 + 2.5 : p.l1 - 2.5; holes.push({ sgn, R, sg, c, endS, sE: endS > 0 ? p.t.s + Lp / 2 : p.t.s - Lp / 2, l: p.t.l + c });
        }
        walkAlong(this.walk, R, sa, sb, L0, L1, q0.h + 1.0);
        const i0 = R.indexAt(sa), i1 = Math.min(R.n - 1, R.indexAt(sb) + 1);
        extrude(solid, R, i0, i1, [[L0, -1.6], [L1, -1.6], [L1, 1.0], [L0, 1.0]], [PLAT_DK, PLAT_SIDE, PLAT, PLAT_SIDE], true);
        for (const ed of [0, 1]) if (!p.edges.includes(ed)) { const l = sg * (ed ? p.l1 : p.l0); extrude(solid, R, i0, i1, [[l, 1.0], [l, 2.1]], [C(0x8a9096)], false); }       // railing on the open side (photo: Laxmi Nagar)
        for (const ed of p.edges) { const l = sg * (ed ? p.l1 : p.l0), d = sg * (ed ? 0.6 : -0.6); extrude(solid, R, i0, i1, [[l, 1.012], [l - d, 1.012]], [TACTILE], false); if (psd) extrude(glass, R, i0, i1, [[l + sg * (ed ? -0.05 : 0.05), 1.0], [l + sg * (ed ? -0.05 : 0.05), 3.0]], [GLASS], false); }
        lo = Math.min(lo, p.t.l + p.l0); hi = Math.max(hi, p.t.l + p.l1); rows.push({ p, R, sg, mid: (p.l0 + p.l1) / 2 });
        for (const q of [[R.at(p.t.s - Lp / 2), 0], [R.at(p.t.s + Lp / 2), 0]]) { const f = toFrame(q[0].x, q[0].z); box.u0 = Math.min(box.u0, f.u); box.u1 = Math.max(box.u1, f.u); box.l0 = Math.min(box.l0, f.l + p.l0 - 0.5 + 0 * q[1]); box.l1 = Math.max(box.l1, f.l + p.l1 + 0.5); }
      }
      const Ra = ts[0].R, sa = ts[0].s, ia = Ra.indexAt(sa - Lp / 2 + 6), ib = Math.min(Ra.n - 1, Ra.indexAt(sa + Lp / 2 - 6) + 1), N = 10, arch = [], cols = []; const w = hi - lo + 0.6, lb = ts[0].l, sgA = ts[0].sg;
      for (let k = 0; k <= N; k++) { arch.push([sgA * (lo - 0.3 + w * k / N - lb), 3.9 + 2.4 * Math.sin(Math.PI * k / N)]); if (k < N) cols.push(ROOF[k % 2]); }
      extrude(solid, Ra, ia, ib, arch, cols, false);
      for (let u = -Lp / 2 + 9; u < Lp / 2 - 6; u += 18) { const q = Ra.at(sa + u), F = frame(q.x, q.z, q.tx, q.tz); for (const l of [lo + 0.35, hi - 0.35]) fbox(solid, F, -0.2, 0.2, sgA * (l - lb) - 0.25, sgA * (l - lb) + 0.25, q.h + 1.0, q.h + 3.9, COL); for (const r of rows) if (r.p.l0 > 0 && r.p.l1 < 99 && r.p.edges.length === 2) { const lc = lb + r.mid + (r.p.t.l - lb), top = 3.9 + 2.4 * Math.sin(Math.PI * Math.max(0, Math.min(1, (lc - lo + 0.3) / w))); fbox(solid, F, -0.25, 0.25, sgA * (lc - lb) - 0.3, sgA * (lc - lb) + 0.3, q.h + 1.0, q.h + top, COL); } }
      for (const r of rows) for (const f of [-0.33, -0.1, 0.12, 0.34]) { const R = r.R, s = r.p.t.s + f * Lp, q = R.at(s), side = r.p.l1 <= 0 ? -1 : 1, l = r.sg * (side < 0 ? r.p.l0 + 1.0 : r.p.l1 - 1.0); const a = pt({ x: q.x, z: q.z, tx: q.tx, tz: q.tz }, -3, l, q.h + 2.75), b = pt({ x: q.x, z: q.z, tx: q.tx, tz: q.tz }, 3, l, q.h + 2.75); bq(names, a, b, 1.5); }
      for (const r of rows) for (const f of [-0.22, 0.22]) { const q = r.R.at(r.p.t.s + f * Lp), F = { x: q.x, z: q.z, tx: q.tx, tz: q.tz }, l = r.sg * r.mid; fbox(solid, F, -0.05, 0.05, l - 0.05, l + 0.05, q.h + 1.0, q.h + 2.2, COL); const a = pt(F, 0.06, l - 0.55, q.h + 2.2), b = pt(F, 0.06, l + 0.55, q.h + 2.2), a2 = pt(F, -0.06, l + 0.55, q.h + 2.2), b2 = pt(F, -0.06, l - 0.55, q.h + 2.2); for (const [P0, P1] of [[a, b], [a2, b2]]) signs.quad(P0, P1, [P1[0], P1[1] + 1.1, P1[2]], [P0[0], P0[1] + 1.1, P0[2]], [1, 1, 1], [0, 0, 1, 0, 1, 1, 0, 1]); }       // round signs on poles, both faces
      for (const r of rows.slice(0, 2)) { const R = r.R, q = R.at(r.p.t.s - 0.2 * Lp), F = { x: q.x, z: q.z, tx: q.tx, tz: q.tz }; depQuads.push([pt(F, 0, r.sg * r.mid - 1.6, q.h + 2.3), pt(F, 0, r.sg * r.mid + 1.6, q.h + 2.3)]); }
      const cc = pt(Fa, toFrame(ts[0].p.x, ts[0].p.z).u, (lo + hi) / 2, 0); claims.push({ kind: 'station', layer: 1, shape: { t: 'rect', x: cc[0], z: cc[2], hx: Lp / 2, hz: (hi - lo) / 2, yaw: Math.atan2(Fa.tz, Fa.tx) } });
    }

    /* the concourse (elevated stations) in the frame of the lead line, over every platform of the interchange, and the stair towers */
    if (this.items.some(i => i.kit === 'elevated') && box.u0 < box.u1 && Math.abs(A.p.h - RAIL_H) < 0.6) {       // (a station whose profile height is off by 0.6 m or more, next to a tunnel, gets platforms and kiosks only)
      const u0 = box.u0 + (holes.some(h => h.sgn < 0) ? 1 : 10), u1 = box.u1 - (holes.some(h => h.sgn > 0) ? 1 : 10), l0 = Math.max(box.l0, -40), l1 = Math.min(box.l1, 40), top = RAIL_H - GIRDER - 0.2, uc = (u0 + u1) / 2, lc = (l0 + l1) / 2;
      const wall = (ua, la, ub, lb, y0, y1, col) => solid.quad(pt(Fa, ua, la, y0), pt(Fa, ub, lb, y0), pt(Fa, ub, lb, y1), pt(Fa, ua, la, y1), col);       // hollow: four walls, a floor you can walk on (5.5 m) and a ceiling
      for (const [ya, yb, cw] of [[5.5, 6.1, BAND], [6.1, 8.9, GLAZE], [8.9, top, BAND]]) { wall(u0, l0, u1, l0, ya, yb, cw); wall(u0, l1, u1, l1, ya, yb, cw); wall(u0, l0, u0, l1, ya, yb, cw); wall(u1, l0, u1, l1, ya, yb, cw); }
      fbox(solid, Fa, u0, u1, l0, l1, 5.2, 5.5, BAND, C(0xcfcac0)); { const uA = u0 + (holes.some(h => h.sgn < 0) ? 15 : 0), uB = u1 - (holes.some(h => h.sgn > 0) ? 15 : 0); fbox(solid, Fa, uA, uB, l0, l1, top - 0.3, top, BAND, BAND);       // ceiling, with a hole where a stair goes up through it
        for (const h of holes) { const ua = h.sgn > 0 ? uB : u0, ub = h.sgn > 0 ? u1 : uA, hl = Math.max(l0 + 1.5, Math.min(l1 - 1.5, (() => { const q = h.R.at(h.sE - h.endS * 8), l = h.sg * h.c; return toFrame(q.x - q.tz * l, q.z + q.tx * l).l; })())); fbox(solid, Fa, ua, ub, l0, hl - 1.5, top - 0.3, top, BAND, BAND); fbox(solid, Fa, ua, ub, hl + 1.5, l1, top - 0.3, top, BAND, BAND);
          const at = (off, y) => { const q = h.R.at(h.sE - h.endS * off), l = h.sg * h.c; return [q.x - q.tz * l, y, q.z + q.tx * l]; }, f = at(1.5, 5.5), t = at(14.5, 12.5); flight(solid, f[0], f[2], 5.5, t[0], t[2], 12.5, FL);
          const dx = t[0] - f[0], dz = t[2] - f[2], L = Math.hypot(dx, dz); this.walk.push({ x: f[0], z: f[2], tx: dx / L, tz: dz / L, u0: 0, u1: L, l0: -1.2, l1: 1.2, ya: 5.5, yb: 12.5 }); } }
       this.walk.push({ x: Fa.x, z: Fa.z, tx: Fa.tx, tz: Fa.tz, u0, u1, l0, l1, ya: 5.5, yb: 5.5 }); gates(solid, Fa, uc - 3, lc - 2, 5.5, 4); const cp = pt(Fa, uc, lc, 0); this.access.push({ x: cp[0], z: cp[2] });
      for (const sg of [-1, 1]) { const l = sg > 0 ? l1 + 0.06 : l0 - 0.06, a = pt(Fa, uc - 5.4 * sg, l, 6.35), b = pt(Fa, uc + 5.4 * sg, l, 6.35); bq(names, sg > 0 ? a : b, sg > 0 ? b : a, 2.7); }
      claims.push({ kind: 'station', layer: 1, shape: { t: 'rect', x: Fa.x + Fa.tx * uc - Fa.tz * lc, z: Fa.z + Fa.tz * uc + Fa.tx * lc, hx: (u1 - u0) / 2, hz: (l1 - l0) / 2, yaw: Math.atan2(Fa.tz, Fa.tx) } });
      const yaw = Math.atan2(Fa.tz, Fa.tx); let placedT = 0;
      /* a tower is a covered stair from a free spot at street level up to the concourse wall; tried on the four sides, along the wall, with runs of 11 to 22 m; a side with no free ground gets none */
      const sides = [{ ax: 'l', sg: 1, w: l1, lo: u0 + 3, hi: u1 - 3, c: uc }, { ax: 'l', sg: -1, w: l0, lo: u0 + 3, hi: u1 - 3, c: uc }, { ax: 'u', sg: 1, w: u1, lo: l0 + 3, hi: l1 - 3, c: lc }, { ax: 'u', sg: -1, w: u0, lo: l0 + 3, hi: l1 - 3, c: lc }];
      for (const sd of sides) {
        if (placedT >= 2) break; let done = false;
        for (const run of [11, 14, 18, 22]) { for (const off of [0, 6, -6, 12, -12, 18, -18]) {
          const a = Math.max(sd.lo, Math.min(sd.hi, sd.c + off)), fp = sd.ax === 'l' ? pt(Fa, a, sd.w + sd.sg * run, 0) : pt(Fa, sd.w + sd.sg * run, a, 0), wp = sd.ax === 'l' ? pt(Fa, a, sd.w, 5.5) : pt(Fa, sd.w, a, 5.5);
          if (!free(fp[0], fp[2], 1.7, 1.7, yaw, 0.8)) continue;
          { const dx = wp[0] - fp[0], dz = wp[2] - fp[2], L = Math.hypot(dx, dz); this.walk.push({ x: fp[0], z: fp[2], tx: dx / L, tz: dz / L, u0: 0, u1: L, l0: -1.5, l1: 1.5, ya: 0.25, yb: 5.5 }); }
          flight(solid, fp[0], fp[2], 0.25, wp[0], wp[2], 5.5, FL); slab(solid, fp[0], fp[2], 2.9, wp[0], wp[2], 8.4, 3.4, 0.12, STAIR_T);
          const dl = sd.ax === 'l' ? [a - 1.7, a + 1.7, sd.sg > 0 ? sd.w + 0.05 : sd.w - 0.85, sd.sg > 0 ? sd.w + 0.85 : sd.w - 0.05] : [sd.sg > 0 ? sd.w + 0.05 : sd.w - 0.85, sd.sg > 0 ? sd.w + 0.85 : sd.w - 0.05, a - 1.7, a + 1.7];
          fbox(solid, Fa, dl[0], dl[1], dl[2], dl[3], 5.5, 8.4, DARK);
          claims.push({ kind: 'station', layer: 0, shape: { t: 'rect', x: fp[0], z: fp[2], hx: 1.7, hz: 1.7, yaw } }); this.access.push({ x: fp[0], z: fp[2] }); placedT++; done = true; break; } if (done) break; }
      }
      this.towers = placedT;
    }

    const ugItems = this.items.filter(i => i.kit === 'underground'); this.ug = null; if (ugItems.length) { buildUnderground(this, T, ugItems, { lit, glass, names, signs, bq, depQuads, claims }); if (!this.ug.anchors.length) this.ug = null; }
    /* the entrance kiosks at the OSM entrance positions (shifted off streets and buildings) */
    const yaw = Math.atan2(Fa.tz, Fa.tx), ents = st.entrances.length ? st.entrances : [[Fa.x - Fa.tz * 16, Fa.z + Fa.tx * 16], [Fa.x + Fa.tz * 16, Fa.z - Fa.tx * 16]], hx = up ? 3.8 : 2.8, hz = up ? 2.8 : 2.2; this.blocked = 0;
    for (const [ex, ez] of ents) {
      let best = null; for (const r of [0, 3, 6, 9, 12]) { for (let k = 0; k < (r ? 8 : 1); k++) { const a = k / 8 * Math.PI * 2, x = ex + Math.cos(a) * r, z = ez + Math.sin(a) * r; if (free(x, z, hx, hz, yaw, 0.6)) { best = { x, z }; break; } } if (best) break; }
      if (!best) { this.blocked++; best = { x: ex, z: ez }; } const F = frame(best.x, best.z, Fa.tx, Fa.tz), roofCol = C(this.colours[0]);
      fbox(solid, F, -hx, hx, -hz, hz, 0, 3.3, WALL); fbox(solid, F, -hx - 0.4, hx + 0.4, -hz - 0.4, hz + 0.4, 3.3, 3.7, roofCol);
      for (const sg of [-1, 1]) { const l = sg * (hz + 0.02); solid.quad(pt(F, -hx + 0.8, l, 0.05), pt(F, hx - 0.8, l, 0.05), pt(F, hx - 0.8, l, 2.6), pt(F, -hx + 0.8, l, 2.6), DARK); bq(names, sg > 0 ? pt(F, -1.8, hz + 0.45, 3.75) : pt(F, 1.8, -hz - 0.45, 3.75), sg > 0 ? pt(F, 1.8, hz + 0.45, 3.75) : pt(F, -1.8, -hz - 0.45, 3.75), 0.9); }
      if (up) { solid.quad(pt(F, -1.4, hz + 0.6, 0.03), pt(F, 1.4, hz + 0.6, 0.03), pt(F, 1.4, hz + 4.2, 0.03), pt(F, -1.4, hz + 4.2, 0.03), DARK); solid.quad(pt(F, -1.4, -hz - 0.6, 0.03), pt(F, 1.4, -hz - 0.6, 0.03), pt(F, 1.4, -hz - 4.2, 0.03), pt(F, -1.4, -hz - 4.2, 0.03), DARK); }
      claims.push({ kind: 'station', layer: 0, shape: { t: 'rect', x: best.x, z: best.z, hx, hz, yaw } }); this.access.push({ x: best.x, z: best.z });
      if (this.ug) this.ug.connect(best.x, best.z, lit); else for (const u of [-hx * 0.5, hx * 0.5]) this.circles.push({ x: best.x + Fa.tx * u, z: best.z + Fa.tz * u, r: hz + 0.4 });
    }
    T.claim('metro:st:' + st.id, claims);

    /* meshes: solid, glass, name boards (one texture), departure board (a second texture, redrawn live) */
    const add = (S, mat, shadow) => { if (S.empty) return null; const g = S.geometry(); this.geos.push(g); const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = true; m.castShadow = !!shadow; m.receiveShadow = true; this.group.add(m); this.tris += S.tris; this.calls++; return m; };
    add(solid, T.mat, true); add(glass, T.glassMat); add(lit, T.litMat);
    if (!signs.empty) { this.signTex = roundTexture(st, this.colours[0]); this.tex.push(this.signTex); this.signMat = new THREE.MeshBasicMaterial({ map: this.signTex, side: THREE.FrontSide, alphaTest: 0.5, toneMapped: false }); add(signs, this.signMat); }
    this.boardMat = new THREE.MeshBasicMaterial({ map: this.nameTex, side: THREE.FrontSide, toneMapped: false }); add(names, this.boardMat);
    if (depQuads.length) { this.depCanvas = document.createElement('canvas'); this.depCanvas.width = 512; this.depCanvas.height = 256; this.depTex = new THREE.CanvasTexture(this.depCanvas); this.depTex.colorSpace = THREE.SRGBColorSpace; this.tex.push(this.depTex);
      for (const [a, b] of depQuads) bq(dep, a, b, 1.5); this.depMat = new THREE.MeshBasicMaterial({ map: this.depTex, side: THREE.FrontSide, toneMapped: false }); add(dep, this.depMat); this.drawDep(T.t); }
    this.ox = ox; this.oz = oz; this.group.position.set(ox - T.origin.x, T.city.gy, oz - T.origin.z);
  }
  reposition() { this.group.position.set(this.ox - this.T.origin.x, this.T.city.gy, this.oz - this.T.origin.z); }
  /* the next trains: [{ colour, to, wait (s), boarding }] soonest first */
  next(t, n = 4) {
    const out = []; for (const c of this.e.calls) { const R = c.R; if (c.k >= R.stops.length - 1) continue; const tt = this.T.tt.get(R.id), w = nextArrival(tt, c.k, t), ago = (tt.headway - w) % tt.headway; out.push({ colour: lineColour(this.T.lineOf.get(R.line)), to: R.to, wait: w, boarding: ago < DWELL }); }
    out.sort((a, b) => (a.boarding ? -1 : a.wait) - (b.boarding ? -1 : b.wait)); return out.slice(0, n);
  }
  drawDep(t) {
    if (!this.depCanvas) return; const g = this.depCanvas.getContext('2d'); g.fillStyle = '#0a0c10'; g.fillRect(0, 0, 512, 256); g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#f2b632'; g.font = 'bold 30px system-ui, sans-serif'; g.fillText(this.e.st.name.en.slice(0, 26), 16, 28);
    g.fillStyle = '#5b6573'; g.fillRect(12, 52, 488, 2); const rows = this.next(t); g.font = 'bold 28px system-ui, sans-serif';
    rows.forEach((r, i) => { const y = 88 + i * 48; g.fillStyle = r.colour; g.fillRect(16, y - 16, 14, 32); g.fillStyle = '#f4f4f4'; g.textAlign = 'left'; g.fillText(String(r.to).slice(0, 19), 42, y); g.textAlign = 'right'; g.fillStyle = r.boarding ? '#6be37c' : '#f2b632'; g.fillText(r.boarding ? 'Boarding' : r.wait < 45 ? 'Arriving' : Math.ceil(r.wait / 60) + ' min', 496, y); });
    this.depTex.needsUpdate = true; this.lastDep = t;
  }
  update(t, dist) { if (this.depTex && dist < 130 && t - this.lastDep > 2) this.drawDep(t); }
  dispose() { for (const g of this.geos) g.dispose(); for (const t of this.tex) t.dispose(); if (this.boardMat) this.boardMat.dispose(); if (this.depMat) this.depMat.dispose(); if (this.signMat) this.signMat.dispose(); }
}

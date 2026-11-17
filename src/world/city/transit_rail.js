/* Indian Railways stations inside the Delhi enclave (package D6, part 4). From `transit.json` rail.stations: the platform bodies (island or side, centre, length, width: OSM), the track direction (`axis`), the foot
   bridges and the entrances. Drawn when you come near: platforms 0.9 m high with a yellow edge and a walk-on ramp at each end, the tracks in the gaps between platforms (ballast, two rails, running 220 m past the
   platforms), shed roofs over the platforms on columns, foot bridges (deck, railings, roof, stairs where the ground is free), name boards (yellow, Hindi and English), signal gantries.
   The station BUILDINGS are not drawn here: the city pack already draws the main ones as landmarks (cityworld.js registers them) and the keep-out registry holds them. Colours per station are guesses
   (docs/DELHI_TRANSIT.md 4.2: Old Delhi in red sandstone, Nizamuddin with green roofs); there are no trains on these tracks yet and the tracks are not joined to the India-world rail network. Browser only. */
import * as THREE from 'three';
import { Soup, C, fbox, frame, pt, slab } from './transit_geo.js';
import { TrainArt } from '../train_art.js';
import { consist, lengthOf, hash, locoNumber, headcode } from '../train_consist.js';

const RAD = 650, KEEP = 950, PLAT_H = 0.9, RAIL = C(0x8d9298), BALLAST = C(0x4f4b45), PLAT = C(0xc4bdae), PLAT_SIDE = C(0x86827a), TACT = C(0xe6b800), COL = C(0x6f7378), BRIDGE = C(0x8a8f96), RAILING = C(0x59606a);
const ROOFS = { NDLS: 0x8d98a3, DLI: 0xb5603f, NZM: 0x4f9a63, ANVT: 0xc9d1d6, DEE: 0x9aa3ab, DEC: 0xa7b4bd }, DEFAULT_ROOF = 0x9aa3ab;

function boardTexture(st) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#f2c500'; g.fillRect(0, 0, 1024, 256); g.fillStyle = '#111'; g.fillRect(0, 0, 1024, 12); g.fillRect(0, 244, 1024, 12); g.textAlign = 'center'; g.textBaseline = 'middle';
  const fit = (t, f, max, size) => { let s = size; do { g.font = f.replace('#', s); s -= 4; } while (g.measureText(t).width > max && s > 24); };
  if (st.name.hi) { fit(st.name.hi, 'bold #px "Noto Sans Devanagari","Kohinoor Devanagari","Devanagari Sangam MN","Mangal",system-ui,sans-serif', 940, 84); g.fillText(st.name.hi, 512, 70); } fit(st.name.en.toUpperCase(), 'bold #px system-ui, "Helvetica Neue", sans-serif', 940, 78); g.fillText(st.name.en.toUpperCase(), 512, st.name.hi ? 156 : 128);
  g.font = 'bold 34px system-ui, sans-serif'; g.fillText(st.id, 512, 218); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* a coach (23.5 m, blue with a white stripe: a guess at the common look) and a locomotive (20 m), rail top at y = 0 */
function vehicleGeometry(loco) {
  const S = new Soup(0, 0), F = frame(0, 0, 1, 0), L = loco ? 20 : 23.5, W = 3.2, body = C(loco ? 0x2d4f86 : 0x2a4d96), white = C(0xf0f0ee), dark = C(0x1d2024), glass = C(0x16212b), q = (u0, u1, y0, y1, l, col) => S.quad([u0, y0, l], [u1, y0, l], [u1, y1, l], [u0, y1, l], col);
  fbox(S, F, -L / 2, L / 2, -W / 2, W / 2, 0.9, 4.0, body); fbox(S, F, -L / 2 + 0.4, L / 2 - 0.4, -W / 2 + 0.3, W / 2 - 0.3, 4.0, 4.25, C(0x9aa0a6)); fbox(S, F, -L / 2 + 1, L / 2 - 1, -W / 2 + 0.3, W / 2 - 0.3, 0.45, 0.9, dark);
  for (const u of loco ? [-6, 6] : [-8.2, 8.2]) fbox(S, F, u - 1.4, u + 1.4, -W / 2 + 0.4, W / 2 - 0.4, 0.15, 0.9, dark); if (loco) fbox(S, F, -1.2, 1.2, -0.6, 0.6, 4.25, 4.7, dark);
  for (const sg of [-1, 1]) { const l = sg * (W / 2 + 0.02); q(-L / 2, L / 2, 2.55, 2.9, l, white); if (!loco) q(-L / 2 + 1, L / 2 - 1, 2.0, 2.5, l, glass); else for (const u of [-5, -2, 2, 5]) q(u - 0.6, u + 0.6, 2.3, 3.4, l, glass); }
  return S.geometry();
}
class RailKit {
  constructor(T, st) {
    this.T = T; this.st = st; this.group = new THREE.Group(); this.walk = []; this.tris = 0; this.calls = 0; this.geos = []; this.tex = []; const ox = st.x, oz = st.z, S = new Soup(ox, oz), N = new Soup(ox, oz), claims = [];
    const ax = st.axis, F0 = frame(st.x, st.z, Math.cos(ax), Math.sin(ax)), toF = (x, z) => ({ u: (x - F0.x) * F0.tx + (z - F0.z) * F0.tz, v: -(x - F0.x) * F0.tz + (z - F0.z) * F0.tx }), roof = C(ROOFS[st.id] || DEFAULT_ROOF), yaw = ax;
    let bodies = (st.bodies || []).filter(b => b.faces && b.faces.length); if (!bodies.length) bodies = st.bodies || []; if (!bodies.length) return;
    const P = bodies.map(b => ({ ...b, w: b.type === 'island' ? Math.min(b.w, 12) : Math.min(b.w, 9), ...toF(b.x, b.z) })).sort((a, b) => a.v - b.v), uMin = Math.min(...P.map(b => b.u - b.len / 2)), uMax = Math.max(...P.map(b => b.u + b.len / 2)), UP = (u, v, y) => pt(F0, u, v, y), bq = (A, B, h) => { for (const [a, b] of [[A, B], [B, A]]) N.quad(a, b, [b[0], b[1] + h, b[2]], [a[0], a[1] + h, a[2]], [1, 1, 1], [0, 0, 1, 0, 1, 1, 0, 1]); };
    /* tracks in the gaps between platforms, and a pair of outer tracks beyond the first and last platform */
    const vs = []; for (let i = 0; i + 1 < P.length; i++) { const r = P[i].v + P[i].w / 2, l = P[i + 1].v - P[i + 1].w / 2, gap = l - r; if (gap > 2.5) { const n = Math.max(1, Math.round(gap / 5.2)); for (let k = 0; k < n; k++) vs.push(r + gap * (k + 0.5) / n); } }
    const u0 = uMin - 220, u1 = uMax + 220, rail = (v, g) => S.quad(UP(u0, v + g - 0.07, 0.2), UP(u1, v + g - 0.07, 0.2), UP(u1, v + g + 0.07, 0.2), UP(u0, v + g + 0.07, 0.2), RAIL);
    for (const v of vs) { S.quad(UP(u0, v - 1.7, 0.08), UP(u1, v - 1.7, 0.08), UP(u1, v + 1.7, 0.08), UP(u0, v + 1.7, 0.08), BALLAST); rail(v, -0.838); rail(v, 0.838); }
    if (vs.length) claims.push({ kind: 'rail', layer: 0, shape: { t: 'rect', x: UP((u0 + u1) / 2, (vs[0] + vs[vs.length - 1]) / 2, 0)[0], z: UP((u0 + u1) / 2, (vs[0] + vs[vs.length - 1]) / 2, 0)[2], hx: (u1 - u0) / 2, hz: (vs[vs.length - 1] - vs[0]) / 2 + 2, yaw } });
    /* a rake (a locomotive and ten coaches) on every third track runs in, stands 100 s at the platforms and runs out again (cycle 300 s, every track shifted): instanced by RailStations. Not the real timetable (rail_timetable.js). */
    this.rakeTracks = vs.filter((v, k) => k % 3 === 1).map((v, i) => ({ v, ph: i * 83, dir: i % 2 ? -1 : 1 })); this.rakeSpan = { F0, uc: (uMin + uMax) / 2, uA: uMin - 260, uB: uMax + 260 };
    /* platforms, ramps, roofs, boards */
    for (const b of P) {
      const a0 = b.u - b.len / 2, a1 = b.u + b.len / 2, v0 = b.v - b.w / 2, v1 = b.v + b.w / 2; fbox(S, F0, a0, a1, v0, v1, 0, PLAT_H, PLAT_SIDE, PLAT);
      for (const v of [v0, v1]) S.quad(UP(a0, v + (v === v0 ? 0.0 : -0.6), PLAT_H + 0.012), UP(a1, v + (v === v0 ? 0.0 : -0.6), PLAT_H + 0.012), UP(a1, v + (v === v0 ? 0.6 : 0), PLAT_H + 0.012), UP(a0, v + (v === v0 ? 0.6 : 0), PLAT_H + 0.012), TACT);
      this.walk.push({ x: F0.x, z: F0.z, tx: F0.tx, tz: F0.tz, u0: a0, u1: a1, l0: v0, l1: v1, ya: PLAT_H, yb: PLAT_H });
      for (const [ua, ub, ya, yb] of [[a1, a1 + 12, PLAT_H, 0], [a0, a0 - 12, PLAT_H, 0]]) { const m = ((v0 + v1) / 2), A = UP(ua, m, 0), B = UP(ub, m, 0); slab(S, A[0], A[2], ya, B[0], B[2], yb, Math.min(b.w, 6), 0.9, PLAT_SIDE, PLAT); const dx = B[0] - A[0], dz = B[2] - A[2], L = Math.hypot(dx, dz); this.walk.push({ x: A[0], z: A[2], tx: dx / L, tz: dz / L, u0: 0, u1: L, l0: -Math.min(b.w, 6) / 2, l1: Math.min(b.w, 6) / 2, ya, yb }); }
      claims.push({ kind: 'station', layer: 0, shape: { t: 'rect', x: UP(b.u, b.v, 0)[0], z: UP(b.u, b.v, 0)[2], hx: b.len / 2, hz: b.w / 2, yaw } });
      const r0 = a0 + b.len * 0.14, r1 = a1 - b.len * 0.14, w = Math.min(b.w + 1.2, 24); if (b.w >= 4) { fbox(S, F0, r0, r1, b.v - w / 2, b.v + w / 2, 5.0, 5.35, roof, roof); for (let u = r0 + 6; u < r1; u += 20) for (const vv of b.w > 12 ? [b.v - b.w / 2 + 0.6, b.v, b.v + b.w / 2 - 0.6] : [b.v]) fbox(S, F0, u - 0.18, u + 0.18, vv - 0.18, vv + 0.18, PLAT_H, 5.0, COL); }
      for (const f of [-0.3, 0.3]) bq(UP(b.u + f * b.len - 3.5, b.v, PLAT_H + 3.4), UP(b.u + f * b.len + 3.5, b.v, PLAT_H + 3.4), 1.7);
    }
    /* signal gantries across all tracks, every 90 m past the platforms */
    if (vs.length) for (const u of [uMin - 80, uMin - 170, uMax + 80, uMax + 170]) { const va = vs[0] - 3, vb = vs[vs.length - 1] + 3; fbox(S, F0, u - 0.3, u + 0.3, va - 0.25, va + 0.25, 0, 8, COL); fbox(S, F0, u - 0.3, u + 0.3, vb - 0.25, vb + 0.25, 0, 8, COL); fbox(S, F0, u - 0.25, u + 0.25, va, vb, 7.6, 8.0, COL); }
    /* foot bridges */
    const free = (x, z) => !T.blocked(x, z, 1.6);
    for (const fb of st.footbridges || []) { const p = fb.path; if (!p || p.length < 4) continue;
      for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L = Math.hypot(dx, dz); if (L < 0.5) continue; const F = frame(p[i], p[i + 1], dx / L, dz / L); fbox(S, F, 0, L, -1.3, 1.3, 5.6, 6.0, BRIDGE, BRIDGE); fbox(S, F, 0, L, -1.3, -1.2, 6.0, 7.1, RAILING); fbox(S, F, 0, L, 1.2, 1.3, 6.0, 7.1, RAILING); fbox(S, F, 0, L, -1.4, 1.4, 8.3, 8.5, roof, roof);
        for (let u = 0; u <= L; u += Math.max(8, L / Math.ceil(L / 14))) { fbox(S, F, u - 0.2, u + 0.2, -0.2, 0.2, 0, 5.6, COL); fbox(S, F, u - 0.15, u + 0.15, -1.3, -1.15, 6, 8.3, COL); fbox(S, F, u - 0.15, u + 0.15, 1.15, 1.3, 6, 8.3, COL); }
        this.walk.push({ x: p[i], z: p[i + 1], tx: dx / L, tz: dz / L, u0: 0, u1: L, l0: -1.2, l1: 1.2, ya: 6.0, yb: 6.0 }); }
      for (const [ia, ib] of [[0, 2], [p.length - 2, p.length - 4]]) { const dx = p[ia] - p[ib], dz = p[ia + 1] - p[ib + 1], L = Math.hypot(dx, dz); if (L < 0.5 || p.length < 4) continue; const fx = p[ia] + dx / L * 14, fz = p[ia + 1] + dz / L * 14; if (!free(fx, fz)) continue;
        slab(S, p[ia], p[ia + 1], 6.0, fx, fz, 0.1, 2.4, 0.4, BRIDGE, C(0x6d6a65)); this.walk.push({ x: p[ia], z: p[ia + 1], tx: dx / L, tz: dz / L, u0: 0, u1: 14, l0: -1.2, l1: 1.2, ya: 6.0, yb: 0.1 }); } }
    T.claim('metro:rs:' + st.id, claims);
    const add = (So, mat, shadow) => { if (So.empty) return; const g = So.geometry(); this.geos.push(g); const m = new THREE.Mesh(g, mat); m.castShadow = !!shadow; m.receiveShadow = true; this.group.add(m); this.tris += So.tris; this.calls++; };
    this.mat = T.mat.clone(); this.mat.polygonOffset = true; this.mat.polygonOffsetFactor = -12; this.mat.polygonOffsetUnits = -24; add(S, this.mat, true);       // low things (platform tops, rails) must win the depth test against the city ground, which is pulled forward by polygon offset
     const tex = boardTexture(st); this.tex.push(tex); this.boardMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide, toneMapped: false }); add(N, this.boardMat);
    this.ox = ox; this.oz = oz; this.group.position.set(ox - T.origin.x, T.city.gy, oz - T.origin.z);
  }
  reposition() { this.group.position.set(this.ox - this.T.origin.x, this.T.city.gy, this.oz - this.T.origin.z); }
  dispose() { if (this.mat) this.mat.dispose(); for (const g of this.geos) g.dispose(); for (const t of this.tex) t.dispose(); if (this.boardMat) this.boardMat.dispose(); }
}

export class RailStations {
  constructor(T) {
    this.T = T; this.built = new Map(); this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }); this.fleet = [];
    for (const loco of [false, true]) { const m = new THREE.InstancedMesh(vehicleGeometry(loco), this.mat, loco ? 80 : 800); m.count = 0; m.frustumCulled = false; m.castShadow = true; T.group.add(m); this.fleet.push(m); }
    this.art = new TrainArt(); this.real = new Map(); this.dummy = new THREE.Matrix4(); this.vx = new THREE.Vector3(); this.vy = new THREE.Vector3(0, 1, 0); this.vz = new THREE.Vector3(); this.list = (T.data.rail && T.data.rail.stations || []).filter(s => s.bodies && s.bodies.length); this.stats = { stations: 0, tris: 0, calls: 0 };
  }
  /* the standing rakes of every built station into the two instanced meshes */
  /* where the rake of track r of kit k is at time t: the centre along the station axis, or null while it is away (cycle 300 s) */
  rakeU(k, r, t) {
    const { uc, uA, uB } = k.rakeSpan, c = (t + r.ph) % 300, ease = x => x * x * (3 - 2 * x); let f; if (c < 70) f = -1 + ease(c / 70); else if (c < 170) f = 0; else if (c < 240) f = ease((c - 170) / 70); else return null;
    return r.dir > 0 ? (f < 0 ? uc + (uc - uA) * f : uc + (uB - uc) * f) : (f < 0 ? uc - (uB - uc) * f : uc - (uc - uA) * f);
  }
  /* the two rake tracks nearest to the player get real vehicles (train_art.js, the India world's coaches and locomotives, built from train_consist.js); every other rake is instanced and simple */
  pickReal(px, pz) {
    const all = []; for (const k of this.built.values()) for (const r of k.rakeTracks) { const p = pt(k.rakeSpan.F0, k.rakeSpan.uc, r.v, 0); all.push({ k, r, d: Math.hypot(p[0] - px, p[2] - pz) }); } all.sort((a, b) => a.d - b.d);
    const want = new Set(all.slice(0, 2).filter(a => a.d < 450).map(a => a.r)); for (const [r, tr] of [...this.real]) if (!want.has(r)) { this.releaseReal(r, tr); }
    for (const a of all) if (want.has(a.r) && !this.real.has(a.r)) this.assembleReal(a.k, a.r);
  }
  assembleReal(k, r) {
    try {
      const T = this.T, styles = ['rajdhani', 'express', 'vande', 'passenger'], style = styles[Math.floor(hash(k.st.x | 0, Math.round(r.v)) * 4)], seed = (k.st.x | 0) * 31 + Math.round(r.v * 10), cs = consist(style, null, seed), dests = ['Mumbai', 'Kolkata', 'Jaipur', 'Lucknow', 'Chennai', 'Amritsar', 'Bhopal', 'Patna'], to = dests[seed % dests.length], real = { name: k.st.name.en + '-' + to + ' Express', n: String(12000 + (seed % 900)), stops: [['from'], ['to']] };
      const ctx = { cs, real: style === 'passenger' ? null : real, local: style === 'passenger' ? { name: 'PASSENGER' } : null, names: { from: k.st.name.en, to }, seed, loco: { no: locoNumber(seed, style), head: headcode(style, real) } }, vs = [], objs = [];
      cs.items.forEach((item, i) => { item.i = i; const v = this.art.build(item, ctx); T.group.add(v.obj); vs.push(v); objs.push(v.obj); });
      this.real.set(r, { vs, objs, total: vs.reduce((a, v) => a + v.length, 0), k });
    } catch (e) { console.warn('real rake failed, instanced instead', e); this.real.set(r, { vs: [], objs: [], total: 0, k, failed: true }); }
  }
  releaseReal(r, tr) { for (const o of tr.objs) this.T.group.remove(o); for (const v of tr.vs) v.dispose(); this.real.delete(r); }
  layoutRakes(t = this.T.t) {
    const T = this.T, ox = T.origin.x, oz = T.origin.z, n = [0, 0];
    for (const k of this.built.values()) { const { F0 } = k.rakeSpan; for (const r of k.rakeTracks) {
      const uC = this.rakeU(k, r, t), rl = this.real.get(r); if (rl && !rl.failed) { rl.objs.forEach(o => { o.visible = uC !== null; }); }
      if (uC === null) continue;
      if (rl && !rl.failed) { let back = 0; const dx = F0.tx * r.dir, dz = F0.tz * r.dir, head = uC + r.dir * rl.total / 2;
        rl.vs.forEach((v, i) => { const L = v.length, u = head - r.dir * (back + L / 2), p = pt(F0, u, r.v, 0); back += L; rl.objs[i].position.set(p[0] - ox, T.city.gy + 0.2, p[2] - oz); rl.objs[i].rotation.y = -Math.atan2(dz, dx); }); continue; }
      for (let j = 0; j < 11; j++) { const i = j === 0 ? 1 : 0, m = this.fleet[i]; if (n[i] >= m.instanceMatrix.count) continue; const u = uC + (r.dir > 0 ? 5 - j : j - 5) * 24.5, p = pt(F0, u, r.v, 0.2);
        this.vx.set(F0.tx, 0, F0.tz); this.vz.set(-F0.tz, 0, F0.tx); this.dummy.makeBasis(this.vx, this.vy, this.vz); this.dummy.setPosition(p[0] - ox, T.city.gy + 0.2, p[2] - oz); m.setMatrixAt(n[i]++, this.dummy); } } }
    this.fleet.forEach((m, i) => { m.count = n[i]; m.instanceMatrix.needsUpdate = true; });
  }
  update(px, pz) {
    const T = this.T, S = T.S; this.pickT = (this.pickT || 0) - 1; if (this.pickT <= 0) { this.pickT = 30; this.pickReal(px, pz); } this.layoutRakes(); let want = null, wd = Infinity;
    for (const st of this.list) { if (this.built.has(st.id)) continue; const d = Math.hypot(st.x - px, st.z - pz); if (d < RAD && d < wd && T.city.tiles.has(Math.floor(st.x / S) + '_' + Math.floor(st.z / S))) { wd = d; want = st; } }
    if (want) { const k = new RailKit(T, want); this.built.set(want.id, k); T.group.add(k.group); this.refresh(); this.layoutRakes(); }
    for (const [id, k] of [...this.built]) if (Math.hypot(k.st.x - px, k.st.z - pz) > KEEP) { for (const [r, tr] of [...this.real]) if (tr.k === k) this.releaseReal(r, tr); T.group.remove(k.group); k.dispose(); T.unclaim('metro:rs:' + id); this.built.delete(id); this.refresh(); this.layoutRakes(); }
  }
  reposition() { for (const k of this.built.values()) k.reposition(); this.layoutRakes(); }
  refresh() { let t = 0, c = 2; for (const k of this.built.values()) { t += k.tris; c += k.calls; } this.stats = { stations: this.built.size, tris: t, calls: c }; }
}

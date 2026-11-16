/* The railway you can see: track chunks, stations, rail bridges over the roads, level crossings with barriers, and trains (rules and the network are in rail.js, data in assets/india/rails.json).
   Everything is built near the player, one piece per frame, and dropped when far. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { classifyCrossings, trainSpan, crossingClosed, TRAIN, trainMotion, STYLES } from './rail.js';
import { styleOf, laneOffsets, TRACK_GAP } from './rail_timetable.js';
import { TrainArt } from './train_art.js';
import { consist, lengthOf, locoNumber, headcode } from './train_consist.js';

const CHUNK = 64, SEG = 4, RANGE = 750, STATION_LEN = 120, BRIDGE_R = 70, BRIDGE_H = 6.5, LEVEL_NEAR_STATION = 600;
const colourise = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), r = ((c >> 16) & 255) / 255, gg = ((c >> 8) & 255) / 255, b = (c & 255) / 255; for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const box = (parts, w, h, d, x, y, z, yaw, c) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(yaw); g.translate(x, y, z); parts.push(colourise(g, c)); };
const smooth = t => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

/* a train vehicle built along +x (length), width on z, from a livery (see STYLES in rail.js): shell, lower band, stripe, dark windows, roof, bogies, and on electric vehicles a pantograph */
function vehicleGeometry(kind, st) {
  const parts = [], L = kind === 'loco' ? st.locoLen : st.len, W = st.width, H = st.height, lo = 1.0, bodyH = H - 1.3;
  box(parts, L, 0.7, W - 0.4, 0, 0.95, 0, 0, 0x2a2a2e);                                                                   // underframe
  box(parts, L, bodyH, W, 0, 1.3 + bodyH / 2, 0, 0, kind === 'loco' ? st.loco : st.body);                                  // body
  box(parts, L + 0.02, 0.55, W + 0.02, 0, 1.3 + 0.4, 0, 0, kind === 'loco' ? st.locoBand : st.lower);                     // lower colour band
  box(parts, L + 0.02, 0.22, W + 0.02, 0, 2.15, 0, 0, st.stripe);                                                          // the stripe
  if (kind !== 'loco' && st.windows) { box(parts, L - 1.6, 0.8, W + 0.04, 0, 3.0, 0, 0, 0x14222f); for (let k = -3; k <= 3; k++) box(parts, 0.1, 0.8, W + 0.06, k * (L - 3) / 7, 3.0, 0, 0, st.body); }   // windows with their frames
  else if (kind === 'loco') { for (const k of [-1, 1]) box(parts, 1.6, 1.0, W + 0.04, k * (L / 2 - 1.6), 3.0, 0, 0, 0x14222f); }                  // cab windows
  box(parts, L - 0.5, 0.2, W - 0.6, 0, H + 0.18, 0, 0, st.roof);
  for (const k of [-1, 1]) box(parts, 3.2, 0.9, W - 0.7, k * (L / 2 - 3.2), 0.6, 0, 0, 0x1c1c1f);                         // bogies
  if (st.electric && (kind === 'loco' || st.motor)) { box(parts, 2.2, 0.12, 1.6, 0, H + 0.45, 0, 0, 0x2f343a); box(parts, 0.1, 0.9, 0.1, 0.9, H + 0.8, 0.5, 0, 0x2f343a); box(parts, 0.1, 0.9, 0.1, 0.9, H + 0.8, -0.5, 0, 0x2f343a); box(parts, 1.4, 0.06, 1.8, 0.2, H + 1.28, 0, 0, 0x111111); }   // the pantograph
  if (kind === 'loco' && st.fan) box(parts, 5.2, 0.6, W - 0.5, L / 2 - 3, H + 0.55, 0, 0, 0x3d4a5c);
  const g = mergeGeometries(parts); for (const p of parts) p.dispose(); return g;
}
function nameTexture(en, hi) {
  const W = 512, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#f2c230'; x.fillRect(0, 0, W, H); x.strokeStyle = '#111'; x.lineWidth = 6; x.strokeRect(5, 5, W - 10, H - 10);
  x.fillStyle = '#111'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 40px "Noto Sans Devanagari","Kohinoor Devanagari","Devanagari Sangam MN",system-ui,sans-serif'; x.fillText(hi || '', W / 2, 40); x.font = '700 46px system-ui,Arial,sans-serif'; x.fillText((en || '').toUpperCase(), W / 2, 92);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export class RailView {
  constructor({ scene, terrain, origin, network, grade, book = null, tracks = null, crossings = null, roads, cities, toWorld, toGame, names = {} }) {
    this.grade = grade; this.book = book; this.tracks = tracks || network.edges.map(() => 1); this.art = new TrainArt(); this.cityNames = Object.fromEntries(Object.entries(names).map(([k, v]) => [k, v.en])); this.scene = scene; this.t = terrain; this.origin = origin; this.net = network; this.lines = network.edges; this.toWorld = toWorld; this.toGame = toGame; this.names = names; this.chunks = new Map(); this.stationsBuilt = new Map(); this.time = 0;
    this.group = new THREE.Group(); scene.add(this.group); this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.15 });
    this.p = {}; this.q = {};
    /* crossings with the roads: a rail bridge over the road, or a level crossing near a station */
    this.crossings = crossings || classifyCrossings(this.lines, roads, cities, network.stations, LEVEL_NEAR_STATION);
    this.byEdge = new Map(); for (const c of this.crossings) { let l = this.byEdge.get(c.rail); if (!l) this.byEdge.set(c.rail, l = []); l.push(c); }
    const mum = cities.find(c => c.id === 'mumbai'), pick = (ln, i) => { const m = ln.at(ln.len / 2, {}); if (mum && Math.hypot(m.x - mum.x, m.z - mum.z) < 1500) return m.x > mum.x ? 'emu_cr' : 'emu_wr'; return ['express', 'express', 'rajdhani', 'express', 'freight', 'express'][i % 6]; };
    /* electrification: nearly all of the network has overhead wire, but quiet branch sections do not (diesel there); a line used by a Vande Bharat, Rajdhani or Shatabdi is always electrified */
    const eh = n => { let x = (n * 2654435761) >>> 0; x = (x ^ (x >>> 15)) >>> 0; return x / 4294967296; };
    this.elec = this.lines.map(ln => { const set = book ? book.byEdge.get(ln.edgeId) : null, busy = set ? set.size : 0, fast = set && [...set].some(k => /vande|rajdhani|shatabdi|duronto/i.test(book.trains[k].name)); return fast || busy >= 5 || eh(ln.edgeId + 11) > 0.25; });
    this.trains = this.lines.map((ln, li) => ({ ln, li })).filter(o => o.ln.len > 350).map(({ ln, li }, i) => {
      let style = pick(ln, i); const real = book && !style.startsWith('emu') ? book.identify(ln.edgeId, i) : null; if (real) style = styleOf(real); else if (!style.startsWith('emu')) style = i % 19 === 7 ? 'maintenance' : i % 3 === 0 ? 'freight' : 'passenger';
      const S = STYLES[style], seed = (i * 7919 + ln.edgeId * 31) >>> 0, cs = consist(style, real, seed, { diesel: !this.elec[li] }), total = cs.items.reduce((sum, it) => sum + lengthOf(it.kind), 0), nt = this.tracks[li], lanes = laneOffsets(nt), left = lanes.filter(o => o < -0.1), right = lanes.filter(o => o > 0.1), mid = lanes.filter(o => Math.abs(o) <= 0.1);
      const pickLane = (set, k) => set.length ? set[Math.floor(((seed >>> k) % 1000) / 1000 * set.length)] : (mid[0] || 0);
      return { real, local: style.startsWith('emu') ? (book ? book.locals.find(l => l.livery === style) || null : null) : null, line: ln, li, style, cs, seed, total, outLane: pickLane(left, 3), backLane: pickLane(right, 5), offset: (i * 977) % Math.max(ln.len, 1), meshes: [], vehicles: [], active: false, circles: [], dir: 1, head: 0, span: null, v: 0, mo: null };
    });
    this.barMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 }); this.redMat = new THREE.MeshStandardMaterial({ color: 0xc8231f, roughness: 0.6 }); this.nearEdge = new Map();
  }
  /* the height of the track at distance s along edge li: its own smooth profile (rail_grade.js), raised over a road where there is a rail bridge */
  trackY(li, s) { const ln = this.lines[li]; return (this.grade ? this.grade.yAt(li, s) : this.t.drive(...this.wxz(ln, s))) + this.lift(ln, s); }
  wxz(ln, s) { const a = ln.at(s, this.q), w = this.toWorld(a.x, a.z); return [w.x, w.z]; }
  lift() { return 0; }                                                                                              // the rise over a road is part of the track's own profile now (rail_grade.js), not an extra lift
  key(li, k) { return li * 1e6 + k; }
  build(li, k) {
    const ln = this.lines[li], s0 = k * CHUNK, s1 = Math.min(ln.len, s0 + CHUNK), W = this.toWorld, T = this.t, sea = T.seaLevel, parts = [], grp = new THREE.Group(), G = this.grade;
    const a0 = ln.at(s0, this.p), w0 = W(a0.x, a0.z), ox = w0.x, oz = w0.z, cross = this.byEdge.get(ln.id) || [], hash = (i) => { let x = (i * 374761393 + 668265263) | 0; x = (x ^ (x >>> 13)) * 1274126177 | 0; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
    const pt = (s, lat) => { const a = ln.at(s, this.q), w = W(a.x, a.z); return { x: w.x - a.tz * lat - ox, z: w.z + a.tx * lat - oz, tx: a.tx, tz: a.tz, wx: w.x, wz: w.z }; };
    for (let s = s0; s < s1 - 0.01; s += SEG) {
      const a = ln.at(s, this.p), b = ln.at(Math.min(s + SEG, ln.len), this.q), wa = W(a.x, a.z), wb = W(b.x, b.z); if (T.base(wa.x, wa.z) < sea + 0.4 || T.base(wb.x, wb.z) < sea + 0.4) continue;
      const ha = this.trackY(li, s), hb = this.trackY(li, Math.min(s + SEG, ln.len)), dx = wb.x - wa.x, dz = wb.z - wa.z, L = Math.hypot(dx, dz) || 1, yaw = -Math.atan2(dz, dx), cx = (wa.x + wb.x) / 2 - ox, cz = (wa.z + wb.z) / 2 - oz, y = (ha + hb) / 2, nx = -dz / L, nz = dx / L, sm = s + SEG / 2, ux = dx / L, uz = dz / L;
      const onBridge = cross.some(c => c.type === 'bridge' && Math.abs(sm - c.s) < 20 / Math.max(c.sinA, 0.5)), viaduct = G && G.viaduct(li, sm), lf = this.lift(ln, sm), hh = hash(li * 7919 + Math.floor(s / SEG));
      /* ballast: crushed stone in a trapezoid across all the tracks of the line, a coarser top, shoulder boulders; concrete sleepers; two steel rails per track */
      const nT = this.tracks[li], offs = laneOffsets(nT), wide = (nT - 1) * TRACK_GAP;
      box(parts, L + 0.15, 0.26, 4.6 + wide, cx, y + 0.02, cz, yaw, 0x6d6a63); box(parts, L + 0.15, 0.2, 3.5 + wide, cx, y + 0.2, cz, yaw, hh < 0.5 ? 0x7c7870 : 0x726e66);
      for (const off of offs) {
        const ox2 = cx + nx * off, oz2 = cz + nz * off; for (const side of [-1, 1]) box(parts, L + 0.1, 0.17, 0.09, ox2 + nx * 0.72 * side, y + 0.44, oz2 + nz * 0.72 * side, yaw, 0x8a7a70);
        for (let u = 0.5; u < L; u += 0.65) { const f = u - L / 2, sx = ox2 + ux * f, sz = oz2 + uz * f; box(parts, 0.26, 0.2, 2.6, sx, y + 0.36, sz, yaw, 0x9c9b94); }
      }
      for (let q = 0; q < 2; q++) if (hash(li * 31 + Math.floor(s / SEG) * 3 + q) < 0.55) { const side = q ? 1 : -1, off = 2.3 + wide / 2 + hash(Math.floor(s) + q) * 0.5, bs = 0.3 + hash(Math.floor(s) * 7 + q) * 0.45, g = new THREE.BoxGeometry(bs, bs * 0.7, bs * 1.15); g.rotateY(hash(Math.floor(s) * 5 + q) * 3); g.translate(cx + nx * off * side + ux * (hash(q + Math.floor(s)) - 0.5) * L, y + 0.18, cz + nz * off * side + uz * (hash(q + Math.floor(s)) - 0.5) * L); parts.push(colourise(g, hash(Math.floor(s) * 3 + q) < 0.5 ? 0x7d7a72 : 0x5d5a54)); }
      if (viaduct && !onBridge) {                                                                                                          // a viaduct of stone arches and piers over the valley
        box(parts, L + 0.1, 1.4, 5.6 + wide, cx, y - 0.7, cz, yaw, 0xb2a98f); for (const side of [-1, 1]) box(parts, L + 0.1, 0.9, 0.3, cx + nx * (2.7 + wide / 2) * side, y + 0.55, cz + nz * (2.7 + wide / 2) * side, yaw, 0xa89f86);
        if (Math.floor(sm / 12) !== Math.floor((sm - SEG) / 12)) { const ground = T.base(wa.x, wa.z), hgt = Math.max(1, y - 1.4 - ground); box(parts, 4.2, hgt, 5.2 + wide, cx, ground + hgt / 2, cz, yaw, 0xa39a82); box(parts, 4.6, 0.4, 5.6 + wide, cx, y - 1.6, cz, yaw, 0xb8af95); }
      }
      if (onBridge) { box(parts, L + 0.1, 1.0, 5.4 + wide, cx, y - 0.45, cz, yaw, 0x8c8f93); for (const side of [-1, 1]) box(parts, L + 0.1, 0.9, 0.18, cx + nx * (2.6 + wide / 2) * side, y + 0.55, cz + nz * (2.6 + wide / 2) * side, yaw, 0x6b7076); }
      else if (lf > 0.5) { const h = lf + 0.2; box(parts, L + 0.1, h, 6.2 + wide + lf * 0.9, cx, y - h / 2 - 0.3, cz, yaw, 0x8a7a5c); }
    }
    /* overhead electrification (25 kV AC): a mast every 50 m (on the left of a single track; on both outer sides with a cross girder on a multi-track line), a contact wire 5.6 m over each rail and a messenger wire above */
    if (this.elec[li]) { const nT = this.tracks[li], offs = laneOffsets(nT), half = (nT - 1) * TRACK_GAP / 2;
      for (let s = Math.ceil(s0 / 50) * 50; s < s1; s += 50) {
        const y = this.trackY(li, s), y2 = this.trackY(li, Math.min(s + 50, ln.len)); if (T.base(pt(s, 0).wx, pt(s, 0).wz) < sea + 0.4) continue;
        const sides = nT === 1 ? [-3.5] : [-(half + 3.1), half + 3.1];
        for (const lat of sides) { const m = pt(s, lat), yaw = -Math.atan2(m.tz, m.tx); box(parts, 0.28, 8.4, 0.28, m.x, y + 4.0, m.z, 0, 0x7f858c); if (nT === 1) { const arm = pt(s, -1.75); box(parts, 0.22, 0.22, 3.9, arm.x, y + 7.4, arm.z, yaw, 0x7f858c); box(parts, 0.3, 0.3, 0.3, arm.x, y + 5.9, arm.z, 0, 0xd9d3c0); } }
        if (nT > 1) { const mid = pt(s, 0), yaw = -Math.atan2(mid.tz, mid.tx); box(parts, 0.2, 0.3, 2 * (half + 3.1), mid.x, y + 8.0, mid.z, yaw, 0x7f858c); box(parts, 0.15, 0.15, 2 * (half + 3.1), mid.x, y + 7.2, mid.z, yaw, 0x7f858c); for (const off of offs) { const a2 = pt(s, off); box(parts, 0.1, 1.4, 0.1, a2.x, y + 6.6, a2.z, 0, 0x9aa0a6); } }
        for (const off of nT === 1 ? [0] : offs) { const c0 = pt(s, off), c1 = pt(Math.min(s + 50, ln.len), off), dx = c1.x - c0.x, dz = c1.z - c0.z, L = Math.hypot(dx, dz) || 1, wyaw = -Math.atan2(dz, dx);
          box(parts, L, 0.05, 0.05, (c0.x + c1.x) / 2, (y + y2) / 2 + 6.0, (c0.z + c1.z) / 2, wyaw, 0x2b2b2b); box(parts, L, 0.05, 0.05, (c0.x + c1.x) / 2, (y + y2) / 2 + 6.8, (c0.z + c1.z) / 2, wyaw, 0x3a3a3a); }
      } }
    if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts), this.mat); m.receiveShadow = true; m.castShadow = true; grp.add(m); for (const g of parts) g.dispose(); }
    const arms = [];
    for (const c of cross) if (c.s >= s0 && c.s < s1 && c.type === 'level') {
      const wc = W(c.x, c.z), h = this.trackY(li, c.s) - 0.4, rx = c.roadTx, rz = c.roadTz, wd = Math.atan2(rz, rx);
      for (const side of [-1, 1]) { const px = wc.x + rx * 7.5 * side - ox, pz = wc.z + rz * 7.5 * side - oz, piv = new THREE.Group(); piv.position.set(px, h + 1.05, pz); piv.rotation.y = -wd + (side < 0 ? Math.PI : 0);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 0.3), this.barMat); post.position.set(px, h + 0.55, pz); grp.add(post);
        const arm = new THREE.Group(); for (let i = 0; i < 6; i++) { const seg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.14), i % 2 ? this.redMat : this.barMat); seg.position.set(0.6 + i * 1.2, 0, 0); arm.add(seg); } arm.rotation.z = 1.3; piv.add(arm); grp.add(piv); arms.push({ arm, cs: c.s, side, line: ln }); }
    }
    grp.userData = { x: ox, z: oz, arms }; grp.position.set(ox - this.origin.x, 0, oz - this.origin.z); this.group.add(grp); return grp;
  }
  /* a station at a city: two platforms with a canopy, a building and name boards, along the track through the node */
  buildStation(n) {
    const W = this.toWorld, T = this.t, wn = W(n.x, n.z), e = this.net.adj.get(n.id)[0], y0 = this.grade ? this.grade.junctionY(wn.x, wn.z) : T.drive(wn.x, wn.z); if (!e) return null; const P = e.pts, fwd = e.a === n.id, i = fwd ? 0 : P.length / 2 - 1, j = fwd ? 1 : P.length / 2 - 2;
    const tx = (P[j * 2] - P[i * 2]), tz = (P[j * 2 + 1] - P[i * 2 + 1]), tl = Math.hypot(tx, tz) || 1, ux = tx / tl, uz = tz / tl, nx = -uz, nz = ux, yaw = -Math.atan2(uz, ux), parts = [], grp = new THREE.Group(), y = y0, textures = [];
    const nTs = Math.max(...this.net.adj.get(n.id).map(e2 => this.tracks[this.lines.indexOf(e2)] || 1)), halfT = (nTs - 1) * TRACK_GAP / 2, PL = halfT + 4.9;
    for (const side of [-1, 1]) {
      const c = { x: nx * side * PL, z: nz * side * PL }; box(parts, STATION_LEN, 1.0, 6, c.x, y + 0.5, c.z, yaw, 0xb8b3a6); box(parts, STATION_LEN, 0.2, 6.2, c.x, y + 1.05, c.z, yaw, 0xe3ded2);               // the platform and its edge
      box(parts, STATION_LEN * 0.8, 0.3, 5.4, c.x, y + 4.6, c.z, yaw, 0x3d5a80); for (let k = -4; k <= 4; k++) box(parts, 0.3, 3.5, 0.3, c.x + ux * k * STATION_LEN * 0.1, y + 2.85, c.z + uz * k * STATION_LEN * 0.1, 0, 0x555a60);    // the canopy and its posts
      box(parts, 34, 7, 9, nx * side * (halfT + 17) + ux * 20, y + 3.5, nz * side * (halfT + 17) + uz * 20, yaw, side > 0 ? 0xd8c7a0 : 0xc9b88d); box(parts, 34.4, 1.1, 9.4, nx * side * (halfT + 17) + ux * 20, y + 7.4, nz * side * (halfT + 17) + uz * 20, yaw, 0x8b3a2e);   // the station building
    }
    const nm = this.names[n.city] || { en: n.city, hi: '' }, tex = nameTexture(nm.en, nm.hi); textures.push(tex);
    for (const side of [-1, 1]) for (const k of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: tex })); m.position.set(nx * side * PL + ux * k * 30, y + 2.4, nz * side * PL + uz * k * 30); m.rotation.y = Math.atan2(-nx * side, -nz * side); grp.add(m); }   // name boards on the platforms, facing across the track
    if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts), this.mat); m.castShadow = true; m.receiveShadow = true; grp.add(m); for (const g of parts) g.dispose(); }
    grp.userData = { x: wn.x, z: wn.z, textures }; grp.position.set(wn.x - this.origin.x, 0, wn.z - this.origin.z); this.group.add(grp); return grp;
  }
  drop(g) { this.group.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material !== this.mat) { o.material.map.dispose(); o.material.dispose(); } }); }
  reposition() { for (const g of this.chunks.values()) g.position.set(g.userData.x - this.origin.x, 0, g.userData.z - this.origin.z); for (const g of this.stationsBuilt.values()) g.position.set(g.userData.x - this.origin.x, 0, g.userData.z - this.origin.z); }
  update(dt, px, pz) {
    this.time += dt; const pg = this.toGame(px, pz); let built = false;
    for (let li = 0; li < this.lines.length; li++) {
      const ln = this.lines[li]; if (!ln.bb) { let a = 1e18, b = -1e18, c = 1e18, d = -1e18; for (let i = 0; i < ln.pts.length; i += 2) { a = Math.min(a, ln.pts[i]); b = Math.max(b, ln.pts[i]); c = Math.min(c, ln.pts[i + 1]); d = Math.max(d, ln.pts[i + 1]); } ln.bb = [a, b, c, d]; }
      const R = RANGE + CHUNK * 2, far = pg.x < ln.bb[0] - R || pg.x > ln.bb[1] + R || pg.z < ln.bb[2] - R || pg.z > ln.bb[3] + R, near = far ? null : ln.nearest(pg.x, pg.z); this.nearEdge.set(li, near);
      if (!near || near.d > R) { if (this.edgeHas(li)) for (const [key, g] of this.chunks) if (Math.floor(key / 1e6) === li) { this.drop(g); this.chunks.delete(key); } continue; }
      const lo = Math.max(0, Math.floor((near.s - RANGE) / CHUNK)), hi = Math.floor((near.s + RANGE) / CHUNK);
      for (const [key, g] of this.chunks) if (Math.floor(key / 1e6) === li) { const k = key - li * 1e6; if (k < lo - 1 || k > hi + 1) { this.drop(g); this.chunks.delete(key); } }
      if (!built) for (let d = 0; d <= hi - lo && !built; d++) for (const k of d ? [Math.floor(near.s / CHUNK) + d, Math.floor(near.s / CHUNK) - d] : [Math.floor(near.s / CHUNK)]) { const key = this.key(li, k); if (k >= lo && k <= hi && k * CHUNK < ln.len && !this.chunks.has(key)) { this.chunks.set(key, this.build(li, k)); built = true; break; } }
    }
    for (const n of this.net.stations) { const d = Math.hypot(n.x - pg.x, n.z - pg.z); const has = this.stationsBuilt.has(n.id); if (d < 700 && !has && !built) { const g = this.buildStation(n); if (g) this.stationsBuilt.set(n.id, g); built = true; } else if (d > 1100 && has) { this.drop(this.stationsBuilt.get(n.id)); this.stationsBuilt.delete(n.id); } }
    this.updateTrains(dt, px, pz); this.updateBars();
  }
  edgeHas(li) { for (const key of this.chunks.keys()) if (Math.floor(key / 1e6) === li) return true; return false; }
  updateTrains(dt, px, pz) {
    const p = this.p;
    for (const tr of this.trains) {
      const near = this.nearEdge.get(tr.li); tr.circles.length = 0; const S = STYLES[tr.style];
      if (!near || near.d > 1100) { if (tr.active) this.release(tr); tr.span = null; tr.v = 0; continue; }
      const ln = tr.line, run = Math.max(ln.len - tr.total, 30), mo = trainMotion(run, this.time, S.vmax, S.accel, S.brake, S.dwell, tr.offset); tr.mo = mo; tr.v = mo.v; tr.dir = mo.dir; tr.head = mo.dir > 0 ? mo.s + tr.total : mo.s; tr.span = trainSpan(tr.head, mo.dir, tr.total);
      if (!tr.meshes.length) this.assemble(tr);
      tr.active = true; let back = 0; const lane = tr.dir > 0 ? tr.outLane : tr.backLane;                         // keep left: outbound on the left track (negative offsets), back on the right track
      for (let i = 0; i < tr.meshes.length; i++) {
        const m = tr.meshes[i], L = tr.vehicles[i].length, s = tr.head - tr.dir * (back + L / 2), a = ln.at(s, p), w = this.toWorld(a.x - a.tz * lane, a.z + a.tx * lane), y = this.trackY(tr.li, s) + 0.35; back += L;
        m.visible = true; m.position.set(w.x - this.origin.x, y, w.z - this.origin.z); m.rotation.y = -Math.atan2(a.tz * tr.dir, a.tx * tr.dir); const yw = -m.rotation.y, half = L / 2 - 1.5, f = Math.cos(yw), g = Math.sin(yw); for (let c = -2; c <= 2; c++) tr.circles.push({ x: w.x + f * c * half / 2, z: w.z + g * c * half / 2, r: 1.8, train: true });
      }
    }
  }
  /* make the vehicles of a train (its textures are drawn now) and free them when it goes out of range */
  assemble(tr) {
    const ctx = { cs: tr.cs, real: tr.real, local: tr.local, names: this.cityNames, seed: tr.seed, loco: { no: locoNumber(tr.seed, tr.style), head: headcode(tr.style, tr.real) } };
    tr.cs.items.forEach((item, i) => { item.i = i; const v = this.art.build(item, ctx); this.group.add(v.obj); tr.meshes.push(v.obj); tr.vehicles.push(v); });
  }
  release(tr) { for (const m of tr.meshes) this.group.remove(m); for (const v of tr.vehicles) v.dispose(); tr.meshes = []; tr.vehicles = []; tr.active = false; }
  updateBars() { for (const g of this.chunks.values()) for (const b of g.userData.arms) { const spans = this.trains.filter(t => t.line === b.line && t.span).map(t => t.span), closed = crossingClosed(b.cs, spans); b.arm.rotation.z += ((closed ? 0 : 1.3) - b.arm.rotation.z) * 0.1; } }
  near(x, z, r) { const out = this._out || (this._out = [[]]), l = out[0]; l.length = 0; for (const tr of this.trains) if (tr.active) for (const c of tr.circles) if (Math.abs(c.x - x) < r + 4 && Math.abs(c.z - z) < r + 4) l.push(c); return out; }
  dispose() { for (const g of this.chunks.values()) this.drop(g); this.chunks.clear(); for (const g of this.stationsBuilt.values()) this.drop(g); this.stationsBuilt.clear(); for (const t of this.trains) if (t.active) this.release(t); this.group.parent && this.group.parent.remove(this.group); this.mat.dispose(); }
}

/* Landmarks: stylised, recognisable models of famous places, built from boxes, lathes and arches (no model files), and put beside the road.
     gateway     Gateway of India, Mumbai          tajHotel   Taj Mahal Palace hotel, Mumbai      marine   Marine Drive's art-deco seafront, Mumbai
     indiaGate   India Gate, Delhi                 tajMahal   the Taj Mahal and its garden, Agra
   Each model is built facing +z with its origin on the ground at the middle of its footprint. A builder returns { group, circles, zone }:
   collision circles (local metres) and the ground to level around it. `Landmarks` places them along the road, levels the land under them,
   gives windows a night glow, and answers `near()` so vehicles hit them.
   Placement is searched per world (flat ground, and sea alongside where the place wants it), so any seed works, not just one. */
import * as THREE from 'three';

const PI = Math.PI;
let M = null, tex = null;

/* ---------- materials and the shared window texture ---------- */
function facadeTextures() {
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = 64; return c; };
  const a = mk(), b = mk(), ax = a.getContext('2d'), bx = b.getContext('2d');
  ax.fillStyle = '#ffffff'; ax.fillRect(0, 0, 64, 64); bx.fillStyle = '#000'; bx.fillRect(0, 0, 64, 64);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const x = 6 + i * 32, y = 8 + j * 30; ax.fillStyle = '#2b3a4a'; ax.fillRect(x, y, 20, 20); ax.fillStyle = 'rgba(255,255,255,.35)'; ax.fillRect(x, y, 20, 4);                // pane and frame
    ax.fillStyle = '#e9e4d8'; ax.fillRect(x - 3, y + 20, 26, 3);                                                                                                         // sill
    if (Math.random() < 0.72) { bx.fillStyle = Math.random() < 0.5 ? '#ffd890' : '#ffe9b8'; bx.fillRect(x + 1, y + 1, 18, 18); }                                          // a lit window at night
  }
  const t = c => { const x = new THREE.CanvasTexture(c); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 4; return x; };
  return { map: t(a), glow: t(b) };
}
function materials() {
  if (M) return M; tex = facadeTextures();
  const s = (hex, rough = 0.85, o = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0, envMapIntensity: 0.5, ...o });
  M = {
    basalt: s(0xd3b177), basaltDark: s(0xa68a5a), marble: s(0xf3efe6, 0.4, { envMapIntensity: 0.9 }), marbleDim: s(0xdad5c8, 0.5), sandstone: s(0xa14a35), sandstoneLight: s(0xc98264), indiaStone: s(0xc88b66), granite: s(0x76503f),
    dark: s(0x2c3238), gold: s(0xd9b24c, 0.3, { metalness: 0.6 }), copper: s(0x9c3f2a, 0.5, { metalness: 0.2 }), lawn: s(0x5f9a3c, 1), lawnLight: s(0x78b24d, 1), water: s(0x4f9fb8, 0.08, { metalness: 0.3, envMapIntensity: 1.4 }),
    concrete: s(0xb9b4aa, 0.95), path: s(0xd9c9a3, 1), cypress: s(0x2f5a2e, 1), lamp: new THREE.MeshBasicMaterial({ color: 0xfff0c0 }), roof: s(0x8a8378, 0.95),
    facade: new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.glow, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85, color: 0xf2ead8 })
  };
  return M;
}
/* facade materials in a given wall colour share the textures; one per colour */
const facadeCache = new Map();
function facade(hex) { if (!facadeCache.has(hex)) { const m = materials().facade.clone(); m.color.set(hex); facadeCache.set(hex, m); } return facadeCache.get(hex); }

/* ---------- little builders ---------- */
const mesh = (g, geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; };
const box = (g, mat, w, h, d, x, y, z) => mesh(g, new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z);              // y = underside
const cyl = (g, mat, rt, rb, h, x, y, z, seg = 16) => mesh(g, new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y + h / 2, z);
/* an onion or round dome from a profile (radius R at the base, height H) */
function dome(g, mat, R, H, x, y, z, onion = true) {
  const pts = onion ? [[0, 0], [0.92, 0], [1.0, 0.16], [0.98, 0.34], [0.84, 0.54], [0.58, 0.74], [0.28, 0.9], [0.1, 0.97], [0, 1]] : [[0, 0], [1, 0], [0.97, 0.26], [0.86, 0.52], [0.62, 0.78], [0.3, 0.95], [0, 1]];
  return mesh(g, new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r * R, h * H)), 20), mat, x, y, z);
}
/* a wall of width w and height h with an arched opening through it, depth d */
function archWall(g, mat, w, h, d, ow, oh, x, y, z) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h); sh.lineTo(-w / 2, h); sh.closePath();
  const hole = new THREE.Path(); hole.moveTo(-ow / 2, 0); hole.lineTo(-ow / 2, oh - ow / 2); hole.absarc(0, oh - ow / 2, ow / 2, PI, 0, true); hole.lineTo(ow / 2, 0); hole.closePath(); sh.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 14 }); geo.translate(0, 0, -d / 2); return mesh(g, geo, mat, x, y, z);
}
/* a solid pointed or round arch panel (the dark recess of an iwan) */
function archPanel(g, mat, w, h, d, x, y, z) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, PI, 0, true); sh.lineTo(w / 2, 0); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 12 }); geo.translate(0, 0, -d / 2); return mesh(g, geo, mat, x, y, z, false);
}
/* a facade block: windows tile across its sides, `bays` wide and `floors` tall */
function building(g, hex, w, h, d, x, y, z, bays, floors, roofHex) {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) { const face = Math.floor(i / 4); if (face === 4 || face === 5) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(w / 6)), uv.getY(i) * floors / 2); else if (face < 2) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(d / 6)), uv.getY(i) * floors / 2); else uv.setXY(i, 0.05, 0.05); }
  const m = facade(hex), roof = materials().roof; return mesh(g, geo, [m, m, roof, roof, m, m], x, y + h / 2, z);
}
const perimeter = (hw, hd, step, r, cx = 0, cz = 0) => { const out = []; for (let x = -hw; x <= hw + 0.1; x += step) { out.push({ x: cx + x, z: cz - hd, r }, { x: cx + x, z: cz + hd, r }); } for (let z = -hd + step; z < hd - 0.1; z += step) { out.push({ x: cx - hw, z: cz + z, r }, { x: cx + hw, z: cz + z, r }); } return out; };

/* ---------- the landmarks ---------- */
function gateway(off) {
  const m = materials(), g = new THREE.Group();
  box(g, m.basaltDark, 54, 1.0, 40, 0, 0, 4); box(g, m.basalt, 46, 1.0, 32, 0, 1, 4); box(g, m.basaltDark, 38, 1.0, 26, 0, 2, 3);              // steps and plaza
  const y0 = 3;
  archWall(g, m.basalt, 26, 26, 15, 15, 17, 0, y0, 0);                                                                                              // the great arch
  box(g, m.basalt, 27, 2.2, 16, 0, y0 + 26, 0); box(g, m.basaltDark, 28.4, 0.8, 17.2, 0, y0 + 28.2, 0);                                          // cornice
  for (const sx of [-1, 1]) { box(g, m.basalt, 8.5, 12, 15.6, sx * 17, y0, 0); for (let k = -1; k <= 1; k += 2) archPanel(g, m.basaltDark, 3.6, 8, 0.5, sx * 17, y0 + 1.5, k * 7.9); }      // side halls with recessed arches
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const tx = sx * 11.2, tz = sz * 5.4; cyl(g, m.basalt, 2.6, 2.9, 6.4, tx, y0 + 28.9, tz, 8); dome(g, m.basaltDark, 2.9, 2.4, tx, y0 + 35.3, tz, false); cyl(g, m.basaltDark, 0.12, 0.12, 1.6, tx, y0 + 37.5, tz, 6); }   // four turrets
  box(g, m.basaltDark, 15.4, 0.9, 15.6, 0, y0 + 16.4, 0);                                                                                           // band over the opening
  return { group: g, circles: [{ x: -11, z: 0, r: 7.5 }, { x: 11, z: 0, r: 7.5 }, { x: -17, z: 0, r: 8 }, { x: 17, z: 0, r: 8 }, { x: 0, z: -6.5, r: 7 }], zone: { r: 38, blend: 40 }, name: 'Gateway of India' };
}
function tajHotel(off) {
  const m = materials(), g = new THREE.Group(), red = 0xb06a4a, y0 = 1;
  box(g, m.concrete, 130, 1, 80, 0, 0, 6);
  building(g, red, 62, 32, 26, 0, y0, -6, 10, 8);                                                                                                    // main block
  for (const sx of [-1, 1]) { building(g, red, 26, 28, 34, sx * 44, y0, 2, 5, 7); dome(g, m.copper, 6, 9, sx * 44, y0 + 28, 2); box(g, m.marble, 28, 1.2, 36, sx * 44, y0 + 27, 2); }  // wings with their small domes
  building(g, red, 16, 40, 16, 0, y0 + 32, -6, 3, 9); box(g, m.marble, 18, 1.4, 18, 0, y0 + 40.6, -6);
  cyl(g, m.copper, 8.6, 8.6, 3, 0, y0 + 42, -6, 16); dome(g, m.copper, 9.6, 17, 0, y0 + 45, -6); cyl(g, m.gold, 0.25, 0.25, 6, 0, y0 + 62, -6, 6);        // the great rust-red dome
  for (const sx of [-1, 1]) { dome(g, m.copper, 3.4, 5, sx * 30, y0 + 32, 4, true); box(g, m.marbleDim, 8, 4, 8, sx * 30, y0 + 32, 4); dome(g, m.copper, 3.4, 5, sx * 30, y0 + 36, 4); }
  box(g, m.marble, 50, 1.2, 8, 0, y0 + 6, 9); for (let k = -4; k <= 4; k++) box(g, m.marble, 0.9, 6, 0.9, k * 6, y0, 12.6);                      // arcade in front
  return { group: g, circles: [{ x: -14, z: -6, r: 18 }, { x: 14, z: -6, r: 18 }, { x: -44, z: 2, r: 18 }, { x: 44, z: 2, r: 18 }, { x: 0, z: -6, r: 12 }], zone: { r: 78, blend: 50 }, name: 'Taj Mahal Palace' };
}
function indiaGate(off) {
  const m = materials(), g = new THREE.Group(), y0 = 2.4;
  const lawnEnd = Math.min(off - 8, 120), lz0 = -34, lc = (lawnEnd + lz0) / 2, ll = lawnEnd - lz0;
  box(g, m.lawn, 150, 0.15, ll, 0, 0, lc); box(g, m.path, 12, 0.2, ll, 0, 0, lc); for (const sx of [-1, 1]) box(g, m.lawnLight, 40, 0.2, ll - 6, sx * 38, 0, lc);                       // lawns and the avenue
  box(g, m.granite, 44, 0.8, 30, 0, 0, 0); box(g, m.granite, 40, 0.8, 26, 0, 0.8, 0); box(g, m.granite, 36, 0.8, 22, 0, 1.6, 0);                                                  // plinth
  archWall(g, m.indiaStone, 21, 42, 9.1, 11.5, 29, 0, y0, 0);                                                                                       // the arch, 42 m high
  box(g, m.sandstoneLight, 22.6, 2.2, 10.2, 0, y0 + 36, 0); box(g, m.indiaStone, 24, 1.2, 11.2, 0, y0 + 38.2, 0); box(g, m.granite, 11, 0.6, 9.4, 0, y0 + 41.4, 0);
  cyl(g, m.dark, 3.4, 2.4, 2.6, 0, y0 + 42, 0, 16);                                                                                                  // the bowl on top
  box(g, m.dark, 9.6, 3, 0.4, 0, y0 + 31.6, 4.7);                                                                                                    // inscription band
  for (const sx of [-1, 1]) box(g, m.indiaStone, 1.2, 8, 9.6, sx * 10.6, y0 + 26, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, m.dark, 0.35, 0.35, 5.5, sx * 3.2, 0.2, 24 + sz * 3.2 + 3, 6);                               // Amar Jawan Jyoti canopy posts
  box(g, m.dark, 8.4, 0.6, 8.4, 0, 5.7, 27.2); cyl(g, m.gold, 0.9, 0.9, 1, 0, 6.3, 27.2, 8);
  return { group: g, circles: [{ x: -9, z: 0, r: 7 }, { x: 9, z: 0, r: 7 }, { x: 0, z: -2, r: 6 }, { x: 0, z: 27, r: 4 }], zone: { r: 90, blend: 60 }, name: 'India Gate' };
}
function tajMahal(off) {
  const m = materials(), g = new THREE.Group();
  box(g, m.lawn, 150, 0.1, 270, 0, 0, 70); box(g, m.lawnLight, 128, 0.15, 250, 0, 0, 80);                                                              // the garden
  box(g, m.path, 5, 0.3, 238, 0, 0, 80); box(g, m.water, 11, 0.5, 232, 0, 0.1, 82);                                                                       // path and reflecting pool
  box(g, m.sandstoneLight, 150, 5, 150, 0, 0, 0); box(g, m.marble, 98, 7.2, 98, 0, 5, 0);                                                                // sandstone terrace and the marble plinth
  const top = 12.2;
  const body = cyl(g, m.marble, 30.3, 30.3, 28, 0, top, 0, 8); body.rotation.y = PI / 8;                                                                 // the mausoleum, an octagon
  for (const a of [0, 1, 2, 3]) {                                                                                                                        // four iwans
    const r = a * PI / 2, dx = Math.sin(r), dz = Math.cos(r), p = new THREE.Group(); p.rotation.y = r; g.add(p);
    box(p, m.marble, 24, 33, 5, 0, top, 28.2); archPanel(p, m.dark, 13.5, 24, 0.8, 0, top + 2.5, 31); archPanel(p, m.marbleDim, 17.5, 28, 0.5, 0, top + 1, 30.7);
    for (const sx of [-1, 1]) { archPanel(p, m.dark, 5.5, 12, 0.7, sx * 17.5, top + 4, 25.2); archPanel(p, m.dark, 5.5, 12, 0.7, sx * 17.5, top + 17, 25.2); }
  }
  cyl(g, m.marble, 12, 12.6, 6, 0, top + 28, 0, 20); dome(g, m.marble, 12, 21, 0, top + 34, 0); cyl(g, m.gold, 0.35, 0.35, 8, 0, top + 54, 0, 8);          // drum, the dome, the finial
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const cx = sx * 19, cz = sz * 19; for (const [px, pz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) cyl(g, m.marble, 0.4, 0.4, 5, cx + px, top + 28, cz + pz, 6); dome(g, m.marble, 3.4, 5.5, cx, top + 33, cz); }   // four chhatris
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {                                                                                                   // four minarets
    const cx = sx * 52, cz = sz * 52; box(g, m.marble, 9, 3, 9, cx, 5, cz);
    for (let k = 0; k < 3; k++) { cyl(g, m.marble, 3.1 - k * 0.2, 3.3 - k * 0.2, 11.5, cx, 8 + k * 11.5, cz, 12); cyl(g, m.marbleDim, 4.3, 4.3, 0.7, cx, 8 + (k + 1) * 11.5 - 0.7, cz, 12); }
    for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) cyl(g, m.marble, 0.35, 0.35, 4.6, cx + px, 42.5, cz + pz, 6); dome(g, m.marble, 3.2, 5, cx, 47, cz);
  }
  for (const sx of [-1, 1]) {                                                                                                                              // the mosque and its twin, in red sandstone
    const cx = sx * 98; box(g, m.sandstoneLight, 56, 3, 40, cx, 0, 0); box(g, m.sandstone, 38, 17, 54, cx, 3, 0); box(g, m.marbleDim, 40, 1, 56, cx, 20, 0);
    for (const dz of [-16, 0, 16]) { cyl(g, m.marble, 6.4, 6.4, 3, cx, 21, dz, 14); dome(g, m.marble, 6.4, 9, cx, 24, dz); }
    for (const dz of [-24, 24]) box(g, m.marbleDim, 3, 5, 3, cx - 14, 21, dz);
    archPanel(g, m.dark, 7, 12, 0.6, cx - sx * 19.2, 3, 0);
  }
  for (const sx of [-1, 1]) for (let k = 0; k < 11; k++) { const cx = sx * 8.5, cz = 36 + k * 19; cyl(g, m.cypress, 0.25, 0.3, 2, cx, 0, cz, 5); mesh(g, new THREE.ConeGeometry(1.7, 8.5, 7), m.cypress, cx, 6.2, cz); }   // cypress rows
  return { group: g, circles: [...perimeter(49, 49, 8, 5), { x: 0, z: 0, r: 31 }, ...[-1, 1].flatMap(sx => perimeter(19, 27, 9, 5, sx * 98, 0))], zone: { r: 200, blend: 80, cz: 85 }, name: 'Taj Mahal' };
}
const BUILDERS = { gateway, tajHotel, marine: () => ({ group: new THREE.Group(), circles: [], zone: { r: 45, blend: 30 }, name: 'Marine Drive' }), indiaGate, tajMahal };      // marine is built along the road (see Landmarks.marineStrip)
export const LANDMARK_KINDS = Object.keys(BUILDERS);

/* ---------- placing them in a world ---------- */
export class Landmarks {
  /* specs: [{ kind, s, off, sea }]  s = road distance to start the search at, off = metres from the road centre line to the landmark's origin,
     sea = true to prefer a place with sea alongside. */
  constructor(scene, terrain, road, config, origin, specs) {
    this.scene = scene; this.terrain = terrain; this.road = road; this.origin = origin; this.items = []; this.group = new THREE.Group(); scene.add(this.group); materials();
    for (let sp of specs || []) {
      if (sp.after) { const prev = this.items.find(i => i.kind === sp.after); if (prev) sp = { ...sp, s: prev.s + (sp.gap || 110) }; }                       // next to another landmark
      const it = this.place(sp); if (it) this.items.push(it);
    }
  }
  /* find a flat spot beside the road (and sea, if wanted) near s0; returns the placed landmark or null */
  place(sp) {
    const T = this.terrain, R = this.road, B = BUILDERS[sp.kind], sea = T.seaLevel, off = sp.off || 70, p = {}; let best = null;
    const zr = { gateway: 40, tajHotel: 80, marine: 45, indiaGate: 60, tajMahal: 150 }[sp.kind] || 40;
    const kMax = Math.min(50, Math.ceil((sp.range || 2200) / 45));
    for (let k = 0; k < kMax; k++) for (const dir of k === 0 ? [0] : [1, -1]) {
      const s = sp.s + dir * k * 45; if (s < R.sMin + 120 || s > R.sMax - 120) continue; R.at(s, p);
      for (const side of [1, -1]) {
        const nx = -p.tz * side, nz = p.tx * side, x = p.x + nx * off, z = p.z + nz * off; let lo = 1e9, hi = -1e9, wet = 0;
        for (let a = 0; a < 8; a++) for (const rr of [0, zr * 0.6, zr]) { const h = T.base(x + Math.cos(a * PI / 4) * rr, z + Math.sin(a * PI / 4) * rr); lo = Math.min(lo, h); hi = Math.max(hi, h); if (h < sea + 1) wet++; }
        if (wet > 0 || hi - lo > 14 || Math.abs(p.slope) > 0.05) continue;
        let seaward = 0; if (sp.sea) { const dirs = sp.sea === 'front' ? [-1] : [-1, 1]; for (const dr of dirs) for (const dd of (sp.sea === 'front' ? [10, 25, 45, 80, 130] : [70, 130, 200, 300, 420])) if (T.base(x + nx * dr * (dd + (dr < 0 ? off : 0)), z + nz * dr * (dd + (dr < 0 ? off : 0))) < sea - 0.5) seaward = 1; if (!seaward) continue; }
        const score = (hi - lo) + Math.abs(dir * k) * 0.02 - seaward * 5; if (!best || score < best.score) best = { score, s, side, x, z, nx, nz, y: p.y, th: p.th };
      }
      if (best && best.score < 3 && k > 1) break;
    }
    if (!best) { R.at(sp.s, p); const side = 1; best = { s: sp.s, side, x: p.x - p.tz * off, z: p.z + p.tx * off, nx: -p.tz, nz: p.tx, y: p.y }; }
    if (sp.kind === 'marine') return this.marineStrip(best, off);
    const b = B(off), yaw = Math.atan2(-best.nx, -best.nz), cs = Math.cos(yaw), sn = Math.sin(yaw);                                                              // local +z points back at the road
    b.group.rotation.y = yaw; const gy = Math.max(best.y - 0.35, sea + 0.6);
    if (b.zone.strip) for (let xs = -b.zone.strip / 2; xs <= b.zone.strip / 2; xs += 45) T.addZone(best.x + xs * cs, best.z - xs * sn, b.zone.r, gy, b.zone.blend);          // a long strip, levelled in steps so the sea is left alone
    else { const zc = b.zone.cz || 0; T.addZone(best.x + sn * zc, best.z + cs * zc, b.zone.r, gy, b.zone.blend); }
    const circles = b.circles.map(c => ({ x: best.x + c.x * cs + c.z * sn, z: best.z - c.x * sn + c.z * cs, r: c.r }));
    this.group.add(b.group); return { ...b, x: best.x, z: best.z, y: gy, yaw, circles, kind: sp.kind, s: best.s };
  }
  /* Marine Drive: art-deco apartment blocks following the road's curve on one side, a promenade, sea wall, lamps and tetrapods on the other */
  marineStrip(best, off) {
    const T = this.terrain, R = this.road, m = materials(), g = new THREE.Group(), cols = [0xf0e6cf, 0xcfe3d6, 0xf3d9c4, 0xe9e9e4, 0xd9e0ea, 0xf1e2b8, 0xe9cfd0], sea = T.seaLevel;
    const rng = (() => { let q = 11; return () => (q = (q * 16807) % 2147483647) / 2147483647; })(), p = {}, circles = [];
    const yaw = Math.atan2(-best.nx, -best.nz), cs = Math.cos(yaw), sn = Math.sin(yaw), gy = Math.max(best.y - 0.35, sea + 0.6);
    const local = (wx, wz) => ({ x: (wx - best.x) * cs - (wz - best.z) * sn, z: (wx - best.x) * sn + (wz - best.z) * cs });
    const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 6, 5), m.lamp, 80), tm = new THREE.Matrix4(); let nl = 0, i = 0, sv = best.s - 240;
    const side = best.side, put = (sd, lat, fn) => { R.at(sd, p); const nx = -p.tz * side, nz = p.tx * side, wx = p.x + nx * lat, wz = p.z + nz * lat, l = local(wx, wz), hd = Math.atan2(-nx, -nz) - yaw; fn(l, hd, p.y - 0.35 - gy, wx, wz); };
    while (sv < best.s + 240 && i < 40) {                                                                                                                    // apartment blocks
      const w = 26 + rng() * 14, h = 26 + Math.floor(rng() * 5) * 4.2, d = 20 + rng() * 5, hex = cols[i++ % cols.length], mid = sv + w / 2;
      put(mid, off, (l, hd, y, wx, wz) => { const b = new THREE.Group(); b.position.set(l.x, y, l.z); b.rotation.y = hd; g.add(b); building(b, hex, w, h, d, 0, 0, 0, Math.round(w / 6), Math.round(h / 3.2)); box(b, m.marbleDim, w * 0.55, 2.4, d * 0.6, 0, h, 0);
        circles.push({ x: wx, z: wz, r: Math.max(w, d) * 0.55 }); T.addZone(wx, wz, Math.max(w, d) * 0.7, gy + y, 25); });
      sv += w + 3 + rng() * 5;
    }
    for (let sd = best.s - 245; sd < best.s + 245; sd += 22) put(sd, -15, (l, hd, y, wx, wz) => {                                                              // promenade and sea wall across the road
      const b = new THREE.Group(); b.position.set(l.x, y, l.z); b.rotation.y = hd; g.add(b); box(b, m.concrete, 15, 0.5, 23, 0, 0, 0); box(b, m.concrete, 1.4, 1.0, 23, -8.2, 0, 0);
      T.addZone(wx, wz, 17, gy + y, 14);
    });
    for (let sd = best.s - 245; sd < best.s + 245; sd += 11) put(sd, -21, (l, hd, y) => { if (nl >= lamps.count) return; cyl(g, m.dark, 0.1, 0.14, 7, l.x, y + 0.5, l.z, 5); lamps.setMatrixAt(nl++, tm.makeTranslation(l.x, y + 7.9, l.z)); });       // the Queen's Necklace of lights
    lamps.count = nl; g.add(lamps);
    for (let k = 0; k < 44; k++) put(best.s - 240 + k * 11, -27 - (k % 2) * 3, (l, hd, y) => { const t = mesh(g, new THREE.BoxGeometry(2.2, 2.2, 2.2), m.concrete, l.x, y + 0.7, l.z, false); t.rotation.set(0.6 * (k % 3), k, 0.4); });   // tetrapods
    this.group.add(g); return { group: g, circles, zone: { r: 0, blend: 0 }, name: 'Marine Drive', x: best.x, z: best.z, y: gy, yaw, kind: 'marine', s: best.s };
  }
  /* keep each model at its world place relative to the render origin; windows glow at night */
  update(origin, night) {
    for (const it of this.items) it.group.position.set(it.x - origin.x, it.y, it.z - origin.z);
    const m = materials(); const v = night ? 1 : 0; for (const f of facadeCache.values()) f.emissiveIntensity += (v - f.emissiveIntensity) * 0.1; m.facade.emissiveIntensity += (v - m.facade.emissiveIntensity) * 0.1;
  }
  near(x, z, r) { const out = []; for (const it of this.items) { if (Math.hypot(x - it.x, z - it.z) > r + 320) continue; out.push(it.circles); } return out; }
  dispose() { this.scene.remove(this.group); this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  list() { return this.items.map(i => ({ kind: i.kind, name: i.name, x: i.x, z: i.z, s: i.s })); }
}

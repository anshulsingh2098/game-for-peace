/* Highway furniture meshes (docs/INDIA_MAP_PLAN.md section 8): turns highway_plan.js into guardrails, kilometre stones, green sign gantries with English and Hindi destinations and toll plazas.
   Same shape as District (pieces of road, built one per frame, nearest first, dropped when far; `near` gives obstacle circles for the vehicle physics). One merged mesh per piece plus one
   textured plane per sign. Only the 'nh6' road style has any; for other styles this object does nothing. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { planHighway, TOLL_LEN } from './highway_plan.js';

const colourise = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), r = ((c >> 16) & 255) / 255, gg = ((c >> 8) & 255) / 255, b = (c & 255) / 255; for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const box = (parts, w, h, d, x, y, z, yaw, c) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(yaw); g.translate(x, y, z); parts.push(colourise(g, c)); };

/* a green overhead sign: Hindi name large, English name below, distance on the right; text drawn on a canvas */
function signTexture({ en, hi, km, kind }) {
  const W = 1024, H = 340, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const green = kind === 'toll' ? '#12467a' : '#0b6b3a'; x.fillStyle = green; x.fillRect(0, 0, W, H); x.strokeStyle = '#fff'; x.lineWidth = 10; x.strokeRect(14, 14, W - 28, H - 28); x.fillStyle = '#fff'; x.textBaseline = 'middle';
  const font = (px, w = 700) => `${w} ${px}px "Noto Sans Devanagari", "Kohinoor Devanagari", "Devanagari Sangam MN", "Mukta", system-ui, sans-serif`;
  x.font = font(112); x.fillText(hi || '', 54, 98); x.font = font(104, 700).replace(/"Noto[^]*$/, 'system-ui, Arial, sans-serif'); x.fillText(en, 54, 232);
  if (km) { x.textAlign = 'right'; x.font = '700 120px system-ui, Arial, sans-serif'; x.fillText(km + ' km', W - 56, 100); x.font = '700 90px system-ui, Arial, sans-serif'; x.fillText('↑', W - 80, 235); x.textAlign = 'left'; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export class Highway {
  constructor(scene, road, terrain, style, origin, rows, { seed = 'highway', dests = [] } = {}) {
    this.road = road; this.style = style; this.origin = origin; this.len = rows * road.ds * 2; this.seed = seed; this.dests = dests; this.pieces = new Map(); this.range = 1400; this.on = style.id === 'nh6';
    this.furn = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25, envMapIntensity: 0.4 });
    this.group = new THREE.Group(); scene.add(this.group);
  }
  update(s) {
    if (!this.on) return; const r = this.road, L = this.len, lo = Math.floor(Math.max(r.sMin + L, s - this.range) / L), hi = Math.floor(Math.min(r.sMax - L, s + this.range) / L) - 1;
    for (const [k, p] of this.pieces) if (k < lo - 1 || k > hi + 1) { this.drop(p); this.pieces.delete(k); }
    const mid = Math.floor(s / L); for (let d = 0; d <= hi - lo + 1; d++) for (const k of d ? [mid + d, mid - d] : [mid]) if (k >= lo && k <= hi && !this.pieces.has(k)) { this.pieces.set(k, this.build(k)); return; }
  }
  build(k) {
    const r = this.road, s0 = k * this.len, s1 = s0 + this.len, o = r.at(s0, {}), ox = o.x, oz = o.z, plan = planHighway({ road: r, seed: this.seed, k, s0, s1, dests: this.dests, arcAt: r.guide ? s => r.arcAtS(s) : null }), parts = [], grp = new THREE.Group(), textures = [];
    for (const a of plan.rails) { const dx = a.x2 - a.x, dz = a.z2 - a.z, L = Math.hypot(dx, dz) || 1, yaw = -Math.atan2(dz, dx), my = (a.y + a.y2) / 2; box(parts, L, 0.3, 0.06, (a.x + a.x2) / 2 - ox, my + 0.72, (a.z + a.z2) / 2 - oz, yaw, 0xb9bec4); box(parts, 0.1, 0.8, 0.12, a.x - ox, a.y + 0.4, a.z - oz, yaw, 0x8c9096); }
    for (const a of plan.stones) { const yaw = -Math.atan2(a.tz, a.tx); box(parts, 0.18, 0.55, 0.36, a.x - ox, a.y + 0.27, a.z - oz, yaw, 0xf2f2ec); box(parts, 0.18, 0.14, 0.36, a.x - ox, a.y + 0.62, a.z - oz, yaw, 0xf2c230); }
    const sign = (sx, sy, sz, tx, tz, w, h, tex) => { const th = Math.atan2(tx, tz); for (const f of [0, Math.PI]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide })); m.rotation.y = th + f; m.position.set(sx + Math.sin(th + f) * 0.07, sy, sz + Math.cos(th + f) * 0.07); grp.add(m); } };
    for (const g of plan.gantries) {
      const lx = g.tz, lz = -g.tx, byaw = -Math.atan2(lz, lx), span = Math.abs(g.posts[2].lat - g.posts[0].lat);
      for (const q of g.posts) box(parts, 0.45, 7.2, 0.45, q.x - ox, q.y + 3.6, q.z - oz, 0, 0x8a8f96);
      box(parts, span, 0.5, 0.5, g.posts[1].x - ox, g.y + 6.7, g.posts[1].z - oz, byaw, 0x8a8f96);
      if (g.sign) { const t1 = signTexture(g.sign), t2 = signTexture(g.sign2 || g.sign); textures.push(t1, t2); for (const [side, tex] of [[0.5, t1], [-0.5, t2]]) sign(g.posts[1].x - ox + lx * span * side * 0.5, g.y + 5.15, g.posts[1].z - oz + lz * span * side * 0.5, g.tx, g.tz, 8, 2.6, tex); }
    }
    for (const t of plan.tolls) {
      const yaw = -Math.atan2(t.tz, t.tx), cx = t.x - ox, cz = t.z - oz, w = 2 * 15.4 + 2;
      box(parts, TOLL_LEN * 0.62, 0.7, w, cx, t.y + 6.1, cz, yaw, 0xf2c230); box(parts, TOLL_LEN * 0.62 + 0.1, 0.18, w + 0.1, cx, t.y + 5.7, cz, yaw, 0x2b2b2b);
      for (const q of t.islands) { box(parts, TOLL_LEN, 0.3, 1.2, q.x - ox, q.y + 0.15, q.z - oz, yaw, 0xcfcfc8); box(parts, 3.2, 2.6, 0.9, q.x - ox, q.y + 1.6, q.z - oz, yaw, 0xd7dde2); box(parts, 3.3, 0.25, 1.0, q.x - ox, q.y + 3, q.z - oz, yaw, 0x1f5fa8); box(parts, 0.55, 6, 0.55, q.x - ox, q.y + 3, q.z - oz, yaw, 0xe6e6e0); }
      const tex = signTexture({ en: 'TOLL PLAZA', hi: 'टोल प्लाज़ा', kind: 'toll' }); textures.push(tex); sign(cx, t.y + 7.4, cz, t.tx, t.tz, 9, 3, tex);
    }
    if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts), this.furn); m.castShadow = true; grp.add(m); for (const g of parts) g.dispose(); }
    grp.userData = { x: ox, z: oz, circles: plan.circles, textures }; grp.position.set(ox - this.origin.x, 0, oz - this.origin.z); this.group.add(grp); return grp;
  }
  near(x, z, r) {
    const out = this._out || (this._out = []); out.length = 0;
    for (const g of this.pieces.values()) { if (!g) continue; const c = g.userData.circles; if (!c.length) continue; const l = []; for (const q of c) if (Math.abs(q.x - x) < r + 4 && Math.abs(q.z - z) < r + 4) l.push(q); if (l.length) out.push(l); }
    return out;
  }
  drop(grp) { if (!grp) return; this.group.remove(grp); grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== this.furn) o.material.dispose(); }); for (const t of grp.userData.textures || []) t.dispose(); }
  reposition() { for (const g of this.pieces.values()) if (g) g.position.set(g.userData.x - this.origin.x, 0, g.userData.z - this.origin.z); }
  dispose() { for (const g of this.pieces.values()) this.drop(g); this.pieces.clear(); this.group.parent && this.group.parent.remove(this.group); this.furn.dispose(); }
}

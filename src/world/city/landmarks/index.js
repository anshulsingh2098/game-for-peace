/* Landmark models of the Delhi enclave (package D8). `CityLandmarks` reads the landmark list of the pack, finds the landmarks that have a builder in PLANS (plans_*.js), and for each one:
     - tells the tile mesher not to draw the plain extruded footprint (`skip`), since the model replaces it;
     - claims the ground of the model in the keep-out registry (the plan's `ground`, in addition to the footprint city init already claims);
     - builds the model when the player comes within LOAD metres (one per frame, in its local frame: origin on the ground at the middle of the footprint's oriented box, x along the data's yaw),
       merged to a few meshes: the base always drawn, the detail layer only within DETAIL metres; and drops it beyond UNLOAD;
     - answers the car physics with its collision circles (`circles`, called from CityWorld.near);
     - floats a name board (English over Hindi) above it and shows its info card from landmarks.json when the player is within a few tens of metres.
   Everything is placed from the data: position, rotation, footprint extents and height come from landmarks.json, never typed in by hand. Browser only. */
import * as THREE from 'three';
import { Kit, landmarkMaterials } from './kit.js';
import { PLANS } from './plans.js';

const LOAD = 1800, UNLOAD = 2100, DETAIL = 380, BOARD = 800, CARD_ON = 70, CARD_OFF = 110, SHADOW = 450;

export class CityLandmarks {
  constructor(city) { this.city = city; this.skip = new Set(); this.specs = new Map(); this.live = new Map(); this.group = new THREE.Group(); city.scene.add(this.group); this.mats = null; this.night = false; this.cardEl = null; this.cardId = null; this.stats = { live: 0, meshes: 0, tris: 0, built: 0, ms: 0 }; }
  /* the spec of a landmark for its plan: the oriented box of the footprint in world metres, the footprint in the box's own frame, the height */
  specOf(l) {
    const fp = l.footprint, yaw = l.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw); let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < fp.length; i += 2) { const u = fp[i] * c + fp[i + 1] * s, v = -fp[i] * s + fp[i + 1] * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, x = cu * c - cv * s, z = cu * s + cv * c, poly = []; for (let i = 0; i < fp.length; i += 2) poly.push([fp[i] * c + fp[i + 1] * s - cu, -fp[i] * s + fp[i + 1] * c - cv]);
    return { id: l.id, l, x, z, yaw, hx: (u1 - u0) / 2, hz: (v1 - v0) / 2, h: l.height || 0, poly, R: Math.hypot((u1 - u0) / 2, (v1 - v0) / 2) };
  }
  init() {
    const { landmarks } = this.city.pack, ko = this.city.ko; if (!landmarks) return this;
    for (const l of landmarks) { const plan = PLANS[l.id]; if (!plan || !l.footprint || l.footprint.length < 6) continue; const sp = this.specOf(l); sp.plan = plan; this.specs.set(l.id, sp); this.skip.add(l.id);
      const c = Math.cos(sp.yaw), s = Math.sin(sp.yaw); for (const g of plan.ground ? plan.ground(sp) : []) { const wx = sp.x + g.x * c - g.z * s, wz = sp.z + g.x * s + g.z * c; ko.add('city:lmx:' + l.id, 'landmark', g.r ? { t: 'circle', x: wx, z: wz, r: g.r } : { t: 'rect', x: wx, z: wz, hx: g.hx, hz: g.hz, yaw: sp.yaw + (g.yaw || 0) }); } }
    return this;
  }
  /* ---- build and drop ---- */
  build(sp) {
    const t0 = performance.now(); if (!this.mats) this.mats = landmarkMaterials(); this.mats.setNight(this.night);
    const k = new Kit(); sp.plan.build(k, sp); const grp = new THREE.Group(), meshes = [], boards = []; let tris = 0;
    for (const g of k.geometries()) { const m = new THREE.Mesh(g.geometry, this.mats[g.mat]); m.matrixAutoUpdate = false; m.userData.detail = g.detail; m.userData.mat = g.mat; m.receiveShadow = true; m.castShadow = !g.detail && g.mat !== 'lawn' && g.mat !== 'path' && g.mat !== 'water'; grp.add(m); meshes.push(m); tris += g.tris; }
    for (const sg of k.signs) { const m = this.signMesh(sg); grp.add(m); meshes.push(m); }
    const board = this.board(sp); grp.add(board); boards.push(board);
    const c = Math.cos(sp.yaw), s = Math.sin(sp.yaw), arr = new Float32Array(k.circles.length); for (let i = 0; i < k.circles.length; i += 3) { const lx = k.circles[i], lz = k.circles[i + 1]; arr[i] = sp.x + lx * c - lz * s; arr[i + 1] = sp.z + lx * s + lz * c; arr[i + 2] = k.circles[i + 2]; }
    grp.rotation.y = -sp.yaw; this.group.add(grp); const o = { sp, grp, meshes, board, circ: arr, tris, detail: true, ms: performance.now() - t0 }; this.live.set(sp.id, o); this.place(o);
    this.stats.built++; this.stats.ms = o.ms; this.refresh(); return o;
  }
  place(o) { o.grp.position.set(o.sp.x - this.city.origin.x, this.city.gy, o.sp.z - this.city.origin.z); }
  signMesh(sg) {
    const c = document.createElement('canvas'); c.width = 512; c.height = Math.max(64, Math.round(512 * sg.h / sg.w)); const g = c.getContext('2d'); g.fillStyle = sg.bg || '#1b2a3a'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = sg.fg || '#e8d9a8'; g.font = (sg.font || 'bold ') + Math.round(c.height * 0.62) + 'px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = Math.round(c.height * 0.62); while (g.measureText(sg.text).width > c.width * 0.92 && fs > 8) { fs -= 2; g.font = (sg.font || 'bold ') + fs + 'px Georgia, serif'; } g.fillText(sg.text, c.width / 2, c.height / 2 + 2);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; const m = new THREE.Mesh(new THREE.PlaneGeometry(sg.w, sg.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06 }));
    m.position.set(sg.x, sg.y, sg.z); m.rotation.y = sg.ry; m.userData.sign = true; return m;
  }
  /* the name board: English over Hindi, a sprite above the tallest part; larger for the bigger places */
  board(sp) {
    const l = sp.l, c = document.createElement('canvas'); c.width = 768; c.height = 192; const g = c.getContext('2d'); g.fillStyle = 'rgba(10,14,22,0.74)'; g.beginPath(); g.roundRect ? g.roundRect(4, 4, 760, 184, 26) : g.rect(4, 4, 760, 184); g.fill(); g.strokeStyle = 'rgba(232,201,120,0.9)'; g.lineWidth = 4; g.stroke(); g.textAlign = 'center'; g.textBaseline = 'middle';
    const fit = (t, px, y, col, bold) => { let f = px; g.font = (bold ? 'bold ' : '') + f + 'px system-ui, "Noto Sans Devanagari", "Kohinoor Devanagari", sans-serif'; while (g.measureText(t).width > 700 && f > 14) { f -= 2; g.font = (bold ? 'bold ' : '') + f + 'px system-ui, "Noto Sans Devanagari", "Kohinoor Devanagari", sans-serif'; } g.fillStyle = col; g.fillText(t, 384, y); };
    fit(l.name.en, 66, 66, '#ffffff', true); fit(l.name.hi || '', 62, 140, '#f0d98c', false);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const sc = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true, fog: false })); const w = Math.max(36, Math.min(80, 20 + sp.R * 0.5)); sc.scale.set(w, w / 4, 1);
    sc.position.set(0, (sp.plan.boardY ? sp.plan.boardY(sp) : Math.max(sp.h, 12)) + w / 8 + 6, 0); sc.userData.board = true; sc.renderOrder = 5; return sc;
  }
  drop(id) {
    const o = this.live.get(id); if (!o) return; this.group.remove(o.grp); for (const m of o.meshes) { m.geometry.dispose(); if (m.userData.sign) { m.material.map.dispose(); m.material.dispose(); } } o.board.material.map.dispose(); o.board.material.dispose(); this.live.delete(id); this.refresh();
  }
  refresh() { let m = 0, t = 0; for (const o of this.live.values()) { m += o.meshes.length; t += o.tris; } this.stats.live = this.live.size; this.stats.meshes = m; this.stats.tris = t; }
  /* ---- every frame ---- */
  update(px, pz) {
    let best = null, bd = Infinity;
    for (const sp of this.specs.values()) { const d = Math.hypot(px - sp.x, pz - sp.z) - sp.R, o = this.live.get(sp.id);
      if (o) { if (d > UNLOAD) { this.drop(sp.id); continue; } const near = d < DETAIL; if (near !== o.detail) { o.detail = near; for (const m of o.meshes) if (m.userData.detail) m.visible = near; } o.board.visible = d < BOARD; const sh = d < SHADOW; if (sh !== o.shadow) { o.shadow = sh; for (const m of o.meshes) if (!m.userData.detail && m.userData.mat !== 'lawn' && m.userData.mat !== 'path' && m.userData.mat !== 'water' && !m.userData.sign) m.castShadow = sh; } }
      else if (d < LOAD && d < bd) { bd = d; best = sp; } }
    if (best) this.build(best);
    this.updateCard(px, pz);
  }
  /* the distance from (px, pz) to the footprint's box of a landmark */
  distTo(sp, px, pz) { const c = Math.cos(sp.yaw), s = Math.sin(sp.yaw), dx = px - sp.x, dz = pz - sp.z, u = dx * c + dz * s, v = -dx * s + dz * c; return Math.hypot(Math.max(0, Math.abs(u) - sp.hx), Math.max(0, Math.abs(v) - sp.hz)); }
  /* ---- the info card ---- */
  updateCard(px, pz) {
    let near = null, nd = Infinity; for (const o of this.live.values()) { const d = this.distTo(o.sp, px, pz); if (d < nd) { nd = d; near = o.sp; } }
    const lim = this.cardId ? CARD_OFF : CARD_ON; if (!near || nd > lim) { if (this.cardId) { this.cardId = null; if (this.cardEl) this.cardEl.style.opacity = '0'; } return; }
    if (this.cardId === near.id) return; this.cardId = near.id; this.showCard(near.l);
  }
  showCard(l) {
    if (!this.cardEl) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:16px;top:84px;width:min(360px,calc(100vw - 32px));padding:12px 14px;border-radius:12px;background:rgba(12,18,28,0.82);color:#f2f2ee;font:13px/1.45 system-ui,sans-serif;z-index:40;pointer-events:none;opacity:0;transition:opacity .4s ease;box-shadow:0 4px 18px rgba(0,0,0,.35);border-left:4px solid #e8c978'; document.body.appendChild(d); this.cardEl = d; }
    const e = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), card = l.card || {};
    this.cardEl.innerHTML = '<div style="font-weight:700;font-size:15px">' + e(l.name.en) + (l.name.hi ? ' <span style="font-weight:400;color:#f0d98c">' + e(l.name.hi) + '</span>' : '') + '</div>' + '<div style="margin-top:6px">' + e(card.text || l.look || '') + '</div>' + (card.built || l.height ? '<div style="margin-top:6px;opacity:.7;font-size:12px">' + (card.built ? 'Built ' + e(card.built) : '') + (card.built && l.height ? ' · ' : '') + (l.height ? e(l.height) + ' m' : '') + '</div>' : '');
    this.cardEl.style.opacity = '1';
  }
  /* ---- physics, floating origin, night ---- */
  circles(x, z, r) {
    let out = null; for (const o of this.live.values()) { const sp = o.sp; if (Math.hypot(x - sp.x, z - sp.z) > sp.R + r + 30) continue; const a = o.circ; for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - x) < r + a[i + 2] && Math.abs(a[i + 1] - z) < r + a[i + 2]) (out || (out = [])).push({ x: a[i], z: a[i + 1], r: a[i + 2], y: this.city.gy, kerb: false }); }
    return out || [];
  }
  reposition() { for (const o of this.live.values()) this.place(o); }
  setNight(on) { this.night = on; if (this.mats) this.mats.setNight(on); }
  summary() { const s = this.stats; return 'landmarks   ' + s.live + ' of ' + this.specs.size + ' models live  ' + s.meshes + ' meshes  ' + (s.tris / 1000).toFixed(0) + 'k tris  last build ' + s.ms.toFixed(0) + ' ms'; }
}

/* The city's GPS (WORK_REMAINING 12.6): the equivalent of ui/gps.js inside a city enclave. `CityNav` is the logic (a destination, an A* route on the pack's street graph, turn steps, re-routing, arrival, a PathRoad for autodrive);
   `CityMap` is the screen: a round mini-map in the corner (heading up, streets by class, your route, landmark pins, the Metro lines when transit.json is loaded), a turn banner, and the full city map on P with pan, zoom,
   landmark search and tap-to-navigate. 2D canvas only. Coordinates are the pack's metres (x east, z south); yaw: the car's heading, forward = (cos yaw, sin yaw). */
import { CityRouter, PathRoad, EdgeIndex, routePolyline, polyLen } from '../world/city/citynav.js';

const el = (tag, css, parent, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text) e.textContent = text; if (parent) parent.appendChild(e); return e; };
const CLS = { motorway: { c: '#ffcf4d', w: 3.6, z: 0 }, trunk: { c: '#ffb347', w: 3.2, z: 0 }, primary: { c: '#ff9a3c', w: 2.6, z: 0 }, secondary: { c: '#e8eef5', w: 2.1, z: 1 }, tertiary: { c: '#c9d2dc', w: 1.6, z: 1 }, residential: { c: '#7d8896', w: 1.1, z: 2 }, service: { c: '#5c6672', w: 0.8, z: 3 } };
const ORDER = ['service', 'residential', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway'];

/* streets for drawing: the router's EdgeIndex limited to the classes of CLS (grouped by class, coarser classes only when zoomed out) */
class DrawIndex {
  constructor(G) { this.G = G; this.idx = new EdgeIndex(G, c => !!CLS[c]); }
  get done() { return this.idx.done; } step(n) { this.idx.step(n); }
  query(x0, z0, x1, z1, minZ = 3) { const G = this.G, out = {}; this.idx.each(x0, z0, x1, z1, e => { const name = G.classes[G.cls[e]]; if (CLS[name].z > minZ) return; (out[name] || (out[name] = [])).push(e); }); return out; }
}

/* ---------------------------------------------------------------- the logic */
export class CityNav {
  /* pack: CityPack (G, landmarks, M); geom(edgeId) -> flat points a -> b of the loaded street geometry or null; on(change) called when the route changes */
  constructor(pack, { geom = null, onChange = () => {}, toast = () => {} } = {}) {
    this.pack = pack; this.G = pack.G; this.router = new CityRouter(pack.G); this.geom = geom; this.onChange = onChange; this.toast = toast;
    this.dest = null; this.route = null; this.steps = []; this.stepArc = []; this.path = new PathRoad([]); this.s = 0; this.si = 0; this.off = 0; this.dirty = false; this.arrived = false; this.t = 0;
  }
  get active() { return !!this.dest && !!this.route; }
  /* route from (x, z) heading `yaw` to a place { x, z, name } (null clears) */
  setDest(x, z, to, yaw = 0) {
    this.dest = to; this.arrived = false; if (!to) { this.route = null; this.steps = []; this.path.set([]); this.onChange(); return null; }
    const r = this.router.plan(x, z, yaw, to.x, to.z, this.geom); if (!r) { this.dest = null; this.route = null; this.toast('No drivable route to ' + to.name); this.onChange(); return null; }
    this.route = r; this.steps = r.steps; this.build(x, z); this.toast('Route to ' + to.name + ': ' + (r.metres / 1000).toFixed(1) + ' km, about ' + Math.max(1, Math.round(r.seconds / 60)) + ' min'); this.onChange(); return r;
  }
  /* the polyline (the start and end pieces fixed, the middle from the loaded street geometry) and the arc position of each step: the share of the route's edge length at the step's node, spread over the middle part */
  build(x, z) {
    const r = this.route, G = this.G, mid = routePolyline(G, r, this.geom); r.mid = polyLen(mid); this.path.set(r.preP.concat(mid, r.postP)); const k = r.mid / (this.path.length || 1); void k;
    let tot = 0; for (const e of r.edges) tot += G.len[e]; const nodeAt = new Map(); r.nodes.forEach((n, i) => { if (!nodeAt.has(n)) nodeAt.set(n, i); }); const cumE = [0]; for (const e of r.edges) cumE.push(cumE[cumE.length - 1] + G.len[e]);
    const base = r.pre, span = r.mid; this.stepArc = this.steps.map((st, i) => i === 0 ? 0 : base + (cumE[nodeAt.has(st.at) ? nodeAt.get(st.at) : 0] || 0) / (tot || 1) * span); this.stepArc[this.stepArc.length - 1] = this.path.length;
    this.edgeArc = [0]; for (let i = 1; i < cumE.length; i++) this.edgeArc.push(base + cumE[i] / (tot || 1) * span);
    this.s = this.path.closestS(x, z, this.s > 0 && this.dirty ? this.s : 0); this.si = 0; this.dirty = false;
  }
  /* every frame (cheap): progress along the route, the current step, off-route re-routing, arrival */
  update(dt, x, z, yaw = 0) {
    if (!this.active || this.arrived) return; this.t += dt; const P = this.path; this.s = P.closestS(x, z, this.s); const o = P.at(this.s, this.q || (this.q = {})), off = Math.hypot(o.x - x, o.z - z);
    this.off = off > 60 ? this.off + dt : 0; if (this.off > 3) { this.off = 0; this.toast('Re-routing…'); this.setDest(x, z, this.dest, yaw); return; }
    if (this.dirty && this.t > 1) { this.t = 0; this.build(x, z); }
    let i = this.si; while (i + 1 < this.stepArc.length - 1 && this.stepArc[i + 1] <= this.s + 8) i++; this.si = i;
    if (P.remaining(this.s) < 30 && !this.arrived) { this.arrived = true; this.toast('You have arrived at ' + this.dest.name); setTimeout(() => { if (this.arrived) this.setDest(0, 0, null); }, 2500); }
  }
  /* the instruction to show: { text, dist (m to it), left (m of route left), mins } */
  banner() {
    if (!this.active) return null; const left = this.path.remaining(this.s), st = this.steps[Math.min(this.si + 1, this.steps.length - 1)], arc = this.stepArc[Math.min(this.si + 1, this.stepArc.length - 1)], dist = Math.max(0, arc - this.s);
    return { text: this.arrived ? 'You have arrived' : st.text, dist: this.arrived ? 0 : dist, left, mins: Math.max(1, Math.round(this.route.seconds * (left / (this.path.length || 1)) / 60)), dest: this.dest.name };
  }
  /* the car is stuck on the route (a building in a narrow lane): never route over this street again, and plan anew from here */
  blockHere(x, z, yaw = 0) {
    if (!this.active) return false; let i = 0; while (i + 1 < this.edgeArc.length - 1 && this.edgeArc[i + 1] <= this.s) i++; const e = this.route.edges[i]; if (e === undefined || this.router.banned.size > 60) return false;
    this.router.banned.add(e); this.setDest(x, z, this.dest, yaw); return true;
  }
  /* the streets changed (a tile loaded): re-resolve the route's geometry soon */
  refine() { if (this.active) this.dirty = true; }
}

/* ---------------------------------------------------------------- the screen */
export class CityMap {
  /* nav: CityNav; player() -> { x, z, yaw } or null; transit: parsed transit.json or null (may be set later with setTransit) */
  constructor({ nav, parent = document.body, player, size = 184, transit = null, onNavigate = null }) {
    this.nav = nav; this.pack = nav.pack; this.G = nav.G; this.player = player; this.size = size; this.t = 0; this.open = false; this.index = new DrawIndex(nav.G); this.transit = null; this.range = 650; this.view = { x: 0, z: 0, k: 0.12 }; this.onNavigate = onNavigate; this.pins = []; this.cities = []; this.cityTarget = null; this.cityTargetName = null;
    const L = this.pack.landmarks; this.places = L.map(l => ({ id: l.id, name: l.name.en, x: l.x, z: l.z, imp: l.importance || 1, type: l.type || '' }));
    for (const g of this.pack.M.gates) this.places.push({ id: g.id, name: 'Exit: ' + (g.ref ? g.ref + ' ' : '') + (g.name || g.id), x: g.x, z: g.z, imp: 1, type: 'gate', gate: true });
    this.mini = el('canvas', `position:fixed;left:12px;bottom:76px;width:${size}px;height:${size}px;border-radius:50%;border:2px solid rgba(255,255,255,.65);box-shadow:0 2px 10px rgba(0,0,0,.45);background:#1c2a26;z-index:20;cursor:pointer;touch-action:manipulation`, parent); this.mini.id = 'minimap'; this.mini.title = 'City map: click or press P';
    const dpr = Math.min(devicePixelRatio || 1, 2); this.dpr = dpr; this.mini.width = size * dpr; this.mini.height = size * dpr; this.mctx = this.mini.getContext('2d'); this.mini.addEventListener('click', () => this.toggle());
    this.banner = el('div', 'position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:21;display:none;min-width:240px;max-width:86vw;padding:8px 16px;border-radius:12px;background:rgba(10,16,28,.82);color:#fff;font:600 15px system-ui,sans-serif;text-align:center;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.4)', parent); this.banner.id = 'citybanner';
    this.bt = el('div', '', this.banner); this.bs = el('div', 'font:12px system-ui,sans-serif;opacity:.75;margin-top:2px', this.banner);
    this.panel = el('div', 'position:fixed;inset:0;z-index:70;display:none;background:rgba(8,12,18,.94);color:#fff;font:14px system-ui,sans-serif', parent); this.panel.id = 'gpsfull';
    this.bar = el('div', 'position:absolute;left:0;right:0;top:0;display:flex;gap:8px;align-items:center;padding:10px 14px;background:rgba(0,0,0,.4);flex-wrap:wrap;z-index:2', this.panel);
    this.title = el('div', 'font-weight:600;white-space:nowrap', this.bar, 'Delhi: tap a street or a pin to navigate');
    this.search = el('input', 'flex:1;min-width:140px;padding:8px 10px;border-radius:10px;border:0;background:#202c3e;color:#fff;font:inherit', this.bar); this.search.placeholder = 'Search a landmark (India Gate, Khan Market, airport…)'; this.search.type = 'search';
    const btn = (t, bg, f) => { const b = el('button', `padding:8px 12px;border-radius:10px;border:0;background:${bg};color:#fff;font:inherit;cursor:pointer`, this.bar, t); b.addEventListener('click', f); return b; };
    btn('Other cities', '#1f6f4a', () => this.showCities()); btn('Clear route', '#2a3a52', () => { this.nav.setDest(0, 0, null); this.cityTarget = null; this.cityTargetName = null; this.drawFull(); }); btn('Me', '#2a3a52', () => { const P = this.player(); if (P) { this.view.x = P.x; this.view.z = P.z; this.drawFull(); } }); btn('Close (P)', '#3b6df0', () => this.toggle(false));
    this.list = el('div', 'position:absolute;left:14px;top:58px;width:min(380px,calc(100% - 28px));max-height:46%;overflow:auto;background:rgba(16,24,38,.97);border-radius:10px;display:none;z-index:3;box-shadow:0 4px 16px rgba(0,0,0,.5)', this.panel);
    this.full = el('canvas', 'position:absolute;left:0;top:56px;width:100%;height:calc(100% - 56px);touch-action:none;cursor:grab', this.panel); this.fctx = this.full.getContext('2d');
    this.search.addEventListener('input', () => this.showList()); this.search.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const r = this.matches()[0]; if (r) this.choose(r); } if (e.key === 'Escape') { this.list.style.display = 'none'; } });
    this.bindPan();
    addEventListener('keydown', e => { if (e.code === 'KeyP' && !e.repeat && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) { if (document.body.hasAttribute('data-menu')) return; this.toggle(); } if (e.code === 'Escape' && this.open) this.toggle(false); });
    addEventListener('resize', () => { if (this.open) this.drawFull(); });
    if (transit) this.setTransit(transit); this.nav.onChange = () => { if (this.open) this.drawFull(); this.updateBanner(); };
  }
  setTransit(t) { this.transit = t; this.lines = (t && t.metro ? t.metro.lines : []).map(l => ({ id: l.id, colour: l.colour, paths: l.routes.map(r => r.path) })); this.stations = t && t.metro ? t.metro.stations.map(s => ({ x: s.x, z: s.z, name: s.name.en, lines: s.lines })) : []; }
  setVisible(v) { this.mini.style.display = v ? 'block' : 'none'; if (!v) this.banner.style.display = 'none'; }
  toggle(on = !this.open) { this.open = on; this.panel.style.display = on ? 'block' : 'none'; if (on) { const P = this.player(); if (P && !this.opened) { this.view.x = P.x; this.view.z = P.z; this.view.k = 0.1; this.opened = true; } this.drawFull(); this.search.value = ''; this.list.style.display = 'none'; } }
  matches() { const q = this.search.value.trim().toLowerCase(); if (!q) return []; const P = this.player() || { x: 0, z: 0 }; return this.places.filter(p => p.name.toLowerCase().includes(q)).sort((a, b) => (b.imp - a.imp) || (Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))).slice(0, 8); }
  showList() { const m = this.matches(); this.list.innerHTML = ''; this.list.style.display = m.length ? 'block' : 'none'; const P = this.player() || { x: 0, z: 0 }; for (const p of m) { const r = el('div', 'padding:9px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.07)', this.list, p.name); el('span', 'opacity:.6;margin-left:8px;font-size:12px', r, (Math.hypot(p.x - P.x, p.z - P.z) / 1000).toFixed(1) + ' km'); r.addEventListener('click', () => this.choose(p)); } }
  choose(p) { this.list.style.display = 'none'; this.view.x = p.x; this.view.z = p.z; this.go(p); }
  /* the roads out of the city (main.js gives each gate its label and the India road it joins) and the cities beyond: tap Other cities, pick one, and the route leads to the gate of the right highway; the choice goes with you into the India map */
  setGates(info) { for (const p of this.places) if (p.gate && info[p.id]) { const g = info[p.id]; p.name = g.label; p.toward = g.toward; p.road = g.road; } }
  setCities(list) { this.cities = list || []; }
  showCities() {
    this.list.innerHTML = ''; this.list.style.display = 'block'; el('div', 'padding:9px 12px;font-size:12px;opacity:.7;border-bottom:1px solid rgba(255,255,255,.12)', this.list, 'Cities you can drive to. The route leads to the exit road; drive through it and the India map continues the way.');
    if (!this.cities.length) el('div', 'padding:12px', this.list, 'The highway list is still loading, try again in a moment.');
    for (const c of this.cities) { const r = el('div', 'padding:9px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.07)', this.list, c.name); el('span', 'opacity:.6;margin-left:8px;font-size:12px', r, c.km + ' km · ' + c.label); r.addEventListener('click', () => this.goCity(c)); }
  }
  goCity(c) { const gp = this.places.find(p => p.id === c.gate); this.list.style.display = 'none'; if (!gp) return; this.view.x = gp.x; this.view.z = gp.z; this.go({ ...gp, cityId: c.id, cityName: c.name }); }
  go(p) { const P = this.player(); if (!P) return; this.cityTarget = p.cityId || (p.gate ? p.toward || null : null); this.cityTargetName = p.cityName || null; this.nav.setDest(P.x, P.z, { x: p.x, z: p.z, name: p.name }, P.yaw); if (this.onNavigate) this.onNavigate(p); this.drawFull(); }
  updateBanner() { const b = this.nav.banner(); if (!b || this.mini.style.display === 'none') { this.banner.style.display = 'none'; return; } this.banner.style.display = 'block'; const d = b.dist >= 1000 ? (b.dist / 1000).toFixed(1) + ' km' : Math.round(b.dist / 10) * 10 + ' m'; this.bt.textContent = (b.dist > 0 ? 'In ' + d + ': ' : '') + b.text; this.bs.textContent = b.dest + ' · ' + (b.left / 1000).toFixed(1) + ' km · ' + b.mins + ' min'; }
  update(now, dt = 0.016) {
    if (!this.index.done) this.index.step(25000);
    const P = this.player(); if (P) this.nav.update(dt, P.x, P.z, P.yaw);
    if (now - this.t < 120 || this.open || this.mini.style.display === 'none') return; this.t = now; this.drawMini(); this.updateBanner();
  }
  stroke(ctx, pts, map, from = 0) { ctx.beginPath(); for (let i = from; i < pts.length; i += 2) { const p = map(pts[i], pts[i + 1]); if (i > from) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); } ctx.stroke(); }
  /* draw the streets inside a world box with a map function, by class (one path per class), at a pixel scale k (px per m) */
  streets(c, box, map, k, scale = 1) {
    const q = this.index.query(box[0], box[1], box[2], box[3], k < 0.02 ? 0 : k < 0.07 ? 1 : k < 0.18 ? 2 : 3), G = this.G;
    for (const name of ORDER) { const list = q[name]; if (!list) continue; const s = CLS[name]; c.strokeStyle = s.c; c.lineWidth = Math.max(0.8, Math.min(s.w * scale, s.w * scale * Math.max(0.6, Math.min(2.2, k * 25)))); c.beginPath();
      for (const e of list) { const A = G.a[e], B = G.b[e], p = map(G.xz[A * 2], G.xz[A * 2 + 1]), q2 = map(G.xz[B * 2], G.xz[B * 2 + 1]); c.moveTo(p[0], p[1]); c.lineTo(q2[0], q2[1]); } c.stroke(); }
  }
  metro(c, map, k, scale = 1) {
    if (!this.lines) return; c.lineCap = 'round'; for (const l of this.lines) { c.strokeStyle = l.colour; c.lineWidth = Math.max(1.5, 3 * scale * Math.min(1.6, Math.max(0.7, k * 25))); c.globalAlpha = 0.85; for (const p of l.paths) this.stroke(c, p, map); } c.globalAlpha = 1;
    if (k > 0.05) { c.fillStyle = '#fff'; c.strokeStyle = '#222'; c.lineWidth = 1.2 * scale; for (const s of this.stations) { const p = map(s.x, s.z); c.beginPath(); c.arc(p[0], p[1], 3 * scale, 0, 7); c.fill(); c.stroke(); } }
  }
  drawRoute(c, map, w) { if (!this.nav.active) return; const P = this.nav.path, s = this.nav.s; c.strokeStyle = '#3b8cff'; c.lineWidth = w; c.globalAlpha = 0.92; c.lineJoin = 'round'; c.beginPath(); const o = P.at(s, {}); let p = map(o.x, o.z); c.moveTo(p[0], p[1]); for (let i = P.seg(s) + 1; i < P.pts.length / 2; i++) { p = map(P.pts[i * 2], P.pts[i * 2 + 1]); c.lineTo(p[0], p[1]); } c.stroke(); c.globalAlpha = 1; }
  arrow(c, size, yawRot) { c.save(); c.rotate(yawRot); c.fillStyle = '#ff3b30'; c.strokeStyle = '#fff'; c.lineWidth = size * 0.2; c.beginPath(); c.moveTo(0, -size); c.lineTo(size * 0.72, size * 0.78); c.lineTo(0, size * 0.4); c.lineTo(-size * 0.72, size * 0.78); c.closePath(); c.fill(); c.stroke(); c.restore(); }
  drawMini() {
    const c = this.mctx, S = this.size * this.dpr, R = S / 2, P = this.player(); if (!P) return; const k = R / this.range, d = this.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S, S); c.save(); c.beginPath(); c.arc(R, R, R - 1, 0, 7); c.clip(); c.fillStyle = '#1f2d29'; c.fillRect(0, 0, S, S);
    c.translate(R, R * 1.25); c.rotate(-Math.PI / 2 - P.yaw); const map = (x, z) => [(x - P.x) * k, (z - P.z) * k], rr = this.range * 1.6; c.lineCap = 'round'; c.lineJoin = 'round';
    this.streets(c, [P.x - rr, P.z - rr, P.x + rr, P.z + rr], map, k / d * 1.0, d * 1.15); this.metro(c, map, k / d, d); this.drawRoute(c, map, 5 * d);
    c.font = `${10 * d}px system-ui,sans-serif`; c.textAlign = 'center';
    for (const p of this.places) { if (p.gate || Math.abs(p.x - P.x) > rr || Math.abs(p.z - P.z) > rr) continue; const q = map(p.x, p.z); if (Math.hypot(q[0], q[1]) > R * 1.5) continue; const dst = this.nav.dest && this.nav.dest.name === p.name; c.fillStyle = dst ? '#3b8cff' : p.imp >= 4 ? '#ffd23f' : '#d6e4ff'; c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineWidth = 1.5 * d; c.beginPath(); c.moveTo(q[0], q[1] - 5 * d); c.lineTo(q[0] + 4 * d, q[1]); c.lineTo(q[0], q[1] + 5 * d); c.lineTo(q[0] - 4 * d, q[1]); c.closePath(); c.fill(); c.stroke();
      if (dst || p.imp >= 4) { c.save(); c.translate(q[0], q[1]); c.rotate(Math.PI / 2 + P.yaw); c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 3 * d; c.strokeText(p.name, 0, -8 * d); c.fillText(p.name, 0, -8 * d); c.restore(); } }
    if (this.nav.active) { const dd = this.nav.dest, q = map(dd.x, dd.z); if (Math.hypot(q[0], q[1]) > R * 0.92) { const a = Math.atan2(q[1], q[0]); c.fillStyle = '#3b8cff'; c.beginPath(); c.arc(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9 - R * 0.25 * 0, 4 * d, 0, 7); c.fill(); } }
    c.restore(); c.save(); c.translate(R, R * 1.25); this.arrow(c, 8 * d, 0); c.restore(); c.fillStyle = '#fff'; c.font = `700 ${11 * d}px system-ui,sans-serif`; c.textAlign = 'center'; c.fillText('N', R, 13 * d);
  }
  frame() { const w = this.full.clientWidth, h = this.full.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2); if (this.full.width !== Math.round(w * dpr) || this.full.height !== Math.round(h * dpr)) { this.full.width = Math.round(w * dpr); this.full.height = Math.round(h * dpr); } const v = this.view; return { w, h, dpr, k: v.k, map: (x, z) => [w / 2 + (x - v.x) * v.k, h / 2 + (z - v.z) * v.k], unmap: (px, py) => [v.x + (px - w / 2) / v.k, v.z + (py - h / 2) / v.k] }; }
  drawFull() {
    const F = this.frame(), c = this.fctx, P = this.player(), v = this.view; this.F = F; c.setTransform(F.dpr, 0, 0, F.dpr, 0, 0); c.fillStyle = '#17211f'; c.fillRect(0, 0, F.w, F.h); c.lineCap = 'round'; c.lineJoin = 'round';
    const a = F.unmap(0, 0), b = F.unmap(F.w, F.h); this.streets(c, [a[0], a[1], b[0], b[1]], F.map, v.k, 1); this.metro(c, F.map, v.k, 1); this.drawRoute(c, F.map, 5);
    c.font = '12px system-ui,sans-serif'; c.textAlign = 'left'; this.pins = [];
    for (const p of this.places) { if (p.x < a[0] || p.x > b[0] || p.z < a[1] || p.z > b[1]) continue; if (v.k < 0.02 && p.imp < 4) continue; if (v.k < 0.05 && p.imp < 3 && !p.gate) continue; const q = F.map(p.x, p.z), dst = this.nav.dest && this.nav.dest.name === p.name; this.pins.push({ p, q });
      c.fillStyle = dst ? '#3b8cff' : p.gate ? '#7bd88f' : p.imp >= 4 ? '#ffd23f' : '#d6e4ff'; c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(q[0], q[1] - 7); c.lineTo(q[0] + 5.5, q[1]); c.lineTo(q[0], q[1] + 7); c.lineTo(q[0] - 5.5, q[1]); c.closePath(); c.fill(); c.stroke();
      if (dst || p.gate || v.k > 0.045 || p.imp >= 4) { c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.85)'; c.fillStyle = '#fff'; c.strokeText(p.name, q[0] + 9, q[1] + 4); c.fillText(p.name, q[0] + 9, q[1] + 4); } }
    if (this.nav.active) { const q = F.map(this.nav.dest.x, this.nav.dest.z); c.fillStyle = '#3b8cff'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(q[0], q[1], 7, 0, 7); c.fill(); c.stroke(); }
    if (P) { const q = F.map(P.x, P.z); c.save(); c.translate(q[0], q[1]); this.arrow(c, 11, P.yaw + Math.PI / 2); c.restore(); }
    this.title.textContent = this.nav.active ? 'To ' + (this.cityTargetName ? this.cityTargetName + ' (' + this.nav.dest.name + ')' : this.nav.dest.name) + ': ' + (this.nav.path.remaining(this.nav.s) / 1000).toFixed(1) + ' km' : 'Delhi: tap a pin; green pins are the roads out to other cities';
  }
  bindPan() {
    const cv = this.full, v = this.view; let drag = null, pinch = null; const pts = new Map();
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY, vx: v.x, vz: v.z, moved: 0 }; if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch = { d: Math.hypot(p[0] - q[0], p[1] - q[1]), k: v.k }; } cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && pinch) { const [p, q] = [...pts.values()]; v.k = Math.max(0.004, Math.min(1.2, pinch.k * Math.hypot(p[0] - q[0], p[1] - q[1]) / pinch.d)); drag.moved = 99; this.drawFull(); return; }
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.hypot(dx, dy)); if (drag.moved > 5) { v.x = drag.vx - dx / v.k; v.z = drag.vz - dy / v.k; this.drawFull(); } });
    const up = e => { cv.style.cursor = 'grab'; const was = pts.has(e.pointerId); pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (was && drag && drag.moved <= 5 && pts.size === 0 && e.type === 'pointerup') this.onTap(e); if (!pts.size) drag = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), F = this.F || this.frame(), before = F.unmap(e.clientX - r.left, e.clientY - r.top); v.k = Math.max(0.004, Math.min(1.2, v.k * Math.exp(-e.deltaY * 0.0015))); v.x = before[0] - (e.clientX - r.left - F.w / 2) / v.k; v.z = before[1] - (e.clientY - r.top - F.h / 2) / v.k; this.drawFull(); }, { passive: false });
  }
  onTap(e) {
    const r = this.full.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 24; for (const { p, q } of this.pins) { const d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = p; } }
    if (best) { this.go(best); return; } const w = this.F.unmap(x, y), n = this.nav.router.nearest(w[0], w[1]); if (n < 0) return; const G = this.G; if (Math.hypot(G.xz[n * 2] - w[0], G.xz[n * 2 + 1] - w[1]) > 400) return;
    this.go({ x: G.xz[n * 2], z: G.xz[n * 2 + 1], name: 'Dropped pin' });
  }
}

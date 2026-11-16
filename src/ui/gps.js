/* GPS: a round mini-map in the corner (heading up, the roads around you, your route) and a full India map (key P, or tap the mini-map) where a tap on a city starts navigation to it.
   It draws the road network of the India world (RoadNetwork: roads as flat [x, z, ...] game metres, cities, rails), 2D canvas only, redrawn about 8 times a second.
   player() -> { x, z, yaw } in game metres (yaw: the car's heading, forward = (cos yaw, sin yaw)); nav() -> { dest, next } city ids; pick(cityId) starts navigation (null clears). */
const KIND_COLOUR = { gq: '#ffcf4d', ns: '#ff9a3c', ew: '#ff9a3c', nh: '#e8eef5' };
const el = (tag, css, parent, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text) e.textContent = text; if (parent) parent.appendChild(e); return e; };

export class Gps {
  constructor({ net, parent = document.body, player, nav, pick, names = {}, size = 184 }) {
    this.net = net; this.player = player; this.nav = nav; this.pick = pick; this.names = names; this.size = size; this.t = 0; this.open = false;
    const roads = [...net.roads.values()]; this.roads = roads; this.cities = [...net.cities.values()]; this.rails = (net.sk.rails || []);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const c of this.cities) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z); } this.bounds = { x0: x0 - 600, x1: x1 + 600, z0: z0 - 600, z1: z1 + 600 };
    this.mini = el('canvas', `position:fixed;left:12px;bottom:76px;width:${size}px;height:${size}px;border-radius:50%;border:2px solid rgba(255,255,255,.65);box-shadow:0 2px 10px rgba(0,0,0,.45);background:#1c2a26;z-index:20;cursor:pointer;touch-action:manipulation`, parent); this.mini.id = 'minimap'; this.mini.title = 'GPS map: click or press P for the whole India map';
    const dpr = Math.min(devicePixelRatio || 1, 2); this.mini.width = size * dpr; this.mini.height = size * dpr; this.dpr = dpr; this.mctx = this.mini.getContext('2d');
    this.mini.addEventListener('click', () => this.toggle());
    this.panel = el('div', 'position:fixed;inset:0;z-index:70;display:none;background:rgba(8,12,18,.92);color:#fff;font:14px system-ui,sans-serif', parent); this.panel.id = 'gpsfull';
    this.bar = el('div', 'position:absolute;left:0;right:0;top:0;display:flex;gap:10px;align-items:center;padding:10px 14px;background:rgba(0,0,0,.35)', this.panel);
    this.title = el('div', 'flex:1;font-weight:600', this.bar, 'India map: tap a city to navigate there');
    const b1 = el('button', 'padding:8px 14px;border-radius:10px;border:0;background:#2a3a52;color:#fff;font:inherit;cursor:pointer', this.bar, 'Clear route'); b1.addEventListener('click', () => { this.pick(null); this.drawFull(); });
    const b2 = el('button', 'padding:8px 14px;border-radius:10px;border:0;background:#3b6df0;color:#fff;font:inherit;cursor:pointer', this.bar, 'Close (P)'); b2.addEventListener('click', () => this.toggle(false));
    this.full = el('canvas', 'position:absolute;left:0;top:52px;width:100%;height:calc(100% - 52px)', this.panel); this.fctx = this.full.getContext('2d');
    this.full.addEventListener('click', e => this.onTap(e));
    addEventListener('keydown', e => { if (e.code === 'KeyP' && !e.repeat && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) { if (document.body.hasAttribute('data-menu')) return; this.toggle(); } if (e.code === 'Escape' && this.open) this.toggle(false); });
    addEventListener('resize', () => { if (this.open) this.drawFull(); });
  }
  toggle(on = !this.open) { this.open = on; this.panel.style.display = on ? 'block' : 'none'; if (on) this.drawFull(); }
  setVisible(v) { this.mini.style.display = v ? 'block' : 'none'; }
  /* the cities and road legs of the current route: from the next city to the destination */
  routeLegs() { const n = this.nav(); if (!n.dest || !n.next) return []; const r = n.next === n.dest ? { legs: [] } : this.net.route(n.next, n.dest); return r ? r.legs : []; }
  routePath() { const legs = this.routeLegs(), out = []; for (const l of legs) out.push(this.net.slice(l.road, l.s0, l.s1)); return out; }
  stroke(ctx, pts, map) { ctx.beginPath(); for (let i = 0; i < pts.length; i += 2) { const p = map(pts[i], pts[i + 1]); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); } ctx.stroke(); }
  update(now) { if (now - this.t < 120 || this.open || this.mini.style.display === 'none') return; this.t = now; this.drawMini(); }
  drawMini() {
    const c = this.mctx, S = this.size * this.dpr, R = S / 2, P = this.player(); if (!P) return; const range = 2200, k = R / range;                    // range: game metres from the car to the edge of the circle
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S, S); c.save(); c.beginPath(); c.arc(R, R, R - 1, 0, 7); c.clip(); c.fillStyle = '#1f2d29'; c.fillRect(0, 0, S, S);
    c.translate(R, R * 1.25); c.rotate(-Math.PI / 2 - P.yaw); const map = (x, z) => [(x - P.x) * k, (z - P.z) * k];                                   // heading up, the car a little below the centre
    c.lineCap = 'round'; c.lineJoin = 'round'; const near = (r) => true;
    c.setLineDash([]); c.strokeStyle = 'rgba(170,175,185,.55)'; c.lineWidth = 1.5 * this.dpr; c.setLineDash([6 * this.dpr, 5 * this.dpr]); for (const rl of this.rails) this.stroke(c, rl.pts, map); c.setLineDash([]);
    for (const r of this.roads) { c.strokeStyle = KIND_COLOUR[r.kind] || '#e8eef5'; c.lineWidth = (r.kind === 'gq' ? 3.4 : 2.4) * this.dpr; this.stroke(c, r.pts, map); }
    const path = this.routePath(); if (path.length) { c.strokeStyle = '#3b8cff'; c.lineWidth = 5 * this.dpr; c.globalAlpha = 0.9; for (const p of path) this.stroke(c, p, map); c.globalAlpha = 1; }
    c.font = `${11 * this.dpr}px system-ui,sans-serif`; c.textAlign = 'center'; const n = this.nav();
    for (const ct of this.cities) { const p = map(ct.x, ct.z); if (Math.abs(p[0]) > R * 1.4 || Math.abs(p[1]) > R * 1.4) continue; c.fillStyle = ct.id === n.dest ? '#3b8cff' : '#fff'; c.beginPath(); c.arc(p[0], p[1], (ct.id === n.dest ? 5 : ct.tier === 'metro' ? 4 : 2.6) * this.dpr, 0, 7); c.fill();
      if (ct.tier === 'metro' || ct.id === n.dest || ct.id === n.next) { c.save(); c.translate(p[0], p[1]); c.rotate(Math.PI / 2 + P.yaw); c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 3 * this.dpr; c.strokeText(ct.name, 0, -7 * this.dpr); c.fillText(ct.name, 0, -7 * this.dpr); c.restore(); } }
    c.restore(); c.save(); c.translate(R, R * 1.25); c.fillStyle = '#ff3b30'; c.strokeStyle = '#fff'; c.lineWidth = 2 * this.dpr; c.beginPath(); c.moveTo(0, -9 * this.dpr); c.lineTo(6.5 * this.dpr, 7 * this.dpr); c.lineTo(0, 3.5 * this.dpr); c.lineTo(-6.5 * this.dpr, 7 * this.dpr); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.fillStyle = '#fff'; c.font = `700 ${11 * this.dpr}px system-ui,sans-serif`; c.textAlign = 'center'; c.fillText('N', R, 13 * this.dpr);
  }
  frame() { const w = this.full.clientWidth, h = this.full.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2); if (this.full.width !== w * dpr || this.full.height !== h * dpr) { this.full.width = w * dpr; this.full.height = h * dpr; } const b = this.bounds, s = Math.min(w / (b.x1 - b.x0), h / (b.z1 - b.z0)), ox = (w - (b.x1 - b.x0) * s) / 2, oz = (h - (b.z1 - b.z0) * s) / 2; return { w, h, dpr, s, ox, oz, map: (x, z) => [ox + (x - b.x0) * s, oz + (z - b.z0) * s] }; }
  drawFull() {
    const F = this.frame(), c = this.fctx, P = this.player(), n = this.nav(); this.F = F; c.setTransform(F.dpr, 0, 0, F.dpr, 0, 0); c.clearRect(0, 0, F.w, F.h); c.lineCap = 'round'; c.lineJoin = 'round';
    c.setLineDash([5, 4]); c.strokeStyle = 'rgba(150,155,165,.7)'; c.lineWidth = 1.2; for (const rl of this.rails) this.stroke(c, rl.pts, F.map); c.setLineDash([]);
    for (const r of this.roads) { c.strokeStyle = KIND_COLOUR[r.kind] || '#e8eef5'; c.lineWidth = r.kind === 'gq' ? 2.6 : 1.8; this.stroke(c, r.pts, F.map); }
    const path = this.routePath(); if (path.length) { c.strokeStyle = '#3b8cff'; c.lineWidth = 5; c.globalAlpha = 0.9; for (const p of path) this.stroke(c, p, F.map); c.globalAlpha = 1; }
    c.font = '12px system-ui,sans-serif'; c.textAlign = 'left';
    for (const ct of this.cities) { const p = F.map(ct.x, ct.z), big = ct.tier === 'metro', hot = ct.id === n.dest; c.fillStyle = hot ? '#3b8cff' : '#fff'; c.beginPath(); c.arc(p[0], p[1], hot ? 6 : big ? 4.2 : 2.6, 0, 7); c.fill();
      if (big || hot || ct.tier === 'major') { c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 3; c.strokeText(ct.name, p[0] + 7, p[1] + 4); c.fillStyle = hot ? '#9cc4ff' : '#fff'; c.fillText(ct.name, p[0] + 7, p[1] + 4); } }
    if (P) { const p = F.map(P.x, P.z); c.save(); c.translate(p[0], p[1]); c.rotate(P.yaw + Math.PI / 2); c.fillStyle = '#ff3b30'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 9); c.lineTo(0, 5); c.lineTo(-8, 9); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    this.title.textContent = n.dest ? 'Navigating to ' + (this.names[n.dest] || n.dest) + '  (tap another city to change)' : 'India map: tap a city to navigate there';
  }
  onTap(e) {
    const r = this.full.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, F = this.F || this.frame(); let best = null, bd = 28;
    for (const ct of this.cities) { const p = F.map(ct.x, ct.z), d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = ct; } }
    if (best) { this.pick(best.id); this.drawFull(); }
  }
}

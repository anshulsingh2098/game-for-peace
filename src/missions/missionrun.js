/* The mission runtime (docs/MISSION_PLAN.md, M2): the wallet pill, the Missions card, the objective line, the pins (the route line to the car, then to the market, and a beacon on each), the parked target car and the sale.
   The rules are in missions.js (pure, self-tested); this file is the DOM and the world. main.js gives it getters (so it never holds a stale car or city) and calls update(dt) every frame; carjack() in main.js calls taken() when the car taken is the target.
   Browser only. */
import * as THREE from 'three';
import { CASES, MARKET, Run, caseById, rupees } from './missions.js';

const el = (tag, css, parent, text) => { const e = document.createElement(tag); e.style.cssText = css || ''; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; };
const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

export function createMissions(ctx) {
  const { S, save, toast } = ctx; let run = null, target = null, spot = null, market = null, saleT = 0, cardOpen = false;
  const wallet = el('div', 'position:fixed;left:12px;top:46px;z-index:20;padding:4px 12px;border-radius:999px;background:rgba(8,12,20,.75);font:600 14px system-ui,sans-serif;color:#9fe39f;pointer-events:none', document.body);
  const hud = el('div', 'position:fixed;left:50%;top:92px;transform:translateX(-50%);z-index:20;display:none;max-width:90vw;text-align:center;background:rgba(8,12,20,.78);border-radius:14px;padding:6px 16px;font:14px system-ui,sans-serif;color:#fff;pointer-events:none', document.body);
  const card = el('div', 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:60;display:none;width:min(440px,92vw);max-height:80vh;overflow:auto;padding:14px 16px;border-radius:14px;background:rgba(14,18,26,.96);border:1px solid #2a303a;color:#e8ecf2;font:14px system-ui,sans-serif', document.body);
  const group = new THREE.Group(); ctx.scene.add(group);
  const beacon = color => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 60, 14, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; group.add(m); return m; };
  const bTarget = beacon(0xffa53a), bMarket = beacon(0x4ad0ff);
  const showCash = () => { wallet.textContent = rupees(S.cash || 0); }; showCash();
  const done = id => (S.missions && S.missions[id] && S.missions[id].done) || 0;
  const pos = () => { const p = ctx.phys(), f = ctx.foot(); return ctx.mode() === 'foot' && f ? { x: f.x, z: f.z } : p ? { x: p.x, z: p.z } : null; };
  const landmark = id => { const c = ctx.city(); const l = c && c.pack && c.pack.lm && c.pack.lm.get(id); return l ? { x: l.x, z: l.z, name: l.name && l.name.en || id } : null; };
  const route = (to, name) => { const nav = ctx.cityNav(), p = ctx.phys(), q = pos(); if (nav && q && to) nav.setDest(q.x, q.z, { x: to.x, z: to.z, name }, p ? p.yaw : 0); };
  const clearRoute = () => { const nav = ctx.cityNav(); if (nav) nav.setDest(0, 0, null); };
  function cleanup() {
    bTarget.visible = bMarket.visible = false; hud.style.display = 'none'; const T = ctx.city() && ctx.city().traffic; if (T && T.parked) T.parked.delete('mission'); target = null; spot = null; market = null; clearRoute();
  }
  function end(msg) { cleanup(); if (msg) toast(msg); run = null; }

  function renderCard() {
    card.innerHTML = ''; el('div', 'font:700 17px system-ui,sans-serif;margin-bottom:2px', card, 'Missions'); el('div', 'color:#8a93a3;margin-bottom:10px', card, 'Repo Man: a dealer in Karol Bagh pays cash for premium cars recovered from people who stopped paying their loans.');
    if (run && run.active) { el('div', 'padding:8px 10px;border-radius:10px;background:#1b1f26;margin-bottom:8px', card, 'In progress: ' + run.c.title + ' (' + mmss(run.left) + ' left)'); const b = el('button', 'padding:8px 12px;border-radius:10px;border:0;background:#7a2a2a;color:#fff;cursor:pointer;font:inherit', card, 'Cancel the mission'); b.addEventListener('click', () => { end('Mission cancelled'); toggle(false); }); }
    else for (const c of CASES) {
      const box = el('div', 'padding:9px 10px;border-radius:10px;background:#1b1f26;margin-bottom:8px', card); el('div', 'font-weight:700', box, c.title + (done(c.id) ? '  (done ' + done(c.id) + 'x)' : ''));
      el('div', 'color:#aeb7c6;margin:3px 0 6px', box, c.story); el('div', 'color:#9fe39f;margin-bottom:6px', box, 'Pays up to ' + rupees(c.base * 1.2) + '  ·  par ' + mmss(c.par) + ', limit ' + mmss(c.limit));
      const b = el('button', 'padding:7px 12px;border-radius:10px;border:0;background:#2f7d4f;color:#fff;cursor:pointer;font:inherit', box, 'Start'); b.addEventListener('click', () => { start(c.id); toggle(false); });
    }
    const x = el('button', 'margin-top:4px;padding:7px 12px;border-radius:10px;border:0;background:#2a3a52;color:#fff;cursor:pointer;font:inherit', card, 'Close'); x.addEventListener('click', () => toggle(false));
  }
  function toggle(on) { cardOpen = on === undefined ? !cardOpen : on; card.style.display = cardOpen ? 'block' : 'none'; if (cardOpen) renderCard(); }

  function start(id) {
    const c = caseById(id); if (!c || (run && run.active)) return; if (!ctx.city() || !ctx.city().traffic) { toast('Missions run in the Delhi city'); return; }
    const a = landmark(c.at), m = landmark(MARKET.id); if (!a || !m) { toast('This mission is not available here'); return; }
    run = new Run(c); spot = a; market = m; target = null; route(spot, 'Find ' + c.title); toast('Mission: ' + c.title);
  }
  /* the target is parked in the street nearest to its landmark once the streets there are loaded (the player is within 260 m) */
  function spawnTarget() {
    const city = ctx.city(), T = city && city.traffic; if (!T || !T.modelsDone) return; const st = city.nearestStreet(spot.x, spot.z); if (!st || st.d > 70) return;
    const phi = Math.atan2(-Math.cos(st.yaw), -Math.sin(st.yaw)), fx = Math.cos(phi), fz = Math.sin(phi);        // st.yaw is the player's heading convention; the traffic's is the direction of travel in the ground plane
    target = { x: st.x + fz * 3.4, z: st.z - fx * 3.4, yaw: phi, kind: run.c.kind, paint: parseInt(run.c.paint.slice(1), 16), mission: run.c.id, mdl: true };
    T.parked.set('mission', [target]); spot = { x: target.x, z: target.z, name: spot.name };
  }
  /* called by carjack() in main.js after the car is taken from traffic: car.mission is the id of the case if it was the target */
  function taken(missionId, prevVehicle) {
    if (!run || run.phase !== 'find' || run.c.id !== missionId) return false; run.taken(prevVehicle); target = null; bTarget.visible = false;
    toast('Got it. Take it to the ' + MARKET.name); return true;
  }
  function afterTaken() { route(market, MARKET.name); }

  function update(dt) {
    if (!run) return; const q = pos(), city = ctx.city(); if (!q || !city) return; run.tick(dt);
    if (run.phase === 'failed') { end(run.why); return; }
    const gy = city.gy || 0, o = ctx.grid().origin;
    if (run.phase === 'find') {
      const d = Math.hypot(q.x - spot.x, q.z - spot.z); if (!target && d < 260) spawnTarget();
      if (target) { bTarget.visible = true; bTarget.position.set(target.x - o.x, gy + 30, target.z - o.z); }
      hud.textContent = 'Repo: find ' + run.c.title + ' near ' + spot.name + ' · ' + Math.round(d) + ' m · ' + mmss(run.left); hud.style.display = 'block';
    } else if (run.phase === 'deliver') {
      if (!run.routed) { run.routed = true; afterTaken(); }
      const d = Math.hypot(q.x - market.x, q.z - market.z); bMarket.visible = true; bMarket.position.set(market.x - o.x, gy + 30, market.z - o.z);
      hud.textContent = 'Repo: take it to the ' + MARKET.name + ' · ' + Math.round(d) + ' m · ' + mmss(run.left); hud.style.display = 'block';
      const D = ctx.view().damage, p = ctx.phys(); if (D && D.burntOut) { end('The car burnt out: the dealer will not buy scrap. Case closed.'); return; }
      const inCar = ctx.mode() === 'drive' && ctx.vehicleId() === run.c.car;
      if (inCar && d < 24 && p && Math.abs(p.u) < 3.5) { saleT += dt; hud.textContent = 'Selling... stay in the yard'; if (saleT > 1.6) sell(); } else saleT = 0;
    }
  }
  async function sell() {
    const D = ctx.view().damage, r = run.sell({ state: D ? D.state : 'ok', frame: D ? D.frame : 1 }); if (!r) return; saleT = 0;
    S.cash = (S.cash || 0) + r.total; S.missions = S.missions || {}; const old = S.missions[run.c.id] || { done: 0, best: 0 }; S.missions[run.c.id] = { done: old.done + 1, best: Math.max(old.best, r.total) }; save(); showCash();
    toast('Sold for ' + rupees(r.total) + ' (' + r.label + (r.bonus > 0 ? ', quick job +' + Math.round(r.bonus * 100) + ' percent' : '') + ')'); const prev = run.prev; cleanup(); const m = run; run = null;
    setTimeout(async () => { try { if (prev !== null && prev !== undefined && ctx.mode() === 'drive') { await ctx.setVehicle(prev); toast('The dealer drives it into the yard. Next case?'); } } catch (e) { /* stay in the car */ } }, 1800); void m;
  }
  document.getElementById('missBtn')?.addEventListener('click', () => toggle());
  return { update, taken, toggle, start, get run() { return run; }, showCash, get active() { return !!(run && run.active); } };
}

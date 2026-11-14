/* Traffic simulation (Master Plan N5): cars that drive the generated road in its own lanes. Pure (no three.js), so the self-test can run it headless.
   Rules:
   - Lanes come from the road style (`laneOffsets`): one lane each way on narrow styles, two each way on wide ones. Traffic keeps to the right of its direction of travel
     (`drive: 'right'`) or the left (`'left'`, India), so oncoming cars pass on the other side of the centre line.
   - A deterministic car may appear in every `SLOT` metres of road inside a window around the player (`ahead` / `behind`), from the world seed and the slot number, so the same
     place always has the same traffic. Nothing appears within `minSpawnGap` metres of the player, a car never appears on top of another, and the number is capped by the mode.
   - Each car follows the road centre line at its lane offset (so it sits on the same surface the road mesh and the physics use, bridges and tunnels included), drives at the
     style's speed limit, slows for bends, keeps a safe gap behind the car in front of it and behind the player, stops for an obstacle in its lane, and is removed if it is
     stuck for 12 s or leaves the window or the generated road. No path search: just the road lookup `road.at(s)`, a few times per car per frame.
   - `circles(x, z, r)` gives the player's physics the cars as obstacle circles ({ x, z, r }, the same contract trees and rails use).
   Usage: const sim = new TrafficSim(road, { seed, mode: 'low', drive: 'right' }); each frame sim.update(dt, { x, z, s, u, yaw }); read sim.cars. */
import { alea } from '../core/rng.js';
import { Pool } from '../core/runtime.js';

export const MODES = { off: 0, low: 6, mid: 12, high: 20 };                    // cars alive inside the window at most, per level
export const MODE_ALIAS = { light: 'low', busy: 'high' };                      // older saved names
export const SLOT = 60, LIMIT = { 'two-lane': 22, highway: 30, boulevard: 16, dirt: 12, gravel: 14 };       // slot length (m); speed limit by road style (m/s)
export const KINDS = { sedan: { len: 4.4, w: 1.85 }, van: { len: 5.2, w: 2.0 }, truck: { len: 8.5, w: 2.5 } };
/* the mix of vehicles: name, length, width, height (m) and how common it is. This plain set is used until the real models load (traffic_pack.json replaces it, see traffic.js). */
export const DEFAULT_KINDS = [{ name: 'sedan', len: 4.4, w: 1.85, h: 1.45, weight: 70 }, { name: 'van', len: 5.2, w: 2.0, h: 2.0, weight: 18 }, { name: 'truck', len: 8.5, w: 2.5, h: 3.0, weight: 12 }];
/* the cars are a bounded reusable pool (core/runtime.js Pool): a car that is removed is reset completely and handed back, so spawning and removing cars does not allocate */
const blankCar = () => ({ handle: 0, id: 0, s: 0, dir: 1, lane: 0, kind: '', len: 0, w: 0, h: 0, v0: 0, speed: 0, colour: 0, lat: 0, stuck: 0, bump: 0, born: 0, bornDist: 0, x: 0, z: 0, y: 0, yaw: 0, brake: 0 });
const resetCar = c => { for (const k in c) c[k] = typeof c[k] === 'string' ? '' : 0; c.dir = 1; };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const pickKind = (list, t) => { for (const k of list) { t -= k.weight; if (t < 0) return k; } return list[0]; };       // the vehicle a random number t (0..total weight) lands on

/* lane centre offsets (m from the centre line, on one side) for a road style */
export function laneOffsets(style) {
  const n = style.half >= 8 ? 2 : 1, w = style.half / n, out = []; for (let k = 0; k < n; k++) out.push(w * (k + 0.5)); return out;
}

export class TrafficSim {
  constructor(road, { seed = 'traffic', mode = 'low', drive = 'right', ahead = 700, behind = 350, minSpawnGap = 150 } = {}) {
    this.road = road; this.seed = String(seed); this.drive = drive; this.ahead = ahead; this.behind = behind; this.minSpawnGap = minSpawnGap;
    this.lanes = laneOffsets(road.style); this.limit = LIMIT[road.style.id] || 20; this.kinds = DEFAULT_KINDS; this.cars = []; this.pool = new Pool({ cap: MODES.high + 8, make: blankCar, reset: resetCar }); this.seen = new Set(); this.nextId = 1; this._p = {}; this._q = {}; this.time = 0;
    this.setMode(mode);
  }
  setKinds(list) { this.kinds = list && list.length ? list : DEFAULT_KINDS; this.clearCars(); }
  clearCars() { this.pool.releaseAll(); this.cars.length = 0; this.seen.clear(); }
  setMode(mode) { mode = MODE_ALIAS[mode] || mode; this.mode = MODES[mode] !== undefined ? mode : 'off'; this.cap = MODES[this.mode]; this.clearCars(); }
  /* the signed offset from the centre line along the left normal for a car going `dir` (+1 with increasing s) in lane index k */
  lateral(dir, k) { const off = this.lanes[k], right = this.drive === 'right'; return (dir > 0) === right ? -off : off; }

  update(dt, player) {
    this.time += dt; if (!this.cap) return;
    const ps = player.s, lo = Math.floor((ps - this.behind) / SLOT), hi = Math.floor((ps + this.ahead) / SLOT);
    for (const k of this.seen) if (k < lo || k > hi) this.seen.delete(k);                                       // slots that left the window may fill again if the player comes back
    const keep = []; for (const c of this.cars) { if (c.s > ps - this.behind - SLOT && c.s < ps + this.ahead + SLOT && c.s > this.road.sMin + 30 && c.s < this.road.sMax - 30 && c.stuck < 12) keep.push(c); else this.pool.release(c.handle); } this.cars = keep;
    const chance = Math.min(1, this.cap / (((this.ahead + this.behind) / SLOT) * 0.9));
    for (let k = lo; k <= hi; k++) if (!this.seen.has(k)) { this.seen.add(k); this.spawn(k, chance, player); }
    this.step(dt, player);
  }

  spawn(slot, chance, player) {
    if (this.cars.length >= this.cap) return;
    const R = alea(this.seed, 'traffic', slot); if (R() > chance) return;
    const s = (slot + 0.15 + R() * 0.7) * SLOT, dir = R() < 0.5 ? 1 : -1, lane = Math.floor(R() * this.lanes.length), kt = R() * this.kinds.reduce((a, k) => a + k.weight, 0), K = pickKind(this.kinds, kt), kind = K.name, v0 = this.limit * (0.7 + R() * 0.28) * (K.len > 6.5 ? 0.8 : 1), colour = Math.floor(R() * 64);
    if (s < this.road.sMin + 60 || s > this.road.sMax - 60 || Math.abs(s - player.s) < this.minSpawnGap) return;
    for (const c of this.cars) if (c.dir === dir && c.lane === lane && Math.abs(c.s - s) < 30) return;          // never on top of another car
    const got = this.pool.acquire(); if (!got) return; const car = got.obj;                                       // the pool is full: no spawn (the cap is lower than the pool, so this is a safety net)
    Object.assign(car, { handle: got.handle, id: this.nextId++, s, dir, lane, kind, len: K.len, w: K.w, h: K.h || 1.5, v0, speed: v0 * 0.9, colour, lat: this.lateral(dir, lane), stuck: 0, bump: 0, born: this.time, bornDist: Math.abs(s - player.s), x: 0, z: 0, y: 0, yaw: 0, brake: 0 });
    this.place(car); this.cars.push(car);
  }

  /* world position and heading of a car from its road distance and lane */
  place(c) {
    const p = this.road.at(c.s, this._p); c.x = p.x - p.tz * c.lat; c.z = p.z + p.tx * c.lat; c.y = p.y; c.yaw = c.dir > 0 ? p.th : p.th + Math.PI;
  }
  /* the sharpest bend within 90 m ahead sets a speed limit, like the autodrive */
  curveSpeed(c) {
    const R = this.road, p = this._q; let v = 99;
    for (let d = 15; d <= 90; d += 15) { R.at(c.s + c.dir * d, p); const t0 = p.th; R.at(c.s + c.dir * (d + 15), p); const k = Math.abs(Math.atan2(Math.sin(p.th - t0), Math.cos(p.th - t0))) / 15; if (k > 1e-4) v = Math.min(v, Math.max(7, Math.sqrt(3.6 / k))); }
    return v;
  }

  step(dt, player) {
    const groups = new Map();
    for (const c of this.cars) { const key = c.dir + '|' + c.lane; (groups.get(key) || groups.set(key, []).get(key)).push(c); }
    for (const list of groups.values()) list.sort((a, b) => (a.s - b.s) * a.dir);                                // ordered along the direction of travel: the next one in the list is the leader
    const R = this.road;
    for (const list of groups.values()) for (let i = 0; i < list.length; i++) {
      const c = list[i], lead = list[i + 1]; let want = Math.min(c.v0, this.curveSpeed(c));
      if (c.bump > 0) { c.bump -= dt; want = 0; }
      const safe = 6 + 1.4 * c.speed;
      if (lead) { const gap = (lead.s - c.s) * c.dir - (lead.len + c.len) / 2; if (gap < safe) want = Math.min(want, lead.speed * clamp((gap - 2) / (safe - 2), 0, 1)); if (gap < 2) want = 0; }
      if (player) {                                                                                                // the player in this car's lane ahead of it is a car in front, going at the player's speed along this car's direction
        const p = R.at(c.s, this._p), pl = (player.x - p.x) * -p.tz + (player.z - p.z) * p.tx, along = (player.s - c.s) * c.dir - c.len / 2 - 2.2;
        if (Math.abs(pl - c.lat) < 2.2 && along > -3 && along < 80) { const same = Math.cos((player.yaw || 0) - (c.dir > 0 ? p.th : p.th + Math.PI)), pv = Math.max(0, (player.u || 0) * same); if (along < safe) want = Math.min(want, pv * clamp((along - 2) / (safe - 2), 0, 1)); if (along < 2) want = 0; }
        if (Math.hypot(player.x - c.x, player.z - c.z) < 3.4 && c.bump <= 0) { c.bump = 3; c.speed *= 0.4; }          // bumped by the player: slows, then carries on
      }
      c.brake = want < c.speed - 0.3 ? 1 : 0;
      c.speed = clamp(want, c.speed - 7 * dt, c.speed + 2.5 * dt); c.speed = Math.max(0, c.speed);
      c.s += c.dir * c.speed * dt; c.stuck = c.speed < 0.5 ? c.stuck + dt : 0; this.place(c);
    }
  }

  /* the car in front of the player in the player's own lane, if any within `range` m: { gap (m between the bumpers), speed (its speed along the player's direction, m/s) } or null.
     A car coming the other way in the player's lane counts as a stopped obstacle. player: { x, z, s, yaw, u }. Used by the autodrive to follow traffic. */
  leaderAhead(player, range = 90) {
    const R = this.road, p = R.at(player.s, this._p), dirP = Math.cos((player.yaw || 0) - p.th) >= 0 ? 1 : -1, plat = (player.x - p.x) * -p.tz + (player.z - p.z) * p.tx; let best = null;
    for (const c of this.cars) {
      const along = (c.s - player.s) * dirP - c.len / 2 - 2.3; if (along < -1 || along > range || Math.abs(c.lat - plat) > 2.4) continue;
      if (!best || along < best.gap) best = { gap: Math.max(0, along), speed: c.dir === dirP ? c.speed : 0 };
    }
    return best;
  }
  /* obstacle circles for the player's physics: three per car along its length (the contract of world.near) */
  circles(x, z, r) {
    const out = this._out || (this._out = []), list = this._list || (this._list = [out]); out.length = 0;
    for (const c of this.cars) {
      if (Math.abs(c.x - x) > r + 8 || Math.abs(c.z - z) > r + 8) continue; const f = Math.cos(c.yaw), g = Math.sin(c.yaw), rad = c.w / 2 + 0.1, n = c.len > 6 ? 5 : 3, span = c.len / 2 - rad;
      for (let k = 0; k < n; k++) { const o = n === 1 ? 0 : (k / (n - 1) * 2 - 1) * span; out.push({ x: c.x + f * o, z: c.z + g * o, r: rad, traffic: c.id }); }
    }
    return list;
  }
}

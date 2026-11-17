/* The Delhi Metro in the city enclave (package D6): viaducts, at-grade track and portals, trains, and (transit_station.js) the stations. Built from `assets/cities/delhi/transit.json` through transit_plan.js.
   Streaming like the tiles: the track is cut into 1 km chunks (the pack's tile grid); a chunk is one merged mesh (girders, rails, overhead wire, masts, piers, portals), built when the pack tile under it is loaded
   (so the keep-out registry already knows the streets and buildings there: a pier that would stand in a carriageway or a building is moved along the track, up to 8 m, and the stat `pierMoved` / `pierBlocked` counts it).
   Underground track is not drawn. Trains are instanced (one InstancedMesh per line) and run on a timetable (transit_plan.js). All look figures are guesses, see docs/DELHI_TRANSIT.md. Browser only. */
import * as THREE from 'three';
import { Soup, C, extrude, fbox, frame, prism } from './transit_geo.js';
import { buildNetwork, buildTimetable, specOf, hexRgb, lineColour, GIRDER, PIER_SPACE, CAR_L, CAR_GAP, platformLen, kitOf } from './transit_plan.js';
import { StationKit } from './transit_station.js';
import { TransitUI } from './transit_ui.js';
import { RailStations } from './transit_rail.js';

const CONC = C(0xa5a29b), CONC_D = C(0x8b8882), CONC_T = C(0xc0bdb5), BALLAST = C(0x4b4945), STEEL = C(0x9aa0a6), WIRE = C(0x2c2e31), PIER = C(0x9a978f);
const GIRDER_RING = [[-1.8, -GIRDER], [1.8, -GIRDER], [2.5, -0.6], [2.5, 0.9], [2.05, 0.9], [2.05, -0.15], [-2.05, -0.15], [-2.05, 0.9], [-2.5, 0.9], [-2.5, -0.6]];
const GIRDER_COLS = [CONC_D, CONC, CONC, CONC_T, CONC, BALLAST, CONC, CONC_T, CONC, CONC];
const VISIBLE = -1.2, CHUNK_RAD = 1150, CHUNK_KEEP = 1800, ST_RAD = 520, ST_KEEP = 800, TRAIN_RAD = 1700, MAST = 45;

export class CityTransit {
  constructor(city) {
    this.city = city; this.origin = city.origin; this.S = city.pack.size; this.group = new THREE.Group(); city.scene.add(this.group); this.ok = false; this.t = 600; this.px = 0; this.pz = 0;
    this.chunks = new Map(); this.runs = new Map(); this.stations = new Map(); this.circ = new Map(); this.onTeleport = null;
    this.stats = { chunks: 0, stations: 0, tris: 0, calls: 0, piers: 0, pierMoved: 0, pierBlocked: 0, trains: 0, ms: 0 };
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide, envMapIntensity: 0.3, emissive: 0x24262a });
    this.litMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: 0xe8e8e8 });       // below ground: lit from itself
    /* tiles without textures: a 0.6 m grid of darker joints from the world position and the face direction (walls, floors and platforms of the underground stations) */
    this.litMat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <color_fragment>', `#include <color_fragment>
        { vec3 an = abs(normalize(cross(dFdx(vWP), dFdy(vWP)))); vec2 uv = an.y > 0.7 ? vWP.xz : (an.x > an.z ? vWP.zy : vWP.xy); vec2 q = uv / 0.6; vec2 g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2(1e-4)); float joint = 1.0 - min(min(g.x, g.y), 1.0); diffuseColor.rgb *= (1.0 - 0.22 * joint) * (0.66 + 0.34 * an.y + 0.1 * an.x); }`);
    };
    this.glassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 0.6 });
  }
  async init(url = 'assets/cities/delhi/transit.json') {
    try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); this.data = await r.json(); } catch (e) { console.warn('transit.json not loaded, no Metro:', e); return this; }
    for (const k of ['ground', 'park', 'walk', 'road', 'mark']) this.city.mats[k].side = THREE.DoubleSide;       // seen from below (inside an underground station) the street is the ceiling
    this.net = buildNetwork(this.data); this.lineOf = this.net.lineOf; this.tt = new Map(); this.zones = new Map();
    for (const R of this.net.routes) { R.spec = specOf(R.line); this.tt.set(R.id, buildTimetable(R, R.spec.vmax)); this.zones.set(R.id, []); }
    for (const [, e] of this.net.stations) for (const c of e.calls) { const per = e.st.per.find(p => p.line === c.R.line); if (per && kitOf(per) === 'elevated') this.zones.get(c.R.id).push([c.s - platformLen(c.R.line) / 2 - 12, c.s + platformLen(c.R.line) / 2 + 12]); }
    this.indexRoutes(); this.makeTrains(); this.ui = new TransitUI(this); this.rail = new RailStations(this); this.ok = true; return this;
  }
  /* which chunk each stretch of each route is in; a grid of the elevated samples for finding the neighbouring track (twin viaducts share piers) */
  indexRoutes() {
    const S = this.S; this.grid = new Map(); this.net.routes.forEach((R, ri) => {
      let run = null; for (let i = 0; i < R.n - 1; i++) {
        const key = Math.floor(R.x[i] / S) + '_' + Math.floor(R.z[i] / S); if (!run || run.key !== key) { run = { R, ri, i0: i, i1: i, key }; let l = this.runs.get(key); if (!l) this.runs.set(key, l = []); l.push(run); } else run.i1 = i;
        if (R.h[i] > 1) { const gk = Math.floor(R.x[i] / 16) + ',' + Math.floor(R.z[i] / 16); let l = this.grid.get(gk); if (!l) this.grid.set(gk, l = []); l.push(ri * 100000 + i); }
      } R.bb = [Math.min(...R.x), Math.min(...R.z), Math.max(...R.x), Math.max(...R.z)];
    });
  }
  neighbour(ri, x, z, h) {                                                // the nearest sample of another route within 10 m (not closer than 3 m) at about the same height
    let best = null, bd = 10; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = this.grid.get((Math.floor(x / 16) + a) + ',' + (Math.floor(z / 16) + b)); if (!l) continue; for (const v of l) { const rj = (v / 100000) | 0; if (rj === ri) continue; const R = this.net.routes[rj], j = v % 100000, d = Math.hypot(R.x[j] - x, R.z[j] - z); if (d > 3 && d < bd && Math.abs(R.h[j] - h) < 2.5) { bd = d; best = { x: R.x[j], z: R.z[j] }; } } } return best;
  }
  /* keep-out claims for an owner, announced once (like the city tiles do) */
  claim(owner, list) {
    const ko = this.city.ko, L = ko.listeners.slice(); ko.listeners.length = 0; let bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const c of list) { const cl = ko.add(owner, c.kind, c.shape, { layer: c.layer || 0 }); bb = [Math.min(bb[0], cl.bb[0]), Math.min(bb[1], cl.bb[1]), Math.max(bb[2], cl.bb[2]), Math.max(bb[3], cl.bb[3])]; }
    for (const f of L) ko.listeners.push(f); if (bb[0] < Infinity) for (const f of L) f(bb);
  }
  /* is the ground within r of (x, z) taken? Buildings, landmarks, stations: yes. A street: only on its carriageway (the claim of a street includes its sidewalk, 1.8 m, and a pier or a stair may stand on a sidewalk). Asked of the keep-out registry. */
  blocked(x, z, r) {
    const l = this.city.ko.cells.get(Math.floor(x / 64) + ',' + Math.floor(z / 64)); if (!l) return false;
    for (const c of l) {
      if (c.layer !== 0 || (c.owner && String(c.owner).startsWith('metro:c:'))) continue;
      if (c.kind === 'road' && c.t === 'line') { const core = Math.max(1.4, c.hw - 1.8) + r, P = c.pts; for (let i = 0; i + 3 < P.length; i += 2) { const dx = P[i + 2] - P[i], dz = P[i + 3] - P[i + 1], L2 = dx * dx + dz * dz, f = L2 ? Math.max(0, Math.min(1, ((x - P[i]) * dx + (z - P[i + 1]) * dz) / L2)) : 0; if (Math.hypot(x - P[i] - dx * f, z - P[i + 1] - dz * f) < core) return true; } continue; }
      if (this.city.ko._hitCircle(c, x, z, r)) return true;
    } return false;
  }
  unclaim(owner) { const ko = this.city.ko, L = ko.listeners.slice(); ko.listeners.length = 0; ko.removeOwner(owner); for (const f of L) ko.listeners.push(f); }

  /* ---- viaduct chunks ---- */
  buildChunk(key) {
    const t0 = performance.now(), [tx, tz] = key.split('_').map(Number), S = this.S, soup = new Soup(tx * S, tz * S), ko = this.city.ko, claims = [], circles = [], placed = new Map(), owner = 'metro:c:' + key, st = this.stats;
    const free = (x, z) => !this.blocked(x, z, 1.1);
    for (const { R, ri, i0, i1 } of this.runs.get(key)) {
      const line = this.lineOf.get(R.line), g = (+line.track.gauge || 1435) / 2000, third = specOf(R.line).third, zones = this.zones.get(R.id);
      let a = -1; const flush = b => {                                                  // segments a..b-1 are visible
        if (a < 0) return; const e = Math.min(b, R.n - 2), last = e + 1;
        extrude(soup, R, a, last, GIRDER_RING, GIRDER_COLS, true);
        for (const sg of [-1, 1]) extrude(soup, R, a, last, [[sg * g - 0.06, 0.0], [sg * g + 0.06, 0.0]], [STEEL], false);
        if (third) extrude(soup, R, a, last, [[1.0, 0.08], [1.2, 0.08]], [STEEL], false);
        else { extrude(soup, R, a, last, [[-0.07, 5.0], [0.07, 5.0]], [WIRE], false); extrude(soup, R, a, last, [[0, 4.93], [0, 5.07]], [WIRE], false); }
        const cl = []; for (let i = a; i <= last; i += 3) cl.push(R.x[i], R.z[i]); if (cl.length >= 4) { for (let k = 0; k + 3 < cl.length; k += 80) claims.push({ kind: 'rail', layer: 1, shape: { t: 'line', pts: cl.slice(k, k + 84), hw: 3.0 } }); }
        for (let i = a; i <= last; i++) {
          const F = frame(R.x[i], R.z[i], R.tx[i], R.tz[i]), h = R.h[i];
          if (!third && i > 0 && Math.floor(R.s[i] / MAST) !== Math.floor(R.s[i - 1] / MAST)) { fbox(soup, F, -0.12, 0.12, -2.5, -2.25, h + 0.9, h + 5.95, STEEL); fbox(soup, F, -0.06, 0.06, -2.5, 0.25, h + 5.45, h + 5.6, STEEL); }
          if (i > 0 && h - GIRDER >= 1.0 && Math.floor(R.s[i] / PIER_SPACE) !== Math.floor(R.s[i - 1] / PIER_SPACE)) this.pier(soup, R, ri, i, free, claims, circles, placed, zones);
        }
        a = -1;
      };
      for (let i = i0; i <= i1; i++) {
        const vis = Math.max(R.h[i], R.h[i + 1]) > VISIBLE;
        if (vis && a < 0) { a = i; if (i > 0 && R.h[i - 1] <= VISIBLE) this.portal(soup, R, i, +1); }
        if (!vis && a >= 0) { this.portal(soup, R, i, -1); flush(i - 1); }
      }
      flush(i1);
    }
    if (soup.empty) { this.chunks.set(key, { mesh: null, owner, tris: 0 }); return; }
    const m = new THREE.Mesh(soup.geometry(), this.mat); m.position.set(tx * S - this.origin.x, this.city.gy, tz * S - this.origin.z); m.matrixAutoUpdate = false; m.updateMatrix(); m.castShadow = true; m.receiveShadow = true; this.group.add(m);
    this.claim(owner, claims); this.circ.set(key, circles); this.chunks.set(key, { mesh: m, owner, tris: soup.tris }); st.ms = performance.now() - t0; this.refresh();
  }
  /* a pier under sample i: a column and a hammer-head cap; twin viaducts share one (the cap reaches the neighbouring track). Moved along the track off streets and buildings (the registry). */
  pier(S, R, ri, i, free, claims, circles, placed, zones) {
    const nb = this.neighbour(ri, R.x[i], R.z[i], R.h[i]), h = R.h[i], tx = R.tx[i], tz = R.tz[i], nx = -tz, nz = tx; let lc = 0, lb = 0; if (nb) { lb = (nb.x - R.x[i]) * nx + (nb.z - R.z[i]) * nz; lc = lb / 2; }
    let best = null; const tries = []; for (const dl of [0, 3.5, -3.5, 7, -7]) for (const du of [0, 2, -2, 4, -4, 6, -6, 8, -8]) tries.push([du, dl]);       // along the track first, then beside the street (the cap reaches the column)
    for (const [du, dl] of tries) { const x = R.x[i] + tx * du + nx * (lc + dl), z = R.z[i] + tz * du + nz * (lc + dl); if (free(x, z)) { best = { du, dl, x, z }; break; } }
    if (!best) { this.stats.pierBlocked++; best = { du: 0, dl: 0, x: R.x[i] + nx * lc, z: R.z[i] + nz * lc }; } else if (best.du || best.dl) this.stats.pierMoved++;
    const key = Math.floor(best.x / 7) + ',' + Math.floor(best.z / 7); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const q = placed.get((Math.floor(best.x / 7) + a) + ',' + (Math.floor(best.z / 7) + b)); if (q && Math.hypot(q.x - best.x, q.z - best.z) < 7) return; }
    placed.set(key, best); const sOn = R.s[i], inZone = zones.some(([a, b]) => sOn > a && sOn < b), half = inZone ? 9 : 3.0, y1 = h - GIRDER - 1.0, F = frame(R.x[i] + tx * best.du, R.z[i] + tz * best.du, tx, tz);
    if (y1 > 0.3) prism(S, best.x, best.z, 0, y1, 0.9, PIER);
    const c0 = lc + best.dl; fbox(S, F, -1.0, 1.0, Math.min(-half, lb - half, c0 - 1.2), Math.max(half, lb + half, c0 + 1.2), y1, h - GIRDER, PIER, CONC_D);
    circles.push(best.x, best.z, 1.0); claims.push({ kind: 'rail', layer: 0, shape: { t: 'circle', x: best.x, z: best.z, r: 1.3 } }); this.stats.piers++;
  }
  /* a tunnel portal where the track goes under the ground: a headwall with an opening and dark behind it, set where the rail is nearly at ground level on the visible side. `dir` is the way the visible track lies from the boundary sample i: +1 (tunnel behind) or -1 (tunnel ahead) */
  portal(S, R, i, dir) {
    let k = 0; while (k++ < 120 && R.h[i] < -0.2 && i + dir > 0 && i + dir < R.n - 1) i += dir;
    const F = frame(R.x[i], R.z[i], R.tx[i] * dir, R.tz[i] * dir), h = R.h[i], W = C(0xb9b4aa), D = C(0x0b0b0c), P = (u, l, y) => [F.x + F.tx * u - F.tz * l, y, F.z + F.tz * u + F.tx * l];
    fbox(S, F, -0.2, 1.4, -4.4, -2.5, h - 1.5, h + 6.2, W); fbox(S, F, -0.2, 1.4, 2.5, 4.4, h - 1.5, h + 6.2, W); fbox(S, F, -0.2, 1.4, -4.4, 4.4, h + 4.6, h + 6.2, W);
    S.quad(P(-0.4, -2.5, h - 1), P(-0.4, 2.5, h - 1), P(-0.4, 2.5, h + 4.6), P(-0.4, -2.5, h + 4.6), D);
  }
  dropChunk(key) { const c = this.chunks.get(key); if (!c) return; if (c.mesh) { this.group.remove(c.mesh); c.mesh.geometry.dispose(); } this.unclaim(c.owner); this.circ.delete(key); this.chunks.delete(key); this.refresh(); }

  /* ---- stations ---- */
  stationTile(e) { return Math.floor(e.st.x / this.S) + '_' + Math.floor(e.st.z / this.S); }
  buildStation(id) {
    const e = this.net.stations.get(id), t0 = performance.now(); const kit = new StationKit(this, e); this.stations.set(id, kit); this.group.add(kit.group); this.stats.ms = performance.now() - t0; this.refresh();
  }
  dropStation(id) { const k = this.stations.get(id); if (!k) return; this.group.remove(k.group); k.dispose(); this.unclaim('metro:st:' + id); this.stations.delete(id); this.refresh(); }

  /* ---- trains: one InstancedMesh per line ---- */
  makeTrains() {
    this.fleet = new Map(); this.near = []; this.m4 = new THREE.Matrix4(); this.vx = new THREE.Vector3(); this.vy = new THREE.Vector3(); this.vz = new THREE.Vector3(); this.p0 = {}; this.p1 = {}; this.p2 = {};
    for (const line of this.data.metro.lines) {
      const spec = specOf(line.id), geo = carGeometry(spec, lineColour(line)), cap = spec.cars * 16, mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.35, side: THREE.DoubleSide, envMapIntensity: 0.6 }), cap);
      mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = true; this.group.add(mesh); this.fleet.set(line.id, { mesh, cap, n: 0 });
    }
    this.nearT = 0;
  }
  updateTrains() {
    const px = this.px, pz = this.pz, ox = this.origin.x, oz = this.origin.z, S = this.S, pack = this.city.pack;
    if (this.nearT <= 0) { this.nearT = 0.5; this.near = this.net.routes.filter(R => R.bb[0] - TRAIN_RAD < px && px < R.bb[2] + TRAIN_RAD && R.bb[1] - TRAIN_RAD < pz && pz < R.bb[3] + TRAIN_RAD); }
    for (const f of this.fleet.values()) f.n = 0; let cars = 0;
    for (const R of this.near) {
      const tt = this.tt.get(R.id), f = this.fleet.get(R.line), pitch = CAR_L + CAR_GAP, nc = R.spec.cars;
      for (let k = 0; k < tt.n; k++) {
        const tau = (this.t + k * tt.headway) % tt.period, s = tt.state(tau); if (!s) continue; R.at(s.s, this.p0); if (Math.hypot(this.p0.x - px, this.p0.z - pz) > TRAIN_RAD || f.n + nc > f.cap) continue;
        for (let j = 0; j < nc; j++) {
          const sc = s.s + ((nc - 1) / 2 - j) * pitch; R.at(sc, this.p0); if ((this.p0.h < -1.5 && !(this.footY < this.city.gy - 2 && Math.hypot(this.p0.x - px, this.p0.z - pz) < 250)) || !pack.hasTile(Math.floor(this.p0.x / S), Math.floor(this.p0.z / S))) continue;
          R.at(sc + 7.2, this.p1); R.at(sc - 7.2, this.p2); const fx = this.p1.x - this.p2.x, fy = this.p1.h - this.p2.h, fz = this.p1.z - this.p2.z, L = Math.hypot(fx, fy, fz) || 1;
          this.vx.set(fx / L, fy / L, fz / L); this.vz.set(-fz / L, 0, fx / L).normalize(); this.vy.crossVectors(this.vz, this.vx);
          this.m4.makeBasis(this.vx, this.vy, this.vz); this.m4.setPosition(this.p0.x - ox, this.city.gy + this.p0.h, this.p0.z - oz); f.mesh.setMatrixAt(f.n++, this.m4); cars++;
        }
      }
    }
    for (const f of this.fleet.values()) { f.mesh.count = f.n; f.mesh.instanceMatrix.needsUpdate = true; } this.stats.trains = cars;
  }

  /* ---- every frame ---- */
  update(px, pz, dt = 0.016) {
    if (!this.ok) return; this.t += dt; this.nearT -= dt; this.px = px; this.pz = pz; const S = this.S, city = this.city;
    let want = null, wd = Infinity;
    for (const key of this.runs.keys()) { if (this.chunks.has(key)) continue; const [i, j] = key.split('_').map(Number); if (!city.tiles.has(key)) continue; const d = Math.hypot(Math.max(i * S - px, 0, px - (i + 1) * S), Math.max(j * S - pz, 0, pz - (j + 1) * S)); if (d < CHUNK_RAD && d < wd) { wd = d; want = key; } }
    if (want) this.buildChunk(want);
    else { let ws = null, sd = Infinity; for (const [id, e] of this.net.stations) { if (this.stations.has(id) || !city.tiles.has(this.stationTile(e))) continue; const d = Math.hypot(e.st.x - px, e.st.z - pz); if (d < ST_RAD && d < sd) { sd = d; ws = id; } } if (ws) this.buildStation(ws); }
    for (const key of [...this.chunks.keys()]) { const [i, j] = key.split('_').map(Number), d = Math.hypot(Math.max(i * S - px, 0, px - (i + 1) * S), Math.max(j * S - pz, 0, pz - (j + 1) * S)); if (d > CHUNK_KEEP) this.dropChunk(key); }
    for (const [id, k] of [...this.stations]) { const d = Math.hypot(k.e.st.x - px, k.e.st.z - pz); if (d > ST_KEEP) this.dropStation(id); else k.update(this.t, d); }
    this.rail.update(px, pz); this.updateTrains(); this.ui.update(px, pz);
  }
  reposition() {
    for (const [key, c] of this.chunks) if (c.mesh) { const [i, j] = key.split('_').map(Number); c.mesh.position.set(i * this.S - this.origin.x, this.city.gy, j * this.S - this.origin.z); c.mesh.updateMatrix(); }
    for (const k of this.stations.values()) k.reposition(); if (this.rail) this.rail.reposition();
  }
  /* height of a walkable surface (a concourse floor, a stair, a railway platform, its ramps) over (x, z), in world y, or NaN. CityWorld.deck asks this for everybody, so only a surface within 0.7 m of
     the walker's feet counts (`footY`, set by main.js each frame; the ground height when nobody is on foot): you walk under a concourse at street level and up its stair onto the floor. */
  deckAt(x, z) {
    let best = NaN, bd = 0.7; const gy = this.city.gy, fy = this.footY === undefined ? gy : this.footY;
    for (const k of [...this.stations.values(), ...(this.rail ? this.rail.built.values() : [])]) for (const w of k.walk) {
      const dx = x - w.x, dz = z - w.z, u = dx * w.tx + dz * w.tz, l = -dx * w.tz + dz * w.tx; if (u < w.u0 || u > w.u1 || l < w.l0 || l > w.l1) continue;
      const y = gy + w.ya + (w.yb - w.ya) * (w.u1 > w.u0 ? (u - w.u0) / (w.u1 - w.u0) : 0), d = Math.abs(y - fy); if (d <= bd) { bd = d; best = y; }
    } return best;
  }
  /* wall circles of the piers (and station kiosks) for the vehicle physics: flat [x, z, r, ...] near (x, z) */
  circles(x, z, r) {
    const out = []; for (const a of this.circ.values()) for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - x) < r + a[i + 2] && Math.abs(a[i + 1] - z) < r + a[i + 2]) out.push({ x: a[i], z: a[i + 1], r: a[i + 2] });
    for (const k of this.stations.values()) for (const c of k.circles) if (Math.abs(c.x - x) < r + c.r && Math.abs(c.z - z) < r + c.r) out.push(c); return out;
  }
  refresh() { let tris = 0, calls = 0; for (const c of this.chunks.values()) if (c.mesh) { tris += c.tris; calls++; } for (const k of this.stations.values()) { tris += k.tris; calls += k.calls; } if (this.rail) { this.rail.refresh(); tris += this.rail.stats.tris; calls += this.rail.stats.calls; this.stats.rail = this.rail.stats.stations; } const car = this.fleet ? [...this.fleet.values()].reduce((a, f) => a + (f.mesh.geometry.index ? f.mesh.geometry.index.count / 3 : f.mesh.geometry.attributes.position.count / 3) * f.n, 0) : 0; this.stats.chunks = this.chunks.size; this.stats.stations = this.stations.size; this.stats.tris = tris; this.stats.calls = calls; this.stats.trainTris = car; }
  summary() {
    if (!this.ok) return 'metro       not loaded'; this.refresh(); const s = this.stats; return 'metro       chunks ' + s.chunks + ' stations ' + s.stations + ' rail stations ' + (s.rail || 0) + '  ' + (s.tris / 1000).toFixed(0) + 'k tris, ' + s.calls + ' draws  trains ' + s.trains + ' cars  piers ' + s.piers + ' (moved ' + s.pierMoved + ', blocked ' + s.pierBlocked + ')';
  }
}

/* one car of a line in its own frame: length along x, rail top at y = 0, front at +x. Silver body, the line colour as a band under the windows, four doors a side, a windscreen at both ends (measured nowhere: guesses) */
export function carGeometry(spec, hex) {
  const S = new Soup(0, 0), F = frame(0, 0, 1, 0), L = CAR_L, W = spec.w, band = hexRgb(hex), silver = C(0xb4b9bd), roof = C(0xaab0b5), dark = C(0x2b2d30), glass = C(0x16212b), door = C(0xc2c6c9), lamp = C(0xff2a2a);
  fbox(S, F, -L / 2, L / 2, -W / 2, W / 2, 0.95, 3.55, silver); fbox(S, F, -L / 2 + 0.5, L / 2 - 0.5, -W / 2 + 0.35, W / 2 - 0.35, 3.55, 3.85, roof); for (const u of [-5, 5]) fbox(S, F, u - 1.5, u + 1.5, -0.8, 0.8, 3.85, 4.2, C(0x8e9498));
  fbox(S, F, -L / 2 + 1, L / 2 - 1, -W / 2 + 0.35, W / 2 - 0.35, 0.45, 0.95, dark); for (const u of [-7.2, 7.2]) fbox(S, F, u - 1.3, u + 1.3, -W / 2 + 0.5, W / 2 - 0.5, 0.12, 0.95, dark);
  const q = (u0, u1, y0, y1, l, col) => S.quad([u0, y0, l], [u1, y0, l], [u1, y1, l], [u0, y1, l], col);
  for (const sg of [-1, 1]) {
    const l0 = sg * (W / 2 + 0.015), l1 = sg * (W / 2 + 0.04);
    q(-L / 2 + 0.7, L / 2 - 0.7, 2.05, 3.0, l0, glass); q(-L / 2, L / 2, 1.55, 1.95, l0, band);
    for (const u of [-8.2, -2.7, 2.7, 8.2]) { q(u - 0.7, u + 0.7, 0.98, 3.35, l1, door); q(u - 0.3, u + 0.3, 2.3, 3.0, sg * (W / 2 + 0.05), glass); }
    S.quad([L / 2 + 0.015, 1.7, sg * (W / 2 - 0.2)], [L / 2 + 0.015, 1.7, sg * 0.05], [L / 2 + 0.015, 3.4, sg * 0.05], [L / 2 + 0.015, 3.4, sg * (W / 2 - 0.2)], glass); if (sg > 0) { S.quad([L / 2 + 0.02, 3.05, -0.9], [L / 2 + 0.02, 3.05, 0.9], [L / 2 + 0.02, 3.3, 0.9], [L / 2 + 0.02, 3.3, -0.9], C(0xff8a1a)); S.quad([-L / 2 - 0.02, 3.05, -0.9], [-L / 2 - 0.02, 3.05, 0.9], [-L / 2 - 0.02, 3.3, 0.9], [-L / 2 - 0.02, 3.3, -0.9], C(0xff8a1a)); }
    S.quad([-L / 2 - 0.015, 1.7, sg * (W / 2 - 0.2)], [-L / 2 - 0.015, 1.7, sg * 0.05], [-L / 2 - 0.015, 3.4, sg * 0.05], [-L / 2 - 0.015, 3.4, sg * (W / 2 - 0.2)], glass);
    for (const e of [-1, 1]) S.quad([e * (L / 2 + 0.02), 1.15, sg * (W / 2 - 0.5)], [e * (L / 2 + 0.02), 1.15, sg * (W / 2 - 0.8)], [e * (L / 2 + 0.02), 1.4, sg * (W / 2 - 0.8)], [e * (L / 2 + 0.02), 1.4, sg * (W / 2 - 0.5)], lamp);
  }
  return S.geometry();
}

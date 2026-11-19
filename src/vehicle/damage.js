/* Crash damage to the player's vehicle (docs/DAMAGE_PLAN.md, phases 3 and 4), built the way a real crash builds up: a car takes MANY knocks before it is finished, and fire is the very last, rare step.
   What a hit does, by closing speed `vn` (m/s) and where it lands:
     every hit above 2 m/s  dents the body (vertices near the contact are pushed in, smoothly, up to a limit; hits pile up) and wears the frame down a little;
     glass                   the pane near the hit cracks (a spider-web) and shatters into shards after more hits or one hard one;
     doors, bumpers          a door or a bumper takes dents, then comes off in a hard hit on that side, the bumper from 14 m/s head-on;
     tyres                   a hit at a wheel bends it (the wheel leans, the car pulls), then it goes flat, then bursts with a pop;
     frame (chassis)         worn by every hit: the car pulls to the hurt side, loses power, and when the frame is gone the car is dead;
     engine                  worn by hard front hits (the Ember RS: rear hits): white smoke below 50 percent, black smoke below 25, dead below 5 (the car stops but does not burn);
     fire                    only when the engine is nearly gone AND the frame is broken AND a hard hit lands: then with a probability, never from a few knocks. The fire spreads unevenly from the engine bay (paint blisters
                             brown, then soot black, with glowing edges, patch by patch, by a noise field in the shader), burns for 10 to 16 s, then the fuel goes: a blast throws the doors and bonnet off, bursts the tyres
                             in stages, hops the car and leaves a charred wreck that burns on for half a minute.
   A 41 km/h wall hit costs about 0.10 of the frame, 72 km/h about 0.24, 100 km/h about 0.35: ten ordinary crashes to finish a car. All numbers are design choices, tunable in HEALTH and DENT.
   Browser only (it edits the loaded model's geometry, copied first so the shared model in the cache is never touched). */
import * as THREE from 'three';
import { FireFx } from './fire.js';

export const HEALTH = { lossK: 0.0048, lossPow: 1.35, maxHit: 0.45, engFront: 0.9, engSide: 0.25, engRear: 0.15, engMin: 5, smoke: 0.5, smokeBlack: 0.25, dead: 0.05, fireEngine: 0.2, fireFrame: 0.35, fireMinHit: 8, fuse: [20, 30], burnSeconds: 75, smokeSeconds: 220,
  glassK: 0.025, glassPow: 1.2, doorOff: 14, bumperOff: 14, tyreK: 0.1, tyreNear: 0.95,
  /* owner, 20 Nov 2026: "the car gets wrecked too easily; longer blast; less wreckage per impact". toughness divides every kind of damage (frame, engine, glass, tyres; doors and bumpers need a harder hit by its square root): 1 is the old behaviour, 1.8 about two thirds more knocks; fuse is the seconds from catching fire to the blast; burnSeconds and smokeSeconds how long the wreck burns and smokes; debris is the share of the pieces (glass shards, doors, bumpers) that fly off per impact, 1 = all */
  toughness: 1.8, debris: 0.4 };
export const DENT = { soft: 2.0, k: 0.055, pow: 1.2, maxHit: 0.34, maxTotal: 0.5, r0: 0.45, rk: 0.07, noise: 0.3 };
const hashf = i => { let h = (i | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), Q = new THREE.Quaternion(), M = new THREE.Matrix4();
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

/* the burn and the cracks, injected into the car's own copies of its materials: where the fire has been (a noise-edged field growing from the engine bay), the paint blisters brown then goes sooty black, metal turns matt,
   edges glow; on the glass, a spider-web of cracks round the last impact on each pane that is damaged */
const NOISE = `
float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y), mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ return 0.55 * vn(p) + 0.3 * vn(p * 2.1) + 0.15 * vn(p * 4.3); }`;
const FRAG_COMMON = `varying vec3 vLoc; uniform vec3 uEng; uniform float uR; uniform float uT; uniform float uGlow; uniform vec4 uGlass; uniform vec3 uCrack; float gB;` + NOISE + `
float burnAmt() { vec3 q = (vLoc - uEng) * vec3(1.0, 1.15, 0.85); float d = length(q); float n = fbm(vLoc * 2.6); float b = (uR - d) / 1.3 + (n - 0.5) * 1.15; return clamp(b, 0.0, 1.0) * step(0.001, uR); }
float paneDamage() { vec3 p = vLoc; float side = smoothstep(0.62, 0.78, abs(p.x)); float front = (1.0 - side) * smoothstep(0.1, 0.35, p.z); float rear = (1.0 - side) * smoothstep(-0.2, -0.45, p.z);
  float left = side * step(0.0, p.x), right = side * step(p.x, 0.0); return front * uGlass.x + rear * uGlass.y + left * uGlass.z + right * uGlass.w; }
float web(vec3 p) { vec2 a = (abs(p.x) > 0.7) ? vec2(p.z, p.y) : vec2(p.x, p.y), o = (abs(p.x) > 0.7) ? vec2(uCrack.z, uCrack.y) : vec2(uCrack.x, uCrack.y), d = a - o; float r = length(d) + 0.0001, ang = atan(d.y, d.x);
  float rad = abs(fract(ang * 1.9099 + 0.31 * floor(r * 3.0)) - 0.5) * r, ring = abs(fract(r * 5.5 + 0.2 * vn(vec3(a * 4.0, 1.0))) - 0.5) / 5.5; float line = min(rad * 1.4, ring * 3.0); return 1.0 - smoothstep(0.0, 0.012, line); }`;
const NAME_RE = /Glass/i;

export class CarDamage {
  constructor(view) { this.view = view; this.parts = null; this.zone = { front: 0, rear: 0, left: 0, right: 0 }; this.hits = 0; this.box = null; this.origin = { x: 0, z: 0 }; this.onChunks = null; this.onEvent = null; this.reset(); }
  reset() {
    this.frame = 1; this.engine = 1; this.state = 'ok'; this.fuse = 0; this.since = 0; this.fx = null; this.orig = null; this.copies = null; this.cosmetic = false; this.burstAt = 0; this.glass = [0, 0, 0, 0]; this.crack = new THREE.Vector3(0, 1, 1); this.doors = { L: true, R: true }; this.bumpers = { F: true, R: true };
    this.tyre = [0, 0, 0, 0]; this.tyreDue = [-1, -1, -1, -1]; this.U = null; this.smokeAt = 0; this.burnR = 0; this.wheelsInfo = null;
  }
  get health() { return this.frame; }
  /* find the body's meshes (not the wheels), copy their geometry, remember each vertex in the model's own space */
  attach() {
    if (this.parts) return; const model = this.view.model; model.updateWorldMatrix(true, true); const inv = new THREE.Matrix4().copy(model.matrixWorld).invert(); this.parts = []; const box = new THREE.Box3();
    model.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      for (let p = o; p && p !== model; p = p.parent) if (/^Wheel_/.test(p.name)) return;
      if (/interior/i.test(o.name)) return;
      const g = o.geometry.clone(), pos = g.attributes.position, n = pos.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = pos.getX(i); a[i * 3 + 1] = pos.getY(i); a[i * 3 + 2] = pos.getZ(i); }
      g.setAttribute('position', new THREE.BufferAttribute(a, 3)); o.geometry = g;
      M.multiplyMatrices(inv, o.matrixWorld); const toModel = M.clone(), toMesh = M.clone().invert(), cur = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { V.set(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]).applyMatrix4(toModel); cur[i * 3] = V.x; cur[i * 3 + 1] = V.y; cur[i * 3 + 2] = V.z; box.expandByPoint(V); }
      this.parts.push({ mesh: o, g, n, orig: cur.slice(), cur, tot: new Float32Array(n), toMesh, idx0: g.index ? g.index.array.slice() : null });
    });
    this.box = box; this.wheelsInfo = this.view.wheels.map(w => ({ w, x: w.o.position.x, z: w.o.position.z }));
  }
  ev(name) { if (this.onEvent) this.onEvent(name); }
  /* h: { x, z, nx, nz, vn } = contact point in game metres, the hit direction pointing from the thing hit into the car, closing speed (m/s); origin: the floating origin; y: the car's height. Returns the dent depth (m). */
  hit(h, origin, y) {
    if (!(h.vn >= DENT.soft)) return 0; this.attach(); if (!this.parts.length) return 0; this.origin = origin; if (this.state === 'wrecked') return 0;
    const model = this.view.model, depth = Math.min(DENT.maxHit, DENT.k * Math.pow(h.vn - DENT.soft, DENT.pow)); if (depth < 0.004) return 0;
    model.updateWorldMatrix(true, false); const c = model.worldToLocal(new THREE.Vector3(h.x - origin.x, y, h.z - origin.z));
    c.x = clamp(c.x, this.box.min.x, this.box.max.x); c.z = clamp(c.z, this.box.min.z, this.box.max.z); c.y = clamp(c.y > 0.1 ? c.y : 0.65, this.box.min.y + 0.25, this.box.max.y - 0.15);
    model.getWorldQuaternion(Q).invert(); const dir = V2.set(h.nx, 0, h.nz).applyQuaternion(Q); dir.y = 0; if (dir.lengthSq() < 1e-6) return 0; dir.normalize();
    const R = DENT.r0 + DENT.rk * h.vn, R2 = R * R, dx = dir.x, dz = dir.z;
    for (const P of this.parts) {
      const cur = P.cur, tot = P.tot; let touched = false;
      for (let i = 0, j = 0; i < P.n; i++, j += 3) {
        const ex = cur[j] - c.x, ey = cur[j + 1] - c.y, ez = cur[j + 2] - c.z, d2 = ex * ex + ey * ey + ez * ez; if (d2 > R2) continue;
        const t = 1 - Math.sqrt(d2) / R, w = t * t * (3 - 2 * t), room = DENT.maxTotal - tot[i]; if (room <= 0) continue;
        const dl = Math.min(room, depth * w * (1 - DENT.noise / 2 + DENT.noise * hashf(i * 7 + this.hits)));
        cur[j] += dx * dl; cur[j + 2] += dz * dl; cur[j + 1] -= dl * 0.12; tot[i] += dl; touched = true;
      }
      if (touched) this.write(P);
    }
    this.hits++; const side = Math.abs(c.z) > Math.abs(c.x) * 1.4 ? (c.z > 0 ? 'front' : 'rear') : (c.x > 0 ? 'left' : 'right'); this.zone[side] += depth;
    if (!this.cosmetic) this.consequences(h, c, side);
    return depth;
  }
  /* what this hit does beyond the dent: frame, engine, glass, doors, bumpers, tyres, and (rarely, last) the fire */
  consequences(h, c, side) {
    const vn = h.vn, loss = Math.min(HEALTH.maxHit, HEALTH.lossK * Math.pow(vn - DENT.soft, HEALTH.lossPow)) / HEALTH.toughness, mid = this.view.def && this.view.def.id === 'sport'; this.takeMaterials();
    this.frame = Math.max(0, this.frame - loss);
    if (vn >= HEALTH.engMin) { const front = mid ? side === 'rear' : side === 'front', rear = mid ? side === 'front' : side === 'rear'; this.engine = Math.max(0, this.engine - loss * (front ? HEALTH.engFront : rear ? HEALTH.engRear : HEALTH.engSide)); }
    if (vn > 4) {                                                                                                          // glass: the pane nearest the hit cracks (more for a harder hit); a hit high up shakes them all
      const g = HEALTH.glassK * Math.pow(vn - 4, HEALTH.glassPow) / HEALTH.toughness, near = [side === 'front' ? 1 : 0.15, side === 'rear' ? 1 : 0.15, side === 'left' ? 1 : 0.15, side === 'right' ? 1 : 0.15]; if (c.y > 0.55) for (let i = 0; i < 4; i++) near[i] = Math.max(near[i], 0.4);
      for (let i = 0; i < 4; i++) { const was = this.glass[i]; this.glass[i] = Math.min(1, was + g * near[i] * (vn > 10 ? 1.4 : 1)); if (this.glass[i] > 0.02 && was <= 0.02) this.crack.copy(c); if (this.glass[i] >= 0.8 && was < 0.8) this.shatter(i); }
      this.U.uGlass.value.set(this.glass[0], this.glass[1], this.glass[2], this.glass[3]); this.U.uCrack.value.copy(this.crack);
    }
    if (side === 'right' && this.doors.R && vn >= HEALTH.doorOff * Math.sqrt(HEALTH.toughness)) this.tearDoor('R'); else if (side === 'left' && this.doors.L && vn >= HEALTH.doorOff * Math.sqrt(HEALTH.toughness)) this.tearDoor('L');          // doors and bumpers come off in a hard hit on their side
    if (side === 'front' && this.bumpers.F && vn >= HEALTH.bumperOff * Math.sqrt(HEALTH.toughness)) this.tearBumper('F'); else if (side === 'rear' && this.bumpers.R && vn >= HEALTH.bumperOff * Math.sqrt(HEALTH.toughness)) this.tearBumper('R');
    if (vn > 4) for (let i = 0; i < this.wheelsInfo.length; i++) { const w = this.wheelsInfo[i]; if (Math.hypot(c.x - w.x, c.z - w.z) < HEALTH.tyreNear) { const was = this.tyre[i]; this.tyre[i] = Math.min(1, was + HEALTH.tyreK * Math.pow(vn - 3, 1.1) / HEALTH.toughness); if (this.tyre[i] >= 1 && was < 1) this.popTyre(i); } }     // tyres: bent, flat, burst
    this.stage(vn);
  }
  /* the state machine: ok, smoking, dead (stops, smokes, does not burn), burning, wrecked */
  stage(vn) {
    if (this.state === 'wrecked' || this.state === 'burning') return;
    if (this.state === 'ok' && this.engine < HEALTH.smoke) this.state = 'smoking';
    if (this.engine <= HEALTH.dead || this.frame <= 0.03) { if (this.state !== 'dead') { this.state = 'dead'; this.smokeAt = this.since; } }
    if ((this.state === 'smoking' || this.state === 'dead') && this.engine < HEALTH.fireEngine && this.frame < HEALTH.fireFrame && vn >= HEALTH.fireMinHit) {            // fire: only a car that is already broken, hit hard again, and then not every time
      const p = clamp((HEALTH.fireFrame - this.frame) + (HEALTH.fireEngine - this.engine) + 0.1, 0.1, 0.85);
      if (Math.random() < p) { this.state = 'burning'; this.fuse = HEALTH.fuse[0] + Math.random() * (HEALTH.fuse[1] - HEALTH.fuse[0]); this.since = 0; this.takeMaterials(); }
    }
  }
  get power() {
    if (this.state === 'wrecked' || this.state === 'dead') return 0;
    const ef = this.engine >= HEALTH.smoke ? 1 : 0.3 + 0.7 * (this.engine / HEALTH.smoke), ff = 0.5 + 0.5 * this.frame, tf = 1 - 0.1 * this.tyre.reduce((a, b) => a + b, 0); return clamp(ef * ff * tf, 0.15, 1);
  }
  /* the car pulls toward its hurt side: a crumpled corner, a bent frame, a damaged tyre */
  get pull() {
    if (this.cosmetic) return 0; const asym = this.zone.right - this.zone.left, tyre = (this.tyre[1] + this.tyre[3]) - (this.tyre[0] + this.tyre[2]);
    return clamp(asym * 0.35 * (1.4 - this.frame) + tyre * 0.06, -0.2, 0.2);
  }
  get wrecked() { return this.state === 'wrecked' || this.state === 'dead'; }          // cannot be driven
  get burntOut() { return this.state === 'wrecked'; }                                    // burnt out for good
  get worst() { return Math.max(0, ...Object.values(this.zone)); }
  /* ---------- parts that come off ---------- */
  /* take every triangle whose centre is inside the model-space box [x0, y0, z0, x1, y1, z1] (and whose material name passes `pass`) out of the body meshes; returns them grouped into pieces by place and material */
  takeTriangles(bx, pass, cell) {
    const tris = []; this.attach();
    for (const P of this.parts) {
      const g = P.g, idx = g.index ? g.index.array : null, mats = [].concat(P.mesh.material), groups = g.groups && g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.length : P.n, materialIndex: 0 }]; let changed = false;
      for (const gr of groups) {
        const mat = mats[gr.materialIndex] || mats[0]; if (!pass(mat.name || '')) continue;
        for (let q = gr.start; q < gr.start + gr.count; q += 3) {
          const a = idx ? idx[q] : q, b = idx ? idx[q + 1] : q + 1, c = idx ? idx[q + 2] : q + 2; if (a === b) continue; const cur = P.cur;
          const cx = (cur[a * 3] + cur[b * 3] + cur[c * 3]) / 3, cy = (cur[a * 3 + 1] + cur[b * 3 + 1] + cur[c * 3 + 1]) / 3, cz = (cur[a * 3 + 2] + cur[b * 3 + 2] + cur[c * 3 + 2]) / 3;
          if (cx < bx[0] || cx > bx[3] || cy < bx[1] || cy > bx[4] || cz < bx[2] || cz > bx[5]) continue;
          tris.push({ v: [a, b, c], P, mat, cx, cy, cz });
          if (idx) { idx[q + 1] = a; idx[q + 2] = a; } else for (const v of [a, b, c]) { cur[v * 3] = cx; cur[v * 3 + 1] = cy; cur[v * 3 + 2] = cz; } changed = true;
        }
      }
      if (changed) { if (idx) g.index.needsUpdate = true; else this.write(P); }
    }
    return this.group(tris, cell || 1.0);
  }
  group(tris, cell) {
    if (!tris.length) return []; const model = this.view.model, ox = this.origin.x, oz = this.origin.z, by = new Map();
    for (const t of tris) { const k = t.mat.uuid + '|' + Math.floor(t.cx / cell) + ',' + Math.floor(t.cy / (cell * 1.3)) + ',' + Math.floor(t.cz / cell); let l = by.get(k); if (!l) by.set(k, l = []); l.push(t); }
    const chunks = [];
    for (const l of by.values()) {
      const pts = []; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const t of l) for (const v of t.v) { V.set(t.P.cur[v * 3], t.P.cur[v * 3 + 1], t.P.cur[v * 3 + 2]); model.localToWorld(V); const x = V.x + ox, y = V.y, z = V.z + oz; pts.push(x, y, z); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2, pos = new Float32Array(pts.length); for (let i = 0; i < pts.length; i += 3) { pos[i] = pts[i] - mx; pos[i + 1] = pts[i + 1] - my; pos[i + 2] = pts[i + 2] - mz; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals(); const m = l[0].mat.clone(); if (m.color && (this.state === 'wrecked' || this.state === 'burning')) m.color.multiplyScalar(0.3);
      chunks.push({ cx: mx, cy: my, cz: mz, hx: (x1 - x0) / 2, hy: (y1 - y0) / 2, hz: (z1 - z0) / 2, geo: g, mat: m });
    }
    return chunks;
  }
  spawn(chunks) { const keep = chunks.filter((c, i) => i === 0 || hashf(i * 131 + (this.hits | 0) * 17) < HEALTH.debris); if (keep.length && this.onChunks) this.onChunks({ x: keep[0].cx, y: keep[0].cy, z: keep[0].cz }, keep); }       // debris: fewer pieces fly off per impact (settings: damage.health.debris)
  doorBox(side) { const b = this.box, hw = b.max.x, zc = ((this.view.def.eye && this.view.def.eye[2]) || 0) - 0.02, s = side === 'L' ? 1 : -1, a = s * (hw - 0.4), c = s * (hw + 0.08); return [Math.min(a, c), 0.28, zc - 0.62, Math.max(a, c), b.max.y, zc + 0.58]; }
  tearDoor(side) { if (!this.doors[side] || this.view.def.id === 'bike') return; this.doors[side] = false; this.spawn(this.takeTriangles(this.doorBox(side), () => true, 0.7)); this.ev('metal'); }
  tearBumper(end) { if (!this.bumpers[end]) return; this.bumpers[end] = false; const b = this.box, z = end === 'F' ? [b.max.z - 0.55, b.max.z + 0.1] : [b.min.z - 0.1, b.min.z + 0.55]; this.spawn(this.takeTriangles([b.min.x - 0.1, 0.12, z[0], b.max.x + 0.1, 0.62, z[1]], n => !NAME_RE.test(n), 0.8)); this.ev('metal'); }
  /* a pane breaks: its glass triangles come out as shards */
  shatter(i) {
    const b = this.box, top = b.max.y + 0.05, box = [[-0.8, 0.8, 0.2, 0.8, top, b.max.z], [-0.8, 0.8, b.min.z, 0.8, top, -0.3], [0.6, 0.8, b.min.z, b.max.x + 0.1, top, b.max.z], [b.min.x - 0.1, 0.8, b.min.z, -0.6, top, b.max.z]][i];
    this.spawn(this.takeTriangles([box[0], box[1], box[2], box[3], box[4], box[5]], n => NAME_RE.test(n), 0.3)); this.ev('glass');
  }
  /* a tyre goes: a pop, and it sits low */
  popTyre(i) { const w = this.wheelsInfo && this.wheelsInfo[i]; if (!w || w.flat) return; w.flat = true; if (!this.fx) this.fx = new FireFx(this.view.scene); w.w.o.getWorldPosition(V); this.fx.pop(V.clone()); this.ev('pop'); }
  /* ---------- fire, smoke, burst ---------- */
  /* own copies of the materials (the model's are shared with every other use of it) with the burn and crack shader */
  takeMaterials() {
    if (this.orig) return; this.attach(); this.orig = []; const copies = new Map();
    this.U = { uInv: { value: new THREE.Matrix4() }, uEng: { value: new THREE.Vector3() }, uR: { value: 0 }, uT: { value: 0 }, uGlow: { value: 0 }, uGlass: { value: new THREE.Vector4(0, 0, 0, 0) }, uCrack: { value: this.crack } };
    const b = this.box, id = this.view.def && this.view.def.id; this.U.uEng.value.set(0, Math.min(b.max.y - 0.3, 0.95), id === 'bike' ? 0 : id === 'sport' ? b.min.z + 1.5 : b.max.z - 1.0);
    for (const P of this.parts) {
      const m = P.mesh, list = [].concat(m.material), mine = list.map(x => { if (!copies.has(x)) { const c = x.clone(), glass = NAME_RE.test(x.name || ''); c.onBeforeCompile = sh => this.shade(sh, glass); c.customProgramCacheKey = () => glass ? 'carburnG' : 'carburn1'; c.needsUpdate = true; copies.set(x, c); } return copies.get(x); });
      this.orig.push({ mesh: m, mat: m.material }); m.material = Array.isArray(m.material) ? mine : mine[0];
    }
    this.copies = [...copies.values()];
  }
  shade(sh, glass) {
    for (const k of ['uInv', 'uEng', 'uR', 'uT', 'uGlow', 'uGlass', 'uCrack']) sh.uniforms[k] = this.U[k];
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc;\nuniform mat4 uInv;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = (uInv * modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAG_COMMON)
      .replace('#include <color_fragment>', `#include <color_fragment>
      gB = burnAmt(); ` + (glass ? `{ float pd = paneDamage(); if (pd > 0.02) { float w = web(vLoc) * smoothstep(0.02, 0.3, pd); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.8, 0.82), w * 0.8); diffuseColor.rgb *= 1.0 + pd * 0.35 * vn(vLoc * 11.0); } }` : '') + `
      vec3 brown = vec3(0.30, 0.15, 0.07) * (0.7 + 0.6 * vn(vLoc * 5.0)); vec3 soot = vec3(0.025, 0.02, 0.017) * (0.5 + vn(vLoc * 9.0));
      diffuseColor.rgb = mix(diffuseColor.rgb, brown, smoothstep(0.02, 0.3, gB)); diffuseColor.rgb = mix(diffuseColor.rgb, soot, smoothstep(0.28, 0.65, gB));`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.95, smoothstep(0.1, 0.5, gB));')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor *= 1.0 - 0.8 * smoothstep(0.1, 0.5, gB);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n { float edge = smoothstep(0.0, 0.18, gB) * (1.0 - smoothstep(0.25, 0.55, gB)); float ember = vn(vLoc * 7.0 + vec3(0.0, uT * 0.6, 0.0)); totalEmissiveRadiance += vec3(1.0, 0.32, 0.06) * edge * ember * uGlow; }');
  }
  /* where the flames are: spread across the burnt region, not one spot */
  flameSpots(n, out) {
    const e = this.U.uEng.value, R = Math.max(0.3, this.burnR), b = this.box; out.length = 0;
    for (let i = 0; i < n; i++) { V.set(clamp(e.x + (Math.random() - 0.5) * 1.5 * R, b.min.x + 0.1, b.max.x - 0.1), clamp(e.y + (Math.random() - 0.3) * 0.6 * R, 0.3, b.max.y), clamp(e.z + (Math.random() - 0.5) * 2 * R, b.min.z + 0.2, b.max.z - 0.2)); this.view.model.localToWorld(V); out.push(V.clone()); }
    return out;
  }
  enginePos(out) {
    this.attach(); const b = this.box, id = this.view.def && this.view.def.id; V2.set(0, Math.min(b.max.y - 0.3, 0.95), id === 'bike' ? 0 : id === 'sport' ? b.min.z + 1.5 : b.max.z - 1.0);
    this.view.model.updateWorldMatrix(true, false); return this.view.model.localToWorld(out.copy(this.U ? this.U.uEng.value : V2));
  }
  /* every frame: wheels, smoke, flames, the fuse, the burst. Returns { burst: true } on the frame the car blows up, { pop: true } when a tyre goes. */
  update(dt) {
    const out = {}; if (!this.parts) return out; this.since += dt; const U = this.U;
    if (this.wheelsInfo) for (let i = 0; i < this.wheelsInfo.length; i++) {                                                  // bent and flat tyres
      const w = this.wheelsInfo[i], d = this.tyre[i], side = w.w.side || (w.x > 0 ? 1 : -1);
      w.w.o.rotation.z = d > 0.3 ? side * -Math.min(0.3, (d - 0.3) * 0.5) : 0; const flat = w.flat ? 1 : clamp((d - 0.55) / 0.45, 0, 0.7); w.w.sag = 0.045 * flat; w.w.o.scale.setScalar(1 - 0.09 * flat);
      if (this.tyreDue[i] >= 0 && this.since >= this.tyreDue[i] && !w.flat) { this.tyre[i] = 1; this.popTyre(i); out.pop = true; }
    }
    if (U) { this.view.model.updateWorldMatrix(true, false); U.uInv.value.copy(this.view.model.matrixWorld).invert(); U.uT.value += dt; }
    if (this.state === 'ok') return out; if (!this.fx) this.fx = new FireFx(this.view.scene); const fx = this.fx, spots = [], eng = this.enginePos(new THREE.Vector3());
    if (this.state === 'smoking') fx.smoke(eng, 6 + 16 * (1 - this.engine / HEALTH.smoke), dt, 0.3, this.engine < HEALTH.smokeBlack ? 0.2 : 0.65);
    else if (this.state === 'dead') { const k = Math.max(0, 1 - (this.since - this.smokeAt) / 90); fx.smoke(eng, 2 + 12 * k, dt, 0.35, 0.3); }
    else if (this.state === 'burning') {
      const tf = this.since; this.burnR = 0.4 + 0.11 * tf; if (U) { U.uR.value = this.burnR; U.uGlow.value = 0.5; }
      const u = Math.min(1, tf / 6), rate = 18 + 40 * u; for (const p of this.flameSpots(3, spots)) fx.flame(p, rate / 3, dt, 0.35 + 0.6 * u); fx.smoke(eng, 26, dt, 0.8, 0.12);
      this.fuse -= dt; if (this.fuse <= 0) { this.burst(eng); out.burst = true; }
    } else if (this.state === 'wrecked') {
      const t = this.since - this.burstAt; this.burnR = Math.min(7, 1.2 + 0.45 * t); if (U) { U.uR.value = this.burnR; U.uGlow.value = Math.max(0, 1 - t / 55); }
      if (t < HEALTH.burnSeconds) { const k = 1 - t / HEALTH.burnSeconds; for (const p of this.flameSpots(3, spots)) fx.flame(p, (6 + 36 * k * k) / 3, dt, 0.25 + 0.7 * k); fx.smoke(eng, 16 + 12 * k, dt, 0.8, 0.1); }
      else if (t < HEALTH.smokeSeconds) fx.smoke(eng, 5 * (1 - (t - HEALTH.burnSeconds) / (HEALTH.smokeSeconds - HEALTH.burnSeconds)), dt, 0.4, 0.2);
    }
    fx.update(dt, (this.state === 'burning' || (this.state === 'wrecked' && this.since - this.burstAt < HEALTH.burnSeconds)) ? eng : null); return out;
  }
  /* the fuel goes: a blast throws off the doors, the bonnet and what is left of the glass and bumpers, the tyres burst (two now, the others as the fire reaches them), the bonnet buckles */
  burst(pos) {
    this.state = 'wrecked'; this.burstAt = this.since; this.fx.blast(pos); this.bulge(pos); if (this.view.def.id !== 'bike') { this.tearDoor('L'); this.tearDoor('R'); }
    this.tearBumper('F'); this.tearBumper('R'); for (let i = 0; i < 4; i++) if (this.glass[i] < 0.8) { this.glass[i] = 1; this.shatter(i); } this.U.uGlass.value.set(1, 1, 1, 1);
    const b = this.box; this.spawn(this.takeTriangles([-0.95, 0.72, b.max.z - 1.6, 0.95, b.max.y + 0.05, b.max.z - 0.45], n => !NAME_RE.test(n), 0.9));                       // the bonnet
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5); this.popTyre(order[0]); this.popTyre(order[1]); this.tyre[order[0]] = this.tyre[order[1]] = 1; this.tyreDue[order[2]] = this.since + 2 + Math.random() * 3; this.tyreDue[order[3]] = this.since + 5 + Math.random() * 6;
    this.ev('blast');
  }
  /* the bonnet buckles up over the engine */
  bulge(pos) {
    const c = this.view.model.worldToLocal(pos.clone()), R = 1.5, R2 = R * R;
    for (const P of this.parts) { let touched = false; for (let i = 0, j = 0; i < P.n; i++, j += 3) { const ex = P.cur[j] - c.x, ez = P.cur[j + 2] - c.z, d2 = ex * ex + ez * ez; if (d2 > R2 || P.cur[j + 1] < c.y - 0.25) continue; const t = 1 - Math.sqrt(d2) / R; P.cur[j + 1] += 0.22 * t * t * (0.7 + 0.6 * hashf(i)); touched = true; } if (touched) this.write(P); }
  }
  write(P) {
    const a = P.g.attributes.position.array, cur = P.cur;
    for (let i = 0; i < P.n; i++) { V.set(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]).applyMatrix4(P.toMesh); a[i * 3] = V.x; a[i * 3 + 1] = V.y; a[i * 3 + 2] = V.z; }
    P.g.attributes.position.needsUpdate = true; if (P.g.index && P.g.attributes.normal) P.g.computeVertexNormals(); P.g.computeBoundingSphere(); P.g.computeBoundingBox();
  }
  repair() {
    if (this.state === 'wrecked') return false;                                                                       // a burnt-out car stays burnt out (choose another vehicle in the garage)
    this.endFire(); this.frame = 1; this.engine = 1; this.state = 'ok'; this.fuse = 0; this.since = 0; this.glass = [0, 0, 0, 0]; this.doors = { L: true, R: true }; this.bumpers = { F: true, R: true }; this.tyre = [0, 0, 0, 0]; this.tyreDue = [-1, -1, -1, -1]; this.burnR = 0;
    if (this.U) { this.U.uR.value = 0; this.U.uGlow.value = 0; this.U.uGlass.value.set(0, 0, 0, 0); }
    if (this.wheelsInfo) for (const w of this.wheelsInfo) { w.flat = false; w.w.sag = 0; w.w.o.scale.setScalar(1); w.w.o.rotation.z = 0; }
    if (this.parts) for (const P of this.parts) { P.cur.set(P.orig); P.tot.fill(0); if (P.idx0) { P.g.index.array.set(P.idx0); P.g.index.needsUpdate = true; } this.write(P); }
    this.zone = { front: 0, rear: 0, left: 0, right: 0 }; this.hits = 0; return true;
  }
  endFire() { if (this.fx) { this.fx.dispose(); this.fx = null; } }
  dispose() { this.endFire(); if (this.copies) for (const c of this.copies) c.dispose(); this.copies = null; if (!this.parts) return; for (const P of this.parts) P.g.dispose(); this.parts = null; }
}

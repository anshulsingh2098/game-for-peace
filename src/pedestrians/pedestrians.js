/* Pedestrians you see: draws the walkers of the simulation (sim.js) as four instanced meshes (torso, head and two legs that swing as they walk), tinted per person. They are simple on
   purpose: one box figure, a handful of clothes colours and skin tones, no models yet (the asset job will bring real rigged people). About four draw calls however many are alive. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PedSim, POOL } from './sim.js';
import { PlayerFigure } from '../player/exitseq.js';
import { RagdollSystem, carTouches, HIT } from './ragdoll.js';
/* Cartoon people (assets/npc, built by dev/build_npc_stylised.py): the ACTORS nearest walkers within NEAR metres are drawn as skinned, animated characters (commuter, vendor, tourist);
   everyone else stays a cheap box figure. If the models fail to load the box figures are used for everybody. */
const ACTORS = 18, NEAR = 60, VARIANTS = ['commuter', 'man_kurta', 'woman_kurti', 'woman_top', 'elder', 'vendor', 'tourist'];
/* who wears what: a model by the person's number (about a third each of men in shirts or kurtas, women in kurtis or tops, a few elders), and colours by the same number, so the crowd is varied but every person keeps their look */
const MODEL_OF = [0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 4], SKIN_TONES = [0xf0c8a0, 0xd9a273, 0xc58a5a, 0xa8714a, 0x8d5a3a, 0x6f4429, 0xe0b48c, 0xb98058], HAIRS = [0x15110e, 0x1c1411, 0x241a14, 0x2b1f17, 0x120d0b];
const BOTTOMS = [0x2b3a52, 0x35507a, 0x1f2430, 0x4a4a48, 0x6a5f4a, 0x3d4a5c], KURTAS = [0xe8e0c8, 0xf0eee6, 0x9fb8d9, 0x8fb996, 0xd9a89a, 0xc9b8e0, 0xe9d6a8], ACCENTS = [0xc8321f, 0xe3b21a, 0x2a64c9, 0x2f8f5b, 0x8e4f9e, 0x16181d];
const CLOTHES = [0xc94f3a, 0x2f6fa8, 0xf0b429, 0x3f9d6a, 0x8e4f9e, 0xe9e2d2, 0x2b3a67, 0xd9772f, 0x555b61, 0xb23a6a, 0x6fa8a0, 0xf2ece0].flatMap(c => [c, c]);
const SKIN = [0xf0c8a0, 0xd9a273, 0xc58a5a, 0xa8714a, 0x8d5a3a, 0x6f4429, 0xe0b48c, 0xb98058];
const TROUSERS = [0x2a3550, 0x3b3b40, 0x6b5a42, 0x23262c, 0x4a4f58, 0x1f2a44, 0x7a6a50], HAIR = [0x16120e, 0x1e1710, 0x2a1d12, 0x111111, 0x3a2a1a, 0x4a4a4a];
const SHOW = 150;                                                                                          // metres: farther walkers are not drawn
export class Pedestrians {
  constructor(scene, nav, seed, origin, { density = 0.5, archetypes = ['commuter'], level = 'mid', traffic = null } = {}) {
    this.scene = scene; this.origin = origin; this.sim = new PedSim(nav, { seed, density, archetypes, level, traffic }); this.group = new THREE.Group(); scene.add(this.group);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, envMapIntensity: 0.4 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9, metalness: 0 });
    const torso = new THREE.BoxGeometry(0.28, 0.62, 0.5), head = new THREE.BoxGeometry(0.22, 0.26, 0.22), leg = new THREE.BoxGeometry(0.16, 0.8, 0.16), arm = new THREE.BoxGeometry(0.1, 0.58, 0.1), hair = new THREE.BoxGeometry(0.245, 0.11, 0.245); leg.translate(0, -0.4, 0); arm.translate(0, -0.29, 0);      /* phase 11b (GTA gap list item 5): far figures got swinging arms, coloured trousers and hair */
    this.mats = [mat, dark]; this.geos = [torso, head, leg, arm, hair];
    const mk = (g, m, tint) => { const im = new THREE.InstancedMesh(g, m, POOL); im.count = 0; im.frustumCulled = false; im.castShadow = true; if (tint) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(POOL * 3), 3); this.group.add(im); return im; };
    this.torso = mk(torso, mat, true); this.head = mk(head, mat, true); this.legL = mk(leg, mat, true); this.legR = mk(leg, mat, true); this.armL = mk(arm, mat, true); this.armR = mk(arm, mat, true); this.hair = mk(hair, mat, true); this.all = [this.torso, this.head, this.legL, this.legR, this.armL, this.armR, this.hair]; for (const im of [this.armL, this.armR, this.hair]) im.castShadow = false;      /* too small to matter in the shadow map: saves three shadow-pass draws */
    this.rag = new RagdollSystem(scene, origin, PlayerFigure); this.onRemove = null;
    this.actors = []; this.models = new Array(VARIANTS.length).fill(null); this.loadModels();
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.q2 = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.one = new THREE.Vector3(1, 1, 1); this.c = new THREE.Color(); this.axisY = new THREE.Vector3(0, 1, 0); this.axisZ = new THREE.Vector3(0, 0, 1);
  }
  loadModels() {
    const loader = new GLTFLoader();
    VARIANTS.forEach((v, i) => loader.load('assets/npc/npc_' + v + '_lod1.glb', g => { this.models[i] = g; if (!this.actors.length && this.models.every(Boolean)) this.makeActors(); }, undefined, () => {}));
  }
  makeActors() {
    for (let i = 0; i < ACTORS; i++) {
      const variant = i % VARIANTS.length, g = this.models[variant], obj = SkeletonUtils.clone(g.scene), mixer = new THREE.AnimationMixer(obj);
      const clip = n => g.animations.find(c => c.name === n) || g.animations.find(c => c.name.toLowerCase().includes(n.toLowerCase()));
      const act = n => { const c = clip(n); if (!c) return null; const x = mixer.clipAction(c); x.play(); x.weight = 0; return { x, dur: c.duration }; }, A = { walk: act('Walk'), run: act('Run'), idle: act('Idle'), look: act('IdleLook'), wait: act('Wait') }; A.idle.x.weight = 1;
      const mats = {}; obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; const own = [].concat(o.material).map(m => { const c = m.clone(); (mats[m.name] = mats[m.name] || []).push(c); return c; }); o.material = Array.isArray(o.material) ? own : own[0]; } });
      obj.visible = false; this.group.add(obj);
      this.actors.push({ obj, mixer, A, mats, variant, p: null, w: { walk: 0, run: 0, idle: 1, look: 0, wait: 0 }, init: false });
    }
  }
  wantVariant(p) { return p.arch === 'vendor' ? 5 : p.arch === 'tourist' ? 6 : MODEL_OF[(p.colour | 0) % MODEL_OF.length]; }
  /* skin, clothes and hair of one person, from their number (p.colour, p.skin) and, in the city, the clothes the area suggests (p.cloth) */
  tint(a, p) {
    const k = (p.colour | 0) + 7 * ((p.skin | 0) + 1), pick = (list, n) => list[Math.abs(Math.floor(n)) % list.length], set = (name, hex) => { for (const m of a.mats[name] || []) m.color.setHex(hex); };
    const tourist = a.variant === 6, own = a.variant >= 4;                                                      // elders, vendors and tourists keep the clothes they were made in
    set('Skin', tourist ? pick([0xe0b295, 0xf0c8a0, 0xd9a273], k) : pick(SKIN_TONES, p.skin | 0));
    if (a.variant !== 4) set('Hair', pick(HAIRS, k * 3));
    if (!own) { set('Top', a.variant === 1 ? pick(KURTAS, k * 5) : (p.cloth !== undefined ? p.cloth : pick(KURTAS.concat([0xc94f3a, 0x2f6fa8, 0xf0b429, 0x3f9d6a, 0x8e4f9e, 0x2b3a67, 0xd9772f]), k * 5))); set('Bottom', a.variant === 1 ? 0xf1efe8 : pick(BOTTOMS, k * 11)); set('Accent', pick(ACCENTS, k * 13)); }
  }
  assignActors(player) {
    const near = []; for (const p of this.sim.list) { if (p.gone) continue; const d = Math.hypot(p.x - player.x, p.z - player.z); if (d < NEAR) near.push([d, p]); }
    near.sort((a, b) => a[0] - b[0]); const chosen = new Set(near.slice(0, this.actors.length).map(e => e[1]));
    for (const a of this.actors) if (a.p && !chosen.has(a.p)) { if (a.p.__a === a) a.p.__a = null; a.p = null; a.obj.visible = false; }
    for (const p of chosen) { if (p.__a && p.__a.p === p) continue; const w = this.wantVariant(p), a = this.actors.find(x => !x.p && x.variant === w) || this.actors.find(x => !x.p); if (a) { a.p = p; p.__a = a; a.init = false; this.tint(a, p); } }
  }
  /* each walker's animation: the clips run on the distance the walker has really covered (one Walk cycle per 1.45 m, one Run cycle per 3 m), so the feet do not slide whatever speed the simulation uses; Walk, Run, Idle, Wait
     (at a kerb: a foot taps) and now and then IdleLook blend over about a seventh of a second; the body turns toward its heading smoothly instead of snapping at a corner; each walker has its own idle timing. */
  poseActors(o) {
    const now = performance.now() / 1000, dt = Math.min(0.1, Math.max(0.001, now - (this._now || now))); this._now = now;
    for (const a of this.actors) {
      const p = a.p; if (!p) continue; const A = a.A, W = a.w;
      if (!a.init) { a.init = true; a.lx = p.x; a.lz = p.z; a.rot = Math.PI / 2 - p.yaw; a.y = p.y + 0.16; a.dist = Math.random() * 3; a.spd = 0; a.off = Math.random() * 20; a.nextLook = now + 3 + Math.random() * 8; a.lookEnd = 0; a.lookStart = 0; }
      const step = Math.hypot(p.x - a.lx, p.z - a.lz); a.lx = p.x; a.lz = p.z; const ok = step < 2.5;                                  // a jump (a teleport, a respawn) is not a step
      if (ok) { a.dist += step; a.spd += (step / dt - a.spd) * Math.min(1, dt * 8); } else a.spd = 0;
      const moving = a.spd > 0.2, run = a.spd > 2.6, waiting = !moving && p.state === 'wait';
      if (moving) a.lookEnd = 0; else if (!waiting && now > a.nextLook && a.lookEnd === 0 && A.look) { a.lookStart = now; a.lookEnd = now + A.look.dur; a.nextLook = a.lookEnd + 6 + Math.random() * 12; }
      const looking = !moving && !waiting && now < a.lookEnd, want = { walk: moving && !run ? 1 : 0, run: moving && run && A.run ? 1 : 0, idle: !moving && !waiting && !looking ? 1 : 0, look: looking ? 1 : 0, wait: waiting && A.wait ? 1 : 0 };
      if (moving && run && !A.run) want.walk = 1; if (waiting && !A.wait) want.idle = 1;
      let sum = 0; for (const n in want) { W[n] += (want[n] - W[n]) * Math.min(1, dt * 7); sum += W[n]; } sum = sum || 1;
      for (const n in A) if (A[n]) A[n].x.weight = W[n] / sum;
      A.walk.x.time = ((a.dist / 1.45) % 1) * A.walk.dur; if (A.run) A.run.x.time = ((a.dist / 3.0) % 1) * A.run.dur; A.idle.x.time = (now + a.off) % A.idle.dur; if (A.wait) A.wait.x.time = (now + a.off) % A.wait.dur; if (A.look) A.look.x.time = Math.max(0, now - a.lookStart) % A.look.dur;
      a.mixer.update(0);
      let d = (Math.PI / 2 - p.yaw) - a.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); a.rot += d * Math.min(1, dt * (moving ? 9 : 5)); a.y += (p.y + 0.16 - a.y) * Math.min(1, dt * 14);
      a.obj.position.set(p.x - o.x, a.y, p.z - o.z); a.obj.rotation.y = a.rot; a.obj.visible = true;
    }
  }
  /* every frame: the car (or null when the player is on foot) may hit walkers, which then fall as ragdolls (src/pedestrians/ragdoll.js). Returns the hits: [{ speed, fatal }] */
  physics(dt, car) {
    const hits = []; const sp = car ? Math.hypot(car.u, car.v) : 0;
    if (car && sp >= HIT.minSpeed && this.models.every(Boolean)) {
      for (const p of this.sim.list) {
        if (p.gone || !carTouches(car, p.x, p.z, p.y)) continue;
        const fl = this.rag.spawn({ x: p.x, z: p.z, y: p.y, yaw: p.yaw }, this.models[this.wantVariant(p)], car); if (!fl) break;
        p.gone = true; if (this.onRemove) this.onRemove(p); hits.push({ speed: sp, fatal: fl.fatal });
      }
    }
    this.rag.update(dt, car); return hits;
  }
  setLevel(level) { this.sim.setLevel(level); }
  get level() { return this.sim.level; }
  update(dt, player, time) { this.sim.update(dt, player, time); this.draw(player); }
  draw(player) {
    const o = this.origin; let n = 0; if (this.actors.length) { this.assignActors(player); this.poseActors(o); }
    for (const p of this.sim.list) {
      if (p.gone || Math.hypot(p.x - player.x, p.z - player.z) > SHOW) continue; if (p.__a && p.__a.p === p) continue; const walking = (p.state === 'walk' || p.state === 'cross') && !p.frozen, sw = walking ? Math.sin(p.phase) * 0.65 : 0, bob = walking ? Math.abs(Math.sin(p.phase)) * 0.03 : 0, y = p.y + 0.16;
      this.q.setFromAxisAngle(this.axisY, -p.yaw);
      const put = (im, px, py, pz, rz) => { this.q2.setFromAxisAngle(this.axisZ, rz); this.q2.premultiply(this.q); this.v.set(px, py, pz); this.m.compose(this.v, this.q2, this.one); im.setMatrixAt(n, this.m); };
      const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw), sx = -fz, sz = fx, X = p.x - o.x, Z = p.z - o.z;                         // forward and sideways in the ground plane
      const at = (side, up) => [X + sx * side, y + up + bob, Z + sz * side];
      let a = at(0, 1.12); put(this.torso, a[0], a[1], a[2], 0); a = at(0, 1.58); put(this.head, a[0], a[1], a[2], 0);
      a = at(-0.1, 0.8); put(this.legL, a[0], a[1], a[2], sw); a = at(0.1, 0.8); put(this.legR, a[0], a[1], a[2], -sw);
      a = at(-0.3, 1.4); put(this.armL, a[0], a[1], a[2], -sw * 0.9); a = at(0.3, 1.4); put(this.armR, a[0], a[1], a[2], sw * 0.9); a = at(0, 1.74); put(this.hair, a[0], a[1], a[2], 0);
      const cl = p.cloth !== undefined ? p.cloth : CLOTHES[p.colour % CLOTHES.length], tr = TROUSERS[((p.colour | 0) * 7 + (p.skin | 0)) % TROUSERS.length], sk = SKIN[p.skin % SKIN.length];
      this.torso.setColorAt(n, this.c.setHex(cl)); this.head.setColorAt(n, this.c.setHex(sk)); this.legL.setColorAt(n, this.c.setHex(tr)); this.legR.setColorAt(n, this.c.setHex(tr)); this.armL.setColorAt(n, this.c.setHex(cl)); this.armR.setColorAt(n, this.c.setHex(cl)); this.hair.setColorAt(n, this.c.setHex(HAIR[((p.skin | 0) * 3 + (p.colour | 0)) % HAIR.length])); n++;
    }
    for (const im of this.all) { im.count = n; im.visible = n > 0; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
  dispose() { this.rag.dispose(); this.sim.clear(); this.scene.remove(this.group); for (const a of this.actors) a.mixer.stopAllAction(); for (const im of this.all) im.dispose(); for (const g of this.geos) g.dispose(); for (const m of this.mats) m.dispose(); }
}

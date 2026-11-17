/* Pedestrians you see: draws the walkers of the simulation (sim.js) as four instanced meshes (torso, head and two legs that swing as they walk), tinted per person. They are simple on
   purpose: one box figure, a handful of clothes colours and skin tones, no models yet (the asset job will bring real rigged people). About four draw calls however many are alive. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PedSim, POOL } from './sim.js';
/* Cartoon people (assets/npc, built by dev/build_npc_stylised.py): the ACTORS nearest walkers within NEAR metres are drawn as skinned, animated characters (commuter, vendor, tourist);
   everyone else stays a cheap box figure. If the models fail to load the box figures are used for everybody. */
const ACTORS = 18, NEAR = 60, VARIANTS = ['commuter', 'vendor', 'tourist'];
const CLOTHES = [0xc94f3a, 0x2f6fa8, 0xf0b429, 0x3f9d6a, 0x8e4f9e, 0xe9e2d2, 0x2b3a67, 0xd9772f, 0x555b61, 0xb23a6a, 0x6fa8a0, 0xf2ece0].flatMap(c => [c, c]);
const SKIN = [0xf0c8a0, 0xd9a273, 0xc58a5a, 0xa8714a, 0x8d5a3a, 0x6f4429, 0xe0b48c, 0xb98058];
const SHOW = 150;                                                                                          // metres: farther walkers are not drawn
export class Pedestrians {
  constructor(scene, nav, seed, origin, { density = 0.5, archetypes = ['commuter'], level = 'mid', traffic = null } = {}) {
    this.scene = scene; this.origin = origin; this.sim = new PedSim(nav, { seed, density, archetypes, level, traffic }); this.group = new THREE.Group(); scene.add(this.group);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, envMapIntensity: 0.4 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9, metalness: 0 });
    const torso = new THREE.BoxGeometry(0.28, 0.62, 0.5), head = new THREE.BoxGeometry(0.22, 0.26, 0.22), leg = new THREE.BoxGeometry(0.16, 0.8, 0.16); leg.translate(0, -0.4, 0);
    this.mats = [mat, dark]; this.geos = [torso, head, leg];
    const mk = (g, m, tint) => { const im = new THREE.InstancedMesh(g, m, POOL); im.count = 0; im.frustumCulled = false; im.castShadow = true; if (tint) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(POOL * 3), 3); this.group.add(im); return im; };
    this.torso = mk(torso, mat, true); this.head = mk(head, mat, true); this.legL = mk(leg, dark, false); this.legR = mk(leg, dark, false);
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
      const walk = mixer.clipAction(clip('Walk')), idle = mixer.clipAction(clip('Idle')); walk.play(); idle.play();
      obj.visible = false; obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); this.group.add(obj);
      this.actors.push({ obj, mixer, walk, idle, variant, p: null, dur: walk.getClip().duration });
    }
  }
  wantVariant(p) { return p.arch === 'vendor' ? 1 : p.arch === 'tourist' ? 2 : (p.colour | 0) % VARIANTS.length; }
  assignActors(player) {
    const near = []; for (const p of this.sim.list) { const d = Math.hypot(p.x - player.x, p.z - player.z); if (d < NEAR) near.push([d, p]); }
    near.sort((a, b) => a[0] - b[0]); const chosen = new Set(near.slice(0, this.actors.length).map(e => e[1]));
    for (const a of this.actors) if (a.p && !chosen.has(a.p)) { if (a.p.__a === a) a.p.__a = null; a.p = null; a.obj.visible = false; }
    for (const p of chosen) { if (p.__a && p.__a.p === p) continue; const w = this.wantVariant(p), a = this.actors.find(x => !x.p && x.variant === w) || this.actors.find(x => !x.p); if (a) { a.p = p; p.__a = a; } }
  }
  poseActors(o) {
    const t = performance.now() / 1000;
    for (const a of this.actors) { const p = a.p; if (!p) continue; const walking = (p.state === 'walk' || p.state === 'cross') && !p.frozen;
      a.walk.weight = walking ? 1 : 0; a.idle.weight = walking ? 0 : 1; a.walk.time = (((p.phase || 0) / (2 * Math.PI)) % 1) * a.dur; a.idle.time = t % a.idle.getClip().duration; a.mixer.update(0);
      a.obj.position.set(p.x - o.x, p.y + 0.16, p.z - o.z); a.obj.rotation.y = Math.PI / 2 - p.yaw; a.obj.visible = true; }
  }
  setLevel(level) { this.sim.setLevel(level); }
  get level() { return this.sim.level; }
  update(dt, player, time) { this.sim.update(dt, player, time); this.draw(player); }
  draw(player) {
    const o = this.origin; let n = 0; if (this.actors.length) { this.assignActors(player); this.poseActors(o); }
    for (const p of this.sim.list) {
      if (Math.hypot(p.x - player.x, p.z - player.z) > SHOW) continue; if (p.__a && p.__a.p === p) continue; const walking = (p.state === 'walk' || p.state === 'cross') && !p.frozen, sw = walking ? Math.sin(p.phase) * 0.65 : 0, bob = walking ? Math.abs(Math.sin(p.phase)) * 0.03 : 0, y = p.y + 0.16;
      this.q.setFromAxisAngle(this.axisY, -p.yaw);
      const put = (im, px, py, pz, rz) => { this.q2.setFromAxisAngle(this.axisZ, rz); this.q2.premultiply(this.q); this.v.set(px, py, pz); this.m.compose(this.v, this.q2, this.one); im.setMatrixAt(n, this.m); };
      const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw), sx = -fz, sz = fx, X = p.x - o.x, Z = p.z - o.z;                         // forward and sideways in the ground plane
      const at = (side, up) => [X + sx * side, y + up + bob, Z + sz * side];
      let a = at(0, 1.12); put(this.torso, a[0], a[1], a[2], 0); a = at(0, 1.58); put(this.head, a[0], a[1], a[2], 0);
      a = at(-0.1, 0.8); put(this.legL, a[0], a[1], a[2], sw); a = at(0.1, 0.8); put(this.legR, a[0], a[1], a[2], -sw);
      this.torso.setColorAt(n, this.c.setHex(p.cloth !== undefined ? p.cloth : CLOTHES[p.colour % CLOTHES.length])); this.head.setColorAt(n, this.c.setHex(SKIN[p.skin % SKIN.length])); n++;
    }
    for (const im of [this.torso, this.head, this.legL, this.legR]) { im.count = n; im.visible = n > 0; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
  dispose() { this.sim.clear(); this.scene.remove(this.group); for (const a of this.actors) a.mixer.stopAllAction(); for (const im of [this.torso, this.head, this.legL, this.legR]) im.dispose(); for (const g of this.geos) g.dispose(); for (const m of this.mats) m.dispose(); }
}

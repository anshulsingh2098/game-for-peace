/* Getting out of the car, as a short animation: the character reaches for the handle, the driver's door swings open, they climb out and step beside the car, turn, push the door shut,
   and then control passes to the on-foot player. The character is the cartoon rig of assets/npc (built by dev/build_npc_stylised.py).
   The skeleton is posed from code, in character space (x right, y up, z forward, the character faces +z): a pose gives, per bone, a rotation applied on top of its parent's, so "thigh forward -1.4"
   means the same whatever the bone's own axes are. Browser only (it loads a model). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

let cached = null;
export function loadPlayerModel() { return cached || (cached = new Promise((ok, no) => new GLTFLoader().load('assets/npc/npc_commuter.glb', ok, undefined, no))); }

const E = new THREE.Euler(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), Q3 = new THREE.Quaternion();
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/* the cartoon character: a skinned model with Walk and Idle clips for on-foot play, and code-driven poses for scripted moments */
export class PlayerFigure {
  constructor(gltf) {
    this.obj = SkeletonUtils.clone(gltf.scene); this.obj.updateMatrixWorld(true);
    this.obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    this.mixer = new THREE.AnimationMixer(this.obj);
    const clip = n => gltf.animations.find(c => c.name.toLowerCase() === n) || gltf.animations.find(c => c.name.toLowerCase().includes(n));
    this.walk = this.mixer.clipAction(clip('walk')); this.idle = this.mixer.clipAction(clip('idle')); this.walk.play(); this.idle.play(); this.dur = this.walk.getClip().duration; this.idleDur = this.idle.getClip().duration;
    const rc = clip('run'), lc = clip('idlelook'); this.run = rc ? this.mixer.clipAction(rc) : null; this.look = lc ? this.mixer.clipAction(lc) : null; if (this.run) { this.run.play(); this.runDur = rc.duration; } if (this.look) { this.look.play(); this.lookDur = lc.duration; }
    this.w = { walk: 0, run: 0, idle: 1, look: 0 }; this.still = 0; this.lookAt = 0; this.lookEnd = 0;
    this.bones = []; this.byName = {}; const inv = this.obj.matrixWorld.clone().invert(), tmp = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3();
    this.obj.traverse(o => { if (o.isBone) { tmp.multiplyMatrices(inv, o.matrixWorld); const w = new THREE.Quaternion(); tmp.decompose(p, w, s); const rec = { bone: o, name: o.name, restW: w, parent: null, cum: new THREE.Quaternion(), world: new THREE.Quaternion() }; this.bones.push(rec); this.byName[o.name] = rec; } });
    for (const b of this.bones) { const pp = b.bone.parent; b.parent = pp && pp.isBone ? this.byName[pp.name] : null; if (!b.parent && pp) { tmp.multiplyMatrices(inv, pp.matrixWorld); const w = new THREE.Quaternion(); tmp.decompose(p, w, s); b.parentW = w; } }
    this.scripted = false; this.clock = 0;
  }
  /* on-foot: the clips follow the distance walked (`phase` is the stride phase of the on-foot controller, 2.2 per metre), so the feet do not slide: one Walk cycle (two steps) per 1.45 m, one Run cycle per 3 m. Walk, Run,
     Idle and now and then IdleLook blend into one another over about a seventh of a second instead of cutting. */
  update(dt, moving, phase, run = false) {
    this.clock += dt; if (this.scripted) return; const dist = (phase || 0) / 2.2, W = this.w, k = Math.min(1, dt * 7);
    this.still = moving ? 0 : this.still + dt; if (!moving) { if (this.still > 5 && this.clock > this.lookAt && this.look) { this.lookAt = this.clock + 8 + Math.random() * 10; this.lookEnd = this.clock + this.lookDur; this.lookStart = this.clock; } } else this.lookEnd = 0;
    const looking = this.clock < this.lookEnd && !moving, want = { walk: moving && !(run && this.run) ? 1 : 0, run: moving && run && this.run ? 1 : 0, idle: !moving && !looking ? 1 : 0, look: looking ? 1 : 0 };
    for (const n of ['walk', 'run', 'idle', 'look']) W[n] += (want[n] - W[n]) * k;
    const sum = (W.walk + W.run + W.idle + W.look) || 1; this.walk.weight = W.walk / sum; this.idle.weight = W.idle / sum; if (this.run) this.run.weight = W.run / sum; if (this.look) this.look.weight = W.look / sum;
    this.walk.time = ((dist / 1.45) % 1) * this.dur; if (this.run) this.run.time = ((dist / 3.0) % 1) * this.runDur; this.idle.time = this.clock % this.idleDur; if (this.look) this.look.time = Math.max(0, this.clock - (this.lookStart || 0)) % this.lookDur; this.mixer.update(0);
  }
  /* scripted pose: deltas = { boneName: [rx, ry, rz] } in character space, each relative to the parent bone's own motion */
  pose(deltas) {
    this.scripted = true; this.walk.weight = 0; this.idle.weight = 0;
    for (const b of this.bones) {                                                                                              // bones are stored parent first
      const d = deltas[b.name];
      if (d) { E.set(d[0], d[1], d[2], 'XYZ'); Q.setFromEuler(E); } else Q.identity();
      if (b.parent) b.cum.copy(b.parent.cum).multiply(Q); else b.cum.copy(Q);
      b.world.copy(b.cum).multiply(b.restW);
      const pw = b.parent ? b.parent.world : (b.parentW || Q3.identity());
      b.bone.quaternion.copy(Q2.copy(pw).invert()).multiply(b.world);
    }
  }
  release() { this.scripted = false; }
}

const SEAT = { UpperLeg_L: [-1.45, 0, 0], UpperLeg_R: [-1.45, 0, 0], LowerLeg_L: [1.5, 0, 0], LowerLeg_R: [1.5, 0, 0], Foot_L: [-0.1, 0, 0], Foot_R: [-0.1, 0, 0], UpperArm_L: [-1.0, 0, 0], UpperArm_R: [-1.0, 0, 0], LowerArm_L: [-0.7, 0, 0], LowerArm_R: [-0.7, 0, 0], Spine: [-0.05, 0, 0] };
const REACH = { ...SEAT, UpperArm_R: [-0.55, 0, -0.95], LowerArm_R: [-0.45, 0, 0], Spine: [-0.08, -0.4, 0], Head: [0, -0.25, 0] };
const RISE = { ...SEAT, UpperLeg_L: [-0.7, 0, 0], UpperLeg_R: [-0.95, 0, 0], LowerLeg_L: [0.7, 0, 0], LowerLeg_R: [1.0, 0, 0], Spine: [-0.35, -0.3, 0], UpperArm_R: [-0.5, 0, -0.5], LowerArm_R: [-0.3, 0, 0], UpperArm_L: [-0.4, 0, 0.1], LowerArm_L: [-0.3, 0, 0], Head: [0.1, -0.2, 0] };
const STAND = { Spine: [-0.1, 0, 0], UpperArm_L: [0.05, 0, 0.05], UpperArm_R: [0.05, 0, -0.05], LowerArm_L: [-0.15, 0, 0], LowerArm_R: [-0.15, 0, 0] };
const PUSH = { Spine: [-0.1, 0.1, 0], UpperArm_R: [-1.2, 0, -0.35], LowerArm_R: [-0.25, 0, 0], UpperArm_L: [0.05, 0, 0.05], LowerArm_L: [-0.15, 0, 0], Head: [0, 0.15, 0] };

function mix(a, b, t) {
  const out = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[k] || [0, 0, 0], y = b[k] || [0, 0, 0]; out[k] = [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]; }
  return out;
}
const TIMES = { reach: 0.45, open: 0.5, rise: 0.55, step: 0.65, turn: 0.4, push: 0.25, close: 0.55, settle: 0.35 };
export const EXIT_TIME = Object.values(TIMES).reduce((a, b) => a + b, 0);

/* the swinging driver's door: a painted panel and a window, hinged at its front edge, with a dark opening shown behind it */
class Door {
  constructor(view, def, side) {
    this.side = side; const body = def.body, halfW = body.track / 2 + 0.17, eye = def.eye, len = 1.0, zc = eye[2] - 0.02, y0 = 0.34, belt = Math.max(0.78, eye[1] - 0.42), top = eye[1] + 0.12;
    this.halfW = halfW; this.hingeZ = zc + len / 2; this.group = new THREE.Group(); this.group.position.set(side * (halfW - 0.015), 0, this.hingeZ); this.group.visible = false;
    let paint = null; view.model.traverse(o => { if (!paint && o.isMesh) [].concat(o.material).forEach(m => { if (!paint && /^Paint/.test(m.name)) paint = m; }); });
    this.mats = [(paint ? paint.clone() : new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4 })), new THREE.MeshStandardMaterial({ color: 0x0b0f16, roughness: 0.05, metalness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x14151a, roughness: 0.8 })];
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, belt - y0, len), this.mats[0]), win = new THREE.Mesh(new THREE.BoxGeometry(0.045, top - belt, len * 0.88), this.mats[1]);
    panel.position.set(0, (y0 + belt) / 2, -len / 2); win.position.set(0, (belt + top) / 2, -len / 2 - 0.02); for (const m of [panel, win]) { m.castShadow = true; this.group.add(m); }
    this.hole = new THREE.Mesh(new THREE.BoxGeometry(0.02, top - y0, len), this.mats[2]); this.hole.position.set(side * (halfW - 0.09), (y0 + top) / 2, zc); this.hole.visible = false;
    view.model.add(this.group, this.hole); this.view = view; this.maxAngle = 1.3;
  }
  set(angle) { this.group.visible = this.hole.visible = angle > 0.001; this.group.rotation.y = -this.side * angle; }
  dispose() { this.view.model.remove(this.group, this.hole); for (const m of this.mats) m.dispose(); for (const o of [this.group, this.hole]) o.traverse(c => { if (c.geometry) c.geometry.dispose(); }); }
}

export class ExitSequence {
  /* view: the vehicle view (model, def), gltf: the player's model, spot: where the character ends up in world metres { x, z, y }, origin: the floating origin, onDone(figure) */
  constructor({ view, gltf, spot, origin, onDone }) {
    this.view = view; this.def = view.def; this.onDone = onDone; this.t = 0; this.done = false; this.figure = new PlayerFigure(gltf);
    const model = view.model; model.updateWorldMatrix(true, false);
    // the driver sits on the side the eye point is on (model +x is the vehicle's left); the door is that side
    this.side = (this.def.eye[0] || -0.3) < 0 ? -1 : 1; this.door = new Door(view, this.def, this.side);
    const eye = this.def.eye; this.seat = new THREE.Vector3(eye[0], eye[1] - 1.53, eye[2] - 0.05);
    const out = model.worldToLocal(new THREE.Vector3(spot.x - origin.x, spot.y, spot.z - origin.z)); this.target = new THREE.Vector3(out.x, 0, out.z); this.ground = out.y;
    // a waypoint just inside the opening: over the sill, level with the seat
    this.sill = new THREE.Vector3(this.side * (this.door.halfW - 0.15), eye[1] - 1.53 + 0.1, this.door.hingeZ - 0.55);
    this.figure.obj.position.copy(this.seat); this.figure.obj.rotation.y = 0; model.add(this.figure.obj); this.figure.pose(SEAT);
    this.T = []; let a = 0; for (const k of ['reach', 'open', 'rise', 'step', 'turn', 'push', 'close', 'settle']) { this.T.push([k, a, a + TIMES[k]]); a += TIMES[k]; }
  }
  phase(name) { const p = this.T.find(x => x[0] === name); return smooth((this.t - p[1]) / (p[2] - p[1])); }
  update(dt) {
    if (this.done) return; this.t += dt; const f = this.figure, o = f.obj, P = n => this.phase(n), t = this.t, side = this.side;
    let pose, yaw = 0; const pos = o.position;
    const r = P('reach'), op = P('open'), ri = P('rise'), st = P('step'), tu = P('turn'), pu = P('push'), cl = P('close'), se = P('settle');
    this.door.set(this.door.maxAngle * (op * (1 - cl)));
    if (t < this.T[2][1]) { pose = mix(SEAT, REACH, r); pos.copy(this.seat); }                                                  // reach for the handle while the door swings open
    else if (t < this.T[3][1]) { pose = mix(REACH, RISE, ri); pos.lerpVectors(this.seat, this.sill, ri); pos.y += Math.sin(ri * Math.PI) * 0.12; }          // rise and slide to the sill
    else if (t < this.T[4][1]) {                                                                                                                        // stand up and step out beside the car
      const sw = Math.sin(st * Math.PI * 2) * 0.55; pose = mix(RISE, STAND, Math.min(1, st * 1.6));
      pose.UpperLeg_L = [sw, 0, 0]; pose.UpperLeg_R = [-sw, 0, 0]; pose.LowerLeg_L = [Math.max(0, -sw) * 0.9, 0, 0]; pose.LowerLeg_R = [Math.max(0, sw) * 0.9, 0, 0];
      pos.lerpVectors(this.sill, new THREE.Vector3(this.target.x, this.ground, this.target.z), st); pos.y = this.sill.y + (this.ground - this.sill.y) * smooth(st * 1.2) + Math.sin(st * Math.PI) * 0.05; }
    else {                                                                                                                                              // turn to the door, push it shut, settle
      pos.set(this.target.x, this.ground, this.target.z); yaw = -side * (Math.PI / 2) * tu * (1 - se);
      pose = t > this.T[6][1] ? mix(PUSH, STAND, se) : mix(STAND, PUSH, pu * 0.9); }
    o.rotation.y = yaw; f.pose(pose);
    if (t >= EXIT_TIME) { this.finish(); }
  }
  finish() { if (this.done) return; this.done = true; this.door.set(0); this.door.dispose(); const f = this.figure; f.obj.parent && f.obj.parent.remove(f.obj); f.release(); this.onDone(f); }
  cancel() { if (this.done) return; this.done = true; this.door.dispose(); const f = this.figure; f.obj.parent && f.obj.parent.remove(f.obj); }
}

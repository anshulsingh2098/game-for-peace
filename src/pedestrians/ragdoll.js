/* Ragdolls for the cartoon people. When the player's car hits a walker, the walker leaves the pedestrian simulation and becomes eleven rigid bodies (pelvis, torso, head, two arms of two parts each,
   two legs of two parts each) joined at the shoulders, hips, neck and waist (ball joints) and the elbows and knees (hinges with limits), in a Rapier world of their own. The car is a kinematic box in that
   world, so a body thrown on the bonnet slides and rolls off it. Every frame the bodies' orientations are written onto the skinned model's bones.
   How hard the hit is comes from the car's speed: slow (a bump) drops the walker, medium launches them over the bonnet and they get up hurt and stagger off, fast (about 80 km/h or more) kills them.
   The walker stays down for a while, then fades. Browser only (it needs the rig of the loaded model); the physics itself needs no DOM. */
import * as THREE from 'three';
import RAPIER from '../../vendor/rapier/rapier.mjs';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const HIT = { dieFrom: 9, dieAll: 22, minSpeed: 0.6, maxActive: 5, deadStay: 14, fade: 0.7, restBeforeGetUp: 1.0, getUp: 1.1, runAway: 4, gravity: 9.81 };
const H = 1 / 120, CAR = 1 << 10;                                    // collision groups are 16 bits: ragdoll slots use bits 0 to 4, their grounds bits 5 to 9, the car bit 10

/* the body in character space (x right, y up, z forward): the pose the model is built in, joints and segment centres, in metres */
const SEG = {
  pelvis: { c: [0, 0.88, 0], shape: ['box', 0.17, 0.09, 0.11], m: 12 },
  torso: { c: [0, 1.17, 0], shape: ['box', 0.19, 0.2, 0.12], m: 20 },
  head: { c: [0, 1.52, 0], shape: ['ball', 0.16], m: 5 },
  uaL: { c: [0.25, 1.18, 0], shape: ['cap', 0.1, 0.055], m: 2.2 }, uaR: { c: [-0.25, 1.18, 0], shape: ['cap', 0.1, 0.055], m: 2.2 },
  laL: { c: [0.266, 0.92, 0], shape: ['cap', 0.12, 0.05], m: 1.6 }, laR: { c: [-0.266, 0.92, 0], shape: ['cap', 0.12, 0.05], m: 1.6 },
  ulL: { c: [0.085, 0.69, 0], shape: ['cap', 0.13, 0.08], m: 7 }, ulR: { c: [-0.085, 0.69, 0], shape: ['cap', 0.13, 0.08], m: 7 },
  llL: { c: [0.085, 0.31, 0], shape: ['cap', 0.13, 0.07], m: 4.5 }, llR: { c: [-0.085, 0.31, 0], shape: ['cap', 0.13, 0.07], m: 4.5 },
};
/* [segment a, segment b, joint position, kind]; kind: 'ball', or ['hinge', min, max] about x */
const JOINTS = [
  ['pelvis', 'torso', [0, 0.98, 0], 'ball'], ['torso', 'head', [0, 1.40, 0], 'ball'],
  ['torso', 'uaL', [0.24, 1.31, 0], 'ball'], ['torso', 'uaR', [-0.24, 1.31, 0], 'ball'], ['uaL', 'laL', [0.265, 1.05, 0], ['hinge', -2.3, 0.05]], ['uaR', 'laR', [-0.265, 1.05, 0], ['hinge', -2.3, 0.05]],
  ['pelvis', 'ulL', [0.085, 0.86, 0], 'ball'], ['pelvis', 'ulR', [-0.085, 0.86, 0], 'ball'], ['ulL', 'llL', [0.085, 0.5, 0], ['hinge', -0.05, 2.4]], ['ulR', 'llR', [-0.085, 0.5, 0], ['hinge', -0.05, 2.4]],
];
/* which bone follows which segment (the hands follow the forearms, the feet the shins, the neck the torso) */
const BONES = { Hips: 'pelvis', Spine: 'torso', Chest: 'torso', Neck: 'torso', Head: 'head', UpperArm_L: 'uaL', LowerArm_L: 'laL', Hand_L: 'laL', UpperArm_R: 'uaR', LowerArm_R: 'laR', Hand_R: 'laR',
  UpperLeg_L: 'ulL', LowerLeg_L: 'llL', Foot_L: 'llL', UpperLeg_R: 'ulR', LowerLeg_R: 'llR', Foot_R: 'llR' };
const SPEEDK = { pelvis: 1.0, torso: 0.8, head: 0.65, uaL: 0.7, uaR: 0.7, laL: 0.7, laR: 0.7, ulL: 1.05, ulR: 1.05, llL: 1.05, llR: 1.05 };      // how much of the car's speed each part starts with: the legs go first, the head lags

/* a rider on a bike, in character space: the pose of the model's 'Ride' clip worked out joint by joint (every turn is about the x axis, so the hinge and ball joints stay consistent): hips on the seat 0.3 m behind the middle of the bike,
   the back leaning forward, arms out to the bars, thighs level, shins down to the pegs. Returns { segment: { c: [x, y, z], a: pitch } } */
function seatedLayout() {
  const R = (a, y, z) => [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)], L = {};
  const at = (j, rel, a) => { const r = R(a, rel[0], rel[1]); return [j[0] + r[0], j[1] + r[1]]; };               // [y, z] of a segment centre from its joint
  const P = [1.02, -0.36]; L.pelvis = { c: P, a: 0 };
  const jt = [P[0] + 0.10, P[1]], tt = 0.68, T = at(jt, [0.19, 0], tt); L.torso = { c: T, a: tt };
  const jn = at(T, [0.23, 0], tt); L.head = { c: at(jn, [0.12, 0], 0.10), a: 0.10 };
  const js = at(T, [0.14, 0], tt), ua = -1.27, UA = at(js, [-0.13, 0], ua), je = at(UA, [-0.13, 0], ua), la = -1.57; L.uaL = L.uaR = { c: UA, a: ua }; L.laL = L.laR = { c: at(je, [-0.13, 0], la), a: la };
  const jh = at(P, [-0.02, 0], 0), ul = -1.30, UL = at(jh, [-0.17, 0], ul), jk = at(UL, [-0.19, 0], ul), ll = 0.15; L.ulL = L.ulR = { c: UL, a: ul }; L.llL = L.llR = { c: at(jk, [-0.19, 0], ll), a: ll };
  return L;
}
const Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V = new THREE.Vector3();

/* the physics of one fallen walker plus its skinned figure */
class Fallen {
  constructor(sys, slot, { x, z, y, yaw, gltf, cloth, seat, vel }, car, fatal, rnd) {
    this.sys = sys; this.slot = slot; this.fatal = fatal; this.age = 0; this.state = 'fall'; this.t = 0; this.rest = 0; this.groundY = y; this.bodies = {}; this.joints = [];
    const W = sys.world, bit = 1 << slot, groundBit = 1 << (5 + slot);
    this.bit = bit; this.ground = W.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200).setTranslation(0, y - 0.5, 0).setFriction(0.6).setRestitution(0.12).setCollisionGroups((groundBit << 16) | bit));
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 - yaw), ox = x - sys.ox, oz = z - sys.oz;       // the figure faces +z at yaw 0 of the model; the walker faces (cos yaw, sin yaw) in the game
    const cv0 = car ? [car.u * Math.cos(car.yaw) - car.v * Math.sin(car.yaw), car.u * Math.sin(car.yaw) + car.v * Math.cos(car.yaw)] : [0, 0], cv = vel ? [cv0[0] + vel[0], cv0[1] + vel[1]] : cv0, sp = Math.hypot(cv[0], cv[1]), SL = seat ? seatedLayout() : null;       // vel: the speed the person already had (a rider moves with the bike)
    const side = car ? ((x - car.x) * -Math.sin(car.yaw) + (z - car.z) * Math.cos(car.yaw)) : 0;                                                 // which side of the car's axis they were hit on: sets the spin
    const gm = (bit << 16) | (groundBit | CAR);
    for (const [name, s] of Object.entries(SEG)) {
      const sc = SL ? SL[name] : null; V.set(s.c[0], sc ? sc.c[0] : s.c[1], sc ? sc.c[1] : s.c[2]).applyQuaternion(qy); const qb = sc ? qy.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), sc.a)) : qy;
      const k = SPEEDK[name], lift = (1.5 + 0.17 * sp) * (name === 'pelvis' || name.startsWith('ul') ? 1.0 : 0.6);
      const d = RAPIER.RigidBodyDesc.dynamic().setTranslation(ox + V.x, y + V.y, oz + V.z).setRotation({ x: qb.x, y: qb.y, z: qb.z, w: qb.w })
        .setLinvel(cv[0] * k * (0.9 + rnd() * 0.2), lift * (0.8 + rnd() * 0.4), cv[1] * k * (0.9 + rnd() * 0.2)).setAngvel({ x: (rnd() - 0.5) * 2 * Math.min(6, sp * 0.35), y: side * Math.min(8, sp * 0.3), z: (rnd() - 0.5) * 2 * Math.min(6, sp * 0.35) })
        .setLinearDamping(0.05).setAngularDamping(0.8).setCcdEnabled(true);
      const b = W.createRigidBody(d); const cd = s.shape[0] === 'box' ? RAPIER.ColliderDesc.cuboid(s.shape[1], s.shape[2], s.shape[3]) : s.shape[0] === 'ball' ? RAPIER.ColliderDesc.ball(s.shape[1]) : RAPIER.ColliderDesc.capsule(s.shape[1], s.shape[2]);
      W.createCollider(cd.setMass(s.m).setFriction(0.6).setRestitution(0.12).setCollisionGroups(gm), b); this.bodies[name] = b;
    }
    for (const [a, b, p, kind] of JOINTS) {
      const A = SEG[a].c, B = SEG[b].c, a1 = { x: p[0] - A[0], y: p[1] - A[1], z: p[2] - A[2] }, a2 = { x: p[0] - B[0], y: p[1] - B[1], z: p[2] - B[2] };
      const jd = kind === 'ball' ? RAPIER.JointData.spherical(a1, a2) : RAPIER.JointData.revolute(a1, a2, { x: 1, y: 0, z: 0 });
      const j = W.createImpulseJoint(jd, this.bodies[a], this.bodies[b], true); if (kind !== 'ball') j.setLimits(kind[1], kind[2]); this.joints.push(j);
    }
    // the figure
    this.fig = new sys.PlayerFigure(gltf); this.fig.obj.rotation.set(0, 0, 0); this.fig.scripted = true; sys.scene.add(this.fig.obj); this.fig.pose({});
    this.cv = cv; this.sp = sp; this.pelvisRest = new THREE.Vector3(0, 0.88, 0);
  }
  maxSpeed() { let m = 0; for (const k in this.bodies) { const v = this.bodies[k].linvel(); m = Math.max(m, Math.hypot(v.x, v.y, v.z)); } return m; }
  /* write the bodies' orientations onto the bones */
  apply() {
    const f = this.fig, o = f.obj, sys = this.sys, pl = this.bodies.pelvis.translation(), pq = this.bodies.pelvis.rotation();
    o.position.set(pl.x + sys.ox - sys.origin.x, pl.y - this.pelvisRest.y, pl.z + sys.oz - sys.origin.z);       // the model's hip joint sits 0.88 m above its feet, at the pelvis body
    for (const b of f.bones) {
      const seg = BONES[b.name], body = seg ? this.bodies[seg] : null;
      if (body) { const r = body.rotation(); Q.set(r.x, r.y, r.z, r.w); b.world.copy(Q).multiply(b.restW); } else b.world.copy(b.restW);
      const pw = b.parent ? b.parent.world : (b.parentW || Q2.identity());
      b.bone.quaternion.copy(Q2.copy(pw).invert()).multiply(b.world);
    }
    this.pelvisQ = pq;
  }
  dispose() { const W = this.sys.world; for (const k in this.bodies) W.removeRigidBody(this.bodies[k]); W.removeCollider(this.ground, false); this.fig.obj.parent && this.fig.obj.parent.remove(this.fig.obj); }
}

export class RagdollSystem {
  constructor(scene, origin, PlayerFigure) {
    this.scene = scene; this.origin = origin; this.PlayerFigure = PlayerFigure; this.list = []; this.world = null; this.ox = 0; this.oz = 0; this.acc = 0; this.carBody = null; this.carCol = null; this.rnd = Math.random;
  }
  get active() { return this.list.length; }
  ensureWorld(x, z) {
    if (this.world) return; this.world = new RAPIER.World({ x: 0, y: -HIT.gravity, z: 0 }); this.world.timestep = H; this.ox = x; this.oz = z;
    this.carBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()); this.carCol = this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.95, 0.5, 2.3).setFriction(0.6).setRestitution(0.05).setCollisionGroups(CAR << 16), this.carBody);
  }
  /* a walker was hit: ped { x, z, y, yaw }, gltf the rig to use, car { x, z, y, yaw, u, v, circles, radius } the moving car. Returns the fallen walker, or null if there is no room */
  spawn(ped, gltf, car) {
    if (!gltf) return null; this.ensureWorld(ped.x, ped.z);
    if (this.list.length >= HIT.maxActive) this.list.shift().dispose();
    let slot = 0; const used = new Set(this.list.map(l => l.slot)); while (used.has(slot)) slot++; if (slot > 4) return null;
    const fatal = this.rnd() < killChance(Math.hypot(car.u, car.v));
    const fl = new Fallen(this, slot, { ...ped, gltf }, car, fatal, this.rnd); this.list.push(fl); return fl;
  }
  /* advance the physics and the figures; car may be null (not driving) */
  update(dt, car) {
    if (!this.world) return;
    if (car && this.carBody) {
      const hl = Math.max(1.8, ((car.circles ? Math.max(...car.circles) - Math.min(...car.circles) : 3) / 2 + (car.radius || 0.95))), hw = Math.max(0.8, (car.radius || 0.95) * 0.95);
      this.carCol.setHalfExtents({ x: hw, y: 0.5, z: hl }); this.carBody.setNextKinematicTranslation({ x: car.x - this.ox, y: car.y + 0.8, z: car.z - this.oz }); const q = Q.setFromAxisAngle(V.set(0, 1, 0), Math.PI / 2 - car.yaw); this.carBody.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }
    let mask = 0; for (const f of this.list) if (car && f.age > 0.1 && f.state === 'fall') mask |= f.bit;           // the car only collides once the walker has been thrown clear of it
    this.carCol.setCollisionGroups((CAR << 16) | mask);
    this.acc += Math.min(dt, 0.05); let n = 0; while (this.acc >= H && n++ < 6) { this.world.step(); this.acc -= H; }
    for (let i = this.list.length - 1; i >= 0; i--) { const f = this.list[i]; f.age += dt; f.t += dt; this.stepFigure(f, dt); if (f.state === 'gone') { f.dispose(); this.list.splice(i, 1); } }
    if (!this.list.length) { this.world.free && this.world.free(); this.world = null; this.carBody = this.carCol = null; }
  }
  stepFigure(f, dt) {
    const R = HIT;
    if (f.state === 'fall') {
      f.apply(); const slow = f.maxSpeed() < 0.45; f.rest = slow && f.age > 0.8 ? f.rest + dt : 0;
      if (f.rest > 0.8 || f.age > 7) { f.state = f.fatal ? 'dead' : 'rest'; f.t = 0; for (const k in f.bodies) f.bodies[k].sleep(); }
    } else if (f.state === 'dead') { if (f.t > R.deadStay) { f.state = 'fade'; f.t = 0; f.after = 'gone'; } }
    else if (f.state === 'rest') {
      if (f.t > R.restBeforeGetUp) {
        f.state = 'getup'; f.t = 0; f.from = f.fig.bones.map(b => b.bone.quaternion.clone()); f.fromPos = f.fig.obj.position.clone(); f.fromYaw = 0;
        const away = Math.atan2(f.cv[0], f.cv[1]); f.faceYaw = f.sp > 0.5 ? away : 0;
        for (const k in f.bodies) { f.sys.world.removeRigidBody(f.bodies[k]); } f.bodies = {};
      }
    } else if (f.state === 'getup') {
      const u = Math.min(1, f.t / R.getUp), s = u * u * (3 - 2 * u), fg = f.fig; fg.scripted = false; fg.update(0, false, 0);          // the idle pose is the goal; blend from the lying pose to it
      fg.bones.forEach((b, i) => { b.bone.quaternion.slerpQuaternions(f.from[i], b.bone.quaternion, s); });
      fg.obj.position.set(f.fromPos.x, f.fromPos.y + (f.groundY - f.fromPos.y - 0.0) * s, f.fromPos.z); fg.obj.rotation.y = f.faceYaw * s;
      if (u >= 1) { f.state = 'run'; f.t = 0; f.runPos = fg.obj.position.clone(); f.phase = 0; }
    } else if (f.state === 'run') {
      const fg = f.fig, sp = 4.0; f.phase += sp * dt * 2.2; const fx = Math.sin(f.faceYaw), fz = Math.cos(f.faceYaw); fg.obj.position.set(f.runPos.x + fx * sp * f.t, f.groundY, f.runPos.z + fz * sp * f.t); fg.update(dt, true, f.phase, true);
      if (f.t > R.runAway) { f.state = 'fade'; f.t = 0; f.after = 'gone'; }
    } else if (f.state === 'fade') { const u = Math.min(1, f.t / R.fade); f.fig.obj.scale.setScalar(Math.max(0.001, 1 - u)); if (u >= 1) f.state = 'gone'; }
  }
  dispose() { for (const f of this.list) f.dispose(); this.list = []; if (this.world) { this.world.free && this.world.free(); this.world = null; } }
}

/* does the car (its circles, as the physics sees it) touch a walker standing at (x, z)? car: { x, z, y, yaw, circles, radius } */
export function carTouches(car, x, z, y) {
  if (y !== undefined && car.y !== undefined && Math.abs(y - car.y) > 2.5) return false;
  const c = Math.cos(car.yaw), s = Math.sin(car.yaw), rr = (car.radius || 0.95) + 0.3;
  for (const off of car.circles || [0]) { const dx = x - (car.x + c * off), dz = z - (car.z + s * off); if (dx * dx + dz * dz < rr * rr) return true; }
  return false;
}
/* the chance the hit kills at this speed (m/s) */
export const killChance = sp => Math.max(0, Math.min(1, (sp - HIT.dieFrom) / (HIT.dieAll - HIT.dieFrom)));

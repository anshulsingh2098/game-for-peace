/* Vehicle physics on Rapier (rapier.rs), replacing the home-made bicycle model. A rigid body with four ray-cast wheels: each wheel has its own
   spring and damper, steering angle, engine force and brake, and a tyre that is limited by friction (grip x load), so weight transfer, understeer,
   oversteer, squat and dive come from the physics instead of being faked.

   It keeps the same surface as VehiclePhysics in physics.js (x, z, y, yaw, u, v, r, pitch, roll, lean, delta, steer, slip, ay, impact, wet, stuck,
   surface, kmh, p, setMod, reset, step), so the rest of the game does not care which one drives. Extra for the view: quat (the body's
   orientation), hCom (height of the body's centre over the tyre plane) and wheelStates (spin, steering and suspension of each wheel).

   Ground: Rapier needs a collider to ray-cast against, but the land is a function. A square heightfield patch of the land under and ahead of the
   car (heights from world.height, which is the road surface where there is road) is rebuilt as the car moves. Physics runs in coordinates relative to
   a re-centred origin so single-precision numbers stay fine far from the start.

   Conventions: the body's forward is +z and up is +y, as the vehicle models face +z; the car's left is +x. Rapier steering angle is positive to the
   left; the game's steering angle (delta) is positive to the right, so the two are opposite in sign. */
import RAPIER from '../../vendor/rapier/rapier.mjs';
import { SURFACES, NO_MOD } from './physics.js';

let ready = null;
export const initRapier = () => ready || (ready = RAPIER.init().then(() => RAPIER));

const G = 9.81, H = 1 / 120;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
/* Arcade handling layer (the "Most Wanted" feel): the tyre model alone is realistic and twitchy, so these steer the result.
   latGrip   how fast sideways speed is killed while gripping (1/s): high = planted, never floaty
   latPower  grip left when on the throttle and steering hard above slideSpeed (m/s): low = the tail steps out, a power slide
   latHand   grip left while the handbrake is held: the car slides and keeps sliding
   yawAssist how hard the car is pulled toward the yaw rate the steering asks for (1/s): crisp turn-in, and it holds a drift
   maxYaw    the fastest turn rate (rad/s) the assist asks for.  Off with ?arcade=0 */
export const ARCADE = { on: !/[?&]arcade=0/.test(typeof location !== 'undefined' ? location.search : ''), latGrip: 2.6, latPower: 0.3, latHand: 0.12, slideSpeed: 14, yawAssist: 3.2, maxYaw: 1.7,
  downforce: 0.9, power: { car: 1.45, truck: 1.3, bike: 1.2 }, curve: 3, aeroMul: 0.55, brakeMul: 1.35, gripMul: 1.12 };      // power: engine strength x (a hard launch and a long pull); curve: how late the pull fades toward top speed (2 = old, 3+ = keeps pulling); aero: air drag x; brake, grip: x
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* per-vehicle suspension and body tuning (stiffness is per unit mass, so it reads as a natural frequency) */
const TUNE = {
  car:   { rest: 0.26, travel: 0.20, k: 32, comp: 3.6, relax: 5.0, hy: 0.32, extraL: 0.55, rollK: 0, rollC: 0, ang: 0.4 },
  truck: { rest: 0.40, travel: 0.30, k: 18, comp: 2.8, relax: 3.8, hy: 0.9,  extraL: 1.2,  rollK: 0, rollC: 0, ang: 0.6 },
  bike:  { rest: 0.24, travel: 0.18, k: 38, comp: 4.0, relax: 5.5, hy: 0.3,  extraL: 0.3,  rollK: 16000, rollC: 2400, pitchK: 22000, pitchC: 3000, ang: 0.8 }
};

/* build a rigid body + vehicle controller in a Rapier world. Returns what is needed to drive and read it. */
function makeCar(world, p, id, startY) {
  const T = TUNE[id] || TUNE.car, drive = id === 'bike' ? 'rear' : 'rear';
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, startY, 0).setCanSleep(false).setAngularDamping(T.ang).setLinearDamping(0.0));
  const halfL = (p.front + p.rear) / 2 + T.extraL, midZ = (p.front - p.rear) / 2;
  world.createCollider(RAPIER.ColliderDesc.cuboid(Math.max(0.2, p.track / 2 + 0.12), T.hy, halfL).setTranslation(0, 0, 0).setMass(p.mass).setFriction(0.2).setRestitution(0), body);
  const vc = world.createVehicleController(body); vc.indexUpAxis = 1; vc.setIndexForwardAxis = 2;
  const cy = p.wheelR + T.rest - 0.08 - p.cg;                                      // hard point height relative to the centre of mass; puts the centre of mass about `cg` over the road
  const wheels = id === 'bike' ? [[0, p.front, true], [0, -p.rear, false]]
    : [[p.track / 2, p.front, true], [-p.track / 2, p.front, true], [p.track / 2, -p.rear, false], [-p.track / 2, -p.rear, false]];
  wheels.forEach(([x, z, front]) => vc.addWheel({ x, y: cy, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, T.rest, p.wheelR));
  for (let i = 0; i < wheels.length; i++) {
    vc.setWheelSuspensionStiffness(i, T.k); vc.setWheelSuspensionCompression(i, T.comp); vc.setWheelSuspensionRelaxation(i, T.relax);
    vc.setWheelMaxSuspensionTravel(i, T.travel); vc.setWheelMaxSuspensionForce(i, 1e7); vc.setWheelFrictionSlip(i, 1); vc.setWheelSideFrictionStiffness(i, 1);
  }
  return { body, vc, wheels: wheels.map(([x, z, front]) => ({ x, z, front, side: x === 0 ? 0 : x > 0 ? 1 : -1, drive: !front })), T, cy };
}

/* anti-roll and anti-pitch springs about the body's forward and left axes: tall vehicles lean but do not tip over, and a bike stays upright and
   does not flip forward under hard braking. */
function stabilise(b, T) {
  b.resetTorques(true); if (!T.rollK && !T.pitchK) return;
  const q = b.rotation(), av = b.angvel(), fx = 2 * (q.x * q.z + q.w * q.y), fy = 2 * (q.y * q.z - q.w * q.x), fz = 1 - 2 * (q.x * q.x + q.y * q.y), lx = 1 - 2 * (q.y * q.y + q.z * q.z), ly = 2 * (q.x * q.y + q.w * q.z), lz = 2 * (q.x * q.z - q.w * q.y);
  let tx = 0, ty = 0, tz = 0;
  if (T.rollK) { const tq = -T.rollK * Math.asin(clamp(ly, -1, 1)) - T.rollC * (av.x * fx + av.y * fy + av.z * fz); tx += fx * tq; ty += fy * tq; tz += fz * tq; }
  if (T.pitchK) { const tq = T.pitchK * Math.asin(clamp(fy, -1, 1)) - T.pitchC * (av.x * lx + av.y * ly + av.z * lz); tx += lx * tq; ty += ly * tq; tz += lz * tq; }
  b.addTorque({ x: tx, y: ty, z: tz }, true);
}

const calCache = new Map();
/* the car on flat ground at rest: how high its centre of mass sits over the tyre plane, and how long its springs are */
function calibrate(p, id) {
  const key = id + ':' + p.mass + ':' + p.cg; if (calCache.has(key)) return calCache.get(key);
  const w = new RAPIER.World({ x: 0, y: -G, z: 0 }); w.timestep = H;
  w.createCollider(RAPIER.ColliderDesc.cuboid(300, 0.5, 300).setTranslation(0, -0.5, 0).setFriction(1));
  const c = makeCar(w, p, id, p.cg + 0.4); for (let i = 0; i < c.wheels.length; i++) c.vc.setWheelBrake(i, 1e4);
  for (let k = 0; k < 360; k++) { stabilise(c.body, c.T); c.vc.updateVehicle(H); w.step(); }
  let L = 0; for (let i = 0; i < c.wheels.length; i++) L += c.vc.wheelSuspensionLength(i); L /= c.wheels.length;
  const out = { hCom: c.body.translation().y, L0: L, cy: c.cy }; w.free(); calCache.set(key, out); return out;
}

export class RapierVehicle {
  /* params: from vehicleParams(); id: 'car' | 'truck' | 'bike'; world: { height, surface, near, seaLevel, grip? } */
  constructor(params, id, world) {
    this.p = params; this.id = id; this.world = world; this.mod = NO_MOD; this.acc = 0;
    this.cal = calibrate(params, id); this.hCom = this.cal.hCom; this.L0 = this.cal.L0;
    this.R = new RAPIER.World({ x: 0, y: -G, z: 0 }); this.R.timestep = H;
    this.N = 44; this.cell = 1.5; this.patch = null; this.ox = 0; this.oz = 0;       // heightfield patch: N x N cells of `cell` metres
    this.car = makeCar(this.R, params, id, this.hCom + 0.5); this.body = this.car.body; this.vc = this.car.vc;
    this.wheelStates = this.car.wheels.map(w => ({ front: w.front, side: w.side, spin: 0, steer: 0, susp: 0 }));
    this.reset(0, 0, 0);
  }
  free() { try { this.R.free(); } catch (e) { /* already freed */ } }

  /* heightfield under (cx, cz) in game coordinates; the old one is kept one more step so the wheels always have ground */
  buildPatch(cx, cz) {
    const n = this.N, cell = this.cell, size = n * cell, sx = Math.round(cx / cell) * cell, sz = Math.round(cz / cell) * cell, x0 = sx - size / 2, z0 = sz - size / 2;
    const hts = new Float32Array((n + 1) * (n + 1)), W = this.world;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) hts[i + j * (n + 1)] = W.height(x0 + j * cell, z0 + i * cell);      // Rapier: z index runs fastest
    const col = this.R.createCollider(RAPIER.ColliderDesc.heightfield(n, n, hts, { x: size, y: 1, z: size }).setTranslation(sx - this.ox, 0, sz - this.oz).setFriction(1).setRestitution(0));
    if (this.old) this.R.removeCollider(this.old.col, false); this.old = this.patch; this.patch = { col, x: sx, z: sz };
  }
  dropOld() { if (this.old) { this.R.removeCollider(this.old.col, false); this.old = null; } }

  reset(x, z, yaw) {
    this.ox = x; this.oz = z; if (this.patch) { this.R.removeCollider(this.patch.col, false); this.patch = null; } if (this.old) { this.R.removeCollider(this.old.col, false); this.old = null; }
    this.buildPatch(x, z);
    /* stand the car on the slope: sample the land under its four wheels and tilt it to match */
    const W = this.world, pr = this.p, c0 = Math.cos(yaw), s0 = Math.sin(yaw), ht = Math.max(pr.track, 0.4) / 2, fx = x + c0 * pr.front, fz = z + s0 * pr.front, bx = x - c0 * pr.rear, bz = z - s0 * pr.rear;
    const fl = W.height(fx + s0 * ht, fz - c0 * ht), fr = W.height(fx - s0 * ht, fz + c0 * ht), bl = W.height(bx + s0 * ht, bz - c0 * ht), br = W.height(bx - s0 * ht, bz + c0 * ht);
    const gy = (fl + fr) / 2 * (pr.rear / pr.L) + (bl + br) / 2 * (pr.front / pr.L), pitch = Math.atan2((fl + fr - bl - br) / 2, pr.L), rollA = Math.atan2((fl + bl - fr - br) / 2, Math.max(pr.track, 0.4));
    const th = Math.PI / 2 - yaw, qm = (a, b) => ({ w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z, x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w });
    const q = qm(qm({ x: 0, y: Math.sin(th / 2), z: 0, w: Math.cos(th / 2) }, { x: Math.sin(-pitch / 2), y: 0, z: 0, w: Math.cos(pitch / 2) }), { x: 0, y: 0, z: Math.sin(rollA / 2), w: Math.cos(rollA / 2) });
    const b = this.body; b.setTranslation({ x: 0, y: gy + this.hCom + 0.02, z: 0 }, true); b.setRotation(q, true); b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < this.car.wheels.length; i++) { this.vc.setWheelSteering(i, 0); this.vc.setWheelEngineForce(i, 0); this.vc.setWheelBrake(i, 0); }
    Object.assign(this, { x, z, yaw, u: 0, v: 0, r: 0, steer: 0, delta: 0, pitch: 0, roll: 0, lean: 0, spin: 0, slip: 0, ay: 0, impact: 0, wet: 0, stuck: 0, surface: 'asphalt', acc: 0, dPitch: 0, dRoll: 0, afS: 0, arS: 0, axL: 0, gear: 0, shiftT: 0, rpm: 900 });
    this.y = gy; this.groundY = gy; this.quat = { x: q.x, y: q.y, z: q.z, w: q.w }; this.R.step(); this.read();
  }
  get speed() { return Math.hypot(this.u, this.v); }
  get kmh() { return this.u * 3.6; }
  setMod(mod) { this.mod = mod ? { ...NO_MOD, ...mod } : NO_MOD; }

  step(dt, input) {
    this.acc += Math.min(dt, 0.1); this.impact = 0;
    while (this.acc >= H) { this.sub(input); this.acc -= H; }
    this.read();
  }

  /* copy the body's state into the fields the game reads */
  read() {
    const b = this.body, t = b.translation(), q = b.rotation(), lv = b.linvel(), av = b.angvel(), qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const fx = 2 * (qx * qz + qw * qy), fy = 2 * (qy * qz - qw * qx), fz = 1 - 2 * (qx * qx + qy * qy);                      // forward (0,0,1) rotated
    const lx = 1 - 2 * (qy * qy + qz * qz), ly = 2 * (qx * qy + qw * qz);                                                   // left (1,0,0) rotated
    this.quat = { x: qx, y: qy, z: qz, w: qw }; this.x = t.x + this.ox; this.z = t.z + this.oz; this.yaw = Math.atan2(fz, fx);
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw); this.u = lv.x * c + lv.z * s; this.v = -lv.x * s + lv.z * c; this.r = -av.y;
    this.pitch = Math.asin(clamp(fy, -1, 1)); this.roll = Math.asin(clamp(ly, -1, 1)); this.vy = lv.y;
    this.y = t.y - this.hCom; this.bodyY = t.y;                                                                           // y: the tyre plane under the body centre
    this.ay = this.u * this.r; this.slip = Math.min(2, Math.abs(Math.atan2(this.v, Math.max(Math.abs(this.u), 2))));
    this.lean += (clamp(Math.atan(this.u * this.r / G), -0.8, 0.8) * this.p.lean - this.lean) * 0.15;
    const vc = this.vc;
    this.car.wheels.forEach((w, i) => { const st = this.wheelStates[i]; st.spin = -(vc.wheelRotation(i) || 0); st.steer = vc.wheelSteering(i) || 0; st.susp = this.L0 - (vc.wheelSuspensionLength(i) ?? this.L0); st.contact = vc.wheelIsInContact(i); });
    this.spin = this.wheelStates[this.wheelStates.length - 1].spin;
  }

  sub(input) {
    const p = this.p, W = this.world, h = H, m = p.mass, M = this.mod, top = p.top * M.top, b = this.body, vc = this.vc, car = this.car;
    /* refresh the ground patch when the car nears its edge */
    const pt = this.patch, ex = Math.abs(this.x - pt.x), ez = Math.abs(this.z - pt.z), edge = this.N * this.cell / 2 - 14;
    if (ex > edge * 0.55 || ez > edge * 0.55) { const lead = clamp(this.u * 0.45, -14, 14); this.buildPatch(this.x + Math.cos(this.yaw) * lead, this.z + Math.sin(this.yaw) * lead); this.patchNew = true; }
    else if (this.old) this.dropOld();

    /* steering: rate-limited, slower at speed, quick to centre; the lock shrinks with speed */
    const want = clamp(input.steer, -1, 1), back = Math.abs(want) < Math.abs(this.steer) || want * this.steer < 0, rate = back ? 8 : 5.5 / (1 + Math.abs(this.u) / 14);
    this.steer += clamp(want - this.steer, -rate * h, rate * h);
    this.delta = this.steer * Math.min(p.steerMax, 2.1 * M.steer * p.mu * G * p.L / Math.max(this.u * this.u, 1));
    const tn = Math.tan(this.delta), R = Math.abs(tn) > 1e-4 ? p.L / tn : 1e6;

    const key = W.surface(this.x, this.z); this.surface = key; const S0 = SURFACES[key] || SURFACES.grass;
    const depth = W.seaLevel - this.groundY; this.wet = depth > 0 ? depth : 0; this.groundY = this.y; const flooded = depth > 1.1;
    const thr = clamp(input.throttle, 0, 1), brk = clamp(input.brake, 0, 1), hnd = clamp(input.hand || 0, 0, 1), rev = thr > 0 ? 0 : clamp(input.rev || 0, 0, 1), u = this.u;

    /* forces on the wheels. Four separate controls: throttle, reverse, the foot brake (never reverses) and the handbrake (rear wheels only). */
    let engine = 0, brake = 0, rearBrake = 0, coast = false;
    if (thr > 0 && !flooded) { if (u < -0.4) brake = m * p.brake * thr; else engine = ARCADE.on && p.pt ? this.powertrain(thr, u, h, M, S0) : m * p.accel * M.accel * (ARCADE.on ? ARCADE.power[this.id] || 1 : 1) * thr * Math.max(0, 1 - (Math.abs(u) / top) ** (ARCADE.on ? ARCADE.curve : 2)); }                    // gas while rolling backwards brakes first
    else if (rev > 0) { if (u > 1.2) brake = m * p.brake * 0.9 * rev; else if (!flooded) engine = -m * p.revAccel * 1.35 * rev * Math.max(0, 1 - (u / p.revTop) ** 2); }   // reverse: brakes while still rolling forward, then drives backwards
    if (brk > 0) brake = Math.max(brake, m * p.brake * (ARCADE.on ? ARCADE.brakeMul : 1) * brk);                                                  // foot brake: all four wheels
    if (hnd > 0) rearBrake = m * p.brake * 1.0 * hnd;                                                         // handbrake: the rear wheels lock
    if (thr === 0 && rev === 0 && brk === 0 && hnd === 0) {
      if (Math.abs(u) < 0.25) brake = m * G * 0.9;                                                            // parked: hold still, even on a slope
      else coast = true;                                                                                       // lifting off: engine braking, applied to the body below so it works on any surface
    }
    const nDrive = car.wheels.filter(w => w.drive).length, nF = car.wheels.filter(w => w.front).length, nR = car.wheels.length - nF;
    const fShare = this.id === 'bike' ? 0.55 : 0.62;
    car.wheels.forEach((w, i) => {
      const pos = vc.wheelContactPoint(i), wx = pos ? pos.x + this.ox : this.x, wz = pos ? pos.z + this.oz : this.z, S = SURFACES[W.surface(wx, wz)] || S0;
      const wet = (depth > 0.3 ? 0.6 : 1) * (W.grip ? W.grip(W.surface(wx, wz)) : 1);
      vc.setWheelFrictionSlip(i, p.mu * (ARCADE.on ? ARCADE.gripMul : 1) * S.grip * wet * M.grip * (!w.front && hnd > 0 ? 1 - 0.5 * hnd : 1));      // a locked rear wheel slides: the tail steps out
      let a = 0; if (w.front) a = w.side === 0 ? this.delta : Math.atan(p.L / (R + w.side * p.track / 2));       // Ackermann: the inner wheel turns more
      vc.setWheelSteering(i, w.front ? -a : 0);
      vc.setWheelEngineForce(i, w.drive ? engine / nDrive : 0);
      const share = w.front ? fShare / nF : (1 - fShare) / nR; vc.setWheelBrake(i, (brake * share + (w.front ? 0 : rearBrake / nR)) * h);
    });
    /* rolling resistance by surface, water drag, air drag, and what a buff changes about slopes */
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const roll = -m * G * (S0.drag * M.drag + (depth > 0 ? Math.min(1.2, depth * 1.4) : 0)) * clamp(u / 0.5, -1, 1), air = -(ARCADE.on && p.pt ? 0.6 * p.pt.cdA : p.aero * (ARCADE.on ? ARCADE.aeroMul : 1)) * u * Math.abs(u);
    let F = roll + air; const fwd = { x: c, z: s };
    if (coast) F -= Math.sign(u) * m * (0.30 + 0.008 * Math.abs(u)) * clamp(Math.abs(u) / 0.5, 0, 1);                  // engine braking: not limited by tyre grip, so the car slows on grass as well as on tarmac
    if (M.slope < 1) F += m * G * Math.sin(this.pitch) * (1 - M.slope);                                           // Hill Hauler: climbs as if the slope were not there
    b.resetForces(true); b.addForce({ x: fwd.x * F, y: -(ARCADE.on && p.pt ? 0.6 * ARCADE.downforce * u * u : 0), z: fwd.z * F }, true);          // downforce: the faster the car, the harder it is pressed into the road (force = 0.5 x air density x lift area x speed squared)
    /* anti-roll: a spring and damper about the forward axis so tall vehicles lean but do not tip over (a bike is held upright) */
    stabilise(b, car.T);
    vc.updateVehicle(h); this.R.step();
    this.read(); this.arcade(h, thr, want, hnd, tn, flooded);
    if (this.patchNew) this.patchNew = false;
    /* body pitch and lean are worked out after read() below, once the new speed is known (they used to compare the old speed with itself, so the body never moved) */
    this.stuck = flooded ? this.stuck + h : 0;
    this.read(); this.collide();
    const du = (this.u - u) / h; this.axL += (clamp(du, -14, 14) - this.axL) * Math.min(1, h * 6);                       // longitudinal acceleration, smoothed
    this.dPitch += (clamp(this.axL, -12, 12) * (this.axL < 0 ? 0.013 : 0.02) * p.cg - this.dPitch) * Math.min(1, h * 7);                          // nose dips under braking, squats under power
    this.dRoll += (-clamp(this.ay, -12, 12) * 0.022 * p.cg * (1 - Math.min(1, p.lean)) - this.dRoll) * Math.min(1, h * 7);   // body leans in corners (a bike leans by its own model)
    if (this.u > Math.max(top * 1.08, 1)) { const lv = b.linvel(), k = Math.max(top * 1.08, this.u - 6 * h) / this.u; b.setLinvel({ x: lv.x * k, y: lv.y, z: lv.z * k }, true); }          // hard speed ceiling (a buff's extra speed bleeds off)
  }

  /* A real powertrain from published car data (defs.js `pt`): engine power curve, gearbox with automatic shifts, final drive, drivetrain loss, a traction limit.
     Returns the force at the wheels (N). Sets this.gear and this.rpm (the engine sound can use them). */
  powertrain(thr, u, h, M, S0) {
    const pt = this.p.pt, R = this.p.wheelR || 0.35, n = pt.gears.length, TAU = 60 / (2 * Math.PI), w = Math.max(u, 0) / R, ratio = g => pt.gears[g] * pt.final;
    const rpmIn = g => w * ratio(g) * TAU / M.top; let g = this.gear;               // a buff's top-speed multiplier acts like taller gearing
    if (this.shiftT > 0) this.shiftT -= h;
    else if (g < n - 1 && rpmIn(g) > pt.upshift * pt.redline) { this.gear = ++g; this.shiftT = pt.shiftTime; }
    else if (g > 0 && rpmIn(g) < (thr > 0.9 ? 0.6 : 0.42) * pt.redline && rpmIn(g - 1) < 0.92 * pt.redline) { this.gear = --g; this.shiftT = pt.shiftTime * 0.6; }
    const rpm = Math.max(rpmIn(g), g === 0 ? pt.launch : pt.idle); this.rpm += (rpm - this.rpm) * Math.min(1, h * 25);
    if (rpm >= pt.redline) return 0;                                                                              // rev limiter
    const x = rpm / pt.peak, P = pt.kw * 1000 * clamp(x * (0.55 + 1.15 * x - 0.7 * x * x), 0, 1.05), T = P / (rpm / TAU);        // power curve (turbo-like shape, 1.0 at the peak), torque = power / angular speed
    let F = T * ratio(g) / M.top * pt.eff / R * thr * M.accel * (this.shiftT > 0 ? 0.08 : 1);
    return Math.min(F, pt.tcs * this.p.mu * ARCADE.gripMul * S0.grip * this.p.mass * G * Math.sqrt(M.accel));          // traction limit: the tyres cannot push harder than they grip
  }

  /* the arcade layer: runs once per physics step after the tyres have done their work */
  arcade(h, thr, want, hnd, tn, flooded) {
    const A = ARCADE, p = this.p; if (!A.on || flooded || this.id === 'bike') return;
    const sp = Math.abs(this.u); if (sp < 3 || this.wheelStates.filter(w => w.contact).length < 2) return;
    const b = this.body, lv = b.linvel(), av = b.angvel(), c = Math.cos(this.yaw), s = Math.sin(this.yaw), S = SURFACES[this.surface] || SURFACES.grass;
    let k = A.latGrip * Math.min(1, S.grip + 0.2);
    if (hnd > 0) k = A.latGrip * (1 - hnd) + A.latHand * hnd; else if (thr > 0.5 && Math.abs(want) > 0.5 && sp > A.slideSpeed) k *= A.latPower;      // power slide
    const dv = -this.v * (1 - Math.exp(-k * h));                                                                // kill some sideways speed along the car's own side axis
    const target = clamp(this.u * tn / p.L, -A.maxYaw, A.maxYaw) * (hnd > 0 ? 1 - 0.55 * hnd : 1), yaw = (target - this.r) * A.yawAssist * h;
    b.setLinvel({ x: lv.x - s * dv, y: lv.y, z: lv.z + c * dv }, true); b.setAngvel({ x: av.x, y: av.y - yaw, z: av.z }, true);
  }

  /* trees and rocks: push the body out of them and take away the speed that was going in */
  collide() {
    const p = this.p, lists = this.world.near(this.x, this.z, p.front + p.rear + 3); if (!lists.length) return;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw); let moved = false, u = this.u, v = this.v, px = 0, pz = 0, dr = 0;
    for (const off of p.circles) {
      const cx = this.x + px + c * off, cz = this.z + pz + s * off;
      for (const list of lists) for (let i = 0; i < list.length; i++) {
        const o = list[i], dx = cx - o.x, dz = cz - o.z, rr = p.radius + o.r, d2 = dx * dx + dz * dz; if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = rr - d; px += nx * pen; pz += nz * pen; moved = true;
        const wx = u * c - v * s, wz = u * s + v * c, vn = wx * nx + wz * nz; if (vn >= 0) continue;
        const ax = wx - 1.2 * vn * nx, az = wz - 1.2 * vn * nz; u = (ax * c + az * s) * 0.85; v = (-ax * s + az * c) * 0.6; dr += (-s * nx + c * nz) * off * -vn * 0.02;
        this.impact = Math.max(this.impact, -vn);
      }
    }
    if (!moved) return; const b = this.body, t = b.translation(), lv = b.linvel(), av = b.angvel();
    b.setTranslation({ x: t.x + px, y: t.y, z: t.z + pz }, true);
    b.setLinvel({ x: u * c - v * s, y: lv.y, z: u * s + v * c }, true); b.setAngvel({ x: av.x, y: av.y - dr, z: av.z }, true);
    this.read();
  }
}

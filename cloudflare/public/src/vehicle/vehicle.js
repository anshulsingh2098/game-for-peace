/* The vehicle you see: loads the model, turns its wheels, places it from the physics state, builds the
   driver-view cockpit and runs the chase and driver cameras. Model space: front +Z, up +Y, left +X. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader(), cache = new Map(); let glowTex = null;
export function loadModel(def) {
  if (!cache.has(def.id)) cache.set(def.id, new Promise((ok, no) => loader.load(def.file, g => ok(g.scene), undefined, no)));
  return cache.get(def.id);
}
function blobShadow() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -12 }));
  m.renderOrder = 2; return m;
}

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export class VehicleView {
  constructor(scene) { this.scene = scene; this.root = new THREE.Group(); this.root.rotation.order = 'YXZ'; this.shadow = blobShadow(); scene.add(this.root, this.shadow); this.view = 'third'; this.camYaw = null; this.eye = new THREE.Vector3(); }
  /* swap in a vehicle's model (already loaded with loadModel) */
  setModel(def, model) {
    if (this.model) this.root.remove(this.model);
    this.def = def; this.model = model.clone(true); this.root.add(this.model);
    this.wheels = []; this.riders = []; this.cockpit = null; this.wheel = null;
    this.model.traverse(o => {
      if (/^Wheel_[A-Z]{1,2}$/.test(o.name) && !o.isMesh) { o.rotation.order = 'YXZ'; this.wheels.push({ o, y0: o.position.y, front: /^Wheel_F/.test(o.name), side: Math.abs(o.position.x) < 0.1 ? 0 : o.position.x > 0 ? 1 : -1 }); }       // side +1 = the car's left (the model faces +z, so left is +x), taken from where the wheel is, not its name
      if (/^Rider/.test(o.name)) this.riders.push(o);
      if (o.isMesh) { o.castShadow = true; [].concat(o.material).forEach(m => { if ('envMapIntensity' in m) m.envMapIntensity = 0.7; }); }
    });
    this.buildCockpit(def.id); this.buildLights(def.lights); this.shadow.scale.set(def.shadow[0], 1, def.shadow[1]); this.camYaw = null; this.setView(this.view);
  }
  /* dashboard and steering wheel for the driver view (the models have no interior) */
  buildCockpit(id) {
    if (id === 'bike') return;
    const g = new THREE.Group(), dark = new THREE.MeshLambertMaterial({ color: 0x15151b }), mid = new THREE.MeshLambertMaterial({ color: 0x30303a }), glow = new THREE.MeshBasicMaterial({ color: 0x6fd0ff });
    const box = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || dark); m.position.set(x, y, z); g.add(m); return m; };
    let pos, R, tilt;
    if (id === 'car') { box(1.5, 0.07, 0.42, 0, 0.955, 0.66); box(0.46, 0.08, 0.2, -0.32, 1.0, 0.64, mid); box(0.28, 0.01, 0.05, -0.32, 1.045, 0.58, glow); box(0.3, 0.05, 0.1, 0.2, 0.99, 0.60, mid); box(0.08, 0.22, 0.08, -0.32, 0.86, 0.54, mid); pos = [-0.32, 0.98, 0.50]; R = 0.13; tilt = 0.6; }
    else { box(2.0, 0.24, 0.8, 0, 2.30, 3.95); box(0.8, 0.12, 0.26, -0.5, 2.43, 3.85, mid); box(0.5, 0.012, 0.05, -0.5, 2.5, 3.75, glow); box(0.2, 0.5, 0.15, -0.5, 2.1, 3.65, mid); pos = [-0.5, 2.36, 3.62]; R = 0.24; tilt = 0.3; }
    const sw = new THREE.Group(); sw.position.set(...pos); sw.rotation.x = tilt; const inner = new THREE.Group(); sw.add(inner);
    inner.add(new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.14, 8, 28), mid));
    for (const [w, h] of [[R * 1.9, R * 0.16], [R * 0.16, R * 0.95]]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(w, h, R * 0.1), mid); if (h > w) sp.position.y = -R * 0.47; inner.add(sp); }
    inner.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.3, R * 0.3, R * 0.2, 12).rotateX(Math.PI / 2), dark));
    g.add(sw); this.model.add(g); this.cockpit = g; this.wheel = inner;
  }
  /* glow sprites at the lamps, the lamp materials, and a headlight beam */
  buildLights(L) {
    if (!glowTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 1, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); }
    this.glows = []; this.tailMats = []; this.headMats = []; this.beamOn = 0;
    const mk = (pos, col, size, kind) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 }));
      sp.position.set(...pos); sp.scale.setScalar(size); this.model.add(sp); this.glows.push({ sp, kind }); };
    for (const p of L.tail) mk(p, 0xff2a14, L.tailSize, 'tail'); for (const p of L.head) mk(p, 0xfff0d0, L.headSize, 'head');
    this.model.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => { if (m.name === 'Light_Tail' && !this.tailMats.includes(m)) this.tailMats.push(m); if (m.name === 'Light_Head' && !this.headMats.includes(m)) this.headMats.push(m); }); });
    this.beam = new THREE.SpotLight(0xfff1d6, 0, 90, 0.5, 0.65, 1.2); this.beam.position.set(0, L.beam[0], L.beam[1]); this.beam.target.position.set(0, 0.1, L.beam[1] + 25); this.model.add(this.beam, this.beam.target);
  }
  /* lamps: on = headlights, brake = brake lights, reverse = white reversing lights */
  lights(on, brake, reverse, dt) {
    if (!this.glows) return;
    for (const m of this.tailMats) m.emissiveIntensity = brake ? 8 : on ? 3 : 1.5; for (const m of this.headMats) m.emissiveIntensity = on ? 4 : 0.6;
    for (const g of this.glows) { if (g.kind === 'tail') g.sp.material.color.setHex(reverse ? 0xffffff : 0xff2a14); g.sp.material.opacity = g.kind === 'tail' ? (reverse ? 0.95 : brake ? 1 : on ? 0.7 : 0.18) : (on ? 0.9 : 0.1); g.sp.visible = this.view !== 'first'; }
    this.beamOn += ((on ? 1 : 0) - this.beamOn) * Math.min(1, dt * 4); this.beam.intensity = 260 * this.beamOn; this.beam.visible = this.beamOn > 0.02;
  }
  /* 'third' = chase camera, 'first' = driver's eyes */
  setView(v) {
    this.view = v; const fp = v === 'first'; if (!this.model) return;
    this.model.traverse(o => {                                  // the models' glass is opaque, so from inside the cabin and glass are hidden
      if (o.name === 'Cab' || o.name === 'Cabin') o.visible = !fp;
      if (o.isMesh) [].concat(o.material).forEach(m => { if (m.name === 'Glass') { m.colorWrite = !fp; m.depthWrite = !fp; } });
    });
    if (this.cockpit) this.cockpit.visible = fp; for (const o of this.riders) o.visible = !fp;
  }
  /* place the model from the physics state. `origin` is the floating render origin. */
  update(ph, origin) {
    const r = this.root, rb = !!ph.quat;
    if (rb) {                                                                                                   // rigid-body physics: use the body's real orientation, then a touch of pitch and lean for the look
      const q = ph.quat; r.position.set(ph.x - origin.x, ph.bodyY, ph.z - origin.z); r.quaternion.set(q.x, q.y, q.z, q.w); r.translateY(-ph.hCom); r.rotateX(-ph.dPitch); r.rotateZ(ph.dRoll + ph.lean);
    } else { r.position.set(ph.x - origin.x, ph.y, ph.z - origin.z); r.rotation.set(-(ph.pitch + ph.dPitch), Math.PI / 2 - ph.yaw, ph.roll + ph.dRoll + ph.lean); }
    /* a little road feel: the body trembles with speed, more on gravel and grass than on asphalt (the road itself is perfectly smooth) */
    { const t = performance.now() / 1000, sp = Math.min(Math.abs(ph.u) / 30, 1), rough = ph.surface === 'asphalt' ? 1 : ph.surface === 'gravel' ? 3.5 : 2.5;
      r.position.y += (Math.sin(t * 23.1) * 0.5 + Math.sin(t * 37.7 + 1.3) * 0.5) * 0.006 * sp * rough; r.rotateZ(Math.sin(t * 17.3) * 0.0012 * sp * rough); r.rotateX(Math.sin(t * 29.9 + 2.1) * 0.0008 * sp * rough); }
    /* front wheels follow the real road-wheel angle, with Ackermann geometry: the inner wheel turns more than the outer */
    const L = ph.p.L, T = ph.p.track, tn = Math.tan(ph.delta), R = Math.abs(tn) > 1e-4 ? L / tn : 1e6;
    for (const w of this.wheels) {
      if (rb) { const st = ph.wheelStates.find(s => s.front === w.front && s.side === w.side); if (st) { w.o.rotation.x = st.spin; w.o.rotation.y = st.steer; w.o.position.y = w.y0 + st.susp; } continue; }      // each wheel's own spin, steering and spring travel
      w.o.rotation.x = ph.spin; let a = 0;
      if (w.front) a = w.side === 0 ? ph.delta : Math.atan(L / (R + w.side * T / 2));          // side: +1 left wheel, -1 right wheel, 0 a single front wheel (bike)
      w.o.rotation.y = -a;
    }
    if (this.wheel) this.wheel.rotation.z = -clamp(ph.delta * 15, -2.6, 2.6);              // steering wheel: a real car turns it about 15 times as far as the road wheels
    this.shadow.position.set(r.position.x, ph.y + 0.05, r.position.z); this.shadow.rotation.y = Math.PI / 2 - ph.yaw; this.shadow.visible = ph.wet < 0.3 && !this.realShadow;
  }
  /* camera views, cycled with V (like the old GTA games): chase cameras at three distances, bumper, hood, driver's seat and a TV-style cinematic cut.
     'cockpit' is the old 'first' view (the cabin is hidden and the cockpit shown); the other views show the whole car. */
  setMode(name) {
    this.mode = name; this.setView(name === 'cockpit' ? 'first' : 'third'); this.camYaw = null; this.cine = null;
  }
  /* aim the camera. floor(x, z) is the lowest height the camera may sit at. */
  aim(camera, ph, origin, dt, floor, boost = 0) {
    const d = this.def, speed = Math.abs(ph.u), cm = this.camMul || { back: 1, up: 1, look: 1, fov: 0 }, mode = this.mode || 'middle';       // camMul: closer, lower, wider on phones (set in main.js)
    const body = (x, y, z, fov) => {                                                                                                       // a camera fixed to the car at model position (x, y, z)
      this.root.updateMatrixWorld(true); this.eye.set(x, y, z); this.root.localToWorld(this.eye); camera.position.copy(this.eye);
      camera.rotation.order = 'YXZ'; camera.rotation.set(ph.pitch * 0.9 - 0.03, -Math.PI / 2 - ph.yaw, -(ph.roll + ph.lean) * 0.5); camera.fov = fov + Math.min(14, speed * 0.18) + boost * 4;
    };
    if (mode === 'cockpit') body(d.eye[0], d.eye[1], d.eye[2], 70);
    else if (mode === 'hood') body(0, d.eye[1] - 0.18, d.eye[2] + 1.7, 68);
    else if (mode === 'bumper') body(0, d.body.wheelR + 0.32, d.body.front + (d.id === 'car' ? 0.95 : 0.45), 76);
    else if (mode === 'cinematic') {                                                                                                         // like a TV camera: fixed beside or ahead of the road, turning to follow the car, then a cut
      const now = performance.now() / 1000, c = Math.cos(ph.yaw), sn = Math.sin(ph.yaw), C = this.cine;
      const behind = C ? (ph.x - C.x) * c + (ph.z - C.z) * sn : 0, far = C ? Math.hypot(ph.x - C.x, ph.z - C.z) : 0;
      if (!C || now - C.t > 7 || behind > 22 || far > 70) {
        const ahead = 22 + Math.random() * 26, side = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 10);
        this.cine = { t: now, x: ph.x + c * ahead * Math.max(0.4, Math.min(1.6, 0.5 + speed / 25)) - sn * side, z: ph.z + sn * ahead * Math.max(0.4, Math.min(1.6, 0.5 + speed / 25)) + c * side, h: 1.2 + Math.random() * 3.2, fov: 40 + Math.random() * 22 };
      }
      const K = this.cine, y = Math.max(ph.y + K.h, floor(K.x, K.z) + 1.0);
      camera.position.set(K.x - origin.x, y, K.z - origin.z); camera.lookAt(ph.x - origin.x, ph.y + 0.9, ph.z - origin.z); camera.fov = K.fov;
    } else {                                                                                                                                  // chase cameras: middle (the default), far (high and distant), close (low and tight)
      const m = mode === 'far' ? { back: 1.75, up: 1.9, look: 1.25 } : mode === 'close' ? { back: 0.62, up: 0.72, look: 0.9 } : { back: 1, up: 1, look: 1 };
      const want = ph.yaw + Math.atan2(ph.v, Math.max(Math.abs(ph.u), 4)) * 0.4;       // follow where the car is going, a little, when it slides
      if (this.camYaw === null || this.camYaw === undefined) this.camYaw = want;
      this.camYaw += Math.atan2(Math.sin(want - this.camYaw), Math.cos(want - this.camYaw)) * Math.min(1, dt * 3.2);
      const cx = Math.cos(this.camYaw), cz = Math.sin(this.camYaw), back = d.cam.back * cm.back * m.back, wx = ph.x - cx * back, wz = ph.z - cz * back;
      const y = Math.max(ph.y + d.cam.up * cm.up * m.up, floor(wx, wz) + 1.2);
      camera.position.set(wx - origin.x, y, wz - origin.z); camera.lookAt(ph.x + cx * d.cam.look * cm.look * m.look - origin.x, ph.y + d.cam.up * 0.45, ph.z + cz * d.cam.look * cm.look * m.look - origin.z);
      camera.fov = 56 + cm.fov + (mode === 'far' ? 4 : mode === 'close' ? 6 : 0) + Math.min(14, speed * 0.16) + boost * 4;
    }
    camera.updateProjectionMatrix();
  }
}

/* Smoke, fire and blast for a wrecked vehicle (docs/DAMAGE_PLAN.md, phase 4). Two particle layers drawn as soft round points: smoke (normal blending, grey to black, rising and spreading) and flame (additive,
   white-yellow to red, flickering), each a ring buffer of particles simulated in scene coordinates. `smoke(pos, rate)` and `flame(pos, rate)` emit while called each frame; `blast(pos)` throws a ball of flame, sparks
   and heavy smoke outward at once. A warm light follows the fire. Browser only (it needs three.js and a canvas for nothing: the dots are drawn by a tiny shader). */
import * as THREE from 'three';

const VERT = `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aSize * 420.0 / max(0.5, -mv.z), 0.0, 420.0); vA = aAlpha; vC = aColor; }`;
const FRAG = `varying float vA; varying vec3 vC; void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.15, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC, a); }`;

class Layer {
  constructor(scene, n, additive) {
    this.n = n; this.i = 0; this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.age = new Float32Array(n).fill(9); this.life = new Float32Array(n).fill(1); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.col = new Float32Array(n * 3); this.col1 = new Float32Array(n * 3); this.a0 = new Float32Array(n); this.up = new Float32Array(n);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.color = new Float32Array(n * 3);
    const g = this.g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.p, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 11 : 10; scene.add(this.pts); this.scene = scene;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, a0, c0, c1, up = 0) {
    const i = this.i = (this.i + 1) % this.n, j = i * 3; this.p[j] = x; this.p[j + 1] = y; this.p[j + 2] = z; this.v[j] = vx; this.v[j + 1] = vy; this.v[j + 2] = vz; this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0; this.up[i] = up;
    this.col[j] = c0[0]; this.col[j + 1] = c0[1]; this.col[j + 2] = c0[2]; this.col1[j] = c1[0]; this.col1[j + 1] = c1[1]; this.col1[j + 2] = c1[2];
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      const j = i * 3; if (this.age[i] >= this.life[i]) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.age[i] += dt; const t = Math.min(1, this.age[i] / this.life[i]);
      this.v[j + 1] += this.up[i] * dt; const drag = Math.max(0, 1 - 1.4 * dt); this.v[j] *= drag; this.v[j + 1] *= drag; this.v[j + 2] *= drag;
      this.p[j] += this.v[j] * dt; this.p[j + 1] += this.v[j + 1] * dt; this.p[j + 2] += this.v[j + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(t); this.alpha[i] = this.a0[i] * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
      for (let k = 0; k < 3; k++) this.color[j + k] = this.col[j + k] + (this.col1[j + k] - this.col[j + k]) * t;
    }
    this.g.attributes.position.needsUpdate = this.g.attributes.aSize.needsUpdate = this.g.attributes.aAlpha.needsUpdate = this.g.attributes.aColor.needsUpdate = true;
  }
  dispose() { this.scene.remove(this.pts); this.g.dispose(); this.mat.dispose(); }
}

const R = () => Math.random() - 0.5;
export class FireFx {
  constructor(scene) {
    this.scene = scene; this.smokeL = new Layer(scene, 420, false); this.fireL = new Layer(scene, 360, true); this.acc = { smoke: 0, flame: 0 };
    this.light = new THREE.PointLight(0xff8a30, 0, 14, 2); this.light.visible = false; scene.add(this.light); this.flash = 0; this.glow = 0; this.t = 0;
  }
  /* emit while called each frame: pos = { x, y, z } in scene metres, rate = particles per second, power 0 to 1 */
  smoke(pos, rate, dt, power = 0.5, dark = 0.3) {
    this.acc.smoke += rate * dt; while (this.acc.smoke >= 1) { this.acc.smoke -= 1; const g = dark * (0.7 + Math.random() * 0.5); this.smokeL.emit(pos.x + R() * 0.5, pos.y, pos.z + R() * 0.5, R() * 0.8, 1.2 + power * 1.4 + Math.random() * 0.6, R() * 0.8, 1.8 + Math.random() * 1.8, 0.35, 1.6 + power * 1.2, 0.45 + 0.2 * power, [g, g, g], [g * 0.7, g * 0.7, g * 0.7], 0.4); }
  }
  flame(pos, rate, dt, power = 0.5) {
    this.glow = Math.max(this.glow, power); this.acc.flame += rate * dt; while (this.acc.flame >= 1) { this.acc.flame -= 1;
      this.fireL.emit(pos.x + R() * 0.55, pos.y + Math.random() * 0.15, pos.z + R() * 0.55, R() * 0.9, 1.6 + Math.random() * 1.8 * (0.5 + power), R() * 0.9, 0.45 + Math.random() * 0.4, 0.5 + 0.3 * power, 0.12, 0.9, [1, 0.85, 0.35], [0.9, 0.18, 0.04], 1.5); }
  }
  /* the burst: a ball of fire, sparks and black smoke thrown outward */
  blast(pos) {
    for (let i = 0; i < 70; i++) { const a = Math.random() * 6.283, e = Math.random() * 1.2 - 0.1, sp = 2 + Math.random() * 6; this.fireL.emit(pos.x, pos.y, pos.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 1.5, Math.sin(a) * Math.cos(e) * sp, 0.5 + Math.random() * 0.6, 0.9, 2.4, 1, [1, 0.9, 0.5], [0.8, 0.12, 0.02], 0.5); }
    for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, sp = 1 + Math.random() * 3.5; this.smokeL.emit(pos.x, pos.y, pos.z, Math.cos(a) * sp, 1.5 + Math.random() * 3, Math.sin(a) * sp, 2.5 + Math.random() * 2.5, 1.2, 3.4, 0.6, [0.06, 0.06, 0.06], [0.2, 0.2, 0.2], 0.6); }
    for (let i = 0; i < 24; i++) { const a = Math.random() * 6.283, sp = 6 + Math.random() * 9; this.fireL.emit(pos.x, pos.y, pos.z, Math.cos(a) * sp, 3 + Math.random() * 8, Math.sin(a) * sp, 0.5 + Math.random() * 0.5, 0.12, 0.05, 1, [1, 0.95, 0.7], [1, 0.4, 0.08], -9); }       // sparks arc and fall
    this.flash = 1; this.light.position.set(pos.x, pos.y + 0.5, pos.z);
  }
  /* a tyre bursting: a puff of dark smoke and a few sparks */
  pop(pos) {
    for (let i = 0; i < 14; i++) { const a = Math.random() * 6.283, sp = 0.6 + Math.random() * 2; this.smokeL.emit(pos.x, pos.y + 0.1, pos.z, Math.cos(a) * sp, 0.8 + Math.random(), Math.sin(a) * sp, 1.2 + Math.random() * 1.2, 0.25, 1.1, 0.55, [0.05, 0.05, 0.05], [0.2, 0.2, 0.2], 0.3); }
    for (let i = 0; i < 8; i++) { const a = Math.random() * 6.283, sp = 2 + Math.random() * 4; this.fireL.emit(pos.x, pos.y, pos.z, Math.cos(a) * sp, 1 + Math.random() * 3, Math.sin(a) * sp, 0.3 + Math.random() * 0.3, 0.1, 0.04, 1, [1, 0.9, 0.6], [1, 0.4, 0.1], -9); }
  }
  update(dt, firePos) {
    this.t += dt; this.smokeL.update(dt); this.fireL.update(dt); this.flash = Math.max(0, this.flash - dt * 2.4);
    const burning = this.glow > 0; this.light.visible = burning || this.flash > 0;
    if (this.light.visible) { if (firePos) this.light.position.set(firePos.x, firePos.y + 2.2, firePos.z); this.light.intensity = (burning ? (5 + 0.7 * Math.sin(this.t * 5.3) + 0.5 * Math.sin(this.t * 9.1 + 1)) * this.glow : 0) + this.flash * 40; }          // two or more metres above the car and a slow flicker: close to the paint and fast it strobed red and grey
    this.glow = 0;
  }
  dispose() { this.smokeL.dispose(); this.fireL.dispose(); this.scene.remove(this.light); this.light.dispose && this.light.dispose(); }
}

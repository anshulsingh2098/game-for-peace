/* Distant landscape: four ranges of hills and mountains between 7 and 30 km away, drawn as curtains around the camera behind everything else,
   so the horizon is never bare sky. Heights are read from the real terrain at those distances (stretched so they read from afar, and lifted by a
   ridge noise so there is always a skyline). Each range is tinted toward the horizon colour with distance (haze), and vanishes in fog.
   The curtains move with the camera, so they have no parallax, as with real far mountains. */
import * as THREE from 'three';
import { createNoise } from '../core/noise.js';

const N = 256, R = 3000;                                                                  // columns around; radius the curtains are drawn at (angular size is what counts)
const RANGES = [{ d: 7000, haze: 0.24, tone: [0.36, 0.52, 0.34] }, { d: 11000, haze: 0.38, tone: [0.34, 0.50, 0.40] },
                { d: 17000, haze: 0.54, tone: [0.34, 0.47, 0.50] }, { d: 26000, haze: 0.68, tone: [0.36, 0.46, 0.58] }];

export class Backdrop {
  constructor(scene, terrain, config) {
    this.terrain = terrain; this.sea = config.terrain.seaLevel; this.snowline = config.palette.snowline; this.noise = createNoise(String(config.seed) + ':backdrop');
    this.cx = 1e9; this.cz = 1e9; this.group = new THREE.Group(); this.group.frustumCulled = false; this.layers = [];
    const idx = []; for (let i = 0; i < N; i++) { const a = i * 2, b = ((i + 1) % N) * 2; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    RANGES.forEach((r, k) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3)); g.setIndex(idx);
      const m = new THREE.ShaderMaterial({ vertexColors: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
        vertexShader: 'varying vec3 c; void main() { c = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'varying vec3 c; void main() { gl_FragColor = vec4(c, 1.0); }' });
      const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = -0.9 + k * 0.01; this.group.add(mesh); this.layers.push({ r, mesh, h: new Float32Array(N), up: new Float32Array(N), tmp: [0, 0, 0] });
    });
    scene.add(this.group);
  }
  /* sample the land around (x, z); done once the camera has moved a few hundred metres */
  sample(x, z) {
    const T = this.terrain.far, nz = this.noise;
    for (const L of this.layers) {
      const d = L.r.d;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * 2 * Math.PI, wx = x + Math.cos(a) * d, wz = z + Math.sin(a) * d, real = T.height(wx, wz), up = real - this.sea;
        const mask = 0.45 + 0.55 * Math.min(1, Math.max(0, 0.55 + 0.9 * nz.fbm(wx / 9000, wz / 9000, 3, 2, 0.5)));                  // where the extra ridges stand
        const ridge = (260 + Math.pow(nz.ridged(wx / 5200, wz / 5200, 4, 2.1, 0.5), 1.3) * 1500) * mask * (up > 0 ? 1 : 0.3);
        L.up[i] = Math.max(up * 1.7, ridge, 0); L.h[i] = L.up[i];
      }
    }
    this.cx = x; this.cz = z;
  }
  /* call each frame: camera position (floating-origin local), the world position of it, the environment (fog colour and weather) */
  update(camera, wx, wz, env) {
    if (Math.hypot(wx - this.cx, wz - this.cz) > 300) this.sample(wx, wz);
    this.group.position.copy(camera.position);
    const fog = env.fogCol, vis = Math.pow(Math.min(1, env.w.fogMul * 1.15), 1.6), snow = env.w.snow, cy = camera.position.y;
    this.group.visible = vis > 0.02;
    for (const L of this.layers) {
      const pos = L.mesh.geometry.attributes.position, col = L.mesh.geometry.attributes.color, k = R / L.r.d, mix = vis * (1 - L.r.haze);
      for (let i = 0; i < N; i++) {
        const a = (i / N) * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a), top = (L.up[i] - cy) * k, bot = -R * 0.18;
        pos.setXYZ(i * 2, c * R, top, s * R); pos.setXYZ(i * 2 + 1, c * R, bot, s * R);
        const cap = Math.min(1, Math.max(0, (L.up[i] - this.snowline * 1.3) / 160)) + snow * 0.6, shade = 0.9 + 0.2 * this.noise.n2(i * 0.35, L.r.d);      // snow caps; weather snow whitens all
        for (let q = 0; q < 3; q++) {
          const f = [fog.r, fog.g, fog.b][q], tone = Math.min(1.6, f * L.r.tone[q] * 1.9 * shade), tc = tone + (f * 1.12 + 0.05 - tone) * Math.min(1, cap);
          L.tmp[q] = f + (tc - f) * mix;
        }
        col.setXYZ(i * 2, L.tmp[0], L.tmp[1], L.tmp[2]); col.setXYZ(i * 2 + 1, fog.r, fog.g, fog.b);
      }
      pos.needsUpdate = true; col.needsUpdate = true;
    }
  }
}

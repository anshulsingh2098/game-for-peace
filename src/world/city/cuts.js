/* Open cuts of the underpasses (WORK_REMAINING 12.3): the flat ground meshes (the engine's terrain, the city's block, park and sidewalk fills) are not drawn inside the strips where a sunken street is open to the sky,
   so the trench shows. Works on any material by chaining onBeforeCompile (like tunnel_holes.js); the CUT_N nearest strips to the player are used, each a capsule round a segment: [x0, z0, x1, z1] and a half width. */
import * as THREE from 'three';
export const CUT_N = 16;
export function installCutHoles(materials, shared) {
  const uC = shared ? shared.uC : { value: Array.from({ length: CUT_N }, () => new THREE.Vector4()) }, uW = shared ? shared.uW : { value: Array.from({ length: CUT_N }, () => new THREE.Vector2()) };
  for (const material of materials) {
    const prev = material.onBeforeCompile;
    material.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(material, sh, r);
      sh.uniforms.uCut = uC; sh.uniforms.uCutW = uW;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform vec4 uCut[${CUT_N}]; uniform vec2 uCutW[${CUT_N}]; varying vec3 vCP;`).replace('void main() {', `void main() {
  for (int i = 0; i < ${CUT_N}; i++) {
    if (uCutW[i].y < 0.5) continue;
    vec2 a = uCut[i].xy, b = uCut[i].zw, p = vCP.xz, ab = b - a; float L2 = max(dot(ab, ab), 0.0001), t = clamp(dot(p - a, ab) / L2, 0.0, 1.0);
    if (length(p - (a + ab * t)) < uCutW[i].x) discard;
  }`);
    };
    material.needsUpdate = true;
  }
  return {
    uC, uW,
    /* segs: [{ x0, z0, x1, z1, hw }] in world metres, origin: the floating origin; the nearest CUT_N to (cx, cz) are used */
    set(segs, origin, cx, cz) {
      const near = []; for (const s of segs) { const d = Math.hypot((s.x0 + s.x1) / 2 - cx, (s.z0 + s.z1) / 2 - cz); if (d < 300) near.push([d, s]); } near.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < CUT_N; i++) { const e = near[i], C = uC.value[i], W = uW.value[i]; if (!e) { W.y = 0; continue; } const s = e[1]; C.set(s.x0 - origin.x, s.z0 - origin.z, s.x1 - origin.x, s.z1 - origin.z); W.set(s.hw, 1); }
    }
  };
}

/* Doorways through the hillside. The terrain mesh is coarser than the road, so where a tunnel starts the land cannot rise from road level to a mountain in a few metres: its slope
   would stand inside the tube, in the doorway. Instead the hill face is a few metres behind the portal wall (router.js, FACE_W), and the terrain fragments inside the tube's
   arch, for the first metres behind each of the nearest portals, are not drawn. Works on any material (chains onBeforeCompile) and costs a short loop per fragment.
   Usage: const holes = installTunnelHoles(material, wall, arch); each frame holes.set(portals, origin, camX, camZ, tubeHalfWidth)   portals: [{ x, y, z, dx, dz }] in world coordinates, dx/dz pointing into the tube. */
import * as THREE from 'three';
export const HOLE_N = 4, HOLE_LEN = 30;
export function installTunnelHoles(material, wall, arch) {
  const uW = { value: 5.5 };                                                                                                             // the tube's half width (m), set per world
  const uP = { value: Array.from({ length: HOLE_N }, () => new THREE.Vector4()) }, uD = { value: Array.from({ length: HOLE_N }, () => new THREE.Vector2()) };      // vec4 (x, y, z, active), vec2 direction
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(material, sh, r);
    sh.uniforms.uHoleW = uW; sh.uniforms.uHoleP = uP; sh.uniforms.uHoleD = uD;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uHoleW; uniform vec4 uHoleP[${HOLE_N}]; uniform vec2 uHoleD[${HOLE_N}]; varying vec3 vHP;`).replace('void main() {', `void main() {
  for (int i = 0; i < ${HOLE_N}; i++) {
    if (uHoleP[i].w < 0.5) continue;
    vec2 d = vHP.xz - uHoleP[i].xz, dir = uHoleD[i]; float al = dot(d, dir), lat = dot(d, vec2(-dir.y, dir.x)), W = uHoleW;
    if (al > -0.3 && al < ${HOLE_LEN.toFixed(1)} && abs(lat) < W + 0.3 && vHP.y > uHoleP[i].y - 1.5 && vHP.y < uHoleP[i].y + ${wall.toFixed(2)} + ${arch.toFixed(2)} * sqrt(max(0.0, 1.0 - lat * lat / (W * W))) + 0.3) discard;
  }`);
  };
  material.needsUpdate = true;
  return {
    /* the HOLE_N portals nearest to (cx, cz) (world) are used */
    set(portals, origin, cx, cz, W) {
      uW.value = W;
      const list = portals.map(p => ({ p, d: (p.x - cx) ** 2 + (p.z - cz) ** 2 })).sort((a, b) => a.d - b.d).slice(0, HOLE_N);
      for (let i = 0; i < HOLE_N; i++) { const e = list[i], P = uP.value[i], D = uD.value[i]; if (!e || e.d > 400 * 400) { P.w = 0; continue; } P.x = e.p.x - origin.x; P.y = e.p.y; P.z = e.p.z - origin.z; P.w = 1; D.x = e.p.dx; D.y = e.p.dz; }
    }
  };
}

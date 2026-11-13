/* Scenery models: trees, bushes, grass tufts and rocks, plus the wind sway shader patch.
   Carried over from the current game (game.js) so the new world keeps its look. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { leafTex, tuftTex } from './textures.js';

export const WIND = { t: { value: 0 }, a: { value: 1 } };       // time and strength, shared by every swaying material
export function sway(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWind = WIND.t; sh.uniforms.uWindAmp = WIND.a;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uWindAmp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sw = sin(uWind * 1.3 + ip.x * 0.37 + ip.z * 0.29) * 0.6 + sin(uWind * 2.3 + ip.z * 0.53 + ip.x * 0.17) * 0.3;
        float hg = max(transformed.y, 0.0);
        transformed.x += sw * hg * 0.03 * uWindAmp; transformed.z += sw * hg * 0.018 * uWindAmp;`);
  };
  return mat;
}
function tint(g, r, gg, b) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
/* crossed upright cards with normals bent upward, so foliage is lit like a rounded mass */
function crossCards(w, h, cy, count) {
  const parts = []; for (let i = 0; i < count; i++) { const p = new THREE.PlaneGeometry(w, h); p.rotateY(i * Math.PI / count); p.translate(0, cy, 0); parts.push(p); }
  const g = mergeGeometries(parts), pos = g.attributes.position, n = new Float32Array(pos.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.set(pos.getX(i), pos.getY(i) - cy * 0.9, pos.getZ(i)).normalize(); v.y = v.y * 0.6 + 0.5; v.normalize(); n[i * 3] = v.x; n[i * 3 + 1] = v.y; n[i * 3 + 2] = v.z; }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); return g;
}
function hash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function rockGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.78 + 0.5 * hash3(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50)); p.setXYZ(i, x * k, y * k * 0.7, z * k); }
  g.computeVertexNormals(); return tint(g, 0.47, 0.45, 0.42);
}
const foliage = map => sway(new THREE.MeshLambertMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide }));

export function propGeometry() {
  const round = leafTex('round');
  return {
    pine:  { trunk: tint(new THREE.CylinderGeometry(0.14, 0.34, 5, 7).translate(0, 2.5, 0), 0.20, 0.15, 0.11), foliage: crossCards(5.8, 11, 6.3, 3), mat: foliage(leafTex('pine')) },
    round: { trunk: tint(new THREE.CylinderGeometry(0.18, 0.36, 3.6, 7).translate(0, 1.8, 0), 0.26, 0.20, 0.15), foliage: crossCards(8.6, 7.6, 6.6, 3), mat: foliage(round) },
    bush:  { foliage: crossCards(2.8, 2.1, 1.0, 3), mat: foliage(round) },
    tuft:  { foliage: crossCards(1.7, 1.2, 0.55, 3), mat: sway(new THREE.MeshLambertMaterial({ map: tuftTex(), alphaTest: 0.4, side: THREE.DoubleSide })) },
    rock:  rockGeometry(),
    solid: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })            // trunks and rocks
  };
}

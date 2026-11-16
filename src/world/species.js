/* Tree species built in code (no outside assets): a trunk with a few branches and a crown of leaf clusters, so a tree has real volume and its own shape, not a flat card.
   speciesList(makeMat) returns variants for the scenery ({ trunk, foliage, mat, tint, w }, the same shape world/nature.js uses): oak (broad, deep green), birch (white, slender,
   light green), poplar (tall column), cypress (dark narrow flame) and an autumn maple. Each is about 9 to 14 m tall at scale 1 and is built once, then instanced.
   Leaf textures are drawn on a canvas; branch angles, cluster positions and sizes come from a seeded random number generator, so the same build gives the same trees. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { alea } from '../core/rng.js';

/* a 128 px square of leaves on a transparent ground: a solid dark core (so a cluster has no holes) with leaves of varied greens over it and around its edge */
function leafTexture(seed, { greens, leaf = 9, count = 110, long = 1.6 }) {
  leaf *= 0.7; count = Math.round(count * 1.8);                                      // smaller, more leaves: reads as foliage up close, not blobs
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), R = alea('leaf', seed);
  x.fillStyle = greens[0]; x.beginPath(); x.arc(S / 2, S / 2, S * 0.31, 0, 6.3); x.fill();
  for (let i = 0; i < count; i++) {
    const a = R() * 6.283, d = Math.sqrt(R()) * S * 0.43, px = S / 2 + Math.cos(a) * d, py = S / 2 + Math.sin(a) * d, r = leaf * (0.7 + R() * 0.6);
    x.fillStyle = greens[Math.floor(R() * greens.length)]; x.beginPath(); x.ellipse(px, py, r * long * 0.5, r * 0.5, R() * 3.14, 0, 6.3); x.fill();
  }
  x.globalCompositeOperation = 'source-atop'; const gr = x.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(255,255,230,0.10)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)'); x.fillStyle = gr; x.fillRect(0, 0, S, S);      // darker underneath, lighter on top
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const colourise = (g, r, gg, b) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const UP = new THREE.Vector3(0, 1, 0);

/* a tapered limb from `from` along `dir` for `len` metres */
function limb(from, dir, len, r0, r1, col) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 5, 1).translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize())); g.translate(from.x, from.y, from.z);
  return colourise(g, col[0], col[1], col[2]);
}

/* spec: { seed, trunk: {h, r0, r1, col}, branches: n, crown: {cy, rx, ry}, clusters, size, lean } */
function buildTree(spec) {
  const R = alea('tree', spec.seed), T = spec.trunk, parts = [], leaves = [], C = spec.crown;
  parts.push(limb(new THREE.Vector3(0, -0.2, 0), UP, T.h + 0.2, T.r0, T.r1, T.col));
  for (let i = 0; i < spec.branches; i++) {
    const f = 0.5 + R() * 0.45, from = new THREE.Vector3(0, T.h * f, 0), az = R() * 6.283, el = 0.45 + R() * 0.55, len = C.rx * (0.45 + R() * 0.5), dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    parts.push(limb(from, dir, len, T.r1 * 0.9, T.r1 * 0.25, T.col)); const tip = from.clone().addScaledVector(dir, len); leaves.push(tip);
  }
  const trunk = mergeGeometries(parts), planes = [], n = new THREE.Vector3();
  for (let i = 0; i < spec.clusters; i++) {
    let p; if (i < leaves.length && R() < 0.8) p = leaves[i].clone().add(new THREE.Vector3((R() - 0.5) * 1.2, R() * 0.8, (R() - 0.5) * 1.2));
    else { const u = R() * 6.283, v = Math.acos(2 * R() - 1), k = Math.cbrt(R()); p = new THREE.Vector3(C.rx * k * Math.sin(v) * Math.cos(u), C.cy + C.ry * k * Math.cos(v), C.rx * k * Math.sin(v) * Math.sin(u)); }
    const sz = spec.size * (0.75 + R() * 0.6), rot = R() * 3.14;
    for (let j = 0; j < 2; j++) { const pl = new THREE.PlaneGeometry(sz, sz); pl.rotateX((R() - 0.5) * 0.9); pl.rotateY(rot + j * 1.57); pl.translate(p.x, p.y, p.z); planes.push(pl); }
  }
  const foliage = mergeGeometries(planes), pos = foliage.attributes.position, nr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { n.set(pos.getX(i), pos.getY(i) - C.cy, pos.getZ(i)).normalize(); n.y = n.y * 0.6 + 0.45; n.normalize(); nr[i * 3] = n.x; nr[i * 3 + 1] = n.y; nr[i * 3 + 2] = n.z; }     // lit like a rounded mass
  foliage.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); return { trunk, foliage };
}

const GREENS = {
  oak: ['#2f5a22', '#3b6d2a', '#4a8132', '#355f26', '#5a9440'], birch: ['#4f6f2a', '#5f8334', '#718f3c', '#587a2e', '#85a047'],
  poplar: ['#3a6a2c', '#4b7f35', '#5e9440', '#3f7030'], cypress: ['#1d3f26', '#264d2e', '#2f5a36', '#21472a'], maple: ['#8a3a1a', '#b5521e', '#c9772a', '#9a2f18', '#d99a3a']
};

export function speciesList(makeMat, level = 'full') {
  const mk = (name, spec, tex, tint, w) => { const t = buildTree({ seed: name, ...spec }); return { trunk: t.trunk, foliage: t.foliage, mat: makeMat(leafTexture(name, tex)), tint, w, species: name }; };
  const all = [
    mk('oak', { trunk: { h: 3.4, r0: 0.45, r1: 0.2, col: [0.24, 0.19, 0.14] }, branches: 6, crown: { cy: 6.6, rx: 4.8, ry: 3.3 }, clusters: 52, size: 3.4 }, { greens: GREENS.oak, leaf: 10 }, [0.86, 0.92, 0.84], 3),
    mk('birch', { trunk: { h: 7.5, r0: 0.17, r1: 0.07, col: [0.82, 0.8, 0.74] }, branches: 5, crown: { cy: 9, rx: 2.3, ry: 3.8 }, clusters: 36, size: 2.3 }, { greens: GREENS.birch, leaf: 7, count: 150, long: 1.25 }, [0.95, 0.98, 0.85], 2),
    mk('poplar', { trunk: { h: 2.6, r0: 0.28, r1: 0.12, col: [0.3, 0.26, 0.2] }, branches: 3, crown: { cy: 8, rx: 1.7, ry: 6.5 }, clusters: 40, size: 2.4 }, { greens: GREENS.poplar, leaf: 8, long: 1.4 }, [0.85, 0.95, 0.84], 1.5),
    mk('cypress', { trunk: { h: 1.2, r0: 0.2, r1: 0.1, col: [0.28, 0.22, 0.17] }, branches: 0, crown: { cy: 5.2, rx: 1.15, ry: 5 }, clusters: 30, size: 2.1 }, { greens: GREENS.cypress, leaf: 7, long: 2.2 }, [1, 1, 1], 0.8),
    mk('maple', { trunk: { h: 3, r0: 0.38, r1: 0.18, col: [0.26, 0.2, 0.15] }, branches: 6, crown: { cy: 6, rx: 4.2, ry: 3 }, clusters: 46, size: 3.2 }, { greens: GREENS.maple, leaf: 10 }, [0.8, 0.8, 0.78], 0.1)
  ];
  return level === 'low' ? [all[0], all[1]] : all;
}

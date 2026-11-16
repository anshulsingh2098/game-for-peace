/* Real-scan scenery (R5 of team/photoreal-plan.md): trees, bushes and grass drawn as crossed cards textured with Blender renders of real Poly Haven
   plant scans, rocks as real scans reduced to a few thousand triangles. Everything is CC0 (assets/ASSETS.md). Loads in the background; the scenery
   starts with the drawn models and switches when this is ready (Scatter.setProps). Off with ?nature=flat.
   Cards: the render of a plant (assets/nature/*.png, a square frame of `frame` metres around the plant) is scaled so the plant reaches `tall` metres. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sway } from './props.js';
import { alea } from '../core/rng.js';

const tl = new THREE.TextureLoader();
function card(tex, meta, tall, count) {                                  // `count` planes crossed around the vertical axis, upright, base at y = 0
  const k = tall / meta.height, size = meta.frame * k, up = (meta.cz - meta.zmin) * k, parts = [];
  for (let i = 0; i < count; i++) { const p = new THREE.PlaneGeometry(size, size); p.rotateY(i * Math.PI / count); p.translate(0, up, 0); parts.push(p); }
  const g = mergeGeometries(parts), pos = g.attributes.position, n = new Float32Array(pos.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.set(pos.getX(i), pos.getY(i) - up * 0.9, pos.getZ(i)).normalize(); v.multiplyScalar(0.4); v.y += 0.95; v.normalize(); n[i * 3] = v.x; n[i * 3 + 1] = v.y; n[i * 3 + 2] = v.z; }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); return g;
}
const material = tex => {
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; const m = sway(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide })), wind = m.onBeforeCompile;
  m.onBeforeCompile = sh => { wind(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;')); };       // a card seen from behind is lit like its front: foliage is translucent, and the flipped normal made every back face near black
  return m;
};

/* a card of wildflowers drawn here (no outside asset): thin curved stems with small heads in the given colours. 128 px square, plant fills the frame, base at the bottom edge */
function flowerTexture(seed, colours, stems = 11) {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), R = alea('flowers', seed);
  for (let i = 0; i < stems; i++) {
    const bx = 14 + R() * 100, tx = bx + (R() - 0.5) * 36, ty = 26 + R() * 50, mx = (bx + tx) / 2 + (R() - 0.5) * 14;
    x.strokeStyle = R() < 0.5 ? '#4f7f2f' : '#5f8f38'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(bx, S); x.quadraticCurveTo(mx, (S + ty) / 2, tx, ty); x.stroke();
    x.fillStyle = '#5b8a34'; x.beginPath(); x.ellipse(mx, S - (S - ty) * 0.35, 6, 2, -0.6, 0, 6.3); x.fill();                       // a leaf
    const col = colours[Math.floor(R() * colours.length)], r = 3 + R() * 3.2; x.fillStyle = col; for (let k = 0; k < 5; k++) { const a = k * 1.2566 + R(); x.beginPath(); x.arc(tx + Math.cos(a) * r * 0.7, ty + Math.sin(a) * r * 0.7, r * 0.62, 0, 6.3); x.fill(); } x.fillStyle = '#e8c53a'; x.beginPath(); x.arc(tx, ty, r * 0.4, 0, 6.3); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
const FLOWER_META = { width: 1, height: 1, frame: 1, cz: 0.5, zmin: 0 };

/* resolves to { pine: [...], round: [...], bush: [...], tuft: [...], rock: [{geom, mat}...] }, or null if anything fails */
export async function loadNature(level = 'full') {            // level 'low': fewer variants (fewer draw calls on weak devices)
  try {
    const meta = await (await fetch('assets/nature/cards.json')).json(), t = n => tl.loadAsync(`assets/nature/${n}.png`);
    const names = ['fir_sapling_0', 'fir_sapling_1', 'fir_sapling_2', 'pine_sapling_small_0', 'pine_sapling_small_1', 'pine_sapling_small_2', 'island_tree_02', 'shrub_03', 'fern_02', 'grass_medium_02'];
    const tex = Object.fromEntries(await Promise.all(names.map(async n => [n, await t(n)])));
    const mat = Object.fromEntries(names.map(n => [n, material(tex[n])]));
    const conifer = (n, tall) => ({ foliage: card(tex[n], meta[n], tall, 3), mat: mat[n], tint: n.startsWith('fir') ? [0.82, 0.94, 0.9] : [1.02, 1.02, 0.94], w: 1 });
    const bro = (tall, tint, w, planes = 3) => ({ foliage: card(tex.island_tree_02, meta.island_tree_02, tall, planes), mat: mat.island_tree_02, tint, w }), shr = (tall, tint, w) => ({ foliage: card(tex.shrub_03, meta.shrub_03, tall, 3), mat: mat.shrub_03, tint, w }),
      fern = (tall, tint, w) => ({ foliage: card(tex.fern_02, meta.fern_02, tall, 3), mat: mat.fern_02, tint, w }), tuft = (tall, tint, w) => ({ foliage: card(tex.grass_medium_02, meta.grass_medium_02, tall, 3), mat: mat.grass_medium_02, tint, w }),
      flowers = (seed, colours, w) => { const t = flowerTexture(seed, colours); t.colorSpace = THREE.SRGBColorSpace; return { foliage: card(t, FLOWER_META, 0.55, 3), mat: material(t), tint: [1, 1, 1], w }; };
    const rocks = [];
    const gl = new GLTFLoader();
    for (const n of ['namaqualand_boulder_02', 'rock_07']) {
      const gltf = await gl.loadAsync(`assets/nature/${n}.glb`); let mesh = null; gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      if (mesh) { const m = mesh.material; m.roughness = 0.92; m.metalness = 0; m.envMapIntensity = 0.3; rocks.push({ geom: mesh.geometry, mat: m }); }
    }
    const low = level === 'low', fewer = (list, keep) => low ? keep.map(i => list[i]) : list;
    return {
      pine: fewer([conifer('fir_sapling_0', 13), conifer('fir_sapling_1', 11), conifer('fir_sapling_2', 9), conifer('pine_sapling_small_0', 13), conifer('pine_sapling_small_1', 11), conifer('pine_sapling_small_2', 9)], [0, 4]),
      /* one scanned broadleaf tree and one shrub is all the outside art there is; the variety comes from sizes, shapes (different heights, 3 or 4 crossed cards) and colours (fresh green, deep green, yellow-green, rust in autumn), placed in patches (scatter.js) */
      round: fewer([bro(10, [1, 1, 1], 3), bro(13, [0.88, 1.0, 0.88], 2), bro(7, [1.12, 1.08, 0.78], 2), bro(11, [0.78, 0.9, 0.8], 2, 4), bro(8.5, [1.32, 1.0, 0.62], 0.4), bro(15, [0.95, 1.05, 0.98], 1, 4)], [0, 2, 3]),
      bush: fewer([shr(1.0, [1, 1, 1], 3), shr(1.5, [0.85, 0.95, 0.75], 2), shr(0.7, [1.2, 0.95, 0.75], 1.5), shr(1.2, [1.35, 0.85, 0.7], 0.5), fern(1.0, [1, 1, 1], 2), fern(0.7, [0.85, 1.05, 0.8], 1.5), flowers('white', ['#f4f4ee', '#ffffff', '#ece8d8'], 1.2), flowers('yellow', ['#f2d230', '#f7e463'], 1), flowers('purple', ['#8a63c8', '#b58ae0', '#e0a6d8'], 0.8)], [0, 4, 6]),
      tuft: fewer([tuft(0.9, [1, 1, 1], 3), tuft(1.2, [1.28, 1.12, 0.72], 1.5), tuft(0.7, [0.82, 1.0, 0.82], 2), tuft(1.5, [1.1, 1.08, 0.85], 1)], [0, 1]),
      rock: fewer(rocks, [0])
    };
  } catch (e) { console.warn('nature assets not loaded, keeping the drawn scenery', e); return null; }
}

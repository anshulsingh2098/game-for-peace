/* Real-scan scenery (R5 of team/photoreal-plan.md): trees, bushes and grass drawn as crossed cards textured with Blender renders of real Poly Haven
   plant scans, rocks as real scans reduced to a few thousand triangles. Everything is CC0 (assets/ASSETS.md). Loads in the background; the scenery
   starts with the drawn models and switches when this is ready (Scatter.setProps). Off with ?nature=flat.
   Cards: the render of a plant (assets/nature/*.png, a square frame of `frame` metres around the plant) is scaled so the plant reaches `tall` metres. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sway } from './props.js';

const tl = new THREE.TextureLoader();
function card(tex, meta, tall, count) {                                  // `count` planes crossed around the vertical axis, upright, base at y = 0
  const k = tall / meta.height, size = meta.frame * k, up = (meta.cz - meta.zmin) * k, parts = [];
  for (let i = 0; i < count; i++) { const p = new THREE.PlaneGeometry(size, size); p.rotateY(i * Math.PI / count); p.translate(0, up, 0); parts.push(p); }
  const g = mergeGeometries(parts), pos = g.attributes.position, n = new Float32Array(pos.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.set(pos.getX(i), pos.getY(i) - up * 0.9, pos.getZ(i)).normalize(); v.y = v.y * 0.6 + 0.5; v.normalize(); n[i * 3] = v.x; n[i * 3 + 1] = v.y; n[i * 3 + 2] = v.z; }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); return g;
}
const material = tex => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return sway(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide })); };

/* resolves to { pine: [...], round: [...], bush: [...], tuft: [...], rock: [{geom, mat}...] }, or null if anything fails */
export async function loadNature(level = 'full') {            // level 'low': fewer variants (fewer draw calls on weak devices)
  try {
    const meta = await (await fetch('assets/nature/cards.json')).json(), t = n => tl.loadAsync(`assets/nature/${n}.png`);
    const names = ['fir_sapling_0', 'fir_sapling_1', 'fir_sapling_2', 'pine_sapling_small_0', 'pine_sapling_small_1', 'pine_sapling_small_2', 'island_tree_02', 'shrub_03', 'fern_02', 'grass_medium_02'];
    const tex = Object.fromEntries(await Promise.all(names.map(async n => [n, await t(n)])));
    const mat = Object.fromEntries(names.map(n => [n, material(tex[n])]));
    const conifer = (n, tall) => ({ foliage: card(tex[n], meta[n], tall, 3), mat: mat[n] });
    const rocks = [];
    const gl = new GLTFLoader();
    for (const n of ['namaqualand_boulder_02', 'rock_07']) {
      const gltf = await gl.loadAsync(`assets/nature/${n}.glb`); let mesh = null; gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      if (mesh) { const m = mesh.material; m.roughness = 0.92; m.metalness = 0; m.envMapIntensity = 0.3; rocks.push({ geom: mesh.geometry, mat: m }); }
    }
    const low = level === 'low', fewer = (list, keep) => low ? keep.map(i => list[i]) : list;
    return {
      pine: fewer([conifer('fir_sapling_0', 13), conifer('fir_sapling_1', 11), conifer('fir_sapling_2', 9), conifer('pine_sapling_small_0', 13), conifer('pine_sapling_small_1', 11), conifer('pine_sapling_small_2', 9)], [0, 4]),
      round: [{ foliage: card(tex.island_tree_02, meta.island_tree_02, 9, 3), mat: mat.island_tree_02 }],
      bush: fewer([{ foliage: card(tex.shrub_03, meta.shrub_03, 0.9, 3), mat: mat.shrub_03 }, { foliage: card(tex.fern_02, meta.fern_02, 1.0, 3), mat: mat.fern_02 }], [0]),
      tuft: [{ foliage: card(tex.grass_medium_02, meta.grass_medium_02, 0.9, 3), mat: mat.grass_medium_02 }],
      rock: fewer(rocks, [0])
    };
  } catch (e) { console.warn('nature assets not loaded, keeping the drawn scenery', e); return null; }
}

/* Entry point of the new engine (next.html). Phase 1: generated terrain you can fly over.
   Address options: ?seed=word  ?q=low|med|high  ?c=<share code>
   Keys: R new seed, G wireframe, H hide panels; flying keys are listed in debug/flycam.js. */
import * as THREE from 'three';
import { makeConfig, decodeConfig, encodeConfig, VIEW_PRESETS } from './core/config.js';
import { randomSeed } from './core/rng.js';
import { createTerrain } from './world/terrain.js';
import { TileGrid } from './world/chunks.js';
import { grassTex } from './world/textures.js';
import { FlyCam } from './debug/flycam.js';
import { statsPanel } from './debug/stats.js';

const $ = s => document.querySelector(s), q = new URLSearchParams(location.search);
const phone = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
const quality = VIEW_PRESETS[q.get('q')] ? q.get('q') : phone ? 'low' : 'med';
let config = (q.get('c') && decodeConfig(q.get('c'))) || makeConfig({ seed: q.get('seed') || 'peace' });
config.view = { ...config.view, ...VIEW_PRESETS[quality] };

const canvas = $('#view'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1 : 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(58, 1, 0.5, 14000);
const SKY = 0xcfe6ff; scene.background = new THREE.Color(SKY); scene.fog = new THREE.Fog(SKY, 150, 900);
const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x7d7a6a, 1.15), sun = new THREE.DirectionalLight(0xfff2dc, 3.2);
sun.position.set(-0.30, 0.85, -0.45).multiplyScalar(500); scene.add(hemi, sun);

const ground = new THREE.MeshLambertMaterial({ vertexColors: true, map: grassTex() });
const waterMat = new THREE.MeshLambertMaterial({ color: 0x1d4a5a, transparent: true, opacity: 0.82 });
const water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), waterMat); water.renderOrder = 1; scene.add(water);

let terrain = createTerrain(config);
const grid = new TileGrid(scene, terrain, config.view, ground), cam = new FlyCam(canvas);
/* the far grid's tiles are a whole number of near tiles wide; it leaves out the tiles the near grid is guaranteed to cover */
const farView = () => { const v = config.view, f = v.far, reach = v.rings[v.rings.length - 1].r * v.tile;
  return { tile: f.tile, rings: [{ r: f.r, res: f.res }], budgetMs: 2, rebase: Infinity, inner: Math.floor(reach / f.tile) - 1, sink: f.sink }; };
const far = new TileGrid(scene, terrain, farView(), ground); far.origin = grid.origin;

function applyView() {
  const reach = (far.outer + 0.5) * far.size; scene.fog.near = reach * 0.1; scene.fog.far = reach * 0.96;
  water.scale.set(reach * 4, 1, reach * 4); water.position.y = terrain.seaLevel;
}
function spawn() { const p = terrain.findSpawn(); cam.x = p.x; cam.z = p.z; cam.y = p.y + 45; cam.pitch = -0.28; }
function regenerate(seed) {
  config = makeConfig({ ...config, seed }); terrain = createTerrain(config); grid.reset(terrain, config.view); far.reset(terrain, farView()); applyView(); spawn();
  $('#seed').value = seed; history.replaceState(null, '', '?seed=' + encodeURIComponent(seed) + '&q=' + quality);
}
applyView(); spawn(); $('#seed').value = config.seed;

$('#seedForm').addEventListener('submit', e => { e.preventDefault(); regenerate($('#seed').value.trim() || 'peace'); $('#seed').blur(); });
$('#newSeed').addEventListener('click', () => regenerate(randomSeed()));
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'KeyR') regenerate(randomSeed());
  if (e.code === 'KeyG') ground.wireframe = !ground.wireframe;
  if (e.code === 'KeyH') document.body.classList.toggle('bare');
});
function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const stats = statsPanel($('#stats'), renderer, () => {
  const s = grid.stats(), f = far.stats(), h = terrain.height(cam.x, cam.z);
  return ['tiles       ' + s.tiles + '  (' + s.lod.join(' / ') + ' by detail)   far ' + f.tiles, 'build queue ' + (s.queue + f.queue) + '   pooled ' + (s.pooled + f.pooled) + '   built ' + (s.built + f.built),
    'position    ' + cam.x.toFixed(0) + ', ' + cam.z.toFixed(0) + '   origin ' + grid.origin.x + ', ' + grid.origin.z,
    'ground      ' + h.toFixed(1) + ' m   camera ' + cam.y.toFixed(1) + ' m', 'fly speed   ' + cam.speed.toFixed(0) + ' m/s', 'seed        ' + config.seed + '   quality ' + quality];
});

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  cam.update(dt, (x, z) => Math.max(terrain.seaLevel, terrain.height(x, z)) + 1.7);
  if (grid.rebase(cam.x, cam.z)) far.reposition();
  grid.update(cam.x, cam.z); far.update(cam.x, cam.z); cam.apply(camera, grid.origin);
  water.position.x = camera.position.x; water.position.z = camera.position.z;
  renderer.render(scene, camera); stats(now);
}
requestAnimationFrame(frame);

window.__next = { get config() { return config; }, get terrain() { return terrain; }, grid, far, cam, renderer, scene, regenerate, encodeConfig };

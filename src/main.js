/* Entry point of the new engine (next.html). Phase 2: generated terrain with a routed road, scenery and water.
   Address options: ?seed=word  ?q=low|med|high  ?c=<share code>
   Keys: T ride along the road, R new world, G wireframe, H hide panels; flying keys are listed in debug/flycam.js. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeConfig, decodeConfig, encodeConfig, VIEW_PRESETS } from './core/config.js';
import { randomSeed } from './core/rng.js';
import { createTerrain } from './world/terrain.js';
import { Road } from './world/router.js';
import { RoadMesh, TWO_LANE } from './world/road.js';
import { TileGrid } from './world/chunks.js';
import { Scatter } from './world/scatter.js';
import { WIND } from './world/props.js';
import { grassTex, waterNormalTex } from './world/textures.js';
import { FlyCam } from './debug/flycam.js';
import { statsPanel } from './debug/stats.js';

const $ = s => document.querySelector(s), q = new URLSearchParams(location.search);
const phone = matchMedia('(pointer: coarse)').matches || innerWidth < 500;
const quality = VIEW_PRESETS[q.get('q')] ? q.get('q') : phone ? 'low' : 'med';
let config = (q.get('c') && decodeConfig(q.get('c'))) || makeConfig({ seed: q.get('seed') || 'peace' });
config.view = { ...config.view, ...VIEW_PRESETS[quality] };

const canvas = $('#view'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1 : 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(58, 1, 0.5, 14000);
const SKY = 0xcfe6ff; scene.background = new THREE.Color(SKY); scene.fog = new THREE.Fog(SKY, 150, 900);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;      // soft reflections for water and wet road until the real sky arrives
const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x7d7a6a, 1.15), sun = new THREE.DirectionalLight(0xfff2dc, 3.2);
sun.position.set(-0.30, 0.85, -0.45).multiplyScalar(500); scene.add(hemi, sun);

const ground = new THREE.MeshLambertMaterial({ vertexColors: true, map: grassTex() });
const ripples = waterNormalTex(), RIP = 0.07;
const waterMat = new THREE.MeshStandardMaterial({ color: 0x1d4a5a, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.9, normalMap: ripples, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.5 });
const water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), waterMat); water.renderOrder = 1; scene.add(water);

/* the world: land, the road through it, and everything drawn from them */
let terrain, road, roadMesh, scatter, roadS = 0;
const cam = new FlyCam(canvas);
const farView = () => { const v = config.view, f = v.far, reach = v.rings[v.rings.length - 1].r * v.tile;      // far tiles leave out what the near grid is guaranteed to cover
  return { tile: f.tile, rings: [{ r: f.r, res: f.res }], budgetMs: 2, rebase: Infinity, inner: Math.floor(reach / f.tile) - 1, sink: f.sink }; };
function makeWorld() {
  terrain = createTerrain(config); road = new Road(terrain, config); road.ensure(-2600, 2600); terrain.attachRoad(road); roadS = 0;
}
makeWorld();
const grid = new TileGrid(scene, terrain, config.view, ground), far = new TileGrid(scene, terrain.far, farView(), ground); far.origin = grid.origin;
function makeScenery() {
  if (roadMesh) roadMesh.dispose(); if (scatter) scatter.dispose();
  roadMesh = new RoadMesh(scene, road, TWO_LANE, grid.origin); scatter = new Scatter(scene, terrain, config, grid.origin);
}
makeScenery();

function applyView() {
  const reach = (far.outer + 0.5) * far.size; scene.fog.near = reach * 0.1; scene.fog.far = reach * 0.96;
  water.scale.set(reach * 4, 1, reach * 4); water.position.y = terrain.seaLevel; ripples.repeat.set(reach * 4 * RIP, reach * 4 * RIP);
}
/* start beside the road, looking along it */
function spawn() {
  const p = road.at(0), yaw = Math.atan2(-p.tx, -p.tz);
  cam.x = p.x - p.tx * 45; cam.z = p.z - p.tz * 45; cam.y = p.y + 16; cam.yaw = yaw; cam.pitch = -0.24; ride = false;
}
function regenerate(seed) {
  config = makeConfig({ ...config, seed }); makeWorld(); grid.reset(terrain, config.view); far.reset(terrain.far, farView()); makeScenery(); applyView(); spawn();
  $('#seed').value = seed; history.replaceState(null, '', '?seed=' + encodeURIComponent(seed) + '&q=' + quality);
}
let ride = false, rideYaw = 0;
applyView(); spawn(); $('#seed').value = config.seed;

$('#seedForm').addEventListener('submit', e => { e.preventDefault(); regenerate($('#seed').value.trim() || 'peace'); $('#seed').blur(); });
$('#newSeed').addEventListener('click', () => regenerate(randomSeed()));
const toggleRide = () => { ride = !ride; if (ride) { roadS = road.closestS(cam.x, cam.z, roadS); rideYaw = cam.yaw; } $('#ride').classList.toggle('on', ride); };
$('#ride').addEventListener('click', toggleRide);
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'KeyR') regenerate(randomSeed());
  if (e.code === 'KeyT') toggleRide();
  if (e.code === 'KeyG') ground.wireframe = !ground.wireframe;
  if (e.code === 'KeyH') document.body.classList.toggle('bare');
});
function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const stats = statsPanel($('#stats'), renderer, () => {
  const s = grid.stats(), f = far.stats(), sc = scatter.stats(), h = terrain.height(cam.x, cam.z);
  return ['tiles       ' + s.tiles + '  (' + s.lod.join(' / ') + ' by detail)   far ' + f.tiles, 'build queue ' + (s.queue + f.queue + sc.queue) + '   pooled ' + (s.pooled + f.pooled) + '   built ' + (s.built + f.built),
    'scenery     ' + sc.things.toLocaleString('en-US') + ' in ' + sc.tiles + ' tiles   road pieces ' + roadMesh.pieces.size,
    'road        at ' + (roadS / 1000).toFixed(2) + ' km   built ' + (road.sMin / 1000).toFixed(1) + ' .. ' + (road.sMax / 1000).toFixed(1) + ' km',
    'position    ' + cam.x.toFixed(0) + ', ' + cam.z.toFixed(0) + '   origin ' + grid.origin.x + ', ' + grid.origin.z,
    'ground      ' + h.toFixed(1) + ' m   camera ' + cam.y.toFixed(1) + ' m', (ride ? 'ride speed  ' : 'fly speed   ') + cam.speed.toFixed(0) + ' m/s', 'seed        ' + config.seed + '   quality ' + quality];
});

const rp = {};
let last = performance.now();
function frame(now) { requestAnimationFrame(frame); step(Math.min(0.05, (now - last) / 1000), now); last = now; }
/* one frame of the world: move, keep the road and tiles built around the camera, draw */
function step(dt, now) {
  WIND.t.value = now / 1000;
  if (ride) {                                                   // ride: glide along the right-hand lane at the current speed
    roadS += Math.min(cam.speed, 90) * dt; road.at(roadS, rp);
    cam.x = rp.x - rp.tz * 2; cam.z = rp.z + rp.tx * 2; cam.y = rp.y + 1.6;
    const want = Math.atan2(-rp.tx, -rp.tz); rideYaw += Math.atan2(Math.sin(want - rideYaw), Math.cos(want - rideYaw)) * Math.min(1, dt * 4);
    cam.yaw = rideYaw; cam.pitch += (Math.atan(rp.slope) * 0.8 - 0.04 - cam.pitch) * Math.min(1, dt * 3);
  } else {
    cam.update(dt, (x, z) => Math.max(terrain.seaLevel, terrain.height(x, z)) + 1.7);
    roadS = road.closestS(cam.x, cam.z, roadS);
  }
  const box = road.ensure(roadS - 2600, roadS + 2600); if (box) grid.invalidate(box);        // the road keeps growing ahead of you, in both directions
  if (grid.rebase(cam.x, cam.z)) { far.reposition(); roadMesh.reposition(); scatter.reposition(); }
  grid.update(cam.x, cam.z); far.update(cam.x, cam.z); roadMesh.update(roadS); scatter.update(cam.x, cam.z); cam.apply(camera, grid.origin);
  water.position.x = camera.position.x; water.position.z = camera.position.z;
  ripples.offset.set((cam.x * RIP + now * 0.000011) % 1, (-cam.z * RIP + now * 0.000007) % 1);     // ripples stay fixed to the world while the sheet follows the camera
  renderer.render(scene, camera); stats(now);
}
requestAnimationFrame(frame);

window.__next = { get config() { return config; }, get terrain() { return terrain; }, get road() { return road; }, get roadMesh() { return roadMesh; }, get scatter() { return scatter; },
  get roadS() { return roadS; }, set roadS(v) { roadS = v; }, get ride() { return ride; }, toggleRide, grid, far, cam, camera, renderer, scene, regenerate, encodeConfig, step };

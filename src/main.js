/* Entry point of the new engine (next.html). Phase 3: drive anywhere in the generated world.
   Address options: ?seed=word  ?q=low|med|high  ?c=<share code>  ?debug (stats panel)
   Keys: arrows / W A S D drive (S reverses), Space brake, X handbrake, Shift boost, E autodrive, V camera view, C driver's seat, B back to the road, L headlights, M sound, F free-fly camera,
         T ride along the road, R new world, G wireframe, H hide panels. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeConfig, decodeConfig, encodeConfig, VIEW_PRESETS } from './core/config.js';
import { randomSeed } from './core/rng.js';
import { createTerrain } from './world/terrain.js';
import { Road } from './world/router.js';
import { RoadMesh } from './world/road.js';
import { roadStyleById } from './world/roadstyles.js';
import { TileGrid } from './world/chunks.js';
import { Scatter } from './world/scatter.js';
import { WIND } from './world/props.js';
import { grassTex, waterNormalTex } from './world/textures.js';
import { makeGroundMaterial } from './world/groundmat.js';
import { installTunnelHoles } from './world/tunnel_holes.js';
import { GameRuntime, EventBus, Registry } from './core/runtime.js';
import { OnFoot, chooseExit, Interactions } from './player/onfoot.js';
import { AssetCache } from './core/assets.js';
import { SectorManager } from './world/sectors.js';
import { RoadNav } from './world/navgraph.js';
import { NavDebug } from './debug/navdebug.js';
import { Pedestrians } from './pedestrians/pedestrians.js';
import { WALL, ARCH } from './world/tunnels.js';
import { loadNature } from './world/nature.js';
import { VEHICLES } from './vehicle/defs.js';
import { VehiclePhysics, vehicleParams, SURFACES } from './vehicle/physics.js';
import { RapierVehicle, initRapier, ARCADE } from './vehicle/rapier-vehicle.js';
import { VehicleView, loadModel } from './vehicle/vehicle.js';
import { CAMFX } from './vehicle/camfx.js';
import { LOOK, applyLook } from './fx/grade.js';
import { rumbleFor } from './input/rumble.js';
import { loadSave, writeSave } from './core/save.js';
import { destinationsFor } from './world/india_network.js';
import { DRIVE_MODES, DRIVE_MODE_IDS } from './vehicle/physics.js';
import { laneOffsets } from './traffic/sim.js';
import { ActivityRunner, activitiesFor, recordResult } from './activities/activities.js';
import { Traffic, loadTrafficPack } from './traffic/traffic.js';
import { applyPaint } from './vehicle/paint.js';
import { Controls } from './input/controls.js';
import { Autodrive } from './input/autodrive.js';
import { TouchUI } from './input/touchui.js';
import { Backdrop } from './env/backdrop.js';
import { Environment, TIMES, WX } from './env/environment.js';
import { registerRoot, setOverrides, applyWorld, describe, overrides } from './core/tuning.js';
import { Sound } from './audio/engine.js';
import { Radio } from './audio/radio.js';
import { RadioWheel, logo } from './ui/radiowheel.js';
import { Menu } from './ui/menu.js';
import { LOCATIONS, locationConfig, locationById, LEGACY, START_LOCATION, pickerLocations } from './world/locations.js';
import { Landmarks } from './world/landmarks.js';
import { FlyCam } from './debug/flycam.js';
import { statsPanel } from './debug/stats.js';
import { createFx, loadSkyLight } from './fx/pipeline.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], q = new URLSearchParams(location.search);
const phone = matchMedia('(pointer: coarse)').matches || innerWidth < 500;
const quality = VIEW_PRESETS[q.get('q')] ? q.get('q') : phone ? 'low' : 'med';
let savedLoc = null; try { savedLoc = JSON.parse(localStorage.getItem('gfp-next') || '{}').location || null; } catch (e) { /* no saved choice */ }
let config = (q.get('c') && decodeConfig(q.get('c'))) || locationConfig(q.get('loc') || (savedLoc && (LEGACY[savedLoc] || savedLoc)) || START_LOCATION, q.get('seed') || 'peace');          // India only: an old saved choice moves to its Indian replacement
/* tuner settings (core/tuning.js): the published settings.json first, then live changes sent by tuner.html */
registerRoot('vehicles', VEHICLES); registerRoot('times', TIMES); registerRoot('weather', WX); registerRoot('surfaces', SURFACES); registerRoot('handling', ARCADE); registerRoot('camera', CAMFX); registerRoot('look', LOOK);
for (const url of ['api/settings', 'settings.json']) {             // the published settings (tuner Publish), else a settings.json committed with the site
  try { const r = await fetch(url); if (r.ok) { const j = await r.json(); if (j && j.overrides) { setOverrides(j.overrides); break; } } } catch (e) { /* not there: carry on */ }
}
registerRoot('world', () => config); applyWorld(config);
if (q.get('road')) config.road.style = roadStyleById(q.get('road')).id;                  // ?road=highway|boulevard|dirt|gravel
config.view = { ...config.view, ...VIEW_PRESETS[quality] };
document.body.classList.toggle('debug', q.has('debug')); document.body.classList.toggle('dev', q.has('dev') || q.has('debug')); document.body.classList.toggle('touch', matchMedia('(pointer: coarse)').matches || q.has('touch'));

const canvas = $('#view'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1 : 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; renderer.outputColorSpace = THREE.SRGBColorSpace; applyLook(canvas, quality !== 'low');
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(58, 1, 0.3, 14000);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;      // first-frame reflections; the sky replaces them
const env = new Environment(renderer, scene); let reach = 900;
let skyLight = null; const fx = q.get('fx') ? createFx(renderer, scene, camera, q.get('fx')) : null;                       // ?fx=1 realism pipeline (src/fx/pipeline.js), ?fx=lite without ambient occlusion
if (fx) loadSkyLight(renderer, 'assets/sky/drakensberg_puresky_1k.hdr').then(t => { skyLight = t; });                     // a photographed sky for light and reflections, dimmed by the sun's height below
/* real sun shadows (trees, rocks, the vehicle) on the nearby ground and road; off on the low preset unless ?shadows=on */
const shadowsOn = q.get('shadows') ? q.get('shadows') !== 'off' : quality !== 'low';
renderer.shadowMap.enabled = shadowsOn; renderer.shadowMap.type = quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; env.setShadows(shadowsOn ? (quality === 'high' ? 4096 : 2048) : 0, quality === 'high' ? 90 : 70);
/* saved choices for this preview */
const loaded = loadSave((() => { try { return localStorage; } catch (e) { return { getItem: () => null, setItem() { throw e; }, removeItem() {} }; } })(), { vehicles: VEHICLES.length, vehicleIds: VEHICLES.map(v => v.id), locations: LOCATIONS.map(l => l.id) });      // versioned, checked, recovers from damage (core/save.js)
const S = { time: 'day', weather: 'clear', lights: 'auto', vehicle: 0, muted: false, paint: {}, traffic: quality === 'low' ? 'off' : quality === 'med' ? 'low' : 'mid', ...loaded.data }, save = () => writeSave((() => { try { return localStorage; } catch (e) { return { setItem() { throw e; } }; } })(), S, loaded);
env.setTime(S.time); env.setWeather(S.weather);

const natureLevel = q.get('nature') || (quality === 'low' ? 'low' : 'full'), groundLevel = q.get('ground') || (quality === 'low' ? 'flat' : quality === 'med' ? 'lite' : 'full');      // quality tiers: low keeps the cheap ground and fewer scenery variants, med a lighter photographic ground, high everything
/* the loading screen (next.html #loading): what is still loading, shown until the first frame is drawn */
const loadState = { world: true, physics: q.get('phys') === 'old', scenery: natureLevel === 'flat', car: false }, loadEl = $('#loading'), loadMsg = $('#loadMsg'), loadBar = $('#loadBar');
const LOAD_TEXT = { physics: 'Starting the physics…', scenery: 'Growing the trees…', car: 'Getting the car ready…' };
function loadUpdate() { const keys = Object.keys(loadState), done = keys.filter(k => loadState[k]).length, next = keys.find(k => !loadState[k]); if (loadBar) loadBar.style.width = Math.max(5, done / keys.length * 100) + '%'; if (loadMsg && next) loadMsg.textContent = LOAD_TEXT[next] || 'Building the world…'; }
function loadDone() { loadState.car = true; loadUpdate(); if (loadEl) { loadEl.classList.add('done'); setTimeout(() => loadEl.remove(), 600); } }
loadUpdate();
/* shared assets go through one cache (core/assets.js): loaded once, held while something uses them, freed when nothing does. Traffic holds the vehicle pack for the whole session; world sectors (below) hold what their region needs. */
const assetCache = new AssetCache({ load: async key => { if (key === 'traffic:pack') return { value: await loadTrafficPack(), bytes: 1.8e6 }; throw new Error('unknown asset ' + key); }, dispose: () => {} });
let trafficPack = null; assetCache.acquire('traffic:pack').then(p => { trafficPack = p; if (p && typeof traffic !== 'undefined' && traffic) traffic.useModels(p); }).catch(() => {});          // the traffic vehicles load in the background; plain boxes until they are there
let nature = null; if (natureLevel !== 'flat') loadNature(natureLevel).then(p => { nature = p; loadState.scenery = true; loadUpdate(); if (p && typeof scatter !== 'undefined' && scatter) scatter.setProps(p); });       // real-scan trees, plants and rocks (src/world/nature.js); ?nature=flat keeps the drawn ones
const photoGround = groundLevel !== 'flat', groundMat = photoGround ? makeGroundMaterial(groundLevel) : null;                // photographic ground (src/world/groundmat.js); ?ground=flat for the old drawn texture
let nav = null, navDebug = null, peds = null;                                                                                 // the navigation graph of the current road (src/world/navgraph.js), built a sector at a time; ?nav draws it
let holes = null;                                                                                                // doorways cut through the hillside at tunnel portals (src/world/tunnel_holes.js)
const ground = groundMat ? groundMat.material : new THREE.MeshLambertMaterial({ vertexColors: true, map: grassTex() });
const ripples = waterNormalTex(), RIP = 0.07;
const waterMat = new THREE.MeshStandardMaterial({ color: 0x1d4a5a, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.74, normalMap: ripples, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.5 });
/* ripples fade out with distance (beyond a few hundred metres they only alias into a checker pattern) and the surface is calmer far off */
const waterT = { value: 0 };
/* four moving layers of the same ripple texture (different sizes and directions, so the surface never repeats or sits still) */
waterMat.onBeforeCompile = sh => {
  sh.uniforms.uWT = waterT;
  sh.fragmentShader = 'uniform float uWT;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef USE_NORMALMAP_TANGENTSPACE
  vec3 w2 = texture2D(normalMap, vNormalMapUv * 2.3 + vec2(uWT * 0.021, uWT * 0.013)).xyz * 2.0 - 1.0;
  vec3 w3 = texture2D(normalMap, vNormalMapUv * -0.55 + vec2(-uWT * 0.011, uWT * 0.017)).xyz * 2.0 - 1.0;
  vec3 w4 = texture2D(normalMap, vNormalMapUv * 5.7 + vec2(uWT * 0.05, -uWT * 0.04)).xyz * 2.0 - 1.0;
  vec3 w1 = texture2D(normalMap, vNormalMapUv + vec2(uWT * 0.008, uWT * 0.005)).xyz * 2.0 - 1.0;
  vec2 wxy = (w1.xy + w2.xy * 0.7 + w3.xy * 0.9 + w4.xy * 0.35) * normalScale;
  normal = normalize(tbn * vec3(wxy, 1.0));
#endif
  normal = normalize(mix(nonPerturbedNormal, normal, 1.0 - smoothstep(18.0, 260.0, length(vViewPosition))));`);
};
const water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), waterMat); water.renderOrder = 1; scene.add(water);

/* ---------- the world: land, the road through it, and everything drawn from them ---------- */
let terrain, road, roadMesh, scatter, backdrop, landmarks, traffic = null, roadS = 0;
const farView = () => { const v = config.view, f = v.far, reach = v.rings[v.rings.length - 1].r * v.tile;      // far tiles leave out what the near grid is guaranteed to cover
  return { tile: f.tile, rings: [{ r: f.r, res: f.res }], budgetMs: 2, rebase: Infinity, inner: Math.floor(reach / f.tile) - 1, sink: f.sink }; };
function makeWorld() { terrain = createTerrain(config); road = new Road(terrain, config); road.ensure(-2600, 2600); terrain.attachRoad(road); roadS = 0; }
makeWorld();
const grid = new TileGrid(scene, terrain, config.view, ground), far = new TileGrid(scene, terrain.far, farView(), ground); far.origin = grid.origin;
function makeScenery() {
  if (roadMesh) roadMesh.dispose(); if (scatter) scatter.dispose(); if (backdrop) { scene.remove(backdrop.group); backdrop.group.children.forEach(m => { m.geometry.dispose(); m.material.dispose(); }); }
  backdrop = new Backdrop(scene, terrain, config);
  if (landmarks) landmarks.dispose(); landmarks = new Landmarks(scene, terrain, road, config, grid.origin, locationById(config.location).landmarks);       // sights beside the road; they also level the land under them
  roadMesh = new RoadMesh(scene, road, road.style, grid.origin, { dests: (() => { const ins = (locationById(config.location).region || {}).inspiration; return ins ? destinationsFor(ins.lat, ins.lon) : []; })(), district: (locationById(config.location).region || {}).district, seed: config.seed + ':' + config.location, blocked: (x, z) => terrain.inZone(x, z, 8) }); scatter = new Scatter(scene, terrain, config, grid.origin); if (nature) scatter.setProps(nature);
  if (nav) nav.unloadAll(); nav = new RoadNav(road, { drive: locationById(config.location).drive || 'right' }); if (q.has('nav') && !navDebug) navDebug = new NavDebug(scene);
  if (peds) { peds.dispose(); peds = null; }
  if (traffic) traffic.dispose(); traffic = new Traffic(scene, road, config.seed, grid.origin, { mode: S.traffic, drive: locationById(config.location).drive || 'right', scale: (locationById(config.location).region || { traffic: { scale: 1 } }).traffic.scale, mix: (locationById(config.location).region || { traffic: {} }).traffic.mix || null, pack: trafficPack });          // cars on the road (src/traffic), on the right or the left as the place drives
  { const reg = locationById(config.location).region; if (reg && reg.district && reg.population && reg.population.density > 0) peds = new Pedestrians(scene, nav, config.seed + ':' + config.location, grid.origin, { density: reg.population.density, archetypes: reg.population.archetypes, level: S.traffic, traffic: traffic.sim }); }          // people on the sidewalks of a built-up region (src/pedestrians); their number follows the traffic setting
  env.attach({ ground, road: roadMesh.surface }); if (groundMat) { groundMat.install(); groundMat.setSea(terrain.seaLevel); groundMat.uniforms.uArid.value = (config.palette && config.palette.arid) || 0; } if (!holes) holes = installTunnelHoles(ground, WALL, ARCH); waterMat.color.set(config.water.color);
}
makeScenery();
function applyView() {
  reach = (far.outer + 0.5) * far.size;
  water.scale.set(reach * 4, 1, reach * 4); water.position.y = terrain.seaLevel; ripples.repeat.set(reach * 4 * RIP, reach * 4 * RIP);
}

/* ---------- the vehicle ---------- */
const cam = new FlyCam(canvas), controls = new Controls(), autodrive = new Autodrive(), view = new VehicleView(scene);
const world = { height: (x, z) => terrain.drive(x, z), surface: (x, z) => terrain.surface(x, z), near: (x, z, r) => { const l = landmarks ? scatter.near(x, z, r).concat(landmarks.near(x, z, r)) : scatter.near(x, z, r); return roadMesh ? l.concat(roadMesh.bridges.near(x, z, r), roadMesh.highway.near(x, z, r), roadMesh.district ? roadMesh.district.near(x, z, r) : [], traffic ? traffic.circles(x, z, r) : []) : l; }, get seaLevel() { return terrain.seaLevel; },
  grip: key => (1 - env.w.wet * (key === 'asphalt' ? 0.26 : 0.12)) * (1 - env.w.snow * 0.45) };       // rain makes the road slippery; lying snow more so
const sound = new Sound();
const unlockAudio = () => { if (!sound.ctx) { sound.init(); sound.music = 0; sound.sfx = S.muted ? 0 : 0.6; sound.applyVolumes(); } sound.resume(); };      // browsers only allow sound after a key or tap
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, unlockAudio, { passive: true });
document.addEventListener('visibilitychange', () => { if (!sound.ctx) return; if (document.hidden) sound.ctx.suspend(); else sound.resume(); });
let mode = 'drive', vehicle = Math.max(0, Math.min(VEHICLES.length - 1, S.vehicle | 0)), phys = null, rideYaw = 0, auto = null, input = { steer: 0, throttle: 0, brake: 0 }, buffT = 0, buffCd = 0, boostEase = 0, tunnelAmt = 0;      // mode: 'drive', 'fly' (free camera) or 'ride' (camera glides along the road)
let menu = null; const frozen = () => !!(menu && menu.open);
let rapier = false; const rapierReady = q.get('phys') === 'old' ? Promise.resolve() : initRapier().then(() => { rapier = true; loadState.physics = true; loadUpdate(); }).catch(e => console.warn('Rapier did not load; using the simple physics', e));
/* put the vehicle in the left lane at road distance s, facing along the road */
/* the player starts in the first lane of the direction of travel, on the side traffic keeps to (left in India); wide divided roads have their own lane centres */
function placeOnRoad(s) { const p = road.at(s, {}), off = laneOffsets(road.style)[0], lat = (locationById(config.location).drive || 'right') === 'right' ? -off : off; phys.reset(p.x - p.tz * lat, p.z + p.tx * lat, p.th); view.camYaw = null; }
async function setVehicle(i) {
  const def = VEHICLES[i], model = await loadModel(def), old = phys; vehicle = i; await rapierReady; bus.emit('vehicle:changed', { id: def.id });
  const par = vehicleParams(def.body, def.stats);
  if (old && old.free) old.free();
  phys = rapier ? new RapierVehicle(par, def.id, world) : new VehiclePhysics(par, world);                       // Rapier ray-cast vehicle; the old bicycle model remains as a fallback (?phys=old)
  if (old) { phys.reset(old.x, old.z, old.yaw); } else placeOnRoad(0);
  buffT = 0; buffCd = 0; $('#buff').firstChild.textContent = def.buff.label; $('#buff').title = def.buff.name + ': ' + def.buff.desc + ' (Shift)';
  if (S.paint[def.id] && S.paint[def.id] !== def.paint.colors[0]) await applyPaint(def, model, S.paint[def.id]);
  buildSwatches(def, model);
  view.realShadow = shadowsOn; view.setModel(def, model); $$('#vehicles button').forEach((b, k) => b.classList.toggle('on', k === i)); document.documentElement.style.setProperty('--accent', def.color);
  if (phys.setDriveMode) phys.setDriveMode(S.driveMode || 'normal');
  S.vehicle = i; save(); if (sound.ctx) sound.setVehicle(def.id);
}
/* paint swatches for the current vehicle */
function buildSwatches(def, model) {
  const box = $('#paint'), cur = S.paint[def.id] || def.paint.colors[0]; box.innerHTML = ''; box.setAttribute('aria-label', def.paint.label + ' colour');
  for (const c of def.paint.colors) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.style.background = c; b.setAttribute('aria-label', def.paint.label + ' colour ' + c); b.setAttribute('aria-pressed', c === cur);
    b.addEventListener('click', () => { S.paint[def.id] = c; save(); for (const x of box.children) x.setAttribute('aria-pressed', x === b); applyPaint(def, model, c); b.blur(); });
    box.appendChild(b);
  }
}
/* each vehicle has one buff: a few seconds of help, then a cooldown */
function useBuff() {
  if (mode !== 'drive' || !phys || buffCd > 0) return; const b = VEHICLES[vehicle].buff;
  buffT = b.secs; buffCd = b.cooldown; phys.setMod(b.mod); toast(b.name);
}
function backToRoad() { if (!phys) return; roadS = road.closestS(phys.x, phys.z, roadS); placeOnRoad(roadS); setMode('drive'); toast('Back on the road'); }
/* on foot (N14, src/player/onfoot.js): G beside a stopped vehicle gets you out; G beside the parked vehicle gets you back in. The vehicle waits on its handbrake. */
let entities = null; const interactions = new Interactions(); let vehicleHandle = 0, foot = null, figure = null, parkedYaw = 0, footPitch = 0.28, lookDrag = null;
const footWorld = { height: (x, z) => world.height(x, z), surface: (x, z) => world.surface(x, z), get seaLevel() { return world.seaLevel; },
  near: (x, z, r) => { const l = world.near(x, z, r).slice(); if (phys && mode === 'foot') { const c = Math.cos(phys.yaw), s = Math.sin(phys.yaw), a = (phys.p.front + phys.p.rear) / 4; l.push([{ x: phys.x + c * a, z: phys.z + s * a, r: 1.15 }, { x: phys.x - c * a, z: phys.z - s * a, r: 1.15 }]); } return l; } };
function makeFigure() { const g = new THREE.Group(), m = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }), box = (w, h, d, c, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c)); b.position.y = y; b.castShadow = true; g.add(b); return b; };
  box(0.5, 0.65, 0.28, 0x2f6fb5, 1.15); box(0.22, 0.8, 0.24, 0x2b2b3a, 0.4).position.x = -0.12; const l2 = box(0.22, 0.8, 0.24, 0x2b2b3a, 0.4); l2.position.x = 0.12; box(0.22, 0.24, 0.22, 0xd9a577, 1.65); g.userData.legs = g.children.slice(1, 3); return g; }
function exitVehicle() {
  if (mode !== 'drive' || !phys || frozen() || Math.abs(phys.u) > 2.5) { if (mode === 'drive' && phys && Math.abs(phys.u) > 2.5) toast('Stop first to get out'); return; } setAuto(false);
  const spot = chooseExit({ x: phys.x, z: phys.z, yaw: phys.yaw, halfWidth: 0.95, halfLength: (phys.p.front + phys.p.rear) / 2 }, footWorld); if (!spot) { toast('No room to get out here'); return; }
  foot = new OnFoot(footWorld); foot.place(spot.x, spot.z, spot.yaw); if (!figure) { figure = makeFigure(); scene.add(figure); } figure.visible = true; parkedYaw = phys.yaw;
  cam.yaw = -Math.PI / 2 - foot.yaw; vehicleHandle = (entities = entities || new Registry({ vehicle: 4, player: 1 }, bus)).create('vehicle', { index: vehicle }); setMode('foot'); bus.emit('vehicle:exited', { handle: vehicleHandle });
  interactions.add({ id: 'vehicle', x: phys.x, z: phys.z, r: 3.4, prompt: 'Get in (G)', onUse: enterVehicle }); toast('On foot: W A S D walk, Shift run, Space jump, G to get back in');
}
function enterVehicle() { if (mode !== 'foot' || !phys) return; interactions.remove('vehicle'); if (figure) figure.visible = false; const h = vehicleHandle; setMode('drive'); entities.destroy(h); vehicleHandle = 0; foot = null; bus.emit('vehicle:entered', { handle: h }); view.camYaw = null; toast('Back in the vehicle'); }
function useNearby() { if (mode === 'foot') { if (foot) interactions.use(foot.x, foot.z); } else if (mode === 'drive' && phys && Math.abs(phys.u) < 6 && interactions.use(phys.x, phys.z, 'activity:')) { /* an activity started */ } else exitVehicle(); }
/* mouse look on foot: click the game to capture the mouse (Esc releases it), then moving the mouse turns the character and tilts the camera; on a touch screen, drag on the scene */
const lookBy = (dx, dy) => { if (mode !== 'foot' || !foot || frozen()) return; foot.yaw += dx * 0.0035; footPitch = Math.max(-0.35, Math.min(1.1, footPitch + dy * 0.0030)); };
canvas.addEventListener('pointerdown', e => { if (mode !== 'foot' || frozen()) return; if (e.pointerType === 'mouse') { if (document.pointerLockElement !== canvas && canvas.requestPointerLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* not allowed: drag instead */ } } lookDrag = { id: e.pointerId, x: e.clientX, y: e.clientY }; } else lookDrag = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => { if (document.pointerLockElement === canvas) { lookBy(e.movementX, e.movementY); return; } if (lookDrag && lookDrag.id === e.pointerId) { lookBy(e.clientX - lookDrag.x, e.clientY - lookDrag.y); lookDrag.x = e.clientX; lookDrag.y = e.clientY; } });
for (const n of ['pointerup', 'pointercancel']) addEventListener(n, e => { if (lookDrag && lookDrag.id === e.pointerId) lookDrag = null; });
const actBtn = document.createElement('button'); actBtn.type = 'button'; actBtn.id = 'interact'; actBtn.style.cssText = 'position:fixed;left:50%;bottom:22%;transform:translateX(-50%);z-index:20;display:none;padding:8px 18px;border-radius:999px'; document.body.appendChild(actBtn); actBtn.addEventListener('pointerdown', e => { e.preventDefault(); useNearby(); });
function updatePrompt() { let t = ''; if (!frozen()) { if (mode === 'foot' && foot) { const it = interactions.nearest(foot.x, foot.z); if (it) t = it.prompt; } else if (mode === 'drive' && phys && Math.abs(phys.u) < 6 && !autodrive.enabled) t = (phys && interactions.nearest(phys.x, phys.z, 'activity:') || {}).prompt || 'Get out (G)'; } if (t !== actBtn.textContent) actBtn.textContent = t; actBtn.style.display = t ? 'block' : 'none'; }
function setMode(m) {
  if (m !== mode) bus.emit('mode:changed', { from: mode, to: m });
  if (m !== 'drive' && autodrive.enabled) { autodrive.toggle(false); $('#autoBtn').classList.remove('on'); }
  if (m === 'fly' && phys) { cam.x = phys.x - Math.cos(phys.yaw) * 14; cam.z = phys.z - Math.sin(phys.yaw) * 14; cam.y = phys.y + 7; cam.yaw = -Math.PI / 2 - phys.yaw; cam.pitch = -0.25; }
  if (m === 'ride') { roadS = road.closestS(phys ? phys.x : cam.x, phys ? phys.z : cam.z, roadS); rideYaw = phys ? -Math.PI / 2 - phys.yaw : cam.yaw; cam.speed = Math.min(cam.speed, 40); }
  if (m === 'drive' && mode === 'ride' && phys) placeOnRoad(roadS);
  mode = m; controls.enabled = m === 'drive' || m === 'foot'; document.body.dataset.mode = m; view.root.visible = m !== 'ride'; sound.setEngineOn(m === 'drive' && !frozen());
  $('#fly').classList.toggle('on', m === 'fly'); $('#ride').classList.toggle('on', m === 'ride');
}
function regenerate(seed, locId) {
  const fromLoc = config.location;
  if (locId) config = { ...locationConfig(locId, seed), view: config.view }; else config = makeConfig({ ...config, seed }); applyWorld(config); makeWorld(); grid.reset(terrain, config.view); far.reset(terrain.far, farView()); makeScenery(); applyView();
  if (phys) placeOnRoad(0); setMode('drive');
  if (config.location !== fromLoc) bus.emit('region:changed', { from: fromLoc, to: config.location }); bus.emit('world:rebuilt', { seed: config.seed, location: config.location });
  $('#seed').value = seed; history.replaceState(null, '', '?seed=' + encodeURIComponent(seed) + '&loc=' + config.location + '&q=' + quality + (q.has('debug') ? '&debug' : ''));
}
let toastT; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800); }

/* ---------- screen controls ---------- */
applyView(); $('#seed').value = config.seed;
$('#seedForm').addEventListener('submit', e => { e.preventDefault(); regenerate($('#seed').value.trim() || 'peace'); $('#seed').blur(); });
$('#newSeed').addEventListener('click', () => regenerate(randomSeed()));
$$('#vehicles button').forEach((b, i) => b.addEventListener('click', () => { setVehicle(i); b.blur(); }));
autodrive.lane = dir => traffic ? traffic.sim.lateral(dir, 0) : 0; autodrive.leader = (ph, s) => traffic && traffic.mode !== 'off' ? traffic.sim.leaderAhead({ x: ph.x, z: ph.z, s, yaw: ph.yaw, u: ph.u }) : null;       // autodrive keeps to a lane and follows traffic
function setAuto(on) { if (on && (mode !== 'drive' || !phys)) return; autodrive.s = roadS; autodrive.toggle(on); $('#autoBtn').classList.toggle('on', on); if (touchUI) touchUI.setAuto(on); toast(on ? 'Autodrive on: steer or brake to take over' : 'Autodrive off'); }
/* camera views, cycled with V like the old GTA games; C jumps to the driver's seat and back */
const CAMS = ['middle', 'far', 'close', 'hood', 'bumper', 'cockpit', 'cinematic'], CAM_NAMES = { middle: 'Chase', far: 'Far chase', close: 'Close chase', hood: 'Hood', bumper: 'Bumper', cockpit: 'Driver seat', cinematic: 'Cinematic' };
function setCam(name, quiet) { if (!CAMS.includes(name)) name = 'middle'; view.setMode(name); S.cam = name; save(); if (!quiet) toast('Camera: ' + CAM_NAMES[name]); }
const cycleCam = () => setCam(CAMS[(CAMS.indexOf(view.mode || 'middle') + 1) % CAMS.length]);
const toggleView = () => { if (view.mode === 'cockpit') setCam(S.camBefore || 'middle'); else { S.camBefore = view.mode || 'middle'; setCam('cockpit'); } };
setCam(S.cam, true);
$('#viewBtn').addEventListener('click', cycleCam); $('#reset').addEventListener('click', backToRoad);
$('#fly').addEventListener('click', () => setMode(mode === 'fly' ? 'drive' : 'fly')); $('#ride').addEventListener('click', () => setMode(mode === 'ride' ? 'drive' : 'ride'));
controls.on('auto', () => setAuto(!autodrive.enabled)); $('#autoBtn').addEventListener('click', () => setAuto(!autodrive.enabled)); controls.on('view', toggleView); controls.on('cam', cycleCam); controls.on('reset', backToRoad); controls.on('interact', useNearby); controls.on('buff', useBuff); $('#buff').addEventListener('pointerdown', e => { e.preventDefault(); useBuff(); }); controls.on('fly', () => setMode(mode === 'fly' ? 'drive' : 'fly'));
controls.bindPads($$('.pad'));
let touchUI = null; if (document.body.classList.contains('touch')) { touchUI = new TouchUI(controls); view.camMul = { back: 0.72, up: 0.72, look: 1.3, fov: 6 }; }       // phones: slowroads-style controls, and a lower, closer, wider chase camera
$('#time').value = S.time; $('#weather').value = S.weather;
$('#time').addEventListener('change', e => { S.time = e.target.value; save(); env.setTime(S.time); e.target.blur(); });
$('#weather').addEventListener('change', e => { S.weather = e.target.value; save(); env.setWeather(S.weather); e.target.blur(); });
const cycleLights = () => { const o = ['auto', 'on', 'off']; S.lights = o[(o.indexOf(S.lights) + 1) % 3]; save(); toast('Headlights: ' + S.lights); };
/* live radio: a stream in its own <audio> element, a wheel to pick the station, and a chip that names what is playing */
const radio = new Radio(), nowEl = $('#now'); let nowT;
radio.setVolume(S.radioVol ?? 0.6); radio.setMuted(S.muted);
const wheel = new RadioWheel(radio, { toast, locked: v => { controls.locked = v || frozen(); }, onTune: i => {
  S.station = i >= 0 ? radio.stations[i].id : null; save(); unlockAudio();
  if (i === -2) { toast('Radio off'); return; }
  const st = radio.stations[i]; if (!st) return; nowEl.textContent = ''; nowEl.appendChild(logo(st));
  const t = document.createElement('span'); t.innerHTML = '<b></b><small></small>'; t.firstChild.textContent = st.name; t.lastChild.textContent = st.genre + ' · ' + st.region; nowEl.appendChild(t);
  nowEl.classList.add('on'); clearTimeout(nowT); nowT = setTimeout(() => nowEl.classList.remove('on'), 4000); } });
radio.on(s => { if (s.error && s.station) toast(s.station.name + ' is off air'); S.radioVol = s.vol; });
$('#radioBtn').addEventListener('click', () => wheel.toggle());
const toggleMute = () => { S.muted = !S.muted; save(); radio.setMuted(S.muted); if (sound.ctx) { sound.sfx = S.muted ? 0 : 0.6; sound.applyVolumes(); } toast(S.muted ? 'Sound off' : 'Sound on'); };
/* a location: its land and plants from the profile, and the sky it starts with */
function setLocation(id) {
  const L = locationById(id); if (L.id === config.location) return; S.location = L.id; S.time = L.sky.time; S.weather = L.sky.weather; save(); env.setTime(S.time); env.setWeather(S.weather);
  regenerate(config.seed, L.id); toast(L.name);
}
/* ---------- menus: title, garage, settings, pause ---------- */
const reloadWith = (k, v) => { const u = new URLSearchParams(location.search); u.set('seed', config.seed); u.set(k, v); location.search = u.toString(); };
menu = new Menu({
  vehicles: VEHICLES,
  state: () => ({ location: config.location, vehicle, paint: S.paint, time: S.time, weather: S.weather, quality, shadows: shadowsOn, lights: S.lights, muted: S.muted, rumble: S.rumble || 'on', traffic: S.traffic, radioVol: radio.vol }),
  pickVehicle: async i => { await setVehicle(i); },
  paint: async (i, c) => { const def = VEHICLES[i]; S.paint[def.id] = c; save(); await applyPaint(def, await loadModel(def), c); },
  set: (k, v) => {
    if (k === 'time') { S.time = v; save(); env.setTime(v); } else if (k === 'weather') { S.weather = v; save(); env.setWeather(v); } else if (k === 'lights') { S.lights = v; save(); }
    else if (k === 'sfx') { S.muted = v === 'off'; save(); radio.setMuted(S.muted); if (sound.ctx) { sound.sfx = S.muted ? 0 : 0.6; sound.applyVolumes(); } }
    else if (k === 'rumble') { S.rumble = v; save(); }
    else if (k === 'traffic') { S.traffic = v; save(); if (traffic) traffic.setMode(v); if (peds) peds.setLevel(v); }
    else if (k === 'radioVol') radio.setVolume(v); else if (k === 'quality') reloadWith('q', v); else if (k === 'shadows') reloadWith('shadows', v);
  },
  locations: pickerLocations(), setLocation: id => setLocation(id), radio: () => wheel.toggle(), newWorld: () => regenerate(randomSeed()), toRoad: () => backToRoad(),
  onOpen: () => { document.body.dataset.menu = 'open'; controls.locked = true; sound.setEngineOn(false); },
  onClose: () => { delete document.body.dataset.menu; controls.locked = false; camera.fov = 58; if (offset) { camera.clearViewOffset(); offset = 0; lastShot = ''; } sound.setEngineOn(mode === 'drive'); unlockAudio(); if (view.camYaw !== null) view.camYaw = phys ? phys.yaw : null; }
});
controls.on('pause', () => menu.escape()); $('#pauseBtn').addEventListener('click', () => menu.show('pause'));
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || frozen()) return;
  if (e.code === 'KeyR') regenerate(randomSeed());
  if (e.code === 'KeyT') setMode(mode === 'ride' ? 'drive' : 'ride');
  if (e.code === 'KeyG') ground.wireframe = !ground.wireframe;
  if (e.code === 'KeyH') document.body.classList.toggle('bare');
  if (e.code === 'KeyL') cycleLights();
  if (e.code === 'KeyM') toggleMute();
});
function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); if (fx) fx.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const stats = statsPanel($('#stats'), renderer, () => {
  const s = grid.stats(), f = far.stats(), sc = scatter.stats();
  const sm = sectors.summary(), ac = assetCache.summary(), nv = nav ? nav.summary() : null;
  return ['sectors     active ' + sm.active + ' ready ' + sm.ready + ' loading ' + sm.loading + ' queued ' + sm.queued + ' failed ' + sm.failed + '   (loaded ' + sm.loaded + ' unloaded ' + sm.unloaded + ' aborted ' + sm.aborted + ')   assets held ' + ac.held + ' idle ' + ac.idle + ' ' + (ac.bytes / 1048576).toFixed(1) + ' MB', (nv ? 'navigation  ' + nv.chunks + ' chunks, ' + nv.nodes + ' nodes, ' + nv.drive + ' drive / ' + nv.walk + ' walk / ' + nv.cross + ' crossings / ' + nv.signals + ' signals, routes ' + nv.routes + ' (cached ' + nv.hits + ')' : ''), 'tiles       ' + s.tiles + '  (' + s.lod.join(' / ') + ' by detail)   far ' + f.tiles, 'build queue ' + (s.queue + f.queue + sc.queue) + '   pooled ' + (s.pooled + f.pooled) + '   built ' + (s.built + f.built),
    'scenery     ' + sc.things.toLocaleString('en-US') + ' in ' + sc.tiles + ' tiles   road pieces ' + roadMesh.pieces.size,
    'road        at ' + (roadS / 1000).toFixed(2) + ' km   built ' + (road.sMin / 1000).toFixed(1) + ' .. ' + (road.sMax / 1000).toFixed(1) + ' km',
    'origin      ' + grid.origin.x + ', ' + grid.origin.z + '   mode ' + mode,
    phys ? 'vehicle     u ' + phys.u.toFixed(1) + '  v ' + phys.v.toFixed(2) + '  r ' + phys.r.toFixed(2) + '  slip ' + phys.slip.toFixed(2) + '  ' + phys.surface : '', 'seed        ' + config.seed + '   quality ' + quality];
});
/* drive modes (vehicle/physics.js DRIVE_MODES): N or the button cycles Eco, Normal, Sport, Off-road; the choice is saved and applies to every vehicle */
function setDriveMode(id, quiet) { if (!DRIVE_MODES[id]) id = 'normal'; S.driveMode = id; if (phys && phys.setDriveMode) phys.setDriveMode(id); const m = DRIVE_MODES[id]; $('#modeBtn').textContent = m.name; const tag = $('#modeTag'); tag.textContent = m.name; tag.className = id; save(); if (!quiet) toast(m.name + ': ' + m.blurb); }
const cycleDriveMode = () => setDriveMode(DRIVE_MODE_IDS[(DRIVE_MODE_IDS.indexOf(S.driveMode || 'normal') + 1) % DRIVE_MODE_IDS.length]);
controls.on('drivemode', cycleDriveMode); $('#modeBtn').addEventListener('click', cycleDriveMode); setDriveMode(S.driveMode || 'normal', true);
const hud = { spd: $('#spd'), unit: $('#unit'), surf: $('#surface'), sky: $('#sky'), buff: $('#buff'), cd: $('#buffCd') }; let hudT = 0;

/* ---------- the camera slowly circling the vehicle behind the title screen and the garage ---------- */
let orbitA = 0.6, offset = 0, lastShot = '';
const orbiting = () => !!(menu && menu.open && menu.screen !== 'pause' && !(menu.screen === 'settings' && menu.from === 'pause'));
function orbitCam(dt) {
  const d = VEHICLES[vehicle].cam, ph = phys, o = grid.origin, R = d.back * 1.0 + 4; orbitA += dt * 0.28;
  const a = ph.yaw + orbitA, x = ph.x + Math.cos(a) * R, z = ph.z + Math.sin(a) * R, ground = Math.max(terrain.seaLevel, terrain.height(x, z)), y = Math.max(ph.y + 0.9 + d.up * 0.4, ground + 0.8);
  camera.position.set(x - o.x, y, z - o.z); camera.lookAt(ph.x - o.x, ph.y + 0.45 + d.up * 0.2, ph.z - o.z); camera.fov = 46;
  const side = ['garage', 'settings', 'locations'].includes(menu.screen), w = innerWidth, h = innerHeight, narrow = w <= 640, want = narrow ? 2 : side ? 1 : 0;       // park the vehicle left of a side panel, or above a bottom one on a phone
  const shot = want + ':' + w + 'x' + h; if (shot !== lastShot) { lastShot = shot; if (want === 1) camera.setViewOffset(w, h, w * 0.14, 0, w, h); else if (want === 2) camera.setViewOffset(w, h, 0, h * (side ? 0.27 : 0.2), w, h); else camera.clearViewOffset(); offset = want; }
  camera.updateProjectionMatrix();
}

/* ---------- one frame of the world: move, keep road and tiles built around the player, draw ----------
   The runtime (core/runtime.js) owns the clock: it clamps the frame time to 0.05 s (a hidden tab or a stall gives no time spike), runs the systems in a fixed order and offers a
   fixed step and an event bus to systems that need them. Today there are two systems: 'world' (the whole update, still being split up) and 'render'. */
const rp = {};
const bus = new EventBus(), runtime = new GameRuntime({ maxFrame: 0.05, bus });
function frame(now) { requestAnimationFrame(frame); runtime.frame(now); }
function step(dt, now) { update(dt, now); draw(now); }                                    // one whole frame (also used by the headless checks through __next.step)
function draw(now) { if (fx) fx.render(); else renderer.render(scene, camera); stats(now); }
/* world sectors (src/world/sectors.js): 512 m squares with their own load state, above the terrain tiles. A sector loads the shared assets its region needs (today the vehicle pack) and releases them when it goes. */
const focus = { x: 0, z: 0, dx: 1, dz: 0, speed: 0 };
const sectors = new SectorManager({ bus, meta: s => ({ region: config.location, assets: ['traffic:pack'] }),
  load: async (s, signal) => { for (const k of s.meta.assets) await assetCache.acquire(k); if (nav) nav.loadSector(s.sx, s.sz); return { held: s.meta.assets.slice() }; },
  unload: s => { if (nav) nav.unloadSector(s.sx, s.sz); if (s.data && s.data.held) for (const k of s.data.held) assetCache.release(k); } });
bus.on('world:rebuilt', () => sectors.reset());                                                    // a new world: every sector starts again
runtime.add({ name: 'world', order: 0, update: (dt, now) => update(dt, now) }); runtime.add({ name: 'sectors', order: 10, update: (dt, now) => sectors.update(focus.x, focus.z, focus, now) });
runtime.add({ name: 'render', order: 100, render: now => draw(now) }); runtime.start();
document.addEventListener('visibilitychange', () => { if (!document.hidden) runtime.resetClock(); });          // no time spike when the tab comes back
/* activities (N15, src/activities): start markers beside the road (G while stopped near one), a goal beacon, a timer line, results kept in the save */
const runner = new ActivityRunner(bus), actMarks = new THREE.Group(), actHud = document.createElement('div'); let actDefs = [], actGoal = null;
actHud.style.cssText = 'position:fixed;left:50%;top:92px;transform:translateX(-50%);z-index:20;display:none;background:rgba(8,12,20,.75);border-radius:999px;padding:6px 16px;font-size:14px;pointer-events:none'; document.body.appendChild(actHud); scene.add(actMarks);
const beacon = (color, x, z, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 60, 14, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })); m.userData.w = { x, z, y }; actMarks.add(m); return m; };
function setupActivities() {
  runner.cancel(); for (const d of actDefs) interactions.remove('activity:' + d.id); actDefs = []; actGoal = null; while (actMarks.children.length) { const m = actMarks.children.pop(); m.geometry.dispose(); m.material.dispose(); }
  if (!road) return; for (const d of activitiesFor(config.location)) {
    const a = road.at(d.startS, {}), b = road.at(d.startS + d.distance, {}), start = { x: a.x + a.tz * 2, z: a.z - a.tx * 2 }, goal = { x: b.x, z: b.z }; actDefs.push({ ...d, goal }); beacon(0x40e070, start.x, start.z, terrain.drive(start.x, start.z));
    interactions.add({ id: 'activity:' + d.id, x: start.x, z: start.z, r: 14, prompt: d.title + ': start (G)', enabled: () => runner.state !== 'running', onUse: () => { actGoal = beacon(0xffc040, goal.x, goal.z, terrain.drive(goal.x, goal.z)); runner.start(d, goal); toast(d.title + ': reach the gold beacon in ' + d.limit + ' s'); } });
  }
}
bus.on('world:rebuilt', setupActivities);
bus.on('mode:changed', e => { if (e.to !== 'drive' && runner.state === 'running') runner.cancel(); if (e.to !== 'foot') { lookDrag = null; if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock(); } });
bus.on('activity:finished', r => {
  if (actGoal) { actMarks.remove(actGoal); actGoal.geometry.dispose(); actGoal.material.dispose(); actGoal = null; } actHud.style.display = 'none'; if (r.outcome === 'cancelled') return;
  const rec = recordResult(S.progress, r); S.progress = rec.progress; save(); const t = actDefs.find(d => d.id === r.id);
  toast(r.outcome === 'done' ? (t ? t.title + ': ' : '') + r.time.toFixed(1) + ' s, ' + r.rating + (rec.isBest ? ', new best' : '') : 'Out of time');
});
function updateActivities(dt, px, pz) {
  runner.update(dt, px, pz); for (const m of actMarks.children) m.position.set(m.userData.w.x - grid.origin.x, m.userData.w.y + 30, m.userData.w.z - grid.origin.z);
  if (runner.state === 'running') { actHud.style.display = 'block'; actHud.textContent = runner.def.title + ': ' + Math.round(runner.dist) + ' m to go, ' + Math.max(0, runner.def.limit - runner.t).toFixed(0) + ' s left'; }
}
function update(dt, now) {
  WIND.t.value = now / 1000; let px, pz;
  if (mode === 'drive' && phys) {
    if (!frozen()) {
      input = controls.read();
      if (autodrive.enabled) {                                                                       // the car drives itself; steering or braking by hand takes over
        if (Math.abs(input.steer) > 0.25 || input.brake > 0.25 || input.hand > 0.25 || input.rev > 0.25) setAuto(false); else input = autodrive.update(phys, road);
      }
      if (auto) input = auto; phys.step(dt, input);
      if (buffT > 0) { buffT -= dt; if (buffT <= 0) phys.setMod(null); } buffCd = Math.max(0, buffCd - dt);
      if (phys.stuck > 1.5) backToRoad();
    }
    px = phys.x; pz = phys.z; roadS = road.closestS(px, pz, roadS);
  } else if (mode === 'foot' && phys && foot) {
    if (!frozen()) { const i = controls.read(); foot.step(dt, { steer: i.steer, throttle: i.throttle, rev: i.rev, run: i.run, jump: i.brake > 0.5 }); }
    phys.step(dt, { steer: 0, throttle: 0, brake: 1, hand: 1, rev: 0 }); px = foot.x; pz = foot.z; roadS = road.closestS(px, pz, roadS);
    const back = Math.cos(footPitch) * 4.2, gy = Math.max(terrain.seaLevel, terrain.height(foot.x - Math.cos(foot.yaw) * back, foot.z - Math.sin(foot.yaw) * back));          // mouse look: the camera swings up and down around the character
    cam.x = foot.x - Math.cos(foot.yaw) * back; cam.z = foot.z - Math.sin(foot.yaw) * back; cam.y = Math.max(Math.max(terrain.seaLevel, foot.y) + 1.5 + Math.sin(footPitch) * 4.2, gy + 0.4); cam.yaw = -Math.PI / 2 - foot.yaw; cam.pitch = -footPitch * 0.85;
  } else if (mode === 'ride') {
    roadS += Math.min(cam.speed, 90) * dt; road.at(roadS, rp);
    cam.x = rp.x + rp.tz * 2; cam.z = rp.z - rp.tx * 2; cam.y = rp.y + 1.6;
    const want = Math.atan2(-rp.tx, -rp.tz); rideYaw += Math.atan2(Math.sin(want - rideYaw), Math.cos(want - rideYaw)) * Math.min(1, dt * 4);
    cam.yaw = rideYaw; cam.pitch += (Math.atan(rp.slope) * 0.8 - 0.04 - cam.pitch) * Math.min(1, dt * 3); px = cam.x; pz = cam.z;
  } else {
    cam.update(dt, (x, z) => Math.max(terrain.seaLevel, terrain.height(x, z)) + 1.7); px = cam.x; pz = cam.z; roadS = road.closestS(px, pz, roadS);
  }
  if (navDebug && nav) navDebug.update(nav, grid.origin);
  focus.x = px; focus.z = pz; if (mode === 'drive' && phys) { focus.dx = Math.cos(phys.yaw); focus.dz = Math.sin(phys.yaw); focus.speed = Math.abs(phys.u); } else focus.speed = 0;
  const box = road.ensure(roadS - 2600, roadS + 2600); if (box) grid.invalidate(box);        // the road keeps growing ahead of you, in both directions
  if (grid.rebase(px, pz)) { far.reposition(); roadMesh.reposition(); scatter.reposition(); }
  grid.update(px, pz); far.update(px, pz); roadMesh.update(roadS); scatter.update(px, pz); if (holes) holes.set(roadMesh.tunnels.portals(), grid.origin, px, pz, roadMesh.tunnels.W);
  if (traffic) traffic.update(dt, { x: px, z: pz, s: roadS, u: phys ? phys.u : 0, yaw: phys ? phys.yaw : 0 }, env.lightsOn);
  if (peds && traffic) peds.update(dt, { x: px, z: pz, u: mode === 'foot' ? 0 : phys ? phys.u : 0 }, traffic.sim.time);
  if (figure && figure.visible && foot) { figure.position.set(foot.x - grid.origin.x, foot.y, foot.z - grid.origin.z); figure.rotation.y = -foot.yaw + Math.PI / 2; const sw = Math.sin(foot.phase) * (foot.moving ? 0.5 : 0); figure.userData.legs[0].rotation.x = sw; figure.userData.legs[1].rotation.x = -sw; }
  updateActivities(dt, px, pz); updatePrompt();
  if (phys) { view.update(phys, grid.origin); const drive = mode === 'drive';
    view.lights(S.lights === 'on' || (S.lights === 'auto' && env.lightsOn), drive && phys.u > 1 && ((input.brake || 0) > 0.1 || (input.rev || 0) > 0.1 || (input.hand || 0) > 0.1), drive && phys.u < -0.3, dt); }
  boostEase += ((buffT > 0 ? 1 : 0) - boostEase) * Math.min(1, dt * 4);
  if (mode === 'drive' && phys && orbiting()) orbitCam(dt);
  else if (mode === 'drive' && phys) { if (offset) { camera.clearViewOffset(); offset = 0; } view.aim(camera, phys, grid.origin, dt, (x, z) => Math.max(terrain.seaLevel, terrain.drive(x, z)), boostEase); }
  else { cam.apply(camera, grid.origin); camera.fov = 58; camera.updateProjectionMatrix(); }
  water.position.x = camera.position.x; water.position.z = camera.position.z;
  waterT.value = now / 1000; if (groundMat) groundMat.uniforms.uTime.value = now / 1000; ripples.offset.set(((camera.position.x + grid.origin.x) * RIP) % 1, (-(camera.position.z + grid.origin.z) * RIP) % 1);     // ripples stay fixed to the world while the sheet follows the camera
  env.update(dt, now, camera, reach);
  if (skyLight) { scene.environment = skyLight; scene.environmentIntensity = 0.4 * Math.min(1, Math.max(0.06, 0.12 + env.sunDir.y * 1.1)); }
  { const cx = camera.position.x + grid.origin.x, cz = camera.position.z + grid.origin.z;                                              // inside a tunnel (the road says so): no rain, snow or thunder, and a roomier sound
    const now1 = road && road.nearest(cx, cz) && road.hit.d < road.style.shoulder + 2 && road.tunnelW(road.hit.s) > 0.5 ? 1 : 0; tunnelAmt += (now1 - tunnelAmt) * Math.min(1, dt * 5);
    if (tunnelAmt > 0.5) { env.rain.visible = false; env.snowfall.visible = false; } }        // inside a mountain (a tunnel): no rain or snow indoors
  applyLook(canvas, quality !== 'low', env.w.dark); landmarks.update(grid.origin, env.lightsOn); if (roadMesh.district) roadMesh.district.setNight(env.lightsOn); backdrop.update(camera, camera.position.x + grid.origin.x, camera.position.z + grid.origin.z, env);
  if (mode === 'drive' && phys && S.rumble !== 'off' && !frozen()) { const r = rumbleFor({ ...(phys.telemetry ? phys.telemetry() : { speed: Math.abs(phys.u), surface: phys.surface, slip: phys.slip }), impact: phys.impact }, 1); if (r) controls.rumble(r.strong, r.weak, r.ms); }
  if (mode === 'drive' && phys && sound.ctx) { const tel = phys.telemetry ? phys.telemetry() : { rpm01: null, gear: null }; sound.update({ tunnel: tunnelAmt, v: Math.abs(phys.u), rev: phys.u < -0.3, top: phys.p.top, throttle: input.throttle || 0.06, rain: env.w.rain, flash: env.flash, buff: buffT > 0,
    id: VEHICLES[vehicle].id, rpm01: tel.rpm01 === null ? undefined : tel.rpm01, gear: tel.gear === null ? undefined : tel.gear, brake: phys.u > 1 && ((input.brake || 0) > 0.1 || (input.rev || 0) > 0.1 || (input.hand || 0) > 0.1), hand: input.hand || 0, slip: phys.slip, off: phys.surface !== 'asphalt', view: view.view }); }
  if (phys && now - hudT > 100) { hudT = now; hud.spd.textContent = Math.round(Math.abs(phys.kmh)); hud.unit.textContent = phys.u < -0.5 ? 'R · km/h' : 'km/h'; hud.surf.textContent = phys.wet > 0.3 ? 'Water' : SURFACES[phys.surface].name; hud.sky.textContent = env.label; { const tag = $('#modeTag'), lim = phys.M && phys.M.cap > 0 && Math.abs(phys.u) > phys.M.cap * 0.97; if (tag.classList.contains('limit') !== lim) tag.classList.toggle('limit', lim); }
    hud.buff.classList.toggle('active', buffT > 0); hud.buff.classList.toggle('cooling', buffT <= 0 && buffCd > 0); hud.cd.textContent = buffT > 0 ? '' : buffCd > 0 ? Math.ceil(buffCd) + 's' : ''; }
}
setVehicle(vehicle).then(() => { setupActivities(); setMode('drive'); if (!q.has('play')) menu.show('title'); requestAnimationFrame(frame); loadDone(); if (+q.get('bench')) setTimeout(() => startBench(+q.get('bench')), 4000); }).catch(e => { console.error(e); toast('Could not load the vehicle'); setMode('fly'); requestAnimationFrame(frame); loadDone(); });
/* ?bench=30: drive on autodrive for 30 s and report what a frame costs on this device (also logged as BENCH in the console and kept in window.__bench) */
function startBench(secs) {
  setAuto(true); const ts = []; let prev = performance.now(); const t0 = prev;
  const loop = now => { ts.push(now - prev); prev = now; if (now - t0 < secs * 1000) requestAnimationFrame(loop); else done(); };
  requestAnimationFrame(loop);
  function done() {
    ts.shift(); const s = [...ts].sort((a, b) => a - b), avg = ts.reduce((a, b) => a + b, 0) / ts.length, pc = f => s[Math.min(s.length - 1, Math.floor(s.length * f))], info = renderer.info.render, bytes = performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0);
    const out = { device: navigator.userAgent, quality, location: config.location, vehicle: VEHICLES[vehicle].id, seconds: secs, frames: ts.length, avgFps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(1), p95Ms: +pc(0.95).toFixed(1), p99Ms: +pc(0.99).toFixed(1), worstMs: +s[s.length - 1].toFixed(1),
      drawCalls: info.calls, triangles: info.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, downloadMB: +(bytes / 1048576).toFixed(1), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null };
    window.__bench = out; console.log('BENCH ' + JSON.stringify(out)); const pre = document.createElement('pre'); pre.style.cssText = 'position:fixed;left:8px;top:8px;z-index:60;margin:0;padding:10px;background:#000c;color:#9f9;font:12px monospace;max-width:92vw;white-space:pre-wrap;border-radius:6px';
    pre.textContent = 'BENCH ' + secs + ' s   ' + quality + ' tier   ' + out.location + '   ' + out.vehicle + '\n' + out.avgFps + ' fps average (' + out.avgMs + ' ms)   95% under ' + out.p95Ms + ' ms   99% under ' + out.p99Ms + ' ms   worst ' + out.worstMs + ' ms\n' + out.drawCalls + ' draw calls   ' + out.triangles.toLocaleString('en-US') + ' triangles   ' + out.geometries + ' geometries   ' + out.textures + ' textures\n' + out.downloadMB + ' MB downloaded' + (out.heapMB ? '   JS heap ' + out.heapMB + ' MB' : '') + '\n' + out.device;
    document.body.appendChild(pre); setAuto(false);
  }
}

/* the tuner dashboard (tuner.html) embeds this page and talks to it by postMessage: settings in, a few commands, the list of settings out */
addEventListener('message', async e => {
  const d = e.data; if (e.origin !== location.origin || !d || typeof d !== 'object') return;
  if (d.type === 'hello') parent.postMessage({ type: 'schema', fields: describe(), overrides, locations: LOCATIONS.map(l => ({ id: l.id, name: l.name })), vehicles: VEHICLES.map(v => ({ id: v.id, name: v.name })), state: { location: config.location, vehicle: VEHICLES[vehicle].id } }, location.origin);
  else if (d.type === 'tune') {
    const changed = setOverrides(d.overrides || {});
    if (changed.some(p => p.startsWith('look.'))) applyLook(canvas, quality !== 'low');
    if (changed.some(p => p.startsWith('world.'))) regenerate(config.seed, config.location); else if (changed.some(p => p.startsWith('vehicles.'))) await setVehicle(vehicle);
  } else if (d.type === 'cmd') {
    if (d.name === 'location') setLocation(d.arg); else if (d.name === 'vehicle') setVehicle(Math.max(0, VEHICLES.findIndex(v => v.id === d.arg))); else if (d.name === 'weather') env.setWeather(d.arg);
    else if (d.name === 'time') env.setTime(d.arg); else if (d.name === 'newWorld') regenerate(randomSeed()); else if (d.name === 'toRoad') backToRoad();
  }
});
if (parent !== window) parent.postMessage({ type: 'ready' }, location.origin);

window.__next = { bus, runtime, get peds() { return peds; }, sectors, assetCache, get nav() { return nav; }, fx, get config() { return config; }, get terrain() { return terrain; }, get road() { return road; }, get roadMesh() { return roadMesh; }, get scatter() { return scatter; },
  radio, wheel, get roadS() { return roadS; }, set roadS(v) { roadS = v; }, get mode() { return mode; }, get phys() { return phys; }, get auto() { return auto; }, set auto(v) { auto = v; },
  menu, get landmarks() { return landmarks; }, get traffic() { return traffic; }, setMode, setVehicle, backToRoad, placeOnRoad, useBuff, get buffT() { return buffT; }, get buffCd() { return buffCd; }, view, env, sound, settings: S, grid, far, cam, camera, controls, renderer, scene, regenerate, encodeConfig, step };

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
import { roadProvider } from './world/keepout.js';
import { WIND } from './world/props.js';
import { grassTex, waterNormalTex } from './world/textures.js';
import { makeGroundMaterial } from './world/groundmat.js';
import { installTunnelHoles } from './world/tunnel_holes.js';
import { GameRuntime, EventBus, Registry } from './core/runtime.js';
import { OnFoot, chooseExit, Interactions } from './player/onfoot.js';
import { AssetCache } from './core/assets.js';
import { SectorManager } from './world/sectors.js';
import { regionAt } from './world/regionmap.js';
import { REGIONS } from './world/regions.js';
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
import { destinationsFor, HINDI, CITY, fromGame, nearestCity } from './world/india_network.js';
import { RoadNetwork, guidePoint } from './world/network.js';
import { addOverpasses } from './world/interchange.js';
import { RoadSet } from './world/roadset.js';
import { Junction } from './traffic/junction.js';
import { JunctionSignals } from './world/junction_signals.js';
import { DRIVE_MODES, DRIVE_MODE_IDS } from './vehicle/physics.js';
import { validTolls, TOLL_LEN } from './world/highway_plan.js';
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
import { Gps } from './ui/gps.js';
import { CityNav, CityMap } from './ui/citymap.js';
import { mapGates, pickGate } from './world/city/gates.js';
import { installCutHoles } from './world/city/cuts.js';
import { RailLine, RailNetwork, classifyCrossings } from './world/rail.js';
import { RailGrade } from './world/rail_grade.js';
import { TrainBook, clockMinutes, fmtTime, announcement } from './world/rail_timetable.js';
import { StationBoard, Announcer } from './ui/railboard.js';
import { TrainSound } from './audio/trainsound.js';
import { RailSamples } from './audio/railsamples.js';
import { AnnounceClips } from './audio/announceclips.js';
import { STATE_LANG } from './world/rail_timetable.js';
import { RailView } from './world/rail_view.js';
import { LOCATIONS, locationConfig, locationById, LEGACY, START_LOCATION, pickerLocations } from './world/locations.js';
import { Landmarks } from './world/landmarks.js';
import { CityWorld, cityConfig } from './world/city/cityworld.js';
import { FlyCam } from './debug/flycam.js';
import { statsPanel } from './debug/stats.js';
import { createFx, loadSkyLight } from './fx/pipeline.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], q = new URLSearchParams(location.search);
const phone = matchMedia('(pointer: coarse)').matches || innerWidth < 500;
const quality = VIEW_PRESETS[q.get('q')] ? q.get('q') : phone ? 'low' : 'med';
let savedLoc = null, savedCity = null, savedEnclave = null; try { const o = JSON.parse(localStorage.getItem('gfp-next') || '{}'); savedLoc = o.location || null; savedCity = typeof o.city === 'string' ? o.city : null; savedEnclave = typeof o.enclave === 'string' ? o.enclave : null; } catch (e) { /* no saved choice */ }
/* a real highway to drive (docs/INDIA_MAP_PLAN.md section 9): ?india=<road id>&from=<city>&toward=<city>. The road follows the path of that highway at 1:100 through procedural land; the signs name the next cities. Roads and cities: assets/india/skeleton.json */
/* One continuous India world is the game (docs/INDIA_MAP_PLAN.md): ?india=world&at=<city> (the default when no region is asked for). A region or city world to explore is ?loc=<id> (the "Explore cities" section). ?india=route and ?india=<road id> are single-road drives for testing. */
const cityMode = q.get('city') === 'delhi';       // the save remembers that you were last inside Delhi: a plain ?play starts there                                                                           // ?city=delhi: the 1:1 city enclave drawn from the city pack (src/world/city, docs/CITY_PACK.md); &at=<spawn, landmark or gate id>
if (q.get('loc') === 'delhi' && !cityMode) { location.replace('?play&city=delhi&seed=' + encodeURIComponent(q.get('seed') || 'peace') + '&q=' + (q.get('q') || 'med')); await new Promise(() => {}); }       // the old stylised Delhi location is gone: Delhi is the city pack
/* the gate fade (12.7): a black cover that fades in (0.5 s) before a page reload through a gate and out again on arrival, with the car's speed carried across in sessionStorage */
const gateFade = (() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;background:#000;z-index:200;pointer-events:none;opacity:0;transition:opacity .5s ease'; document.body.appendChild(d); let carry = null; try { carry = JSON.parse(sessionStorage.getItem('gfp-gate') || 'null'); sessionStorage.removeItem('gfp-gate'); } catch (e) { /* no storage */ }
  if (carry && Date.now() - carry.t < 30000) { d.style.transition = 'none'; d.style.opacity = '1'; } else carry = null; return { d, carry, frames: 0 }; })();
function gateJump(search, speed) { try { sessionStorage.setItem('gfp-gate', JSON.stringify({ u: Math.max(0, speed || 0), t: Date.now() })); } catch (e) { /* no storage */ } gateFade.d.style.transition = 'opacity .5s ease'; gateFade.d.style.opacity = '1'; setTimeout(() => { location.search = search; }, 520); }
const wantWorld = !cityMode && (q.get('india') === 'world' || (!q.get('india') && !q.get('loc') && !q.get('c')));
let entering = false, CITY_GATES = null;       // declared up here: the GPS code that uses them runs while the world is built, before the city code further down
/* the way into the full Delhi city from the India map: a button, shown within 80 km of Delhi on its highway (a highway gate also takes you in when you drive into the city) */
const enterBtn = (() => { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Enter Delhi city'; b.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:40;padding:10px 20px;border-radius:10px;border:1px solid #8ab4ff;background:#1d4ed8;color:#fff;font:600 15px system-ui,sans-serif;display:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)'; document.body.appendChild(b); return b; })();
let indiaRoute = null, startAlong = 0;
/* Delhi is the real city (src/world/city): the India map gives it no stylised street edge and no stylised people; its highway leads into the city */
const delhiRegion = () => !!indiaRoute && config.location === 'delhi';       // startAlong: the India map starts at Delhi 260 m (26 km) out on its highway, past the zone that takes you into the city (120 m), and not in the stylised district at the city's own centre
if (q.get('india') || wantWorld) {
  try {
    const sk = await (await fetch('assets/india/skeleton.json')).json(), net = new RoadNetwork(sk); try { net.rails = await (await fetch('assets/india/rails.json')).json(); } catch (e) { net.rails = null; } try { net.trainsJson = await (await fetch('assets/india/trains.json')).json(); } catch (e) { net.trainsJson = null; }
    if (wantWorld) {                                                                                                      // the free world: start in a city on the best highway through it, with a way ahead and a way behind
      const at = q.get('at') || savedCity || 'mumbai'; if (at === 'delhi' && !q.get('via') && !q.has('fromcity')) { location.replace('?play&city=delhi&seed=' + encodeURIComponent(q.get('seed') || 'peace') + '&q=' + quality); await new Promise(() => {}); }       // a start in Delhi is the real city, not a stylised one
      const delhiOut = at === 'delhi' && !q.get('via'); if (at === 'delhi') startAlong = 260; const ws = net.worldStart(at, { road: q.get('via') || (delhiOut ? 'nh-delhi-lucknow' : null), toward: q.get('toward') || (delhiOut ? 'kanpur' : null) }) || net.worldStart('mumbai'); if (ws) { const from = ws.gA.from; indiaRoute = { ...ws.gA, net, world: true, roadId: ws.road, name: ws.name, kind: ws.kind, nh: ws.nh, ptsBack: ws.gB ? ws.gB.pts : null, citiesBack: ws.gB ? ws.gB.cities.map(c => ({ ...c, along: -c.along })) : [], legs: [], from }; }
    } else if (q.get('india') === 'route') {                                                                                     // ?india=route&from=<city>&to=<city>: the shortest way over several roads, as one drive
      const g = net.routeGuide(q.get('from') || 'delhi', q.get('to') || 'mumbai'); if (g) { const kinds = g.legs.map(l => net.roads.get(l.road).kind); indiaRoute = { ...g, net, roadId: null, name: net.cities.get(g.from).name + ' to ' + net.cities.get(g.to).name, kind: kinds.some(k => k !== 'nh') ? 'gq' : 'nh' }; }
    } else {
      const r = net.roads.get(q.get('india')); if (r) { const from = q.get('from') || r.stops[0].id, toward = q.get('toward') || r.stops[r.stops.length - 1].id, g = net.guideFor(r.id, from, toward); if (g) indiaRoute = { ...g, net, roadId: r.id, name: r.name, kind: r.kind, nh: r.nh }; }
    }
  } catch (e) { console.warn('india route not loaded', e); }
}
const nearestRegionId = id => { const c = CITY[id]; let best = START_LOCATION, bd = Infinity; for (const l of LOCATIONS) { const ins = l.region && l.region.inspiration; if (!ins || !c) continue; const d = Math.hypot(ins.lat - c.lat, (ins.lon - c.lon) * 0.9); if (d < bd) { bd = d; best = l.id; } } return best; };
let config = (q.get('c') && decodeConfig(q.get('c'))) || locationConfig(q.get('loc') || (indiaRoute && nearestRegionId(indiaRoute.from)) || (savedLoc && (LEGACY[savedLoc] || savedLoc)) || START_LOCATION, q.get('seed') || 'peace');          // India only: an old saved choice moves to its Indian replacement
if (cityMode) config = cityConfig(locationConfig('delhi', q.get('seed') || 'peace'), q.get('seed') || 'peace');
if (indiaRoute) config.road = { ...config.road, guide: indiaRoute.pts, guideBack: indiaRoute.ptsBack || null, style: indiaRoute.kind === 'nh' ? 'highway' : 'nh6' };
/* real elevation and land cover under the India roads (assets/india/terrain.bin, tools/build_india_grids.py); ?real=off keeps the procedural land. The terrain's origin is the start city. */
if (indiaRoute && q.get('real') !== 'off') {
  try {
    const meta = await (await fetch('assets/india/terrain.json')).json(), buf = await (await fetch('assets/india/terrain.bin')).arrayBuffer(), N = meta.nx * meta.nz, V = 0.035, n0 = indiaRoute.net.cities.get(indiaRoute.from);
    const macro = { cell: meta.cell, x0: meta.x0, z0: meta.z0, nx: meta.nx, nz: meta.nz, vscale: V, ox: n0.x, oz: n0.z, h: new Int16Array(buf, 0, N), rel: new Uint8Array(buf, N * 2, N), tree: new Uint8Array(buf, N * 3, N), crop: new Uint8Array(buf, N * 4, N), grass: new Uint8Array(buf, N * 5, N), bare: new Uint8Array(buf, N * 6, N), built: new Uint8Array(buf, N * 7, N) };
    { const R = { cell: 500, x0: meta.x0, z0: meta.z0, nx: Math.ceil(meta.nx * meta.cell / 500), nz: Math.ceil(meta.nz * meta.cell / 500) }, M = R.nx * R.nz; R.a = new Uint8Array(M); R.b = new Uint8Array(M); R.w = new Uint8Array(M);       // which region each 50 km square belongs to, and the blend toward the next one
      for (let j = 0; j < R.nz; j++) for (let i = 0; i < R.nx; i++) { const ll = fromGame(R.x0 + (i + 0.5) * R.cell, R.z0 + (j + 0.5) * R.cell), r = regionAt(ll.lat, ll.lon, REGIONS), k = j * R.nx + i; R.a[k] = REGIONS.findIndex(x => x.id === r.id); R.b[k] = r.second ? REGIONS.findIndex(x => x.id === r.second) : R.a[k]; R.w[k] = Math.round(r.blend * 255); }
      macro.region = R; macro.palettes = REGIONS.map(r => r.land.palette); macro.tints = REGIONS.map(r => r.vegetation.tint || [1, 1, 1]); }
    config.terrain = { ...config.terrain, seaLevel: 0, seabed: -40 }; Object.defineProperty(config.terrain, 'macro', { value: macro, enumerable: false, writable: true });      // not part of the saved/shared config (it is big)
    config.palette = { ...config.palette, treeline: 3700 * V, snowline: 5000 * V }; config.road = { ...config.road, maxAlt: 3500 * V, maxGrade: 0.09, hardGrade: 0.12, minRadius: Math.min(config.road.minRadius || 130, 70) };      // tighter bends are allowed, so a ghat road can wind up a real escarpment
  } catch (e) { console.warn('real elevation not loaded, using the procedural land', e); }
}           // main highways get the six-lane national highway look
/* tuner settings (core/tuning.js): the published settings.json first, then live changes sent by tuner.html */
registerRoot('vehicles', VEHICLES); registerRoot('times', TIMES); registerRoot('weather', WX); registerRoot('surfaces', SURFACES); registerRoot('handling', ARCADE); registerRoot('camera', CAMFX); registerRoot('look', LOOK);
for (const url of ['api/settings', 'settings.json']) {             // the published settings (tuner Publish), else a settings.json committed with the site
  try { const r = await fetch(url); if (r.ok) { const j = await r.json(); if (j && j.overrides) { setOverrides(j.overrides); break; } } } catch (e) { /* not there: carry on */ }
}
registerRoot('world', () => config); applyWorld(config);
if (q.get('road')) config.road.style = roadStyleById(q.get('road')).id;                  // ?road=highway|boulevard|dirt|gravel
config.view = { ...config.view, ...VIEW_PRESETS[quality] };
if (cityMode) config.view = { ...config.view, rings: [{ r: 1, res: 8 }, { r: 2, res: 4 }, { r: 4, res: 4 }], far: { ...config.view.far, r: Math.min(config.view.far.r, 6), res: 4 } };      // a city stands on flat land and draws its own ground over the engine's: the terrain under it needs few vertices (it was 284k triangles of hidden ground)
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
if (cityMode) S.enclave = 'delhi'; else if (S.enclave) { delete S.enclave; save(); }                          // the save remembers that you were last inside a city (saved.js `enclave`)
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
/* Travel (menu): the nearest city to where you are (in an India drive, to the player; in a region world, to the place it is an impression of) and a new drive from there to another city over the highway network */
/* where the player is, for the menu's bottom line (and for reports): real latitude and longitude, the game's own x and z, heading, the place, the area, the street and the nearest landmark. In a city the lat and lon come from the pack's origin (the inverse of identity.js projectLL), in the India world from the game frame. */
function where() {
  if (!phys) return null; const K = Math.PI / 180, RE = 6371008.8, hdg = Math.round((Math.atan2(Math.cos(phys.yaw), -Math.sin(phys.yaw)) / K + 360) % 360), o = { x: +phys.x.toFixed(1), z: +phys.z.toFixed(1), hdg }; let place = 'game', extra = [];
  try {
    if (city) { const O = city.pack.M.origin; o.lat = O.lat - phys.z / (RE * K); o.lon = O.lon + phys.x / (RE * Math.cos(O.lat * K) * K); place = 'Delhi city';
      const st = city.nearestStreet(phys.x, phys.z); if (st && st.d < 40) { const G = city.pack.G, nm = G.names && G.name ? G.names[G.name[st.id]] : null, nn = nm && (typeof nm === 'string' ? nm : (nm.en || nm.ref || nm.hi || '')); extra.push('street: ' + (nn || ('#' + st.id)) + ' (' + G.classes[G.cls[st.id]] + ')'); }
      if (city.identity) extra.push('area: ' + city.identity.areaNameAt(phys.x, phys.z)); let bl = null, bd = 300; for (const l of city.pack.landmarks) { const d = Math.hypot(l.x - phys.x, l.z - phys.z); if (d < bd) { bd = d; bl = l; } } if (bl) extra.push('near: ' + (bl.name.en || bl.id) + ' ' + Math.round(bd) + ' m');
    } else if (indiaRoute) { const gf = gameFrame(phys.x, phys.z), ll = fromGame(gf.x, gf.z); o.lat = ll.lat; o.lon = ll.lon; const c = nearestCity(ll.lat, ll.lon); place = 'India map' + (c ? ', near ' + c.city.name : ''); extra.push('road: ' + indiaRoute.name); }
    else place = 'place ' + (config.location || 'default');
  } catch (e) { /* position only */ }
  o.text = (o.lat !== undefined ? o.lat.toFixed(5) + ' N, ' + o.lon.toFixed(5) + ' E  |  ' : '') + 'x ' + o.x + '  z ' + o.z + '  |  heading ' + hdg + '  |  ' + place + (extra.length ? '  |  ' + extra.join('  |  ') : ''); return o;
}
window.__where = where;
function currentCityId() { try { if (indiaRoute && phys) { const gf = gameFrame(phys.x, phys.z), ll = fromGame(gf.x, gf.z), c = nearestCity(ll.lat, ll.lon); if (c) return c.city.id; } const ins = (locationById(config.location).region || {}).inspiration; if (ins) { const c = nearestCity(ins.lat, ins.lon); if (c) return c.city.id; } } catch (e) { /* fall through */ } return 'delhi'; }
let roadSet = null; const branches = [];                                                                          // roads that cross or branch off the player's road at junctions (world/roadset.js)
const gateSub = (net, cityId, roadId) => { try { return net.junctionChoices(cityId).filter(c => c.road !== roadId).slice(0, 2).map(c => (c.nh || c.name) + ' \u2192 ' + c.towardName).join('   '); } catch (e) { return ''; } };       // the roads that cross at a city, for the board over the road before it
let railNet = null, railGrade = null, railBook = null, railTracks = null, railCross = null;
function makeWorld() { for (const b of branches) b.mesh.dispose(); branches.length = 0; terrain = createTerrain(config); if (indiaRoute && config.terrain.macro) config.road = { ...config.road, start: { x: 0, z: 0, y: terrain.base(0, 0) } }; road = new Road(terrain, config); road.ensure(-2600, 2600); roadSet = new RoadSet(road); terrain.attachRoad(roadSet); roadProvider(terrain.keepout, roadSet); roadS = 0;
  railNet = null; railGrade = null; if (indiaRoute && indiaRoute.world && indiaRoute.net.rails && config.road.guide && q.get('rail') !== 'off') {            // the railway's own ground: cuttings and embankments
    const net = indiaRoute.net, n0 = net.cities.get(indiaRoute.from), g0 = config.road.guide; railNet = new RailNetwork(net.rails); railBook = net.trainsJson ? new TrainBook(net.trainsJson, railNet) : null; railTracks = railNet.edges.map(e => railBook ? railBook.tracks(e.edgeId) : 1); railCross = classifyCrossings(railNet.edges, [...net.roads.values()].map(r => ({ id: r.id, pts: r.pts, kind: r.kind })), [...net.cities.values()], railNet.stations); railGrade = new RailGrade({ crossings: railCross, tracks: railTracks, edges: railNet.edges, toWorld: (gx, gz) => ({ x: gx - n0.x + g0[0], z: gz - n0.z + g0[1] }), natural: (x, z) => terrain.base(x, z) }); terrain.attachRail(railGrade); } }
makeWorld();
const grid = new TileGrid(scene, terrain, config.view, ground), far = new TileGrid(scene, terrain.far, farView(), ground); far.origin = grid.origin;
let arriveT = 0, adStuck = 0, city = null, cityStart = null, cityNav = null, cityMap = null; if (cityMode) { city = new CityWorld(scene, grid.origin, terrain); await city.init(); city.transit.onTeleport = (x, z, yaw) => { if (mode === 'foot' && foot) foot.place(x, z, yaw); else if (phys) { phys.reset(x, z, yaw, city.gy); view.camYaw = null; } }; city.traffic.setMode(S.traffic); city.peds.setMode(S.traffic); cityStart = city.pack.start(q.get('at') || q.get('gate')); }
function updateCityMap(now, dt) {                                                                       // the city's GPS (src/ui/citymap.js): hidden India map, city map in its place
  if (!cityMap) { cityNav = new CityNav(city.pack, { geom: e => city.edgeGeom(e), toast }); city.onStreets = () => cityNav.refine(); cityMap = new CityMap({ nav: cityNav, player: () => { const o = phys && mode !== 'fly' && mode !== 'foot' ? phys : mode === 'foot' && foot ? foot : cam; return { x: o.x, z: o.z, yaw: o.yaw || 0 }; }, size: touchUI ? 150 : 184 }); if (city.transit.data) cityMap.setTransit(city.transit.data); /* the transit data the Metro already loaded (transit.js), no second fetch */ window.__cityNav = cityNav; }
  cityMap.setVisible(mode === 'drive' || mode === 'foot'); cityMap.update(now, dt);
}
function makeScenery() {
  if (roadMesh) roadMesh.dispose(); if (scatter) scatter.dispose(); if (backdrop) { scene.remove(backdrop.group); backdrop.group.children.forEach(m => { m.geometry.dispose(); m.material.dispose(); }); }
  backdrop = new Backdrop(scene, terrain, config);
  if (landmarks) landmarks.dispose(); landmarks = new Landmarks(scene, terrain, road, config, grid.origin, locationById(config.location).landmarks);       // sights beside the road; they also level the land under them
  roadMesh = new RoadMesh(scene, road, road.style, grid.origin, { tag: indiaRoute ? (indiaRoute.nh || '') : '', gates: indiaRoute ? indiaRoute.cities.filter(c => c.along > 0).map(c => ({ en: c.name, hi: HINDI[c.id] || '', alongM: c.along, sub: gateSub(indiaRoute.net, c.id, indiaRoute.roadId) })) : [], dests: indiaRoute ? indiaRoute.cities.filter(c => c.along > 0).map(c => ({ en: c.name, hi: HINDI[c.id] || '', km: 0, alongM: c.along })) : (() => { const ins = (locationById(config.location).region || {}).inspiration; return ins ? destinationsFor(ins.lat, ins.lon) : []; })(), district: delhiRegion() ? undefined : (locationById(config.location).region || {}).district, seed: config.seed + ':' + config.location, blocked: (x, z) => terrain.inZone(x, z, 8) }); scatter = new Scatter(scene, terrain, config, grid.origin); if (nature) scatter.setProps(nature);
  if (nav) nav.unloadAll(); nav = new RoadNav(road, { drive: locationById(config.location).drive || 'right' }); if (q.has('nav') && !CITY[q.get('nav')] && !navDebug) navDebug = new NavDebug(scene);
  if (peds) { peds.dispose(); peds = null; }
  if (traffic) traffic.dispose(); traffic = new Traffic(scene, road, config.seed, grid.origin, { mode: cityMode ? 'off' : S.traffic, drive: locationById(config.location).drive || 'right', scale: (locationById(config.location).region || { traffic: { scale: 1 } }).traffic.scale, mix: (locationById(config.location).region || { traffic: {} }).traffic.mix || null, pack: trafficPack });          // cars on the road (src/traffic), on the right or the left as the place drives
  { const reg = locationById(config.location).region; if (reg && reg.district && !delhiRegion() && reg.population && reg.population.density > 0) peds = new Pedestrians(scene, nav, config.seed + ':' + config.location, grid.origin, { density: reg.population.density, archetypes: reg.population.archetypes, level: S.traffic, traffic: traffic.sim }); }          // people on the sidewalks of a built-up region (src/pedestrians); their number follows the traffic setting
  env.attach({ ground, road: roadMesh.surface }); if (groundMat) { groundMat.install(); groundMat.setSea(terrain.seaLevel); groundMat.uniforms.uArid.value = (config.palette && config.palette.arid) || 0; } if (!holes) holes = installTunnelHoles(ground, WALL, ARCH); if (city && !ground.userData.cutHoles) { ground.userData.cutHoles = true; installCutHoles([ground], city.cuts); } waterMat.color.set(config.water.color);
}
makeScenery();
function applyView() {
  reach = (far.outer + 0.5) * far.size;
  water.scale.set(reach * 4, 1, reach * 4); water.position.y = terrain.seaLevel; ripples.repeat.set(reach * 4 * RIP, reach * 4 * RIP);
}

/* ---------- the vehicle ---------- */
const cam = new FlyCam(canvas), controls = new Controls(), autodrive = new Autodrive(), view = new VehicleView(scene);
const world = { height: (x, z, y) => { if (city && y !== -Infinity) { const dk = city.deck(x, z), g = city.groundAt(x, z); if (dk === dk && (y === undefined ? dk > city.gy : Math.abs(dk - y) <= Math.abs(g - y))) return dk; return g; } return terrain.drive(x, z, y); }, ground: (x, z) => city ? city.groundAt(x, z) : terrain.drive(x, z, -Infinity), deck: (x, z) => city ? city.deck(x, z) : terrain.deck(x, z), deckMesh: (x, z, h) => city ? city.deckMesh(x, z, h) : roadSet ? roadSet.deckMesh(x, z, h) : null, surface: (x, z) => city ? 'asphalt' : terrain.surface(x, z), near: (x, z, r) => { if (city) return city.near(x, z, r); const l = landmarks ? scatter.near(x, z, r).concat(landmarks.near(x, z, r)) : scatter.near(x, z, r); return roadMesh ? l.concat(roadMesh.bridges.near(x, z, r), roadMesh.highway.near(x, z, r), ...branches.map(b => b.mesh.bridges.near(x, z, r)).flat(), roadMesh.district ? roadMesh.district.near(x, z, r) : [], traffic ? traffic.circles(x, z, r) : [], rail ? rail.near(x, z, r) : []) : l; }, get seaLevel() { return terrain.seaLevel; },
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
function placeOnRoad(s) { placeOnRoad0(s); applyCarry(); }
function applyCarry() { const c = gateFade.carry; if (!c || c.done || !phys) return; c.done = true; const u = Math.max(0, Math.min(c.u || 0, 45)); phys.u = u; try { if (phys.body) phys.body.setLinvel({ x: Math.cos(phys.yaw) * u, y: 0, z: Math.sin(phys.yaw) * u }, true); } catch (e) { /* the simple physics has no body */ } }
function placeOnRoad0(s) { if (cityMode && cityStart) { phys.reset(cityStart.x, cityStart.z, cityStart.yaw, city.gy); view.camYaw = null; return; } if (s === 0 && startAlong) s = startAlong; const p = road.at(s, {}), off = laneOffsets(road.style)[0], lat = (locationById(config.location).drive || 'right') === 'right' ? -off : off; phys.reset(p.x - p.tz * lat, p.z + p.tx * lat, p.th, p.y); view.camYaw = null; }
async function setVehicle(i) {
  const def = VEHICLES[i], model = await loadModel(def), old = phys; vehicle = i; await rapierReady; bus.emit('vehicle:changed', { id: def.id });
  const par = vehicleParams(def.body, def.stats);
  if (old && old.free) old.free();
  phys = rapier ? new RapierVehicle(par, def.id, world) : new VehiclePhysics(par, world);                       // Rapier ray-cast vehicle; the old bicycle model remains as a fallback (?phys=old)
  if (old) { phys.reset(old.x, old.z, old.yaw, old.y); } else placeOnRoad(0);
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
function backToRoad() { if (!phys) return; if (cityMode) { const e = city.nearestStreet(phys.x, phys.z); if (e) { const fwd = Math.cos(phys.yaw - e.yaw) >= 0; phys.reset(e.x, e.z, fwd ? e.yaw : e.yaw + Math.PI, city.gy); view.camYaw = null; setMode('drive'); toast('Back on the street'); } return; } roadS = road.closestS(phys.x, phys.z, roadS); placeOnRoad(roadS); setMode('drive'); toast('Back on the road'); }
/* on foot (N14, src/player/onfoot.js): G beside a stopped vehicle gets you out; G beside the parked vehicle gets you back in. The vehicle waits on its handbrake. */
let entities = null; const interactions = new Interactions(); let vehicleHandle = 0, foot = null, figure = null, parkedYaw = 0, footPitch = 0.28, lookDrag = null;
const footWorld = { height: (x, z, y) => world.height(x, z, y), surface: (x, z) => world.surface(x, z), get seaLevel() { return world.seaLevel; },
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
  if (cityMode) return;                                                                                   // a city is the pack, not a seed
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
let adSim = null;                                                                                              // the traffic of the road the autodrive is on (a branch road has its own)
autodrive.lane = (dir, k = 0) => !adSim ? 0 : k === 1 && adSim.lanes.length < 2 ? adSim.lateral(-dir, 0) : adSim.lateral(dir, adSim.lanes[k] === undefined ? 0 : k); autodrive.lanes = () => adSim ? adSim.lanes.length : 1;
autodrive.leader = (ph, s, range, lat) => adSim && adSim.cap ? adSim.leaderAhead({ x: ph.x, z: ph.z, s, yaw: ph.yaw, u: ph.u }, range, lat) : cityMode && city ? city.traffic.leaderAhead(ph, range) : null; autodrive.lanesAt = (ph, s, lat, a, b) => adSim && adSim.cap ? adSim.laneGap({ x: ph.x, z: ph.z, s, yaw: ph.yaw, u: ph.u }, lat, a, b) : { ahead: null, behind: null };
autodrive.tolls = s => adSim && adSim.road.style.id === 'nh6' ? adSim.tollsNear(s) : [];                      // toll plazas: slow down and keep the lane
/* autodrive has two levels (E or the button cycles Off, Auto, Cruise): 'full' steers and drives, 'cruise' holds the speed and the gap while you steer. It drives in the style of the current drive mode (sport drives like a sports car). */
function setAuto(on, level) { if (on && (mode !== 'drive' || !phys)) return; if (on && cityMode && !(cityNav && cityNav.active)) { toast('Pick a destination on the map first (P)'); return; } if (on) { autodrive.level = level || 'full'; autodriveStyle(); } autodrive.s = roadS; autodrive.toggle(on); const b = $('#autoBtn'); b.classList.toggle('on', on); b.textContent = on && autodrive.level === 'cruise' ? 'Cruise' : 'Auto'; if (touchUI) touchUI.setAuto(on); toast(on ? (autodrive.level === 'cruise' ? 'Cruise on: you steer, the car holds speed and distance. Brake to stop it' : 'Autodrive on: steer or brake to take over') + ' · ' + (DRIVE_MODES[S.driveMode || 'normal'].name) + ' style' : 'Autodrive off'); }
function autodriveStyle() { autodrive.setStyle(S.driveMode || 'normal', phys && phys.p ? phys.p.top * (phys.M ? phys.M.top : 1) : 40); if (cityMode) autodrive.cruise = Math.min(autodrive.cruise, (S.driveMode === 'sport' ? 80 : 50) / 3.6); }       // a city street is not a highway
function cycleAuto() { if (!autodrive.enabled) setAuto(true, 'full'); else if (autodrive.level === 'full') setAuto(true, 'cruise'); else setAuto(false); }
/* camera views, cycled with V like the old GTA games; C jumps to the driver's seat and back */
const CAMS = ['middle', 'far', 'close', 'hood', 'bumper', 'cockpit', 'cinematic'], CAM_NAMES = { middle: 'Chase', far: 'Far chase', close: 'Close chase', hood: 'Hood', bumper: 'Bumper', cockpit: 'Driver seat', cinematic: 'Cinematic' };
function setCam(name, quiet) { if (!CAMS.includes(name)) name = 'middle'; view.setMode(name); S.cam = name; save(); if (!quiet) toast('Camera: ' + CAM_NAMES[name]); }
const cycleCam = () => setCam(CAMS[(CAMS.indexOf(view.mode || 'middle') + 1) % CAMS.length]);
const toggleView = () => { if (view.mode === 'cockpit') setCam(S.camBefore || 'middle'); else { S.camBefore = view.mode || 'middle'; setCam('cockpit'); } };
setCam(S.cam, true);
$('#viewBtn').addEventListener('click', cycleCam); $('#reset').addEventListener('click', backToRoad);
$('#fly').addEventListener('click', () => setMode(mode === 'fly' ? 'drive' : 'fly')); $('#ride').addEventListener('click', () => setMode(mode === 'ride' ? 'drive' : 'ride'));
controls.on('auto', cycleAuto); $('#autoBtn').addEventListener('click', cycleAuto); controls.on('view', toggleView); controls.on('cam', cycleCam); controls.on('reset', backToRoad); controls.on('interact', useNearby); controls.on('buff', useBuff); $('#buff').addEventListener('pointerdown', e => { e.preventDefault(); useBuff(); }); controls.on('fly', () => setMode(mode === 'fly' ? 'drive' : 'fly'));
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
/* between the one India world and a city world to explore: a clean reload (a loading screen); the choice is kept in the address */
function exploreCity(id) { location.search = '?play&loc=' + encodeURIComponent(id) + '&seed=' + encodeURIComponent(config.seed) + '&q=' + quality; }
/* the highway gate of a city enclave (docs/CITY_PACK.md section 3): driving into Delhi on a national highway reloads into the city at that highway's gate; driving out through a gate returns to the India world at Delhi, heading out */
function enterCity(nh, roadId) { if (entering || city || !phys || mode !== 'drive') return; const gs = CITY_GATES; if (!gs) return; const g = pickGate(gs, roadId, phys.yaw || 0, nh); if (!g) return; entering = true; toast('Entering Delhi…'); S.enclave = 'delhi'; save(); gateJump('?play&city=delhi&at=' + encodeURIComponent(g.id) + '&seed=' + encodeURIComponent(config.seed) + '&q=' + quality, phys.u); }
let leaving = false, cityGates = null;
/* the India map button inside the city: out through the gate nearest to the car, onto its highway (the same hand-over as driving out; the car starts at rest) */
function leaveCity() { if (leaving) return; let g = null, bd = Infinity; for (const x of city.pack.M.gates) { const d = Math.hypot(phys.x - x.x, phys.z - x.z); if (d < bd) { bd = d; g = x; } } if (!g) { goWorld('delhi'); return; } leaving = true; const m = (cityGates || []).find(x => x.id === g.id), u = new URLSearchParams(); u.set('play', ''); u.set('india', 'world'); u.set('at', 'delhi'); if (m && m.road) { u.set('via', m.road); u.set('toward', m.toward); } u.set('fromcity', '1'); u.set('seed', config.seed); u.set('q', quality); S.enclave = null; save(); gateJump('?' + u.toString(), 0); }
function updateGateExit() { if (!city || leaving || !phys || mode !== 'drive' || phys.u < 3) return; for (const g of city.pack.M.gates) { if (Math.hypot(phys.x - g.x, phys.z - g.z) > 40) continue; const b = yawOfBearing(g.bearing); if (Math.cos(phys.yaw - b) < -0.5) { leaving = true; toast('Leaving Delhi…'); const m = (cityGates || []).find(x => x.id === g.id), u = new URLSearchParams(); u.set('play', ''); u.set('india', 'world'); u.set('at', 'delhi'); if (m && m.road) { u.set('via', m.road); u.set('toward', m.toward); } u.set('fromcity', '1'); u.set('seed', config.seed); u.set('q', quality); S.enclave = null; save(); gateJump('?' + u.toString(), phys.u); return; } } }
const yawOfBearing = b => Math.atan2(-Math.cos(b), Math.sin(b));
if (indiaRoute && indiaRoute.world && !cityMode) fetch('assets/cities/delhi/manifest.json').then(r => r.json()).then(m => { CITY_GATES = mapGates(indiaRoute.net, 'delhi', m.gates); }).catch(() => {});
if (cityMode) Promise.all([fetch('assets/india/skeleton.json').then(r => r.json()), fetch('assets/cities/delhi/manifest.json').then(r => r.json())]).then(([sk, m]) => { cityGates = mapGates(new RoadNetwork(sk), 'delhi', m.gates); }).catch(() => {});
function goWorld(cityId, outside) { if ((cityId || currentCityId()) === 'delhi' && !cityMode && !outside) { location.search = '?play&city=delhi&seed=' + encodeURIComponent(config.seed) + '&q=' + quality; return; }       // Delhi on the India map is the full city we built (a highway gate leads out of it and back), not the old stylised district
  const u = new URLSearchParams(); u.set('play', ''); u.set('india', 'world'); u.set('at', cityId || currentCityId()); if ((cityId || currentCityId()) === 'delhi') { u.set('via', 'nh-delhi-lucknow'); u.set('toward', 'kanpur'); u.set('fromcity', '1'); } u.set('seed', config.seed); u.set('q', quality); location.search = '?' + u.toString(); }
function setLocation(id) {
  if (id === 'delhi' && !cityMode) { location.search = '?play&city=delhi&seed=' + encodeURIComponent(config.seed) + '&q=' + quality; return; }                  // Delhi is the city pack
  if (indiaRoute) { exploreCity(id); return; }
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
    else if (k === 'traffic') { S.traffic = v; save(); if (traffic) traffic.setMode(v); if (city) { city.traffic.setMode(v); city.peds.setMode(v); } if (peds) peds.setLevel(v); }
    else if (k === 'radioVol') radio.setVolume(v); else if (k === 'quality') reloadWith('q', v); else if (k === 'shadows') reloadWith('shadows', v);
  },
  where: () => where(), currentCity: () => currentCityId(), travel: id => goWorld(id), navigate: id => setNav(id), indiaMap: () => cityMode && city && phys ? leaveCity() : goWorld(currentCityId(), true), inWorld: () => !!indiaRoute, navTarget: () => navDest,
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
    'road        at ' + (roadS / 1000).toFixed(2) + ' km   built ' + (road.sMin / 1000).toFixed(1) + ' .. ' + (road.sMax / 1000).toFixed(1) + ' km' + (indiaRoute ? '   side roads ' + branches.length + ' in ' + junctionOf.size + ' junctions, cars on them ' + (traffic ? traffic.extra.reduce((a, e) => a + e.sim.cars.length, 0) : 0) : ''),
    (city ? city.summary() : ''), 'origin      ' + grid.origin.x + ', ' + grid.origin.z + '   mode ' + mode,
    phys ? 'vehicle     u ' + phys.u.toFixed(1) + '  v ' + phys.v.toFixed(2) + '  r ' + phys.r.toFixed(2) + '  slip ' + phys.slip.toFixed(2) + '  ' + phys.surface : '', 'seed        ' + config.seed + '   quality ' + quality];
});
/* drive modes (vehicle/physics.js DRIVE_MODES): N or the button cycles Eco, Normal, Sport, Off-road; the choice is saved and applies to every vehicle */
function setDriveMode(id, quiet) { if (!DRIVE_MODES[id]) id = 'normal'; S.driveMode = id; if (autodrive.enabled) autodriveStyle(); if (phys && phys.setDriveMode) phys.setDriveMode(id); const m = DRIVE_MODES[id]; $('#modeBtn').textContent = m.name; const tag = $('#modeTag'); tag.textContent = m.name; tag.className = id; save(); if (!quiet) toast(m.name + ': ' + m.blurb); }
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
function step(dt, now) { update(dt, now); draw(now); if (gateFade.carry && gateFade.frames < 9 && ++gateFade.frames === 4) { gateFade.d.style.transition = 'opacity .5s ease'; gateFade.d.style.opacity = '0'; } }                                    // one whole frame (also used by the headless checks through __next.step)
/* adaptive resolution: when frames take too long the game lowers its render resolution step by step (and the shadows at the last steps), and raises it again when there is room; ?gov=off turns it off */
const gov = { ema: 16.7, last: 0, level: 0, t: 0, on: q.get('gov') !== 'off', base: Math.min(devicePixelRatio, phone ? 1 : 1.5), mul: [1, 0.8, 0.65, 0.52, 0.42], told: false };
function governor(now) {
  if (!gov.on) return; const dt = now - gov.last; gov.last = now; if (dt <= 0 || dt > 250 || document.hidden) return;                  // a stall or a hidden tab says nothing about the load
  gov.ema += (dt - gov.ema) * 0.06; gov.t += dt; if (gov.t < 2000) return;
  const up = gov.ema < 15 && gov.level > 0 && gov.t > 9000, down = gov.ema > 30 && gov.level < gov.mul.length - 1; if (!up && !down) return;
  gov.level += down ? 1 : -1; gov.t = 0; renderer.setPixelRatio(Math.max(0.4, gov.base * gov.mul[gov.level])); resize(); if (shadowsOn) env.setShadows(gov.level >= 3 ? 0 : (quality === 'high' ? 4096 : 2048), quality === 'high' ? 90 : 70);
  if (down && !gov.told) { gov.told = true; toast('Resolution lowered to keep the game smooth (see Settings for a lower quality tier)'); }
}
/* in a city the near plane is 1 m unless the camera is inside or on the car (cockpit, hood, bumper: 0.3 m): depth precision at 300 m to 1 km is three times better, which stops the ground layers shimmering */
function setNear() { if (!cityMode) return; const nn = phys && Math.hypot(camera.position.x + grid.origin.x - phys.x, camera.position.z + grid.origin.z - phys.z) < 3.4 ? 0.3 : 1.0; if (camera.near !== nn) { camera.near = nn; camera.updateProjectionMatrix(); } }
function draw(now) { governor(now); setNear(); if (fx) fx.render(); else renderer.render(scene, camera); stats(now); }
/* world sectors (src/world/sectors.js): 512 m squares with their own load state, above the terrain tiles. A sector loads the shared assets its region needs (today the vehicle pack) and releases them when it goes. */
const focus = { x: 0, z: 0, dx: 1, dz: 0, speed: 0 };
/* what a sector holds (N8): the region its centre belongs to (nearest of the regions by the real place each is an impression of, with a blend near borders) and the cities of the route inside it.
   Entering a sector that holds a city builds that city's crossing roads, signals and traffic; leaving it (past the unload distance) removes them. India mode only. */
const guideWorld = () => (indiaRoute && road && road.guide ? road.guide : null);
const cityNodes = () => { if (indiaRoute && indiaRoute.world) { if (!cityNodes.all) { const n0 = indiaRoute.net.cities.get(indiaRoute.from); cityNodes.all = [...indiaRoute.net.cities.values()].map(n => ({ id: n.id, name: n.name, x: n.x - n0.x, z: n.z - n0.z, along: 0 })); } return cityNodes.all; } const g = guideWorld(); if (!g) return []; if (cityNodes.for !== g) { cityNodes.for = g; cityNodes.list = indiaRoute.cities.map(c => ({ id: c.id, name: c.name, along: c.along, ...guidePoint(g, c.along) })); } return cityNodes.list; };
const gameFrame = (x, z) => { const g = guideWorld(), n0 = indiaRoute.net.cities.get(indiaRoute.from); return { x: n0.x + (x - g[0]), z: n0.z + (z - g[1]) }; };
function ensureCityJunction(c) { if (!buildCityRoads(c)) throw new Error('the road to ' + c.name + ' is not built yet'); }
const sectors = new SectorManager({ bus,
  meta: s => { const meta = { region: config.location, assets: ['traffic:pack'], cities: [] }; if (guideWorld()) { const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, gf = gameFrame(cx, cz), ll = fromGame(gf.x, gf.z), r = regionAt(ll.lat, ll.lon, REGIONS); if (r) { meta.region = r.id; meta.blend = r.blend; } meta.cities = cityNodes().filter(c => c.x >= s.x0 && c.x < s.x1 && c.z >= s.z0 && c.z < s.z1); } return meta; },
  load: async (s, signal) => { for (const k of s.meta.assets) await assetCache.acquire(k); if (nav) nav.loadSector(s.sx, s.sz); for (const c of s.meta.cities) ensureCityJunction(c); return { held: s.meta.assets.slice(), cities: s.meta.cities.map(c => c.id) }; },
  unload: s => { if (nav) nav.unloadSector(s.sx, s.sz); if (s.data && s.data.cities) for (const id of s.data.cities) dropBranches(id); if (s.data && s.data.held) for (const k of s.data.held) assetCache.release(k); } });
bus.on('world:rebuilt', () => { sectors.reset(); if (rail) { rail.dispose(); rail = null; } gateReg.clear(); });                                                    // a new world: every sector starts again
runtime.add({ name: 'world', order: 0, update: (dt, now) => update(dt, now) }); runtime.add({ name: 'sectors', order: 10, update: (dt, now) => sectors.update(focus.x, focus.z, focus, now) });
runtime.add({ name: 'render', order: 100, render: now => draw(now) }); runtime.start();
document.addEventListener('visibilitychange', () => { if (!document.hidden) runtime.resetClock(); });          // no time spike when the tab comes back
/* activities (N15, src/activities): start markers beside the road (G while stopped near one), a goal beacon, a timer line, results kept in the save */
const runner = new ActivityRunner(bus), actMarks = new THREE.Group(), actHud = document.createElement('div'); let actDefs = [], actGoal = null;
actHud.style.cssText = 'position:fixed;left:50%;top:92px;transform:translateX(-50%);z-index:20;display:none;background:rgba(8,12,20,.75);border-radius:999px;padding:6px 16px;font-size:14px;pointer-events:none'; document.body.appendChild(actHud); scene.add(actMarks);
const beacon = (color, x, z, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 60, 14, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })); m.userData.w = { x, z, y }; actMarks.add(m); return m; };
/* a drive to a city of the route (India mode): par = the guide distance at 30 m/s, limit twice that; the goal is where the road reaches the city (found when you start, extending the road if needed) */
const indiaDrive = c => ({ id: 'india-' + (indiaRoute.roadId || 'route') + '-' + indiaRoute.from + '-' + c.id, region: '*', title: 'Drive to ' + c.name, startS: 60, distance: 0, goalAlong: c.along, limit: Math.round(c.along / 30 * 2.2), par: Math.round(c.along / 30), radius: 45 });
function goalOfCity(d) { let guard = 0; while (guard++ < 80) { for (let s = Math.max(0, road.sMin); s < road.sMax - 20; s += 20) { const a = road.arcAtS(s); if (a !== null && a >= d.goalAlong - 10) return road.at(s, {}); } const box = road.ensure(0, road.sMax + 300); if (box) grid.invalidate(box); } return null; }
function setupActivities() {
  runner.cancel(); for (const d of actDefs) interactions.remove('activity:' + d.id); actDefs = []; actGoal = null; while (actMarks.children.length) { const m = actMarks.children.pop(); m.geometry.dispose(); m.material.dispose(); }
  if (!road) return; const defs = activitiesFor(config.location).slice(); if (indiaRoute) for (const c of indiaRoute.cities.filter(c => c.along > 600).slice(0, 2)) defs.push(indiaDrive(c));                       // in India mode: drive to the next cities of the route
  for (const d of defs) {
    const a = road.at(d.startS, {}), b = d.goalAlong ? a : road.at(d.startS + d.distance, {}), start = { x: a.x + a.tz * 2, z: a.z - a.tx * 2 }, goal = { x: b.x, z: b.z }; actDefs.push({ ...d, goal }); beacon(0x40e070, start.x, start.z, terrain.drive(start.x, start.z));
    interactions.add({ id: 'activity:' + d.id, x: start.x, z: start.z, r: 14, prompt: d.title + ': start (G)', enabled: () => runner.state !== 'running', onUse: () => { const gl = d.goalAlong ? goalOfCity(d) : goal; if (!gl) { toast('The road ahead is still being built'); return; } actGoal = beacon(0xffc040, gl.x, gl.z, terrain.drive(gl.x, gl.z)); runner.start(d, gl); toast(d.title + ': reach the gold beacon in ' + d.limit + ' s'); } });
  }
}
bus.on('world:rebuilt', setupActivities);
bus.on('mode:changed', e => { if (e.to !== 'drive' && runner.state === 'running') runner.cancel(); if (e.to !== 'foot') { lookDrag = null; if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock(); } });
bus.on('activity:finished', r => {
  if (actGoal) { actMarks.remove(actGoal); actGoal.geometry.dispose(); actGoal.material.dispose(); actGoal = null; } actHud.style.display = 'none'; if (r.outcome === 'cancelled') return;
  const rec = recordResult(S.progress, r); S.progress = rec.progress; save(); const t = actDefs.find(d => d.id === r.id);
  resultCard(t, r, rec);
});
/* what happened, in a card for a few seconds (replaces the toast): the time, the rating, the best time, and a hint of what to do next */
const resultBox = document.createElement('div'); resultBox.style.cssText = 'position:fixed;left:50%;top:30%;transform:translateX(-50%);z-index:30;display:none;background:rgba(8,12,20,.9);border:1px solid #2a3a5c;border-radius:14px;padding:14px 22px;text-align:center;min-width:240px'; document.body.appendChild(resultBox); let resultT = 0;
function resultCard(def, r, rec) {
  const medal = { gold: '#ffd24a', silver: '#d5dbe6', bronze: '#d98c4e' }[r.rating] || '#ff6b5f', best = (S.progress.activities[r.id] || {}).best;
  resultBox.innerHTML = '<div style="font-size:12px;color:#9fb0c8">' + (def ? def.title : 'Activity') + '</div><div style="font-size:24px;font-weight:700;margin:4px 0;color:' + medal + '">' + (r.outcome === 'done' ? r.rating.toUpperCase() : 'OUT OF TIME') + '</div><div style="font-size:15px">' + r.time.toFixed(1) + ' s' + (def ? ' <span style="color:#9fb0c8">(par ' + def.par + ' s)</span>' : '') + '</div>' + (best !== undefined ? '<div style="font-size:12px;color:#9fb0c8;margin-top:4px">Best ' + best.toFixed(1) + ' s' + (rec.isBest ? ' · new best' : '') + '</div>' : '') + '<div style="font-size:12px;color:#9fb0c8;margin-top:6px">Stop near the green beacon and press G to go again</div>';
  resultBox.style.display = 'block'; clearTimeout(resultT); resultT = setTimeout(() => { resultBox.style.display = 'none'; }, 6000);
}
/* India route readout (only with ?india): the next city and the real distance left, and the OpenStreetMap credit the road data needs */
const routeHud = document.createElement('div'); routeHud.style.cssText = 'position:fixed;left:50%;top:128px;transform:translateX(-50%);z-index:20;display:none;background:rgba(8,12,20,.7);border-radius:999px;padding:5px 14px;font-size:13px;pointer-events:none'; document.body.appendChild(routeHud);
if (indiaRoute) { const cr = document.createElement('div'); cr.textContent = 'Road shapes © OpenStreetMap contributors (ODbL)'; cr.style.cssText = 'position:fixed;right:8px;bottom:4px;font-size:10px;color:#9fb0c8;z-index:5;pointer-events:none'; document.body.appendChild(cr); }
/* ---------- one India world: every highway is a road, all of them connected at the cities ----------
   A "road record" (rec) wraps one Road of the world: { id (the skeleton road id), road, mesh, te (its traffic), cityAlong (Map city id -> signed distance along its guide: positive ahead of where it was started, negative behind), hint }.
   The player's start road is the primary record (its mesh is `roadMesh`, its traffic `traffic.sim`). The others are built at city junctions and removed when far (see updateBranches). */
let primaryRec = null, activeRec = null;
const recs = () => [primaryRec, ...branches].filter(Boolean);
function ensurePrimaryRec() {
  if (!indiaRoute || !road || (primaryRec && primaryRec.road === road)) return primaryRec; const R = indiaRoute, m = new Map(R.cities.map(c => [c.id, c.along])); for (const c of R.citiesBack || []) if (!m.has(c.id)) m.set(c.id, c.along);
  primaryRec = { id: R.roadId || 'route', road, mesh: null, te: null, primary: true, cityAlong: m, hint: 0, roadIdsAt: id => (R.roadId ? [R.roadId] : R.legs.filter(l => l.from === id || l.to === id).map(l => l.road)) }; return primaryRec;
}
/* the distance s along a road at which it reaches the city whose signed guide distance is `along` (extending the road until it does); null if it never does */
function sOfAlong(r, along) {
  if (along === 0) return 0; let guard = 0;
  if (along > 0) { while (guard++ < 90) { const a = r.arcAtSigned(r.sMax - 20); if (a !== null && a >= along + 20) break; const box = r.ensure(0, r.sMax + 300); if (box) grid.invalidate(box); } for (let s = Math.max(0, r.sMin); s < r.sMax - 20; s += 20) { const a = r.arcAtSigned(s); if (a !== null && a >= along) return s; } }
  else { while (guard++ < 90) { const a = r.arcAtSigned(r.sMin + 20); if (a !== null && a <= along - 20) break; const box = r.ensure(r.sMin - 300, 0); if (box) grid.invalidate(box); } for (let s = Math.min(0, r.sMax); s > r.sMin + 20; s -= 20) { const a = r.arcAtSigned(s); if (a !== null && a <= along) return s; } }
  return null;
}
const roadBox = r => { const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }, p = {}; for (let s = r.sMin; s <= r.sMax; s += 150) { r.at(s, p); b.minX = Math.min(b.minX, p.x); b.maxX = Math.max(b.maxX, p.x); b.minZ = Math.min(b.minZ, p.z); b.maxZ = Math.max(b.maxZ, p.z); } return b; };
/* a city's crossing roads: every highway through the city that is not loaded yet is built as a road starting on a loaded road through the city, at the same height, following its own path both ways; one shared signal joins them all */
/* a road that crosses another one (outside a city) is raised on a deck over it (src/world/interchange.js): the lift changes its heights, so the terrain under it and anything already drawn of it are rebuilt */
const roadRank = x => ({ nh6: 3, highway: 2, boulevard: 2 })[x.style.id] ?? 1;                                    // the bigger road stays on the ground; the smaller one goes over it (equal: the newer one)
function raiseOverpasses(r, rec) {
  if (!indiaRoute || !roadSet || roadSet.roads.length < 2) return;
  const lift = (road, over, recOf) => {
    const made = addOverpasses(road, over); if (!made.length) return; const p = {};
    for (const m of made) { const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }; for (let s = Math.max(m.s0, road.sMin + 2); s <= Math.min(m.s1, road.sMax - 2); s += 20) { road.at(s, p); b.minX = Math.min(b.minX, p.x - 90); b.maxX = Math.max(b.maxX, p.x + 90); b.minZ = Math.min(b.minZ, p.z - 90); b.maxZ = Math.max(b.maxZ, p.z + 90); } grid.invalidate(b); }
    if (recOf && recOf.mesh) recOf.mesh.refresh(); else if (road === (primaryRec && primaryRec.road) && roadMesh) roadMesh.refresh();
  };
  const others = roadSet.roads.filter(o => o !== r), higher = others.filter(o => roadRank(o) >= roadRank(r)), lower = others.filter(o => roadRank(o) < roadRank(r));
  lift(r, higher, rec);                                                                                           // this road goes over the bigger (or equal) roads it crosses
  for (const o of lower) lift(o, [r], recs().find(x => x.road === o));                                            // smaller roads that cross this one go over it
}
function buildCityRoads(city) {
  const R = indiaRoute; ensurePrimaryRec(); const anchors = recs().filter(r => r.cityAlong.has(city.id)); if (!anchors.length) return false;
  const loaded = new Set(); for (const a of anchors) for (const id of (a.roadIdsAt ? a.roadIdsAt(city.id) : [a.id])) loaded.add(id);
  const a0 = anchors[0], sc = sOfAlong(a0.road, a0.cityAlong.get(city.id)); if (sc === null) return false; const p = a0.road.at(sc, {}), start = { x: p.x, y: p.y, z: p.z }, made = [];
  for (const j of R.net.junction(city.id)) {
    if (loaded.has(j.road)) continue; const rd = R.net.roads.get(j.road), i = rd.stops.findIndex(st => st.id === city.id), nxt = rd.stops[i + 1], prv = rd.stops[i - 1];
    let gA = nxt ? R.net.guideFor(j.road, city.id, nxt.id) : null, gB = prv ? R.net.guideFor(j.road, city.id, prv.id) : null; if (!gA) { gA = gB; gB = null; } if (!gA) continue;
    const cfg = { ...config, seed: config.seed + ':' + city.id + ':' + j.road, road: { ...config.road, guide: gA.pts, guideBack: gB ? gB.pts : null, start, style: rd.kind === 'nh' ? 'highway' : 'nh6' } };
    const br = new Road(terrain, cfg); roadSet.add(br); const bx = br.ensure(-500, 900); if (bx) grid.invalidate(bx); raiseOverpasses(br); const along = new Map(gA.cities.map(c => [c.id, c.along])); if (gB) for (const c of gB.cities) if (!along.has(c.id)) along.set(c.id, -c.along);
    const rec = { id: j.road, city: city.id, road: br, cityAlong: along, hint: 0, near: false, te: traffic ? traffic.addRoad(br) : null, mesh: new RoadMesh(scene, br, br.style, grid.origin, { tag: rd.nh || '', gates: [...along].filter(([id, a]) => a > 0 && id !== city.id).map(([id, a]) => ({ en: CITY[id].name, hi: HINDI[id] || '', alongM: a, sub: gateSub(R.net, id, j.road) })), dests: [...along].filter(([id, a]) => a > 0 && id !== city.id).map(([id, a]) => ({ en: CITY[id].name, hi: HINDI[id] || '', km: 0, alongM: a })) }) };
    branches.push(rec); made.push(rec);
  }
  if (traffic && !junctionOf.has(city.id)) {
    const arms = []; for (const a of anchors) { const s = a === a0 ? sc : sOfAlong(a.road, a.cityAlong.get(city.id)); if (s !== null) arms.push({ sim: a.primary ? traffic.sim : (a.te ? a.te.sim : null), road: a.road, s }); } for (const b of made) if (b.te) arms.push({ sim: b.te.sim, road: b.road, s: 0 });
    const live = arms.filter(a => a.sim); if (live.length >= 2) { const jn = new Junction(p.x, p.z); jn.y = p.y; for (const a of live) jn.addArm(a.sim, a.road, a.s); traffic.addJunction(jn); junctionSignals.add(jn); junctionOf.set(city.id, jn); }
  }
  return true;
}
/* streets that cross the main road of a region (region.junctions, N11): each is a second road with the region's district along it, its own traffic, and a shared signal at the crossing */
let regionJunctionsBuilt = false;
function buildRegionJunctions() {
  regionJunctionsBuilt = true; const reg = locationById(config.location).region; if (!reg || !reg.junctions || !traffic) return;
  reg.junctions.forEach((def, n) => {
    road.ensure(def.s - 100, def.s + 400); const p = road.at(def.s, {}), th = p.th + def.bearing, start = { x: p.x, y: p.y, z: p.z }, L = def.arm, ga = [0, 0, Math.cos(th) * L * 0.5, Math.sin(th) * L * 0.5, Math.cos(th) * L, Math.sin(th) * L], gb = ga.map(v => -v);
    const cfg = { ...config, seed: config.seed + ':junction:' + n, road: { ...config.road, guide: ga, guideBack: gb, start, style: def.style } }, br = new Road(terrain, cfg); roadSet.add(br); const bx = br.ensure(-600, 600); if (bx) grid.invalidate(bx);
    const b = { id: 'region:' + n, city: 'region:' + n, road: br, cityAlong: new Map(), mesh: new RoadMesh(scene, br, br.style, grid.origin, { district: reg.district, seed: config.seed + ':' + config.location + ':x' + n, blocked: (x, z) => terrain.inZone(x, z, 8) }), hint: 0, near: false, te: traffic.addRoad(br), fixed: true }; branches.push(b);
    const jn = new Junction(p.x, p.z); jn.y = p.y; jn.addArm(traffic.sim, road, def.s); jn.addArm(b.te.sim, br, 0); traffic.addJunction(jn); junctionSignals.add(jn); junctionOf.set('region:' + n, jn);
  });
}
/* a city leaving the loaded sectors: its junction goes (the roads stay until they are far from the player: see updateBranches) */
function dropBranches(cityId) { const jn = junctionOf.get(cityId); if (jn) { if (traffic) traffic.removeJunction(jn); junctionSignals.remove(jn); junctionOf.delete(cityId); } }
function removeRec(b) { const i = branches.indexOf(b); if (i < 0) return; for (const [cid, jn] of [...junctionOf]) if (jn.arms.some(a => a.road === b.road)) { if (traffic) traffic.removeJunction(jn); junctionSignals.remove(jn); junctionOf.delete(cid); } roadSet.remove(b.road); if (traffic && b.te) traffic.removeRoad(b.te); grid.invalidate(roadBox(b.road)); b.mesh.dispose(); branches.splice(i, 1); }
const triedBranches = new Set(), tmpP = {}, junctionOf = new Map(), junctionSignals = new JunctionSignals(scene, grid.origin);
bus.on('world:rebuilt', () => { regionJunctionsBuilt = false; triedBranches.clear(); primaryRec = null; activeRec = null; for (const j of [...junctionSignals.items.keys()]) junctionSignals.remove(j); junctionOf.clear(); });
let primaryOff = false;
function updateBranches(px, pz, dt) {
  if (!regionJunctionsBuilt && !indiaRoute && road && traffic && roadSet) buildRegionJunctions();
  if (!roadSet) return;
  let best = null, bd = Infinity;
  if (indiaRoute) { ensurePrimaryRec(); const q = road.at(roadS, tmpP), d = Math.hypot(q.x - px, q.z - pz); primaryRec.hint = roadS; primaryRec.dist = d; { const sc0 = d + (phys ? (1 - Math.abs(Math.cos((phys.yaw || 0) - q.th))) * 30 : 0); if (sc0 < bd) { bd = sc0; best = primaryRec; } }
    if (traffic) { if (!primaryOff && d > 1100) { primaryOff = true; traffic.sim.setMode('off'); } else if (primaryOff && d < 800) { primaryOff = false; traffic.sim.setMode(S.traffic); } } }      // the start road is quiet while you are far from it
  for (let i = branches.length - 1; i >= 0; i--) { const b = branches[i]; const s = b.road.closestS(px, pz, b.hint); b.hint = s; const q = b.road.at(s, tmpP), dist = Math.hypot(q.x - px, q.z - pz); b.dist = dist;
    if (indiaRoute && !b.fixed && dist > 4500) { removeRec(b); continue; }                                                    // a road that is far from you goes (it comes back with its city)
    const box = b.road.ensure(s - 2600, s + 2600); if (box) { grid.invalidate(box); raiseOverpasses(b.road, b); } b.mesh.update(s); { const sc1 = dist + (phys ? (1 - Math.abs(Math.cos((phys.yaw || 0) - q.th))) * 30 : 0); if (sc1 < bd) { bd = sc1; best = b; } }                // the road you are on: the nearest, and the one you are pointing along
    if (traffic && b.te) { b.near = b.near ? dist < 1000 : dist < 700; traffic.updateExtra(b.te, dt, { x: px, z: pz, s, u: phys ? phys.u : 0, yaw: phys ? phys.yaw : 0 }, b.near); } }
  activeRec = best;
}
/* toll plazas on the player's road: passing through one pays the toll (a toast; two-wheelers go free, trucks pay more); no money system yet */
let lastToll = null;
function updateToll() { const tr = activeRec ? activeRec.road : road, ts0 = activeRec ? activeRec.hint : roadS; if (!tr || tr.style.id !== 'nh6' || mode !== 'drive' || !phys || phys.u < 1) return; for (const ts of validTolls(tr, ts0 - 20, ts0 + 40)) { if (ts0 >= ts && ts0 <= ts + TOLL_LEN && lastToll !== ts) { lastToll = ts; const id = VEHICLES[vehicle].id, fare = id === 'bike' ? 0 : id === 'truck' ? 270 : 85; toast(fare ? 'Toll plaza: \u20b9' + fare + ' paid with FASTag' : 'Toll plaza: two-wheelers pass free'); } } }
let gps = null, gpsNext = null, rail = null, stationBoard = null, announcer = null, trainSound = null, railSamples = null, announceClips = null, railT = 0, lastStation = null, lastNearTrain = null; let navDest = q.get('nav') && CITY[q.get('nav')] ? q.get('nav') : null, lastCityToast = '';
function setNav(id) { navDest = id && CITY[id] ? id : null; toast(navDest ? 'Navigating to ' + CITY[navDest].name : 'Navigation off'); }
/* the railway's life around the player: the nearest train is heard, a station shows its departure board and announces trains by the railway clock */
function updateRailLife(dt, px, pz) {
  railT += dt; const now = performance.now(), pg = rail.toGame(px, pz), ox = grid.origin.x, oz = grid.origin.z; if (!trainSound) { trainSound = new TrainSound(sound); railSamples = new RailSamples(sound); announceClips = new AnnounceClips(sound); } if (sound.ctx) { railSamples.load(); announceClips.load(); } trainSound.quiet = railSamples.has('passby') || railSamples.has('diesel');
  let best = null, bd = 1e9; for (const tr of rail.trains) if (tr.active) { const m = tr.meshes[Math.min(2, tr.meshes.length - 1)], d = Math.hypot(m.position.x + ox - px, m.position.z + oz - pz); if (d < bd) { bd = d; best = { tr, m, d }; } }
  if (best) { const m = best.m, wx = m.position.x + ox, wz = m.position.z + oz, f = best.tr.line.at(best.tr.head, tmpP), prevD = best.tr.pd === undefined ? best.d : best.tr.pd; best.tr.pd = best.d; const closing = dt > 0 ? (prevD - best.d) / dt : 0, yaw = phys ? phys.yaw : cam.yaw, rx = wx - px, rz = wz - pz, side = (-rx * Math.sin(yaw) + rz * Math.cos(yaw)) / Math.max(1, best.d);
    trainSound.update(dt, { d: best.d, closing, v: best.tr.v, pan: side, motor: STYLE_ELECTRIC(best.tr), approaching: closing > -2 }, now); void f;
    const T = best.tr; if (railSamples.ok) {                                                                          // recorded sounds on top of the synthesised ones
      const pan = Math.max(-1, Math.min(1, side)); if (best.d < 55 && T.v > 10 && !T.passed) { T.passed = true; railSamples.play('passby', { gain: 0.8, rate: 0.9 + Math.min(0.3, T.v / 100), pan }); } else if (best.d > 200) T.passed = false;
      if (T.style === 'freight' && best.d < 320 && T.v > 2 && !T.heard) { T.heard = true; railSamples.play('diesel', { gain: 0.7 * Math.max(0.2, 1 - best.d / 320), pan }); } else if (best.d > 600) T.heard = false;
      const decel = T.vPrev !== undefined && T.v < T.vPrev - 0.03; T.vPrev = T.v; if (decel && T.v > 3 && best.d < 160 && now - (T.squealAt || 0) > 20000) { T.squealAt = now; railSamples.play('grinding', { gain: 0.45, pan }); } }
    if (best.d < 90 && lastNearTrain !== best.tr) { lastNearTrain = best.tr; const t = best.tr.real; toast(t ? t.n + ' ' + t.name : best.tr.local ? best.tr.local.name + ' · ' + best.tr.local.kind : best.tr.style === 'freight' ? 'Goods train' : 'Passenger train'); } } else trainSound.update(dt, null, now);
  /* a station within 160 m: its board, and an announcement when the clock reaches a scheduled arrival */
  let st = null; for (const n of rail.net.stations) { if (Math.abs(n.x - pg.x) < 200 && Math.abs(n.z - pg.z) < 200 && Math.hypot(n.x - pg.x, n.z - pg.z) < 160) { st = n; break; } }
  if (!stationBoard) { stationBoard = new StationBoard(); announcer = new Announcer(q.get('tts') !== 'off', q.get('tts') === 'en'); }
  syncCrossingGates(now);
  announcer.muted = !!S.muted; if (railSamples.ok) { railSamples.loop('platform', st ? 0.55 : 0, 1.2); railSamples.loop('station', st ? 0.35 : 0, 1.5); }
  if (st && railBook) { const clock = rail.clockMin() ?? clockMinutes(railT), city = rail.names[st.city] || { en: st.city, hi: '' }; stationBoard.show(city.en, city.hi, fmtTime(clock), railBook.departures(st.city, clock, 4));
    if (lastStation !== st) { lastStation = st; announcer.say(announcement('welcome', {}, 1, city.en), now, 8); }
    for (const a of rail.control ? rail.arriving(st.city, railBook) : railBook.arrivalsAt(st.city, clock)) { const key = a.n + ':' + (a.key || Math.floor(railT / 60)); if (updateRailLife.done !== key) { updateRailLife.done = key; const plat = a.plat || 1 + Math.floor(hashStr(a.n + st.city) * 4); const stt = (CITY[st.city] || {}).state, rl = STATE_LANG[stt], clip = announceClips.pick({ city: st.city, kind: 'arriving', train: a.n, langs: [rl ? rl.slice(0, 2) : 'hi', 'hi', 'en'], seed: updateRailLife.done }); if (clip && announceClips.play(clip, now)) { announcer.stop(); toast('Announcement: ' + (clip.title || clip.file)); } else announcer.say(announcement('arriving', a, plat, city.en, stt), now, 12); break; } } }
  else { stationBoard.hide(); if (lastStation) { lastStation = null; if (announcer) announcer.stop(); if (announceClips) announceClips.stop(); } }
}
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const STYLE_ELECTRIC = tr => tr.style !== 'freight' || true;
/* level crossings stop the road traffic: each built gate is registered with the traffic simulation of the road it is on (the player's road or a branch) and removed when the chunk goes */
const gateReg = new Map(); let gateSyncAt = 0;
function syncCrossingGates(now) {
  if (now - gateSyncAt < 1000 || !traffic) return; gateSyncAt = now; const sims = [traffic.sim, ...traffic.extra.map(e => e.sim)];
  for (const [key, r] of gateReg) if (!rail.gates.has(key)) { const i = r.sim.gates.indexOf(r.gt); if (i >= 0) r.sim.gates.splice(i, 1); gateReg.delete(key); }
  for (const [key, g] of rail.gates) { if (gateReg.has(key)) continue; for (const sim of sims) { const rd = sim.road, s = rd.closestS(g.x, g.z, 0), q = rd.at(s, tmpP); if (Math.hypot(q.x - g.x, q.z - g.z) < 12) { const gt = { s, along: g.along, closed: g.closed }; sim.gates.push(gt); gateReg.set(key, { sim, gt }); break; } } }
}
/* the readout on an India drive: the road you are on, the next city ahead and how far (real km), and, with a destination set, what to do at that city */
function updateRoute() {
  if (!indiaRoute) return; const rec = activeRec; if (!rec) return; const px = phys && mode !== 'fly' ? phys.x : cam.x, pz = phys && mode !== 'fly' ? phys.z : cam.z, arc = rec.road.guideArcSigned(px, pz); if (arc === null) return;
  const net = indiaRoute.net; if (!gps) gps = new Gps({ net, player: () => { const o = phys && mode !== 'fly' ? phys : cam, g = gameFrame(o.x, o.z); return { x: g.x, z: g.z, yaw: o.yaw || 0 }; }, nav: () => ({ dest: navDest, next: gpsNext }), pick: id => setNav(id), names: Object.fromEntries([...net.cities.values()].map(c => [c.id, c.name])), size: touchUI ? 150 : 184 });
  const p = rec.road.at(rec.hint, tmpP), dirS = phys && mode !== 'fly' ? (Math.cos((phys.yaw || 0) - p.th) >= 0 ? 1 : -1) : 1; let nc = null, nd = Infinity, here = null;
  for (const [id, a] of rec.cityAlong) { const d = (a - arc) * dirS; if (d > 40 && d < nd) { nd = d; nc = id; } if (Math.abs(a - arc) < 120) here = id; }
  if (here === 'delhi') { const r1 = net.roads.get(rec.id); enterCity(r1 && r1.nh ? r1.nh.replace(/\s+/g, '') : '', rec.id); }
  { const dA = rec.cityAlong.get('delhi'), near = dA !== undefined && Math.abs(dA - arc) < 800 && !city && !entering && CITY_GATES; enterBtn.style.display = near ? 'block' : 'none'; enterBtn.onclick = () => { if (entering) return; entering = true; toast('Entering Delhi…'); S.enclave = 'delhi'; save(); gateJump('?play&city=delhi&seed=' + encodeURIComponent(config.seed) + '&q=' + quality, 0); }; }       // the button opens the city at its centre (Connaught Place); driving in on the highway uses a gate
  if (here && here !== lastCityToast) { lastCityToast = here; S.city = here; save(); const ch = net.junctionChoices(here).filter(c => c.road !== rec.id).slice(0, 3).map(c => (c.nh || c.name) + ' to ' + c.towardName); toast(CITY[here].name + (HINDI[here] ? ' · ' + HINDI[here] : '') + (ch.length ? '  — also: ' + ch.join(', ') : '')); if (navDest === here) { navDest = null; setTimeout(() => toast('You have arrived in ' + CITY[here].name), 2200); } }
  else if (!here && lastCityToast) lastCityToast = '';
  gpsNext = nc || here;
  const road1 = net.roads.get(rec.id), name = road1 ? (road1.nh ? road1.nh + ' · ' : '') + road1.name : indiaRoute.name; let t = name + (nc ? ' · next: ' + CITY[nc].name + ', ' + Math.max(0, Math.round(nd * 100 / 1000)) + ' km' : ' · end of this road');
  if (navDest && nc) { if (nc === navDest) t += '\n→ ' + CITY[navDest].name + ' is next'; else { const rt = net.route(nc, navDest); if (rt && rt.legs.length) { const l0 = rt.legs[0], r0 = net.roads.get(l0.road); t += '\n→ ' + CITY[navDest].name + ' (' + Math.round(rt.length * 100 / 1000) + ' km): ' + (l0.road === rec.id ? 'keep on this road' : 'at ' + CITY[nc].name + ' take ' + (r0.nh || r0.name) + ' toward ' + CITY[l0.to].name); } else t += '\n→ no road route to ' + CITY[navDest].name; } }
  routeHud.style.display = 'block'; routeHud.style.whiteSpace = 'pre-line'; routeHud.style.borderRadius = '14px'; routeHud.style.textAlign = 'center'; routeHud.textContent = t;
}
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
        if ((autodrive.level === 'full' && Math.abs(input.steer) > 0.25) || input.brake > 0.25 || input.hand > 0.25 || input.rev > 0.25) setAuto(false); else { const hand = input, rec = indiaRoute && activeRec ? activeRec : null; let adRoad = rec ? rec.road : road; adSim = rec ? (rec.te ? rec.te.sim : traffic && traffic.sim) : traffic && traffic.sim; if (cityMode) { adRoad = cityNav.path; adSim = null; autodrive.lookMin = 6; autodrive.forward = true; autodrive.lane = () => -1.5; autodrive.lanes = () => 1; if (!cityNav.active || cityNav.arrived) { setAuto(false); if (cityNav.arrived) arriveT = 2.5; else toast('Autodrive off: no route'); } } if (autodrive.road !== adRoad) { autodrive.road = adRoad; autodrive.s = cityMode ? 0 : rec ? rec.hint : roadS; } input = autodrive.update(phys, adRoad, hand); if (cityMode) { adStuck = Math.abs(phys.u) < 0.4 && input.throttle > 0.5 ? adStuck + dt : 0; if (adStuck > 3) { adStuck = 0; if (cityNav.blockHere(phys.x, phys.z, phys.yaw)) backToRoad(); } } }
      }
      if (cityMode && arriveT > 0) { arriveT -= dt; input = { ...input, throttle: 0, brake: 1 }; }                    // stop at the destination
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
  updateBranches(px, pz, dt); junctionSignals.update();
  if (indiaRoute && indiaRoute.world && !rail && terrain && grid && q.get('rail') !== 'off' && railNet) { const net = indiaRoute.net, g0 = guideWorld(), n0 = net.cities.get(indiaRoute.from), cityList = [...net.cities.values()];
    try { rail = new RailView({ crossings: railCross, tracks: railTracks, scene, terrain, origin: grid.origin, network: railNet, grade: railGrade, book: railBook, roads: [...net.roads.values()].map(r => ({ id: r.id, pts: r.pts, kind: r.kind })), cities: cityList, names: Object.fromEntries(cityList.map(c => [c.id, { en: c.name, hi: HINDI[c.id] || '' }])), toWorld: (gx, gz) => ({ x: gx - n0.x + g0[0], z: gz - n0.z + g0[1] }), toGame: (wx, wz) => ({ x: n0.x + (wx - g0[0]), z: n0.z + (wz - g0[1]) }), control: q.get('control') !== 'off' }); } catch (e) { console.error('RAILVIEW', e && e.stack || e); rail = null; railNet = null; } }
  if (rail) { rail.update(dt, px, pz); updateRailLife(dt, px, pz); }
  if (grid.rebase(px, pz)) { if (city) city.reposition(); if (rail) rail.reposition(); far.reposition(); roadMesh.reposition(); for (const b of branches) b.mesh.reposition(); scatter.reposition(); }
  if (city) { city.transit.footY = mode === 'foot' && foot ? foot.y : city.gy; city.update(px, pz, dt); city.setNight(!!env.lightsOn); updateGateExit(); }  grid.update(px, pz); far.update(px, pz); roadMesh.update(roadS); scatter.update(px, pz); if (holes) holes.set(roadMesh.tunnels.portals(), grid.origin, px, pz, roadMesh.tunnels.W);
  if (traffic) traffic.update(dt, { x: px, z: pz, s: roadS, u: phys ? phys.u : 0, yaw: phys ? phys.yaw : 0 }, env.lightsOn);
  if (peds && traffic) peds.update(dt, { x: px, z: pz, u: mode === 'foot' ? 0 : phys ? phys.u : 0 }, traffic.sim.time);
  if (figure && figure.visible && foot) { figure.position.set(foot.x - grid.origin.x, foot.y, foot.z - grid.origin.z); figure.rotation.y = -foot.yaw + Math.PI / 2; const sw = Math.sin(foot.phase) * (foot.moving ? 0.5 : 0); figure.userData.legs[0].rotation.x = sw; figure.userData.legs[1].rotation.x = -sw; }
  updateActivities(dt, px, pz); updateRoute(); if (gps) { gps.setVisible(mode === 'drive' || mode === 'foot'); gps.update(now); } if (city) updateCityMap(now, dt); updateToll(); updatePrompt();
  if (phys) { view.update(phys, grid.origin); const drive = mode === 'drive';
    view.lights(S.lights === 'on' || (S.lights === 'auto' && env.lightsOn), drive && phys.u > 1 && ((input.brake || 0) > 0.1 || (input.rev || 0) > 0.1 || (input.hand || 0) > 0.1), drive && phys.u < -0.3, dt); }
  boostEase += ((buffT > 0 ? 1 : 0) - boostEase) * Math.min(1, dt * 4);
  if (mode === 'drive' && phys && orbiting()) orbitCam(dt);
  else if (mode === 'drive' && phys) { if (offset) { camera.clearViewOffset(); offset = 0; } view.aim(camera, phys, grid.origin, dt, (x, z) => city ? city.groundAt(x, z) : Math.max(terrain.seaLevel, terrain.drive(x, z)), boostEase); }
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
  if (cityMode && cityNav && phys) { const l = city.pack.lm.get('india-gate'); cityNav.setDest(phys.x, phys.z, { x: l.x, z: l.z, name: 'bench' }, phys.yaw); }       // a city drive needs a route
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

window.__next = { get city() { return city; }, bus, runtime, get peds() { return peds; }, sectors, assetCache, get nav() { return nav; }, fx, get config() { return config; }, get terrain() { return terrain; }, get city() { return city; }, get road() { return road; }, get roadMesh() { return roadMesh; }, get scatter() { return scatter; },
  radio, wheel, get roadS() { return roadS; }, set roadS(v) { roadS = v; }, get mode() { return mode; }, get phys() { return phys; }, get roadSet() { return roadSet; }, get auto() { return auto; }, set auto(v) { auto = v; },
  menu, get landmarks() { return landmarks; }, get branches() { return branches; }, get rail() { return rail; }, get railSamples() { return railSamples; }, autodrive, get activeRec() { return activeRec; }, setNav, get primaryRec() { return primaryRec; }, sectors, get traffic() { return traffic; }, setMode, setVehicle, backToRoad, placeOnRoad, useBuff, get buffT() { return buffT; }, get buffCd() { return buffCd; }, view, env, sound, settings: S, grid, far, cam, camera, controls, renderer, scene, regenerate, encodeConfig, step };

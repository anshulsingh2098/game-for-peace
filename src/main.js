/* Entry point of the new engine (next.html). Phase 3: drive anywhere in the generated world.
   Address options: ?seed=word  ?q=low|med|high  ?c=<share code>  ?debug (stats panel)
   Keys: arrows / W A S D drive, Space buff, C camera, B back to the road, L headlights, M sound, F free-fly camera,
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
import { VEHICLES } from './vehicle/defs.js';
import { VehiclePhysics, vehicleParams, SURFACES } from './vehicle/physics.js';
import { RapierVehicle, initRapier } from './vehicle/rapier-vehicle.js';
import { VehicleView, loadModel } from './vehicle/vehicle.js';
import { applyPaint } from './vehicle/paint.js';
import { Controls } from './input/controls.js';
import { Backdrop } from './env/backdrop.js';
import { Environment } from './env/environment.js';
import { Sound } from './audio/engine.js';
import { Radio } from './audio/radio.js';
import { RadioWheel, logo } from './ui/radiowheel.js';
import { Menu } from './ui/menu.js';
import { LOCATIONS, locationConfig, locationById } from './world/locations.js';
import { Landmarks } from './world/landmarks.js';
import { FlyCam } from './debug/flycam.js';
import { statsPanel } from './debug/stats.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], q = new URLSearchParams(location.search);
const phone = matchMedia('(pointer: coarse)').matches || innerWidth < 500;
const quality = VIEW_PRESETS[q.get('q')] ? q.get('q') : phone ? 'low' : 'med';
let savedLoc = null; try { savedLoc = JSON.parse(localStorage.getItem('gfp-next') || '{}').location || null; } catch (e) { /* no saved choice */ }
let config = (q.get('c') && decodeConfig(q.get('c'))) || locationConfig(q.get('loc') || savedLoc || 'default', q.get('seed') || 'peace');
if (q.get('road')) config.road.style = roadStyleById(q.get('road')).id;                  // ?road=highway|boulevard|dirt|gravel
config.view = { ...config.view, ...VIEW_PRESETS[quality] };
document.body.classList.toggle('debug', q.has('debug')); document.body.classList.toggle('dev', q.has('dev') || q.has('debug')); document.body.classList.toggle('touch', matchMedia('(pointer: coarse)').matches);

const canvas = $('#view'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1 : 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(58, 1, 0.3, 14000);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;      // first-frame reflections; the sky replaces them
const env = new Environment(renderer, scene); let reach = 900;
/* real sun shadows (trees, rocks, the vehicle) on the nearby ground and road; off on the low preset unless ?shadows=on */
const shadowsOn = q.get('shadows') ? q.get('shadows') !== 'off' : quality !== 'low';
renderer.shadowMap.enabled = shadowsOn; renderer.shadowMap.type = THREE.PCFSoftShadowMap; env.setShadows(shadowsOn ? (quality === 'high' ? 4096 : 2048) : 0, quality === 'high' ? 90 : 70);
/* saved choices for this preview */
const saved = (() => { try { return JSON.parse(localStorage.getItem('gfp-next') || '{}'); } catch (e) { return {}; } })();
const S = { time: 'day', weather: 'clear', lights: 'auto', vehicle: 0, muted: false, paint: {}, ...saved }, save = () => { try { localStorage.setItem('gfp-next', JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };
env.setTime(S.time); env.setWeather(S.weather);

const ground = new THREE.MeshLambertMaterial({ vertexColors: true, map: grassTex() });
const ripples = waterNormalTex(), RIP = 0.07;
const waterMat = new THREE.MeshStandardMaterial({ color: 0x1d4a5a, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.9, normalMap: ripples, normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: 1.5 });
/* ripples fade out with distance (beyond a few hundred metres they only alias into a checker pattern) and the surface is calmer far off */
waterMat.onBeforeCompile = sh => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n normal = normalize(mix(nonPerturbedNormal, normal, 1.0 - smoothstep(18.0, 260.0, length(vViewPosition))));');
};
const water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), waterMat); water.renderOrder = 1; scene.add(water);

/* ---------- the world: land, the road through it, and everything drawn from them ---------- */
let terrain, road, roadMesh, scatter, backdrop, landmarks, roadS = 0;
const farView = () => { const v = config.view, f = v.far, reach = v.rings[v.rings.length - 1].r * v.tile;      // far tiles leave out what the near grid is guaranteed to cover
  return { tile: f.tile, rings: [{ r: f.r, res: f.res }], budgetMs: 2, rebase: Infinity, inner: Math.floor(reach / f.tile) - 1, sink: f.sink }; };
function makeWorld() { terrain = createTerrain(config); road = new Road(terrain, config); road.ensure(-2600, 2600); terrain.attachRoad(road); roadS = 0; }
makeWorld();
const grid = new TileGrid(scene, terrain, config.view, ground), far = new TileGrid(scene, terrain.far, farView(), ground); far.origin = grid.origin;
function makeScenery() {
  if (roadMesh) roadMesh.dispose(); if (scatter) scatter.dispose(); if (backdrop) { scene.remove(backdrop.group); backdrop.group.children.forEach(m => { m.geometry.dispose(); m.material.dispose(); }); }
  backdrop = new Backdrop(scene, terrain, config);
  if (landmarks) landmarks.dispose(); landmarks = new Landmarks(scene, terrain, road, config, grid.origin, locationById(config.location).landmarks);       // sights beside the road; they also level the land under them
  roadMesh = new RoadMesh(scene, road, road.style, grid.origin); scatter = new Scatter(scene, terrain, config, grid.origin);
  env.attach({ ground, road: roadMesh.surface }); waterMat.color.set(config.water.color);
}
makeScenery();
function applyView() {
  reach = (far.outer + 0.5) * far.size;
  water.scale.set(reach * 4, 1, reach * 4); water.position.y = terrain.seaLevel; ripples.repeat.set(reach * 4 * RIP, reach * 4 * RIP);
}

/* ---------- the vehicle ---------- */
const cam = new FlyCam(canvas), controls = new Controls(), view = new VehicleView(scene);
const world = { height: (x, z) => terrain.drive(x, z), surface: (x, z) => terrain.surface(x, z), near: (x, z, r) => landmarks ? scatter.near(x, z, r).concat(landmarks.near(x, z, r)) : scatter.near(x, z, r), get seaLevel() { return terrain.seaLevel; },
  grip: key => (1 - env.w.wet * (key === 'asphalt' ? 0.26 : 0.12)) * (1 - env.w.snow * 0.45) };       // rain makes the road slippery; lying snow more so
const sound = new Sound();
const unlockAudio = () => { if (!sound.ctx) { sound.init(); sound.music = 0; sound.sfx = S.muted ? 0 : 0.6; sound.applyVolumes(); } sound.resume(); };      // browsers only allow sound after a key or tap
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, unlockAudio, { passive: true });
document.addEventListener('visibilitychange', () => { if (!sound.ctx) return; if (document.hidden) sound.ctx.suspend(); else sound.resume(); });
let mode = 'drive', vehicle = Math.max(0, Math.min(VEHICLES.length - 1, S.vehicle | 0)), phys = null, rideYaw = 0, auto = null, input = { steer: 0, throttle: 0, brake: 0 }, buffT = 0, buffCd = 0, boostEase = 0;      // mode: 'drive', 'fly' (free camera) or 'ride' (camera glides along the road)
let menu = null; const frozen = () => !!(menu && menu.open);
let rapier = false; const rapierReady = q.get('phys') === 'old' ? Promise.resolve() : initRapier().then(() => { rapier = true; }).catch(e => console.warn('Rapier did not load; using the simple physics', e));
/* put the vehicle in the left lane at road distance s, facing along the road */
function placeOnRoad(s) { const p = road.at(s, {}); phys.reset(p.x + p.tz * 2, p.z - p.tx * 2, p.th); view.camYaw = null; }
async function setVehicle(i) {
  const def = VEHICLES[i], model = await loadModel(def), old = phys; vehicle = i; await rapierReady;
  const par = vehicleParams(def.body, def.stats);
  if (old && old.free) old.free();
  phys = rapier ? new RapierVehicle(par, def.id, world) : new VehiclePhysics(par, world); if (phys.setManual) phys.setManual(!!S.manual); phys.steerGain = S.steering || 1.3;                       // Rapier ray-cast vehicle; the old bicycle model remains as a fallback (?phys=old)
  if (old) { phys.reset(old.x, old.z, old.yaw); } else placeOnRoad(0);
  buffT = 0; buffCd = 0; $('#buff').firstChild.textContent = def.buff.label; $('#buff').title = def.buff.name + ': ' + def.buff.desc + ' (Space)';
  if (S.paint[def.id] && S.paint[def.id] !== def.paint.colors[0]) await applyPaint(def, model, S.paint[def.id]);
  buildSwatches(def, model);
  view.realShadow = shadowsOn; view.setModel(def, model); $$('#vehicles button').forEach((b, k) => b.classList.toggle('on', k === i)); document.documentElement.style.setProperty('--accent', def.color);
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
function setMode(m) {
  if (m === 'fly' && phys) { cam.x = phys.x - Math.cos(phys.yaw) * 14; cam.z = phys.z - Math.sin(phys.yaw) * 14; cam.y = phys.y + 7; cam.yaw = -Math.PI / 2 - phys.yaw; cam.pitch = -0.25; }
  if (m === 'ride') { roadS = road.closestS(phys ? phys.x : cam.x, phys ? phys.z : cam.z, roadS); rideYaw = phys ? -Math.PI / 2 - phys.yaw : cam.yaw; cam.speed = Math.min(cam.speed, 40); }
  if (m === 'drive' && mode === 'ride' && phys) placeOnRoad(roadS);
  mode = m; controls.enabled = m === 'drive'; document.body.dataset.mode = m; view.root.visible = m !== 'ride'; sound.setEngineOn(m === 'drive' && !frozen());
  $('#fly').classList.toggle('on', m === 'fly'); $('#ride').classList.toggle('on', m === 'ride');
}
function regenerate(seed, locId) {
  if (locId) config = { ...locationConfig(locId, seed), view: config.view }; else config = makeConfig({ ...config, seed }); makeWorld(); grid.reset(terrain, config.view); far.reset(terrain.far, farView()); makeScenery(); applyView();
  if (phys) placeOnRoad(0); setMode('drive');
  $('#seed').value = seed; history.replaceState(null, '', '?seed=' + encodeURIComponent(seed) + '&loc=' + config.location + '&q=' + quality + (q.has('debug') ? '&debug' : ''));
}
let toastT; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800); }

/* ---------- screen controls ---------- */
applyView(); $('#seed').value = config.seed;
$('#seedForm').addEventListener('submit', e => { e.preventDefault(); regenerate($('#seed').value.trim() || 'peace'); $('#seed').blur(); });
$('#newSeed').addEventListener('click', () => regenerate(randomSeed()));
$$('#vehicles button').forEach((b, i) => b.addEventListener('click', () => { setVehicle(i); b.blur(); }));
const toggleView = () => { view.setView(view.view === 'first' ? 'third' : 'first'); toast(view.view === 'first' ? 'Driver view' : 'Chase view'); };
$('#viewBtn').addEventListener('click', toggleView); $('#reset').addEventListener('click', backToRoad);
$('#fly').addEventListener('click', () => setMode(mode === 'fly' ? 'drive' : 'fly')); $('#ride').addEventListener('click', () => setMode(mode === 'ride' ? 'drive' : 'ride'));
/* gearbox: automatic or manual, and shifting (E up, Z down, N switches; gamepad bumpers; on-screen buttons) */
const setManual = on => { S.manual = !!on; save(); if (phys && phys.setManual) phys.setManual(S.manual); document.body.classList.toggle('manual', S.manual); toast(S.manual ? 'Manual gearbox: E up, Z down' : 'Automatic gearbox'); };
const shiftGear = d => { if (frozen() || mode !== 'drive' || !phys || !phys.shift || !S.manual) return; if (!phys.shift(d) && d < 0 && phys.u > 2) toast('Too fast for that gear'); };
document.body.classList.toggle('manual', !!S.manual); controls.bindShift($('#gUp'), $('#gDn'));
controls.on('shiftUp', () => shiftGear(+1)); controls.on('shiftDown', () => shiftGear(-1)); controls.on('gearbox', () => { if (!frozen() && mode === 'drive') setManual(!S.manual); });
controls.on('view', toggleView); controls.on('reset', backToRoad); controls.on('buff', useBuff); $('#buff').addEventListener('pointerdown', e => { e.preventDefault(); useBuff(); }); controls.on('fly', () => setMode(mode === 'fly' ? 'drive' : 'fly'));
controls.bindPads($$('.pad'));
$('#time').value = S.time; $('#weather').value = S.weather;
$('#time').addEventListener('change', e => { S.time = e.target.value; save(); env.setTime(S.time); e.target.blur(); });
$('#weather').addEventListener('change', e => { S.weather = e.target.value; save(); env.setWeather(S.weather); e.target.blur(); });
const cycleLights = () => { const o = ['auto', 'on', 'off']; S.lights = o[(o.indexOf(S.lights) + 1) % 3]; save(); toast('Headlights: ' + S.lights); };
/* live radio: a stream in its own <audio> element, a wheel to pick the station, and a chip that names what is playing */
const radio = new Radio(), nowEl = $('#now'); let nowT;
radio.setVolume(S.radioVol ?? 0.6); radio.setMuted(S.muted);
const wheel = new RadioWheel(radio, { locked: v => { controls.locked = v || frozen(); }, onAdd: n => toast('Added ' + n + (n > 1 ? ' songs' : ' song') + ' to My music'), onTune: (i, kind) => {
  const st = kind === 'local' ? radio.localStation(i) : radio.stations[i]; S.station = i >= 0 && kind !== 'local' && st ? st.id : null; save(); unlockAudio();
  if (i === -2) { toast('Radio off'); return; }
  if (!st) return; nowEl.textContent = ''; nowEl.appendChild(logo(st));
  const t = document.createElement('span'); t.innerHTML = '<b></b><small></small>'; t.firstChild.textContent = st.name; t.lastChild.textContent = st.genre + ' · ' + st.region; nowEl.appendChild(t);
  nowEl.classList.add('on'); clearTimeout(nowT); nowT = setTimeout(() => nowEl.classList.remove('on'), 4000); } });
radio.on(s => { if (s.error && s.station) toast(s.station.name + ' is off air'); else if (s.error && s.trackInfo) toast('Cannot play ' + s.trackInfo.title); S.radioVol = s.vol; });
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
  state: () => ({ steering: S.steering || 1.3, manual: !!S.manual, location: config.location, vehicle, paint: S.paint, time: S.time, weather: S.weather, quality, shadows: shadowsOn, lights: S.lights, muted: S.muted, radioVol: radio.vol }),
  pickVehicle: async i => { await setVehicle(i); },
  paint: async (i, c) => { const def = VEHICLES[i]; S.paint[def.id] = c; save(); await applyPaint(def, await loadModel(def), c); },
  set: (k, v) => {
    if (k === 'time') { S.time = v; save(); env.setTime(v); } else if (k === 'weather') { S.weather = v; save(); env.setWeather(v); } else if (k === 'lights') { S.lights = v; save(); }
    else if (k === 'sfx') { S.muted = v === 'off'; save(); radio.setMuted(S.muted); if (sound.ctx) { sound.sfx = S.muted ? 0 : 0.6; sound.applyVolumes(); } }
    else if (k === 'manual') setManual(v === 'manual');
    else if (k === 'steering') { S.steering = +v; save(); if (phys) phys.steerGain = S.steering; }
    else if (k === 'radioVol') radio.setVolume(v); else if (k === 'quality') reloadWith('q', v); else if (k === 'shadows') reloadWith('shadows', v);
  },
  locations: LOCATIONS, setLocation: id => setLocation(id), music: { count: () => radio.local.length, add: files => wheel.add(files), clear: () => { radio.clearLocal(); toast('My music cleared'); } }, radio: () => wheel.toggle(), newWorld: () => regenerate(randomSeed()), toRoad: () => backToRoad(),
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
function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const stats = statsPanel($('#stats'), renderer, () => {
  const s = grid.stats(), f = far.stats(), sc = scatter.stats();
  return ['tiles       ' + s.tiles + '  (' + s.lod.join(' / ') + ' by detail)   far ' + f.tiles, 'build queue ' + (s.queue + f.queue + sc.queue) + '   pooled ' + (s.pooled + f.pooled) + '   built ' + (s.built + f.built),
    'scenery     ' + sc.things.toLocaleString('en-US') + ' in ' + sc.tiles + ' tiles   road pieces ' + roadMesh.pieces.size,
    'road        at ' + (roadS / 1000).toFixed(2) + ' km   built ' + (road.sMin / 1000).toFixed(1) + ' .. ' + (road.sMax / 1000).toFixed(1) + ' km',
    'origin      ' + grid.origin.x + ', ' + grid.origin.z + '   mode ' + mode,
    phys ? 'vehicle     u ' + phys.u.toFixed(1) + '  v ' + phys.v.toFixed(2) + '  r ' + phys.r.toFixed(2) + '  slip ' + phys.slip.toFixed(2) + '  ' + phys.surface : '', 'seed        ' + config.seed + '   quality ' + quality];
});
const hud = { spd: $('#spd'), unit: $('#unit'), surf: $('#surface'), sky: $('#sky'), buff: $('#buff'), cd: $('#buffCd'), gear: $('#gear'), rpm: $('#rpm i') }; let hudT = 0;

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

/* ---------- one frame of the world: move, keep road and tiles built around the player, draw ---------- */
const rp = {}; let last = performance.now();
function frame(now) { requestAnimationFrame(frame); step(Math.min(0.05, (now - last) / 1000), now); last = now; }
function step(dt, now) {
  WIND.t.value = now / 1000; let px, pz;
  if (mode === 'drive' && phys) {
    if (!frozen()) {
      input = auto || controls.read(); phys.step(dt, input);
      if (buffT > 0) { buffT -= dt; if (buffT <= 0) phys.setMod(null); } buffCd = Math.max(0, buffCd - dt);
      if (phys.stuck > 1.5) backToRoad();
    }
    px = phys.x; pz = phys.z; roadS = road.closestS(px, pz, roadS);
  } else if (mode === 'ride') {
    roadS += Math.min(cam.speed, 90) * dt; road.at(roadS, rp);
    cam.x = rp.x + rp.tz * 2; cam.z = rp.z - rp.tx * 2; cam.y = rp.y + 1.6;
    const want = Math.atan2(-rp.tx, -rp.tz); rideYaw += Math.atan2(Math.sin(want - rideYaw), Math.cos(want - rideYaw)) * Math.min(1, dt * 4);
    cam.yaw = rideYaw; cam.pitch += (Math.atan(rp.slope) * 0.8 - 0.04 - cam.pitch) * Math.min(1, dt * 3); px = cam.x; pz = cam.z;
  } else {
    cam.update(dt, (x, z) => Math.max(terrain.seaLevel, terrain.height(x, z)) + 1.7); px = cam.x; pz = cam.z; roadS = road.closestS(px, pz, roadS);
  }
  const box = road.ensure(roadS - 2600, roadS + 2600); if (box) grid.invalidate(box);        // the road keeps growing ahead of you, in both directions
  if (grid.rebase(px, pz)) { far.reposition(); roadMesh.reposition(); scatter.reposition(); }
  grid.update(px, pz); far.update(px, pz); roadMesh.update(roadS); scatter.update(px, pz);
  if (phys) { view.update(phys, grid.origin); const drive = mode === 'drive';
    view.lights(S.lights === 'on' || (S.lights === 'auto' && env.lightsOn), drive && input.brake > 0.1 && phys.u > 1, drive && phys.u < -0.3, dt); }
  boostEase += ((buffT > 0 ? 1 : 0) - boostEase) * Math.min(1, dt * 4);
  if (mode === 'drive' && phys && orbiting()) orbitCam(dt);
  else if (mode === 'drive' && phys) { if (offset) { camera.clearViewOffset(); offset = 0; } view.aim(camera, phys, grid.origin, dt, (x, z) => Math.max(terrain.seaLevel, terrain.height(x, z)), boostEase); }
  else { cam.apply(camera, grid.origin); camera.fov = 58; camera.updateProjectionMatrix(); }
  water.position.x = camera.position.x; water.position.z = camera.position.z;
  ripples.offset.set(((camera.position.x + grid.origin.x) * RIP + now * 0.000011) % 1, (-(camera.position.z + grid.origin.z) * RIP + now * 0.000007) % 1);     // ripples stay fixed to the world while the sheet follows the camera
  env.update(dt, now, camera, reach); landmarks.update(grid.origin, env.lightsOn); backdrop.update(camera, camera.position.x + grid.origin.x, camera.position.z + grid.origin.z, env);
  if (mode === 'drive' && phys && sound.ctx) sound.update({ v: Math.abs(phys.u), rev: phys.u < -0.3, top: phys.p.top, throttle: input.throttle || 0.06, rain: env.w.rain, flash: env.flash, buff: buffT > 0,
    id: VEHICLES[vehicle].id, brake: input.brake > 0.1 && phys.u > 1, off: phys.surface !== 'asphalt', view: view.view, rev: phys.hasGears ? phys.rev01 : undefined, gear: phys.hasGears ? phys.gear : undefined });
  renderer.render(scene, camera); stats(now);
  if (phys && now - hudT > 100) { hudT = now; hud.spd.textContent = Math.round(Math.abs(phys.kmh)); hud.unit.textContent = phys.u < -0.5 ? 'R · km/h' : 'km/h'; hud.surf.textContent = phys.wet > 0.3 ? 'Water' : SURFACES[phys.surface].name; hud.sky.textContent = env.label; hud.gear.textContent = phys.hasGears ? phys.gearLabel : ''; hud.rpm.style.width = phys.hasGears ? Math.round(Math.min(1, phys.rpm01) * 100) + '%' : '0%'; hud.rpm.parentNode.classList.toggle('hot', !!phys.hasGears && phys.rpm01 > 0.92);
    hud.buff.classList.toggle('active', buffT > 0); hud.buff.classList.toggle('cooling', buffT <= 0 && buffCd > 0); hud.cd.textContent = buffT > 0 ? '' : buffCd > 0 ? Math.ceil(buffCd) + 's' : ''; }
}
setVehicle(vehicle).then(() => { setMode('drive'); if (!q.has('play')) menu.show('title'); requestAnimationFrame(frame); }).catch(e => { console.error(e); toast('Could not load the vehicle'); setMode('fly'); requestAnimationFrame(frame); });

window.__next = { get config() { return config; }, get terrain() { return terrain; }, get road() { return road; }, get roadMesh() { return roadMesh; }, get scatter() { return scatter; },
  radio, wheel, get roadS() { return roadS; }, set roadS(v) { roadS = v; }, get mode() { return mode; }, get phys() { return phys; }, get auto() { return auto; }, set auto(v) { auto = v; },
  menu, get landmarks() { return landmarks; }, setMode, setVehicle, backToRoad, placeOnRoad, useBuff, get buffT() { return buffT; }, get buffCd() { return buffCd; }, view, env, sound, settings: S, grid, far, cam, camera, controls, renderer, scene, regenerate, encodeConfig, step };

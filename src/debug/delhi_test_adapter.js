/* Delhi QA test adapter (Phase T1, docs/DELHI_QA_T0.md). Development only: nothing in the game imports this file, so a normal or bundled build never contains it. A test (or a person) loads it from the page console of an UNBUNDLED server:
     await import('/src/debug/delhi_test_adapter.js')          on an address with  ?dev&testdrive=1  (for example  /?play&at=delhi&dev&testdrive=1&q=low)
   and gets window.__test. Without both flags the import does nothing and returns { installed: false }.
   It wraps what the game already exposes (window.__next, __where, __cityNav, __cam). It has no physics, no router and no input path of its own: controls are keyboard events the game's own input handler reads, routes come from the game's CityRouter, driving on a route is the game's autodrive. Anything the game does not expose is reported as null ("unavailable"), never invented. */
const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const ON = q.has('dev') && q.get('testdrive') === '1';
const wait = ms => new Promise(r => setTimeout(r, ms));
const K = Math.PI / 180, RE = 6371008.8;
const KEYS = { throttle: 'KeyW', brake: 'KeyS', left: 'KeyA', right: 'KeyD', handbrake: 'Space' };

function install() {
  if (!ON) return { installed: false, reason: 'needs ?dev&testdrive=1' };
  if (window.__test) return { installed: true, again: true };
  const N = () => window.__next, P = () => N() && N().phys, C = () => N() && N().city, round = (v, d = 1) => typeof v === 'number' ? +v.toFixed(d) : v;

  /* frame times from the page's own animation frames (visible tab only: a hidden tab reports nothing useful) */
  const frames = { t: [], last: performance.now(), on: true };
  const tick = now => { if (frames.on) { frames.t.push(now - frames.last); if (frames.t.length > 6000) frames.t.shift(); } frames.last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const pct = (arr, f) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return round(s[Math.min(s.length - 1, Math.floor(s.length * f))], 1); };
  const frameStats = (from = 0) => { const a = frames.t.slice(from); return { n: a.length, p50Ms: pct(a, 0.5), p95Ms: pct(a, 0.95), p99Ms: pct(a, 0.99), worstMs: a.length ? round(Math.max(...a), 1) : null, over50Ms: a.filter(x => x > 50).length, hidden: document.hidden }; };

  /* console errors and page errors while a test runs */
  const errors = []; addEventListener('error', e => errors.push('error: ' + e.message)); addEventListener('unhandledrejection', e => errors.push('rejection: ' + (e.reason && e.reason.message || e.reason)));
  const ce = console.error; console.error = (...a) => { errors.push('console.error: ' + a.map(String).join(' ').slice(0, 200)); ce.apply(console, a); };

  const held = new Set();
  const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
  const release = () => { for (const c of [...held]) { key(c, false); held.delete(c); } };

  const toXZ = p => {
    const c = C(), pk = c && c.pack;
    if (p.landmarkId) { const l = pk && pk.lm && pk.lm.get(p.landmarkId); if (!l) throw new Error('unknown landmark ' + p.landmarkId); return { x: l.x, z: l.z, name: p.landmarkId }; }
    if (p.lat !== undefined) { const O = pk.M.origin; return { x: (p.lon - O.lon) * RE * Math.cos(O.lat * K) * K, z: -(p.lat - O.lat) * RE * K, name: 'lat/lon' }; }    // the pack's own flat mapping (see main.js where())
    if (p.x !== undefined) return { x: p.x, z: p.z, name: 'x/z' };
    throw new Error('give {landmarkId}, {lat,lon} or {x,z}');
  };

  const api = {
    installed: true,
    /* the scene, the city pack and the car exist */
    ready() {
      const n = N(), ph = P(), c = C(); const ok = !!(n && ph && c && c.pack && window.__cityNav && window.__cityNav.router);
      return { ok, city: c ? 'delhi' : null, mode: n && n.mode, quality: q.get('q') || null, seed: n && n.config && n.config.seed || null, buildSha: null /* the page does not expose one */, url: location.href, hidden: document.hidden, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, ua: navigator.userAgent };
    },
    /* wait (default 120 s: a cold cache downloads the Delhi pack) until ready() is true */
    async whenReady(seconds = 120) { const t0 = performance.now(); while (performance.now() - t0 < seconds * 1000) { if (api.ready().ok) return api.ready(); await wait(500); } return api.ready(); },
    /* put the car on the nearest street (the game's own nearestStreet and reset); rejects a point more than 40 m from any street */
    setSpawn(p, yaw, maxM = 40) {                                                  // maxM: a landmark's centre can be on a plaza far from any street; pass a larger value on purpose
      const { x, z } = toXZ(p), st = C().nearestStreet(x, z); if (!st || st.d > maxM) return { ok: false, reason: 'no street within ' + maxM + ' m of that point (nearest ' + (st ? Math.round(st.d) + ' m' : 'none') + ')' };
      release(); const ph = P(); ph.reset(st.x, st.z, yaw !== undefined ? yaw : st.yaw); if (window.__cityNav) window.__cityNav.setDest(0, 0, null); return { ok: true, at: { x: round(st.x), z: round(st.z) }, snappedM: round(st.d) };
    },
    /* fixed camera: puts the game in fly mode exactly there (window.__cam). Return to the car with returnToCar() */
    setCamera({ x, y, z, yaw = 0, pitch = -0.3 }) { return window.__cam(x, y, z, yaw, pitch); },
    returnToCar() { N().setMode('drive'); },
    /* digital controls through the game's own keyboard handler, held for `ms` of real time then released */
    async setControls({ steer = 0, throttle = 0, brake = 0, handbrake = 0 }, ms = 500) {
      const want = []; if (throttle > 0.1) want.push(KEYS.throttle); if (brake > 0.1) want.push(KEYS.brake); if (steer < -0.1) want.push(KEYS.left); if (steer > 0.1) want.push(KEYS.right); if (handbrake > 0.1) want.push(KEYS.handbrake);
      for (const c of want) { key(c, true); held.add(c); } await wait(ms); release(); return api.telemetry();
    },
    /* the route the game itself plans from the car to a place; null if there is none */
    plan(to) {
      const t = toXZ(to), ph = P(), r = window.__cityNav.router.plan(ph.x, ph.z, ph.yaw, t.x, t.z); if (!r) return { ok: false, reason: 'no drivable route' };
      return { ok: true, metres: Math.round(r.metres), seconds: Math.round(r.seconds), nodes: r.nodes.length, edges: r.edges.length, steps: r.steps.map(s => ({ dist: Math.round(s.dist), text: s.text })) };
    },
    /* drive a route with the game's autodrive and report; stops at arrival, at maxSeconds, or when the car has not moved for 25 s (a red signal or a queue can hold it for 20 s, so a shorter limit would report a false stall) */
    async followRoute(to, { maxSeconds = 240, sampleMs = 500, onSample } = {}) {
      const t = toXZ(to), ph = P(), nav = window.__cityNav, n = N(); const f0 = frames.t.length, e0 = errors.length;
      nav.setDest(ph.x, ph.z, { x: t.x, z: t.z, name: t.name }, ph.yaw); if (!nav.route) return { ok: false, reason: 'no drivable route to ' + t.name };
      const plan = { metres: Math.round(nav.route.metres), steps: nav.steps.map(s => ({ dist: Math.round(s.dist), text: s.text })) };
      if (!n.autodrive.enabled) document.querySelector('#autoBtn').click(); if (!n.autodrive.enabled) return { ok: false, reason: 'autodrive did not start' };
      const samples = [], t0 = performance.now(); let still = 0, last = null, arrived = false, minGround = 1, maxDy = 0, dist = 0, rerouted = 0, stepSeen = new Set(), minY = Infinity, maxY = -Infinity, below = 0, maxSlope = 0, slopeAt = null;
      while (performance.now() - t0 < maxSeconds * 1000) {
        await wait(sampleMs); const s = api.telemetry(); samples.push(s);
        if (last) { const d = Math.hypot(s.x - last.x, s.z - last.z); dist += d; maxDy = Math.max(maxDy, Math.abs(s.y - last.y)); if (d > 2) { const sl = Math.abs(s.y - last.y) / d; if (sl > maxSlope) { maxSlope = sl; slopeAt = { x: s.x, z: s.z, dy: round(s.y - last.y, 2), dM: round(d, 1), street: s.street }; } } still = d < 0.3 ? still + sampleMs / 1000 : 0; }
        minGround = Math.min(minGround, s.grounded === null ? 1 : s.grounded); minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y); if (s.groundY !== null && s.y < s.groundY - 1.5) below++; if (nav.si !== undefined) stepSeen.add(nav.si); if (s.routeState && s.routeState.offRoute > 0) rerouted++;
        last = s; if (onSample) onSample(s); if (nav.arrived) { arrived = true; break; } if (still > 25) break;
      }
      if (n.autodrive.enabled) document.querySelector('#autoBtn').click(); if (n.autodrive.enabled) document.querySelector('#autoBtn').click();    // cycle full -> cruise -> off
      release(); const end = api.telemetry();
      return { ok: arrived, arrived, stuck: still > 25, seconds: round((performance.now() - t0) / 1000), driveMetres: Math.round(dist), plan, endsNear: { x: end.x, z: end.z, street: end.street }, distToTargetM: Math.round(Math.hypot(end.x - t.x, end.z - t.z)), minGrounded: minGround, maxStepDy: round(maxDy, 2), maxSlope: round(maxSlope, 3), slopeAt, yRange: [round(minY, 1), round(maxY, 1)], samplesBelowGround: below, stepsReached: stepSeen.size, frames: frameStats(f0), errors: errors.slice(e0), samples: samples.length, firstSamples: samples.slice(0, 3) };
    },
    /* the game's own time of day and weather, frozen: 'dawn'|'day'|'dusk'|'night' and 'clear'|'overcast'|'fog'|'rain'|'storm' */
    setConditions({ time, weather }) { const e = N().env; if (time) e.setTime(time); if (weather) e.setWeather(weather); return { time, weather }; },
    /* one fixture of tools/delhi_test_routes.json, driven: spawn on its start (facing the way the route leaves), drive its route, and judge the report with the detectors below.
       Detectors: arrival; no car below the ground by 1.5 m; no road slope above 25 % between two samples (a height step over a stretch the car actually covered: a frame stall that makes the car cover little ground does not count; the ramps are meant to be about 8 to 12 %); wheel contact never under 0.5; no console error; not stalled; the layer run reaches a height (flyover: above the start by 3 m or more; underpass or tunnel: 3 m or more below). */
    async runFixture(id, { time, weather, maxSeconds } = {}) {
      const FX = await fetch('/tools/delhi_test_routes.json', { cache: 'no-store' }).then(r => r.json()), f = FX.fixtures.find(x => x.id === id); if (!f) return { ok: false, reason: 'no fixture ' + id };
      if (time || weather) api.setConditions({ time, weather }); api.reset(); const t = toXZ(f.to), a = toXZ(f.from); let st = C().nearestStreet(a.x, a.z);
      if (!st || st.d > (f.spawnSnapM || 40)) { P().reset(a.x, a.z, 0); const t0 = performance.now(); while (performance.now() - t0 < 60000) { await wait(1000); st = C().nearestStreet(a.x, a.z); if (st && st.d <= (f.spawnSnapM || 40)) break; } }   /* the city streams in only around the car: put the car at the start (a spawn, not a drive) and wait for its tiles */
      if (!st || st.d > (f.spawnSnapM || 40)) return { ok: false, reason: 'start is ' + (st ? Math.round(st.d) : '?') + ' m from a street after 60 s of loading' }; await wait(4000);
      const ph0 = P(); ph0.reset(st.x, st.z, st.yaw); const pl = window.__cityNav.router.plan(st.x, st.z, st.yaw, t.x, t.z); let yaw = st.yaw;
      if (pl && pl.poly && pl.poly.length >= 4) { let k = 2; while (k < pl.poly.length - 2 && Math.hypot(pl.poly[k] - st.x, pl.poly[k + 1] - st.z) < 5) k += 2; yaw = Math.atan2(-(pl.poly[k] - st.x), -(pl.poly[k + 1] - st.z)); }
      ph0.reset(st.x, st.z, yaw); await wait(600); const y0 = P().y, rep = await api.followRoute(f.to, { maxSeconds: Math.max(maxSeconds || f.maxSeconds || 240, pl ? pl.metres / 4 : 0) }), v = [];      // at least 4 m/s on average: city traffic and signals slow the autodrive a lot
      const add = (name, ok, detail) => v.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
      add('arrived', rep.arrived, 'ends ' + rep.distToTargetM + ' m from the target'); add('no car below the ground', rep.samplesBelowGround === 0, rep.samplesBelowGround + ' samples'); add('no road slope above 25 %', rep.maxSlope <= 0.25, 'steepest ' + Math.round(rep.maxSlope * 100) + ' % (' + rep.maxStepDy + ' m largest step) ' + JSON.stringify(rep.slopeAt)); add('wheels stay on the road', rep.minGrounded >= 0.5, 'minimum contact ' + rep.minGrounded);
      add('no console or page errors', rep.errors.length === 0, rep.errors.slice(0, 2).join(' | ')); add('not stalled', !rep.stuck, rep.stuck ? 'no movement for 25 s' : 'moving');
      if (f.expect && f.expect.layer > 0) add('flyover deck reached (3 m or more above the start)', rep.yRange[1] - y0 >= 3, 'start y ' + round(y0, 1) + ', highest ' + rep.yRange[1]);
      if (f.expect && f.expect.layer < 0) add('underpass or tunnel floor reached (3 m or more below the start)', y0 - rep.yRange[0] >= 3, 'start y ' + round(y0, 1) + ', lowest ' + rep.yRange[0]);
      return { id, conditions: { time: time || 'unchanged', weather: weather || 'unchanged' }, verdict: v.every(x => x.status === 'PASS') ? 'PASS' : (!rep.arrived && !rep.stuck && rep.samplesBelowGround === 0 && rep.maxSlope <= 0.25 && rep.errors.length === 0 ? 'INCONCLUSIVE (time ran out before arrival; nothing else failed)' : 'FAIL'), checks: v, report: { ...rep, firstSamples: undefined, plan: { metres: rep.plan && rep.plan.metres } }, when: new Date().toISOString(), frameNote: 'visible tab on the machine that ran it: not device performance' };
    },
    /* one reading; a field the game does not expose is null */
    telemetry() {
      const ph = P(), n = N(), c = C(); if (!ph) return null; const w = window.__where(), st = c && c.nearestStreet && c.nearestStreet(ph.x, ph.z), G = c && c.pack.G, nav = window.__cityNav;
      const nm = st && G && G.names && G.name ? G.names[G.name[st.id]] : null, wheels = ph.wheelStates, ri = n.renderer.info;
      return { x: w.x, y: round(ph.y, 2), z: w.z, lat: round(w.lat, 6), lon: round(w.lon, 6), headingDeg: w.hdg, speedKmh: round(ph.u * 3.6), edgeId: st ? st.id : null, edgeDistM: st ? round(st.d) : null, street: nm ? (typeof nm === 'string' ? nm : nm.en || nm.ref || '') : null, roadLevel: null /* not exposed: C1 surfaceAt is not built */, surface: ph.surface || null, grounded: wheels ? round(wheels.filter(x => x.contact).length / wheels.length, 2) : null, groundY: round(ph.groundY, 2), impact: round(ph.impact, 2), stuck: ph.stuck || 0,
        routeState: nav ? { active: !!nav.active, arrived: !!nav.arrived, step: nav.si, off: round(nav.off || 0, 1), offRoute: nav.off > 3 ? 1 : 0 } : null, mode: n.mode, autodrive: !!(n.autodrive && n.autodrive.enabled),
        drawCalls: ri.render.calls, triangles: ri.render.triangles, geometries: ri.memory.geometries, textures: ri.memory.textures, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, frame: frameStats(Math.max(0, frames.t.length - 120)), errors: errors.length, hidden: document.hidden };
    },
    /* metadata for a screenshot; the pane or runner takes the picture itself (this file cannot read the canvas on its own) */
    capture(name, extra = {}) { return { name, at: new Date().toISOString(), ...extra, telemetry: api.telemetry(), ready: api.ready() }; },
    frameStats,
    errors: () => errors.slice(),
    reset() { release(); frames.t.length = 0; errors.length = 0; if (window.__cityNav) window.__cityNav.setDest(0, 0, null); const n = N(); if (n && n.autodrive && n.autodrive.enabled) document.querySelector('#autoBtn').click(); if (n && n.autodrive && n.autodrive.enabled) document.querySelector('#autoBtn').click(); return { ok: true }; },
  };
  window.__test = api; return { installed: true };
}
export const status = install();
export default status;

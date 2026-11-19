# Delhi automated gameplay testing (Phase T1: the test adapter)

Plan and reasons: `docs/DELHI_QA_T0.md`. Code: `src/debug/delhi_test_adapter.js` (development only; **nothing in the game imports it**, so a normal or bundled build never contains it, and no shared file such as `src/main.js` was changed).

## Use
1. Serve the project unbundled: `python3 tools/serve.py 8791`.
2. Open `http://localhost:8791/?play&at=delhi&dev&testdrive=1&q=low` (both `dev` and `testdrive=1` are needed).
3. In the page console (or from a browser tool), once: `await import('/src/debug/delhi_test_adapter.js')`. Without both flags it returns `{installed:false}` and does nothing. It gives `window.__test`.
4. If the import says "Failed to fetch": a service worker from an earlier visit is in the way. Run `for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); location.reload()`.

## Calls (all on `window.__test`)
| Call | What it does |
|---|---|
| `ready()` / `await whenReady(seconds)` | scene, Delhi pack, car and the game's router exist. A cold cache downloads about 100 MB first, so allow a minute or two |
| `setSpawn({landmarkId} or {lat,lon} or {x,z}, yaw?, maxM = 40)` | the game's own `nearestStreet` and `phys.reset`; refuses a point farther than `maxM` from any street (a landmark centre can be 120 m from one: pass `maxM` on purpose) |
| `setCamera({x,y,z,yaw,pitch})`, `returnToCar()` | the game's `__cam` fly view, and back |
| `await setControls({steer,throttle,brake,handbrake}, ms)` | holds W, A, S, D or Space as keyboard events through the game's own input handler, then releases (digital, not analogue) |
| `plan({landmarkId} ...)` | the game's `CityRouter.plan` from the car: metres, seconds, nodes, turn steps |
| `await followRoute(to, {maxSeconds, sampleMs, onSample})` | sets the route and drives it with the game's own autodrive; stops at arrival, at `maxSeconds`, or after 25 s without moving; returns a report (arrived, metres driven, minimum wheel contact, largest height step between samples, frame stats, console errors, route steps reached) |
| `telemetry()` | position, lat, lon, heading, speed, street and edge id, surface, wheel contact, ground height, impact, route state, draw calls, triangles, heap, recent frame times, error count. A field the game does not expose is `null` (`roadLevel`, `buildSha` today) |
| `capture(name, extra)` | the metadata record for a screenshot (the pane or runner takes the picture; this file cannot read the canvas) |
| `frameStats()`, `errors()`, `reset()` | frame percentiles (and hitches over 50 ms), page and console errors, release keys and clear the route and autodrive |

## Known limits (read before trusting a number)
- Frame times come from a visible tab on whatever machine runs it. A hidden tab, a laptop, or a Mac is not a phone. Do not quote them as device performance.
- Not built yet (T2 and later): the fixture file of verified routes, the failure detectors beyond "fell / jumped / stalled / errors", the runner script, report folders, photo comparison, level-aware crossing checks (needs C1's `surfaceAt`).
- The stall detector cannot tell a red signal from a real stall (it waits 25 s). Treat a "stuck" as something to look at, not as a verdict.
- `followRoute` uses the game's autodrive, so it tests the road, the route and the car, not a person's steering.

## First run (seen, 19 Nov 2026, built-in browser pane, visible tab, `q=low`, DPR 1, 1052 x 664, development Mac)
Spawn near Connaught Place (the snap was 123 m, `maxM` 200), `followRoute({landmarkId:'janpath-market'})`: planned 2,534 m, 7 steps; **arrived 21 m from the board position** after 2,490 m driven in 310 s; wheel contact 1.0 throughout; largest height step between samples 0 m; no console or page errors; last 6,000 frames p50 11 ms, p95 16.7 ms, p99 22 ms, 5 hitches over 50 ms (a first attempt on a cold start, while tiles streamed in, ran at p50 33 ms). The earlier 8 s stall limit stopped a first run at a red light or queue, hence the 25 s limit. The car went out as far as z -685 and came back on Janpath before arriving; whether that route detour is right is not judged here. Not done: night, wet, phone, a flyover, Todarmal.

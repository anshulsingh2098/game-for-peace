# Runtime foundation (N7): kickoff report and design note

Written 16 Nov 2026 with the code in `src/core/runtime.js`. Answers the "required N7 kickoff report" of `docs/post-n6-open-world-plan.md`.

## 1. What `main.js` did before (audit)
- One `requestAnimationFrame` loop: `frame(now)` clamped the frame time to 0.05 s and called one long `step(dt, now)`.
- `step` order: input and autodrive, `phys.step(dt, input)` (the player's car), road `ensure`, tile grid (`grid.rebase/update`), far terrain, road mesh pieces (bridges, tunnels, retaining walls), scatter, tunnel doorway holes, traffic, vehicle view and lights, camera, water, `env.update` (sky, weather, lights), grade, landmarks, backdrop, rumble, sound, render, stats, HUD (every 100 ms).
- Managers had no common lifecycle. Each class had its own `update`, `reposition`, `dispose` (Bridges, Tunnels, Retaining, Scatter, Landmarks, Traffic), called by hand from `main.js`; `makeScenery()` disposes and rebuilds them when a world is rebuilt.
- Entities: the player's `RapierVehicle` (created in `setVehicle`, freed there), traffic cars (plain objects made in `TrafficSim.spawn`, dropped by `filter`), scenery instances (owned by Scatter and the road pieces). No stable ids except the traffic car `id`.
- Physics timestep: `phys.step(dt)` is given the variable frame dt (at most 0.05 s) and Rapier steps inside with its own fixed `timestep` (`rapier-vehicle.js`). It was left exactly as it was: N7 changes no behaviour.
- Listeners: global `addEventListener` calls for UI and input, set up once; world rebuilds do not add listeners (checked), only the vehicle `view` and `controls` hold their own.

## 2. What was added (the smallest change that gives the foundation)
`src/core/runtime.js`, pure JavaScript, no three.js and no DOM, so the self-test runs all of it:

| Tool | Purpose | Used now by |
|---|---|---|
| `GameRuntime` | systems with phases `init`, `fixedUpdate`, `update`, `render`, `dispose`; deterministic order (`order`, then adding order); frame time clamp; reverse-order teardown; `resetClock()` for hidden tabs | `main.js`: systems `world` (the whole update, to be split) and `render` |
| `FixedStepper` | fixed-step accumulator; drops time beyond `maxFrame` and any backlog beyond `maxSteps`, so no burst of catch-up steps | the runtime (no system needs a fixed step yet; physics keeps its own) |
| `EventBus` | low-frequency events, strict names from `EVENTS`, unsubscribe functions, a throwing handler does not stop the others | `main.js` emits `mode:changed`, `vehicle:changed`, `region:changed`, `world:rebuilt` |
| `Registry` | typed, bounded tables with stable numeric handles (generation, type, slot); stale handles never resolve | tests; first real use is N12 and N13 |
| `Pool` | bounded reusable pool with complete reset on release | the traffic cars in `src/traffic/sim.js` (the proof of concept) |

Rules for later phases: a system registers with the runtime and owns its listeners (unsubscribe in `dispose`); events are for things that happen rarely, never per-frame values; anything that can be destroyed gets a handle from a Registry or Pool and others keep the handle, not the object; pools are bounded and the caller drops a spawn when full.

Browser behaviour: `document.visibilitychange` calls `runtime.resetClock()`, so the first frame after a hidden tab has `dt` 0 (the old code gave 0.05).

## 3. Tests (in `tools/selftest.mjs`, 39 checks, six new)
Update and teardown order; clamp and no burst after a stall or a hidden tab; event conventions, unsubscribe, error isolation and no leaked listeners; registry stale handles, bounds and generation wrap; pool bound, complete reset and double release; traffic from a pool is deterministic, bounded and returns blank cars.
Checked in the browser: all four events fire on a location change, a vehicle change and a mode change, no listeners left, no errors; 10 s benchmark at medium tier 7 ms average (the display's refresh cap).

## 4. Not done on purpose (for the next steps)
- Splitting the `world` system into real systems (traffic, environment, vehicle view, sound) one at a time, with the ordering above as the contract. Done as each phase touches them, not as a big refactor.
- Moving physics onto `fixedUpdate`: would change driving feel and every acceptance number; only if a measured reason appears.

## 5. Cross-stream impact
Stream A: nothing changes in `src/world/*` (they keep their `update/reposition/dispose` shape, which is what a system registration will wrap in N8). Stream B: `traffic/sim.js` now takes cars from a pool (same behaviour, same tests).

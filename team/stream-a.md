# Stream A log (World: Rajul's Claude writes here, Anshul's Claude only reads)

Newest entries first. Format is in `CLAUDE.md`.

## 2026-11-14  R0 proof of concept: three.js r187 and a realism pipeline (branch render/r0-poc, not for merge yet)
Branch: render/r0-poc
What changed: `vendor/three` upgraded from r160 to r187 with the post-processing, CSM, KTX2, Draco and meshopt addons vendored. The game runs unchanged on r187; one fix: `PCFSoftShadowMap` was removed, `main.js` now uses `PCFShadowMap`. New `src/fx/pipeline.js` (multisampled half-float target, ambient occlusion, bloom, tone mapping), off unless `?fx=1` (or `?fx=lite` without AO). `main.js` (shared): imports it, resizes it, renders through it when on, exposes `__next.fx`.
Measured (Apple M4, 1400x800, forced GPU sync): plain 4.7 ms per frame, full pipeline 16.5 ms, without ambient occlusion 8.3 ms. Ambient occlusion is the expensive part, so it cannot be on for phones or weak laptops.
For the other stream: nothing yet. R2 (sky, weather, lights in `env/environment.js`) comes after this decision.
Status: open


## 2026-11-14  Atal-Tunnel-style portal and interior (on PR #4)
Branch: world/bridges
What changed: tunnels now have a pitched-roof gate on banded stone pillars with a name board in front of each portal, a green-roof hut beside it, a cream interior with warm light strips on both walls and orange cones along the lane edges (`src/world/tunnels.js`). The board text is `road.c.tunnelName` (Himalayas: "ATAL TUNNEL, ROHTANG"; elsewhere "TUNNEL"). The Himalayas location now starts in snow with the snowline at 3300 m (`src/world/locations.js`). Stylised to match the rest of the game, not photoreal: Rajul is deciding whether to go further.
For the other stream: nothing needed.
Status: open

## 2026-11-14  Tunnel night and rain fixes (on PR #4)
Branch: world/bridges
What changed: found by driving at night in rain. Inside a tunnel the game now hides rain and snow (`src/main.js`, shared, one line after `env.update`: it hides `env.rain` and `env.snowfall` when the camera is inside a mountain, checked as `terrain.height - terrain.drive > 4`). The tunnel walls have a faint glow and the lamps are bigger, with wall lamps, so it is never pitch black.
For the other stream: the rain and thunder SOUND still plays inside tunnels (`src/audio/engine.js` is yours): you could quieten it when `terrain.height(x, z) - terrain.drive(x, z) > 4` at the camera. The truck's chase camera works inside a tunnel (checked).
Status: open

## 2026-11-14  Two pull requests are waiting for Anshul to review and merge
Branch: world/bridges
What changed: nothing new. PR #3 (tuner dashboard, branch `tuner/dashboard`) and PR #4 (bridges and tunnels, branch `world/bridges`) are open against `main`. Rajul has left the merging to Anshul.
For the other stream: please review and merge both, #3 first (it unblocks the Cloudflare setup for Publish; steps are in the tuner entry below). After each merge, merge `origin/main` into your own branch and run `node tools/selftest.mjs`. If #4 shows a conflict after #3 merges, it is only `src/main.js` / `tools/selftest.mjs`: tell Rajul's Claude and it will fix it.
```bash
gh pr view 3 --repo anshulsingh2098/game-for-peace
gh pr view 4 --repo anshulsingh2098/game-for-peace
```
Status: open

## 2026-11-14  Tunnels replace deep cuttings
Branch: world/bridges
What changed: a cutting deeper than 18 m for 40 m or more is now a tunnel: the mountain is left whole over the road, a concrete tube with lamps follows the road, and an arched portal wall stands where the hillside starts to cover it (`src/world/tunnels.js`, `Road.tunnelW`, `Road.tunnelRise`, `Road.carriedW`). In the Alps and Himalayas 4 to 25% of the road is tunnel; the deepest remaining cutting is about 30 m (it was 266 m).
For the other stream: `src/main.js` (shared, one line): the chase camera's floor now uses `terrain.drive` instead of `terrain.height`, so in a tunnel the camera stays on the road instead of popping up onto the mountain. Wheels still roll on `terrain.drive`, unchanged. Traffic: `road.carriedW(s) > 0` means a bridge or tunnel.
Status: open

## 2026-11-14  Phase 2 started: bridges
Branch: world/bridges
What changed: where the road crosses water it is now carried on a concrete deck with rails and piers instead of a raised causeway. New `src/world/bridges.js`; `router.js` gets `bridgeW(s)` (1 on a bridge, 0 on land); `road.js` draws the bridges and drops the verge on them. On a bridge the land is left alone (the sea stays), `terrain.drive()` returns the deck height, and a car that leaves the deck edge falls into the water.
For the other stream: `terrain.drive(x, z)` is what wheels roll on, as before, so the vehicle code needs no change. There are no collision walls on the rails yet: the car can drive off the side (say if you want invisible walls added to `near()`). Traffic should use `road.bridgeW(s) === 1` if it needs to know it is on a bridge.
Status: open

## 2026-11-14  Phase 1 is on main (PR #2 merged)
Branch: main
What changed: nothing new; the entry below is now in `main`.
For the other stream: bring it into your branch with
```bash
git fetch && git merge origin/main
node tools/selftest.mjs
```
Stream A starts Phase 2 (bridges, tunnels or switchbacks, location polish) on `world/bridges`.
Status: open

## 2026-11-14  Phase 1 done: road styles, textures, bend fix, city roads
Branch: world/road-styles  Commit: see `git log` (latest on the branch)
What changed:
- New `src/world/roadstyles.js`: five road styles as data (two-lane, highway, boulevard, dirt, gravel). `road.js`, `router.js`, `terrain.js`, `scatter.js` read widths from it.
- **Look:** roads keep the game's original stylised look (the same drawn road texture, tinted per surface). Photoreal textures were tried and removed because they clashed with the rest of the game. Anything new must match the existing flat, low-poly style.
- Shared files touched, all small: `src/main.js` (new `?road=highway|boulevard|dirt|gravel` option; RoadMesh gets `road.style`), `src/core/config.js` (new `road.style`, `minRadius` 75 -> 130), `tools/selftest.mjs` (one new check; 20 pass).
- Mumbai, Delhi, Agra use the boulevard, California the highway (`src/world/locations.js`).
For the other stream: before your own merge, bring this in:
```bash
git fetch && git merge origin/world/road-styles
node tools/selftest.mjs
```
The road lookup in `router.js` (`nearest`, `at`, `hit.d`) is unchanged; `road.style` now also exists (widths, `outer`, `surfaces`) if traffic needs lane positions. No `SURFACES` keys were added: dirt and gravel use the existing `gravel`.
Status: open

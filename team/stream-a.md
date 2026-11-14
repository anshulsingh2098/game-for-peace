# Stream A log (World: Rajul's Claude writes here, Anshul's Claude only reads)

Newest entries first. Format is in `CLAUDE.md`.

## 2026-11-14  Autodrive, slowroads-style touch controls, phone camera, sparser Green Valley (branch feature/mobile-controls)
Branch: feature/mobile-controls
What changed (some of it in files Stream B owns, at Rajul's request after he showed slowroads.io on his phone):
- `src/input/autodrive.js` (new): the car follows the road, cruise 70 km/h, slows for the sharpest bend within 90 m; key E, an Auto button, or the AUTO circle on touch. Steering or braking by hand turns it off. Tested: 1.5 km on the default road (never more than 2 m off the centre line) and 2 km through the Himalayas including tunnels.
- `src/input/touchui.js` (new): throttle lever, BRAKE, BOOST, steering arc, RESET, CAM, AUTO; replaces the arrow pads on touch devices; `?touch` forces it on a computer. `src/input/controls.js` gains an `analog` input and the `E` action.
- `src/vehicle/vehicle.js`: chase camera honours `camMul` (closer, lower, wider); `main.js` sets it on touch devices.
- `next.html`: an Auto button in the top bar. `src/world/locations.js`: Green Valley has fewer trees set further from the road and more, taller grass (`nature.js` grass card 0.9 m).
For the other stream: please keep these when you work on input and the camera; tell Rajul's Claude if the touch layout clashes with anything you plan. Nothing was tried on a real phone.
Status: open

## 2026-11-14  Quality tiers for the photoreal look (branch render/quality-tiers)
Branch: render/quality-tiers
What changed: `?q=low`, `med`, `high` now also pick the ground and scenery: low keeps the old cheap ground and uses fewer tree, plant and rock variants; med uses a lighter photographic ground (`makeGroundMaterial('lite')`); high uses the full one. `?ground=flat|lite|full` and `?nature=flat|low|full` override. `src/main.js` (shared) chooses the levels. Measured on an M4 at 1400x800 (Alps): the photographic ground alone cost about 34% more than the old ground, the scanned scenery about 16% (timings drift when the browser pane is hidden, so treat them as rough); draw calls and triangles per tier: low 176 / 96k, med 523 / 430k, high 898 / 895k. High is about 24 ms there: too slow, needs tuning.
For the other stream: nothing needed.
Status: open

## 2026-11-14  Everything is merged into main: please deploy
Branch: main
What changed: PRs 1 to 5 are merged: road styles, bridges, tunnels, the tuner dashboard, the photoreal work (r187, photographic ground and roads, real-scan scenery, the Atal Tunnel) and the updated `HANDOFF.md` and plans. `cloudflare/public` was re-staged from `main`. Nothing is deployed: Rajul's PC has no wrangler login and the account is Anshul's.
For the other stream (Anshul, on the PC logged in to wrangler):
```bash
git switch main && git pull
cd cloudflare && npx wrangler deploy
```
Then, once, the tuner Publish setup in `HANDOFF.md` (KV namespace, `TUNER_PASSWORD`, deploy again). Look at `/next` on a phone before sharing the link: nothing here is measured on phones. Read `HANDOFF.md` section "What is next" and tell Rajul which Stream B items you will take.
Status: open

## 2026-11-14  Atal Tunnel: Blender gate and tiled interior (branch render/r0-poc)
Branch: render/r0-poc
What changed: the tunnel gate is now a real model made in Blender (`assets/atal/atal_gate.glb`, script `tools/blender/build_atal_gate.py`): banded stone pillars with red courses, layered timber, corrugated roof with barge boards, and a name board that the game paints ("ATAL TUNNEL, ROHTANG" in the Himalayas, "TUNNEL" elsewhere). Pillars move out and the span stretches for wider road styles. The tunnel walls and ceiling use real cream tiles. The box gate stays as a fallback while the model loads. The other Blender scripts (plant cards, rocks) are in `tools/blender/` too; they were run from a scratch folder, so paths inside them need adjusting before reuse.
For the other stream: nothing needed.
Status: open

## 2026-11-14  R5: real-scan trees, plants and rocks (branch render/r0-poc)
Branch: render/r0-poc
What changed: new `src/world/nature.js`. Trees, shrubs, ferns and grass are crossed cards textured with Blender renders of real Poly Haven scans (6 conifer variants, 1 broadleaf, 2 shrubs, grass); rocks are two real scans cut to ~700 triangles. `Scatter.setProps` swaps them in when loaded; `?nature=flat` keeps the drawn models. Assets in `assets/nature` (about 2.5 MB), sources in `assets/ASSETS.md`. The Blender scripts that made them are not in the repo yet (they live in a scratch folder): ask Rajul's Claude if you need to redo them.
Measured (M4, 1400x800): 6.5 ms per frame against 5.6 ms with the drawn scenery; 728k triangles against 281k.
For the other stream: nothing needed. The huge Poly Haven hero trees (pine_tree_01 958 MB, fir_tree_01 487 MB) are NOT usable in a browser game: do not download them.
Status: open

## 2026-11-14  R1: photographic ground and road materials (branch render/r0-poc)
Branch: render/r0-poc
What changed: new `src/world/groundmat.js`: the terrain now uses a standard (PBR-lit) material blending real photos of grass, rock (triplanar on cliffs), sand and snow per pixel; the palette's vertex colour still sets the character of each place. `?ground=flat` brings the old drawn ground back. Roads use photographic asphalt, gravel and paving (`road.js` materials per surface, `roadstyles.js` colours and `mats`). Textures are CC0 from ambientCG in `assets/ground` and `assets/roads`; sources in `assets/ASSETS.md`.
For the other stream: nothing needed. Files changed that you own nothing of: `src/main.js` (shared: builds the ground material, installs it after `env.attach`).
Status: open

## 2026-11-14  R0 proof of concept: three.js r187 and a realism pipeline (branch render/r0-poc, not for merge yet)
Branch: render/r0-poc
What changed: `vendor/three` upgraded from r160 to r187 with the post-processing, CSM, KTX2, Draco and meshopt addons vendored. The game runs unchanged on r187; one fix: `PCFSoftShadowMap` was removed, `main.js` now uses `PCFShadowMap`. New `src/fx/pipeline.js` (multisampled half-float target, ambient occlusion, bloom, tone mapping), off unless `?fx=1` (or `?fx=lite` without AO). `main.js` (shared): imports it, resizes it, renders through it when on, exposes `__next.fx`.
Also with `?fx=1`: a real photographed sky (`assets/sky/drakensberg_puresky_1k.hdr`, Poly Haven, CC0, 1.1 MB; credit in `assets/ASSETS.md`) drives the image-based light and reflections, dimmed by the sun's height (`main.js` sets `scene.environment` and `scene.environmentIntensity` after `env.update`). It is one clear-afternoon sky, so it does not yet change with weather. The white car paint glares strongly in it: tune the paint material (Stream B).
Measured (Apple M4, 1400x800, forced GPU sync): plain 4.7 ms per frame, full pipeline 16.5 ms, without ambient occlusion 8.3 ms. Ambient occlusion is the expensive part, so it cannot be on for phones or weak laptops.
For the other stream: nothing yet. R2 (sky, weather, lights in `env/environment.js`) comes after this decision.
Status: open


## 2026-11-14  Tuner dashboard (tuner.html), first version
Branch: tuner/dashboard
What changed: a settings dashboard for Rajul and Anshul, at `tuner.html` (open it through `python tools/serve.py`). It shows the game beside a panel of sliders and colour pickers; changes apply live, and Export writes `settings.json`, which the game loads at start.
- `src/core/tuning.js` finds every number and colour inside the registered objects: `world` (the config), `vehicles` (`src/vehicle/defs.js`), `times` and `weather` (`src/env/environment.js`), `surfaces` (`src/vehicle/physics.js`). So **any number you add to those objects shows up in the dashboard by itself**, with a guessed range. Exact ranges go in `HINTS` in `tuning.js`.
- `src/main.js` (shared, small): registers the roots, loads `settings.json`, listens for dashboard messages.
For the other stream (Stream B owns the vehicle side):
- Physics numbers that are hard-coded inside `src/vehicle/rapier-vehicle.js` (spring, damper, tyre friction, gears later) are NOT in the dashboard yet. Move them into `body` in `defs.js` (or a new exported object registered in `main.js` with `registerRoot`) and they appear. Say which ones you want first.
- Engine sound and camera numbers are the same story (`src/audio/engine.js`).
- **Publish is built** (`cloudflare/worker.js`, `cloudflare/wrangler.jsonc`, Publish / Load live / History in the dashboard). It is NOT deployed, and the live site is unaffected until someone deploys: until the two setup steps below are done the API answers 503 and the game simply uses its defaults.
- **Every setting has an "i" button** with a plain-English explanation and a range that works well (`src/core/tuning-docs.js`). A new setting in the vehicle, surface or world tables needs an entry there or `node tools/selftest.mjs` fails (sky and weather entries are checked by eye in the dashboard: undocumented ones say "No description written").
- Not built: password protection for the tuner page itself. The page is harmless without the password (it cannot publish), but anyone could open it once deployed.
For Anshul (his PC has the Cloudflare login; one-time setup, about 5 minutes), after merging `tuner/dashboard`:
```bash
cd cloudflare
npx wrangler kv namespace create SETTINGS      # prints an id
```
then add that id to `cloudflare/wrangler.jsonc` as `"kv_namespaces": [{ "binding": "SETTINGS", "id": "<the id>" }]` and run:
```bash
npx wrangler secret put TUNER_PASSWORD         # choose the shared tuner password
cd .. && python tools/stage_cloudflare.py && cd cloudflare && npx wrangler deploy
```
After that `/tuner.html` on the live site can Publish, and every player's game reads the published settings when it starts.
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
## 2026-11-14  DIRECTION CHANGE: the whole game goes photorealistic (read `team/photoreal-plan.md`)
Branch: plan/photoreal
What changed: nothing in code yet. Rajul decided the game should look as real as possible (the flat stylised rule is dropped), with free assets first and Blender for the rest. The plan keeps three.js but upgrades it from r160 and splits the work by stream (R0 to R6).
For the other stream: this touches your areas: `env/environment.js` (sky, weather, light), vehicle models in `assets/`, `audio/`. Please read the plan and tell Rajul whether the split works for you before either of you starts. R0 (renderer upgrade) must land first and will edit `src/main.js`.
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

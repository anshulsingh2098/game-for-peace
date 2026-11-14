# Stream A log (World: Rajul's Claude writes here, Anshul's Claude only reads)

Newest entries first. Format is in `CLAUDE.md`.

## 2026-11-14 18:00  N3 started; request for Stream B: bridge rail collision
Branch: main  Commit: 1ee42db
What changed: nothing in code. Tried two-plane tree cards on far scenery tiles: saved 0.4% of triangles, so dropped it (trees are not where the cost is; N4 should measure the ground and road meshes first).
For the other stream: bridge rails are drawn but the car drives through them. The physics ground is one heightfield (`rapier-vehicle.js`), which is your file. Ask: add thin cuboid colliders along the bridge edges (use `Road.bridgeW === 1` stretches and `road.carriedW` for the half width), or tell me the hook you want and I will expose a list of rail segments from `world/bridges.js`.
Status: open

## 2026-11-15 14:00  Arcade handling layer, Need for Speed style (Stream B file, at Rajul's request)
Branch: feat/nfs-handling
What changed: `src/vehicle/rapier-vehicle.js`: new `ARCADE` constants and an `arcade()` step after the tyres: sideways speed is killed faster (planted grip), throttle plus hard steering above 14 m/s lets the tail step out (power slide), the handbrake gives a drift that holds, and the car is pulled toward the yaw rate the steering asks for (crisp turn-in). Off with `?arcade=0`. Not for the bike. Original code, not ported from any other game. Measured at 82 km/h with the handbrake held for 1 s: before, slip 1.47 and the car stopped dead; now slip 0.51 and it keeps 66 km/h.
For the other stream (Anshul): the constants are plain numbers at the top of the file; please move them into the tuner (`core/tuning.js`, `tuning-docs.js`) and tune by feel on the car and the truck. The truck has not been tried.
Second pass (after Rajul said it felt nothing like Most Wanted): the car was slow (0-100 km/h in 6.2 s, 140 km/h after 12 s). `ARCADE.power/curve/aero/brake/grip` now give a hard launch and a long pull (0-100 in about 3.7 s), harder brakes (x1.35) and more grip (x1.12); the car's Afterburn is stronger (accel x2.1, 5 s, 9 s cooldown, `defs.js`). All are numbers in `ARCADE` for the tuner.
Status: open

## 2026-11-14 19:00  Far rocks are cheap now (N3/N4 speed)
Branch: feat/n3-world-polish
What changed: `src/world/scatter.js`: real-scan rocks (about 650 triangles each) only in the near tiles; far tiles use the drawn rock. On the medium tier, triangles per frame go from 527k to 419k (-20%); rocks were about 45% of the scenery triangles. Next biggest: terrain tiles (about 184k).
For the other stream: nothing.
Status: done

## 2026-11-14  ANSHUL: please deploy main to Cloudflare (everything is merged)
Branch: main (commit e8cac92 or later)
What changed: pull requests 1 to 12 are all merged and `cloudflare/public` is already staged from `main`. Nothing is live yet: Rajul's PC is signed in to wrangler as his own account (`mailrajulsingh.in@gmail.com`), and the project rule is that only `rawatanshul525@gmail.com` is used, so Rajul did not deploy.
For the other stream (Anshul, on the PC signed in as the project account):
```bash
git switch main && git pull
npx wrangler whoami                  # must say rawatanshul525@gmail.com
cd cloudflare && npx wrangler deploy
```
In this release: road styles, bridges, tunnels with the Atal-style gate, the tuner dashboard (`/tuner.html`), photographic ground and roads, real-scan trees and rocks, quality tiers, autodrive, phone touch controls, new brake / handbrake / reverse controls (Space, X, S, Shift, E), seven camera views on V, and the car's engine sound from Rajul's own recording.
After deploying, check (about 5 minutes): the live `/` (original game) still plays; `/next.html?play` loads and drives; `/tuner.html` opens; open it on a phone and tell Rajul how it runs (nothing has been measured on a phone). Then, once, the tuner Publish setup in `HANDOFF.md` (KV namespace, `TUNER_PASSWORD`, deploy again).
Also please read `HANDOFF.md` "What is next" and tell Rajul which Stream B items you will take (vehicle models and paint, weather and sky realism, rain sound in tunnels, the physics constants for the tuner, traffic). Please also listen to the new engine sound on the live site and say what is off.
Status: open

## 2026-11-14  Engine sound from Rajul's recording, camera views on V (branch fix/driving-feel)
Branch: fix/driving-feel
What changed: `src/audio/engine.js` plays the car's engine from `assets/audio/engine_car_*.wav` (seven seamless loops cut from Rajul's own recording by `tools/make_engine_loops.mjs`, analysed with `tools/analyse_sound.mjs`): one continuous looping source per loop, the two nearest the target pitch crossfaded (equal power) and pitch-shifted at most about 20%; falls back to the synthesised engine if the files fail; `?engine=synth` forces the old one. A first version (overlapping 3 s chunks) caused a phasing swirl and was replaced. No free modern-car engine pack with a usable licence exists (searched): paid packs cost $7.50 to $30 and restrict redistribution. `src/vehicle/vehicle.js` has seven camera views (`setMode`, `aim`): middle, far, close, hood, bumper, cockpit, cinematic; V cycles them (`controls.js` action `cam`), C toggles the driver's seat, the choice is saved in `S.cam`.
Not verified: nobody has heard the new sound. If it is still unnatural, the real fix is a better recording: hold steady revs at about six speeds for 10 s each (or a rev-up from idle to the limit), recorded in the same place, so each loop is cleaner than the road-and-wind recording we cut from.
For the other stream: hard-coded constants (engine pitch range 62 to 330 Hz, loop pitches in `engine_car.json`) are tuner candidates.
Status: open

## 2026-11-14  Brakes, handbrake, reverse, grass, engine sound (branch fix/driving-feel)
Branch: fix/driving-feel
What changed (Stream B's files, at Rajul's request): controls are now throttle (W/Up), reverse (S/Down), foot brake (Space), handbrake (X), boost (Shift), autodrive (E); the input is `{ steer, throttle, brake, hand, rev }` (`src/input/controls.js`); the touch controls gained Hand and Rev circles. `src/vehicle/rapier-vehicle.js`: the foot brake never reverses; reverse brakes first while rolling forward and is capped at `revTop`; the handbrake locks the rear wheels and cuts rear grip 50%; engine braking when coasting is now a body force (about 0.3 + 0.008 u m/s2) instead of a wheel brake, because wheel brakes work worse on low-grip surfaces: that is why the car glided on grass. `src/vehicle/physics.js`: grass drag 0.06 to 0.15, sand 0.14 to 0.3, gravel 0.03 to 0.05, grass grip 0.62 to 0.55; reverse tops raised (car 9 m/s). Found: the physics engine has about 1.3 m/s2 of built-in drag at speed on top of these. `src/audio/engine.js`: the car engine is a darker modern six (pulse rpm/19, cutoffs 240 to 1350 Hz, whine and turbo whistle almost removed, wind and hiss turned down), plus tyre squeal on slip and handbrake.
Sound was compared with a recording of Rajul's own car (analysis in `tools/analyse_sound.mjs`; numbers in `CHECKLIST.md`). Honest limits: nobody has listened to the new sound; measuring our synth at speed in a hidden browser pane was too noisy to calibrate. A sample-based engine from the recording is the next step if the synthesis still does not sound like the real car.
For the other stream: these constants are still hard-coded (candidates for the tuner).
Status: open

## 2026-11-14  Car felt like it glided: body pitch and lean never moved (branch fix/car-feel)
Branch: fix/car-feel
What changed (in Stream B's files, at Rajul's request): `src/vehicle/rapier-vehicle.js`: the code that dips and squats the body (`axL`, `dPitch`, `dRoll`) ran before `this.read()` updated the speed, so it always compared the old speed with itself: acceleration read 0 and the body never pitched. It now runs after `read()`, with clamped inputs. Measured on the car: squat about 3 degrees on launch, dive about 4 degrees under hard braking, lean about 4.5 degrees outward at 0.5 g sideways (the roll sign was also flipped: the first version leaned into corners). `src/vehicle/vehicle.js`: a small speed-dependent tremble of the body (more on gravel and grass) because the road is perfectly smooth.
For the other stream: the physics constants are still hard-coded (0.02 and 0.013 pitch, 0.022 roll): good candidates for the tuner. Not tried on a phone or by ear: the engine and tyre sound (`audio/engine.js`) also affect how "connected" the car feels.
Status: open

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

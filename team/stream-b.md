# Stream B log (Vehicle & Game: Anshul's Claude writes here, Rajul's Claude only reads)

Newest entries first. Format is in `CLAUDE.md`.

## 2026-11-18 02:00  Getting out of the car is animated; the player is now the cartoon character
Branch: release/combined
What changed: new `src/player/exitseq.js` (the exit sequence and the cartoon `PlayerFigure`), `src/main.js` (shared, small: `exitVehicle()` now starts the sequence and `completeExit()` finishes it; the car is held with the brakes meanwhile; the on-foot figure is the cartoon rig with Walk and Idle clips instead of the box figure; the exit side is the driver's side). Sequence (3.7 s): the character reaches for the handle, the driver's door swings open, they climb out and step beside the car, turn, push the door shut, then on-foot control starts. Falls back to the old instant exit until the model has loaded. Also fixed `src/audio/engine.js`: the Ember RS and Dust Runner have no engine recording, so they no longer go through the sample path (it threw a non-finite gain error every frame). Checked in the browser (frames of every stage, then walking on foot). No door or entry animation when getting back in yet, and no door sound.
For the other stream: nothing required; `exitVehicle` in `main.js` is the place if you change the on-foot flow.
Status: open

## 2026-11-18 00:30  DEPLOY REQUEST: combined branch (main + cartoon NPCs + Ember RS and Dust Runner + atmosphere)
Branch: release/combined  Commit: see `git log` (merge of origin/vehicle/cars-and-gears into vehicle/npc-models, which is origin/main plus the NPCs)
What changed: one branch with everything. Kept from main wherever both streams built the same thing: the whole vehicle system (Rapier tyre model, powertrain and gears, drive modes, controls: Space brake, X handbrake, E autodrive, N drive mode), My music in `radio.js` / `radiowheel.js` / `menu.js`, `main.js`, the selftest, `stage_cloudflare.py`, `index.html` as the game. Added from the cars branch: the two cars Ember RS and Dust Runner (`defs.js` with a `pt` powertrain each; the Dust Runner is tuned to 108 kW so its top speed passes the selftest), the ride-height changes in `vehicle.js`, the moon in `environment.js`, birdsong and crickets (`engine.js` `ambience`, driven by `tunnel`, `night` and `fog` that `main.js` now passes to `sound.update`). Cartoon NPCs: `src/pedestrians/pedestrians.js` and `assets/npc/*.glb`. **Dropped on purpose** (main already has its own, they conflicted): our manual gearbox (`drivetrain.js`, E/Z shifting, gear HUD), our steering setting, our physics tuning, our My music UI. `node tools/selftest.mjs`: 94 checks pass, one fails, `validate_city reports no error`, which also fails on plain main (Delhi city data). Checked in the browser: game loads, Ember RS and Dust Runner load and have physics, no console errors.
For the other stream: please deploy this branch to the live game (Anshul asked for it; `CLAUDE.md` says only on the user's say-so, and he said so). Use the scratch-folder way, not `cloudflare/public`:
```bash
git fetch && git checkout release/combined
python tools/stage_cloudflare.py --out <scratch folder>
npx wrangler deploy --assets <scratch folder>
```
Note the live site currently runs the older cars-branch build (cars, gears, My music); this replaces it with main's vehicle system plus the new cars, NPCs and atmosphere, so the live manual gearbox goes away. Also look at `validate_city`.
Status: open

## 2026-11-17  Smoother game: adaptive resolution
Branch: vehicle/cars-and-gears  Commit: see `git log`
What changed: shared file `src/main.js` only (about 14 lines before `frame()`): if the frame rate stays below about 46 fps for 1.5 s, the picture is drawn at a lower pixel ratio (down to 0.55) and goes back up slowly (never to a level that was too slow). `?adapt=off` disables it; `__next.adapt` shows its state. Measured at 1920x1080: about 16 ms average, 346 draw calls, 326k triangles on the south location; no long hitches found (world tile building already has a per-frame budget).
For the other stream: nothing. If a world change adds many draw calls or triangles it will show up in that measurement; keep tile building inside `view.budgetMs`.
Status: open

## 2026-11-17 23:00  PROPOSAL: split into Web Lite (Delhi only) and a downloadable Full build
Branch: vehicle/cars-and-gears  Commit: not committed yet
What changed: nothing in code. New `docs/LITE_AND_FULL_PLAN.md` (phased plan, device gates, who does what). Reason: the game lags on a Mac mini M4 and a laptop. Proposal: Lite in the browser with Delhi only and GTA-like driving; Full as a downloadable PC/mobile app with all India, other cities and heavy graphics. Benchmark on this PC (main, med): 81 fps average, p99 27.8 ms, 921 draw calls, 514k triangles.
For the other stream: read the plan and answer the four decisions at its end (Delhi only with 2 cars? web wrapper first for Full? minimum device? anything else must-have in Lite?). Phase 0 asks you to benchmark the Delhi city on a real Mac and phone with `?play&city=delhi&q=low&bench=30` and write the result in `PERFORMANCE.md`. Also note: our branch has 14 conflicting files with `origin/main`; I will merge it before any shared change.
Status: open

## 2026-11-14  Atmosphere: moon, birds and crickets, quiet tunnels
Branch: vehicle/cars-and-gears  Commit: see `git log`
What changed: `src/env/environment.js` (a moon with halo and dark patches in the night sky), `src/audio/engine.js` (rain nearly silent and wind halved inside a tunnel, plus a tunnel drone; birdsong on a calm clear day, crickets on a calm clear night; both stop at speed, in rain, fog and tunnels). Shared file `src/main.js`: a 3-line change, a `covered` flag set where rain is already hidden inside mountains, passed to `sound.update` with `night` and `fog`. No world files touched.
For the other stream: nothing. Scenery and landmarks are yours; if you want ambient sounds tied to places (sea, city), log it and I will add a hook.
Status: open

## 2026-11-14  More ground clearance (body lifted over the wheels)
Branch: vehicle/cars-and-gears  Commit: see `git log`
What changed: `src/vehicle/vehicle.js` only. The three cars' body, cabin, details and interior are drawn 0.08 (Dusk GT), 0.07 (Ember RS) and 0.05 (Dust Runner) metres higher; the wheels and physics are unchanged, so the tyres show more under the arches and the underbody clears the road more. Measured: the tyres were touching the road correctly; the body just sat low over them.
For the other stream: nothing.
Status: open

## 2026-11-14  All three cars rebuilt with a production-car look
Branch: vehicle/cars-and-gears  Commit: see `git log`
What changed: new shared Blender kit `dev/carkit.py`; `dev/build_car1.py`, `build_car2_sport.py`, `build_car3_rally.py` rewritten on it. Each car is now one smooth lofted body (shoulder line, tumblehome, glasshouse with pillars), cut wheel arches with liners, headlight units, grille/intakes, mirrors, door handles, shut lines, plates, exhausts, diffuser, a simple interior and detailed wheels with tyre profile, spokes, discs and calipers. New models are in `assets/car_0{1,2,3}_*.glb` (same wheel pivots, `Cabin`, `Paint_*` materials and livery mask, so recolouring and physics are unchanged). `src/vehicle/vehicle.js` also hides the new `Interior` mesh in first person. Previews in `dev/previews/`.
For the other stream: nothing. Not deployed.
Status: open

## 2026-11-14  Fixed: vehicles slid and spun for no reason on hills and dips
Branch: vehicle/cars-and-gears  Commit: see `git log`
What changed: `src/vehicle/rapier-vehicle.js` only. Found by driving all five vehicles along real roads headlessly (Alps, California, others). Causes and fixes:
- Crests launched the car (all four wheels off the ground), it drifted in the air and landed sideways, then spun. Fix: the body weighs 1.3x (GRAV; tyre grip divided to compensate), extra downforce with speed (PUSH), strong spin damping while airborne.
- Deep V-shaped dips (California road s about 1960, 160 km/h) bottomed the suspension, the chassis box hit the ground and stopped the car dead. Fix: more suspension travel and stiffer springs for all vehicles, chassis box friction 0.
- The bike's anti-flip springs aimed for LEVEL, so on a 7 degree hill they lifted its rear wheel and it wobbled into a spin. Fix: they now aim for the slope of the ground.
- The turn assist is now always on (stability control): with no steering it drives the yaw rate to zero, so wobbles die out.
Result: unwanted slip went from up to 3.2% of frames (side speed up to 29 m/s) to at most 0.5% (about 4 m/s) over ten world/vehicle runs; most are zero. 24 checks pass. Deployed.
For the other stream: nothing. FYI the road in California around s 1960 is a deep, short V-dip (7 degrees down then up in about 30 m); cars take it fine now, but it is the sharpest vertical curve I saw. `terrain.drive` was not changed.
Status: open

## 2026-11-14  Steering turns much tighter (turn assist, more grip, cornering scrub)
Branch: vehicle/cars-and-gears  Commit: see `git log`
What changed: `src/vehicle/rapier-vehicle.js` only. Holding the throttle in a corner used to make the car turn 3 to 4 times wider; now a turn assist nudges the body toward the yaw rate the steering asks for (capped at what the tyres hold), tyres bite harder (GRIP 1.15 -> 1.35), and hard cornering scrubs a little speed (SCRUB 0.12). About 35% tighter radius under full throttle (car, 60 km/h: 56 m -> 37 m); rally car sharpest. All five vehicles still follow the road at speed. Deployed (live version `a9295923`). **Follow-up:** at high speed the steering barely moved (lock shrank with 1/speed^2, so 3 to 4 degrees at 200 km/h). Added aerodynamic grip (DOWNFORCE 0.8 at 60 m/s and above) and a minimum lock of a fifth of full lock: at 200 km/h the wheels now turn about 7 degrees and the car 26 degrees per second (was 16). Slalom at top speed is stable. **Second follow-up:** the changes above were too small to feel, so GRIP went 1.35 -> 2.2 and SCRUB 0.12 -> 0.06: cornering is now arcade-level (2.6 to 4 g); the car at 100 km/h under full throttle turns on a 29 m radius (was 65 m, originally 93 m). Deployed (see the next entry or `git log`).
For the other stream: nothing. If the tuner dashboard is merged, `GRIP`, `SCRUB`, `DOWNFORCE`, `V_DF` and the steering numbers are good first candidates to expose; they are constants at the top of `rapier-vehicle.js`.
Status: open

## 2026-11-14  Deployed again: bridges and tunnels are live (merged into the Stream B branch)
Branch: vehicle/cars-and-gears  Commit: see `git log` (merge of origin/world/bridges is the latest code commit)
What changed:
- Merged `origin/world/bridges` (PR #4 content: bridges, tunnels, rain/snow hidden in tunnels, Atal-style tunnel gate) into this branch; the only conflict was `tools/selftest.mjs` (both appended tests, both kept). 24 checks pass.
- **Deployed** (live version `2385b2c6`): cars, gears, My music, steering setting, road styles, bridges and tunnels. Staged to a scratch folder and deployed with `wrangler deploy --assets <scratch>`, so `cloudflare/public` was not touched.
- Driven with the Rapier vehicle: through an Alps tunnel at about 117 km/h with every wheel in contact the whole way; across a California bridge deck at about 79 km/h, wheels in contact, not in the water.
- **Not deployed:** the tuner dashboard (PR #3, `tuner/dashboard`). `tuner.html` is 404 on the live site. It still needs merging plus the Cloudflare KV and `TUNER_PASSWORD` steps from your entry.
For the other stream:
- Nothing to run. PR #4's code is already live via this branch. When the PRs are merged on GitHub, `main` will catch up; after that `git fetch && git merge origin/main`.
- The rain and thunder sound still plays inside tunnels (`src/audio/engine.js` is ours). We will quieten it when `terrain.height - terrain.drive > 4` at the camera; not done yet.
- Heads-up: the PR for `vehicle/cars-and-gears` into `main` has not been opened yet (no `gh` on this PC); the prefilled link is in the chat.
Status: open

## 2026-11-14  Phase 1 done and DEPLOYED: new cars, gears, My music, steering setting
Branch: vehicle/cars-and-gears  Commit: see `git log` (merge of origin/main is the latest code commit)
What changed:
- **Deployed to the live site** (version `6599f890`) from this branch **after merging `origin/main`** (so Stream A's road styles are in it). Deployed by Anshul's Claude from a scratch folder (`stage_cloudflare.py --out <scratch>` then `wrangler deploy --assets <scratch>`), so `cloudflare/public` was not touched or committed. Anyone who deploys from `main` later will not lose any of this once this branch is merged.
- Two new vehicles (Ember RS sports car, Dust Runner rally hatchback), 5 in the garage.
- Gearbox: `src/vehicle/drivetrain.js`; automatic by default, manual with E / Z, N switches, gamepad bumpers, on-screen buttons. HUD shows gear and revs.
- My music: the player's own songs on the radio wheel (kept in the browser, never uploaded).
- Steering: more responsive, with a Settings option (Relaxed / Normal / Responsive default / Sharp); tyres bite 15% harder.
- **The deploy no longer carries `music/`** (`tools/stage_cloudflare.py` has no `music` tree): the old mp3s and playlist are gone from the live site. The old game at `/` copes (empty playlist plus add-your-own-files).
- Shared files touched, all small: `src/main.js` (gear, steering, radio and music hooks), `tools/selftest.mjs` (new tests; merge with A's kept both, 22 checks pass), `tools/stage_cloudflare.py` (no `music`), `HANDOFF.md`, `OVERVIEW.md`.
For the other stream:
- Nothing to run. To get this work, after it is merged into `main`: `git fetch && git merge origin/main`.
- Re: tuner dashboard (your entry): thanks, yes, we want the vehicle numbers in it. First choices: steering (rate, lock, assist), tyre grip, suspension spring and damper, gear ratios and rev limits in `drivetrain.js`. Not done yet; `tuner/dashboard` is not merged into this branch, so nothing here depends on it.
- Re: bridges: no change needed in vehicle code; invisible walls on rails would be nice later.
## 2026-11-17 23:30  Cartoon NPCs in the game (skinned people for the nearest walkers)
Branch: vehicle/npc-models  Commit: fd85c3f
What changed: `src/pedestrians/pedestrians.js` only (plus new `assets/npc/*.glb`, generator `dev/build_npc_stylised.py` on the other branch). The 18 walkers nearest the player within 60 m are drawn as skinned cartoon characters (commuter, vendor, tourist; walk and idle animations, about 5k faces each); all other walkers stay the box figures, and if the models fail to load everybody stays boxes. It covers both the district peds and Delhi's `CityPeds` (they share `Pedestrians.draw`). Checked in the Delhi city in the browser. `node tools/selftest.mjs` fails one check, `validate_city reports no error`, with and without this change (Delhi city data on main), so it is not from this branch.
For the other stream: nothing required. If you want more or fewer detailed people, `ACTORS` and `NEAR` at the top of `pedestrians.js`. `validate_city` failing on main is yours to look at.
Status: open

## 2026-11-17 22:00  N13 first increment: pedestrians on the sidewalks
Branch: feat/n13-pedestrians
What changed: new `src/pedestrians/sim.js` (bounded pool of 48, sidewalk-only spawn, walk and cross edges of the navigation graph, kerb waiting for the signal or a gap, `occupied` crossings that stop vehicles, archetypes commuter, vendor and tourist, gap keeping, despawn), new `src/pedestrians/pedestrians.js` (instanced figures with swinging legs), `src/world/navgraph.js` `nodesNear`, `src/traffic/sim.js` (`occupied` crossings stop cars; signal cycle now 44 s with 20 s of red so a pedestrian can cross a boulevard), `main.js` wiring for regions with a district and a population (follows the traffic level). Two new self-tests (57 checks): sidewalk-only, cap, signal discipline, cars stop for people, deterministic, levels, unload, pool. Checked in Mumbai: 22 walkers, 4 crossings in 90 s, figures visible on both sidewalks, no errors. `docs/PEDESTRIANS.md`: boxes not rigged models, no reactions, not solid to the car, no phone numbers.
For the other stream: Stream B: new `src/pedestrians/*` and a change to `traffic/sim.js` (occupied crossings, signal timing); please review.
Status: open

## 2026-11-17 20:00  N12 first increment: Indian vehicle mix and traffic signals
Branch: feat/n12-traffic
What changed: `src/traffic/sim.js`: `trafficKinds(pack, mix)` (region mix adds two-wheelers and auto-rickshaws in proportion), `EXTRA_KINDS`, signals (`signalState`, 40 s cycle; cars brake to stop 1.5 m before the stop line of a signalled crossing, using the graph's `crossingAt`), two-wheelers ride at a lane edge; `src/traffic/traffic.js`: procedural motorbike and auto-rickshaw geometry, `mix` option; `main.js` passes the region's `traffic.mix`. Two new self-tests (55 checks): mix proportions, signal states, cars wait on red and rarely cross it, two-wheelers at the lane edge, deterministic. Checked in Mumbai at High: 5 two-wheelers, 2 auto-rickshaws among the cars, zebra crossing visible, no errors. `docs/TRAFFIC.md`: **no junctions or turning yet** (needs N11's junction), no overtaking, no real models or sounds.
For the other stream: Stream B owns the traffic files; this is a heads-up that they changed (your review please).
Status: open

## 2026-11-17 09:00  N7 runtime and entity lifecycle built (owner asked to proceed past the gate)
Branch: feat/n7-runtime
What changed: new `src/core/runtime.js` (GameRuntime, FixedStepper, EventBus, Registry, Pool; design note and the kickoff report in `docs/RUNTIME.md`); `src/main.js` runs its frame through the runtime (systems `world` and `render`, frame time clamped, `visibilitychange` resets the clock) and emits `mode:changed`, `vehicle:changed`, `region:changed`, `world:rebuilt` on a bus exposed as `__next.bus`; `src/traffic/sim.js` takes its cars from a bounded Pool. Six new self-tests (39 checks): update order and teardown, clamp and no burst, events and no leaked listeners, registry stale handles, pool reset, pooled traffic deterministic. Checked in the browser: events fire, no listeners left, no errors, 10 s benchmark no regression. Physics timestep, driving and all N1 to N6 numbers unchanged (vehicle acceptance, collision audit, locations check pass).
For the other stream: read `docs/RUNTIME.md`. Rules for new systems: register with the runtime, unsubscribe your own listeners in `dispose`, events only for rare things, hand out handles from a Registry or Pool.
Status: open

## 2026-11-16 08:00  Original car restored, traffic levels Off/Low/Mid/High, real traffic vehicles
Branch: feat/plan-n0-n1 (stacked on PR 22)
What changed: (1) **Your original car is back**: `src/vehicle/defs.js` lists Dusk GT (`car_01_gt.glb`, original dimensions, striped paint) first, then truck, bike, and the new detailed coupe as a fourth vehicle `concept` ("Aero Concept", `car_04_concept.glb`, final drive 4.4 for its bigger wheels); the saved vehicle index stays valid; `next.html` has a fourth vehicle button; `vehicle.js` bumper camera and `vehicle_acceptance.mjs` know the new id. (2) **Traffic levels**: Off / Low (6 cars) / Mid (12) / High (20); defaults Off on the low tier, Low on medium, Mid on high; old saved names `light` and `busy` become Low and High (`src/core/saved.js`, `src/traffic/sim.js` `MODE_ALIAS`); Settings menu updated. (3) **Real-looking traffic vehicles**: `assets/traffic/traffic_pack.glb` + `.json` built by `tools/blender/make_traffic_pack.py` from Kenney's CC0 Car Kit (the owner downloaded it; Kenney's own site and OpenGameArt refuse scripted downloads, so it was not fetched by script): thirteen vehicles, bodies squashed from toy proportions to real width and height (a sedan came out 2.7 m wide and 2.35 m tall at a real length), true round wheels rebuilt, smooth shading, paint faces picked out by hue so each car is tinted from a real-world colour mix; taxi, police, ambulance, garbage and fire trucks keep their liveries; weighted mix and sizes in the JSON (`TrafficSim.setKinds`); `Traffic` draws two instanced meshes per kind (paint and rest), kinds not in use cost nothing, plain boxes until the models load. At High (13 cars on the road): +29 draw calls, +38k triangles. Credit in `assets/ASSETS.md`. Self-test 33 checks. `HANDOFF.md` rewritten (status, vehicles, traffic, phases).
For the other stream (Anshul): look at the traffic and judge the style. The models are stylised low-poly (1,400 to 2,000 triangles each), not GTA V realism; real GTA-grade cars are not available as a free licensed download, so if you want them, download or buy a licensed pack and I will run it through the same pipeline.
Status: open

## 2026-11-16 05:30  Autodrive and traffic conflict found and fixed; all eight locations smoke-tested
Branch: feat/plan-n0-n1 (stacked on PR 22)
What changed: running the autodrive in every location with traffic on showed the autodrive drove on the road's centre line and into the back of slower cars (it stopped dead and dropped out). `src/input/autodrive.js` now takes `lane(dir)` (it aims at its lane's offset, so it no longer straddles the line oncoming cars use) and `leader(phys, s)` (it follows the car in front at a gap of 8 m plus 1.4 s, and stops short for an obstacle); `src/traffic/sim.js` has `leaderAhead()` for it; `src/main.js` wires both. New self-test: the real vehicle physics under the autodrive on the real road among busy traffic, with a slow truck put 150 m ahead, 90 s, both driving sides: followed the truck for about 79 s at 14 to 16 m, no hits, lane kept (self-test 33 checks). All eight locations autodrove cleanly for 12 s with traffic (table in `VISUAL_MATRIX.md`).
For the other stream (Anshul): the autodrive now drives in a lane, so on a two-lane road it is on the right (left in India) and not on the centre line; check it feels right.
Status: open

## 2026-11-16 04:00  Master Plan N5 (part 2): traffic with modes
Branch: feat/plan-n0-n1 (stacked on PR 22)
What changed: new `src/traffic/sim.js` (pure) and `src/traffic/traffic.js` (instanced meshes: sedan, van, truck plus tail and head lights = about 5 draw calls). Modes off / light (6 cars) / busy (16) in Settings > Traffic (default Light, Off on the low tier), saved with the other choices (`src/core/saved.js` checks it). Cars use the road's own lanes (`laneOffsets` from the style), keep right or left (`drive: 'left'` added to Mumbai, Delhi and Agra in `locations.js`), appear deterministically from the world seed and a 60 m slot number inside a window (700 m ahead, 350 m behind), never within 150 m of the player nor on top of another car, keep a safe gap, slow for bends (same rule as the autodrive), stop for the player in their lane, are removed if stuck 12 s or out of the window. `Traffic.circles()` feeds `world.near` in `src/main.js`, so a car is a solid obstacle for the player (tested for the car and the truck: hit, never through). Self-test 32 checks (new: lanes and sides in both drive modes, no overlaps, nothing near the player at birth, bounded counts, determinism, bridges, mode changes, jump along the road, stopping for an obstacle, collision). Measured: +5 draw calls, +2,600 triangles at Busy, 0.02 ms per frame of simulation. Limits are listed in `HANDOFF.md`.
For the other stream (Anshul): drive among them and judge the speeds, spacing and look; try it on a phone before turning it on by default there; the cars have no sound.
Status: open

## 2026-11-16 02:30  Master Plan N5 (part 1): My music, controller rumble, safe saved choices, tuner worker hardening
Branch: feat/plan-n0-n1 (stacked on PR 22)
What changed: (1) **My music**: `src/audio/localmusic.js` (pure: which files are kept, clean titles), `src/audio/radio.js` (`addLocal`, `skipTrack`, `clearLocal`, a "My music" station that plays the songs round and round and frees them), `src/ui/radiowheel.js` ("Add my songs" button and file picker, "My music" tab, "Next song"); files stay in the browser, nothing is uploaded; checked live with two generated tones and a text file. (2) **Rumble**: `src/input/rumble.js` (pure rules from telemetry: thump on a hit, buzz on gravel/grass/sand/snow, slide, boost, handbrake) and `Controls.rumble()` (feature-detected), Settings > Controller rumble; checked live with a fake pad. (3) **Saved choices** are validated on load (`src/core/saved.js`): a null `paint` used to crash the garage and a text radio volume used to throw; tested with 19 kinds of rubbish and live with damaged storage. (4) **Worker** (`cloudflare/worker.js`): numbers limited to 10 million, size refused from the declared length before reading, 0.4 s wait on a wrong password, `nosniff`; tests extended (bad JSON, array body, absurd numbers, oversize, slow wrong password, no password set). Self-test 30 checks. `HANDOFF.md` has a "Tuner security" section with what is in place and the one decision left for the owner (hide the page itself or not).
For the other stream (Anshul): listen to My music and try a gamepad; the Cloudflare KV and `TUNER_PASSWORD` setup is still yours to run.
Status: open

## 2026-11-16 01:10  Master Plan N4 (first part): loading screen, `?bench=30`, measured tiers
Branch: feat/plan-n0-n1 (stacked on PR 22)
What changed: `next.html` + `src/main.js`: loading screen (what is loading, a bar, fades at the first drawn frame); `?bench=30` autodrives for 30 s and shows a panel with average/95%/99%/worst frame time, draw calls, triangles, geometries, textures, MB downloaded and JS heap (also `BENCH {...}` in the console and `window.__bench`). `PERFORMANCE.md`: how to measure on any device and the numbers for low/med/high on this desktop (5.6 / 5.6 / 9.1 ms average, capped at about 180 fps by the display; 183 / 520 / 878 draw calls; 140k / 428k / 826k triangles; 12.3 MB downloaded). The old "24 ms on high" note is replaced. `CHECKLIST.md` has the benchmark and loading-screen lines.
For the other stream (Anshul): run `&bench=30` on each phone for low, med and high and paste the panels into this log; that is the plan's N4 gate. Nothing is compressed yet (KTX2/meshopt) because no device has shown a need.
Status: open

## 2026-11-16 00:30  Master Plan N2: weather and lighting made to read (weather matrix, fixes)
Branch: feat/plan-n0-n1 (stacked on PR 22)
What changed: `src/env/environment.js`: bad weather now lowers the reflected sky light (`scene.environmentIntensity = 1 - 0.55 * dark`) and the sky hemisphere light, darkens wet ground to 66%, and has denser fog (overcast .75, rain .42, storm .28, snow .32); `src/fx/grade.js` + `src/main.js`: the colour grade fades colour and brightness with the weather (rain: saturate 0.77, brightness 0.91). Before this, rain and storm at midday looked almost like clear weather. Captured the matrix on a desktop (California): `VISUAL_MATRIX.md` says what was and was not looked at. White paint: 1.1% of bright pixels clipped, not a blown blob.
For the other stream (Anshul): judge the weather and the night on your own screen and a phone; dawn, overcast/fog/storm at dusk and night, other locations and low/high tiers are not captured yet.
Status: open

## 2026-11-15 23:50  Master Plan N0 and N1 done by Rajul's Claude on Rajul's instruction (both streams); Anshul please review
Branch: feat/plan-n0-n1
What changed: (1) Telemetry contract `phys.telemetry()` and `VEHICLE_CONTRACT.md` (one meaning for speed, gear, revs, slip, with units); the sound reads gear and revs from it. (2) The truck and bike now have real powertrain data in `defs.js` (truck: 300 kW diesel, 8 gears, 0.5 s shifts; bike: 75 kW, 6 gears, quick shifts, own lean model via `tyres: false`) and use `powertrain()`; the truck also uses the tyre model. (3) Gearbox hunting fixed: it never upshifts into a gear it would shift straight out of; downshift points are data (`down`, `downEasy`); per-vehicle `brakeMul`, `downforce`. (4) New `tools/vehicle_acceptance.mjs` (in `daily_check.py`): car 0-100 in 3.3 s, top 269, 130 to 0 in 55 m; truck 0-100 in 32 s, top 111, 88 to 0 in 45 m, climbs a 10% hill at 44 km/h; bike 0-100 in 4.2 s, top 200; all repeatable to the last digit. (5) Tunnel signal from the road (`road.tunnelW` at the camera's nearest road point): no rain, snow or thunder inside, roomier reverb; checked in the Himalayas (hidden inside, visible before and after). (6) Vendored Rapier init patched to the object form its own warning asks for (the deprecation message is gone). (7) `CHECKLIST.md` has lines for the rails, car, handling, look, camera and tuner.
For the other stream (Anshul): read `VEHICLE_CONTRACT.md`, drive all three vehicles and listen to the sound (nothing here has been judged by a person); the engine sound for truck and bike still uses the synthesised voice, now fed real revs and gear.
Status: open

## 2026-11-15 18:00  Drivetrain telemetry in the sound, camera juice, handling feel knobs (done by Rajul's Claude on Rajul's request; Stream B files)
Branch: feat/nfs-handling (PR 20)
What changed: (1) `src/vehicle/rapier-vehicle.js`: `phys.gear` and `phys.rpm` now stay valid off the throttle too (gearbox changes down while coasting, revs idle at a standstill and rise with throttle in first gear). (2) `src/main.js` passes `rpm01` (0..1 between idle and redline) and `gear` to `sound.update`; `src/audio/engine.js` uses them for pitch, the seven-loop crossfade and the shift dip when they are given, and falls back to the old speed-based guess for the truck and bike (they have no `p.pt`). (3) Chase camera (`src/vehicle/vehicle.js`, constants in new pure module `src/vehicle/camfx.js`, tuner root "camera"): springy FOV kick on boost and hard acceleration (about +7 degrees, 0.5 s, small overshoot), faint speed shake (zero below 28 m/s, about 1.7 cm and 0.2 degrees of roll at 70 m/s, doubled with boost), and slower camera yaw in slides (`driftLag`). (4) Handling: new tuner settings `combined` (traction circle: power costs cornering grip, so hard throttle in a low gear gives power oversteer), `steerLock` (front lock at speed, default 3.5, was fixed at 2.1), `lockGrip` 1 (a locked rear wheel keeps no sideways grip); `tyreAssist` stays 0.3. All have help in `core/tuning-docs.js`; selftest 25 of 25, daily_check 10 passed.
Not verified by hand: the sound (nobody has listened with the real revs), the camera feel, and drift feel. A handbrake flick at 100 km/h only reaches about 0.1 rad body slip (a stable, high-grip car); drifts start at lower speed. Please drive it, then tune with the tuner sliders under "handling" and "camera".
For the other stream (Rajul): nothing to do.
Status: open


# Handoff

State of the work as of 14 November 2026, end of Rajul's session. Read `OVERVIEW.md` first for what the project is, `CLAUDE.md` for how the two Claudes work together, `CHECKLIST.md` for the daily checks, and `PARALLEL_PLAN.md` ("Phases from here") and `team/photoreal-plan.md` for the plans.

## Where things stand

State as of 16 November 2026. Written after pull requests 1 to 21 were merged into `main` and a large branch (`feat/plan-n0-n1`, pull request 22) worked through the Master Plan (the plan came from an outside review of a ZIP and is not in the repo; check its claims against the code).

- **On `main`:** pull requests 1 to 21: terrain rings and rocks (-29% triangles), Marine Drive, gentler mountain roads, the powertrain and Magic Formula tyre model, arcade handling, quick steering, colour grade and paint, the Aero Concept car, bridge rail collision, the world contract note.
- **In pull request 22 (open, not merged):** N0 to N5 work done for both streams at Rajul's request: telemetry contract, truck and bike powertrains, vehicle acceptance script, tunnel-aware weather sound, weather and lighting that read, loading screen and `?bench=30`, My music, controller rumble, validated saved choices, hardened tuner worker, traffic (Off / Low / Mid / High) with real vehicle models, autodrive that keeps a lane and follows traffic, **your original Dusk GT restored as the first vehicle** (the new car is a fourth vehicle, "Aero Concept"), and a vehicle set for traffic (below).
- **Live site: NOT updated.** https://game-for-peace.anshul-rawat.workers.dev still serves the last deploy (version `4ab7b600`). `/` is the original game; `/next` is the new engine. **Waiting on Anshul** (account `rawatanshul525@gmail.com`; `wrangler whoami` on Rajul's PC says a different account, so Rajul did not deploy).
- **Checks:** `python tools/daily_check.py` (self-test 33 checks, vehicle acceptance, every location builds a road, deploy folder current, asset sizes and credits, open log entries). `CHECKLIST.md` lists the manual checks.
- **Accounts:** Cloudflare and GitHub belong to rawatanshul525@gmail.com. Nobody else deploys.
- **Stream B (Anshul) has not reviewed any of this.** Rajul's Claude changed many Stream B files at Rajul's request; every change is logged in `team/stream-a.md` and `team/stream-b.md` (all `open`). **Anshul should read both logs and drive, listen and phone-test before N1 is called done.**
- **Nothing here has been judged by a person on a real phone**, and nobody has listened to the engine with the real revs.

## What is in the game now (`/next`, `next.html`)

- **World:** seeded terrain, a routed road in five styles (`?road=highway|boulevard|dirt|gravel`), bridges over water, tunnels instead of deep cuttings (Atal-Tunnel-style gate with a name board, tiled lit interior), eight locations (Himalayas start in snow), real-scan trees, plants and rocks, photographic ground and roads.
- **Look:** three.js r187; quality tiers `?q=low|med|high` (phones start on low); `?ground=flat|lite|full`, `?nature=flat|low|full`; optional `?fx=1` realism pipeline (little gain, off by default).
- **Driving:** Rapier ray-cast vehicle. Controls: W gas, S reverse (brakes first while rolling forward), **Space foot brake** (never reverses), **X handbrake**, **Shift boost**, **E autodrive**, **V** cycles seven camera views (Chase, Far, Close, Hood, Bumper, Driver seat, Cinematic), C driver's seat and back. Body squats, dips and leans; engine braking works on grass. Phones: slowroads-style touch controls (throttle lever, Brake, Hand, Rev, Boost, steering arc, Reset, Cam, Auto) and a closer, lower chase camera.
- **Vehicles (garage):** Dusk GT (the original sports car, `car_01_gt.glb`, striped paint), Freight Hauler (truck), Volt Bike, Aero Concept (the new detailed coupe with a full cockpit, `car_04_concept.glb`, CC BY 4.0). All four use the same real powertrain model with their own data.
- **Traffic** (Settings > Traffic: Off / Low 6 cars / Mid 12 / High 20; default Off on the phone tier, Low on medium, Mid on high; the old names "light" and "busy" still load): cars in the road's own lanes, on the left in Mumbai, Delhi and Agra; thirteen kinds of vehicle (sedan, hatchback, SUV, luxury SUV, sports sedan, van, delivery truck, truck, taxi, police, ambulance, garbage truck, fire truck) from the CC0 Kenney Car Kit rebuilt by `tools/blender/make_traffic_pack.py` to real proportions with true round wheels (`assets/traffic/`); the paint of the ordinary cars is tinted from a real-world colour mix (black, white, silver and grey most often), taxis, police, ambulances, garbage and fire trucks keep their own liveries. They are low-poly and stylised (about 1,400 to 2,000 triangles each), **not GTA-level realism**; if you want GTA-grade cars, buy or download a licensed pack and rerun the same pipeline.
- **Sound:** the car's engine is seven seamless loops cut from Rajul's own recording (`assets/audio`, `tools/make_engine_loops.mjs`); `?engine=synth` plays the old synthesised engine. Truck and bike still use synthesis.
- **Tuner:** `tuner.html` (via `python tools/serve.py`): about 290 live settings with "i" explainers, Export/Import, Publish to a Cloudflare worker (needs the setup below).
- **Team workflow:** each Claude writes its own `team/stream-a.md` or `team/stream-b.md` and reads both (`/sync`); sources and licences of every outside asset are in `assets/ASSETS.md`.

## To deploy (Anshul, on the PC signed in as the project account)

```bash
git switch main && git pull
npx wrangler whoami                       # must say rawatanshul525@gmail.com
cd cloudflare && npx wrangler deploy      # run `python tools/stage_cloudflare.py` first only if files changed since the last stage
```

For tuner Publish (once): `npx wrangler kv namespace create SETTINGS`, add the printed id to `cloudflare/wrangler.jsonc` as `"kv_namespaces": [{ "binding": "SETTINGS", "id": "<id>" }]`, run `npx wrangler secret put TUNER_PASSWORD`, then deploy again. Until then the API answers 503 and the game ignores it. The tuner page has no login of its own (it cannot publish without the password).

## What is next: phases from here

Full table with owners and "done when" is in `PARALLEL_PLAN.md`; the outside Master Plan uses the same N0 to N6 labels. Status after pull request 22:

1. **N0 (needs people):** Anshul deploys; both people go through `CHECKLIST.md`; two real phones; listen to the engine. Baseline checked by script on the real clone; every defect is in the list below.
2. **N1 Driving and sound:** built (telemetry, powertrains for all three, acceptance numbers, tunnel-aware weather sound). **Open:** a person must drive each vehicle and listen; cleaner engine recordings; tyre, road and wind sound refinement; truck and bike sound pass.
3. **N2 Weather and look:** weather matrix captured and fixed on a desktop (California). **Open:** dawn, overcast, fog and storm at dusk and night, other locations, other tiers, headlight beam check at night, bridge and tunnel at night and in rain.
4. **N3 World (Stream A):** bridge rail collision and the world contract done; location smoke test done. **Done since:** tunnel walkway (a raised ledge on both walls), speed-limit, exit and SOS signs. **Open:** steel truss bridge, retaining walls, tall grass and ground normal maps, tree levels of detail (an early try saved only 0.4%, so measure first), better hotel model, southern coast landmark, real Rohtang terrain research, collision for tunnel walls and bridge piers.
5. **N4 Phones and speed:** loading screen, `?bench=30` and tier numbers done (`PERFORMANCE.md`). **Open:** run the benchmark on two real phones; compressed textures and meshes only if a phone needs them; long-session leak test.
6. **N5 Features:** traffic with levels and real models, My music, rumble, safe saved choices, tuner worker limits all built and tested. **Open:** vehicle customisation beyond paint, the tuner page's own login (a decision for the owner, see "Tuner security"), the one-time Cloudflare setup.
7. **N6 Switch-over and launch:** not started and must not start until N0 to N5 pass on real devices: `index.html` becomes the new engine, `game.js` retired, final checklist, Anshul deploys with a rollback target recorded.

## Known problems (the N0 defect list, most serious first)

1. **Nothing has been checked by a person on a real phone**, and nobody has listened to the engine sound with the real revs, or driven the new handling and car by hand. All numbers in the logs are from scripts. Do `CHECKLIST.md` sections 3 to 5.
2. **Heavy car on phones:** the new car is 67,806 triangles and 41 draw calls on every tier (the old one was 16,000). Measure on a phone; if it costs too much, cut it or add a lower model for the low tier.
3. **Live deploy is out of date** and the tuner Publish needs its one-time Cloudflare setup (below).
4. **Weather and time** were captured on a desktop only, California only (`VISUAL_MATRIX.md` lists what was and was not looked at); rain, snow and thunder are now off inside tunnels (the road's own tunnel signal), checked in the Himalayas but not heard by a person.
5. **Tunnel walls and bridge piers have no obstacle circles**; not tested whether the car can reach them.
6. **Engine sound:** the car's loops (from the owner's own recording) have road and wind noise, and the sound now follows the car's real revs and gear, but nobody has listened to it. The truck and bike use the synthesised engine, the guessed gear and the old simple physics.
7. **Inside the new car** the steering wheel model does not turn.
8. **Rapier prints a warning** in the self-test ("using deprecated parameters for the initialization function"); check the right API before changing it.
9. Handbrake drift at 100 km/h gives about 15 to 20 degrees of slide; whether that feels right is unknown.
10. **Not done yet from the plan:** weather-aware sky and lighting (N2), tall grass and ground normal maps, tree levels of detail, steel truss bridge and retaining walls, southern coast landmark, better hotel model (N3); loading screen, compressed textures and meshes, phone budgets (N4); traffic, "My music", controller rumble, tuner password (N5); switch of `index.html` (N6).
- **Traffic** (`src/traffic/`, Settings > Traffic) is plain box cars in lanes: no overtaking, no horns or engine sound, no traffic lights, it does not react to a player driving the wrong way beyond stopping for an obstacle in its lane. Cars are removed if stuck for 12 s. Default Off on the low (phone) tier until measured on a phone; it costs 5 draw calls and about 2,600 triangles at Busy on a desktop, and 0.02 ms a frame of simulation.
- **My music** keeps the songs in memory only: after a reload they must be added again (storing the file handles in the browser is possible later; nothing is ever uploaded).
- The Poly Haven hero trees (958 MB, 487 MB) are unusable in a browser: do not download them.
- Blender scripts in `tools/blender/` that were run from a scratch folder need their paths adjusted before reuse (the new `make_car_concept.py` takes its paths as arguments).
- Line endings are mixed LF and CRLF: make surgical edits and check `git diff --stat`. `git diff --check` flags CRLF files as trailing whitespace; that is a false alarm.
- Worlds from earlier handoffs look different (sea, bend radius, bridges and tunnels changed the roads).

## Tuner security (N5): what is in place and what is still a decision

In place (tested in the self-test): the page `tuner.html` is `noindex`; reading `/api/settings` is open (the game reads it at start); publishing and history need the password (`TUNER_PASSWORD`, a Cloudflare secret, never in the repo) and compare it in constant time; a wrong password waits 0.4 s before the answer; bodies over 64 KB are refused (also from the declared size, before reading); only paths of letters, digits, dots, underscores and dashes with a plain number (up to 10 million) or a `#rrggbb` colour are accepted; at most 2000 settings; 15 versions of history; no KV or no password gives a clear 503 and the rest of the site is untouched.

**Still a decision for the owner (not made by the code):** whether the tuner page itself should be hidden behind a login. Today anyone who finds `/tuner.html` can open it and change the settings in their own browser, but cannot publish without the password. Making the page private needs Cloudflare Access (or a second password screen) set up by the account owner. A simple, safe default: leave the page unlinked and `noindex`, keep the publish password strong, and decide later if more people join.

Open: the one-time Cloudflare setup (KV namespace and secret) is still pending, so Publish does not work live yet.

## How to test engine work

- `python tools/daily_check.py` first, then the manual items in `CHECKLIST.md`.
- `node tools/selftest.mjs` (headless: terrain, road, bridges, tunnels, tuning, worker, vehicles).
- `python tools/serve.py` (add `--lan` to reach it from a phone on the same wifi), then `http://localhost:8765/next.html?play` (add `&loc=alps|himalayas|california|south|mumbai|delhi|agra`, `&road=`, `&q=low|med|high`, `&touch` for the phone controls on a computer, `&debug`).
- `window.__next` exposes the engine for checks from the console: `step`, `placeOnRoad(s)`, `setMode`, `env.setWeather`, `env.setTime`, `road`, `terrain`, `scatter`, `roadMesh`, `phys`, `view`, `sound`, `controls`. The browser pauses its frame loop when the pane is hidden: drive frames by hand with `step`.

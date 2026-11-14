# Handoff

State of the work as of 14 November 2026, end of Rajul's session. Read `OVERVIEW.md` first for what the project is, `CLAUDE.md` for how the two Claudes work together, `CHECKLIST.md` for the daily checks, and `PARALLEL_PLAN.md` ("Phases from here") and `team/photoreal-plan.md` for the plans.

## Where things stand

State as of 15 November 2026 (updated after pull requests 16 to 20 were merged and the Master Plan audit; the plan itself is not in the repo, it came from an outside review of a ZIP, so check its claims against the code).

- **`main` has everything.** Pull requests 1 to 20 are merged. New since 14 November: coarser outer terrain ring and cheaper far rocks (-29% triangles on medium), Marine Drive fixed and placed near the start, gentler Alps and Himalayas roads, a real powertrain and Magic Formula tyre model for the car, the arcade handling layer, quicker steering, a colour grade with clearcoat paint, a new detailed car (Khronos CarConcept, CC BY 4.0, `assets/car_04_concept.glb`), tuner groups "handling", "camera" and "look" with a Reset button on every section, and bridge rail collision (`src/world/bridge_rails.js`, see `WORLD_CONTRACT.md`).
- **Live site: NOT updated.** https://game-for-peace.anshul-rawat.workers.dev still serves the last deploy (version `4ab7b600`). `/` is the original game; `/next` is the new engine. **Waiting on Anshul** (account `rawatanshul525@gmail.com`; `wrangler whoami` on Rajul's PC says a different account, so Rajul did not deploy).
- **Checks:** `python tools/daily_check.py` (self-test 32 checks, every location builds a road, deploy folder current, asset sizes and credits, open log entries). `CHECKLIST.md` lists the manual checks.
- **Accounts:** Cloudflare and GitHub belong to rawatanshul525@gmail.com. Nobody else deploys.
- **Stream B (Anshul) has not reviewed any of this.** Rajul's Claude changed many Stream B files at Rajul's request (`rapier-vehicle.js`, `defs.js`, `vehicle.js`, `engine.js`, `environment.js`, `main.js`, and the car asset); every change is logged in `team/stream-a.md`, and one entry in `team/stream-b.md` was written for Anshul. **Anshul should read both logs and review the handling and sound before N1 is called done.**

## What is in the game now (`/next`, `next.html`)

- **World:** seeded terrain, a routed road in five styles (`?road=highway|boulevard|dirt|gravel`), bridges over water, tunnels instead of deep cuttings (Atal-Tunnel-style gate with a name board, tiled lit interior), eight locations (Himalayas start in snow), real-scan trees, plants and rocks, photographic ground and roads.
- **Look:** three.js r187; quality tiers `?q=low|med|high` (phones start on low); `?ground=flat|lite|full`, `?nature=flat|low|full`; optional `?fx=1` realism pipeline (little gain, off by default).
- **Driving:** Rapier ray-cast vehicle. Controls: W gas, S reverse (brakes first while rolling forward), **Space foot brake** (never reverses), **X handbrake**, **Shift boost**, **E autodrive**, **V** cycles seven camera views (Chase, Far, Close, Hood, Bumper, Driver seat, Cinematic), C driver's seat and back. Body squats, dips and leans; engine braking works on grass. Phones: slowroads-style touch controls (throttle lever, Brake, Hand, Rev, Boost, steering arc, Reset, Cam, Auto) and a closer, lower chase camera.
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

Full table with owners and "done when" is in `PARALLEL_PLAN.md`. In order:

1. **N0, this week: deploy, then look and listen.** Anshul deploys; both people go through `CHECKLIST.md`; test on at least two real phones; listen to the engine sound. Write every defect into the team log before new features.
2. **N1 Driving and sound (Stream B).** Cleaner engine recordings at steady revs, tyre and road sounds, rain sound out of tunnels; a physics feel pass with the constants moved into the tuner; new vehicle models and paint, the sports car and rally hatchback, manual gears.
3. **N2 Sky, weather and vehicles' look (Stream B, with A).** HDRI that follows weather and time, fog and clouds, wet and snow surfaces, headlights; detailed vehicles; a calmer, hazier colour grade like slowroads.
4. **N3 World polish (Stream A).** Tall-grass look and normal maps on the ground; tree levels of detail; Marine Drive seafront, southern coast landmark, hotel model; bridge rail collision, steel truss bridge and retaining walls from the Atal references; steep-land driving checks; real Rohtang terrain from open height data (research first).
5. **N4 Phones and speed (both).** Compressed textures and meshes, draw-call budgets, tune the high tier (9.1 ms on a desktop now, see `PERFORMANCE.md`; phones not measured), loading screen, frame-time budget per tier, acceptance on two real phones.
6. **N5 Features (Stream B).** Traffic with modes, "My music" station in the radio, controller rumble, vehicle customisation, tuner password and Publish setup.
7. **N6 Switch-over and launch (both).** `index.html` becomes the new engine, `game.js` retired, final run of the checklist, deploy.

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

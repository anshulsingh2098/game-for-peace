# Handoff

State of the work as of 14 November 2026, end of Rajul's session. Read `OVERVIEW.md` first for what the project is, `CLAUDE.md` for how the two Claudes work together, `CHECKLIST.md` for the daily checks, and `PARALLEL_PLAN.md` ("Phases from here") and `team/photoreal-plan.md` for the plans.

## Where things stand

- **`main` has everything.** Pull requests 1 to 13 are merged and no branch is open; old branches (`world/*`, `tuner/dashboard`, `render/*`, `feature/*`, `fix/*`, `docs/*`, `plan/*`, `team/*`) can be deleted.
- **Live site: NOT updated.** https://game-for-peace.anshul-rawat.workers.dev still serves the last deploy (version `4ab7b600`). `/` is the original game; `/next` is the new engine. **Waiting on Anshul** to deploy `main`: Rajul's PC is signed in to wrangler as his own account, and only `rawatanshul525@gmail.com` may be used. `cloudflare/public` is already staged from `main`.
- **Checks:** `python tools/daily_check.py` runs every automatic check (self-test 25 checks, every location builds a road, deploy folder current, asset sizes and credits, open log entries). `CHECKLIST.md` lists what a person must look at.
- **Accounts:** Cloudflare and GitHub belong to rawatanshul525@gmail.com. Nobody else deploys.
- **Stream B (Anshul) has not started:** `team/stream-b.md` is empty. Rajul's Claude has made some changes in Stream B's files at Rajul's request (all logged in `team/stream-a.md`).

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
5. **N4 Phones and speed (both).** Compressed textures and meshes, draw-call budgets, tune the high tier (about 24 ms on an M4 now), loading screen, frame-time budget per tier, acceptance on two real phones.
6. **N5 Features (Stream B).** Traffic with modes, "My music" station in the radio, controller rumble, vehicle customisation, tuner password and Publish setup.
7. **N6 Switch-over and launch (both).** `index.html` becomes the new engine, `game.js` retired, final run of the checklist, deploy.

## Known problems

- **Not verified by a person:** the new engine sound, driving feel (brake, handbrake, reverse, grass), touch controls on a real phone, camera views while driving, landmarks beyond screenshots. Nothing has been measured on a phone.
- The engine sound recording has road and wind noise; the loops are good but not studio clean. See `team/stream-a.md` for what to record next.
- Marine Drive's promenade and sea wall do not appear on the default Mumbai seed.
- Bridge rails have no collision: a car can drive off the side.
- Rain and thunder sound still play inside tunnels.
- White car paint glares under the new lighting.
- The Poly Haven hero trees (958 MB, 487 MB) are unusable in a browser: do not download them.
- Blender scripts in `tools/blender/` were run from a scratch folder; their paths need adjusting before reuse.
- Line endings are mixed LF and CRLF: make surgical edits and check `git diff --stat`.
- Worlds from earlier handoffs look different (sea, bend radius, bridges and tunnels changed the roads).

## How to test engine work

- `python tools/daily_check.py` first, then the manual items in `CHECKLIST.md`.
- `node tools/selftest.mjs` (headless: terrain, road, bridges, tunnels, tuning, worker, vehicles).
- `python tools/serve.py` (add `--lan` to reach it from a phone on the same wifi), then `http://localhost:8765/next.html?play` (add `&loc=alps|himalayas|california|south|mumbai|delhi|agra`, `&road=`, `&q=low|med|high`, `&touch` for the phone controls on a computer, `&debug`).
- `window.__next` exposes the engine for checks from the console: `step`, `placeOnRoad(s)`, `setMode`, `env.setWeather`, `env.setTime`, `road`, `terrain`, `scatter`, `roadMesh`, `phys`, `view`, `sound`, `controls`. The browser pauses its frame loop when the pane is hidden: drive frames by hand with `step`.

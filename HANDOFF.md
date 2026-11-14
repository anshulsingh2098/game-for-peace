# Handoff

State of the work as of 14 November 2026, end of Rajul's session. Read `OVERVIEW.md` first for what the project is, `CLAUDE.md` for how the two Claudes work together, and `PARALLEL_PLAN.md` / `team/photoreal-plan.md` for the plans.

## Where things stand

- **`main` has everything below.** Branches `world/*`, `tuner/dashboard`, `render/r0-poc`, `plan/*` are merged and can be deleted.
- **Live site: NOT updated.** https://game-for-peace.anshul-rawat.workers.dev still serves the last deploy (version `4ab7b600`, from the old `phase/3-driving`). `/` is the original game; `/next` is the new engine. Nothing in this handoff is live until someone deploys (steps below). `cloudflare/public` has been re-staged from `main`, so deploying is one command.
- **Self-test:** 25 checks pass (`node tools/selftest.mjs`). `node tools/locations_check.mjs [id]` prints road, bridge and tunnel statistics per location.
- **Accounts:** Cloudflare and GitHub belong to rawatanshul525@gmail.com. Only Anshul's PC is logged in to wrangler; nobody else deploys.

## What changed since the last handoff

- **Roads (Stream A, Phase 1):** five road styles as data in `src/world/roadstyles.js` (two-lane, highway, boulevard, dirt, gravel; try `?road=highway`), minimum bend radius raised to 130, boulevards in Mumbai, Delhi and Agra, a highway in California.
- **Bridges and tunnels (Phase 2):** bridges where the road crosses water (`bridges.js`), tunnels instead of deep cuttings (`tunnels.js`). Atal-Tunnel-style: a Blender-modelled gate with a name board, a tiled lit interior, orange cones, a hut. Himalayas start in snow.
- **Tuner dashboard:** `tuner.html` (open via `python tools/serve.py`): live sliders for about 290 settings with "i" explainers, Export/Import `settings.json`, and Publish to a Cloudflare worker (`cloudflare/worker.js`). Publish does nothing until the one-time setup below.
- **Photoreal track (see `team/photoreal-plan.md`):** three.js upgraded r160 to r187; optional realism pipeline `?fx=1` (little visible gain, 3.5x the cost: off by default); photographic ground (`world/groundmat.js`, `?ground=flat` for the old one) and roads (ambientCG textures); real-scan trees, plants and rocks from Poly Haven rendered in Blender (`world/nature.js`, `?nature=flat`). Sources and licences for every outside asset: `assets/ASSETS.md`.
- **Team log:** each Claude writes its own `team/stream-a.md` or `team/stream-b.md` and reads both (`/sync`).

## To deploy (Anshul, one time then routine)

```bash
python tools/stage_cloudflare.py          # only if you changed files since the last stage
cd cloudflare && npx wrangler deploy
```

For tuner Publish (once): `npx wrangler kv namespace create SETTINGS`, add the printed id to `cloudflare/wrangler.jsonc` as `"kv_namespaces": [{ "binding": "SETTINGS", "id": "<id>" }]`, run `npx wrangler secret put TUNER_PASSWORD`, then deploy. Until then the API answers 503 and the game ignores it. The tuner page itself has no login (it cannot publish without the password).

## What is next

1. **Look at it yourself, then deploy.** All visual checks so far were small screenshots. Open `next.html?play&loc=himalayas` and `?loc=alps`, compare with `?ground=flat&nature=flat`.
2. **Phones.** Nothing here has been measured on a phone: the photographic ground, scanned scenery and tunnels are heavier. Add quality tiers (R6) before real users see `/next`.
3. **Stream B has not started.** `team/stream-b.md` is empty. Open items for B: vehicle models and paint (the white paint glares under the new lighting), sky and weather realism and an HDRI that follows weather (R2/R3), tunnel rain and thunder sound, the hard-coded physics numbers for the tuner, the sports car and rally hatchback, gears, traffic, the old game's music upload and the switch of `index.html` to the new engine.
4. **Stream A, remaining:** normal maps on the ground, the steel truss bridge and curved retaining walls from the Atal references, interior signs and walkway, location polish (southern coast landmark, Marine Drive seafront is missing on the default Mumbai seed, plainer Taj hotel model), steep-land driving checks in the Alps and Himalayas, frame-cost spikes.
5. **Rail collision on bridges** is missing: a car can drive off the side (needs the shared collision list).

## Known problems

- Not verified by a person: driving feel, car engine sound, menus on a phone, landmarks beyond screenshots, how `?fx=1` looks on a real screen.
- Marine Drive's promenade and sea wall do not appear on the default Mumbai seed.
- Rain and thunder sound still play inside tunnels.
- Blender scripts in `tools/blender/` were run from a scratch folder; their file paths need adjusting before reuse.
- The huge Poly Haven hero trees (958 MB, 487 MB) are unusable in a browser: do not download them.
- Line endings are mixed LF and CRLF: make surgical edits, check `git diff --stat`.
- Old seeds changed over time (sea cut in Phase 2, bend radius, bridges and tunnels): worlds from earlier handoffs look different.

## How to test engine work

- `node tools/selftest.mjs` (headless: terrain, road, bridges, tunnels, tuning, worker, vehicles).
- `python tools/serve.py 8791`, then `http://localhost:8791/next.html?q=med&play` (add `&loc=alps|himalayas|california|south|mumbai|delhi|agra`, `&road=highway|boulevard|dirt|gravel`, `&debug`).
- `window.__next` exposes the engine for checks from the console: `step`, `placeOnRoad(s)`, `setMode('fly'|'drive')`, `env.setWeather`, `env.setTime`, `road`, `terrain`, `scatter`, `roadMesh`, `fx`.

# Handoff

State of the work as of 14 November 2026, end of Rajul's session. Read `OVERVIEW.md` first for what the project is, `CLAUDE.md` for how the two Claudes work together, `CHECKLIST.md` for the daily checks, and `PARALLEL_PLAN.md` ("Phases from here") and `team/photoreal-plan.md` for the plans.


## State on the Delhi street life (D7, 17 Nov 2026, branch `claude/delhi-d7-streetlife-29f2c5`, PR against main)
Built: `assets/cities/delhi/identity.json` + `src/world/city/{identity,streetart,streetlife,vehicles,citybus}.js`; small changes in `tilemesh.js`, `cityworld.js`, `citytraffic.js`, `citypeds.js` and `pedestrians.js` (`p.cloth`). `?play&city=delhi` now has shop boards, wires, trees, ads, nine vehicle kinds and buses on routes; `?month=N` sets the haze, `?life=off` gives the old plain city. Details, numbers and the open list: `docs/DELHI_LOOK.md` sections 9 and 10, `docs/WORK_REMAINING.md` section 13. Not measured on a phone, not seen under real lights (the browser pane renders black).
## State on the Delhi renderer fixes (17 Nov 2026, branch `claude/delhi-d5b-fixes-fa289f`, PR against main)
Done (details in `docs/WORK_REMAINING.md` section 12): city GPS (`src/ui/citymap.js`, `src/world/city/citynav.js`, keys: P map, E autodrive follows the route), gate fade and gate-to-road mapping (`src/world/city/gates.js`, `RoadNetwork.worldStart(city, { road, toward })`, save field `enclave`), underpasses (`tilemesh.js` `underpass`, `cuts.js`, `CityWorld.groundAt`), kerbs, sliced meshing and skyline (`skyline.js`), pedestrians (`citypeds.js`) and signals (`citytraffic.js`), facade kits. Shared files touched: `src/main.js`, `src/input/autodrive.js` (`lookMin`, `forward`), `src/vehicle/physics.js` and `rapier-vehicle.js` (kerb circles ignored below 2.5 m/s), `src/world/network.js`, `src/core/saved.js`. Self-test: 102 checks. Not verified: a phone, a real frame rate, night look, Metro lines on the mini-map with D6's own loader, the underpass exit ramp by eye (driven through by autodrive in the browser pane, not looked at inside).
Known: a building footprint stands on the street at (829, -2268) next to the Mandi House underpass (data, not code); some routes through narrow lanes get a stuck car, which then bans that street and plans anew.

## State on 24 Nov 2026 (everything merged into `main`)
Merged today: PR 55 (handoff and the Delhi flagship plan), 53 (railway control), 56 (D1 pack, D4 landmarks), 57 (D2 and D3 transit data) and 58 (D5 renderer); self-test 99 checks on `main`. **The game now has a Delhi city:** `?play&city=delhi` (or Delhi in the location picker, or driving into Delhi on a highway in the India world). Not deployed; `cloudflare/public` untouched. **Before the next deploy: stage the city pack** (`WORK_REMAINING.md` 12.1). **What is next, in order:** D5b finish the renderer (underpasses, kerbs, traffic and people on the pack graph, GPS and Travel in the city, smooth gate transition, level of detail and far skyline, phone measurement; list in `WORK_REMAINING.md` section 12), D6 metro and stations from `transit.json` (`docs/DELHI_TRANSIT.md`), D7 street life and the identity file, D8 landmark models, then Gurgaon and Noida, then Mumbai. Decisions waiting for the owner: GTFS terms (1.11), a Delhi person to judge the result, the deploy. Everything else people must do (phones, Anshul's review and deploy) is still open in `CHECKLIST.md`.

## State on 23 Nov 2026 (Delhi transit data, packages D2 and D3)
Branch `claude/magical-lichterman-8e5391`. Built: `assets/cities/delhi/transit.json` (Delhi Metro: 11 lines with ordered track polylines and elevated, underground or ground runs, 285 stations with codes, English and Hindi names, layout and platform type, 14 depots; 47 railway stations with platform bodies for New Delhi (16 platforms), Old Delhi (16) and the rest; 479 bus routes from OSM, 2,101 stops, 3 ISBTs, 35 depots), the tools to rebuild and validate it (`tools/build_delhi_transit.mjs`, `tools/validate_transit.mjs`, a self-test check) and `docs/DELHI_TRANSIT.md`. Not done: nothing is drawn (D6), no photograph was looked at (all look statements unverified), no bus timetable or frequency (the Delhi GTFS needs a click-through agreement: owner decision `WORK_REMAINING.md` 1.11).

## State on 22 Nov 2026 (Rajul's session, overpasses and the next big phase)
PR 49 (`claude/flyover-physics-262398`): multi-level roads (`Road.addLift`, deck layers in `RoadSet`, deck trimesh in the vehicle physics, `world/interchange.js`; the bigger road stays on the ground, the smaller goes over). Not done: slip roads, cloverleafs; `rail_view.js` still lifts the rail over roads (wrong: the road should go over the rail). A separate session builds AI railway traffic control. **Next big phase: real, unique, explorable cities, one at a time, starting with Delhi NCR: read `docs/CITY_PLAN.md`** (what is wrong now, data sources and licences, Phase 0 to 7, the per-city checklist, open questions). City centres such as Agra are currently a mess because the procedural district builds through rails and roads; Phase 0 fixes that with a shared keep-out registry and decides the city scale (the India world is 1:100, too small for real streets).

## State on the Delhi renderer D5 (branch `claude/keen-gauss-3b2756`, PR against main)
`?play&city=delhi[&at=<spawn|landmark|gate id>]` draws the Delhi pack at 1:1 around the player: `src/world/city/` (`pack.js` loader, `tilemesh.js` one tile as five meshes, `cityworld.js` streaming, keep-out claims, physics hooks), a few lines in `src/main.js`. Real streets, flyovers (decks with ramps and piers, driveable), blocks, parks, water, extruded footprints, coloured and labelled landmarks and the five stations at their real footprints. Entry: driving into Delhi on a highway reloads into the nearest-heading gate, driving out through a gate reloads the India world (page loads, not a fade); the location picker's Delhi opens the enclave (a deploy then needs the pack staged). Not built: underpasses, kerbs, traffic and people on the pack graph, GPS/Travel in a city, rails and metro (D2, another session), facade kits, far skyline, identity, phone measurement. `tools/stage_cloudflare.py` still skips `assets/cities/` (nothing links to the enclave; the pack would add 19.8 MB gzip). Log: `team/stream-a.md`; check list: `CHECKLIST.md` section 10.

## State on the Delhi data packages D1 and D4 (branch `claude/jovial-wilbur-a411de`, PR against main)
Built, offline only (nothing renders yet, that is D5): `tools/build_city.mjs` (OSM extract to a city pack, deterministic, about 20 s), `tools/validate_city.mjs`, `tools/check_city.mjs` (headless: loads the pack, routes between spawns), `tools/build_landmarks_doc.mjs`, libraries in `tools/lib/`, curated landmark source in `tools/city_data/`. The shipped pack `assets/cities/delhi/` (manifest, graph, 1,925 tiles, landmarks, ATTRIBUTION; 77.5 MB raw, 19.8 MB gzip) has 406k street edges, 244k building footprints (97 % guessed height), 82k blocks, 25 highway gates, 63 landmarks; the `selftest` checks it is current and valid (92 checks). The raw OSM extract (225 MB, ODbL, `docs/OPEN_DATA.md`) is in git-ignored `data/raw/delhi/`. **File format details and what was cut: `docs/CITY_PACK.md` section 5a; the list of places and six themed routes: `docs/DELHI_LANDMARKS.md`.** Not done: Gurgaon and Noida packs, rails and metro (D2), buses (D3), real heights, `identity.json`, any rendering, landmark `look` notes were not checked against photographs. The pack is committed once; every rebuild changes about 20 MB of tile files, so rebuild rarely and in one commit.

## State on 22 Nov 2026, later (city plan Phase 0: stop the mess, decide the architecture)
Branch `claude/goofy-liskov-0a8557`. Built: `src/world/keepout.js`, a pure and tested keep-out and ownership registry (`terrain.keepout`): roads (RoadSet provider), every rail edge and station (`registerRail` in `rail_view.js`), landmark zones (`terrain.addZone`) and every built district plot register the ground they cover; `district_plan.js`, `scatter.js` and the station buildings ask before placing. Measured in Agra, Delhi and Mumbai: a third or more of the planned plots had stood on rail beds, stations or other roads; after, none. Plots also no longer overlap each other on bends. Self-test 86 checks. Written, **waiting for the owner**: `docs/CITY_PACK.md` (recommends 1:1 city enclaves entered from highway gates, the performance budget, the versioned city pack format). Not done: `landmarks.js`/props do not ask the registry yet, nothing looked at from the air or on a phone, no data downloaded (Phase 1 needs the owner's yes). Details: `docs/CITY_PLAN.md` (Phase 0 status), `docs/WORK_REMAINING.md` section 10.

## State on 23 Nov 2026 (read this first; Rajul's session)
Merged into `main` since 20 Nov: one continuous India world with Explore cities; autodrive levels and styles with a look-ahead planner; GPS minimap and map (key P); Indian km stones and boards; field-parcel land; railways (real network from Natural Earth, stations, multi-track lines, trains that look like Indian trains with real names and a timetable, Vande Bharat routes, diesel and electric locos, maintenance trains, signals, level crossings with barriers across the road, rail over road on a long ramp, switching at stations); multi-level roads (overpass); city Phase 0 (keep-out registry, city pack architecture); state-language station announcements; real train sounds (local only). 89 self-test checks.
**Still open as PRs:** PR 53 (railway control office: blocks, signals, loops, precedence, Kavach-style braking for every train) conflicts with main (it has its own `rail_signals.js`); its session is reconciling it.
**Not in git, local only, licence unverified (owner's lawyer):** the 10 audio.com train clips (`assets/audio/trains/`), any announcement recordings (`assets/audio/announce/`).
**Next programme: Delhi as the first complete city** (`docs/CITY_PLAN.md` section "Delhi flagship", `docs/CITY_PACK.md`): accurate street map and road network from OpenStreetMap, major landmarks and tourist spots, the Delhi Metro (lines, stations, tracks), the DTC bus network, railway stations (New Delhi, Old Delhi, Hazrat Nizamuddin, Anand Vihar, Sarai Rohilla...), shops, markets, posters and ad banners, then the city's own look, vehicles and people. Work packages and owners are in that section. Nothing of it is in the game yet except the Phase 0 registry.
**Known gaps that matter:** nothing has been tried on a phone (frame rate, memory); trains do not yet stop at red signals (PR 53); Mumbai local frequencies are approximate; the announcement clips and the audio.com sounds need legal review; Anshul has not reviewed any of this work. Full list: `docs/WORK_REMAINING.md`.

## State on 20 Nov 2026 (read this first; Rajul's session)
Merged into `main` today: PR 42 (Travel screen, Indian lane discipline) and PR 43 (**one continuous India world**: Play is `?india=world`, every highway through a city streams in and out, no reload; the old locations list is the separate **Explore cities** section). Also on branch `feat/autodrive-modes`: autodrive has two levels (Auto, Cruise) and drives in the style of the current drive mode (Sport drives like a sports car).
Self-test: 74 checks. Not deployed: the live site is old and `cloudflare/public` is untouched. The complete list of known limits is `docs/WORK_REMAINING.md`; the plan for the India map is `docs/INDIA_MAP_PLAN.md`. Nobody has tried any of it on a phone and Anshul has not reviewed it.

## Where things stand

State as of 16 November 2026. Written after pull requests 1 to 22 were merged into `main` (pull request 22 worked through N0 to N5) (the plan came from an outside review of a ZIP and is not in the repo; check its claims against the code).

- **On `main`:** pull requests 1 to 22 (merged 16 Nov, commit 310a470). Pull requests 1 to 21: terrain rings and rocks (-29% triangles), Marine Drive, gentler mountain roads, the powertrain and Magic Formula tyre model, arcade handling, quick steering, colour grade and paint, the Aero Concept car, bridge rail collision, the world contract note.
- **Pull request 22 (now merged):** N0 to N5 work done for both streams at Rajul's request: telemetry contract, truck and bike powertrains, vehicle acceptance script, tunnel-aware weather sound, weather and lighting that read, loading screen and `?bench=30`, My music, controller rumble, validated saved choices, hardened tuner worker, traffic (Off / Low / Mid / High) with real vehicle models, autodrive that keeps a lane and follows traffic, **your original Dusk GT restored as the first vehicle** (the new car is a fourth vehicle, "Aero Concept"), and a vehicle set for traffic (below).
- **Live site: NOT updated.** https://game-for-peace.anshul-rawat.workers.dev still serves the last deploy (version `4ab7b600`). `/` is still the original game there; **in `main` (after the N6 switch-over) `/` is the new engine, `/classic.html` is the original game kept for rollback, and `/next.html` redirects to `/`**. The switch only reaches the live site when Anshul stages and deploys. **Waiting on Anshul** (account `rawatanshul525@gmail.com`; `wrangler whoami` on Rajul's PC says a different account, so Rajul did not deploy).
- **Checks:** `python tools/daily_check.py` (self-test 33 checks, vehicle acceptance, every location builds a road, deploy folder current, asset sizes and credits, open log entries). `CHECKLIST.md` lists the manual checks.
- **Accounts:** Cloudflare and GitHub belong to rawatanshul525@gmail.com. Nobody else deploys.
- **Stream B (Anshul) has not reviewed any of this.** Rajul's Claude changed many Stream B files at Rajul's request; every change is logged in `team/stream-a.md` and `team/stream-b.md` (all `open`). **Anshul should read both logs and drive, listen and phone-test before N1 is called done.**
- **Nothing here has been judged by a person on a real phone**, and nobody has listened to the engine with the real revs.

## What is in the game now (`/`, `index.html`; `/next.html` redirects here)

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

**Every known limit and what is left to do is in `docs/WORK_REMAINING.md`** (the reference list; keep it up to date).

## Post-N6 state (N7 to N15, built 17 Nov 2026, Rajul's session)

Stacked pull requests, none merged yet: 27 (N7) <- 28 (N8) <- 29 (N9) <- 30 (N10) <- 31 (N11) <- 32 (N12) <- 33 (N13) <- 34 (N14) <- 35 (N15). Merge in that order, each into the one below it or into `main` after its base. Every phase is a **first increment**, tested headless (62 self-test checks) and looked at in a desktop browser, **never measured on a phone and never reviewed by Anshul**.

| Phase | What exists | Doc |
|---|---|---|
| N7 | `GameRuntime` (phases, frame clamp, fixed step), strict `EventBus`, `Registry` with generational handles, `Pool` | `docs/RUNTIME.md` |
| N8 | 512 m sectors with load states, hysteresis, pins, cancellation; ref-counted `AssetCache` | `docs/STREAMING.md` |
| N9 | versioned region records (Mumbai, Delhi, Agra, Bhopal), validation, OSM/ODbL and elevation provenance rules | `docs/REGIONS.md` |
| N10 | navigation graph (lanes, sidewalks, crossings, signals) in sector chunks, cached A*, debug view | `docs/NAVIGATION.md` |
| N11 | Mumbai district: procedural buildings, sidewalks, zebras, lamps, shelters, stalls, signal poles | `docs/DISTRICT.md` |
| N12 | region traffic mix, two-wheelers, auto-rickshaws (procedural), signals with stop lines | `docs/TRAFFIC.md` |
| N13 | pedestrians on sidewalks and crossings, density follows the traffic setting | `docs/PEDESTRIANS.md` |
| N14 | on foot: G to get out and in, walk, run, jump, interaction registry | `docs/ONFOOT.md` |
| N15 | point-to-point activities; save version 2 with migration and recovery | `docs/ACTIVITIES.md` |

Also done on the way: tunnel doorways cleared of terrain (shader cut-out plus a cleared approach), ground normal maps, lighthouse and a richer Taj Hotel, retaining walls, `tools/collision_audit.mjs`.
**Not built, in rough order of value:** a junction and local street in the Mumbai district, a promenade, a designed route; traffic that routes through junctions; real (not box) pedestrian models and reactions; two-wheeler and auto-rickshaw art beyond procedural shapes; interiors; a map and route line; more activity kinds; phone benchmarks for all of it. Assets are the hard part: see `docs/ASSET_PLAN.md`.
**Owner decisions waiting:** whether OpenStreetMap data may be used (ODbL attribution and share-alike); which Mumbai district to model; an asset budget; whether on-foot play is wanted on phones.
**Not changed:** the live site, `cloudflare/public`, deploys.

## What is next: phases from here

Full table with owners and "done when" is in `PARALLEL_PLAN.md`; the outside Master Plan uses the same N0 to N6 labels. Status after pull request 22 (merged). **After N6 there is now a second plan, N7 to N15, the open-world India programme: `docs/post-n6-open-world-plan.md`, summarised with review notes in `PARALLEL_PLAN.md`. It is gated: nothing from N7 starts until N0 to N6 are accepted on real devices.**

1. **N0 (needs people):** Anshul deploys; both people go through `CHECKLIST.md`; two real phones; listen to the engine. Baseline checked by script on the real clone; every defect is in the list below.
2. **N1 Driving and sound:** built (telemetry, powertrains for all three, acceptance numbers, tunnel-aware weather sound). **Open:** a person must drive each vehicle and listen; cleaner engine recordings; tyre, road and wind sound refinement; truck and bike sound pass.
3. **N2 Weather and look:** weather matrix captured and fixed on a desktop (California). **Open:** dawn, overcast, fog and storm at dusk and night, other locations, other tiers, headlight beam check at night, bridge and tunnel at night and in rain.
4. **N3 World (Stream A):** built: bridge rails, world contract, location smoke test, tunnel walkway and signs, steel truss bridge, **tunnel doorways fixed (a detection bug had buried the entrances; terrain is cut out of the arch)**, collision audit (tunnel walls and bridge rails hold, `tools/collision_audit.mjs`), ground normal maps, southern coast lighthouse, richer Taj hotel, retaining walls and parapets. **Open:** tall grass blades, tree levels of detail (an early try saved only 0.4%, so measure first), real Rohtang terrain research, phone cost of the new ground shader.
5. **N4 Phones and speed:** loading screen, `?bench=30` and tier numbers done (`PERFORMANCE.md`). **Open:** run the benchmark on two real phones; compressed textures and meshes only if a phone needs them; long-session leak test.
6. **N5 Features:** traffic with levels and real models, My music, rumble, safe saved choices, tuner worker limits all built and tested. **Open:** vehicle customisation beyond paint, the tuner page's own login (a decision for the owner, see "Tuner security"), the one-time Cloudflare setup.
7. **N6 Switch-over and launch:** **done in the repo (16 Nov 2026, at the owner's request, before the real-device gate was met).** `index.html` is the new engine; the original game is `classic.html` (still on `game.js` and `audio.js`, kept for rollback); `next.html` redirects to `/` and keeps its address options; `tuner.html` previews `index.html`; the stage script copies `classic.html`. **Not done, needs people:** the real-phone and driving acceptance the plan wanted before the switch. Anshul must run `python tools/stage_cloudflare.py` and `cd cloudflare && npx wrangler deploy`, and note the rollback target first: the live version `4ab7b600` (old `/`), or `/classic.html` as a stopgap.

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
10. **Not done yet from the plan:** tall grass and tree levels of detail (N3); compressed textures and meshes and the long-session leak test (N4, only if a phone needs them); vehicle customisation beyond paint and the tuner's own login (N5); weather captures for dawn and for overcast, fog and storm at dusk and night (N2). Everything that needs people (phones, listening, driving, Anshul's review and deploy) is listed in `CHECKLIST.md`.
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
- `python tools/serve.py` (add `--lan` to reach it from a phone on the same wifi), then `http://localhost:8765/?play` (add `&loc=alps|himalayas|california|south|mumbai|delhi|agra`, `&road=`, `&q=low|med|high`, `&touch` for the phone controls on a computer, `&debug`).
- `window.__next` exposes the engine for checks from the console: `step`, `placeOnRoad(s)`, `setMode`, `env.setWeather`, `env.setTime`, `road`, `terrain`, `scatter`, `roadMesh`, `phys`, `view`, `sound`, `controls`. The browser pauses its frame loop when the pane is hidden: drive frames by hand with `step`.

## 17 Nov: D6 Delhi Metro
Done on branch `claude/delhi-d6-metro-2b04f7`: Metro viaducts, trains, elevated station kit, railway platforms, fast travel on J (`src/world/city/transit*.js`; hooks in `cityworld.js` and `main.js`). What is left and unverified: `docs/DELHI_TRANSIT.md` section 10, `docs/WORK_REMAINING.md` D6.*.

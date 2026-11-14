# Handoff

State of the work as of 14 November 2026. Read `OVERVIEW.md` first for what the project is.

## Where things stand

- **Branch checked out:** `vehicle/cars-and-gears` (Stream B, Phase 1 of `PARALLEL_PLAN.md`: its base is `phase/3-driving` plus the plan commits). It is pushed to GitHub and **not merged into `main`**; its work (new cars, gears, steering and slip fixes, and the rebuilt car models) was deployed to `/next` on 2026-11-14. Stream A works in parallel on `world/road-styles`; read `PARALLEL_PLAN.md` for who owns which files. The live `/next` (version `4ab7b600`) does not have this branch's work yet.
- **Branch chain**, each building on the one before: `main` → `phase/0-groundwork` (phases 0 and 1) → `phase/2-roads` → `phase/3-driving` (phases 3 and 4 so far). The branches are pushed to GitHub (`origin`) so they are backed up. **Nothing has been merged into `main`.**
- **`main` and the live `/` page:** the original game (`index.html`, `game.js`, `audio.js`) with three bug fixes. Unchanged by the engine rebuild.
- **Live site:** https://game-for-peace.anshul-rawat.workers.dev. `/` is the original game; **`/next` is the new engine**, deployed from `phase/3-driving` (last deploy: version `4ab7b600`, with the city landmarks). Everything committed was deployed.
- **Car models (2026-11-14):** all three cars were rebuilt with a production-car look using the shared Blender kit `dev/carkit.py` (`dev/build_car1.py`, `build_car2_sport.py`, `build_car3_rally.py`; run with `blender -b -P <script> -- <out_dir> <render_dir>`, previews in `dev/previews/`). The game contract is unchanged: wheel pivots `Wheel_FL/FR/RL/RR`, an object named `Cabin` (and `Interior`, both hidden in first person), materials `Paint_*`, the livery mask for the Dusk GT. Truck and bike were not rebuilt.
- **Latest deploy (2026-11-14, `/next` version `9ea9cf7b`):** rebuilt cars with the body lifted over the wheels (ride height set in `vehicle.js`, `lift` per car), plus atmosphere: a moon in the night sky (`env/environment.js`), birdsong by day and crickets at night, and quiet rain with a drone inside tunnels (`audio/engine.js`; `main.js` passes a `covered` flag). The moon, birds and crickets were not checked by eye or ear, so tune volumes if needed.
- **Self-test:** 21 checks pass (`node tools/selftest.mjs`). `node tools/locations_check.mjs [id]` prints land and road statistics per location.
- **Account for everything:** rawatanshul525@gmail.com (git, GitHub, Cloudflare). Deploy with `python tools/stage_cloudflare.py` then `cd cloudflare && npx wrangler deploy` (wrangler is already logged in on this PC).

## What the new engine (`/next`, `next.html`) does now

- Terrain from a seed, tiles in detail rings, far ring to about 5 km, floating origin; a road that grows both ways, graded into the land; trees, rocks, bushes, grass; rippled water (ripples fade with distance).
- **Distant mountains:** four hazed ranges behind the far terrain (`env/backdrop.js`), so the horizon is never bare sky.
- **Five vehicles:** Dusk GT, Freight Hauler, Volt Bike, plus the sports car (Ember RS, boost Nitro) and the rally hatchback (Dust Runner, four driven wheels, boost Gravel Grip), all in the garage with paint, lights, a driver's view and engine voices.
- **Gearbox** (`vehicle/drivetrain.js`, used by `rapier-vehicle.js`): engine torque curve with a rev limiter, clutch slip off the line, gear ratios derived from each vehicle's top speed (6 gears for the cars, 8 for the truck; the electric bike has one). Automatic by default (shifts by revs, picks reverse at a standstill); manual with E up, Z down, N switching, gamepad bumpers, on-screen buttons on touch, and a Settings switch. A downshift into too-high revs is refused. The HUD shows gear and revs; the engine sound follows the real revs and gear. Engine braking goes through the brake channel because Rapier ignores the brakes while an engine force is set.
- **Driving on Rapier** (`vehicle/rapier-vehicle.js`, library vendored in `vendor/rapier/`, 0.19.3, Apache-2.0): ray-cast wheels with springs and dampers, Ackermann steering, friction-limited tyres, weight transfer; a heightfield ground patch built from the road and land under and ahead of the car; the car/truck/bike each tuned. Buffs (Afterburn, Hill Hauler, Lean-In), paint choices, surfaces and weather grip, water, tree and rock collisions. The old bicycle model (`vehicle/physics.js`) is still the fallback: `?phys=old`.
- **Real sun shadows** (one map following the camera); sky, time of day, weather, headlights; synthesised engine sounds (`audio/engine.js`; the car voice was retuned but never judged by ear).
- **Radio**: 35 live stations, 19 from India, real names and logos (`audio/stations.js`, picked from the Radio Browser directory, streams checked as audio), `audio/radio.js` plus the GTA-style wheel (`ui/radiowheel.js`): hold Q, point, release; Tab switches India / World / My music. **My music** is the player's own songs: added with a button, from Settings, or by dropping audio files on the page; titles are cleaned from the file names; they play one after another and are kept in the browser (IndexedDB), never uploaded. The repo's own `music/` songs are not used and are no longer deployed.
- **Menus** (`ui/menu.js`): title screen, garage (vehicles, stats, boost, paint), location picker, settings, pause (Esc). The world is frozen behind them and the camera orbits the vehicle on the title and garage screens. Developer panels show only with `?dev`.
- **Locations** (`world/locations.js`): Green Valley (default), The Alps, The Himalayas, California Coast, Southern Coast, Mumbai, Delhi, Agra. A location is a set of config overrides (land, palette, plants, water colour, road altitude) plus the sky it starts with. `?loc=id` in the address.
- **Landmarks** (`world/landmarks.js`): Gateway of India, Taj Mahal Palace hotel, Marine Drive (blocks that follow the road, promenade, lamps), India Gate, Taj Mahal; stylised models from boxes, arches and lathes, placed beside the road by a search for flat ground (and sea where wanted), with the land levelled under them (terrain zones), collision circles and night-lit windows.

Address options: `?seed=word` `?loc=id` `?q=low|med|high` `?shadows=on|off` `?play` (skip the title) `?dev` / `?debug` (developer panels, stats) `?phys=old`.

## What is next

1. **Switch `index.html` to the new engine** (retire `game.js`). Needs a decision on the old game's music upload (see below) and a check of the menus on a real phone and at desktop width. Merge the phase branches into `main` first (they build on each other, oldest first).
2. **Music (decided: keep local upload).** Done in the new engine (My music). `tools/stage_cloudflare.py` no longer copies `music/`, so the next deploy removes the old mp3s from the live site; the old game then finds no `music/playlist.json` and should just show an empty playlist plus the player's own files (not run yet). Nothing left to do here except check it after the deploy.
3. **Phase 5: road styles** (multi-lane highway, boulevard, dirt trail, gravel stage) and bridges and tunnels. Known road problems below.
4. **Phase 4 leftovers:** the southern coast has no landmark; Marine Drive's sea does not always touch the promenade; the hotel model is plain.
5. **Phase 6 leftovers:** vehicle tuning and customisation, controller rumble. (The two new cars and the manual gears are done on the Stream B branch.)
   **Merging the streams:** a trial merge of `vehicle/cars-and-gears` with `world/road-styles` conflicts only in `tools/selftest.mjs` (both appended tests); `src/main.js` merges on its own. Per the plan, A merges first, then B merges A and resolves.
6. Phases 7 to 9 as listed in `OVERVIEW.md`.

## Known problems to pick up

- **Not tested by a person:** how the new driving feels by keyboard; how the gears feel (manual shifting, shift points, launch); the engine sounds, which were never judged by ear; the gearbox, shift buttons and My music on a real phone or gamepad; My music with real mp3 files (tested with generated audio); the menus on a phone and at desktop width; the landmarks beyond the screenshots taken. All checks so far were numbers and a handful of screenshots.
- **Road over water:** 0 to 13% of road length on test seeds runs on a causeway. Bridges are planned (Phase 5).
- **Deep cuttings:** one test seed (`bay`) has a cutting over 100 m deep. Tunnels, or a router that can make switchbacks, would fix it.
- **Tight bends:** the smoothed centre line can be as tight as about 45 m radius against a 75 m target. Raising `road.minRadius` in `src/core/config.js` is the quick fix.
- **Steep land in the Alps and Himalayas:** roughly 17% and 30% of land is steeper than 45 degrees; the road is graded through it but it was not driven at length.
- **Frame cost:** about 5 to 7 ms per frame including drawing on this PC at medium quality, with spikes of up to about 25 ms when the ground patch rebuilds. Not measured on a phone.
- **Line endings:** the repo mixes LF and CRLF (some files were committed as CRLF). Edit with care: a tool that rewrites a whole file can turn a small change into a whole-file diff.
- **Old seeds changed:** sea was cut from 46% to 22% of the world in Phase 2, so worlds from Phase 1 look different.

## Uncommitted work

None of the work on `vehicle/cars-and-gears`. **Warning:** `cloudflare/public` has stray uncommitted changes (a stage run into it by mistake on 2026-11-14; the live deploy came from a scratch folder, so the site is fine). Discard them with `git checkout -- cloudflare/public && git clean -fd cloudflare/public`; do not commit them.

## How to test engine work

- `node tools/selftest.mjs` for the pure modules and the Rapier vehicle (it runs headless in Node).
- `python tools/serve.py 8791`, then `http://localhost:8791/next.html?q=med&debug`. After editing a module the browser may serve a cached copy: reload with cache bypass.
- `window.__next` exposes the engine for checks from the console: `step(dt, now)` runs one frame by hand, `auto` overrides the driving input, `phys`, `road`, `grid`, `scatter`, `landmarks`, `menu`, `radio`, `renderer` are the live objects.
- A leak check is a drive of several kilometres while watching tile, scenery and road-piece counts stay flat (not repeated since the Rapier change).

## Other sessions

- "Music interface" and "Model the sports car and rally hatchback": their work was committed on request (`e22ad5d`, `d45cb37`); the radio they drafted is now replaced in the new engine by the live-radio-only one, and still present in the old game.
- "Game for Peace repo check (fork)": handled accounts and the first Cloudflare deploy.

# Stream A log (World: Rajul's Claude writes here, Anshul's Claude only reads)

Newest entries first. Format is in `CLAUDE.md`.

## 2026-11-19 01:00  Traffic on every road of the world
Branch: feat/landscape-look (PR 36)
What changed: `traffic/sim.js` (`branchMode`), `traffic/traffic.js` (`addRoad`, `removeRoad`, `updateExtra`; extra sims share the instanced meshes; `circles` and `setMode` cover them), `main.js` (each branch road gets a sim while the player is within 700 m), one self-test extension (68 checks: cars appear on the side road, keep to its lanes, live near the player, are cleared when off, circles reach physics). Checked in the browser at Delhi. Not done: cars turning between roads, giving way or traffic lights at crossings (two roads' cars can pass through each other), pedestrians and the navigation graph on side roads, continuing cars when you leave and return.
For the other stream: this touches `traffic/sim.js` and `traffic/traffic.js` (your files; additive). Please say how you want crossing behaviour done (priority, signals, turning).
Status: open

## 2026-11-18 23:00  Multi-road engine step 1: RoadSet and branch roads at junctions
Branch: feat/landscape-look (PR 36)
What changed: new `world/roadset.js` (`RoadSet`: nearest, grade, drive, style over several roads; `terrain.attachRoad(roadSet)` in `main.js`), `world/router.js` (`config.road.start` and `guideBack`, `hAt` height blend: a road can start on another road; both arms can follow guides), `main.js` (branch roads built near each city of an `?india=` route and removed when far, their meshes updated and repositioned like the main road), one self-test (68 checks: branch starts at the road's height, follows its guide, nearest-road answers, one-road behaviour unchanged). Checked in the browser: six roads form a star at Delhi, no console errors, about 3 ms per headless step. Not done: traffic, pedestrians and the navigation graph on branches, interchanges and ramps, paint cut-outs, collision for branch bridges and walls, the physical choice replaced the panel only partly.
For the other stream: `terrain.road` is now a `RoadSet` (it has `nearest`, `hit`, `style`, `grade`, `drive`); code that wants one Road should keep using the `road` it is given. Traffic and navigation over several roads are your area; please say how you want that shaped.
Status: open

## 2026-11-18 21:00  Junction network: routes across roads, city gates, junction panel
Branch: feat/landscape-look (PR 36)
What changed: `world/network.js` (`slice`, `routeGuide`, `junctionChoices`), `main.js` (`?india=route&from&to`, junction panel, regenerate on choosing another road), `world/highway_plan.js` + `highway.js` + `road.js` (city gate boards over the road before each city, `gates` option), `docs/INDIA_MAP_PLAN.md`. Self-test cases added (67 checks, still passing). Checked in the browser (Delhi to Mumbai route, Jaipur gate and panel, switching to NH 62). Limit: one road at a time; the junction is a choice, not a visible crossing; no real side roads, no network traffic or navigation yet.
For the other stream: the next step needs the engine to hold several roads at once (terrain, scatter, traffic, navigation all take one `Road` today). Please look at how much of that is yours before I start.
Status: open

## 2026-11-18 19:00  Drive a real highway: ?india= guided road
Branch: feat/landscape-look (PR 36)
What changed: `main.js` (`?india=<road>&from=<city>&toward=<city>` loads the skeleton, builds the guide, picks the nearest region and a highway style, route readout, OpenStreetMap credit), `world/router.js` (`guideArc`, `arcAtS`), `world/highway_plan.js` and `highway.js` (gantry boards name the next cities with real distance left when the road has a guide), `docs/INDIA_MAP_PLAN.md`. One more self-test case (67 checks). Checked in the browser: Delhi to Lucknow follows its guide, readout and credit show. Limits: one road, no junctions, no real elevation, no city worlds.
For the other stream: the road model change is additive (`config.road.guide` is optional). Please read the network design in section 9 of the India plan.
Status: open

## 2026-11-18 17:00  Drive modes (Eco, Normal, Sport, Off-road) and the road network model
Branch: feat/landscape-look (PR 36)
What changed: owner asked for drive modes like a modern car. `vehicle/physics.js` (`DRIVE_MODES`, `combineMods`, `setDriveMode`), `vehicle/rapier-vehicle.js` (limiter, throttle map, hill descent control, loose-ground grip, shift points, traction limit, engine braking; Stream B files, smallest change, both physics classes keep one surface), `main.js` (N key and button, HUD tag, saved choice), `input/controls.js` (`drivemode`), `core/saved.js` (`driveMode`), `index.html` (button, tag), `docs/DRIVE_MODES.md`. `tools/vehicle_acceptance.mjs` now checks every mode for every vehicle (all pass). Also in this push: `world/network.js` (road network model, `cleanPath`, `guideFor`) and a `config.road.guide` option in `world/router.js` so a road can follow a real highway path (tested: it stays within 450 m of the guide); not wired into the game yet. 67 self-tests pass.
For the other stream: please feel-test the modes on a phone and with a gamepad; the numbers are tuned by script only. Sound per mode is not done.
Status: open

## 2026-11-18 15:00  Real road shapes (OpenStreetMap-derived) in the India skeleton
Branch: feat/landscape-look (PR 36)
What changed: owner approved the OSM download. `tools/fetch_india_routes.mjs` fetched 28 simplified driving routes from the OSRM demo server (OSM data, ODbL) into `assets/india/waypoints.json` (20 KB, credit and licence in `meta`); `tools/build_india_skeleton.mjs` and `buildSkeleton` use them (skeleton now 64 KB, `assets/india/skeleton.json`); `india_map.html` draws the real shapes with the credit; `.gitignore` ignores `data/`; self-tests check the waypoints (66 checks). An Overpass trial was far too big (8 MB for one highway) and was stopped and deleted. Credit line in the game itself is still to do. Not used by the game world yet.
For the other stream: ODbL share-alike on `assets/india/waypoints.json` and the skeleton: please read `docs/OPEN_DATA.md`.
Status: open

## 2026-11-18 13:00  India game space and skeleton file; open data research
Branch: feat/landscape-look (PR 36)
What changed: `docs/OPEN_DATA.md` (data and open-source projects, licences, what needs approval; nothing downloaded), `src/world/india_network.js` (`toGame`, `fromGame`, `smoothPath`, `buildSkeleton`, `GAME_SCALE` 100), `tools/build_india_skeleton.mjs`, `assets/india/skeleton.json` (generated, 32 KB, listed in `assets/ASSETS.md`), `india_map.html` default 1:100, one self-test (66 checks, includes a check that the shipped skeleton is current). Not used by the game yet: the game still loads one road from the start.
For the other stream: nothing required; section 9 of the India plan still needs your review.
Status: open

## 2026-11-18 11:00  Owner decisions on the India map recorded
Branch: feat/landscape-look (PR 36)
What changed: `docs/INDIA_MAP_PLAN.md` section 9: real road lines (as a skeleton for procedural detail), GTA-like compression (about 1:100 on highways, cities near full scale), one continuous world generated by distance. Design and order of work written down; nothing built. Needs Anshul's review before work starts (it changes the road model from one polyline to a network).
For the other stream: read section 9 and say if the engine side (sectors, nav graph, traffic) can take a road network.
Status: open

## 2026-11-18 09:00  Traffic slows at toll plazas; Himachal and Ladakh retuned
Branch: feat/landscape-look (PR 36, more commits)
What changed: `traffic/sim.js` (cars on nh6 roads ease down to 4 m/s through toll plazas, using the same plaza list as the plan: `validTolls`, `tollCap` in `world/highway_plan.js`), `world/regions.js` (Himachal v2: mountains everywhere, the road climbs about 240 m in 5 km with 39 m minimum bend radius; Ladakh v2: tan barren ground, `arid` 0.8). Checked in the browser: cars measured at 4 m/s in the plaza; Himachal, Kerala, Ladakh, Deccan, Rajasthan all load and look as intended at first glance. Kerala has no palm trees (no art): banyan-like trees only. 65 checks pass.
For the other stream: nothing required.
Status: open

## 2026-11-18 07:00  Highway details on six-lane national highways
Branch: feat/landscape-look (PR 36, more commits)
What changed: new `world/highway_plan.js` (pure rules) and `world/highway.js` (meshes): guardrails, km stones, bilingual green sign gantries, toll plazas on `nh6` roads only; wired into `road.js` (`RoadMesh.highway`, `extras.dests`) and `main.js` (`world.near` gets the circles; `placeOnRoad` now starts the player in the first lane on the traffic side for the region's drive side, which also fixes a start on the wrong side of two-lane roads in left-hand regions), `india_network.js` (`HINDI`, `destinationsFor`). One self-test (65 checks). Looked at in the browser in the Deccan world: gantry, guardrail, toll plaza, bridge rails visible. Not done: traffic does not slow for the toll plaza, service roads, interchanges, night lighting of signs, nothing measured on a phone. Merged-mesh cost: a few thousand triangles per piece of road in range.
For the other stream: the Indian signs use system fonts for Devanagari; check they show on a phone.
Status: open

## 2026-11-18 05:00  India-only worlds: five Indian regions replace the old picker
Branch: feat/landscape-look (PR 36, more commits)
What changed: `world/regions.js` (regions himachal, ladakh, rajasthan, kerala, deccan; optional `roads.router` numbers passed to the route planner; DEFAULT_CONFIG import), `world/locations.js` (old five ids hidden from the picker, `LEGACY` map, `START_LOCATION` mumbai, `pickerLocations()`), `main.js` (start in Mumbai, old saved choice moves to its replacement, picker shows India only, `uArid`), `world/groundmat.js` (optional palette `arid` mixes sand into the ground so Rajasthan and Ladakh look dry). Old ids and share codes still load. Looked at in the browser (Rajasthan closely, the others only loaded without errors). 64 checks pass.
For the other stream: the title and picker show Indian places only now; check the menu text on a phone.
Status: open

## 2026-11-18 03:00  India-only direction: network data, map page, two Indian road styles
Branch: feat/landscape-look (PR 36, more commits)
What changed: `docs/INDIA_MAP_PLAN.md` (research, scale, what makes an Indian game, order of work, owner decisions), `src/world/india_network.js` (98 cities, 28 highways including the Golden Quadrilateral, North-South and East-West corridors, the six rail trunk routes, route and distance helpers; calibrated so the four GQ sides total about 5,800 km), `india_map.html` + `src/debug/indiamap.js` (draws it, plans a route between two clicked cities), `roadstyles.js` (new `nh6` six-lane divided highway and `ghat` mountain road; styles may now list their own `lanes`), small additions in `road.js`, `traffic/sim.js`, `world/navgraph.js`, `regions.js`. Two self-tests (64 checks). Not done: hairpin routing for ghat roads, service roads, gantry signs, toll plazas, interchanges, the five non-India worlds are still there, no real alignments (needs the OSM decision).
For the other stream: nothing required. `lanes` on a road style is new (see `laneOffsets`).
Status: open

## 2026-11-18 01:00  Landscape pass 2: tree species built in code, shore and depth on water, sharper forests
Branch: feat/landscape-look (PR 36, more commits)
What changed: new `world/species.js` (oak, birch, poplar, cypress, a rare autumn maple: trunk, branches and a crown of leaf clusters, leaf textures drawn on a canvas, no outside assets; mixed into the scanned trees by `nature.js`, two kept on the low preset), `world/groundmat.js` (ground under water goes from pale turquoise shallows to deep blue, wet sand, a moving line of foam at the shore; new `uTime` uniform), `main.js` (water opacity 0.74 so the bed shows), `terrain.js` (sharper forest edges). Looked at in the browser only. Cost: each species adds about 300 triangles and two draw calls per variant per tile; not measured on a phone.
For the other stream: phone frame rate and memory check on the mid and low presets.
Status: open

## 2026-11-17 23:50  Mouse look on foot, plant variety, patchwork land colour, moving water
Branch: feat/landscape-look
What changed: `main.js` (mouse look and touch drag in foot mode; water material now has four moving ripple layers, stronger normals), `world/nature.js` + `world/scatter.js` (each plant kind now has several variants: sizes, shapes, colours, a rare autumn tree, three wildflower cards drawn in code; variants are placed in patches, not at random), `world/terrain.js` + `world/groundmat.js` (patchwork of hay-yellow, fresh and deep green fields on open lowland). No new outside assets; the scanned art is still one broadleaf tree, six conifers, one shrub, one fern, one grass: real new species need packs the owner downloads (see `docs/ASSET_PLAN.md`). Water has no shore foam or depth colour yet.
For the other stream: look at it on a phone (more variants cost draw calls: the low preset keeps the old few).
Status: open

## 2026-11-17 23:00  N15 first increment: activities and a versioned save
Branch: feat/n15-activities
What changed: new `src/activities/activities.js` (data-driven point-to-point drives, runner, ratings, best times), `src/core/save.js` (version 2 envelope, migration, corrupt text kept in `gfp-next.bad`, newer saves never overwritten), `saved.js` (`sanitiseProgress`), `runtime.js` (events `activity:started`, `activity:finished`), `main.js` (markers, beacon, timer line, G to start, save wiring), `player/onfoot.js` (`Interactions` prefix filter). `docs/ACTIVITIES.md`. Two self-tests (62 checks). Checked in the browser: prompt, start, finish, best time saved. Par times are guesses.
Also: `HANDOFF.md` (shared) got a post-N6 section for N7 to N15 and `docs/ASSET_PLAN.md` was written (no assets downloaded). For the other stream: nothing needed to merge. Later: points of interest for activities from region data (yours to supply), a map/route layer, more kinds.
Status: open

## 2026-11-17 21:00  N14 first increment: on foot, get in and out
Branch: feat/n14-onfoot
What changed: new `src/player/onfoot.js` (kinematic controller, safe exit spot, interaction registry), `src/input/controls.js` (`G` interact, Shift run), `src/main.js` (mode `foot`, `exitVehicle`/`enterVehicle`, parked vehicle on handbrake, prompt button, third-person camera, Registry handle on `vehicle:exited`/`vehicle:entered`). `docs/ONFOOT.md`. Three self-tests (60 checks). Checked in the browser: exit, walk, prompt, get back in, no errors. Not built: interiors, other vehicles, a rigged model, phone on-foot controls, phone measurement.
For the other stream: you own the vehicle side of N14 (`TouchUI` on-foot controls, occupants, camera). Nothing is required of you to merge.
Status: open

## 2026-11-17 18:00  N11 first increment: Mumbai district (buildings, sidewalks, crossings, furniture)
Branch: feat/n11-district
What changed: new `src/world/district_plan.js` (pure layout: plots along both sides at the frontage line, never on bridges, tunnels, water, landmark zones or bends; lamps every 36 m, bus shelters, market stalls, signal poles; crossings shared with the navigation graph via `navgraph.crossingAt`; obstacle circles along building fronts) and `src/world/district.js` (original procedural meshes: shop fronts with awnings and signs, floors of windows, cornices, balconies, water tanks, colonial and art-deco looks, raised sidewalks, zebras, furniture; lit windows at night), wired through `road.js` (`RoadMesh` extras) and `main.js` (`world.near` gets the circles, `setNight`). The Mumbai region record turns it on (`district` field, validated; version 2, tree-clear strip 30 m). Two new self-tests (53 checks). Checked in the browser: renders, no errors, the truck stops at a building front. `docs/DISTRICT.md` lists what is built and what is not: **no junction or local street yet, no promenade, no designed route, no phone measurement.** `assets/ASSETS.md`: no external assets used.
For the other stream: nothing. The district needs your eyes on a phone for frame rate.
Status: open

## 2026-11-17 15:00  N10 navigation graph built
Branch: feat/n10-nav
What changed: new `src/world/navgraph.js` (generic `NavGraph` with spatial hash, bounded cached A*, validate and recover; `RoadNav` builds lane, lane-change, sidewalk and crossing edges from the road in sector chunks, with bridge and tunnel flags, grade, curvature, speed targets, signalled crossings and stop-line marks), new `src/debug/navdebug.js` (`?nav` view); `src/main.js` builds the graph per world, loads and unloads chunks from the sector manager and shows a `navigation` line in `?debug`. Four new self-tests (51 checks): lanes on the right side of travel for both drive sides, sidewalks never on the carriageway, vehicle and pedestrian routes use only their own edges, bounded and cached search, chunks join in any loading order, routes invalidate and recover when a sector unloads, bridges and tunnels keep a walkway, roundabout, dead end and flyover on synthetic graphs. Contract and measurements in `docs/NAVIGATION.md`. The generated road has no junctions yet (N11).
For the other stream: consumers (traffic N12, pedestrians N13): use the query contract in `docs/NAVIGATION.md`; do not read nodes by scanning the graph per frame.
Status: open

## 2026-11-17 13:00  N9 region model built (Mumbai, Delhi, Agra, Bhopal as data)
Branch: feat/n9-regions
What changed: new `src/world/regions.js` (versioned schema, validator, migration hook, `regionToLocation`, `regionTransition`) with Mumbai, Delhi and Agra moved out of `locations.js` into region records (their worlds are byte-identical: config hash before and after matched) and a new procedural Bhopal profile (lakes, bridges, two-lane roads, lighter traffic); `locations.js` appends `REGIONS.map(regionToLocation)`; configs now carry `region: { id, version }` (share codes carry it; older codes still load); traffic density takes the region's `traffic.scale` (`sim.js` and `traffic.js` accept `scale`, `main.js` passes it). Three new self-tests (47 checks): validation and rejection of 15 kinds of bad data, two regions through the same code deterministically with share-code round trip and a legacy code, and traffic scale. Decisions (geography mapping, OSM policy, elevation, determinism, transitions) in `docs/REGIONS.md`. OSM is NOT used; the owner must decide on ODbL before it is.
For the other stream: nothing to do; the data fields for vehicle mix, buildings and population are waiting for N11 to N13.
Status: open

## 2026-11-17 11:00  N8 sectors and shared-asset streaming built
Branch: feat/n8-sectors
What changed: new `src/world/sectors.js` (sector manager: 512 m sectors, states, priority queue with look-ahead, concurrency and per-update budgets, hysteresis, cancel and abort, pins, failure retry, reset), new `src/core/assets.js` (ref-counted asset cache: one load for many askers, pinned while held, LRU eviction, abort when nobody waits); `src/main.js` runs the sector manager as a runtime system (focus is the player or camera), routes the traffic pack through the cache, rebuilds sectors on `world:rebuilt`, and shows a `sectors` line in the `?debug` panel. Six new self-tests (44 checks): lifecycle and budgets, hysteresis and pins, cancel/abort/late results/retry, a 1500-step stress with reversals, teleports and resets, twenty rebuilds in a row. Design note and measurements in `docs/STREAMING.md`. In the browser: 19 sectors loaded in 12 s of autodrive, pack loaded once, references equal sectors alive plus one after a region change, no errors. Terrain tiles and scenery are NOT moved behind sectors (deliberately).
For the other stream: Stream A (world) review the sector boundary in `docs/STREAMING.md`; sector `meta` is the hook for spawn profiles (N9) and navigation chunks (N10).
Status: open

## 2026-11-16 23:00  N6 switch-over done in the repo (owner request)
Branch: feat/n6-switchover
What changed: `index.html` is now the new engine (title "Game for Peace"); the original game moved to `classic.html` (still uses `game.js` and `audio.js`, which stay for rollback); `next.html` is a tiny redirect to `./` that keeps the query string and hash, so old links with `?loc=` and `?seed=` still work; `tuner.html` previews `index.html`; `tools/stage_cloudflare.py` copies `classic.html`; OVERVIEW, HANDOFF, CHECKLIST, PERFORMANCE and PARALLEL_PLAN updated. Checked locally: `/next.html?loc=mumbai&...` lands on `/?loc=mumbai&...` and loads the new game; `/classic.html` loads the old one; tuner opens. Self-test 33, vehicle acceptance, collision audit, all locations build a road, daily check 0 failed (one warning: `cloudflare/public` is out of date, as expected until staging). NOT done: the real-phone and driving acceptance the plan wanted before this switch (the owner asked to proceed); nothing deployed.
For the other stream: Anshul (the only deployer): `git switch main && git pull`, `python tools/stage_cloudflare.py`, `npx wrangler whoami` (must be the project account), `cd cloudflare && npx wrangler deploy`. Rollback: the live version before this deploy is `4ab7b600` (the old `/`); `/classic.html` is the quick stopgap. After deploy run the "After" lines of `CHECKLIST.md` section 7. The old game (`classic.html`, `game.js`) is your file; it is frozen, not deleted.
Status: open

## 2026-11-16 21:00  Retaining walls and parapets (N3 A)
Branch: feat/ground-detail
What changed: new `src/world/retaining.js` (wired into `road.js` like bridges and tunnels: `update`, `reposition`, `dispose`): where the land beside the road falls away more than 1.8 m within 3 m of the bed, a low stone parapet (0.9 m) with a coping runs along the road edge and a wall face goes down the drop (at most 5 m); where the land climbs more than 1.4 m, a wall with coping stands on the bed edge (up to 4.5 m). Skips bridges and tunnels. Visual only. Measured: Himalayas has about 22% of road sides with a drop (all of them small, at most about 2 m), and no cuts steep enough for a wall (the grading eases the hill in), so in practice you see parapets and an occasional wall at a bend; Alps, California and Mumbai have almost none. Checked by eye in the Himalayas at medium tier, no console errors, self-test 33 checks. Phone cost not measured (one merged mesh per 200 m piece).
For the other stream: nothing.
Status: done

## 2026-11-16 20:00  Southern lighthouse and a richer Taj hotel (N3 A)
Branch: feat/ground-detail
What changed: `src/world/landmarks.js`: new `lighthouse` landmark (tapering red and white banded tower, gallery with railing, lantern room and cap, keeper's cottage, boundary walls; three obstacle circles) placed on the Southern Coast by a spec in `locations.js` (`{ kind: 'lighthouse', s: 700, off: 80, sea: true, range: 3000 }`); `tajHotel` gets string courses and cornices on every block, parapet finials, four corner turrets with domes, balcony rails, an entrance porch and forecourt lamps. Checked by eye at medium tier (south seed `peace`, Mumbai): both render, no console errors. Self-test 33 checks. The lighthouse has no interior and is not lit at night (no beam yet).
For the other stream: nothing.
Status: done

## 2026-11-16 18:00  Ground normal maps now used (N3 A)
Branch: feat/ground-detail
What changed: `src/world/groundmat.js`: the grass and rock normal maps were loaded but never used; the ground shader now perturbs the surface normal with them (two grass scales blended into the rock map on steep slopes, faded out between 25 and 110 m so far ground does not shimmer). Full tier only; the `lite` tier is unchanged. Checked in California at high tier: renders, no shader or console errors. Tall grass (a separate layer of blades) is NOT done. Not measured for frame cost on a phone: add to the N4 phone run.
For the other stream: nothing.
Status: done

## 2026-11-16 17:00  Core architecture addendum added to the plan
Branch: feat/collision-audit
What changed: `docs/open-world-core-architecture-addendum.md` (verbatim) and an "Addendum: open-world core architecture" section in `PARALLEL_PLAN.md` mapping its fifteen areas to N7 to N20, what exists, the gaps, and two change requests (an N7a core contracts note; an N14a player-facing layer for HUD, map, prompts, accessibility). Docs only.
For the other stream: read the new section. Do not start N7. When the gate opens, the first joint task is the contracts note.
Status: open

## 2026-11-16 16:00  Tunnel doorways were blocked by the hill (fixed)
Branch: feat/collision-audit
What changed: (1) a real bug in `src/world/router.js` `deep()`: it read the road point into an object that `bridgeW()` overwrites, so tunnels were detected from a point a few metres off and began where the hill was only 2 to 3 m high; fixed (own object). All tunnels move a little because of this (share codes keep working; tunnel places differ slightly). (2) The land over the tube now stands at least `TUBE_ROOF` (9.6 m) above the road from `FACE_W` inward, and the way is cut clear in front of the portal. The tube and portal wall start at `PORTAL_W` (`tunnelW`), a few metres before the hill face, because the terrain mesh is coarser than the road. (3) New `src/world/tunnel_holes.js`: the terrain is not drawn inside the tube's arch for 30 m behind the 4 nearest portals (a fragment-shader discard chained onto the ground material, works with `?ground=flat`); `tunnels.js` lists its portals (`portals()`), `main.js` feeds them each frame. `road.js` and `tunnels.js` use `tunnelW >= PORTAL_W` instead of the old cover rule. `tools/collision_audit.mjs` now also checks the doorway numbers (land over the road at the portal at most 3 m, at least 9 m 14 m inside). Checked by eye entering and leaving in the Himalayas at low and high tier and `ground=flat`: open arch, interior visible, no console errors. Self-test 33, daily check 0 failed, all locations build a road.
For the other stream: nothing. The photographic ground shader is in `groundmat.js` (not edited; the holes chain after it).
Status: done

## 2026-11-16 14:00  Collision audit: tunnel walls and bridge rails hold; asset job recorded
Branch: feat/collision-audit
What changed: new `tools/collision_audit.mjs` drives the real vehicle physics on the real graded ground (`terrain.drive`, with the bridge rails) sideways into a tunnel wall and a bridge edge, Alps and Himalayas. Result: in a tunnel the car stops at 4.2 to 4.4 m from the centre line (the mountain, left whole over the road, is the wall); on the Alps bridge it stops at the rail, 3.1 m. No fix needed. Bridge piers are below the deck and not reachable while the rails hold. `PARALLEL_PLAN.md` now records the owner's instruction that Claude sources or builds all assets for N11 to N14 (write `docs/ASSET_PLAN.md` first).
For the other stream: nothing.
Status: done

## 2026-11-16 12:00  Post-N6 plan (N7 to N15) added and reviewed; status refreshed
Branch: docs/post-n6-plan
What changed: `docs/post-n6-open-world-plan.md` (the owner's open-world India plan, verbatim); `PARALLEL_PLAN.md` has a new status table (done / not done for N0 to N6) and an "After N6" section with N7 to N15, what each builds on in the current code, and six review notes (gate, missing Asset Acquisition Brief, product direction change, risks, ownership, owner decisions); `HANDOFF.md` status corrected (PR 22 merged) and points to the new plan. No runtime code changed.
For the other stream: read the new section in `PARALLEL_PLAN.md`. Do not start N7. The N7 kickoff report is Stream B's first task once N0 to N6 are accepted.
Status: open

## 2026-11-14 18:00  N3 started; request for Stream B: bridge rail collision
Branch: main  Commit: 1ee42db
What changed: nothing in code. Tried two-plane tree cards on far scenery tiles: saved 0.4% of triangles, so dropped it (trees are not where the cost is; N4 should measure the ground and road meshes first).
For the other stream: bridge rails are drawn but the car drives through them. The physics ground is one heightfield (`rapier-vehicle.js`), which is your file. Ask: add thin cuboid colliders along the bridge edges (use `Road.bridgeW === 1` stretches and `road.carriedW` for the half width), or tell me the hook you want and I will expose a list of rail segments from `world/bridges.js`.
Status: done (Rajul's Claude built the rail collision on the world side, see the 2026-11-15 23:00 entry; no change needed from Anshul)

## 2026-11-16 10:00  Steel truss on long bridges (N3 A2)
Branch: feat/plan-n0-n1 (stacked on PR 22)
What changed: `src/world/bridges.js`: on bridges of at least 90 m (`TRUSS_MIN`) a steel pony truss is drawn along both sides: top chord, an upright and a diagonal per 6 m bay (`TRUSS_BAY`), 3.3 m above the deck (`TRUSS_H`), one merged mesh per 200 m piece; bays sit at fixed road distances so pieces line up and each bay is built by the piece holding its first upright; new `steel` material, freed in `dispose()`. Checked on the 726 m Alps lake bridge (seed `alps`): continuous, no gaps, no console errors. Visual only; the rails (bridge_rails.js) still stop the car. Self-test 33 checks.
For the other stream: nothing. The chase camera can sit close to the near truss member on a bridge; tell me if it bothers you.
Status: done

## 2026-11-16 09:00  Tunnel interior: walkway, speed-limit, exit and SOS signs (N3 A3)
Branch: feat/plan-n0-n1 (stacked on PR 22)
What changed: `src/world/tunnels.js`: a raised walkway (a 0.7 m wide, 0.32 m high ledge with its inner face) along both walls of every tunnel stretch, and instanced wall signs drawn to canvas textures: a red-ringed 60 every 200 m, a green EXIT every 60 m and an orange SOS box every 120 m, facing the road, all freed in `dispose()`. Checked in the Himalayas (seed `hill`): ledge and all three signs visible, no console errors. The walkway is visual only (the car can drive over its edge at the very side; it is outside the 5.4 m shoulder). Self-test 33 checks.
For the other stream: nothing.
Status: done

## 2026-11-15 23:00  Master Plan N0 done on the real clone; bridge rail collision built (N3 A1, A2)
Branch: feat/n0-n3-docs-and-rails
What changed: all five open PRs (16 to 20) were merged into `main` in order (log files conflicted each time; both entries kept, newest first). New `src/world/bridge_rails.js` (pure, tested): collision circles along both rails of every bridge, wired in as `roadMesh.bridges.near` and `world.near` in `src/main.js`; `collide()` in `src/vehicle/rapier-vehicle.js` (Stream B) treats circles with `slide: true` as a wall to scrape along (little speed lost, small bounce, nose turned parallel) instead of a tree. New `WORLD_CONTRACT.md` documents the road, terrain and obstacle interfaces as the code is. `HANDOFF.md` and `PARALLEL_PLAN.md` refreshed, with an ordered defect list. Self-test 27 checks (new: rail circles sit on the drawn rail and nowhere else; no car, truck or bike gets through a rail at up to 220 km/h, physics stays finite). In the real game a car at about 100 km/h was stopped by a bridge rail and stayed on the deck.
For the other stream: read `WORLD_CONTRACT.md`; review the `collide()` change (two lines) and the `slide` flag; your 2026-11-14 request for rail colliders is done. Not tested: tunnel walls and bridge piers have no obstacle circles.
Status: done

## 2026-11-15 22:00  New car model (Stream B files touched, please read)
Branch: feat/nfs-handling (PR 20)
What changed: the car is now `assets/car_04_concept.glb`: Khronos's CarConcept (CC BY 4.0, Eric Chadwick / Darmstadt Graphics Group; credited in `assets/ASSETS.md`), cut by `tools/blender/make_car_concept.py` from 213,347 triangles, about 100 meshes and 11.8 MB to 67,806 triangles, 41 draw calls and 3.2 MB. It has a real interior (the old stand-in dashboard is skipped via `interior: true`), clearcoat paint (`Paint_Body`, recolourable from the garage swatches), wheels named `Wheel_FL/FR/RL/RR`. The Khronos and 3D Commerce logos in the original (tyre sidewalls, licence plate) are replaced by plain materials. `src/vehicle/defs.js` (Stream B): car body numbers now match the model (front 1.49, rear 1.31, track 1.96, wheel radius 0.384, camera back 8.4 / up 3.3, eye [0, 1.02, 0.3], lights, shadow size, collision circles) and the final drive went 4.0 to 4.4 to keep 270 km/h and the same acceleration with the bigger wheels (0-100 3.3 s, top 269 km/h, 270 to 0 in 193 m). `src/vehicle/vehicle.js` (Stream B): fixed `setModel()` overwriting every material's reflection strength with 0.7 (it undid the car-paint polish), tyre and rim names by prefix. The old `car_01_gt.glb` and the livery mask are no longer used by the car (still in assets; the old game may use them).
For the other stream: 67k triangles and 41 draw calls for the car on every tier, including phones; if that costs too much on a real phone, tell me and I will cut it further or add a lower model for the low tier. The steering wheel in the model does not turn yet.
Status: done

## 2026-11-15 21:00  Steering was numb: now quick and stable (Stream B file, at Rajul's request)
Branch: feat/nfs-handling (PR 20)
What changed: `src/vehicle/rapier-vehicle.js` `ARCADE`: new `steerRate` (2.5, wheel input speed), `yawAssist` 8 (was 3.2), `maxYaw` 1.2 (was 1.7), `tyreAssist` 0.5 (was 0.3). The extra steering lock above 2.1 (`steerLock`, default 3.5) now fades out between 90 and 200 km/h, because a wide lock at top speed spun the car (full lock at 228 km/h gave 1.1 rad of slip; now 0.19). Measured step response (time to 63% of the steady turn rate, full lock): 50 km/h 1.28 s to 0.32 s; 100 km/h 1.28 s to 0.48 s; first 10% response 0.08 to 0.17 s at all speeds. A handbrake flick at 100 km/h now gives a 15 to 20 degree drift. Selftest 25 of 25. All settings are in the tuner under "handling" with help.
For the other stream: nothing. Please tell me by feel if it is now too sharp; `steerRate` and `tyreAssist` are the sliders.
Status: done

## 2026-11-15 20:00  Look pass: grade, car paint, reflection horizon, tree card fix (shared files touched, please read)
Branch: feat/nfs-handling (PR 20)
What changed: (1) NEW `src/fx/grade.js` + tuner root "look": a CSS-filter colour grade on the canvas (contrast 1.1, saturate 1.14, brightness 0.98) and a soft vignette overlay; off on the low tier; hooked in `main.js` (also re-applied when the tuner changes `look.*`). (2) `src/vehicle/vehicle.js` (Stream B file): `polish()` runs once on each loaded model: car paint becomes metallic base plus clearcoat 1.0, glass dark and mirror-like, chrome/rim reflections up, tyres matt. (3) `src/env/environment.js` (Stream B file): a dark ground disc in the reflection scene, so reflections show a horizon. (4) `src/main.js`: PCF soft shadows on the high tier. (5) World bug fixed in `src/world/nature.js` and `scatter.js`: every plant card showed a solid black rectangle in sunlight, because double-sided cards flip their lighting normal on the back side, which made all back faces near black; the card material now keeps the front normal, the card normals are lit mostly from above, and cards cast cut-out shadows (custom depth material). Selftest 25 of 25.
For the other stream: nothing to do, but the sky/lighting/vehicle look (N2) now starts from this; tell me if the car polish clashes with anything in your model work.
Not done: a detailed car model (the current model is low-detail), sun glare/bloom, motion blur.
Status: done

## 2026-11-15 14:00  Arcade handling layer, Need for Speed style (Stream B file, at Rajul's request)
Branch: feat/nfs-handling
What changed: `src/vehicle/rapier-vehicle.js`: new `ARCADE` constants and an `arcade()` step after the tyres: sideways speed is killed faster (planted grip), throttle plus hard steering above 14 m/s lets the tail step out (power slide), the handbrake gives a drift that holds, and the car is pulled toward the yaw rate the steering asks for (crisp turn-in). Off with `?arcade=0`. Not for the bike. Original code, not ported from any other game. Measured at 82 km/h with the handbrake held for 1 s: before, slip 1.47 and the car stopped dead; now slip 0.51 and it keeps 66 km/h.
For the other stream (Anshul): the constants are plain numbers at the top of the file; please move them into the tuner (`core/tuning.js`, `tuning-docs.js`) and tune by feel on the car and the truck. The truck has not been tried.
Second pass (after Rajul said it felt nothing like Most Wanted): the car was slow (0-100 km/h in 6.2 s, 140 km/h after 12 s). `ARCADE.power/curve/aero/brake/grip` now give a hard launch and a long pull (0-100 in about 3.7 s), harder brakes (x1.35) and more grip (x1.12); the car's Afterburn is stronger (accel x2.1, 5 s, 9 s cooldown, `defs.js`). All are numbers in `ARCADE` for the tuner.
Third pass (real data, as Rajul asked): the car now has a real powertrain from published sports-coupe data (`pt` in `defs.js`: 330 kW at 6500 rpm, 7600 rpm redline, 6 gears, 4.0 final drive, Cd x A 0.66, 88% driveline efficiency, mass 1450 kg). `powertrain()` in `rapier-vehicle.js` gives engine torque from the power curve, automatic shifts with a 0.16 s torque cut, a rev limiter and a traction limit; it sets `phys.gear` and `phys.rpm`. Flat-road test: 0-100 km/h 3.3 s, 0-200 10.7 s, top 270 km/h, 270 to 0 in 194 m. All `pt` settings have tuner help. `phys.rpm` and `phys.gear` are ready for `audio/engine.js` to follow (it still guesses the gear from speed): please wire them in. Truck and bike still use the simple model.
Tuner: all handling numbers are now live in the tuner under "handling" (`ARCADE` registered in `main.js`, help in `tuning-docs.js`, root added to the selftest), and the car's `pt` powertrain numbers show under the car. Rajul can drive in the game and change them live to find what feels right; the values he settles on can be published as settings. I renamed `ARCADE.grip/aero/brake` to `gripMul/aeroMul/brakeMul` and `pt.up` to `pt.upshift` to avoid clashing with the tuner's range guesses.
Downforce added (`ARCADE.downforce`, tuner "handling"): the car is pressed into the road with 0.5 x 1.2 x ClA x speed squared, so grip rises with speed. At 211 km/h, peak cornering goes from 1.04 g to 1.13 g (+9%). Straight-line numbers unchanged.
Tyre model (Pacejka Magic Formula, standard published curve): `tyres()` in `rapier-vehicle.js` replaces Rapier's hard-cap side friction on the car (above 2.5 to 6.5 m/s the wheel's side friction stiffness is faded to 0). Each wheel gets a slip angle, a sideways force = mu x load x MF(slip angle) applied at its contact patch, and grip falls past the peak, so the car breaks away progressively. Settings in the tuner under "handling": tyreB, tyreC, tyreE, lockGrip (handbrake), tyreAssist (how much of the turn-in help stays on; was 1, now 0.3 with the tyre model). Checked: load sums to the car's weight; front and rear slip angles agree in a steady turn; straight at 270 km/h with 0.00 m drift (the old model drifted 3.5 m); body slip grows smoothly 0.01 to 0.09 as steering rises (old: nothing, then a snap); handbrake now steps the tail out. Toggle `ARCADE.tyre` off to get the old behaviour. Car only; truck and bike unchanged.
Status: open
## 2026-11-15 12:00  Mountain roads fixed: grade now stays at 11-14% (N3)
Branch: feat/n3-router-grade
What changed: `src/world/locations.js`: the Alps and Himalayas set `maxCut: 1000` (never fall back to the steep stretch; tunnels and cuts absorb the height instead) and `hardGrade: 0.11`. Before: 7-24% (Alps) and 10-21% (Himalayas) of the road was over the hard limit, peaking near 21%. After: about 2% over, peak 14.4% (11.6% on one seed). Cost: more of the road is tunnel (Alps up to 35%, Himalayas up to 37% on one seed, 0-18% on the others). Checked by eye: the Himalayas road climbs a valley with a cut bank, and a 43 m cut turns into a tunnel. Re-run `node tools/locations_check.mjs` to see the numbers.
For the other stream: nothing. Driving physics on 11-14% grades is worth a test with the car, truck and bike (the truck may struggle).
## 2026-11-15 11:00  Mountain roads are too steep (fixed, see the 12:00 entry)
Branch: feat/n3-grade-check
What changed: `tools/locations_check.mjs` now also prints the share of the road above the hard grade limit. Finding: Alps 7-24% and Himalayas 10-21% of the road is over the hard limit (14-15%), peaking near 21%; Mumbai 0%, default 3.7%. Allowing deeper cuts and a lower fallback grade (`maxCut`, `lastGrade`) helped some seeds and made others worse (Himalayas coast 21% to 47%), so I kept the config as it was. The cause is the route choice in `router.js`, not the limits. Next: make the router prefer gentler lines in the mountains (switchbacks) and re-measure with this check.
For the other stream: nothing. Expect the climb to feel steep in the Alps and Himalayas until this is fixed.
Status: done (fixed by the 12:00 entry: hardGrade 0.11, maxCut 1000)
## 2026-11-15 10:00  Marine Drive fixed and placed near the start (N3)
Branch: feat/n3-marine-drive
What changed: `src/world/landmarks.js`: the Marine Drive strip was never rotated into its own frame, so the sea wall, lamps and tetrapods drifted 100+ m off the road; fixed. It now carves its own bay in front of the sea wall, and the sea-side parts sit 7 m further from the road. Landmark search now prefers spots near the requested distance (Mumbai's three landmarks were 1.1 km behind the start). `src/world/locations.js`: Marine Drive no longer needs natural sea and starts the search at s=250.
## 2026-11-14 20:00  Coarser outer terrain ring on med and high (speed)
Branch: feat/n3-terrain-lod
What changed: `src/core/config.js` (shared): the med and high tiers get one more, coarser terrain ring (8 cells per tile at the far edge). Medium: 310k to 282k triangles per frame (-9%), same scene. Not checked by eye on hills; look at distant ridges in the Alps and Himalayas.
For the other stream: nothing.
Status: done

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

# GAME FOR PEACE

## Post-N6 Open-World India Development Plan

### GTA Reversed architectural research translated into the existing Three.js + Rapier project

**Purpose:** This is the next development programme after the existing
N0--N6 roadmap. N0--N6 remain in progress and must not be interrupted or
replaced. This document defines N7 onward: evolving the current driving
game into a living, explorable India-inspired open world.

**Research reference:** `gta-reversed/gta-reversed` ---
https://github.com/gta-reversed/gta-reversed

------------------------------------------------------------------------

# 1. Direction and boundaries

The intended product direction is an open-world India game, not merely a
driving simulator with more roads. The player should eventually be able
to explore a connected world, drive and leave vehicles, encounter
traffic and pedestrians, visit places, interact with selected objects
and take part in activities.

This is an incremental evolution of the existing project: - Keep
Three.js r187 and Rapier as the browser rendering/physics foundation
unless a measured technical case proves otherwise. - Preserve the
current `/next` engine and its world/vehicle work. - Do not rewrite the
engine to imitate GTA's C++ architecture. - Do not copy GTA Reversed
code, assets, maps, scripts, models, sounds or proprietary data. - Use
GTA Reversed as a study reference for system boundaries and design
patterns only. - Do not start the new phases until the relevant N0--N6
foundations are complete and accepted.

The first target is a **small, high-quality Mumbai vertical slice**, not
a full-scale India map. Build the systems so later regions (including
Bhopal, Delhi, Jaipur, Himalayan and southern regions) can be added as
data and asset packs.

## 1.1 What GTA Reversed is --- and is not

The repository describes itself as a
reimplementation/reverse-engineering project for GTA: San Andreas 1.0
US. Its README says the output is a DLL injected into the original game,
with a longer-term goal of a standalone executable; the project
estimates roughly 50--60% of code reversed. It is not a ready-to-use
browser game engine or a standalone open-world framework. See the
repository README: https://github.com/gta-reversed/gta-reversed

The useful research value is the way the codebase separates and
coordinates systems. The phases below translate those ideas into a
web-native architecture; they do not port GTA's implementation.

# 2. Research findings mapped to Game for Peace

The following are source-derived observations from the public GTA
Reversed repository, followed by our proposed adaptation.

## 2.1 Streaming and model lifecycle

**Repository evidence:** `source/game_sa/Streaming.cpp` contains
model/file requests, request lists, loading channels, scene loading,
zone-specific model loading, model removal, deletion of
distant/out-of-view render objects, and streaming of vehicles and
pedestrians. It also has explicit handling for large buildings and
models that should remain loaded.\
Reference:
https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Streaming.cpp

**Adaptation:** Game for Peace already streams procedural terrain tiles.
Extend the concept to all world content: - sector/region metadata; -
prioritised asset requests; - model/texture load states; -
high/medium/low LOD selection; - reference counts/pinning for assets in
active use; - safe unload and GPU disposal; - separate visual and
collision lifecycles; - budgets for bytes, draw calls, entities and
frame-time.

Do not copy GTA's file-channel or memory-address implementation. Use
browser fetch, GLB loaders, texture loading, IndexedDB/cache only where
appropriate, and explicit Three.js resource disposal.

## 2.2 Game lifecycle and subsystem orchestration

**Repository evidence:** `source/game_sa/Game.cpp` separates
initialisation into stages (`Init1`, `Init2`, `Init3`), has a central
`Process()` sequence, and updates systems such as streaming, zones,
weather, scripts, collision, paths, population, car control, camera,
conversations, bridges, plants and effects in a defined order.\
Reference:
https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Game.cpp

**Adaptation:** Keep `src/main.js` as composition root, not a dumping
ground for all gameplay logic. Introduce a lightweight game runtime and
explicit subsystem lifecycle. Use fixed or semi-fixed simulation steps
for physics/AI where needed, while rendering remains frame-driven. Avoid
one giant update function.

## 2.3 Entity pools and typed collections

**Repository evidence:** `source/game_sa/Pools.cpp` defines separate
pools for pedestrians, vehicles, buildings, objects, collision models,
tasks, events, routes and other structures.\
Reference:
https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Pools.cpp

**Adaptation:** Use bounded pools for frequently spawned entities
(traffic vehicles, pedestrians, effects, temporary props) and stable
IDs/handles. Do not pool every object by default. Measure garbage
collection and allocation pressure first. Pooling must have clear
reset/dispose contracts to prevent stale state.

## 2.4 Population and regional variety

**Repository evidence:** `Game.cpp` initialises and updates population
and population-cycle systems. `Streaming.cpp` contains functions for
streaming zone models, vehicles and pedestrians, and chooses models
appropriate to the current zone.\
References: -
https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Game.cpp -
https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Streaming.cpp

**Adaptation:** Build region-specific spawn profiles for Indian
locations. Region data should control pedestrian archetype weights,
traffic categories, density, ambient events and time/weather variations.
Keep the system data-driven; avoid hard-coded city checks spread across
AI code.

## 2.5 Traffic and vehicle population

**Repository evidence:** `Game.cpp` calls car-control generation and
removal routines in the update loop. `Streaming.cpp` has vehicle/ped
streaming and zone vehicle loading.\
References: -
https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Game.cpp -
https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Streaming.cpp

**Adaptation:** Build a road-graph-driven traffic system with bounded
active vehicles, deterministic spawn points, lane/path following,
intersection control, despawn and recovery. Indian traffic variation
should come from region profiles, not a separate traffic implementation
for every city.

## 2.6 Path and world-zone concepts

**Repository evidence:** `Game.cpp` initialises path data (`ThePaths`,
`CPathFind`) and updates path streaming; zones and current area are
separately updated.\
Reference:
https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Game.cpp

**Adaptation:** Game for Peace needs distinct spatial concepts: -
**World region:** Mumbai, Bhopal, Delhi, etc. - **Streaming sector:**
bounded spatial unit for loading. - **Navigation graph:** roads, lanes,
sidewalks, crossings and interior paths. - **Gameplay zone:** market,
residential area, promenade, industrial area, etc. - **Interior
instance:** separately streamed walkable interior.

Do not overload the current terrain tile as all five concepts.

## 2.7 Important research limitation

This research is based on publicly visible repository files and README.
It is an architectural study, not a complete line-by-line audit of GTA
Reversed or a claim that every GTA system is fully implemented there.
The Game for Peace implementation details below are our proposed design,
not features copied from the source.

------------------------------------------------------------------------

# 3. New architecture to grow into

Do not create all these folders immediately. Add a module only when its
phase begins.

``` text
src/
  runtime/
    game-runtime.js
    system-registry.js
    simulation-clock.js
    event-bus.js

  streaming/
    world-streamer.js
    sector-manager.js
    asset-registry.js
    asset-request-queue.js
    asset-lifecycle.js
    lod-policy.js
    memory-budget.js

  entities/
    entity-registry.js
    entity-handles.js
    entity-pool.js
    entity-types.js

  world/
    regions/
    sectors/
    city/
    buildings/
    navigation/
    interiors/
    ...existing world modules

  traffic/
    traffic-manager.js
    traffic-spawner.js
    traffic-vehicle.js
    traffic-ai.js
    lane-follower.js
    intersection-controller.js
    traffic-profiles.js

  population/
    population-manager.js
    pedestrian.js
    pedestrian-spawner.js
    pedestrian-ai.js
    pedestrian-navigation.js
    pedestrian-profiles.js

  player/
    player-controller.js
    on-foot-controller.js
    player-state.js
    vehicle-entry-exit.js

  interaction/
    interaction-manager.js
    interactable.js
    interaction-types.js

  gameplay/
    activity-manager.js
    checkpoint-manager.js
    mission-runtime.js
    save-manager.js

  audio/
    ...existing audio modules
```

This is a target shape, not a mandate to pre-create empty files. Prefer
fewer cohesive modules over many tiny abstractions.

# 4. Execution phases N7--N15

N7--N15 start only after N0--N6 are accepted. If N0--N6 are still
running, agents may read this document and prepare design notes, but
must not start overlapping implementation.

## N7 --- Runtime orchestration and entity lifecycle

**Primary owner:** Stream B. **Stream A:** review world integration
points.\
**Purpose:** establish the lifecycle foundation required by streaming,
traffic, pedestrians and on-foot gameplay.

### Tasks

1.  Audit the current `src/main.js` update loop and identify existing
    manager lifecycle patterns.
2.  Introduce a small `GameRuntime`/system registry only if the current
    code genuinely needs it.
3.  Define system phases: `init`, `fixedUpdate`, `update`, `render`,
    `dispose`; not every system must implement every method.
4.  Define a fixed-step accumulator for simulation systems that need
    stable time steps. Keep rendering independent. Clamp large delta
    after tab suspension and avoid a burst of catch-up steps.
5.  Define event-bus conventions for low-frequency cross-system events
    (region changed, sector entered, vehicle entered/exited, entity
    removed). Do not route every per-frame value through an event bus.
6.  Introduce stable entity IDs/handles and typed registries only where
    needed.
7.  Implement a bounded reusable pool for one temporary entity type as a
    proof of concept; test reset correctness before generalising.
8.  Add deterministic update ordering and teardown tests.
9.  Move systems out of `main.js` incrementally; avoid a risky big-bang
    refactor.

### Acceptance

-   Existing game behaviour and all N0--N6 tests remain unchanged.
-   No double updates or leaked listeners after world reset.
-   Tab hide/show and pause/resume do not create simulation time spikes.
-   Entity handles cannot resolve to recycled stale entities.
-   No measurable performance regression.

### Deliverable

Runtime/lifecycle design note, tests, updated `HANDOFF.md` and Stream B
log.

## N8 --- World sectors and general asset streaming

**Primary owner:** Stream A for world sectors; Stream B for asset
registry/runtime integration.

### Tasks

1.  Define sector coordinates separately from current terrain tile
    coordinates. A sector may group several terrain tiles and content
    types.
2.  Create sector metadata for region, bounds, priority, available
    assets, spawn profiles and navigation chunks.
3.  Implement streaming states: `unrequested`, `queued`, `loading`,
    `ready`, `active`, `unloading`, `failed`.
4.  Add a prioritised request queue based on player distance, view
    relevance, gameplay importance and required dependency.
5.  Pin assets used by active entities; unload only when reference
    counts/pins reach zero.
6.  Separate asset bytes/cache from instantiated Three.js objects.
7.  Support LOD selection and hysteresis to prevent rapid load/unload
    flicker near thresholds.
8.  Add loading budgets by frame and by network/concurrency.
9.  Implement abort/cancellation for requests no longer needed.
10. Dispose geometry, material, textures, render targets and animation
    resources safely.
11. Integrate existing terrain/scenery tiles without replacing the
    working terrain streamer.
12. Add developer overlay for active/queued/loading/unloading sectors,
    asset counts, bytes and failures.
13. Test fast driving across sector boundaries, reversing direction,
    teleport/reset, repeated reload and low-memory behaviour.

### Acceptance

-   No missing-world holes during normal driving.
-   No repeated duplicate loads.
-   No use-after-dispose of shared materials/textures.
-   Sector transitions remain within frame budget.
-   Repeated region changes do not grow GPU memory indefinitely.

### Deliverable

Sector/asset streaming subsystem with stress tests and measured memory
budget.

## N9 --- India geography data and region model

**Primary owner:** Stream A.

### Tasks

1.  Define a versioned region schema:
    -   ID/name;
    -   geographic inspiration and bounds;
    -   world transform/scale;
    -   climate and biome;
    -   road density and road classes;
    -   building styles;
    -   vegetation palette;
    -   traffic and population profiles;
    -   ambient audio profile;
    -   landmarks and points of interest;
    -   sector manifest.
2.  Keep region data separate from rendering and AI code.
3.  Add one Mumbai test region and one Bhopal test profile as schema
    validation, not a full city build.
4.  Decide how the compressed connected India world maps real-world
    relative geography to game coordinates.
5.  Record whether roads/building footprints are hand-authored,
    procedural or derived from OpenStreetMap.
6.  If using OSM, preserve ODbL provenance/attribution and review
    obligations before distribution.
7.  If using elevation data, record exact dataset, licence, resolution,
    vertical datum and transformation.
8.  Add region transition rules and loading-screen/streaming behaviour.
9.  Ensure deterministic world generation from region ID + seed + data
    version.

### Acceptance

-   Two region profiles load through the same code.
-   No city-specific conditionals are required in core
    terrain/traffic/pedestrian systems.
-   Region configuration is validated and versioned.
-   Share codes/save data remain compatible or are explicitly versioned.

### Deliverable

Region schema, Mumbai/Bhopal prototype profiles, geography-source policy
and tests.

## N10 --- Navigation graph: roads, lanes, sidewalks and crossings

**Primary owner:** Stream A for graph and geometry mapping; Stream B for
vehicle/agent consumers.

### Tasks

1.  Extend the road router/road data into a stable graph representation
    without breaking current road APIs.
2.  Represent nodes, directed edges, lane count, lane direction, speed
    target, road class, width, surface, grade, curvature, junction and
    carried bridge/tunnel segments.
3.  Add sidewalks as separate pedestrian edges; never make pedestrians
    navigate directly on the vehicle road centreline by default.
4.  Add crossing nodes/edges, traffic-signal links and safe crossing
    locations.
5.  Add local path query with bounded search and caching.
6.  Add graph chunk streaming by sector.
7.  Add route validity and recovery when a sector unloads or the road
    graph changes.
8.  Create debug visualisation for nodes, lanes, sidewalks, crossings
    and routes.
9.  Test graph continuity at sector boundaries, flyovers, bridges,
    tunnels, roundabouts and dead ends.
10. Expose a stable query contract for traffic and pedestrian systems.

### Acceptance

-   Vehicle paths remain on drivable lanes.
-   Pedestrian paths remain on walkable paths and approved crossings.
-   Routes remain connected across sector boundaries.
-   Search cost is bounded and cached; no full-world graph scan per
    frame.

### Deliverable

Navigation graph API, visual debug mode, deterministic graph tests.

## N11 --- Indian city vertical slice: Mumbai district

**Primary owner:** Stream A for world/city assembly; Stream B for
traffic/ambient integration.

### Scope

Build one small district with a clear boundary and a complete playable
loop. Do not attempt all Mumbai.

### Tasks

1.  Select one district/route that contains a varied but manageable mix:
    arterial road, local street, junction, market/commercial strip and
    coastal/promenade segment.
2.  Decide whether geometry is manually authored, OSM-derived
    footprints, procedural or hybrid.
3.  Build modular building kit and place/assemble it through data.
4.  Add roads, sidewalks, crossings, dividers, kerbs, drains,
    streetlights and road signs.
5.  Add a small number of hero landmarks only where legally
    sourced/created.
6.  Add coastal edge and water/sea wall if the selected slice needs it.
7.  Add parking, bus stop, vendor stall and street furniture.
8.  Use LOD and instancing for repeated buildings/props.
9.  Add region-specific soundscape.
10. Provide a clear spawn point and 5--10 minute exploration route.
11. Test daylight, night, rain and low/medium quality.
12. Capture comparison screenshots and a continuous gameplay video.

### Acceptance

-   District feels recognisably Indian without relying on text labels
    alone.
-   Roads, buildings, collision and navigation agree.
-   Player can drive through without world holes or major collision
    traps.
-   Mobile low/medium tiers meet agreed budgets.
-   All assets have provenance/licence entries.

### Deliverable

Playable Mumbai vertical slice, asset manifest, region profile and
performance report.

## N12 --- Indian traffic simulation

**Primary owner:** Stream B. **Stream A:** navigation graph and region
profile support.

### Tasks

1.  Create traffic vehicle definitions with visual model,
    physics/collision proxy, dimensions, mass, wheelbase, category and
    spawn weight.
2.  Begin with three categories: car, two-wheeler and auto-rickshaw. Add
    bus/truck after the basic system is stable.
3.  Spawn by region profile, road class, time and density setting.
4.  Use lane graph and intersection controller; avoid independent
    steering-to-road-centre approximations.
5.  Implement following distance, speed target, braking, lane keeping,
    turning and despawn.
6.  Implement bounded local avoidance and stuck recovery.
7.  Add simple traffic signals and stop-line behaviour.
8.  Support density presets: off, light, normal, busy.
9.  Ensure spawn points are ahead/behind with safe visibility and no
    spawn directly in the player's collision envelope.
10. Use lower simulation frequency/representation for distant traffic.
11. Pool vehicles and reset all state on reuse.
12. Add horns only as controlled ambient events; avoid constant noise.
13. Test intersection conflicts, bridges/tunnels, road edges,
    congestion, player collision and streaming boundaries.

### Acceptance

-   Traffic never exceeds configured active entity budget.
-   No persistent oscillation or deadlock at basic intersections.
-   Traffic respects road graph and does not drive through buildings.
-   Spawn/despawn does not pop visibly near the player.
-   Performance remains within N8/N11 budgets.

### Deliverable

Playable traffic with debug overlay, region profiles, automated tests
and manual drive video.

## N13 --- Pedestrian population and ambient life

**Primary owner:** Stream B. **Stream A:** sidewalks, crossings, POI and
attractor data.

### Tasks

1.  Build a pedestrian entity using licensed/created rigged models and a
    small animation set.
2.  Implement pedestrian spawn points on sidewalks/plazas, not arbitrary
    terrain.
3.  Create a lightweight state machine: idle, walk, wait, cross,
    use-attractor, flee/avoid, despawn.
4.  Use pedestrian navigation graph and crossing nodes.
5.  Add simple obstacle avoidance and player/vehicle awareness.
6.  Add attractors: bus stop, shop entrance, bench, market stall, plaza.
7.  Use near/mid/far simulation tiers:
    -   near: navigation and animation;
    -   mid: reduced update rate and simplified behaviour;
    -   far: impostor/low-cost representation or no entity.
8.  Use region/time profiles for density and appearance variety.
9.  Keep NPC clothing/appearance respectful and varied; no caricature.
10. Pool pedestrian entities and animation resources.
11. Add crowd caps per sector and global budget.
12. Test collision, crossings, despawn, reset and repeated streaming.

### Acceptance

-   Pedestrians remain on walkable areas.
-   Crossings are controlled and do not send pedestrians into fast
    traffic indiscriminately.
-   No crowd spawn in roads/buildings/water.
-   Stable frame time at agreed crowd density.
-   All character/animation assets have clear licences.

### Deliverable

Living streets prototype with density controls and pedestrian debug
visualisation.

## N14 --- On-foot player, vehicle entry/exit and interactions

**Primary owner:** Stream B. **Stream A:** interaction anchors, doors,
footpaths and interiors.

### Tasks

1.  Design player state machine: driving, exiting, on-foot, entering,
    interacting, blocked/disabled.
2.  Add a third-person on-foot controller with walk/run, jump only if
    product direction requires it, camera collision and basic ground
    snapping.
3.  Reuse Rapier for character collision only if a stable controller can
    be built; otherwise implement a capsule controller using the
    supported Rapier APIs. Do not fake collision with visual-only
    height.
4.  Add vehicle entry/exit anchors and safe exit-side selection.
5.  Prevent exiting into moving traffic, water, walls or invalid
    terrain.
6.  Transfer camera and input ownership cleanly between vehicle and
    player.
7.  Add an interaction prompt system with distance, facing and
    line-of-sight checks.
8.  Implement a small set of interactables: enter vehicle,
    door/entrance, sign/POI, vendor/shop placeholder, seat/bench if
    useful.
9.  Add simple interiors as separate streamed spaces with entry/exit
    transforms.
10. Ensure world streaming keeps both player and current interior
    dependencies pinned.
11. Test keyboard, gamepad and touch input; touch UI must adapt to
    on-foot mode.
12. Add safe fallback if an interior or vehicle fails to load.

### Acceptance

-   Player can exit, walk around and re-enter a vehicle reliably.
-   No camera/input ownership conflicts.
-   No falling through terrain or getting stuck in geometry.
-   On-foot controls work on target phones.
-   Entry/exit works across sector boundaries.

### Deliverable

Playable on-foot/vehicle loop and interaction framework.

## N15 --- Activities, missions and persistent world state

**Primary owner:** Stream B. **Stream A:** activity/POI data.

### Tasks

1.  Add a lightweight activity framework before a full mission scripting
    language.
2.  Define activities as data: ID, start condition, location,
    objectives, completion condition, rewards and save-state key.
3.  Begin with low-risk activities:
    -   exploration/discovery points;
    -   scenic road trip checkpoints;
    -   timed driving route;
    -   delivery route only after traffic safety is reliable;
    -   photography/landmark visit if appropriate.
4.  Add mission/activity lifecycle: available, started, active,
    completed, failed, abandoned.
5.  Add event hooks for entering a region, reaching a POI, vehicle state
    and interaction.
6.  Add save schema with version, player position, selected vehicle,
    settings, discovered POIs and activity progress.
7.  Save safely to localStorage/IndexedDB with corruption recovery and
    schema migration.
8.  Do not persist transient traffic/pedestrian entities initially.
    Regenerate ambient population from region/seed.
9.  Add pause/menu UI for progress and resume.
10. Add autosave triggers and explicit save failure handling.

### Acceptance

-   Activities can be added as data without modifying the main loop.
-   Save/load survives refresh and version migration.
-   Invalid/corrupt save falls back safely.
-   No mission system can soft-lock the player or prevent free
    exploration.

### Deliverable

Activity framework, initial activities, versioned save system and tests.

------------------------------------------------------------------------

# 5. Later phases --- only after N7--N15

These are not immediate work. They require separate scope and
performance review.

## N16 --- Expanded India regions

Add Bhopal as the next complete region after Mumbai, then Delhi, Jaipur,
a Himalayan route and a southern region. Each region needs its own
profile, modular assets, navigation data, soundscape and acceptance
tests. Do not create all regions as cosmetic reskins of one city.

## N17 --- Emergency services and advanced world events

Police, ambulance, fire services, road incidents and dynamic events.
This requires reliable traffic, population, vehicle and event systems
first. Keep the design appropriate to the intended game tone.

## N18 --- Deeper interiors and commerce

More enterable shops, garages, petrol pumps and public buildings.
Interiors need a common streaming/entry/exit contract and must not
multiply asset costs without a gameplay purpose.

## N19 --- Vehicle depth

Damage, repairs, fuel/charging, garages, ownership and deeper
customisation. Add only if these systems support the desired player
experience and are not just simulation overhead.

## N20 --- Long-term world persistence and polish

Persistent world changes, improved NPC routines, richer ambient events,
more regional content, save slots and final performance/quality work.

------------------------------------------------------------------------

# 6. File ownership and collaboration

Use the existing two-stream ownership in `PARALLEL_PLAN.md`. The
following is an extension proposal; confirm it against the real file
ownership before creating modules.

  -----------------------------------------------------------------------
  Workstream                          Owner
  ----------------------------------- -----------------------------------
  Region data, city assembly, world   Stream A
  sectors, navigation graph,          
  sidewalks, crossings, POI anchors,  
  building placement                  

  Runtime orchestration, entity       Stream B
  lifecycle/pools, traffic,           
  pedestrian AI, on-foot player,      
  interactions, activities, saves     

  `src/main.js`,                      Shared; announce before editing
  `src/core/config.js`, shared tests, 
  staging scripts                     

  Asset provenance and credits        Asset owner records each asset;
                                      both streams review

  Existing `src/world/*`              Stream A

  Existing `src/vehicle/*`,           Stream B
  `src/input/*`, `src/audio/*`,       
  `src/ui/*`                          
  -----------------------------------------------------------------------

Do not let both agents edit the same shared file in parallel. Agree API
contracts in team logs before implementation.

## Cross-stream contract required before N10

Stream A publishes: - road graph node/edge schema; - lane and sidewalk
semantics; - crossing representation; - region/sector coordinate
conventions; - POI/attractor placement schema.

Stream B publishes: - traffic agent input/output contract; - pedestrian
agent input/output contract; - entity lifecycle/pool contract; -
player/vehicle entry-exit contract.

Each contract must include units, coordinate frame, update frequency and
ownership.

------------------------------------------------------------------------

# 7. Global performance and safety rules

1.  Every new system has an explicit global and per-sector entity cap.
2.  No full-world scans per frame.
3.  No unbounded pathfinding per frame.
4.  No synchronous large asset decode on the critical driving frame if
    avoidable.
5.  No uncontrolled allocations in hot update loops.
6.  Use distance and importance tiers for simulation as well as
    rendering.
7.  Use deterministic seeds for spawn placement and reproducible bug
    reports.
8.  Separate render meshes from collision proxies.
9.  Dispose GPU resources and event listeners on unload.
10. Keep low/medium quality tiers viable on real phones.
11. Never use unlicensed assets or GTA-derived material.
12. Add telemetry before attempting optimisation.

Suggested first budgets (must be measured and adjusted): - active
traffic: start with 8--15 nearby vehicles for the first prototype; -
active pedestrians: start with 10--20 near pedestrians for the first
prototype; - one district sector should have a bounded asset and entity
budget; - no more than a small, fixed number of path searches per
simulation step; - keep a developer overlay for counts and timings.

These are initial prototype caps, not final gameplay promises.

------------------------------------------------------------------------

# 8. Testing gates

Every new phase must retain all N0--N6 tests and add phase-specific
tests.

-   N7: update ordering, fixed-step clamp, pool reset, stale handles,
    teardown.
-   N8: sector lifecycle, cancellation, priority, pinned assets,
    disposal, repeated transitions.
-   N9: region schema validation, deterministic region generation,
    version compatibility.
-   N10: route continuity, lane validity, sidewalk/crossing validity,
    graph streaming.
-   N11: district traversability, asset licence manifest, visual matrix,
    mobile performance.
-   N12: lane following, intersection, spawn safety, stuck recovery,
    active cap.
-   N13: sidewalk-only spawn, crossing, obstacle avoidance, population
    cap and despawn.
-   N14: enter/exit, safe exit location, camera/input transfer, on-foot
    collision and mobile controls.
-   N15: activity state transitions, save/load, corrupt save, migration
    and resume.

No phase passes on unit tests alone where visual/gameplay judgement is
required. Capture video and test on real devices.

------------------------------------------------------------------------

# 9. Asset and legal workflow

Use the companion `Game_for_Peace_Asset_Acquisition_Brief.md`.

Mandatory: - Record source, creator, exact licence, attribution, date,
original filename, modifications, hash, size and intended use for every
shipped asset. - Prefer original, CC0 or approved CC-BY assets. - Do not
use GTA/Rockstar assets, maps, scripts, audio or ripped models. - Do not
scrape Google Maps/Earth/Street View or proprietary 3D tiles. - If OSM
is used, comply with ODbL attribution and review database share-alike
implications. - Use original Indian modular architecture and regional
variation; generic asset packs alone are insufficient. - Ask the project
owner before paid asset purchases.

------------------------------------------------------------------------

# 10. Agent start instructions

When N0--N6 are still in progress: - Read this document and the existing
master plan. - Do not start N7+ implementation. - Do not modify N0--N6
work. - You may create a short design proposal for N7 only if it does
not touch runtime files and the project owner requests it.

When N0--N6 are complete: 1. Verify the actual Git integration branch
and current source; do not trust an old ZIP or this document over the
repo. 2. Confirm all N0--N6 phase gates and release/deployment state. 3.
Start N7, not N8 or later. 4. Work on a feature branch and PR. 5. Run
`node tools/selftest.mjs` and `python3 tools/daily_check.py` before
every push, plus phase tests. 6. Preserve file line endings. 7. Update
only your own team log. 8. Never deploy. 9. Do not edit generated
`cloudflare/public/`. 10. Do not modify `/` legacy game until the
existing N6 decision authorises it.

## Required N7 kickoff report

Before coding, Stream B must report: - current `main.js` orchestration
and update order; - existing manager lifecycle conventions; - which
modules currently allocate/dispose entities; - current physics timestep
model; - proposed smallest N7 change; - files to touch; - tests to
add; - cross-stream impact.

Stream A must review the proposed world integration boundary and respond
in `team/stream-a.md`.

------------------------------------------------------------------------

# 11. Definition of done for the open-world transition

The project can call itself an open-world India prototype when: - the
player can drive and walk in one continuous playable district; - vehicle
entry/exit is reliable; - a bounded traffic population behaves on the
road graph; - pedestrians walk on sidewalks and use crossings; - the
district streams in/out without holes or memory growth; - buildings,
roads, props and sounds communicate a recognisable Indian urban
setting; - the player can discover locations and complete at least one
activity; - save/load restores player progress; - the experience runs
within agreed desktop and mobile budgets; - every shipped asset has
provenance/licence records; - the original driving game remains
preserved in version history and rollback is available.

This is a prototype milestone, not a claim that the entire country or a
full commercial-scale open world is complete.

------------------------------------------------------------------------

# 12. Reference links

-   GTA Reversed repository and project description:
    https://github.com/gta-reversed/gta-reversed
-   Streaming implementation:
    https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Streaming.cpp
-   Game lifecycle and subsystem orchestration:
    https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Game.cpp
-   Typed pools:
    https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Pools.cpp

The implementation plan above is an independent adaptation for Game for
Peace's browser architecture.

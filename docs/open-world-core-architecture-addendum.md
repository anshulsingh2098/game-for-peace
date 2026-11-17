# GAME FOR PEACE — OPEN-WORLD CORE ENGINE ARCHITECTURE
## Addendum to the existing Post-N6 Open-World India Development Plan

**Status:** Planning addendum only. This document supplements the previously supplied `Game_for_Peace_Post_N6_Open_World_India_Plan.md`. It does not replace, rewrite, renumber, or restart N0–N6 or the N7–N20 roadmap.

**Instruction to the agents:** Treat this as the product and systems brief for the kind of open-world game Game for Peace is intended to become. The architecture priorities in this addendum are informed by a study of established large-scale open-world game-engine designs. You are responsible for inspecting the existing codebase, proposing a suitable architecture for the current Three.js + Rapier project, and deciding how to implement it incrementally. Adapt the principles to this project; do not copy another engine's implementation.

---

# 1. The intended game experience

The target is not simply a driving game with a large map. The target is a **persistent-feeling, living, explorable open world** in which the player can move freely through a connected environment, switch between on-foot and vehicle gameplay, encounter independently behaving people and vehicles, discover places, interact with the world, and take part in activities.

Use the broad structure of a classic, fully featured 3D open-world action game as the reference for the experience. The setting, geography, characters, vehicles, missions, assets, writing, and identity must be original to Game for Peace and India-inspired.

The following describes the desired *system responsibilities and gameplay capabilities*. It is a product brief informed by architectural research; it is not a claim that every capability has already been implemented in the current project.

# 2. The major systems of a full-scale open-world game

## 2.1 A continuous world that is larger than what is currently loaded

The player experiences one connected world, even though the engine only keeps nearby and relevant content active.

The world needs:
- A world-coordinate system and a way to represent large distances without precision problems.
- Regions/cities, districts, neighbourhoods, roads, landmarks, terrain, buildings, water and countryside.
- Spatial sectors/cells used for streaming. A sector is a technical loading unit, not necessarily a city district.
- Different levels of detail for terrain, buildings, props, vegetation and distant landmarks.
- A world directory describing which assets, entities, paths, ambient profiles and activities belong to each region/sector.
- Seamless or well-managed transitions between loaded and unloaded areas.
- Safe loading and unloading without leaving broken references, invisible colliders, orphaned audio or GPU-memory leaks.

**Expected outcome:** the player can travel through the world while the engine loads what is needed ahead and releases what is no longer needed. The world should not need to exist in memory all at once.

## 2.2 Streaming and resource management

Treat streaming as a core engine service, not as a terrain-only feature.

It should manage:
- World sectors and their load states.
- Models, textures, materials, audio, animations and collision data.
- Priority queues based on player distance, direction/speed of travel, visibility, gameplay relevance and memory pressure.
- LOD selection and optional impostors for distant objects.
- Assets that must remain pinned while in use by active entities or missions.
- Separate visual, physics/collision and gameplay lifecycles where appropriate.
- Memory and frame-time budgets, cancellation, retries and failure handling.
- Explicit disposal of Three.js geometries, materials, textures, render targets and other GPU resources.

**Architecture research connection:** The streaming-system study highlighted request queues, loading channels, scene/region loading, model lifetime, distant-object removal and streaming of vehicles and pedestrians. Study these responsibilities and lifecycle patterns; design a browser-appropriate implementation.

## 2.3 World entities and object lifecycle

The world is made of many different entity types, not just meshes in a Three.js scene.

The engine should eventually represent:
- Player and NPC characters.
- Player and ambient vehicles.
- Buildings and static world objects.
- Dynamic props and interactable objects.
- Pickups, activity objects and mission entities.
- Collision objects and triggers.
- Temporary effects, debris and other short-lived objects.

Each entity needs a defined identity, type, state, ownership, activation range, update policy and destruction/unload behaviour. Systems should be able to find entities without depending on fragile scene-graph traversal. Use stable IDs or handles where appropriate. Pool high-churn entities only when profiling justifies it, and define complete reset behaviour.

**Architecture research connection:** The entity-management study highlighted separate bounded pools for categories such as vehicles, pedestrians, buildings, objects, collision models, tasks and events. Adapt the separation and bounded-lifecycle principles, not another engine's memory layout.

## 2.4 Player character and on-foot gameplay

The player must eventually exist as a character in the world, not only as a camera attached to a car.

Required capabilities over time:
- Third-person on-foot movement and camera control.
- Walking, running, jumping and basic movement states.
- Ground detection, slopes, steps and collision response.
- Interaction detection and context-sensitive interaction prompts.
- Entering and exiting suitable vehicles, including door/seat selection where supported.
- Transitions between on-foot and driving states without duplicate player control or camera ownership.
- Animation state integration when suitable character assets are available.

Do not attempt a full character-animation system before a basic controller, collision model and vehicle transition work reliably.

## 2.5 Vehicles and driving

Vehicles are full world entities with physics, visual models, audio, damage/state and AI control—not merely a player-controlled physics body.

The vehicle framework should support:
- Player-controlled and AI-controlled vehicles through a shared vehicle representation.
- Vehicle definitions/configuration for different classes (cars, bikes, vans, buses, trucks and other locally appropriate types).
- Handling, drivetrain, gears, tyres, suspension, braking and damage/state as appropriate to each class.
- Enter/exit and seat/occupant ownership.
- Vehicle spawning, parking, persistence rules and safe despawning.
- Lights, indicators, horns, doors and other interactions when gameplay requires them.
- Spatial engine, tyre, horn and impact audio.

Build on the current Rapier vehicle work. Avoid duplicating separate physics implementations for traffic vehicles unless a measured reason requires a simplified distant-traffic representation.

## 2.6 Traffic simulation

Traffic should make roads feel inhabited and should follow the road network rather than wandering randomly.

The system needs:
- A lane-aware road graph with direction, lane count, speed rules, turn connections and intersection topology.
- Traffic vehicle spawning/despawning tied to active sectors and player relevance.
- Lane following, route selection, intersection negotiation, stopping, turning and basic obstacle response.
- Different traffic profiles by region, district, time and road type.
- A mix of vehicle categories appropriate to the setting.
- Recovery behaviour for blocked, stuck or invalid vehicles.
- Density controls and strict active-entity budgets.

Start with reliable simple behaviours. Add more complex interactions only after the road graph and basic traffic flow are dependable.

## 2.7 Pedestrians and ambient population

Pedestrians should make districts feel different and alive.

The system needs:
- Pedestrian spawn points, population density and activation/despawn rules.
- Walkable navigation paths, sidewalks, crossings and selected pedestrian areas.
- Basic movement, destination selection, avoidance and idle/ambient behaviours.
- Region- and district-specific population profiles.
- Reactions to selected world events and player interactions.
- Crowd limits, update-rate controls and distance-based simulation detail.

The first implementation can use a small number of simple archetypes and behaviours. Do not start with a large crowd simulation.

## 2.8 AI, behaviours and world reactions

AI should be a set of reusable behaviours and decision systems, not one giant script.

Potential AI groups include:
- Traffic drivers.
- Pedestrians.
- Mission-specific characters.
- Security/emergency response characters and vehicles.
- Ambient service or activity actors.

Provide shared concepts for perception, destinations, movement goals, state/behaviour selection, navigation and event response. Keep AI simulation cheaper at distance and inactive when entities are outside relevant sectors.

## 2.9 Interaction and activities

The world needs things the player can discover and use.

Examples of interaction categories:
- Enter/exit vehicles.
- Doors, gates and selected building entrances.
- Pickups and usable objects.
- Shops, service points and activity locations.
- Checkpoints, races, challenges and side activities.
- Mission start points and mission objects.

Use a common interaction contract so activities do not each invent their own input detection, prompt display and activation logic.

## 2.10 Missions, progression and game state

A full-scale open world is supported by activities and progression, not only free roaming.

The game should eventually support:
- Mission/activity definitions as data rather than hard-coded scene logic.
- Objectives, checkpoints, triggers, success/failure conditions and rewards.
- Mission-owned entities and assets that remain loaded when required.
- Activity discovery and replay rules.
- Player progression and unlocks.
- A save/load model for the player and selected persistent world state.

Begin with small activities such as point-to-point driving challenges before building complex multi-character mission scripting.

## 2.11 Police, emergency response, factions and world rules

These are optional later gameplay systems, but they are part of the broader open-world design space and should not be tightly coupled to the traffic or mission code.

Possible future capabilities:
- Law-enforcement response to defined player actions or world events.
- Wanted/alert levels or another original law-and-order system.
- Emergency vehicles and response routing.
- Region/district factions or groups with relationships and territories, if the game design calls for them.
- Rules that define safe areas, restricted areas and event-specific behaviour.

Do not implement these during the initial engine foundation. First establish entities, navigation, AI, event communication and mission state.

## 2.12 Interiors and enterable places

Not every building needs a fully modelled interior. The world should distinguish exterior buildings from selected enterable locations.

For supported interiors:
- Provide an entrance/exit transition or a seamless interior streaming approach.
- Load interior geometry, collision, lighting, audio and interactables as a coherent instance.
- Preserve the player's location and state across transitions.
- Support interior-specific navigation and activity triggers.
- Unload safely when no longer needed, subject to mission/save pinning.

Prioritise a few meaningful interiors over thousands of empty ones.

## 2.13 Time, weather and environmental simulation

The world should have a coherent environmental state that can affect presentation and selected gameplay systems.

Potential systems:
- Time of day and sun/sky lighting changes.
- Weather states such as clear, cloudy, rain, fog and storms.
- Wet-road visual/handling effects if supported by validated physics.
- Ambient sound profiles by region, district and time.
- Region-specific environment settings and seasonal/event variations if desired.

Keep visual weather, physics effects, audio and AI reactions coordinated through shared world state/events.

## 2.14 Camera, HUD, audio and feedback

These are core player-facing systems and should be modular.

- Camera modes for driving, on-foot movement, interaction and scripted activity moments.
- HUD for speed/vehicle state, objective guidance, interaction prompts, map/navigation and status information as features arrive.
- Spatial audio for vehicles, pedestrians, traffic, ambience, weather and interactions.
- Feedback for collisions, mission events, interaction success/failure and world transitions.
- Settings and accessibility options appropriate to the browser game.

Keep the existing seven driving camera views and current vehicle audio work intact while extending the system.

## 2.15 Save data and persistence

Streaming unload is not the same as deleting game state. The engine must distinguish temporary simulation state from state that should persist.

Define persistence categories such as:
- Session-only transient entities.
- Sector state that can be reconstructed from region data.
- Player and vehicle state.
- Mission/activity progress.
- Selected world changes and unlocked content.

Do not attempt to save every pedestrian or every traffic vehicle. Persist only deliberate game state and reconstruct ambient simulation deterministically or approximately.

---

# 3. Cross-system engine principles

The agents should design around these principles, adapting them to the existing browser stack:

1. **Central orchestration, independent systems:** a runtime coordinates systems in a deliberate order; systems own their own logic and lifecycle.
2. **Explicit lifecycle:** initialise, activate, update, deactivate, unload and dispose are distinct operations where needed.
3. **Data-driven regions:** regional identity comes from data/configuration and asset sets, not scattered city-name conditionals.
4. **Separate spatial concepts:** region, district, streaming sector, navigation graph, gameplay zone and interior instance are not interchangeable.
5. **Bounded simulation:** active vehicles, pedestrians, effects, draw calls, memory and update time have budgets.
6. **Distance-aware detail:** nearby entities receive full simulation; distant entities use simplified updates, visual representations or no active simulation.
7. **Event-based communication:** systems communicate through defined interfaces/events rather than reaching into each other's private state.
8. **Deterministic ownership:** every loaded resource and spawned entity has an owner and a cleanup path.
9. **Profile before overengineering:** measure frame time, memory, allocations and loading stalls before adding complex optimisations.
10. **Build vertically:** prove a small area and a complete player activity loop before scaling the map.

# 4. Architectural research findings to carry into implementation

The prior engine-architecture study identified the following useful patterns. Treat these as design references, not implementation instructions. Agents should independently validate the requirements against Game for Peace's current codebase and select suitable browser-native designs.

| Research area | Architectural pattern | What Game for Peace should derive |
|---|---|---|
| Runtime orchestration | Staged initialisation and a central update sequence coordinating streaming, zones, weather, scripts, collision, paths, population, vehicle control, camera and world effects | Runtime lifecycle, subsystem registry, explicit update ordering and clean system boundaries |
| Streaming management | Request lists, loading channels, scene/region loading, model lifetime, distant-object removal, large structures and vehicle/pedestrian streaming | Sector/asset streaming, priorities, pinning, LOD, safe unload and resource budgets |
| Entity pools | Separate bounded pools for different entity/data categories | Typed entity registries/pools, stable handles and predictable lifecycle |
| Navigation systems | Path data and pathfinding responsibilities | A navigation graph for roads, lanes, sidewalks, crossings and interiors |
| Population and vehicle control | Population/vehicle creation, control and removal as part of the world update, coordinated with region-specific loading | Regional spawn profiles, bounded ambient simulation and traffic lifecycle |

# 5. What this means for the existing Game for Peace roadmap

This addendum is an **intent and architecture brief**, not a replacement phase plan.

- N0–N6 continue exactly as already assigned. Do not interrupt them to begin this work.
- Keep the existing Post-N6 N7–N20 phases and their ownership as the baseline roadmap. Do not silently renumber or replace those phases.
- When N0–N6 are complete and accepted, use this addendum to guide the detailed design and implementation of the existing N7 onward phases.
- If the agents conclude that a genuinely necessary foundation is missing from the existing roadmap, propose a clearly named sub-phase or change request in the relevant stream log and explain its dependency. Do not unilaterally rewrite the roadmap.
- The initial playable target remains a small, high-quality Mumbai vertical slice. Do not attempt to build all of India, all interiors, full police/faction systems or a huge population in one step.
- Keep `/` (the old game) untouched. Work on `/next` only.
- Preserve all existing repository rules: stream file ownership, PR workflow, self-tests, daily check, line-ending safety, no deployment by agents and no edits to generated `cloudflare/public/`.

# 6. Instructions to Stream A and Stream B

**Stream A — World (Rajul):** Study the world, sector, streaming, region/district, asset lifecycle, navigation and environmental responsibilities. Identify how the existing procedural tile/road world can evolve into a connected world with independently streamable content. Propose data contracts and boundaries; do not start N7+ implementation while N0–N6 remain in progress.

**Stream B — Vehicle and Game (Anshul):** Study runtime orchestration, entity lifecycle, player/on-foot state, vehicle ownership, traffic, pedestrian/AI simulation, interactions, activities and persistence. Identify how existing vehicle/input/audio/physics systems can be extended without creating a second competing engine. Propose data contracts and boundaries; do not start N7+ implementation while N0–N6 remain in progress.

**Joint responsibility:** agree on shared contracts for world coordinates, entity identity, sector activation, navigation, events, simulation ticks and resource ownership before implementing cross-stream systems. Keep cross-stream questions open in the existing team logs until the other stream responds.

# 7. Definition of success

The long-term success criterion is that Game for Peace becomes a modular open-world game in which:
- The player can explore a connected India-inspired environment on foot and in vehicles.
- World content streams in and out safely around the player.
- Roads, traffic and pedestrians behave according to spatial data and regional profiles.
- Vehicles and characters are real entities with clear ownership and lifecycle.
- Places contain discoverable interactions and activities.
- Missions/progression and selected world state can persist.
- New cities and regions can be added primarily through data and asset packs rather than rewriting core systems.
- Performance remains bounded and testable as the world grows.

The agents should determine the practical architecture and implementation sequence for the current codebase. This document defines **what kind of engine and game we are trying to build**, not the exact code they must write.

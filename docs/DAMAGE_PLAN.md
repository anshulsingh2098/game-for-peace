# Crash damage and impact physics: plan

Status: PLAN; phase 1 (cones and dustbins) and phase 3 (visible dents on the player's vehicle) and the player-vehicle part of phase 4 (lost power, pull, engine fire, burst, charred wreck) are built, on branches `vehicle/damage-1`, `vehicle/damage-3` and `vehicle/damage-4` (Stream B, Anshul's Claude, 22 Nov 2026). Phase 4 also covers traffic and parked cars (branch `vehicle/damage-5`). Phase 2 for lamp posts and electric poles is built (branch `vehicle/damage-6`). Not done: signs, bollards, bus shelters and stalls, signal masts, trees, momentum exchange between cars, phase 5. Nothing here is accepted by the owner yet.

Goal: when a vehicle hits something, what happens should depend on the thing and the speed: a trash can flies, a cone flips, a light pole snaps or holds, a wall wins, a parked car is shoved and dented, and the player's car (and any other vehicle) shows damage that builds up.

## 1. What the research says (and what it does not)

Real roadside safety, in short (FHWA and the National Academies' MASH-based guidance, see sources):
- **Breakaway supports:** urban light poles and sign posts are designed to give way at the base (slip base, frangible coupling or a cast aluminium transformer base) so the car is slowed less and the occupants are hurt less. FHWA says these must not be used on poles fixed to a concrete barrier. A pickup at about 100 km/h hit a luminaire pole and detached it at the base. So: a thin light pole snaps off at the base and falls, it does not stand and wreck the car. In one test the fallen pole crushed the roof: a fallen pole is itself a hazard.
- **Rigid objects:** concrete barriers do not move; a car hitting one at 45 degrees and 80 km/h was severely crushed in one comparison test, while wire rope and W-beam barriers (which yield) caused no cabin deformation. So: hard things hurt the car most; yielding things hurt it least.
- **Heavy vehicles:** a heavy electric pickup tore through a steel guardrail and hardly slowed down. So: the vehicle's mass matters; a truck breaks what a hatchback cannot.
- **Poor foundations:** poles in weak soil do not break away as designed. Not modelled.

How games do vehicle damage (Kenwright 2023, Edy's Vehicle Physics, Steel Hunters, BeamNG discussion): displace the vertices of the body near the impact point, up to a limit, with some noise; keep the collider consistent with the visible dent; store damage per zone; part durability and weight decide what detaches. Vertex dents suit small and medium damage; large deformation needs a node-and-beam model (BeamNG), which is out of scope here.

What the research did **not** give: speed thresholds for each object. The numbers in the table below are **design choices**, picked so the result looks believable, not measured facts. They are one table in code (`DAMAGE` in `src/world/city/breakables.js`) so the owner can tune them.

Sources: [FHWA FAQs on breakaway sign and luminaire supports](https://highways.dot.gov/safety/rwd/reduce-crash-severity/faqs-breakaway-sign-and-luminaire-supports); [Guidelines for Evaluating Crashworthiness of Sign Supports and Breakaway Luminaire Poles (National Academies, 2024)](https://www.nationalacademies.org/read/27869/chapter/5); [Kenwright, Scalable Real-Time Vehicle Deformation for Interactive Environments](https://arxiv.org/pdf/2304.05045); [Edy's Vehicle Physics, Car Damage](https://vehiclephysics.repositoryhosting.com/trac/vehiclephysics_edys-vehicle-physics/wiki/CarDamage?version=1); [Steel Hunters destructible cars](https://80.lv/articles/setting-up-destructuible-cars-for-steel-hunters-pvpve-shooter).

The barrier comparison (concrete versus W-beam versus wire rope) and the heavy electric pickup through a guardrail come from search-result summaries of crash-test reports; I did not open the full reports, so treat those two as pointers, not citations.

## 2. The measure: how hard was the hit

For every contact we know the car's mass `m` (about 1450 kg for the Dusk GT, from `defs.js`), the closing speed along the contact normal `vn` (m/s, the physics already computes it as `impact`) and the thing hit. Hit energy `E = 0.5 m vn^2`:

| closing speed | km/h | E for a 1450 kg car |
|---|---|---|
| 2.8 m/s | 10 | 5.7 kJ |
| 5.6 m/s | 20 | 23 kJ |
| 8.3 m/s | 30 | 50 kJ |
| 13.9 m/s | 50 | 140 kJ |
| 22 m/s | 80 | 350 kJ |

Each kind of object has a response class and thresholds on `vn` (not energy, so it reads simply). A heavier vehicle (a truck, 8000 kg) uses `vn` scaled by `sqrt(m / 1450)`, so it breaks what a car cannot.

## 3. What breaks, what bends, what holds

Response classes: **pass** (no stop, only drag), **move** (shoved or knocked over, becomes a rigid body, comes to rest, may be set up again later), **snap** (breaks at the base, falls, stays down), **shatter** (breaks into pieces that scatter), **bend** (stays attached, leans, may spring back), **hold** (immovable, the car takes the damage).

| Thing in the game | Real-world idea | Class and threshold (closing speed) | Car damage |
|---|---|---|---|
| Traffic cone | light plastic | **move** from 0.5 m/s: flips and slides, never breaks | none |
| Trash can / dustbin (not in the game yet; new) | 15 to 40 kg plastic or steel | **move** from 1 m/s: tumbles; lid flies; waste scatters above 6 m/s | scuff under 8 m/s, a dent above |
| Plastic road bollard / delineator | flexible post | **bend** to 60 degrees and spring back, never snaps | none |
| Steel or concrete bollard | rigid | **hold**; above 22 m/s (80 km/h) it tilts out of the ground | heavy |
| Street sign on a thin post | light steel, breakaway | **bend** from 4 m/s; **snap** from 8 m/s, falls | light |
| Light / lamp post (urban, steel) | breakaway base | **hold** under 6 m/s (dents the car); **snap at the base** from 6 m/s (22 km/h), falls across the road in the travel direction | medium; a falling pole can dent the roof |
| Traffic signal mast | heavy steel, base plate | **hold** up to 14 m/s; **snap** above (rare) | heavy |
| Electric pole with wires (concrete or steel) | rigid, wires | **hold**; above 25 m/s it snaps and drags the wires | very heavy |
| Direction gantry column | heavy concrete | **hold** always | very heavy |
| Bus shelter | glass panels, light frame | **shatter** the glass from 5 m/s; frame **bend** from 8 m/s | medium |
| Stall / kiosk / chai stand | thin metal and wood | **shatter** from 4 m/s: frame and goods scatter | light |
| Hedge, shrub, small bush | soft | **pass** with drag (speed lost about 5 percent) | none |
| Small tree (trunk under 0.2 m) | flexible | **bend** under 12 m/s; **snap** above | light |
| Large tree | rigid | **hold** | heavy |
| Concrete barrier (Jersey), wall, building | rigid | **hold** | heavy, worse head-on |
| Steel fence / barricade section | light steel | **move** from 7 m/s: the section is pushed and falls | light |
| Kerb stone (already in the game) | low | mountable under 2.5 m/s (existing), above that it acts as a wall | wheel and suspension jolt |
| Parked car | 1200 kg, locked | **move**: shoved with momentum exchange, both cars dent | medium both |
| Other traffic car | moving | momentum exchange; both dent; the hit car brakes or spins | medium both |
| Two-wheeler / auto-rickshaw | light | **move**: falls over, slides | light |
| Walker | (done) | ragdoll, see `vehicle/ragdoll` | none |

## 4. Damage to the player's car and other vehicles

Four zones (front, rear, left, right) plus wheels. Each hit adds `dent = k * max(0, vn - soft)^1.5` to the zone, limited by `maxDent` (0.35 m). Visual: the body mesh vertices near the contact point move inward along the normal, smoothly (a falloff), with a little noise. The same offset lowers the collider a little so later hits agree with the picture.
- **Levels:** light (scuffs and a small dent), medium (large dent, bumper loose), heavy (crumpled, hood or door hanging, smoke), wrecked (smoke and fire, engine power limited).
- **Parts that come off:** bumper above 12 m/s front or rear; mirror from 5 m/s; a door or the hood hangs open above 18 m/s; glass cracks.
- **Effects on driving:** a front hit above 15 m/s can pull the car to one side (steering offset), a wheel hit above 12 m/s sideways bends the wheel (wobble, grip loss), engine damage cuts power above 70 percent damage.
- **Cosmetics only first;** driving effects come in phase 4 and can be turned off in Settings.
- **Repair:** the "To road" button repairs the car (and a Settings toggle for damage on or off).

## 5. Phases

| Phase | What | Where | Done when |
|---|---|---|---|
| 0 | This plan, the table, the measure | `docs/DAMAGE_PLAN.md` | owner reads it and corrects the table |
| 1 | Impact core and the first breakable props: cones and trash cans appear on the pavements of Delhi; typed obstacles (`kind`) reach the car physics; hit objects become rigid bodies and tumble | `src/world/city/breakables.js` (new), `cityworld.js`, `rapier-vehicle.js` hook, `src/main.js` | the car drives into a bin and a cone: they fly and the car loses little speed; seen in a browser |
| 2 | Breakable street furniture that already exists: light poles snap at the base (poles are merged into the tile mesh today, so they need their own instanced layer), signs, bollards, stalls, shelters (shatter) | `streetlife.js` (Stream A's file; needs the owner's yes), `breakables.js` | a pole falls and stays down; nothing else in the tile changes |
| 3 | Car damage, visual: zone dents by vertex displacement, loose bumper, smoke | `src/vehicle/damage.js` (new), `vehicle.js` | hit a wall at 30 and 60 km/h: the dent differs; Repair restores |
| 4 | Driving effects: pull, wheel damage, power loss; Settings toggle; other vehicles (traffic cars, parked cars) dent and exchange momentum | `rapier-vehicle.js`, `citytraffic.js` | seen driving; the toggle works |
| 5 | Tuning with the owner, the tests, phone check, sounds (crash, glass, metal) | table `DAMAGE`, `tools/selftest.mjs` | owner accepts |

Rules: phases land as separate small branches off `main`; the owner decides case by case (see `A-2026-11-18-15`). Shared files (`main.js`, `cityworld.js`, `selftest.mjs`) are touched in a few lines and logged. Each phase says in its log entry what was implemented, what the self-test covers, what was seen in a browser and what was not.

## 6. Risks

- Props in the city are merged per tile (4 draw calls), so one object cannot be removed from the mesh. That is why breakable things get their own small instanced meshes (a few more draw calls per tile): new props first, existing poles in phase 2.
- Every breakable that is in motion costs physics time: at most 24 active at once, the rest stay put; bodies sleep when still and are put back after 60 s or when far away.
- Damage that changes handling can annoy players: it is off by default for driving effects until the owner decides.
- Rapier worlds: the ragdoll (`vehicle/ragdoll`) already uses its own world with the car as a kinematic box; debris will use the same pattern (one shared small world).

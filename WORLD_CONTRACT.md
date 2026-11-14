# World / road / physics contract

What Stream A (world) promises Stream B (vehicle and game), taken from the code as it is, not from memory. If you need something to change, add a new method or field and keep the old one until both streams have moved over (see `PARALLEL_PLAN.md`). Units are metres, seconds and radians. World coordinates are `x` and `z` on the ground, `y` up; the render origin floats (`grid.origin`), but everything below uses world coordinates.

## Road (`src/world/router.js`, class `Road`)

- **Road distance `s`** is metres along the centre line. `0` is the start; it grows along arm A and is negative along arm B. `road.sMin` and `road.sMax` are the ends generated so far; `road.ensure(lo, hi)` generates more. `road.ds` is the sample spacing.
- **`road.at(s, out = {})`** fills and returns `out`: `x`, `z`, `y` (road surface height), `th` (heading, `atan2(tz, tx)`), `tx`, `tz` (unit tangent on the ground), `slope` (rise over run, signed). Left of travel is `(-tz, tx)`.
- **`road.nearest(x, z)`** returns `true` if the road is within reach and fills `road.hit = { d, s, y }`: `d` is the distance to the centre line, `s` its road distance, `y` the road height there. `hit` is shared, so read it straight after the call.
- **`road.closestS(x, z, hint)`** is a slow global search (about 3 km each way); use it for resets and tools, not every physics step. For per-frame work search a few metres around your last answer (see `bridge_rails.js`).
- **`road.bridgeW(s)`** is 1 on a bridge (over water and 10 m either side), easing to 0 over the next 20 m of land. **`road.tunnelW(s)`** is 1 inside a tunnel, 0 outside, smooth between. **`road.carriedW(s)`** is the larger of the two: the land is left alone and the deck carries the road. **`road.tunnelRise(s)`** is the metres of mountain over the road.
- **`road.style`** is a cross-section from `roadstyles.js`: `half` (half width of the asphalt), `shoulder` (where the paved/gravel shoulder ends; bridge decks and rails are at this width), `outer`, `lines` (painted lines: `t` lateral offset, `w` width, optional `dash`), `surfaces` (lateral bands and their surface key), `cols`.
- **Lanes:** the centre line is the middle of the road. Lanes are at lateral offsets of `±half/2` for two-lane styles; read the painted `lines` for the real lane edges. Traffic should place its vehicles by these numbers and not duplicate road geometry.

## Terrain (`src/world/terrain.js`)

- **`terrain.base(x, z)`** natural land height. **`terrain.height(x, z)`** land with the road graded in. **`terrain.drive(x, z)`** is the height a wheel rolls on: the graded land lifted to the road surface, the bridge deck or tunnel floor where the road is carried, falling off the deck edge. The vehicle physics builds its ground from this one function, so **never fix a visible road problem by changing only the drawn mesh**: the render, `road.at`, `terrain.drive`, `terrain.surface` and the obstacles must agree.
- **`terrain.surface(x, z)`** the surface key (`asphalt`, `gravel`, `grass`, `sand`, `snow`, ...) used for grip, drag and sound. **`terrain.seaLevel`**.
- **`terrain.inZone(x, z, r)` / `terrain.addZone(x, z, r, y, blend)`** a flat zone levelled for a landmark; it changes what is built and driven on, not the road routing.

## Obstacles (`world.near`, built in `src/main.js`)

The vehicle physics calls `world.near(x, z, r)` (several times a second) and gets **an array of lists of circles** `{ x, z, r, slide? }` in world coordinates, for obstacles within about `r` metres. Each circle pushes the car out (`collide()` in `src/vehicle/rapier-vehicle.js`). Sources: trees and rocks (`Scatter.near`), landmarks (`Landmarks.near`) and **bridge rails** (`Bridges.near`, from `src/world/bridge_rails.js`).

- A circle with `slide: true` is a long wall (a rail): the car loses little speed, gets a small bounce and is turned parallel to it. Without `slide` the circle is a solid object (a tree): the car loses 15% of its speed on contact.
- The lists may be reused between calls: read them at once, do not keep them.
- Bridge rails: two lists of circles, 0.35 m radius, one every metre along both rails of every stretch with `bridgeW === 1`, at `style.shoulder - 0.07` m from the centre line (where the rail is drawn). Tested in `tools/selftest.mjs` (the circles sit on the rail, none on plain road, and no vehicle gets through at up to 220 km/h).

## What the world expects from the vehicle

The vehicle passes `{ x, z, y, yaw, u, v }` and its definition (`src/vehicle/defs.js`: `front`, `rear`, `track`, `wheelR`, `radius`, `circles`) to `Scatter`, `Landmarks`, `Autodrive` and the road streaming each frame. If the car's size changes, `radius` and `circles` decide how close it can get to trees, rails and landmarks.

## Known limits

- Rails stop the car about 0.5 m short of the drawn rail when it hits at an angle (the car's circles are 1.0 m radius).
- Tunnel walls and bridge piers have **no obstacle circles**. Whether the car can drive into a tunnel wall or off a deck edge into a pier has not been tested.

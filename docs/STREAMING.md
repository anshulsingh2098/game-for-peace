# Sectors and shared-asset streaming (N8)

Code: `src/world/sectors.js` (Stream A), `src/core/assets.js` (Stream B), wiring in `src/main.js`. Tests: six checks in `tools/selftest.mjs` (44 in all). The terrain tile streamer (`chunks.js`) is untouched: sectors sit above it.

## Sector coordinates
A sector is a 512 m square of the world: `sx = floor(x / 512)`, id `"sx,sz"`. A terrain tile is smaller and lives in its own grid; a sector may later hold navigation data, spawn profiles and interiors, which the tile grid never will. Metadata per sector today: bounds, region (the location id), the list of shared assets it needs, priority, pins. More fields (spawn profile, navigation chunks) arrive with N9 and N10 through the `meta` hook.

## Lifecycle
`unrequested (not tracked) -> queued -> loading -> ready -> active -> ready -> unloading -> unrequested`, plus `failed`.
- Wanted: within 900 m of the player or of the point reached in 4 s (so fast driving loads ahead); kept until beyond 1200 m (the gap is the hysteresis; tested with 200 jittering updates at the edge: no extra load, no unload).
- Active: within 600 m (deactivated beyond 750 m).
- Queue order: nearer first, ahead of the player first, `importance(sector)` bonus. Budget: at most 2 loads at once and 2 starts per update.
- Cancellation: a queued sector that is no longer wanted costs nothing; a loading one is aborted (the loader receives an `AbortSignal`), and a result that still arrives late is handed to `unload` so nothing leaks.
- Pins: `pin(id, owner)` keeps a sector loaded until every pin is released.
- Failure: marked `failed`, retried after 1, 2, 4 s (at most 3 retries); `retry(id)` starts over.
- `reset()` (a rebuilt world, `bus` event `world:rebuilt`) frees everything at once, and late results from before the reset are freed (epoch check).

## Asset cache
Separate from the three.js objects built from the data. One load however many ask (tested: 10 concurrent acquires, 1 load); held while `refs > 0` (pinned, never evicted); idle entries are evicted least recently used first when over `maxBytes` (`trim()`); if every holder of a still-loading asset releases it the load is aborted; failures are not cached.
In the game: traffic holds the vehicle pack for the session, each loaded sector holds it too; after 12 s of autodrive and a region change the reference count equals one plus the sectors alive (17 = 16 + 1): no leak across a rebuild.

## Developer view
`?debug` shows a `sectors` line in the stats panel: counts per state, loaded / unloaded / aborted, assets held and idle with their size. `__next.sectors` and `__next.assetCache` are available in the console.

## Measured
California, medium tier, 12 s autodrive: 19 sectors loaded, vehicle pack loaded once (1.7 MB), no errors. Per frame the sector update loops a few dozen sectors (microseconds); the 10 s benchmark showed no change.

## What this does not do yet (on purpose)
- Terrain tiles, scenery and road pieces are not sector content yet; they keep their own streamers. Moving them behind sectors is only worth doing once something needs it (N10 navigation chunks, N11 district content).
- Level-of-detail selection per sector and impostors: the hysteresis radii are there, per-object LOD arrives with the district assets (N11).
- A memory budget in bytes for GPU objects: the cache counts asset bytes only; GPU memory is watched through the stats panel (`geometries`, `textures`), which showed no growth over repeated region changes.

## N8 step 2 (19 Nov 2026): sectors hold content, not only assets
In `?india=` mode a sector's `meta` now carries the region of its centre (`world/regionmap.js` `regionAt`: the nearest region by the place it is an impression of, with a blend within 150 km of the border with the second) and the cities of the route that lie inside it (`guidePoint` of the road's guide, in terrain coordinates; `gameFrame` converts to India game space). Loading such a sector builds the city's crossing roads, the junction signals and the side-road traffic (`ensureCityJunction`; if the main road has not grown that far yet it is extended first, and a failure is retried by the manager's back-off); unloading it removes them. The 900 m load, 1,200 m unload and 4 s look-ahead of the manager give the hysteresis, so crossing roads appear about a kilometre before a city and go once you are well past. Not yet sector-driven: terrain tiles, plain road pieces, scenery and districts (they stream by tile or road piece), and the player's own road, which is still one guided path.

## One India world (20 Nov 2026)
In the default India world the sector manager also owns the crossing highways: when a sector with a city is within 900 m the city's other highways, junction and signals are built, and released beyond 1,200 m. Roads are registered in a road registry (`primaryRec`, `branches`, `activeRec`: the road the player is on, heading aware) in `main.js`; `?india=world&at=<city>` picks the start.

# Region model and India geography (N9)

Code: `src/world/regions.js` (schema, validator, the four India regions, `regionToLocation`, `regionTransition`). `locations.js` now builds Mumbai, Delhi, Agra and the new Bhopal entry from region records; nothing else in the engine mentions a city. Tests: three checks in `tools/selftest.mjs` (47 in all).

## What a region is
Plain, versioned data (schema 1; the field list is the header comment of `regions.js`): identity, inspiration place with latitude and longitude, transform (anchor and compression), climate (starting sky), land (terrain, palette, water), vegetation, roads (style, maximum altitude, drive side, density), buildings (styles, density), traffic (vehicle mix and a density multiplier), population, audio ambience, landmarks, provenance. Rendering, traffic and AI code read it; none of them contains region data.
Checked by `validateRegion`: types and ranges, the inspiration point must lie inside India (lat 6 to 36, lon 68 to 98), road style, vehicle kinds, landmark kinds (cross-checked against the real landmark builders in the self-test), and provenance rules (below).

## Decisions recorded
1. **Mapping real geography to game coordinates.** Each region is its own generated world with local (0, 0) at its anchor (`transform.anchorLat/anchorLon`). `metresPerGameMetre` records the compression (1 = none today). A future connected-India map (N16 and later) places regions at their real relative positions on a compressed national layout and joins them with long roads; that layout will be a separate data file that references region ids, so no region record changes. Until then regions are reached through the location picker.
2. **Where roads and footprints come from.** Today: roads are procedural (the router over the generated terrain) and buildings are not generated at all. Regions are `hand-authored` (the four landmark cities) or `procedural` (Bhopal). OpenStreetMap is allowed only when a region records `provenance.osm` with attribution and licence `ODbL-1.0`, and the owner has reviewed the share-alike obligations first (the validator rejects an `osm` region without them). **Owner decision still needed before any OSM data is used.**
3. **Elevation data.** None is used (terrain is procedural). If it is, the record must name the dataset, licence, resolution in metres, vertical datum and the transformation (validator enforced). No Google Maps, Earth, Street View or proprietary 3D tile data, ever.
4. **Deterministic worlds.** `locationConfig(id, seed)` returns a full config that now carries `region: { id, version }`. The same region id, data version and seed give the same world (tested by building twice and comparing heights). Bump `version` whenever a region's numbers change.
5. **Share codes and saves.** Codes carry the whole config, so they now include the region version; codes made before regions have no `region` key and still load (treated as version 0, legacy: tested). Region schema changes need a step in `migrateRegion`; none is needed yet.
6. **Transitions.** `regionTransition(from, to)` today always answers "reload behind the loading screen" (the world is rebuilt). A `seamless` kind is reserved for the connected map.

## What already reads region data (no city names in code)
- The location list, starting sky, drive side, landmarks and world numbers: through `regionToLocation`.
- Traffic density: `traffic.scale` multiplies the Low/Mid/High caps (Mumbai 1.0, Agra 0.7, Bhopal 0.6, tested).
Data present but not used yet: vehicle mix (needs two-wheeler and rickshaw assets, N12), buildings (N11), population (N13), audio ambience (a later pass).

## The two test regions
Mumbai (hand-authored, unchanged world: its config hash before and after the move is identical) and Bhopal (new, procedural: low green hills, about 10 percent lake, small bridges, two-lane roads, left-hand traffic, lighter traffic). Delhi and Agra moved to the same format at the same time. The other locations (Green Valley, Alps, Himalayas, California, Southern Coast) are not India regions and stay as they were.

## Blending between regions (N9 step, 19 Nov 2026)
In `?india=` mode the land is one continuous map, so the look of the ground changes with position. `main.js` builds a coarse grid (50 real km cells) of the nearest region, the second nearest and a blend weight (`world/regionmap.js`, the same rule sectors use), plus each region's palette and plant tint; `terrain.js` (`regionAt`, `regionTint`) mixes the ground's grass, deep-grass and dry colours and `scatter.js` mixes the plant tint by position, so driving from Delhi through Rajasthan to the Deccan shifts from green-grey plains to ochre dry land to green hills. Not blended: water colour (one material), tree species mix, road style, buildings, traffic mix, audio.

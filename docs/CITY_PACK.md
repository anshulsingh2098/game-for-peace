# City pack: architecture decision and file format (CITY_PLAN Phase 0, written 22 Nov 2026)

Status: **agreed by the owner on 22 Nov 2026 ("entered from highway like a bypass in real world"; see CITY_PLAN, Owner answers)**: the enclave is entered from the highway the way a bypass or exit leads into a city. Nothing here is built except the keep-out registry (section 2). No data has been downloaded. Where a number is a guess it says so.

## 1. Where the mess came from: the code paths and who owns which ground (audit, 22 Nov 2026)

| Ground | Who puts it there | Who it knew about before Phase 0 |
|---|---|---|
| Roads (one polyline each, routed procedurally between waypoints) | `router.js` `Road`, `roadset.js` `RoadSet` (the player's road plus the highways through the city and region junction arms, built in `main.js` `buildCityRoads` / `buildRegionJunctions`), drawn by `road.js` `RoadMesh`, with `bridges.js`, `retaining.js`, `tunnels.js`, `highway.js`; crossings become overpasses (`interchange.js`, PR 49) | each other, through the RoadSet |
| Buildings, sidewalks, lamps, stalls, signals | `district.js` / `district_plan.js`: **one strip per road**, plots on both sides of its own road at a fixed distance, five sample points per plot checked against `terrain.inZone` and the sea | only its own road. Not rails, stations, other roads, other plots, landmarks (except through levelled zones) |
| Railway (track, cuttings, embankments) | `rail_grade.js` (ground), `rail_view.js` (chunks, trains, level crossings, rail bridges) | roads, for crossings only |
| Stations | `rail_view.js` `buildStation`: two 120 m platforms with a canopy and a 34 x 9 x 7 m building 17 m beyond the outer track, at each rail node | nothing: the building stood wherever the node was |
| Landmarks | `landmarks.js`: sights beside the main road, levelling the land with `terrain.addZone` (circles, strips); only for a region's own list | the main road |
| Trees, bushes, rocks | `scatter.js`, per terrain tile | roads (nearest road distance) and levelled zones; not rails, stations, plots |
| People and cars | `pedestrians/`, `traffic/` on the roads' navigation graph (`navgraph.js`) | roads |

Why Agra looked broken: the district is built for **every** region road, and it asked only "is this one of my own five sample points in a landmark zone". Agra has trunk railways, a station and several highways meeting in a few hundred game metres, so plots stood on rail beds, on the other highways and on the station. The giant flat slabs seen from above are the station's canopies (96 x 5.4 m) and buildings (34 x 9 m, flat colours) and 12 m deep district plots: they are drawn at real size but are plain boxes. They are not wrong in size, they are wrong in placement and in being the only kind of building there is. Kolkata has no region of its own yet and shows the fallback region's district (Bhopal's, seen once in a slow-loading page, not examined further).

Measured with the registry (probe in the browser, 1.5 km each way along the main road, medium quality): plots the old planner would have built that touch a rail bed, a station or another road.

| City | Plots before | On a rail bed | On another road | On a station | After the registry |
|---|---|---|---|---|---|
| Agra | 430 | 109 | 26 | 8 | 0 touching (plots left 279; the rest also dropped for overlapping each other or a bend) |
| Delhi | 469 | 83 | 90 | 11 | 0 touching (282 left) |
| Mumbai | 247 | 3 | 98 | 0 | 0 touching (144 left) |

(First claim hit is counted, so categories do not double count. Kolkata and the other cities without a district region are not measured.) The plots also overlapped **each other** on bends (two plots of one road, inside corners); fixed in the same change. Not fixed: the station canopies and platforms themselves (they stay where the track is), and nothing was looked at by a person from the air.

## 2. The keep-out and ownership registry (built)

`src/world/keepout.js` (pure, tested), one instance per world at `terrain.keepout`.
- **Claims**: `line` (polyline with half width: roads, rail beds), `circle` (landmark zones), `rect` (stations, building plots), and `provider` functions (the RoadSet answers "is a road here" without copying it). Each claim has an owner (`rail:12`, `station:5`, `plot:<seed>:<k>`, `zone`) and a kind.
- **Rank**: `station 5 > landmark 4 > rail 3 > road 2 > building 1 > scenery 0`. A claim blocks the thing being placed when its rank is the same or higher, so a building is blocked by everything, a tree by everything, a road is not blocked by a building.
- **Ask**: `point(x, z, margin, { as, ignore, layer })`, `rect(cx, cz, hx, hz, yaw, margin, ...)`; `ignore` lets a thing ask without hearing about itself; `layer` keeps a flyover and the road under it apart (the overpass layers of PR 49).
- **Who registers**: `terrain.addZone` (landmarks), `rail_view.js` via `registerRail` (every rail edge with its track count, every station), `main.js` `roadProvider` (every road in the RoadSet), `district.js` (each built piece's plots, removed when the piece is dropped).
- **Who asks**: `district_plan.js` (whole plot as a rectangle, furniture and signals as points, and the plots of its own piece), `scatter.js` (trees, bushes, rocks; tiles are re-planted when a new claim lands on them), `rail_view.js` (a station skips a building that would stand on a road or another building).
- Not yet asking: `landmarks.js` (its sights still check only their own zone; Phase 4 will register the pack's landmarks as claims first), props, pedestrians' spawn points.
- Cost: a 64 m cell hash, no allocation per query; about 1,600 claims in India world (all rails) plus the plots of the pieces around you. Measure on a phone in Phase 2.
- The same registry is what a city pack loads into (section 5): the pack's streets, rails, footprints and landmarks register as claims, so anything procedural that is still allowed inside an enclave (trees, street furniture, filler buildings) keeps off the real geometry.

## 3. Architecture decision: 1:1 city enclaves entered from the highway (recommended)

**The problem.** The India world is 1:100 (1 game metre = 100 real metres, `GAME_SCALE`): Delhi to Mumbai is about 14 game km and Delhi itself is a few hundred game metres across. A real street is 7 to 25 real metres wide, i.e. 0.07 to 0.25 game metres. Real streets, blocks and building footprints cannot exist at that scale. (Today's cities cheat: the highway's *length* is compressed but its *width* and the buildings beside it are 1:1, so a "city" is one highway with a strip of 1:1 buildings.)

**Options.**
| Option | For | Against |
|---|---|---|
| A. A bigger scale for the whole map (for example 1:10) | One world, no transitions | Delhi to Mumbai becomes about 140 km, over an hour at highway speed; the owner decided "compressed like GTA" (INDIA_MAP_PLAN section 9); far more terrain, rail and road data in memory; a country at 1:10 is unbuildable |
| B. Warp the scale near cities (variable scale) | One world | Roads and rails bend where the scale changes, speed and distance lie, physics and GPS distances become messy, no one has done it well |
| **C. City enclaves at 1:1, entered from the highway** | Real streets, blocks and footprints; each city loaded only while you are in it; the compressed highways and Travel stay as they are; one data format per city; heavy data never competes with the open country | A transition at each city edge; a second kind of space to keep consistent with the India graph |

**Recommendation: C.** It is what the Phase 0 audit points to, it keeps every existing decision (compressed highways, rail and Travel), and the same registry, road, rail and district components run in an enclave at real size. The rest of this document assumes C.

**What an enclave is.** A separate world space: metres 1:1, its own origin (the city centre), its own street graph, its own streaming grid of 1 km tiles. The India world keeps a *node* for the city (as now); the node holds the pack id. Inside the enclave the India world is not simulated (its roads, rails and trains are not loaded; the city's own metro and rail come from the pack).

**Entering (like a bypass or exit in the real world).** The highway already has a gate board over the road before each city (`highway.js` `gates`, `along` metres). Approaching: at 2 game km before the gate the pack's manifest and the first tiles are prefetched (asset cache, pinned). At the gate the car is carried into the enclave by a short transition (a 0.5 s fade with a dust or rain cloud, the same machinery as `world:rebuilt`; no freezing frame) and placed on the pack's gate road with the same lane, heading and speed. The pack lists its `gates`: id, the India highway it joins (`NH19`), bearing, and the street that continues it; the mapping gate to India highway is by that id, so every highway through the city has a way in and out. Cities with several highways get several gates; the player enters at the gate of the highway they were on.
**Leaving.** Driving out through a gate street (or choosing Travel) returns to the India world at the city node on that highway, heading outward, with the same transition. Walking, boarding a train or a plane, or Travel to another city also leave the enclave; the enclave is unloaded behind you after 20 s (kept for a quick return) and its asset references released (N8 sectors and `core/assets.js` already do this for sectors).
**First visit and saved games.** A save stores the world (India or city id), the position in that world's metres and the heading; `saved.js` gets a `city` field (format bump, loader tolerant).

**Travel, GPS, autodrive, traffic.**
- **Travel** stays at city level (the 86 stations, the road graph): fast travel to a city lands at one of the pack's `spawns` (centre, main station, airport, a landmark), not on the highway. Inside a city Travel adds the pack's POIs as destinations (Phase 2/4).
- **GPS and minimap**: in the enclave the map is the pack's street graph (class, name, one-ways); on the highway it is the India map as now. A route across cities is two parts: the India route to the destination city's gate, then a local A* over the pack graph (lane-level costs: one-ways, signals, class speed). Enclaves are never linked to each other except through the India world.
- **Autodrive** follows a route (an ordered list of street edges), using the existing controllers; the pack's streets are served to it by a "fixed road" object that has the `Road` interface (`at`, `nearest`, `style`, `bridgeW`, lifts) but is built from the pack's polylines, not routed procedurally. Designing that object is the first task of Phase 2; the requirement is that traffic, autodrive, the navigation graph and the road mesh all keep working unchanged.
- **Traffic and people**: spawn on the real graph with densities from `identity.json` by street class, landuse and hour; signals only at tagged junctions; the India-world traffic (trucks on highways) is unchanged outside.
- **Rail inside the city**: the India trunk line ends at a city node. The enclave has its own rail and metro geometry from the pack (`transit.json`), joined to the India line at a rail gate; trains cross the transition on the same timetable (the timetable already runs by edge in `rail_timetable.js`).
- **Hours of day, weather, season** are global and keep running across the transition; the identity file only changes what they look like in the city (Phase 3).

**Why not simply put 1:1 streets next to the highway as today?** Because that is the current mess in another form: a strip. A city is a graph with blocks; an enclave is the only way to have one without making the country 100 times bigger.

## 4. Performance budget (proposed; none of it measured in a city yet)

Basis: `PERFORMANCE.md` (medium tier today: 520 draw calls, 428k triangles, 5.6 ms capped on an Apple-silicon desktop; the car alone is 68k triangles and 41 draw calls). The phone gate in the plan is two phones holding 30 fps on low and medium; **no phone has been measured yet, so the phone column is a design target, not a fact.**

| | Desktop (medium/high) | Phone (low) |
|---|---|---|
| Frame | 60 fps (16.6 ms), CPU main thread under 8 ms | 30 fps steady (33 ms), main thread under 18 ms |
| Draw calls in a city view | at most 900 | at most 300 |
| Triangles | at most 1.5 M | at most 350 k |
| Detailed (near) radius | 600 m of extruded buildings, textured | 250 m |
| Far radius | 2.5 km merged blocks and a skyline impostor | 900 m, coarser |
| Buildings with their own mesh in the near ring | up to 1,500 | up to 400 (the rest instanced boxes) |
| Moving things | 60 cars, 120 pedestrians | 20 cars, 30 pedestrians |
| Memory (JS heap + GPU estimate) | at most 500 MB | at most 200 MB |
| Pack size on disk (gzip) | at most 30 MB per city pack, 20 MB each for Delhi NCR's three | same pack, streamed: at most 4 MB resident |
| Time from the gate to driving | under 4 s on a 20 Mbit line (manifest, identity, first 9 tiles prefetched) | under 8 s on 10 Mbit |

How: geometry merged per 128 m cell (one draw call per material per cell, as `district.js` does per 200 m piece), instancing for repeated furniture, facade textures from a small atlas by building use, tiles of 1 km streamed by the existing sector scheme (hysteresis, abort, pins, LRU), far cells baked at pack build time. Measure with `?bench=30` on a desktop and on a phone before Phase 2 is called done; update these numbers from the measurement, not the other way round.

## 5. The versioned city pack format

A pack is a folder (shipped as is, served with gzip) built **offline** by `tools/build_city.*` (Phase 1) from an OSM extract; nothing is fetched at run time. Deterministic: the same extract and tool version give the same bytes. `format` is an integer; a loader refuses a pack with a higher number than it knows and reads older ones through a migration table.

```
assets/cities/<id>/                 e.g. assets/cities/delhi/
  manifest.json      identity of the pack and everything needed to load it without opening a tile
  identity.json      the look of the city (section 6)
  graph.json         the street graph for routing: no geometry
  tiles/<tx>_<tz>.json   geometry per 1 km tile (streets, blocks, buildings, landuse, water, pois)
  landmarks.json     curated landmarks with models and info cards (Phase 4)
  transit.json       metro, rail, stations, bus terminals, airport (Phase 5)
  ATTRIBUTION.txt   data credits and licences, shown on the credits screen
```

### Coordinates
Local metres: `x` east, `z` south (like the game: `toGame` has `z = -latitude`), `y` up; origin = `manifest.origin` (lat, lon), equirectangular about that latitude (error well under 0.1 % over 50 km). Tile `(tx, tz) = (floor(x / 1000), floor(z / 1000))`. Heights: terrain stays the game's terrain (real DEM); the pack carries `levels` and `height` of buildings, `layer` of roads, no ground heights. All numbers rounded to 0.1 m.

### manifest.json
```json
{ "format": 1, "id": "delhi", "name": { "en": "Delhi", "hi": "दिल्ली" }, "cityId": "delhi",
  "origin": { "lat": 28.6139, "lon": 77.2090 }, "bbox": [x0, z0, x1, z1], "drive": "left",
  "tileSize": 1000, "tiles": [ { "tx": 0, "tz": 0, "bytes": 123456, "buildings": 1840 } ],
  "gates": [ { "id": "nh19-north", "india": "NH19", "x": 0, "z": 0, "bearing": 0.0, "street": "e123", "lanes": 3 } ],
  "rail_gates": [ { "id": "ndls-agra", "edgeId": 12, "x": 0, "z": 0, "bearing": 0.0 } ],
  "spawns": [ { "id": "centre", "name": "Connaught Place", "x": 0, "z": 0, "yaw": 0 } ],
  "extract": { "source": "OpenStreetMap via Geofabrik north-zone extract", "date": "YYYY-MM-DD", "url": "...", "sha256": "..." },
  "licence": "ODbL 1.0", "builder": { "tool": "tools/build_city.mjs", "version": "1.0.0", "commit": "..." },
  "counts": { "edges": 0, "nodes": 0, "buildings": 0, "pois": 0, "bytes": 0 } }
```

### graph.json (routing, always loaded)
`nodes`: `[id, x, z, flags]` (flags: 1 signal, 2 crossing, 4 gate, 8 roundabout). `edges`: `[id, a, b, class, lanes, oneway, speedKmh, lengthM, layer, flags, nameIndex]` with `class` in `motorway, trunk, primary, secondary, tertiary, residential, service, footway, cycleway, busway`; `oneway` 0, 1 (a to b), -1; `layer` -1 tunnel, 0 ground, 1.. bridge or flyover (matches the overpass layers); `flags` bridge, tunnel, toll, turn restrictions in a separate `restrictions` list. `names`: `{ en, hi, ref }` indexed. Size target: a few hundred KB gzip for Delhi.

### tiles/<tx>_<tz>.json (streamed)
- `streets`: `{ id (edge id), pts [x, z, ...] (clipped to the tile, `clip` flags when continued), width (carriageway m), sidewalk (0/1/2 sides), markings, surface }`
- `blocks`: `{ id, ring [x, z, ...], holes [[...]], landuse }`: the polygons bounded by streets (built by the tool from the street graph and landuse)
- `buildings`: `{ id, ring [x, z, ...] (counter-clockwise, closed implicitly), levels, height (m or null), minHeight, use (residential, commercial, office, retail, civic, religious, industrial, hotel, transit, other), roof (flat, gabled, dome...), name, osm, src (osm, overture, openbuildings), hsrc (tag, levels, guess), landmark (id or null) }`
- `landuse`, `parks`, `water`: polygons with a class (residential, commercial, industrial, park, garden, forest, farmland, water, river...)
- `pois`: `{ id, class, name {en, hi}, x, z, importance 0..5, osm, wikidata }`
- `furniture`: optional real points (traffic signals, bus stops, metro entrances) from tags
Heights: from `height` or `building:levels` x 3.2 m, else a guess from landuse and neighbours, and `hsrc` says which; the build tool reports how many are guesses.

### landmarks.json
Curated list (from OSM and Wikidata): `{ id, wikidata, name, x, z, yaw, footprint, height, model: "procedural:india-gate" | "cc0:<file>", look: "<identity key>", card: { text, built (year), source }, importance, collision }`. Real-name landmarks are our own procedural or CC0 models (CITY_PLAN rules).

### transit.json
Written by `tools/build_delhi_transit.mjs`, checked by `tools/validate_transit.mjs` (self-test). Built from OSM, Wikipedia and Wikidata; Delhi's is `assets/cities/delhi/transit.json` (444 KB, 125 KB gzipped); the numbers, sources and gaps are in `docs/DELHI_TRANSIT.md`. **Format 1** (versioned: a loader refuses a higher number; `builder.version` must equal `TRANSIT_BUILDER_VERSION` in `tools/lib_transit.mjs`). Coordinates are the pack frame of section 1 (`frame` carries the constants). The packs of the street builder and of transit use the same `project()`.
```json
{ "format": 1, "kind": "transit", "id": "delhi", "builder": { "name": "build_delhi_transit", "version": 1 }, "origin": { "lat": 28.6139, "lon": 77.209 },
  "frame": { "earthRadiusM": 6371008.8, "x": "...", "z": "..." },
  "sources": [ { "id": "osm", "licence": "ODbL 1.0", "credit": "(c) OpenStreetMap contributors", "use": "..." } ],
  "metro": {
    "lines": [ { "id": "yellow", "mode": "metro", "ref": "2", "name": { "en": "Yellow Line", "hi": "..." }, "colour": "#FFDF00", "operator": "DMRC", "network": "Delhi Metro",
        "track": { "gauge": "1676", "osmGauge": "1676", "electrified": "contact_line", "voltage": "25000", "maxspeed": null },
        "routes": [ { "id": "yellow-1", "from": "Samaypur Badli", "to": "Millennium City Centre", "osmRelation": 447210, "km": 47.68,
            "path": [ x, z, x, z, "..." ],
            "grades": [ [ 0, "e" ], [ 112, "u" ] ],
            "stops": [ [ "SB", 0 ], [ "HN", 1388.2 ] ] } ],
        "stations": [ "ids in service order" ] } ],
    "stations": [ { "id": "KG", "name": { "en": "Kashmere Gate", "hi": "..." }, "nameNow": "only when Wikipedia's current name differs", "code": "KG", "x": 1859.7, "z": -6090.5,
        "lines": [ "red", "violet", "yellow" ],
        "per": [ { "line": "violet", "grade": "underground", "layout": "island", "opened": "28 May 2017", "osmGrade": "underground", "railDist": 2.7 } ],
        "entrances": [ [ x, z ] ], "interchange": true, "osm": "n11174317216", "wikidata": "Q4207344", "hiSrc": "osm" } ],
    "depots": [ { "id": "depot-shastri-park", "name": { "en": "Shastri Park depot", "hi": null }, "x": 0, "z": 0, "nearestLine": "red", "railDist": 19.1, "osm": "w80429917" } ],
    "transfers": [ [ "idA", "idB", metres_on_foot ] ] },
  "rail": { "stations": [ { "id": "NDLS", "name": { "en": "New Delhi", "hi": "..." }, "x": 0, "z": 0, "class": "terminal+through",
        "platforms": { "osmFaces": [ "1", "2", "..." ], "osmCount": 16, "wikipedia": 16, "tracksWikipedia": 20 }, "axis": 1.369,
        "bodies": [ { "faces": [ "2", "3" ], "type": "island", "x": 0, "z": 0, "len": 592, "w": 22, "osm": "w123" } ],
        "entrances": [ [ x, z ] ], "buildings": [ { "kind": "train_station", "name": "...", "ring": [ x, z, "..." ] } ], "footbridges": [ { "kind": "bridge", "path": [ x, z, "..." ] } ],
        "metro": [ "NDI", "NDLS" ], "opened": "...", "note": "...", "src": "..." } ] },
  "bus": { "operators": { "dtc": {}, "cluster": {} }, "stops": [ [ x, z, "name" ] ], "routes": [ { "ref": "740", "op": "dtc | cluster | haryana | noida | unknown", "from": "...", "to": "...", "osm": 1, "km": 21.4, "stops": [ index into stops ] } ],
           "places": [ { "kind": "isbt | depot | terminal", "name": "...", "x": 0, "z": 0, "operator": "dtc", "osm": "w1" } ] } }
```
Rules the data keeps (validated): every `path` is an ordered polyline of one direction with no jump, simplified to 1.5 m; `grades` runs are `[firstPointIndex, "u" | "e" | "g"]` (underground, elevated, ground) and start at 0; `stops[i][1]` is the distance in metres along the path; every station lies within 160 m of the track of each line it names; two directions of one line section are two routes (`yellow-1`, `yellow-2`); ids are unique inside `metro.stations` and inside `rail.stations` (the lists are separate: `NDLS` is a metro id and a railway code). A route's `stops` for buses are indices into `bus.stops` and the polyline is the stop chain (no road geometry; snap to the street graph). Heights are not stored: a viaduct is the terrain height plus a deck height chosen by the renderer.
Not yet in the format: timetables and frequencies (the Delhi GTFS was not taken, see `DELHI_TRANSIT.md` section 1), platform heights, underground box dimensions, rail track layout inside stations, `terminals` for airports.

### 5a. As built by `tools/build_city.mjs` 1.0.0 (Delhi pack, format 1): where it differs from the proposal above
The proposal said "start with JSON, change `format` if the size budget fails". The size budget bit (the first Delhi build was 28.6 MB gzip against 20 MB), so the files keep JSON but are written compactly. Everything below is in `manifest.json` (`encoding`, `defaults`, `cuts`) and implemented in `tools/lib/packio.mjs`, which a loader copies or imports.
- **`enc: 1` coordinates.** Every coordinate list (`pts`, `ring`, `holes` in tiles; node positions in the graph) is integers in **decimetres, delta coded**: `[x0, z0, dx1, dz1, ...]`, the first pair measured from the tile origin (`tx * 1000`, `tz * 1000`) in tiles and from the pack origin in the graph. `dec(list, ox, oz)` gives metres. About 20 % smaller gzip and exact at 0.1 m. `pois` and `furniture` keep absolute metres `x`, `z`.
- **`graph.json` is columnar** (about half the size of arrays of arrays): `{ format, enc, classes, nodes: { xz, flags }, edges: { a, d, cls, lanes, oneway, speed, len, layer, flags, name }, names, restrictions }` where `a` is delta coded against the previous edge, `d = b - a`, `cls` indexes `classes`, `len` is decimetres. `decodeGraph` returns the `[id, a, b, class, lanes, oneway, speedKmh, lengthM, layer, flags, nameIndex]` rows of section 5. Node ids are the row numbers. Edge flags: 1 bridge, 2 tunnel, 4 toll, 8 flyover (a bridge not over water). Node flags: 1 signal, 2 crossing, 4 gate, 8 roundabout.
- **Defaults are omitted from tiles.** A building has `id, ring, levels, height, use, osm` and only when not default: `roof` (default flat), `hsrc` (default `guess`; otherwise `tag` or `levels`), `holes`, `minHeight`, `name`, `landmark`; `src` is always `osm` and left out; `osm` is a number for a way and `"r123"` for a relation. A street piece has `id` (the graph edge), `pts` and only when different `width`, `sidewalk`, `markings`, `surface`, plus `clip` (bit 1 continues from the previous tile, bit 2 into the next). Width default `lanes x laneWidth[class]`, sidewalk default by class (tables in the manifest); `cls` and `layer` come from the graph edge.
- **Tiles hold each object once.** Streets are cut at tile edges; buildings and blocks go to the tile of their centroid; landuse, parks and water polygons are clipped to each tile they touch (Sutherland-Hodgman: a concave polygon may have an edge along the tile edge, which is fine for filling). Empty tiles are not written.
- **Blocks** are the faces of the street graph (motorway to residential, ground level, no tunnels; service roads and footpaths do not cut them), dead ends pruned, 800 m2 and above, rings simplified to 3 m; no holes. `landuse` is the class of the landuse polygon under the centroid, else `urban`.
- **Gates** are the motorway, trunk and primary edges that cross the boundary of the NCT (OSM relation 1942586); carriageways of one road within 250 m are merged; `x, z` is the first node inside, `bearing` points inward in **radians clockwise from north**, `india` is the `NH` number when the road has one, `street` is the graph edge. 25 gates in Delhi (NH44 north and south, NH48, NH9, NH24, NH709B, NH148, ...). `rail_gates` is empty until D2.
- **Spawns** are snapped to the nearest street; `yaw` has the same bearing convention. Landmarks add `lines` for street landmarks (Kartavya Path, Chandni Chowk), `src` (`osm` or `list`), `osm`, `yaw` (long axis), `hours`, `heightSrc`, `type`.
- **Heights.** Only 1,068 of 244,405 Delhi footprints have an OSM `height` and 7,342 a `building:levels`; the other 236,306 (97 %) are guessed from use and footprint size (`hsrc` absent). The renderer must treat them as a style, not as data. Polygon ring order: counter-clockwise by the shoelace formula in (x, z).
- **What the build cuts** (also in `manifest.cuts`): footprints under 10 m2 (165), 5,135 footprints that lie mostly on a street (mismapped over a road; the corridor of a lane is capped at 1.8 m each side because lane widths are guesses), 311 duplicate or overlapping footprints (the smaller one goes), 46,980 that touch a street corridor are kept; no `building:part`, no rails and metro, no bus routes. Streets are simplified to 0.7 m, buildings to 0.8 m.
- **Sizes (Delhi):** 77.5 MB raw, 19.8 MB gzip (tiles 16.5, graph 3.2, landmarks 0.03); the biggest tile 361 KB, the most buildings in a tile 3,060. Validator budgets: pack 20 MB gzip, tile 4 MB, graph 3.5 MB (the proposal's "a few hundred KB" for the graph is not reachable: Delhi's OSM has 406k edges, mostly residential lanes).
- **Validate and check:** `node tools/validate_city.mjs assets/cities/delhi` (add `--quick` to sample tiles), `node tools/check_city.mjs` (loads the pack, routes between spawns), `node tools/selftest.mjs` (pack is current and valid, graph routes).
- **Rebuild:** `node tools/build_city.mjs delhi --extract data/raw/delhi/northern-zone-261116.osm.pbf --date 2026-11-16`, then `node tools/build_landmarks_doc.mjs`. Same inputs give the same `packHash`.

## 5b. How maps work: the India world versus a city (built 17 Nov 2026, WORK_REMAINING 12.6)

| | India world (`ui/gps.js`) | A city (`ui/citymap.js`, `world/city/citynav.js`) |
|---|---|---|
| Scale | 1 game metre = 100 real metres | 1:1, the pack's metres (x east, z south) |
| Data | the skeleton: highways between cities, rails | the pack graph (`graph.json`, 406,000 edges in Delhi), loaded once, plus `landmarks.json`; the Metro lines from `transit.json` when it loads |
| Mini-map | round, heading up, 2.2 km radius, roads by kind, your route, city dots | round, heading up, 650 m radius, streets by class (motorway to residential), the route line from the car on, landmark pins (gold for importance 4 and 5), Metro lines in their own colours |
| Full map (P) | all of India, tap a city | the city, pan by drag, zoom by wheel or pinch, search a landmark or gate by name, tap a pin or any street to navigate; Metro lines and stations when zoomed in |
| Route | city to city over the highway skeleton (`RoadNetwork.route`) | A* on the pack graph (`CityRouter`, drive mode: one-ways, no footways, cycleways, busways or service lanes; residential streets cost 1.7 times, a U-turn at a node 150 s, a signal 8 s); a route starts and ends on the street where you are and where the pin is (`plan()`), not at the nearest crossing |
| In the HUD | next city and the exit to take | a banner under the top bar: "In 120 m: Turn left onto Janpath", then street, km and minutes left |
| Autodrive | follows `road.at(s)` of the India road | follows a `PathRoad` (the route as a polyline with rounded corners, so it quacks like a road), forward only, keeps 1.5 m to the left, caps at 50 km/h (sport 80), stops at the destination; a car stuck for 3 s bans that street and plans anew |
| Hand-over | entering a city: the page reloads into `?city=delhi`; the India `Gps` is never built there, so there is one map at a time. Leaving through a gate reloads the India world, where the India `Gps` is built again and the city's map is gone | |

The street names come from the graph's name table (`names[edge.name]`); unnamed streets are "the next road". The router walks the graph, the polyline walks the loaded tiles' street geometry (`CityWorld.edgeGeom`), so a route is drawn on the real curves as soon as the tiles are in (the route is rebuilt when a tile loads).

## 6. identity.json (what makes the city this city; used by every system, Phase 3)
```json
{ "format": 1, "palette": { "areas": [ { "landuse": "residential", "zone": "lutyens", "walls": ["#e3d3b0", ...], "roofs": [...] } ], "default": [...] },
  "sky": { "haze": 0.2, "months": [ { "m": 1, "tempC": [8, 19], "rainMm": 20, "fog": 0.6, "dust": 0.1, "smog": 0.7 } ] },
  "vegetation": { "species": [ { "id": "neem", "weight": 3, "landuse": ["residential", "park", "road"] } ], "street_tree": ["neem", "peepal"], "density": { "park": 1.0, "road": 0.4 } },
  "signage": { "languages": ["en", "hi", "ur", "pa"], "styles": ["metro", "nh", "shop"], "metro_colour": "#e4002b" },
  "traffic": { "mix": [ { "kind": "two_wheeler", "share": 0.38 }, ... ], "byHour": [ ... ], "horns": 0.8, "driving": "left" },
  "people": { "clothing": { "winter": [...], "summer": [...] }, "density": { "market": 1.0, "residential": 0.3 }, "byHour": [ ... ] },
  "sound": { "ambient": [ "traffic", "azaan", "koel" ], "horn": "india" },
  "look": { "facade_kits": { "office": "glass-tower", "residential": "block-balcony" } } }
```
Every value is data with a source note in `ATTRIBUTION.txt` or a `src` field; no value is invented silently (a guess is marked `"guess": true`).

## 7. Validation (Phase 1 tool and self-test)
- Schema: `format`, required fields, types, ids unique, all references resolve (edge nodes, gates to streets, spawns inside the bbox).
- Geometry: all points inside the bbox, rings closed, not self-intersecting, area above 4 m2, streets longer than 1 m, no zero-width, tiles cover every object exactly once.
- Overlaps (uses the registry): no building footprint overlaps a street or a rail corridor beyond tolerance, no two footprints overlap beyond tolerance; the tool lists the count of conflicts removed (real data has them) and fails above a threshold.
- Counts and sizes against the budget in section 4; determinism (build twice, compare hashes); `ATTRIBUTION.txt` present and the manifest's `extract.sha256` matches the file used.
- A self-test in `tools/selftest.mjs` loads the shipped pack, checks it is current (builder version, hashes) and loads each tile into a `KeepOut`.

## 8. What is decided, what is not
Decided (by this proposal, waiting for the owner): enclaves at 1:1 entered from highway gates; the registry as the one place ground is claimed; pack as a folder of JSON in 1 km tiles with the manifest, graph, identity, landmarks and transit files; local metre coordinates; budgets as a starting point.
Owner rules that bind the pack: landmarks and areas are complete for the city, not a short list (`landmarks.json` and `pois` carry every significant place, with `importance`); brand and shop names are invented look-alikes, never real names or logos (`identity.json` signage and the building `name` shown in game use look-alike names; real OSM names may stay in the data only for places and landmarks, not brands).
Not decided: JSON or a binary tile format (start with JSON, change `format` if the size budget fails); the "fixed road" object (Phase 2); how the metro, walking and aircraft leave the enclave (Phase 5); whether the enclave's terrain uses the same DEM at higher resolution (Phase 2); the OSM extract and the download (Phase 1, needs the owner's yes: file, source, size).

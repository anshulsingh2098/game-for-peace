# Navigation graph (N10)

Code: `src/world/navgraph.js` (graph and road builder), `src/debug/navdebug.js` (the `?nav` view), wiring in `src/main.js`. Tests: four checks in `tools/selftest.mjs` (51 in all). The road API (`road.at`, `bridgeW`, `tunnelW`, ...) is only read, never changed.

## Model
`NavGraph` is a generic directed graph: nodes (`id`, `x`, `y`, `z`, `kind`, plus attributes), edges (`id`, `a`, `b`, `kind`, length and attributes), a spatial hash for the nearest node, a bounded A* with a cache, route validation and recovery.
`RoadNav` fills it from the generated road, one chunk per world sector (`sectors.js`, 512 m), with a node every 25 m (`STEP`; the id is `kind:index:key` where the index is `round(s / 25)`, so ids never depend on how the road was chunked):

| Node kind | Meaning |
|---|---|
| `d` | a lane node: one per lane per direction, at that lane's centre offset (right or left of the centre line as the region's `drive` says) |
| `w` | a pedestrian node: one per side of the road; outside the carriageway, on a bridge inside the rail, in a tunnel on the raised walkway |

| Edge kind | Meaning |
|---|---|
| `drive` | along a lane in its direction of travel; attributes: `cls` (road class), `speed` target, `width`, `surface`, `grade`, `curv`, `carried` (`bridge`, `tunnel` or none) |
| `lane` | to the next node of the neighbouring lane going the same way (a lane change) |
| `walk` | along a sidewalk, both ways |
| `cross` | a crossing from one sidewalk to the other, only at crossing nodes: every 150 m on a straight, uncarried stretch; signalled (`signal` id) on boulevards and highways, and the drive nodes just before it carry `stopFor` (the stop line) |

Pedestrians never route on the carriageway: walk routes use only `walk` and `cross` edges, vehicles only `drive` and `lane` edges (tested). Junctions, roundabouts and flyovers are supported by the data model (an edge `level`, nodes with more than two edges) and tested on synthetic graphs; the generated road has none yet, side streets arrive with N11.

## Query contract (for traffic and pedestrian systems)
`nearestNode(x, z, mode, maxDist)`, `route(from, to, { mode: 'drive' | 'walk', maxNodes })` returning `{ ok, nodes, edges, length, version }` or `{ ok: false, reason }` (`'no path'`, `'search limit reached'`, `'no such node'`), `validateRoute(route)`, `recoverRoute(route, x, z)`, `outEdges(id)`, `node(id)`; `RoadNav.signals`, `summary()`. Search expands at most `maxNodes` nodes (default 600); results and failures are cached until the graph changes (a cached query expands nothing: tested). Nothing scans the whole graph per frame: the nearest-node query looks only at the cells around the point.

## Streaming and recovery
`loadSector(sx, sz)` builds the nodes of the road inside that sector and the edges to any loaded neighbour; either loading order gives the same graph (tested with shuffled orders). `unloadSector` removes the nodes and every edge touching them in one pass; routes through it fail `validateRoute`, `recoverRoute` plans again from the node nearest the agent to the old destination (it fails with a clear reason while the gap is unloaded and succeeds once the sector is back: tested). In the game the sector manager calls `loadSector` and `unloadSector`, and `world:rebuilt` drops the graph.

## Debug view
`?nav` draws lanes (blue and orange by direction), lane changes (purple), sidewalks (green), crossings (yellow, red when signalled) and stop-line posts; `?debug` adds a `navigation` line (chunks, nodes, edges by kind, signals, routes and cache hits).

## Measured
Mumbai, medium tier: 19 chunks, 744 nodes, 492 drive and 492 lane edges, 492 walk and 40 crossing edges, 20 signals after loading the sectors around a drive; no errors. The graph is a few hundred small objects; the render cost of the `?nav` view is for development only.

## Not done on purpose
- Junctions and side streets (N11). Roundabouts and flyovers exist only in tests.
- Turn restrictions, lane widths per lane and signal timing: the data hooks (`signal`, `stopFor`) are there, the controller arrives with N12.
- Routes for off-road agents and interiors.

# Gap list toward GTA 5 quality (from frames looked at, 21 Nov 2026)

Each line is something seen in a game frame (day, dusk or night, desktop, `?play&city=delhi`), not a guess from code. Ranked by how much it changes the picture for the cost. "Cost" is an estimate of work, not measured. Honest limit: GTA 5 is a console game with thousands of hand-made assets; a browser at phone budgets reaches "GTA San Andreas to IV composition and lighting" (`docs/CP_MATCH_PLAN.md`), and that is the goal used here.

| # | Seen | Why it looks below GTA 5 | Fix (idea) | Cost |
|---|---|---|---|---|
| 1 | CP junction by day: the road, walls and pavements receive no shadow from the buildings; only the car has one | Flat lighting; GTA has long hard sun shadows and soft sky occlusion | A cascaded or fitted shadow map for the sun on the near tiles; baked AO in vertex colours under cornices, arcades and trees | high (cost on phones to measure) |
| 2 | Hedges are plain bright green boxes with sharp edges (CP walk, junction) | GTA hedges have leaf texture, rounded tops, tonal variation | Leaf texture and a bevelled top on the hedge box; vertex colour noise | low |
| 3 | Trees are round blobs on cards; palms show a tall bare trunk from close | Real canopy has clumps, light gaps and branches | More card variants per species, a lower crown for palms, a shadow blob and a few branch cards | medium |
| 4 | Facades are flat clean stucco, same cream everywhere; no staining under cornices, no AC units, no wires on the fronts, no signs besides the board band | Real CP and every GTA building carry wear, clutter and depth | Dirt gradient and rain streaks in the facade texture; AC boxes, pipes, tiny balconies as instanced props | medium |
| 5 | Cars and people in the distance are boxes (white and black blocks on the Lutyens road) | GTA vehicles have wheels, glass, lights at every distance | A second, lower-detail model with wheels and windows for far traffic; walking cycle for far people | medium |
| 6 | Few vehicles and people in view at a major CP junction | GTA streets are busy | Raise CP traffic density and add parked cars along the circle (the identity has a density per area) | low |
| 7 | Sky is flat grey-white by day, no cloud shapes, no sun glare | GTA skies carry clouds, haze and a bright sun disc | Cloud layer, sun disc and bloom on bright pixels | medium |
| 8 | Road surface by day is uniform, with crisp markings; no reflections on the car paint | GTA has specular road sheen and car reflections | Env-map reflection on car paint, a soft sheen on asphalt at low sun | medium |
| 9 | Kartavya Path: one carriageway, a double yellow line and red and yellow kerb paint; no canals | Real avenue has two carriageways, lawns, water channels, red sandstone | Build the canals and the paths if the owner wants them (OPEN_ITEMS 19) | medium |
| 10 | Wires were hair-thin beyond 30 m | Thin geometry shimmers | Thickened to 2.4 times (this commit) | done |
| 11 | Post-processing: no ambient occlusion, no colour grade, no exposure change between arcade and street | GTA frames are graded and exposed | Grade and a mild vignette; screen-space AO only on high tier | medium |
| 12 | Only the sun casts; lamp pools are flat decals, not lighting | Real lamps light cars and walls | Keep decals on phones; on high tier add a few real point lights near the car | medium |

## Errors found while looking (not visual style)
- `onTeleport(x, z, yaw)` does not seem to apply the yaw (OPEN_ITEMS 11).
- The page logs many 404 and "script fetch" errors in the console in a normal run (not traced to a file).
- JS heap ended a night run at 1130 MB on this branch against 600 MB on main (one sample each; not understood).
- The first game camera cannot look up from the road, so wires, caps and sky details are hard to inspect; a debug camera would help (the second-camera trick used on 21 Nov is only in the page console).

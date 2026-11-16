# Mumbai district vertical slice (N11): what is built and what is not

Code: `src/world/district_plan.js` (layout, pure, tested), `src/world/district.js` (meshes), switched on by the region's `district` data (`regions.js`, Mumbai only), wired through `road.js`, `main.js`. Tests: two checks in `tools/selftest.mjs` (53 in all).

## Built (first increment)
Along the Mumbai boulevard, on both sides wherever the land is level and dry: modular buildings with a shop front (window, awning, sign board), 3 to 7 floors of windows, cornices, string courses, balconies, rooftop water tanks, colonial and art-deco facade variants in region palettes; raised sidewalks with kerbs; zebra crossings and signal poles at the navigation graph's crossings (same places: the plan only paints crossings `crossingAt` accepts); lamp posts every 36 m, bus shelters, and market stalls along the frontage. Windows light up at night. The car cannot drive through the building fronts (obstacle circles through the `world.near` contract; checked by driving the truck at a front: it stops). No buildings on bridges, in tunnels, in water, inside a landmark zone (Gateway of India, Taj hotel, Marine Drive strip) or on a sharp bend; none in the mountain locations (tested).
Geometry is original and procedural: no external assets, so the licence manifest for this slice is empty (`assets/ASSETS.md` has a row saying so). One merged mesh per material per 200 m piece (about a dozen draw calls per visible piece group); not measured on a phone.

## Not built yet (N11 asks for these; next increment)
- **A junction and a local street.** The router generates one road; side streets need either a router extension (a second graded road that joins the first) or a ground-hugging street mesh. The navigation graph and the plan already allow junction nodes. This is the main missing piece.
- **A promenade** beside the sea (the Marine Drive landmark strip is the nearest thing).
- **A designed 5 to 10 minute route** with a start, a goal and points of interest, and the **mobile performance and visual matrix** for the district (`VISUAL_MATRIX.md` row, a phone benchmark).
- Indian building character beyond palettes: balcony grilles, tiled roofs, hand-painted signs, overhead wires, Hindi and Marathi sign text, which need art decisions and assets (see `docs/ASSET_PLAN.md` when written).
- Pedestrians (N13) and two-wheelers and auto-rickshaws (N12); the data for both is in the region record but there are no models.

## How it behaves
`?loc=mumbai` shows it. A world rebuild drops and recreates it. The Mumbai region data moved to version 2 (the district data, and a 30 m clear strip for trees so they do not grow through the buildings); worlds made from older Mumbai share codes keep their old numbers.

## Crossing streets (N11 junction, 19 Nov 2026)
A region can list `junctions: [{ s, style, bearing, arm }]` (`world/regions.js`): streets that cross the main road at distance s, at `bearing` radians from its heading, `arm` metres each side, in a road style. `main.js buildRegionJunctions` builds each as a second road (`RoadSet`, the same machinery as the India side roads) with the region's district along it, its own traffic (`Traffic.addRoad`) and a `Junction` shared signal with an asphalt patch. Mumbai has a boulevard at 560 m and a two-lane street at 1,300 m. Checked in the browser: both streets draw with buildings, cars run on them and cross at the signal. Limits: buildings at the four corners of a crossing overlap the main road's own plots; no pedestrians, crossings or navigation graph on the cross streets; the sea side of the first street is water, so its road bends along the shore; nothing measured on a phone.

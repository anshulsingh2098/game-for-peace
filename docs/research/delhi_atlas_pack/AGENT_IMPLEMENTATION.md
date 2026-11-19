# Agent Execution Specification — Delhi Visual Fidelity

## Objective
Build recognisable Delhi using geospatially anchored roads/buildings, verified photographic viewpoints, modular Indian architectural kits, district-specific dressing, seasonal atmosphere, and measurable runtime budgets. Do not claim GTA V parity until tested; use it as a visual aspiration.

## A. Visual atlas acquisition
For every CSV target: (1) verify coordinate on OSM, (2) source 4 directional photos or legally captured originals, (3) record photographer, date, camera heading, coordinates, source URL, licence and allowed use, (4) classify facades/roads/signage/vegetation, (5) create a game camera waypoint, (6) capture game screenshot, (7) assess geometry/colour/recognition. A blank or unverified heading is NOT a known heading. Never copy Google Street View imagery into textures without an applicable licence. Prefer own surveys, freely licensed Commons imagery and provider-authorised Mapillary usage.

## B. Geospatial build
Use OSM/Geofabrik extracts with attribution and ODbL compliance review. Preserve original WGS84 lat/lon and source IDs; convert to a metric local projection (e.g. WGS84 / UTM zone 43N, EPSG:32643, subject to engineering validation). Use one documented game-space origin and metre scale. Separate real mapped features from synthetic infill. Road graph must preserve ramps, one-way restrictions, bridges and grade separation. Assign source confidence and update timestamps.

## C. Asset pipeline
For each registry row: source or model original mesh; preserve source URL, creator, licence, retrieval date and checksum. Import GLB/glTF, normalize metres/Y-up, validate normals/UVs/PBR, generate LOD0/1/2 and collision proxy, texture compression and instance grouping. Keep high-resolution source assets outside the shipping bundle. Treat assets from Poly Haven/ambientCG/Kenney as candidates, not downloaded deliverables. Do not assume Quaternius or Sketchfab assets have uniform licences.

## D. Delhi architecture grammar
- CP: concentric block geometry, arcades/columns, white weathered plaster, upper windows, curved shopfronts and accurate radial junctions.
- Shahjahanabad: narrow irregular plots, mixed historical masonry, balconies, shutters, tightly packed shop signs, overhead utilities where observed.
- Lutyens: sandstone institutional forms, setbacks, axial roads, gardens and mature canopy.
- South Delhi: individual facades, boundary walls, gates, balconies, AC units, rooftop water tanks.
- DDA colonies: repeated residential cores, external staircases, balcony grilles, parking, courtyards and parks.
- Dense mixed use: small plots, variable facade finishes, ground-floor retail, rooftop structures, narrow lanes.
- Industrial: sheds, shutters, yards, loading bays, workshop equipment, truck access.
Each archetype needs distribution controls, not random universal clutter. Avoid portraying all districts as uniformly dirty.

## E. Street and atmosphere systems
Separate road classes, lane/median geometry, surface wear, drainage, sidewalks, signage, lighting and street furniture. Vegetation selection by biome and planting records (Neem, Peepal, Jamun, Gulmohar, Amaltas, Arjun, kikar as context permits). Weather presets: clear winter, fog winter, dry summer, dust/haze, monsoon overcast/rain, post-rain, dusk/night. Realistic Hindi/English signs; invented brands unless rights cleared. Use spatial audio zones and density/behaviour schedules.

## F. Integration plan (no unapproved edits)
P0: Read-only baseline inventory, current main SHA, PR ownership, screenshots, frame-time metrics.
P1: Build reference/asset manifests and licence report, zero runtime changes.
P2: Produce standalone geospatial importer with deterministic fixture tests.
P3: Make one isolated sample block (CP) in separate test scene, no existing scene edits.
P4: Review Stream A CP work, then propose adapter interfaces instead of parallel renderers.
P5: Add streamed district asset layers only after ownership approval.
P6: Compare 10 matched camera viewpoints, fix geometry before decorative polish.
P7: Device testing and merge via PR; deployment remains operator-controlled.

## G. Acceptance gates
- Ten geotagged matched viewpoints with source permissions and dated images.
- Every shipped asset has manifest entry, licence and provenance.
- Road topology/landmark coordinates verified on a map; no invented geographic precision.
- No reload crossing streamed sectors; persistent traffic/player state tests.
- No regression to existing selftests/daily checks; new geospatial and asset validation tests.
- Desktop and real-phone 30-second benchmark, p50/p95/p99 frame times and memory trend; compare against unchanged baseline.
- Human blind recognition test with Delhi residents; collect errors by location.
- Do not merge without code-owner review; do not deploy without explicit authorisation.

## H. Source shortlist
OSM: https://www.openstreetmap.org/copyright
Geofabrik India: https://download.geofabrik.de/asia/india.html
Wikimedia Commons: https://commons.wikimedia.org/
Mapillary: https://www.mapillary.com/ (verify image-specific permissions)
Poly Haven: https://polyhaven.com/license (CC0 assets)
ambientCG: https://ambientcg.com/ (check asset licence)
Kenney: https://kenney.nl/assets (CC0 packs)
Delhi DDA: https://dda.gov.in/
DMRC: https://delhimetrorail.com/
Survey of India: https://surveyofindia.gov.in/

## Required agent report format
For every PR: baseline SHA; files changed; source/provenance; screenshot pairs; test outputs; performance deltas; known gaps; stream-owner approval; rollback plan. Never report work as complete based on a plan alone.

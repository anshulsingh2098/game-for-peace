# Photoreal plan: making the whole game look real

Decision (Rajul, 14 Nov 2026): the whole game goes photorealistic, as realistic as possible, using free assets first and Blender for what is missing. The earlier "match the flat stylised look" rule is replaced. The reference that started it is the real Atal Tunnel (Rohtang): stone-banded gate with a name board, warm-lit tiled tunnel, snowy valley, steel truss bridge.

## Engine: stay on three.js, upgrade it

Why not switch: terrain streaming, Rapier driving, roads, bridges and tunnels, the tuner and all menus are built on three.js. Babylon.js and PlayCanvas have no built-in open-world streaming either (a 2026 comparison lists all three as "bring your own"), so switching would cost a rewrite and gain no streaming. PlayCanvas is the usual pick for mobile performance, Babylon.js ships more built in but is bigger; neither is better at photorealism than a well-set-up three.js. Sources: [engine comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison).

What is missing today: the repo vendors **three.js r160** (Dec 2023). The realism stack (post-processing, ambient occlusion, cascaded shadows, KTX2/Draco/meshopt loaders) is not vendored. Step 1 is upgrading three.js and vendoring those addons. Already in place: ACES tone mapping, PCF-soft shadows (one map), a sky dome.

## The realism stack (what makes photos look like photos)

HDRI sky and lighting from real photos (PMREM), tone mapping tuned per time of day, cascaded sun shadows, ambient occlusion, bloom and mild grading ([lighting and PBR guide](https://slicker.me/three_js/lighting_pbr.htm), [post-processing order](https://discourse.threejs.org/t/post-processing-recommendation-for-pbr/33855)). Flat PBR alone looks flat without ambient occlusion ([forum report](https://discourse.threejs.org/t/feedback-on-realistic-lighting-and-performance/91097)).

## Assets: free first, then Blender

- Textures and HDRIs: [Poly Haven](https://polyhaven.com/license) and [ambientCG](https://ambientcg.com) are CC0. (The ambientCG road textures removed earlier can come back.)
- Models: Poly Haven CC0 scans where they exist; vehicles, trees and buildings that are missing get built in Blender. No Atal Tunnel model turned up in the search, so the tunnel, gate and bridge are Blender work from the reference photos.
- Keep a licence line per asset in `assets/ASSETS.md` (source, licence, author).
- Pack everything with gltf-transform: meshopt or Draco geometry, KTX2 textures, a size cap per texture ([pipeline guide](https://app.cinevva.com/guides/optimize-glb-for-web)). Treat any size claims as unmeasured until we measure our own files.

## Phases (the stream split from PARALLEL_PLAN.md still applies)

| Phase | Work | Owner |
|---|---|---|
| R0 | Upgrade three.js, vendor post-processing, GTAO, CSM, KTX2/meshopt loaders; add quality tiers (low = today's look) | Stream A (touches `main.js`, and asks B about `env/environment.js`) |
| R1 | Ground: PBR terrain materials blended by slope and height, triplanar cliffs, real road textures with wear and edge decals | Stream A |
| R2 | Sky and weather: HDRI per time of day, volumetric-looking fog, wet and snow surfaces, headlight beams | Stream B (`env/`) |
| R3 | Vehicles: detailed PBR models, clearcoat paint, glass, real lamps | Stream B (`assets/`, `vehicle/`) |
| R4 | Landmarks: Atal Tunnel (gate, portal, tiled interior, signage), truss bridge, Marine Drive, Gateway, Taj Mahal Palace, India Gate, Taj Mahal, built in Blender | Stream A |
| R5 | Vegetation and rocks: scanned or Blender models with LODs, grass cards, wind | Stream A |
| R6 | Packaging and speed: compress assets, stream on demand, phone defaults to low, loading screen, frame-time budget per tier | both |

## Risks to accept knowingly

- Download size: today the game is about 7 MB of vendor and models; realistic assets are tens of MB. Quality tiers and on-demand loading are mandatory, and phones will look simpler than desktops.
- A procedurally generated world cannot be photographically identical to a photo. Hand-built landmarks (the Atal Tunnel) can come close; the generated land will look realistic, not like a specific photograph.
- Everything already built in the stylised look (road colours, bridge and tunnel materials, landmarks) is re-skinned in R1 to R5, not thrown away: the geometry and logic stay.
- Another option, not researched yet: real terrain from open elevation data (a free global height model) for the actual Rohtang pass, so the Himalayas location matches the real mountains.

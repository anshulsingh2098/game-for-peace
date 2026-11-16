# Asset plan (written 17 Nov 2026; the outside "Asset Acquisition Brief" was never supplied)

Goal: art for the India open-world phases that is original or properly licensed, with the source and licence of every file recorded in `assets/ASSETS.md`. Everything so far in N11 to N14 is **procedural** (boxes and extrusions made in code), so the game runs but looks plain. Nothing below is downloaded or bought yet; downloads need the owner's yes, and scripted downloads from Kenney and OpenGameArt are refused, so the owner downloads packs by hand into a new folder and tells the Claude.

| Need | Used by | Now | Route, cheapest first |
|---|---|---|---|
| Two-wheelers (scooter, motorbike) and riders | N12 traffic | procedural boxes | 1) CC0 or CC-BY packs, checked for licence; 2) model in Blender (`tools/blender/`, as for the traffic cars); 3) paid pack with the owner's approval |
| Auto-rickshaw | N12 | procedural | Blender build (distinctive, small, no good free model expected); a paid model only with approval |
| Buses, trucks with local liveries | N12 | generic shapes | recolour and decal the existing pack in Blender |
| Pedestrians, rigged, a few body types and clothes | N13, N14 | box figures | Mixamo-style rigs are not freely redistributable: prefer CC0 characters (Quaternius, Kenney) or a Blender-built low-poly rig with a walk cycle |
| Building kit (shopfronts, awnings, balconies, signs) | N11 | procedural | extend the procedural kit first; textures from CC0 sources (ambientCG, Poly Haven) |
| Street furniture (lamps, shelters, stalls, signals) | N11 | procedural | keep procedural; upgrade the stall and signal pole in Blender |
| Landmarks (Gateway, Taj Hotel, India Gate, Taj Mahal) | N3, N9 | procedural | Blender builds from own reference photographs; no photogrammetry from the web |
| Ambient sound per region | later | none | CC0 field recordings (freesound CC0 only), recorded originals |

Rules: licence must allow commercial web use and redistribution in the repo (CC0, CC-BY with credit in the credits screen, or a purchased licence kept on file); no ripped game assets; no AI-generated art passed off as scanned; every folder under `assets/` gets a source and licence line (the daily check enforces it); keep models small for phones (see `PERFORMANCE.md` budgets) and measure before adding.
Owner decisions needed: budget for paid packs (if any), who downloads packs by hand, whether the look stays low-poly or goes photoreal (see the photoreal plan in `team/photoreal-plan.md`).

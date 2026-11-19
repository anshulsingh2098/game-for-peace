# Open items from every ask (not-done register)

One line per thing that was asked or promised and is NOT finished or NOT verified. Updated 21 Nov 2026 (Stream A, Rajul's Claude). Close a line only with evidence (commit, frame, measurement), and move it to "Closed" below. Every phase entry in `docs/CP_MATCH_LOG.md` must list its not-done items here too.

## Open
| # | From | Item | Why open | Next |
|---|---|---|---|---|
| 1 | Phases 3 to 6 | **Phone benchmark** (day, dusk, night) | No phone available to the session; a desktop number is not a phone number | Owner or Anshul runs `?play&city=delhi&q=med&bench=30` on a named phone, night and dusk, visible screen |
| 2 | Phase 2/3 | Owner scores the six CP spots (1 to 5) | Needs the owner's eyes | Owner, with `tools/cp_views.json` |
| 3 | Phase 3 | Dusk preset change touches Anshul's lighting task (L6) | Open note A-2026-11-21-06 to his Claude, no reply yet | His Claude checks `times.dusk` in his scenes |
| 4 | Phase 6 | Kartavya spot k6 (a Lutyens roundabout) | No roundabout position found yet; k1 to k5 were looked at (21 Nov) | Find a roundabout in the lutyens area, look at it |
| 5 | Phase 6 | Lutyens kit seen only on Janpath at one spot | Hedges, lamps and avenue seen; compound walls and bungalows not seen; the buildings there are 4 storey slabs from the map, not low bungalows | Look at a residential street |
| 6 | Phase 6 | Kartavya zone against the map | Compared 21 Nov with the pack road (`nearestStreet`): the road lies within 10 m of the straight line from x -300 to 1800; west of x -300 the pack has unnamed streets 40 m off, so the two westernmost circles were removed. Carriageway 2 or 4 lanes by the pack (6.8 or 13.6 m); real width not measured | Owner photo or survey if wanted |
| 7 | Phase 6 | Red and yellow kerb and double yellow on Kartavya Path not compared with a photo | No photo | Owner photo of Kartavya Path |
| 8 | Phase 5 | Palm compared side by side with an owner photo of a CP palm | No photo | Owner photo |
| 11 | Phase 7 | `onTeleport` ignores yaw (observed) | Cause not read | Read `transit.onTeleport` |
| 12 | Phase 7 | Dusk frame time on main for a pair | Only the branch was measured at dusk | Run main at dusk |
| 13 | Earlier | Black and white kerb seen once in a frame | Not found again | Look along circle roads |
| 14 | Earlier | Anshul's Claude reviews: lane widening audit baseline, steering/car values | Open notes | His Claude |
| 15 | All | Merge of PRs 104 to 110 | Needs the owner's yes; they stack (105/106 then 107 to 110) | Owner |
| 16 | Phase 7 | Palm cards show a tall bare trunk when the camera is close under them | Seen at the avenue by day | Lift the crown or shorten the trunk of the card |
| 19 | Phase 8 | Kartavya Path has one carriageway with a double yellow line and red and yellow kerb paint; the real avenue is two wide carriageways with a lawn and water channels between | Map data has one way; no canal geometry | Owner decides if the canals and sandstone paths are wanted |
| 21 | Phase 7 | Drum dome proportions against the owner's photo R1 | The photo is outside the repository and not available to this session; the dome (3.3 m drum radius, collar 0.45 m, dome 2.15 m high, finial 1.1 m) is only checked against the written notes | Owner sends R1 again or measures a real dome |
| 22 | Phase 8 | GTA 5 gap list (`docs/GTA_GAP.md`, 12 lines) | Ranked from frames; none started except wires | Owner picks the order |
| 24 | Phase 9 | Frame times sit near 84 fps on this desktop for both main and branch, so a small cost may be hidden by the display rate | Same in earlier measurements | Measure with the governor off or on a slower device |
| 25 | Phase 9 | Lower day sun (shared preset) affects every scene and the auto day cycle | Seen only at CP and one frame at the park; other cities, weather and the dawn to day and day to dusk blends not looked at | Anshul's Claude and the owner look; the old value was sun y 0.85, hi 1.15 |
| 26 | Phase 10 | Roundabout island hedges (`roundabout.js`) still plain boxes; tree card variety limited to one picture per species | Only the street and CP hedges were rebuilt | Reuse `hedge()` in `roundabout.js`; draw 2 or 3 more cards per species |
| 27 | Phase 11b | Auto, tempo and truck cabs were changed in code but never seen (none on screen at CP); e-rickshaw and cycle-rickshaw bodies are unchanged; far people are still blocky (Minecraft-like) beyond the 18 animated actors | Old Delhi has the autos | Look in Old Delhi or at a market, `vehicles.js`, `pedestrians.js` |
| 28 | Phase 11 | CP busier traffic and the spawn tournament change the whole city's spawning (3 candidates elsewhere) | Seen only at CP | Look at another area; Anshul's Claude owns `citytraffic.js` (C-tasks) |
| 29 | Phase 11b | Frame time drifted to 13.3 ms (from 12.7 ms) after the arms and hair; main was not re-run in the same hour, so part may be machine load | Other sessions load the machine | Re-run main and branch back to back |

## Closed
| Item | Evidence |
|---|---|
| Sun shadows subtle by day (was 23) | Owner said lower the sun (21 Nov). `times.day.sun` [-0.30, 0.85, -0.45] to [-0.55, 0.55, -0.65] (elevation about 57 to 33 degrees) and `hi` 1.15 to 1.0 in `src/env/environment.js`. Seen: the columns, a tree and the pole cast visible shadows at CP and a dark car shadow on the road; still gentle on dark asphalt. Frame cost not re-measured (values only) |
| Wires hair-thin beyond 30 m (was 18) | CP spans now 2.4 times thicker and 8 pieces for a smoother sag (`wire(... th, n)` in `streetlife.js`); the others keep 6 cm. Seen after: three clear bands across a CP street at 30 to 60 m; the drum caps from the same spot read as domes |
| Kartavya zone too wide to the west (was 20) | One 950 m circle replaced by 12 small circles along the avenue. `__where()` after: (700, 300) and (1200, 300) are lutyens; (1200, 60), (1700, 70), (100, -10), (2000, 100) and the western end (-600, -30) are kartavya. Seen: avenue at (1200, 60) unchanged |
| Bare sand patches in Lutyens and Kartavya (found at k5, new) | A 330 m block beside Janpath was sand: green areas drew one block in five as dusty earth by a hash, and a long block took its area from its centre. Now Kartavya and Lutyens blocks are all lawn and a block takes the area most of its outline lies in (`tilemesh.js`). Seen after: lawn in the same view. Frame cost not measured |
| Drum corner caps like slanted flaps (was 17) | Cause: the cornice ring had no underside, so from the street it was an open collar. Added the underside, a two-tier dome and a finial (`drumCorner`, `cpfacade.js`). Seen 21 Nov from low (collar now closed, dark underside) and from a roof-high camera (domes read as domes). Not compared with an owner photo |
| Power poles with wires on CP pavements (was 9) | Seen 21 Nov: a grey pole with cross-arm beside a lamp post; three wires spanning 64 m between two poles across a CP street (80 spans counted in 14 tiles; rule changed from every third to every second lamp because short street pieces held one pole and so no span). Day only; not seen at night |
| Lamp pool strength (was 10) | Seen at night 21 Nov from a camera 5 m above the walk: warm pools on the pavement, kerb and road under three lamps, heads glowing |
| Night frame times, phase 7 branch against main (desktop, q=high, visible, night set right after load) | See CP_MATCH_LOG, phase 7 entry |
| Dusk frame time, branch | 12.2 ms avg, p95 16.7, p99 17.2 |
| Wider effect of the dusk change (numbers) | One line differs (`li` 2.7 to 1.6, `hi` 1.15 to 0.95); effects listed in the phase 7 entry |

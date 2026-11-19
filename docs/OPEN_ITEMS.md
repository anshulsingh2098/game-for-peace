# Open items from every ask (not-done register)

One line per thing that was asked or promised and is NOT finished or NOT verified. Updated 21 Nov 2026 (Stream A, Rajul's Claude). Close a line only with evidence (commit, frame, measurement), and move it to "Closed" below. Every phase entry in `docs/CP_MATCH_LOG.md` must list its not-done items here too.

## Open
| # | From | Item | Why open | Next |
|---|---|---|---|---|
| 1 | Phases 3 to 6 | **Phone benchmark** (day, dusk, night) | No phone available to the session; a desktop number is not a phone number | Owner or Anshul runs `?play&city=delhi&q=med&bench=30` on a named phone, night and dusk, visible screen |
| 2 | Phase 2/3 | Owner scores the six CP spots (1 to 5) | Needs the owner's eyes | Owner, with `tools/cp_views.json` |
| 3 | Phase 3 | Dusk preset change touches Anshul's lighting task (L6) | Open note A-2026-11-21-06 to his Claude, no reply yet | His Claude checks `times.dusk` in his scenes |
| 4 | Phase 6 | Kartavya spots k3 to k6 and India Gate in view | Not looked at; positions are guesses | Look at each, fix positions |
| 5 | Phase 6 | Lutyens streets and roundabouts with the same kit (compound walls, hedges, lamps, jamun) | Not looked at in the game | Spots k5, k6 |
| 6 | Phase 6 | Kartavya zone centre and radius | Approximate (950 m round 28.6134 N, 77.2210 E) | Fit to the map |
| 7 | Phase 6 | Red and yellow kerb and double yellow on Kartavya Path not compared with a photo | No photo | Owner photo of Kartavya Path |
| 8 | Phase 5 | Palm compared side by side with an owner photo of a CP palm | No photo | Owner photo |
| 11 | Phase 7 | `onTeleport` ignores yaw (observed) | Cause not read | Read `transit.onTeleport` |
| 12 | Phase 7 | Dusk frame time on main for a pair | Only the branch was measured at dusk | Run main at dusk |
| 13 | Earlier | Black and white kerb seen once in a frame | Not found again | Look along circle roads |
| 14 | Earlier | Anshul's Claude reviews: lane widening audit baseline, steering/car values | Open notes | His Claude |
| 15 | All | Merge of PRs 104 to 110 | Needs the owner's yes; they stack (105/106 then 107 to 110) | Owner |
| 16 | Phase 7 | Palm cards show a tall bare trunk when the camera is close under them | Seen at the avenue by day | Lift the crown or shorten the trunk of the card |
| 18 | Phase 7 | The wires are 6 cm ribbons: visible at 10 to 30 m, hair-thin beyond | By design | Owner decides if thicker |

## Closed
| Item | Evidence |
|---|---|
| Drum corner caps like slanted flaps (was 17) | Cause: the cornice ring had no underside, so from the street it was an open collar. Added the underside, a two-tier dome and a finial (`drumCorner`, `cpfacade.js`). Seen 21 Nov from low (collar now closed, dark underside) and from a roof-high camera (domes read as domes). Not compared with an owner photo |
| Power poles with wires on CP pavements (was 9) | Seen 21 Nov: a grey pole with cross-arm beside a lamp post; three wires spanning 64 m between two poles across a CP street (80 spans counted in 14 tiles; rule changed from every third to every second lamp because short street pieces held one pole and so no span). Day only; not seen at night |
| Lamp pool strength (was 10) | Seen at night 21 Nov from a camera 5 m above the walk: warm pools on the pavement, kerb and road under three lamps, heads glowing |
| Night frame times, phase 7 branch against main (desktop, q=high, visible, night set right after load) | See CP_MATCH_LOG, phase 7 entry |
| Dusk frame time, branch | 12.2 ms avg, p95 16.7, p99 17.2 |
| Wider effect of the dusk change (numbers) | One line differs (`li` 2.7 to 1.6, `hi` 1.15 to 0.95); effects listed in the phase 7 entry |

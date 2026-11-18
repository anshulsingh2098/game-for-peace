# Delhi reference pack: mapping and licences

Source: `Delhi_Complete_Claude_Pack` (research handoff of 19 Nov 2026, kept outside the repository; its plan text is reproduced here only as a mapping). Register of every photo and source: `docs/delhi_reference_register.json`.

## Licence rules for this pack (read before using a reference)
- The 60 new photographs, 3 official landscape photographs and 16 earlier plates are **study references only** (`reuseStatus: reference_only_permission_not_confirmed`). Nothing is downloaded into the repository, nothing is used as a texture, and models are drawn from what the pictures show (proportions, depth of balconies, sign stacking), never traced or copied. Capture dates and photographers are mostly unconfirmed.
- The GTA source projects named in the pack (reVC, gta-reversed, the two browser ports) are **read for architecture only**. No code, file format or data from them is in this repository. If a component is ever reused, record repository, commit and terms in `assets/ASSETS.md` first.
- `original_examples/budgeted-cell-plan.mjs` and `check-example.mjs` came with the pack as examples and are not integrated; their author's terms are not stated, so ask the owner before using them.
- Anything we draw or model ourselves from references goes in `assets/ASSETS.md` as "own work, from reference photos" with the register ids it was matched against.

## Pack steps mapped onto the existing plan (no new phase names)
| Pack | Existing task | State (19 Nov 2026) |
|---|---|---|
| R1 diagnostics | C0 (`tools/audit_city.mjs`, click-to-inspect source ids) | open |
| R2 traversal | C1 surfaceAt, C3 one rail model, C4 | open |
| R3 evidence, zones | Delhi look work, `identity.js` polygon overrides | open |
| R4 three samples | P and L tasks: Connaught Place, Old Delhi, government precinct | P1 infill and forecourts in PR 101; cornices and walls live |
| R5 trees | T1 | six drawn species cards; real pictures and five-place check open |
| R6 ordinary Delhi | P-series districts | open |
| R7 runtime | B10, B11, B15 | B15 open; routing still on the main thread |
| R8 water, Ridge | city and nature work | open |
| R9 expansion | after sample acceptance | not started |
| R10 Lite release | B14, B16 | B14 covered by the Lite build, review pending |
| R11 Full engine | Full benchmark phase | not started, waits for Delhi gates |

Evidence so far: visible-window bench at Connaught Place (`q=med`, desktop Mac, Browser pane): avg 9.9 ms, p95 16.7 ms, 382 draw calls, 281 k triangles. No phone number yet.

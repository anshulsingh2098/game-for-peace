# CP match log

One entry per element, newest first: what the references show, what was built, the comparison against the reference, a verdict (matches, close, wrong) and what is still different. Method: `docs/CP_MATCH_PLAN.md` ("The check loop"). Reference photos are the owner's four CP photos of 19 Nov 2026 (R1 corner block in sun, R2 arcade with brand boards, R3 wide street with hedge, R4 arcade at dusk) and N19 in `docs/delhi_reference_register.json`. Study only, kept outside the repository.

## 2026-11-19  Road: junction corner radius (element 2 of the road section)
Reference: the plan and the owner's report that the corners are boxy; real CP kerb radii are about 10 m or more (to be confirmed on photos R1 and R3 and the map; not measured here).
Built: `src/world/city/tilemesh.js` fillet radius `min(12, max(3, 1.6 * halfWidth + 1.5))` (was `min(7, max(3, 1.1 * halfWidth + 1.2))`): a 9 m road about 9 m (was 6), a 13 m road 12 m (was 7), a 6 m street about 6 m (was 4.5). The existing limit by piece length still applies, so short pieces keep smaller corners. Applies to the whole city, not only CP.
Comparison: **not yet compared by eye**. I could not get a clear overhead view of a junction in the tools this session (the car cameras show only the road ahead; no overhead camera is reachable from outside the game), so the verdict is **unverified**. Self-test: 116 checks pass. To check: an overhead screenshot of the Inner Circle with Radial Road 7 (x 1149.7, z -2032) before and after, and a scripted drive round the circle and out and back along each radial.
Open: the same radii now apply across all of Delhi, where corners near buildings could clip; the audit tool (`tools/audit_city.mjs`) should be re-run for buildings on roads before this is merged.

## 2026-11-19  Road: circle geometry (element 1 of the road section)
Reference: the plan (a true circle), photo R3 (the circle seen from the park side, smooth kerb line).
Built: `src/world/city/smooth.js`, applied to each tile after decoding (`src/world/city/pack.js`): Inner Circle pieces laid on the fitted circle every 2.5 degrees (no piece end moves; radius blended back over 25 m at each end); Middle and Outer Circle smoothed by corner cutting.
Comparison: before, 8.3 degree steps (18 m chords); after, at most 2.5 degrees (by script over 15 pieces, ends moved 0, interior points within 2.9 m of the fitted circle, which is the data's own scatter at piece ends). Seen in the game at cp6 (x 1169.9, z -2100.4): the kerb and lane lines bend as one curve. Verdict: **matches** for the Inner Circle line. **Close, not done:** the Middle and Outer Circle were smoothed but not looked at; the radial road corners are still tight (radius 3 to 7 m, next step); the Outer Circle data is itself off a circle by up to 10 m, so it is smooth but not exactly round; not driven yet (the scripted lap comes after the corner radii).
Self-test: 116 checks (`CP smooth circles`).

## 2026-11-19  Step 1: CP measured from the pack (`node tools/measure_cp.mjs`)
Source: the Delhi pack (OpenStreetMap derived, `assets/cities/delhi`). Evidence level: computed from data, not surveyed.
- **Inner Circle:** fitted circle centre (1044.2, -2100.4), radius 125.7 m, RMS error 0.96 m, worst 3.2 m. Built from 72 points: segments median 18.1 m, longest 28 m, about 8.3 degrees a step. This is why it looks faceted. Carriageway width in the pack 9 m (tertiary).
- **Outer Circle:** fitted radius 320.3 m, centre (1046.0, -2099.3), RMS error 3.4 m and worst 10.0 m (the data is rough here: one street named Outer Circle spans pieces that do not lie on one circle). 127 points, median segment 24.7 m, longest 91.8 m. Width 13 m (secondary).
- **Middle Circle** exists in the data (width 3 m, residential): the lane between the two rings of blocks. Seven radial roads are named Radial Road 1 to 7 (only some have pieces near the centre); angles where they leave the Inner Circle: Radial Road 2 at 152 degrees, Radial Road 7 at 33, Radial Road 4 at -86 (game x/z plane, 0 = +x).
- **Buildings:** 66 within 330 m. Heights: min 3.2, median 9.6, max 19.2 m (the pack uses 3.2 m a level). The inner ring blocks sit at 182 to 196 m from the centre (3 to 5 levels, footprints 4,000 to 6,300 m2), the outer ring blocks at 263 to 279 m (3 to 4 levels, 8,000 to 11,000 m2). So each block of the real plan is one polygon with a continuous frontage, as in the real plan.
- **Differences against the photos to resolve:** (1) heights: R1 to R4 show an arcade of about two storeys' height under two or three upper floors, so a real block is likely 15 to 20 m, against 9.6 m in the data; check against N19 and satellite before changing; (2) the faceted circles (fix next); (3) the data's block polygons have no arcades, drum corners or cornices: those are ours to add (done in part: A-2026-11-19-05).
- **Camera spots:** `tools/cp_views.json`, six spots from this geometry (first guesses; adjust after looking and note changes here).

## Elements: status
| Element | Reference | Verdict | Notes |
|---|---|---|---|
| Colonnade (square posts, slab) | R1, R2, R4 | wrong | thin square posts, no capital, no base; to be redone |
| Circle geometry | plan | wrong | faceted; next |
| Paving, kerb, hedge | R2, R3, R4 | wrong | bare earth apron |
| Facade, corner drums | R1, R3 | wrong | flat box |
| Brand boards, shop light | R2, R4 | wrong | almost none |
| Lighting, colour | R1 to R4 | wrong | flat, cool |

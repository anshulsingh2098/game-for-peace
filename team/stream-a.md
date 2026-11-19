## 2026-11-22 12:00  A-2026-11-22-01  Merged and deployed; the other Stream A session: add the CP and Kartavya plan to your task list
Branch: claude/delhi-p1-infill  Commit: see main (a55dab2)
What changed: at the owner's word, PR 111 (which holds phases 1 to 7) and PR 112 (docs: plan, checklist, references R7/R8 and K1 to K7, research pack, royal palm asset) are merged into `main`; PRs 106 to 110 closed as contained in 111. Clean `git archive` of main (a55dab2) deployed to Rajul's account, version df302bca; the served `dist/game.js` is byte-identical to the staged one; self-test 121.
For the other stream: the other Stream A session (cp_detail worktree), when you finish your assigned tasks (corner pavilion and night wall wash), add `docs/CP_MAX_PLAN.md` to your next tasks, in its order: 0 done; 1 measure with the owner's scores (3, 3, 2, 3, 3: shape, colour, boards, lighting, ground read in that order, scale not given) and the iPhone 14 Pro numbers; 2 roads and signs and 2b street props (bus shelter, drain, barricade, bollard, dustbin, CCTV, transformer, AC units, lightbox: I do these as new `src/world/city/cpprops.js`, tell me the hook lines); 3 facade rows; 4 brand boards and shops (the lowest score, 2); 5 light; 6 life; 7 phone gate; 8 acceptance; then Kartavya K-1 to K-15 in `docs/KARTAVYA_REFERENCES.md` and the kit. Tick rows in `docs/CP_MAX_CHECKLIST.md` (generated: edit the states in `tools/build_cp_checklist.mjs`). Say here which steps you take and which I take, so we never edit one file together.
Status: open

## 2026-11-22 00:00  A-2026-11-21-11  Day sun lowered (SHARED file src/env/environment.js)
Branch: claude/delhi-main-phase-7 (PR 111)  Commit: see the PR
What changed: day preset `sun` y 0.85 to 0.55 and `hi` 1.15 to 1.0 (one line, CRLF kept), with more shadow casters in `cityworld.js`. Owner asked for it so sun shadows read.
Evidence: implemented; self-test 121; seen at CP and the avenue by day. NOT done: other scenes, the day-cycle blends, phone.
For the other stream: Anshul's Claude: this touches your L6 look; please look at your own scenes by day and change `times.day` if it clashes (tuner: `times.day.sun`, `times.day.hi`). Together with the dusk change of A-2026-11-21-06.
Status: open

## 2026-11-21 23:00  A-2026-11-21-10  Phase 7: open items closed where possible, register of what is not done
Branch: claude/delhi-main-phase-7 (stacked on phase 6)  Commit: see the PR
What changed: `streetlife.js` (CP power poles and wires), `identity.json` (no palm on Kartavya), `docs/OPEN_ITEMS.md` (new: every not-done item from every ask), `tools/kartavya_views.json`.
Evidence: night q=high 12.4 ms against main 11.9 ms (desktop, visible); dusk 12.2 ms; self-test 121. NOT done: phone, spots k3 to k6, Lutyens kit; the full list is in `docs/OPEN_ITEMS.md`.
For the other stream: Anshul's Claude: please read item 3 and 14 in `docs/OPEN_ITEMS.md` (dusk preset, lane widening audit).
Status: open

## 2026-11-21 22:00  A-2026-11-21-09  Delhi main plan phase 6: Kartavya Path area rules
Branch: claude/delhi-main-phase-6 (stacked on phase 5)  Commit: see the PR
What changed: `identity.json` (zone and area `kartavya`), small hooks in `infill.js`, `tilemesh.js`, `streetlife.js` (world files, edited under the 17 Nov Delhi override), `tools/kartavya_views.json`.
Evidence: implemented; self-test 121; one spot seen by day. NOT done: spots k2 to k6, dusk, frame cost, phone.
For the other stream: Anshul's Claude: the zone centre and radius are a guess; correct them from the map if you know better.
Status: info

## 2026-11-21 21:00  A-2026-11-21-08  Delhi main plan phase 5: palms and wide pavements
Branch: claude/delhi-main-phase-5 (stacked on phase 4)  Commit: see the PR
What changed: `cpfacade.js` (`makePalmCanvas`), `cityworld.js` (palm card hook), `streetlife.js` (palm sizing), `assets/cities/delhi/identity.json` (palm species), `tilemesh.js` (4.2 m pavements near CP). Own work, no licence needed.
Evidence: implemented; self-test 121; seen by day and night. NOT done: frame cost, phone test, power poles.
For the other stream: nothing required.
Status: info

## 2026-11-21 20:00  A-2026-11-21-07  Delhi main plan phase 4: wet reflections on the paving at night
Branch: claude/delhi-main-phase-4 (stacked on phase 3)  Commit: see the PR
What changed: `cpfacade.js` (`boardReflections`, `brandIndex`), `tilemesh.js` (one call in `arcade()`, glossier paving in `setNight`). Night only.
Evidence: implemented; self-test 121; seen at night; night frames 0.7 ms (4 percent) above main on a desktop at q=high, same as phase 3 alone. NOT done: a phone night benchmark.
For the other stream: nothing required.
Status: info

## 2026-11-21 18:00  A-2026-11-21-06  Delhi main plan phase 3: light spill, dusk preset changed (shared env file)
Branch: claude/delhi-main-phase-3 (stacked on phase 2)  Commit: see the PR
What changed: `cpfacade.js` (light texture with a vertical wash, `columnWash`, `wallWash`), `tilemesh.js` (3 lines in `arcade()`), and a SHARED file: `src/env/environment.js` dusk preset `li` 2.7 to 1.6 and `hi` 1.15 to 0.95 (so the city's night lights come on at dusk; the preset was nearly full day), plus the tuner help text for `times.*.li`.
Evidence: implemented; self-test 121; seen at night and at dusk; q=high by day equal to main. NOT done: a night benchmark, the street lamp pool check.
For the other stream: Anshul's Claude: the dusk preset touches your L6 (dusk, night and monsoon look); please check it in your own scenes and change `times.dusk` if it clashes (tuner: `times.dusk.li`, `times.dusk.hi`).
Status: open

## 2026-11-21 16:00  A-2026-11-21-05  Delhi main plan phase 2: CP facade texture, roof cornice, corner columns
Branch: claude/delhi-main-phase-2 (from main 48e6dac, separate worktree)  Commit: see the PR
What changed: `src/world/city/cpfacade.js` (`cpFacadeTextures`, `roofCornice`, sill uv), `tilemesh.js` (new mesh and material `bldgCP`, wall mapping for CP blocks, the cornice call, the corner portico), `cityworld.js` (mesh name). Details in `docs/CP_MATCH_LOG.md`.
Evidence: implemented; self-test 121; seen by day and by night at a drum corner; q=high frames equal to main (11.8 against 12.1 ms average). NOT done: phase 3 onward, a phone, the owner's scoring.
For the other stream: nothing required.
## 2026-11-21 14:00  A-2026-11-21-04  Delhi main region plan; phase 1 markings like real Delhi
Branch: claude/delhi-main-phase-1 (from main 48e6dac, separate worktree)  Commit: see the PR
What changed: new `docs/DELHI_MAIN_PLAN.md` (9 phases with gates, the main region defined, asset research), `docs/DECISIONS.md` (the 21 Nov decision), `src/world/city/tilemesh.js` (double yellow off, black and white kerbs).
Evidence: implemented; self-test 121; seen: no yellow line at a junction. NOT seen: the painted kerb. NOT done: phases 2 to 9.
For the other stream: nothing required; please read `docs/DELHI_MAIN_PLAN.md` before touching the CP or Lutyens' Delhi look, and say here if a phase overlaps your tasks (P/L series).
## 2026-11-21 18:00  A-2026-11-21-07  Owner's scores for the CP spots (3, 3, 2, 3, 3), iPhone 14 Pro, a 3D royal palm asset
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: new `tools/make_palm.py` and `assets/nature/palm_royal.glb` (+ preview PNG), `assets/ASSETS.md` line. The owner scored the CP spots 3, 3, 2, 3, 3: recorded here read as shape 3, colour 3, brand boards 2, lighting 3, ground 3 (the scale score was not given; the owner has not said which order it is in, so this reading is an assumption to confirm). The owner's phone is an iPhone 14 Pro.
Evidence: the palm was built in Blender and its preview image looked at; NOT placed in the game, NOT seen in a game frame, NOT measured in a phone frame. Lowest score is the brand boards (2): workstream 4 of `docs/CP_MAX_PLAN.md` goes first after the merge.
For the other stream: the other Stream A session: the palm card in PR 109 shows a bare tall trunk close up (register 16): this model has a crownshaft and a full crown and can replace the card near the camera (instanced, 4 k triangles, so near ones only); say here before anyone edits `streetlife.js` for it.
Status: open

## 2026-11-21 16:00  A-2026-11-21-06  Research pack ticked off: `docs/CP_MAX_CHECKLIST.md` (50 places, 78 assets) and the CP gate extended
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: new `tools/build_cp_checklist.mjs` writes `docs/CP_MAX_CHECKLIST.md`: every place and asset of the owner's pack with scope (CP now 43 assets, CP surround 6, kit for later 29), our state (built 21 / partial 13 / not started 9 for CP) and where it lives; places get their game position, pack area and nearest landmark. `docs/CP_MAX_PLAN.md` gets gate item 6 and workstream 2b (CP street furniture: bus shelter, drain, barricade, bollard, dustbin, CCTV, transformer, AC units, lightboxes). The pack holds 50 places and 78 assets, not the 45 and 70 its README says.
Evidence: states are my reading of the code and logs (a code search), nothing looked at against a photo, nothing accepted; the position conversion is computed from the pack origin.
For the other stream: the other Stream A session: please check the CP rows against what you built (PRs 105 to 111) and correct a state in the script if I got one wrong.
Status: open

## 2026-11-21 15:00  A-2026-11-21-05  Plan: finish CP end to end, build the kit while doing it, then all Delhi (`docs/CP_MAX_PLAN.md`)
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: new `docs/CP_MAX_PLAN.md` (docs only): where CP stands, the gate that declares CP done, workstreams 0 to 8 in order, the kit modules to extract while building (roadkit, signkit, facadekit, groundkit, lightkit, lifekit) with a two-place non-CP test, the Delhi-wide order by area, what the owner must decide. It orders the existing plans; it replaces none.
Evidence: written from git, the logs, `docs/OPEN_ITEMS.md` (PR 111) and `docs/DELHI_MAIN_PLAN.md` (PR 105); nothing built or measured.
For the other stream: none required. The other Stream A session: please read it and say here if the order disagrees with PRs 104 to 111 before either of us starts workstream 2.
Status: open

## 2026-11-21 14:00  A-2026-11-21-04  Delhi atlas and asset pack filed under docs/research (docs only)
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: the owner's research pack copied unchanged into `docs/research/delhi_atlas_pack/` (visual atlas of 45 places, asset registry of 70 assets, a sampled audit, an agent workflow) with a short `README_REPO.md`. No game code, no shared file touched. Merged `origin/main` (PR 103) into the branch first; self-test 121.
Evidence: files read; NOT used by any code; image rights and asset licences are all unverified, headings are blank.
For the other stream: nothing required. Before anyone builds from the atlas, check coordinates against the pack and say here which places are taken so two sessions do not build the same block.
Status: info

## 2026-11-21 12:00  A-2026-11-21-03  Frame times, desktop: PR 103 branch is as fast as main (phone still needed)
Branch: claude/cp-facade-detail  Commit: see PR 103
What changed: nothing in the game; measurement logged in `docs/CP_MATCH_LOG.md`.
Evidence: MEASURED in a visible pane, a Mac: q=med both 7.1 ms average and p95 11.2 ms (141 fps, probably the display cap); q=high branch 11.6 ms average, p95 16.7, p99 17.0 (86 fps) against main 11.8, 16.7, 17.1 (85 fps); about 14 percent more triangles on the branch, no frame cost seen. NOT measured: any phone, a second desktop, repeated runs, night.
For the other stream: Anshul's Claude: if you have a phone, please run `python3 tools/serve.py 8792 --lan` and open `http://<this Mac's address>:8792/?play&city=delhi&q=low&bench=30` (also q=med) and record p95 and p99 here: that is the missing gate.
Status: open

## 2026-11-21 11:00  A-2026-11-21-02  Light on the walk (PR 103)
Branch: claude/cp-facade-detail  Commit: see PR 103
What changed: `cpfacade.js` (`makeLightMaterial`, `lightPool`, `arcadePools`); hooks: `tilemesh.js` (mesh `cplight`, material, `setNight` toggle, one call in `arcade()`, pass to street life), `streetlife.js` (one more line at the lamp head), `cityworld.js` (mesh name and view range). Warm additive light pools under every arcade bay and every CP, Lutyens and business street lamp; off by day.
Evidence: implemented; self-test 121; seen at night under the arcade (warm pools on the walk) and by day (invisible). NOT done: the lamp pools on a road, dusk, a visible-window frame time.
For the other stream: nothing required.
Status: info

## 2026-11-21 09:00  A-2026-11-21-01  CP facade refinement 2 on PR 103: soffit lights, lamp glow, window surrounds
Branch: claude/cp-facade-detail  Commit: see PR 103
What changed: `src/world/city/cpfacade.js` (lamp cell, `glowQuad`, `soffitLights`, drum surrounds, blade-sign orientation); one-line hooks in `tilemesh.js` (soffit call, `cpbrand` passed to street life) and `streetlife.js` (a glow quad under each lamp head of CP, Lutyens and business streets: shared file, 2 lines).
Evidence: implemented; self-test 121; seen in the game at night under the arcade and at the drum. NOT done: light cast on the walk, dusk grade, a visible-window frame time.
For the other stream: please glance at the 2-line `streetlife.js` hook when reviewing PR 103.
Status: info

## 2026-11-20 18:00  A-2026-11-20-09  CP facade detail on a new branch (PRs 101 and 102 are merged)
Branch: claude/cp-facade-detail (from main b5055bf, separate worktree)  Commit: see the PR
What changed: `src/world/city/cpfacade.js` (arched drum windows, sills, pediment, `facadeBands`, `bladeSign`), `src/world/city/tilemesh.js` (the `arcade()` signature and three calls). Details and the honest verdict in `docs/CP_MATCH_LOG.md`.
Evidence: implemented; self-test 121 checks; seen in the game by day and by night. NOT done: a visible-window frame time, the dusk grade, window surrounds and balustrade posts.
For the other stream: nothing required. The branch is based on main (PR 102 merged), so new PRs from `claude/delhi-p1-infill` are no longer needed; use new branches from main.
Status: info

## 2026-11-20 16:00  A-2026-11-20-08  Handoff and status updated; final merge and deploy of the day
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: `HANDOFF.md` (new section "State on 19/20 Nov 2026"), `docs/STATUS.md` (20 Nov section), tracker. The branch holds everything since PR 101: roundabout islands, CP facade, live signal heads, signs with places and STOP. Self-test 121.
For the other stream: Anshul's Claude: please review A-2026-11-19-01 (Lite and Download overlap with your B14), A-2026-11-19-08 and A-2026-11-20-01 (still open), and run the phone benchmark (`?play&city=delhi&q=low&bench=30`, result in PERFORMANCE.md).
Status: open

## 2026-11-20 14:00  A-2026-11-20-07  Boards name real places; STOP signs; deployed to Rajul's account
Branch: claude/delhi-p1-infill  Commit: a271972
What changed: new `tools/build_places.mjs` makes `src/world/city/places.js` (369 places: landmarks, 285 metro and 47 railway stations, with Hindi); new `src/world/city/signdests.js` (destination logic, testable without three.js: for each road leaving a junction, the most prominent place 0.7 to 14 km away inside a 37 degree cone of the road's direction, distance = straight line x 1.25, else the road name); `tilemesh.js` uses it (km on place boards) and builds STOP signs with a stop line at minor-road approaches (residential or service meeting a main road) beside the give-way ones; `tools/selftest.mjs` 120 checks. Deployed a clean `git archive` of a271972 (not the working tree) to Rajul's account (whoami checked), live at https://game-for-peace.mailrajulsingh-in.workers.dev, Lite build; the served `dist/game.js` has the new code.
Evidence: implemented; self-test 120; node check of the board text at CP, Karol Bagh and Lajpat Nagar (for example Pusa Road: ahead "Karol Bagh 1.2 km"); NOT seen in a browser after the places change, NOT on a phone; the place pick is a direction heuristic, not a route search, so a board can name a place the road reaches only by a turn.
For the other stream: nothing required.
Status: info

## 2026-11-20 12:00  A-2026-11-20-06  Road signs finished and applied Delhi-wide: Hindi for every name, green highway boards, diagram board, chevrons, give way, camera, route plates
Branch: claude/delhi-p1-infill  Commit: see the PR (2514c92 and after)
What changed: `src/world/city/tilemesh.js` (signs only where traffic arrives; boards only list roads a driver can enter; gantry with two round columns, truss, catwalk, boards 4.2 x 2.0 m on both sides; green boards with km for primary roads and up; a diagram board at a three-way junction; yellow chevrons on bends of 29 degrees or more; give-way triangles at minor roads; camera and route-number plates; name board, speed plate and gantry now also at unsignalled junctions of tertiary roads and up, because only 1,017 of the 38,913 main-road junction ends in the data are signals), new `src/world/city/hindi.js` (Hindi for the 2,800 names the pack has none for: a dictionary of Delhi street words plus a plain transliteration; the pack's own Hindi is always used first), `tools/selftest.mjs` (118 checks: Hindi is Devanagari for all names, the sign rules exist). `window.__signs` counts signs built (debug).
Evidence: implemented; self-test 118; seen in a visible pane: the gantry at a junction near CP, chevron, give-way and camera signs near CP, give-way and junction signs in Lajpat Nagar; bench at the CP spawn, q=med, window visible, desktop: avg 11.9 ms, p95 27.7 ms, 444 calls, 394 k triangles (was 400 calls, 335 k before the new signs). NOT done: a phone, a person driving past them, Hindi spelling checked by a Hindi reader (the made names are plain transliteration), real destinations (Karol Bagh) on boards: the map has road names only, not place-to-road lists.
For the other stream: nothing required. `put`/`signPole` in tilemesh.js are the places if you change signs.
Status: info

## 2026-11-20 16:00  A-2026-11-20-08  CP facade: brand boards and drum corners
Branch: claude/delhi-p1-infill  Commit: 63eeddc (on origin under d7126f1)
What changed: new `src/world/city/cpfacade.js`; `tilemesh.js` (an import, the `cpbrand` mesh and material, the board band call in `arcade()`, the drum corner loop in the building loop); `cityworld.js` (mesh name, view range). Details and the honest verdict in `docs/CP_MATCH_LOG.md`.
Evidence: implemented; self-test 121 checks from a clean archive of origin; seen in the game (a block with a round tower and the board band). NOT done: arched windows and pediment on the drum, night and dusk look, a visible-window frame cost.
For the other stream: nothing required. The invented board names are in `BRANDS` in cpfacade.js; change them freely (names only, no logos).
Status: info

## 2026-11-20 10:00  A-2026-11-20-05  Phone: full-screen home-screen app, HUD, resolution no longer dropped (shared files touched)
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: `index.html` (phone HUD: compact speed card, round map under it, 44 px top buttons; the canvas is `100lvh` so no dark strip at the top), `manifest.webmanifest` (`display` fullscreen to standalone: iOS does not know `fullscreen` and opened the app with a browser strip; `display_override` keeps fullscreen on Android), shared `src/main.js` (governor: on a phone the resolution never goes below 70 percent, a frame over 120 ms, such as a tile being built, no longer counts, and it drops only at 36 ms; no toast on a phone), `src/world/city/cityworld.js` (phone detail radius 950 m instead of 1300, keep 1450 instead of 1900: fewer tiles to build and draw).
Evidence: implemented; self-test passes; the owner's phone screenshot showed the strip and the lowered resolution; NOT yet seen on a phone after this change (the strip may need the icon removed and added again, iOS keeps the old setting), no frame times measured on a phone.
For the other stream: Anshul's Claude: a phone measurement is still wanted (`?play&city=delhi&q=low&bench=30` on a real phone, results in PERFORMANCE.md); the radius and governor numbers above are guesses until then.
Status: open

## 2026-11-20 10:00  A-2026-11-20-05  Live signal heads
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: new `src/world/city/signalheads.js` and `signalphase.js`; `cityworld.js` (5 lines of hooks); `tilemesh.js` `mastArm` (3 lines: lenses become lamp records); `tools/selftest.mjs` (+1 test). The heads follow the cars' rule exactly (green 14 s per axis; amber only in the last 2.5 s of a green slot).
Evidence: implemented; self-test 119 checks, also from a clean `git archive` of HEAD; read back from the page: 1,179 lamps, 0 mismatches against the rule at two times. NOT done: a car watched stopping under a red head, the night look, a visible-window frame cost.
For the other stream: nothing required. Two other sessions edit `tilemesh.js`; my commit touched only the 3 mast-arm lines.
Status: info

## 2026-11-20 08:00  A-2026-11-20-04  Road signs rebuilt (GTA/Delhi references), phone controls and place banner (shared files touched)
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: `src/world/city/tilemesh.js` (signs: green hexagon name board, yellow speed plate, blue direction gantry with truss, two round columns, catwalk; boards face arriving traffic and show text on both sides; destinations only from roads a driver can enter, one-way aware); `src/input/touchui.js` (Stream B file: phone controls now two arrow keys stacked on the left, two side by side on the right, small buttons above, after the owner's reference picture); shared `src/main.js` (a `PlaceBanner` on phones, 3 lines); new `src/ui/placebanner.js` (place name on arrival: "Karol Bagh", fades after 3.5 s); `src/world/city/cityworld.js` and `src/world/city/landmarks/index.js` (phones: no floating road-number labels or landmark name boards); `tools/selftest.mjs` (+1 check).
Evidence: implemented; self-test 117; the signs and the new touch layout seen in the browser pane (emulated 740 x 360, not a real phone); the banner is NOT yet seen on screen, nor driven with the new keys. NOT done: green highway distance boards, circle diagram, give-way and camera signs, Hindi for most street names.
For the other stream: Anshul's Claude: `touchui.js` is yours and was rewritten at the owner's word; please check the new keys feel right (up accelerates, down brakes and reverses, left and right steer, digital).
Status: open

## 2026-11-20 08:00  A-2026-11-20-04  Painted kerbs and mast-arm signals; a commit race with another session, repaired
Branch: claude/delhi-p1-infill  Commit: 80fd147 then 2247e03
What changed: `src/world/city/tilemesh.js`: red and white painted kerbs on trunk, primary and secondary roads (`kerb()`), `mastArm` signals at signalled junctions (static heads); logged in `docs/CP_MATCH_LOG.md`.
Incident: another session was editing and committing the same file at the same time. My commit 80fd147 was built from an older HEAD and removed its gantry sign code (committed in 22b8500 thirty seconds earlier); I pushed it, then restored the file in 2247e03 (byte-identical to 22b8500; self-test 117 checks). Nothing is lost. Rule from now on: before staging a shared file re-read HEAD, never `git add -A`, commit explicit paths only.
Evidence: implemented; self-test 117; seen in a pane at x 787, z -2250 (arms, heads and the red kerb read as in the owner's frames G8 and G9). NOT done: heads that show the real state, power poles with wires, planting strips and palms, a visible-window bench.
For the other stream: nothing required.
Status: info

## 2026-11-20 06:00  A-2026-11-20-03  Phases A to C done; frame times still needed from a visible window and a phone
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: phases A (double yellow and edge lines, painted arrows, GTA-style worn asphalt), B (round fluted columns in their own near-only mesh `colm`), C (wear as see-through overlay layers `wearD` and `wearL`, denser mess in the worst areas), all in `src/world/city/tilemesh.js` and `cityworld.js`; details and the honest verdicts in `docs/CP_MATCH_LOG.md`, the next steps in `docs/CP_MATCH_NOTES.md`.
Evidence: implemented; self-test 116; seen in the game in daylight; draw calls 346 and triangles 312 k and heap 332 MB (valid counts). Frame times NOT measured: the only run was in a hidden pane (16.7 fps, invalid). Needs: a person with a visible window and a phone, commands in the log entry "Measurement attempt".
For the other stream: Anshul's Claude: if you have a visible window and a phone, please run the bench (commands in the log) and record p95 and p99 here; plus the review items of A-2026-11-20-01.
Status: open

## 2026-11-20 03:00  A-2026-11-20-02  Road condition by area, road signs, defect notes
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: `src/world/city/tilemesh.js` (area grime, dust, leaflets, potholes, rubbish piles, sign poles and atlas, new meshes `rsign` and `junk`), `src/world/city/cityworld.js` (the two meshes and their view ranges), `docs/CP_MATCH_NOTES.md` (defects and improvements seen), `assets/ASSETS.md`.
Evidence: implemented; self-test 116 checks; seen in a visible pane in a clean area (CP) and a messy one (Karol Bagh); bench 402 calls, 335 k triangles, p95 11.2 ms desktop. NOT done: a phone, the messy side at full density, signs at non-signal junctions, the hoarding slab defect, the governor trips to Eco; see the notes file for the list.
For the other stream: nothing required; the hoarding geometry (`streetlife.js`) and the Eco trips (`main.js` `gov`) are in the notes if you want them.
Status: info

## 2026-11-20 00:30  A-2026-11-20-01  Steering lock, car and lane proportion, wider CP circles, road wear (owner's driving report)
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: Stream B: `src/vehicle/defs.js` car `steerMax` 0.50 to 0.62, `scale` 0.92 to 0.88; new `tools/measure_turns.mjs` (turn radius at 10 to 80 km/h, key=value overrides). Stream A: lane widths up again (`LANE_W`, `pack.js` and `packio.mjs`); CP circles at least 12 m and 16 m (`smooth.js`, `CP_WIDTH`); road wear (`wearDetail`, `tilemesh.js`); audit baseline regenerated (`footway_run` 94 to 120).
Evidence: self-test 116, vehicle acceptance no problems, `measure_turns` before and after (smallest circle 6.4 to 4.5 m radius), seen in a visible pane; bench 400 calls, 321 k triangles, p95 11.2 ms desktop. NOT done: a person driving it, a phone, the yaw cap (left at 1.2: raising it made full-lock turns spin out in the headless test).
For the other stream: Anshul's Claude: please drive a lap of the Inner Circle and a U-turn on the Inner Circle in each vehicle and say whether `steerMax` 0.62 feels right (tuner: `vehicles.car.body.steerMax`); the bike and truck were not changed; and review the `footway_run` baseline (94 to 120) with the wider lanes.
Status: open

## 2026-11-19 23:55  A-2026-11-19-09  Re: A-2026-11-19-08: car size and chase camera changed at the owner's word
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: Stream B files, on the owner's yes (19 Nov 2026): `src/vehicle/defs.js` (car: `scale: 0.92`, `cam` 6.0 / 2.2 / 3.2, shadow 3.1 x 5.5), `src/vehicle/vehicle.js` (applies `def.scale`; chase field of view 56 to 52 for every vehicle), `src/core/tuning-docs.js` (help for `scale`).
Evidence: self-test 116, vehicle acceptance no problems, seen in a visible pane; details and what is still different in `docs/CP_MATCH_LOG.md`.
For the other stream: Anshul's Claude: nothing is required; the values are tuner settings (`vehicles.car.scale`, `vehicles.car.cam.*`), change them if your feel tests disagree, and say so here. Wheels are drawn 8 percent smaller than the physics wheel radius at scale 0.92.
Status: info

## 2026-11-19 23:30  A-2026-11-19-08  Scale pass: wider lanes city-wide, taller CP blocks, markings, stop lines, paving; asks for Stream B
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: lane width per class widened (`LANE_W` in `src/world/city/pack.js` and `tools/lib/packio.mjs`, tertiary 3.0 to 3.4 m and so on, city-wide); CP blocks raised to 15.5 to 17.5 m (`cpLift`, tilemesh.js); arcade columns 5.6 m by 0.7 m; markings lifted over the asphalt; stop lines at signals; lane lines on wide one-way roads; CP stone-slab `plaza` mesh; `tools/city_audit_baseline.json` regenerated (footway_run 94 to 114).
Evidence: self-test 116 checks; seen in a visible browser pane; the measurements and their error (+-15 percent, by eye) are in `docs/CP_MATCH_LOG.md`. NOT done: a phone, a scripted drive, the C2 conflict check of the wider roads beyond the audit counts.
For the other stream: Anshul's Claude: (1) please review the wider lanes against C2 and the raised `footway_run` baseline (94 to 114: sidewalks mapped along a road that now overlap the wider carriageway; a rule for it is yours if you want it); (2) the car looks too big in its lane: `assets/car_01_gt.glb` measures about 4.8 x 2.1 x 1.56 m against a real coupe's 4.5 x 1.9 x 1.3, and the chase camera (`cam` in `src/vehicle/defs.js`: 7.5 back, 3.0 up) sits higher and farther than the GTA references (about 5.5 back, 1.8 up, field of view 50); I did not touch Stream B files. Status: open
Status: open

## 2026-11-19 22:00  A-2026-11-19-07  CP roads: smooth circles, wider junction corners, hedge ends, overhead debug camera
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: (1) new `src/world/city/smooth.js`, called from `src/world/city/pack.js` `tile()`: the Inner Circle is laid on its fitted circle (2.5 degree steps), the Middle and Outer Circle are smoothed by corner cutting; piece ends never move. (2) `src/world/city/tilemesh.js`: junction kerb radius `min(12, max(3, 1.6 * halfWidth + 1.5))` for the WHOLE city (was `min(7, ...)`). (3) `src/world/city/streetlife.js`: hedge boxes are tested at both ends against roads and buildings. (4) `src/main.js` (shared, 2 lines after `window.__next`): `window.__cam(x, y, z, yaw, pitch)` puts the game in fly mode with the camera placed exactly (overhead: pitch -1.5); nothing in the game calls it.
Evidence: implemented; self-test 116 checks (new: CP smooth circles); seen in a visible browser pane from above at the Inner Circle and Radial Road 7 (rounded corner, hedges off the road mouth). NOT done: a scripted drive round the circle, the Outer and Middle Circle looked at, a re-run of `tools/audit_city.mjs` after the wider corners (buildings near corners across Delhi), a phone, a person's judgement.
For the other stream: Anshul's Claude: `smooth.js` runs on tile decode, so graph edge geometry (`edgeGeom`) sees the smoothed Inner Circle; tell me if routing or autodrive misbehaves round Connaught Place. The wider corners are city-wide: say if they clash with C2 (buildings against roads).
Status: info

## 2026-11-19 20:00  A-2026-11-19-06  CP match: plan, measurements, six camera spots
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: `docs/CP_MATCH_PLAN.md` (plan: per-element check against references, exact to CP, smooth roads), `docs/CP_MATCH_LOG.md` (measurements and an element table), `tools/measure_cp.mjs` (fits circles to the pack's Inner and Outer Circle), `tools/cp_views.json` (six camera spots).
Evidence: computed from the pack by script (Inner Circle radius 125.7 m, RMS 0.96 m, built from 18 m segments; Outer Circle RMS 3.4 m); nothing seen yet against the photos in this step.
For the other stream: heads-up only: road changes for CP's tiles come next in Stream A (smooth circles, larger corner radii); they touch the same street geometry as C1 to C4. Say here if you would rather I wait.
Status: info

## 2026-11-19 19:00  A-2026-11-19-05  Connaught Place colonnade (first greybox-to-reference step, reference N19)
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: `src/world/city/tilemesh.js`: on street-facing walls (8 m and longer) of Connaught Place buildings of 9 m and more (`area: cp`, including those the pack tags with the district landmark), `arcade()` builds a 3.4 m paved walk, square white columns about every 3.6 m at its outer edge, and a slab at 4.4 m with a darker underside (200 walls a tile at most; a wall is skipped where the strip would reach the carriageway); `src/world/city/infill.js` hands `streetClear` to the mesher (`out.streetClear`). No assets: all geometry is own work in code, matched by eye to the described view in the register entry N19 (white colonnade, continuous shaded walk, shop bays behind); the photograph itself is not used.
Evidence: implemented; self-test 115 checks (none cover the arcade); seen in a browser (visible pane) at the Inner Circle, x 970 z -2225: columns, slab and dark shop bays read as a colonnade. Cost, same route as A-2026-11-19-03 (Connaught Place start, q=med, bench 30, visible pane, desktop Mac): triangles 281 k to 318 k (+13 %), draw calls 382 to 383, p95 11.4 ms (the earlier run 16.7 ms: run-to-run noise is large, do not read it as faster). NOT done: column spacing and bay width are from a description, not a surveyed footprint (N19 itself says to get another camera and a footprint); the apron between the carriageway and the arcade is still bare earth; shop signs; the Outer Circle's different frontage; no phone run; no person has judged it. Note: the service worker serves old files in a browser tab that has run the game before; clear it (DevTools, Application) or you will not see this.
For the other stream: nothing.
Status: info

## 2026-11-19 18:00  A-2026-11-19-04  Delhi reference pack mapped onto C/P/L/B tasks; licence register
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: new `docs/DELHI_REFERENCES.md` (pack steps R0 to R11 mapped to existing tasks, no new phase names; licence rules), `docs/delhi_reference_register.json` (every photo and source page, no image bytes), a "Reference photographs" section in `assets/ASSETS.md`. All pack photos are study only, permission not confirmed; no GTA code or data is used.
Evidence: documents only; nothing implemented or measured here.
For the other stream: Anshul's Claude: C0 to C4 are yours under the 17 Nov override; the pack asks for source-id diagnostics first (C0). The Connaught Place greybox comparison (my side, Stream A) comes next and will be logged separately.
Status: info

## 2026-11-19 17:00  A-2026-11-19-03  P1 part 3: paved forecourts, and the first visible frame measurement
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: `src/world/city/infill.js`: open ground left inside dense blocks (oldDelhi, market, default, cp, business) is returned as `yards` (8 m grid cells merged to rectangles, 700 a tile at most, clear of streets by 2.5 m and of buildings by 1.2 m); `src/world/city/tilemesh.js` paves them in the pavement mesh (same height and texture as the pavements); `tools/selftest.mjs`: yards are inside a block, not under a building, deterministic.
Evidence: implemented; self-test 115 checks; frame cost MEASURED in a visible Browser pane (Claude desktop app, Chrome 156, MacBook-class Mac, `?play&city=delhi&q=med&bench=30`, Connaught Place start): 3,034 frames, average 9.9 ms, p95 16.7 ms, p99 22.3 ms, worst 55.4 ms, 382 draw calls, 281 k triangles, heap 270 MB. This is a desktop figure, NOT a phone figure. Not done: a person's check of the forecourts, a phone run.
For the other stream: nothing.
Status: info

## 2026-11-19 15:00  A-2026-11-19-02  P1 second increment: interiors of big blocks, and a void measuring tool
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: `src/world/city/infill.js` (Stream A file): a second pass cuts each block into back-to-back rows of lots along its longest edge with 3.2 m lanes, same acceptance test as the frontage lots (cap 1,800 interior lots a tile, 4,000 in all; `interior: true` on the record; stats `iTry`, `iOut`, `iStreet`, `iBld`, `iMargin`); new `tools/measure_voids.mjs` (100 m cells of the 5 sample areas); `tools/selftest.mjs` (interior lots checked by the existing validity test); status lines in `docs/DELHI_POLISH_PLAN.md` and `docs/NEXT_PHASES.md`.
Evidence: implemented; self-test 115 checks; measured by script: void cells in the sample areas 19 to 10, block coverage up 1 to 2 points (Chandni Chowk 24.3 to 27.5 %, Khan Market 15.5 to 16.4 %); infill time per tile +10 ms (44 to 53, 24 to 34, 30 to 35 ms); seen in a browser at Karol Bagh (street looks right). NOT measured: frame cost (the browser pane was hidden, so no valid frame numbers; run `?play&city=delhi&q=med&bench=30` in a visible window), forecourts, parking and plazas are not built, the coverage targets (50 to 60 %) are not met: most of the missing ground is in no block face or under mapped buildings.
For the other stream: nothing.
Status: info

## 2026-11-19 12:00  A-2026-11-19-01  Lite build (Delhi only in the browser) and the Download-for-offline button
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: (1) new `src/core/build.js`: `BUILD`/`LITE`, Lite by default, `?build=full` for the full game from a full source tree. (2) `src/main.js` (shared, small): Lite always starts Delhi (`cityMode`), skips the India world, the roads-out fetch and the highway gates (`leaveCity`, `updateGateExit`). (3) `src/ui/menu.js` (shared): Lite shows "Play: Delhi", hides Explore cities, Travel and New world; adds the Download rows. (4) `index.html`: the early preload skips India files in Lite. (5) `tools/stage_cloudflare.py` (shared): `--build lite|full` (default lite leaves `assets/india/` out of the deploy; nothing is deleted from the repo) and writes `offline.json`; `tools/bundle.mjs` updates it for the bundle. (6) `sw.js` + new `src/ui/offline.js`: a "Download" button per group (game core about 45 MB, Delhi 78 MB) fills a never-trimmed cache with progress; the service worker keeps it across updates. This overlaps your task B14 (build switch, Lite boots into Delhi) and part of B16: please review instead of redoing it.
Evidence: implemented; self-test 115 checks (two new); seen in a browser on a staged, bundled build: a plain `?play` opens Delhi with no India file requested, the pause menu has no city or travel entries, the core download cached 256 files and the game opened with the server stopped. NOT tested: the Delhi download, a real phone (iPhone has no service worker by design), driving to the edge of the city data (the gates are off, so nothing turns the car back), a real deploy, a person's acceptance.
For the other stream: review the three shared-file edits; mark B14 as covered or tell me what is missing. Deploy the Lite build with `python tools/stage_cloudflare.py --out <folder>/public` (Lite is the default) then `node tools/bundle.mjs <folder>/public` as before.
Status: open

## 2026-11-18 10:00  Delhi stuck on loading screen: builder boost while loading
Branch: claude/delhi-loading-fix  Commit: see PR
What changed: src/main.js whenCityReady() sets city.boost (22 ms/frame builder budget instead of 3 ms) while waiting, wait up to 45 s, shows 'Building Delhi... N of 5 tiles'; cityworld.js stepJob honours boost (?noboost turns it off). Cause: on slow frames the 3 ms budget built 0 tiles in 20 s, so the game started on bare plains / looked stuck.
For the other stream: nothing. The deployed site needs a redeploy by whoever deploys to get this.
Status: open

# Stream A log (World: Rajul's Claude writes here, Anshul's Claude only reads)

Newest entries first. Format is in `CLAUDE.md`.

## 2026-11-18 23:30  A-2026-11-18-26: trees redone, Metro-through-buildings fix, asset cache, engine sound start
Branch: fix/trees-cache-sound (PR)  Commit: see the PR (deployed)
What changed: (1) TREES: `tools/make_tree_cards.py` draws six pictures (`assets/nature/delhi_*.png`, our own work); `streetlife.js` picks one per species (`TREE_PIC`), keeps them untinted, places trees in clumps with a smooth field (`clump`) instead of a grid, and records blob shadows; `cityworld.js` draws one instanced mesh per picture and a shadow mesh per tile. (2) STRIPES: the long strips across the map were Metro track: the data marks 38 stretches (17 km) as at grade, and 9 of them (4.4 km) run through building footprints, so they were drawn as ground strips through buildings (`transit_plan` heights: at grade 0.3 m). New `tools/fix_metro_grades.mjs` (dry run, `--apply`) made those 9 stretches and the at-grade stations on them underground in `assets/cities/delhi/transit.json` (kept `gradeFixed` notes). Not fixed: elevated viaducts (11.5 m) that still pass through 12 to 16 m buildings (the path and the footprints disagree by metres): needs the click-to-inspect tool (C0). (3) CACHE: `sw.js` v2: assets, city tiles, models, textures and sounds are cache first with a quiet refresh (newest 900 kept), so the second visit and every returning city tile load from the device; not on iPhone (no service worker there). (4) SOUND: `src/audio/engine.js`: the synthesised engine no longer plays for the first seconds while the recorded engine loads (the car is silent until the recording is ready; `?engine=synth` and a load failure keep the synthesised engine). Not verified by ear. Measured: 295 draw calls, 229 k triangles at the same park view.
For the other stream: Anshul's Claude: T1 continues from part 1; C0 first for the remaining conflicts; do not re-add a synthesised engine start.
Status: open

## 2026-11-18 22:00  A-2026-11-18-25: ALL PRs merged (93 to 98); trees and conflicts are the open complaints; docs updated
Branch: docs/final-update  Commit: see the PR
What changed: at the owner's request PRs 93, 94, 95, 96, 97 and 98 were merged into `main` (95 and 98 needed `main` merged into them first: conflicts in the log, `docs/STATUS.md` and the tracker, kept both sides and rebuilt the tracker). I asked this session's neighbour (the other Claude session, owner of PR 97) first; no reply came before I merged PR 97, which was clean against `main` and small. `HANDOFF.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/NEXT_PHASES.md` (new task T1, trees) and the tracker are updated. Owner's complaints, with Rajul's Claude's diagnosis: TREES: one olive-tree picture for all trees (twisted thick grey-blue trunk, thin pale foliage), tint and haze wash the colour out, grid placement, no shadows, wrong species. CONFLICTS (screenshot): station track strips cut through buildings and roads, trains pass through buildings, cars and people pass through trains (the track kit, trains, traffic and pedestrians do not know about each other), buildings stand on roads; plan C0 to C6.
For the other stream: Anshul's Claude: `git pull`; read `docs/NEXT_PHASES.md`: T1, C0 to C6, B1 to B16 and the phases; one phase at a time, one PR each, owner merges.
Status: open

## 2026-11-18 21:00  A-2026-11-18-24: strips near Todarmal Road: station track kits shortened (live eb901661); the road fan is still there
Branch: docs/city-conflicts (PR 98), code on fix/delhi-green (PR 96)  Commit: see the PRs (deployed)
What changed: `src/world/city/transit_rail.js` (PR 96): station tracks 45 m past the platforms (was 220 m), rake travel 120 m (was 260 m), gravel-coloured ballast and darker rails. OpenStreetMap (viewed in the browser) shows the New Delhi to Nizamuddin corridor of about 12 parallel tracks at Tilak Bridge. The second kind of strip, a fan of unnamed residential edges, is NOT fixed: no detector matched it (details in `docs/CITY_CONFLICTS_PLAN.md`, "Update"). Tool: `tools/audit_city_area.mjs`. Not verified: the OSM tags of the fan, other stations (New Delhi, Nizamuddin) after the shortening, trains running in from beyond the tracks.
For the other stream: Anshul's Claude: C0 must include a click-to-inspect street overlay (OSM id and tags) before any rule is written; C3 replaces the platform-face track count with the real tracks.
Status: open

## 2026-11-18 20:00  A-2026-11-18-23: owner reports rail, road, building and height conflicts; plan C0 to C6 (docs/CITY_CONFLICTS_PLAN.md)
Branch: docs/city-conflicts  Commit: see the PR
What changed: the owner sent a screenshot of a city covered in parallel strips with trains on them and old low-poly trees, and reported rail and road overlaps, buildings on roads, a car that sinks and a car that falls into a tunnel. Not reproduced in the live game (`c085cc44`) at Connaught Place, New Delhi station or the India-map start. New `docs/CITY_CONFLICTS_PLAN.md` (what was checked, likely causes, phases C0 to C6) and tasks C0 to C6 in `docs/NEXT_PHASES.md`. Three rail systems exist that do not share data (the India-map network, the Delhi station kits, the Metro in `transit.json`), and the city pack has no rail class; the pack's own conflict counts are in the plan.
For the other stream: Anshul's Claude: start with C0 (`tools/audit_city.mjs`), then C1; ask the owner for coordinates (menu Copy line) of each defect and the build address of the screenshot.

## 2026-11-18 14:00  A-2026-11-18-17: OWNER DECISION: Web Lite is Delhi only, Full (India, more cities) is a downloadable PC and phone app; your plan accepted in principle
Branch: docs/lite-and-full  Commit: see the PR
What changed: the owner accepted `docs/LITE_AND_FULL_PLAN.md` (your draft, now on main with the owner's decision at the top) and recorded it in `docs/DECISIONS.md`: only Delhi is playable in the browser; the whole India map and more cities are in a downloadable app for PC and phone, for better compute and graphics and so better engines can be used; the Full engine is decided after benchmarks (your Phase 6). New tasks in `docs/NEXT_PHASES.md`: B14 (the `BUILD = lite | full` switch and Lite boots into Delhi), B15 (Lite budgets on real devices), B16 (a one-page Full app packaging note); B6 now asks only the four open details (cars in Lite, minimum device, PC or phone first, a "get the full game" button; defaults in the plan: 2 cars, a mid laptop and mid phone, PC first, yes). B7 (no-reload city switch) now applies to the Full build only.
For the other stream: Anshul's Claude: read the plan, work B14 first after B1 to B3 (shared files `src/main.js`, `tools/stage_cloudflare.py`: reserve first), and ask the owner the four open details. Keep one codebase and one self-test for both builds.

## 2026-11-18 19:00  A-2026-11-18-22: real-scan leaf-card trees, compound walls, cornices; speed (live c085cc44)
Branch: fix/delhi-green (PR 96)  Commit: see the PR (deployed)
What changed: the owner asked to fix the four "still wrong" items. (1) Trees: `streetlife.js` no longer builds crowns; it collects tree positions as `out.cards` and `cityworld.js` draws them as leaf cards (real-scan `island_tree_02`, and `fir_sapling_0` for the columnar ashoka) on three crossed planes, one instanced mesh per tile and picture, tinted per species; each plane is built twice (front and back with an upward normal) because `DoubleSide` lit the back faces from below and drew black trees. 6 triangles a tree. (2) Walls and facades: `streetlife.js` compound walls (low plastered wall with a coping, residential streets of Lutyens and DDA, 220 a tile at most); `tilemesh.js` cornices (a projecting lip along the roof edge, 6 triangles a wall) on buildings of 9 m and more in Connaught Place, Lutyens and Old Delhi, 140 buildings a tile at most. (3) Speed: the same fly-camera spot in a park went from 571 draw calls and 322 k triangles to 230 and 173 k; the Connaught Place start at `q=med` draws 304 calls and 298 k triangles (the cornices cost about 90 k there). Not done: more tree pictures (neem, peepal and jamun specific, only two pictures exist), facade relief and signage across the whole city, the photo check by a Delhi person, a real phone measurement. Mistake and fix: a `//` comment ended a one-line function in `cityworld.js` and a build with a syntax error was live for a few minutes (version b67ee7ea); fixed in 9c318e4f. `tools/bundle.mjs` now needs its result checked: the deploy line must be gated on "bundle:" printing (to do).
For the other stream: Anshul's Claude: continue L2 and P3 from `docs/NEXT_PHASES.md`; put more tree pictures into `assets/nature` and `treeMat` names in `cityworld.js`; measure on a phone.
Status: open

## 2026-11-18 18:00  A-2026-11-18-21: Anshul's rebuilt cars are back in (models and definitions only); his sound, birds and moon stay out (live 0e65f42a)
Branch: fix/delhi-green (PR 96)  Commit: see the PR (deployed)
What changed: owner request: his car design was better. Restored from `0fc2664` (main with PR 90): `assets/car_01_gt.*`, `car_02_sport.*`, `car_03_rally.*` (the rebuilt models: production-car look, arches, trim) and `src/vehicle/defs.js` and `src/vehicle/vehicle.js` (their definitions, ride height, and the Ember RS and Dust Runner entries). Not restored: `src/audio/engine.js` (his engine configs, birds and crickets: the engine falls back to the Dusk GT sound for his two extra cars) and the moon in `environment.js`. Checked: self-test 113, `vehicle_acceptance --check` no problems found, daily check green; live: the new 842 KB Dusk GT model loads, no birdsong, horn present.
For the other stream: Anshul's Claude: B1 is now only about the engine sound and atmosphere work (the car models are in); send those as separate small PRs for the owner's yes.
Status: info

## 2026-11-18 17:30  A-2026-11-18-20: Delhi look part 3 (species crowns, medians, haze, colony trees) and the green-data check (docs/DELHI_GREEN_DATA.md)
Branch: fix/delhi-green (PR 96)  Commit: see the PR (deployed)
What changed: `streetlife.js`: crown shapes by species (`BLOBS`), medians where one-way carriageways of a main road run 2.4 to 20 m apart, colony trees in residential blocks (260 per tile at most); `environment.js` and `main.js`: `env.haze` from the month's smog (November 0.77: warm beige-grey sky, shorter view); `docs/DELHI_LOOK.md` photo-check table (Wikimedia Commons photos viewed, nothing copied). Owner asked to check forest and tree coverage against maps and data: new `tools/check_city_green.mjs` and `tools/check_city_places.mjs` and `docs/DELHI_GREEN_DATA.md`: forest plus scrub 144 km2 against the forest survey's 195 km2 forest cover (74 percent), tree cover outside forests (147 km2) not in the map, 6 of 20 known greens inside the right class and most others 3 to 140 m from a polygon, a few missing; the builder drops protected-area, orchard and tree-row tags and the park names. Measured: fly camera in a park, 571 draw calls, 322 k triangles at `q=med`. Not done: walls, facade relief and signage (L2, P3), modelled Delhi trees (the leaf-card trees of the open-land scatter look better than my crowns), a median not yet seen on screen, a pack rebuild (needs the 225 MB OSM extract and the owner's yes), a Delhi person's photo check. Note: PR 97 (another session, Delhi stuck on loading) also touches the city loading: merge order matters.
For the other stream: Anshul's Claude: continue L2, L3 and P3 from `docs/NEXT_PHASES.md`; measure draw calls and triangles on a phone before adding more trees.
Status: open

## 2026-11-18 16:00  A-2026-11-18-19: Delhi greenery part 2 (broad two-blob trees, forest, scrub, farmland, hedges) and Anshul's done and left (docs/STATUS.md)
Branch: fix/delhi-green (PR 96)  Commit: see the PR (deployed 274c9c46)
What changed: after the owner asked to do the "not done" list and match real photos: looked at Wikimedia Commons photos of Rajpath and Karol Bagh in the browser (viewing only, nothing copied). `streetlife.js`: trees scaled up to real Delhi sizes with a second crown blob and a thicker trunk; park trees by class from the pack (`forest` 428 polygons dense, `scrub` sparse and small, `sports` and `golf` nearly bare, `garden`, `grass`); clipped hedges along the avenues of Lutyens, DDA and Connaught Place. `tilemesh.js`: forest, scrub, sports, golf and garden colours; farmland (3063 polygons, the Yamuna floodplain) drawn as fields. Measured (fly camera, `q=med`): 235 draw calls, 178 k triangles. Not done: real-scan or hand-modelled plant shapes, median planting (needs P2e road geometry), walls, haze and sky colours, a photo-by-photo check of species and facade colours. `docs/STATUS.md` now lists what Anshul's Claude has done and what is left; nothing of B1 to B16 or the phase tasks has been started by it since the assignment.
For the other stream: Anshul's Claude: pull PR 96 before touching `tilemesh.js` or `streetlife.js`; L3 continues from the list in `docs/NEXT_PHASES.md`.
Status: open

## 2026-11-18 15:00  A-2026-11-18-18: Delhi greenery: real grass lawns, park trees, earth ground, greener land (L3 started; live 5c778ecf)
Branch: fix/delhi-green (PR)  Commit: see the PR (deployed)
What changed: the owner said Delhi's landscape, grass, vegetation, trees and building looks do not match real Delhi, and the grass looked basic and dull, nothing like Slow Roads. Cause (mine): the earlier "aerial look" PR 75 switched off the random trees and bushes in the city and set the ground to one grey-tan; the land between streets was a grey blotchy fill (`BLOCK` colours with a noise map). Now: (1) `tilemesh.js`: new `lawn` mesh and material (the real `assets/ground/grass_*` PBR texture, bright tint) for parks and for the blocks in green areas (Lutyens, DDA, business) or mapped as grass or garden; every other block is warm earth with the sand texture (`mats.ground`), not a grey noise map; (2) `streetlife.js`: park trees on a jittered grid by the area profile (species from `identity.json`, never in a building or a road, 600 per tile at most, with collision circles) and the crowns have 8 sides, an uneven outline and smooth shading; (3) `cityworld.js` `cityConfig`: the land under and beyond the city has green and dry-olive palette tints again, with grass tufts (0.012), bushes (0.002) and a few trees (0.0004). Measured (fly camera at India Gate, `q=med`): about 216 to 233 draw calls, 139 k triangles, no extra requests. Not done and not as good as a photograph: the crowns are still generated low-poly shapes (not real-scan models), no hedges, medians or Ridge forest, no Yamuna floodplain, no photo check of species and colours. Needs a person: tell what in Delhi looks wrong with photographs side by side.
For the other stream: Anshul's Claude: this is a start of L3 (mark `[~]`); continue from the list in `docs/NEXT_PHASES.md` L3; before you change `tilemesh.js` or `streetlife.js` pull this PR.
Status: open

## 2026-11-18 13:00  A-2026-11-18-16: no "Enter Delhi city" button: the city loads by itself when you are near it (live c79d72b1)
Branch: feat/auto-enter-city (PR)  Commit: see the PR (deployed)
What changed: owner request. `src/main.js` (shared, small): the `enterBtn` button and its code are gone; on the India map, within 200 map metres (about 20 km) of Delhi on its highway the city loads by itself through the gate of the highway you are on (the same `enterCity` as before; the zone was 120 m). Driving out of the city puts you 260 m out, so you are not taken straight back in. Starting in or selecting Delhi still goes straight into the city (PR 74). Checked live: at 250 m the map stays and no button shows; at 150 m the city loads through a gate (`at=nh148a-west-9`) and the page shows Delhi city.
For the other stream: Anshul's Claude: nothing; if you change the gate or highway start code (B7, the no-reload switch) keep the 200 and 260 numbers apart (entry zone smaller than the exit start).
Status: info

## 2026-11-18 12:00  A-2026-11-18-15: Anshul's car design, engine sound, birds, crickets and moon taken OUT of main again (live f91b4cc3); NPCs and animated exit kept
Branch: fix/restore-cars-sound (PR)  Commit: see the PR (deployed)
What changed: the owner noticed that things already fixed with Rajul's Claude had been replaced by Anshul's versions after PR 90 (my merge of `release/combined`): the car design, the car (engine) sound, birdsong from somewhere in Delhi, and more. Restored from `51bdc03` (main just before PR 90): `assets/car_01_gt.*`, `car_02_sport.*`, `car_03_rally.*`, `src/vehicle/defs.js`, `src/vehicle/vehicle.js` (cars, ride height, the vehicle list), `src/audio/engine.js` (his engine configs and `ambience()` birds and crickets; the horn and Delhi street bed are in the restored file), `src/env/environment.js` (the moon). Kept: his cartoon NPCs and the animated exit from the car with the cartoon player figure (`src/player/exitseq.js`). Checked: self-test 113, `vehicle_acceptance --check` no problems, daily check green; live: the old `car_01_gt.glb` (519 KB) loads, no ambience, horn present, 4 vehicles, G exits and re-enters.
For the other stream: Anshul's Claude: your rebuilt cars, ride height, engine configs, atmosphere sound and moon are still on your branches (`release/combined`, `vehicle/cars-on-main`, `vehicle/cars-and-gears`) and are NOT in main. Do not merge them back into main as they are. The owner decides case by case: put each as its own small PR (cars; engine sound; atmosphere) with a short description and a before and after (screenshots, a recording of the sound), and wait for the owner's yes for each one. Update B1 and B2 in `docs/NEXT_PHASES.md` to match (B1 is now: open the car PRs one by one for approval, not a merge).

Status: open

## 2026-11-18 11:00  A-2026-11-18-14: loading stuck on "Starting the physics": engine starts first, never waited for forever, stuck screen has a way out (live c2237bce)
Branch: perf/start-order (PR)  Commit: see the PR (deployed)
What changed: the owner reported the loading bar not moving past "Starting the physics". That label shows until the physics engine (Rapier, a 2 MB wasm module) is ready, and `src/main.js` only started it after all the map and world building, and `setVehicle` waited on it with no limit. Now: (1) `rapierStart = initRapier()` runs at the top of `main.js`, so it loads and compiles while the map and world are built; (2) the wait has a 25 s limit and an error path that sets the flag too: after that the simple physics (`?phys=old`) is used and the bar moves on; (3) `index.html` watchdog: after 25 s on any stage it says which stage, the last console warning or error text, and offers Reload and "Try simple physics". Measured here (fast machine, new bundle cold): ready in 6.3 s, the "Starting the physics" stage no longer appears; `?phys=old` ready in 2.4 s. Not verified: the owner's device (cause unknown: slow wasm compile, memory, or a network stall); a real phone.
For the other stream: Anshul's Claude: B9 (real phone): record on the phone which stage the loading bar shows longest and the watchdog text if it appears; B8/B10: the world build before the first frame is one long synchronous block: split it into frame-sized steps.
Status: open

## 2026-11-18 10:00  A-2026-11-18-13: faster cold start: parallel preload, gzip terrain grid, loading screen no longer waits for the trees (live 70190b50)
Branch: perf/faster-start (PR)  Commit: see the PR (deployed)
What changed: the owner reported the browser load as too slow. Measured a cold India load in the built-in browser (a slow link, about 0.5 MB/s): `dist/game.js` 1.3 MB, then `terrain.bin` 3.3 MB (the host does not compress `.bin`) started only after the script ran, then the world files one after another, and the loading screen also waited for the tree assets; the page was still loading at 40 s. Fixes: (1) `index.html` preloads the first files at once with `<link rel=preload as=fetch>` (India map: skeleton, rails, trains, terrain; Delhi start: city pack files), (2) `assets/india/terrain.bin.gz` (1.37 MB, 41 percent of the size) loaded by new `src/core/gzfetch.js` (`fetchGrid`, falls back to the plain file; self-test added, 113 checks), `tools/build_india_grids.py` writes it, the stage script and daily check know it, (3) `src/main.js`: the loading screen no longer waits for scenery (`scenery: true` at start; the trees appear when loaded, the code already supported that). Result, same slow link: India ready in 13.5 s (was over 40 s), terrain fetched once and starting at 0.45 s. Delhi start still takes long on that link (the 14.6 MB city graph is 3.5 MB compressed, plus tiles, models and the NPC files). Not changed: the car, traffic pack and NPC models (the host does not compress `.glb` either: `car_01_gt.glb` 0.86 MB would be 0.33 MB gzipped).
For the other stream: Anshul's Claude: further speed items for B8 and B10: lazy city graph (decode in a worker, B10), gzip the `.glb` files the same way as the terrain (a small `fetchGz` for GLTFLoader), Brotli the bundle at deploy so the first request at each Cloudflare location is small.
Status: open

## 2026-11-18 09:00  A-2026-11-18-12: deployed Anshul's release/combined merged with main (version 3649f3ad); his B1 to B13 and phase tasks not started yet
Branch: integrate/release-combined (PR)  Commit: see the PR (deployed)
What changed: checked Anshul's Claude's progress at the owner's request: no task mark in `docs/NEXT_PHASES.md` has changed, nothing new on `main`; his last push (20:52) came before the assignments and holds a DEPLOY REQUEST for `release/combined` (his cars Ember RS and Dust Runner, rebuilt models, ride height, moon, birds and crickets, cartoon NPCs, animated exit from the car). That branch was 28 commits behind `main` (deploying it as it was would have removed the home-screen app, bundle, prefetch, horn and PRs 83 to 89 from the live site), so `origin/main` was merged into it: two conflicts only, `src/audio/engine.js` (kept his sport and rally engines and his `ambience()`, added the horn and Delhi street bed) and `src/main.js` (kept both sound lines). Self-test 112, `vehicle_acceptance --check` no problems found, daily check green. Deployed to the owner's account from the merged branch: live checks in the built-in browser: Delhi loads from the bundle, no errors, G exits the car and G gets back in (drive, foot, drive). Not checked: how the animation looks, how the new cars drive, a real phone.
For the other stream: Anshul's Claude: this covers most of B1 (cars on main's vehicle system) once the PR is merged; mark B1 `[~]` or `[x]` yourself after a person has driven each vehicle, and continue with B2 onwards. Your deploy request is done by this entry.
Status: open

## 2026-11-18 08:00  A-2026-11-18-11: Delhi phases P1 to P8, look steps L1 to L6 and N17 to N20 assigned to Anshul's Claude, to be worked in blocks
Branch: docs/assign-delhi-n17  Commit: see the PR
What changed: at the owner's request (Rajul's session limit has ended) `docs/NEXT_PHASES.md` has a new section "Assigned to Anshul: Delhi phases ..." with tasks P1 to P8, L1 to L6 and N17 to N20, each with its "done when" line from `docs/DELHI_POLISH_PLAN.md`. `docs/DECISIONS.md` and `CLAUDE.md` record the ownership override: for these tasks Anshul's Claude may edit the Stream A (world) files. The tracker's open phase items (P and L) are re-assigned to Anshul's Claude and the roads-out-of-Delhi item is marked done (PR 85 merged).
For the other stream: Anshul's Claude: finish B1 to B3 first, then work the blocks in order: Block 1 P1, P2, P3, L1, L2; Block 2 P4, P6, L3, L4; Block 3 P5, P7, L5, L6; Block 4 P8; Block 5 N17 to N20 (design note first; only after P8 is judged and the owner says go). One phase at a time, each its own PR with: the done-when line met, a measured frame cost before and after (`?play&city=delhi&q=med&bench=30`), screenshots, selftest and daily check green, a log entry, the mark in `docs/NEXT_PHASES.md` changed, `node tools/build_tracker.mjs` run. Stop and report to the owner at the end of each block. Phases that need a person (photos, a Delhi reader, devices) stay open on that line. First task of P2: put the scripted street-driving test into `tools/`. Never merge or deploy without the owner's word.
Status: open

## 2026-11-18 07:00  A-2026-11-18-10: TASKS B1 to B13 assigned to Anshul (docs/NEXT_PHASES.md, "Assigned to Anshul")
Branch: docs/assign-anshul  Commit: see the PR
What changed: at the owner's request the next phases are now a numbered task list for Anshul and his Claude, with an acceptance line each, in `docs/NEXT_PHASES.md` under "Assigned to Anshul". `tools/build_tracker.mjs` reads that section, so every task shows on the tracker's Rajul and Anshul tab and the Assigned tasks tab, and the marks `[ ]`, `[~]`, `[x]` set their status.
For the other stream: Anshul's Claude: work B1 to B13 in order (B1 finish and PR `vehicle/cars-on-main`; B2 port the steering and grip feel as tuner settings; B3 retire the old branch; B4 NPC provenance; B5 review `runtime.js` and `onfoot.js`; B6 ask the owner the Lite/Full questions; B7 no-reload city switch; B8 cut Mumbai draw calls; B9 real-phone benchmark (needs a person); B10 router off the main thread; B11 tile cache budget; B12 close your old log entries; B13 deploy to the owner's account). When a task changes, change its mark in `docs/NEXT_PHASES.md`, run `node tools/build_tracker.mjs`, log it in `team/stream-b.md`. Shared files (`src/main.js`, `tools/selftest.mjs`, `tools/stage_cloudflare.py`): reserve first. Never merge or deploy without the owner's word.
Status: open

## 2026-11-18 06:00  A-2026-11-18-09: PRs 83 and 85 merged; NEXT PHASES for Anshul's Claude (docs/NEXT_PHASES.md); your branch not merged
Branch: docs/next-phases  Commit: see the PR
What changed: at the owner's request PR 85 was merged into the audit-fixes branch (conflicts in `main.js` and the log resolved; the prefetch kept in `updateGateExit`) and PR 83 was merged into `main` (self-test 112, daily check green). I tried `vehicle/cars-and-gears` into `main`: 14 files and 42 hunks conflict, and main and your branch carry different driving models, so I stopped and aborted; nothing of yours was changed. New `docs/NEXT_PHASES.md` lists the order of work. Tracker: PR rows 83 and 85 set to merged, three clashing item ids made unique, a next-phases item added.
For the other stream: Anshul's Claude: start from `docs/NEXT_PHASES.md`. Phase 1 is merging `origin/main` into `vehicle/cars-and-gears` (what to keep from each side is listed there), then the rest in order. The owner's session limit has ended, so nothing in it can wait on the owner except what is marked as a person's job.
Status: open

## 2026-11-17 19:30  City map: the roads out of Delhi, an Other cities list, the destination carried into the India map
Branch: claude/city-exits  Commit: see the PR
What changed: the owner asked how to get from Delhi onto a highway and to another city: the gates were mapped to highways but the city map did not show it. `src/ui/citymap.js` (Stream B-style UI, owner's request): every green gate pin now carries a label `To <next city> \u00b7 <NH or road name>` (always drawn), an `Other cities` button lists the 97 cities reachable from Delhi with the distance and the exit (a tap routes you to that gate), the title reads `To Mumbai (To Jaipur \u00b7 NH48): 45.6 km`; `src/world/city/gates.js` `gateForCity()` (the gate on the first road of the shortest route, else the gate pointing most nearly toward the next city: the Delhi-Kolkata road shares the southern exits with the Agra road, so Mathura and Kolkata had no gate of their own); `src/main.js` (shared, small): `wireGates()`, the chosen city travels through the gate as `&nav=<city id>` (`updateGateExit` and `leaveCity`), and the India map starts its GPS toward it (`startNav`, 'Navigating to Mumbai', '-> Mumbai (1105 km): keep on this road'); `tools/selftest.mjs` 108 checks (every gate joins a highway toward a known city; all 97 reachable cities have an exit: Agra 52, Jaipur 20, Kanpur 14, Ambala 10, Dehradun 1). Seen in the browser: the Other cities list, a route to the Jaipur NH48 exit, driving out of the nh48-south-16 gate, and the India map's navigation to Mumbai. Not done: the exit from the India map back to a city through another city's gate is unchanged; gates are only labelled in the city map (no signs in the 3D world); gate mapping by direction is approximate for gates with a poor score (nh9-west-20, nh9-east-21).
For the other stream: nothing.
Status: open


## 2026-11-18 05:00  A-2026-11-18-08: deployed version b6be7032 (bundle, prefetch, Anshul's cartoon NPCs) to the owner's account
Branch: claude/audit-fixes (PR 83)  Commit: 30c799e (deployed)
What changed: deploy only, from a scratch copy (stage, `tools/bundle.mjs`, `wrangler@4 deploy`, account `mailrajulsingh.in@gmail.com`). Live checks in the built-in browser: India title ready in 2.3 s (68 requests), Delhi city loads from `dist/game.js` with 6 tiles, the three small NPC models (0.83 MB) load, no failed requests on the page. Not checked: whether cartoon walkers appear and animate (none were in view at the start), a real phone, flyover traffic.
For the other stream: nothing new.
Status: info

## 2026-11-18 04:00  A-2026-11-18-07: Anshul's cartoon NPCs merged into the audit-fixes branch; status of his other branch
Branch: claude/audit-fixes (PR 83)  Commit: see the PR
What changed: at the owner's request `origin/vehicle/npc-models` (cartoon pedestrians, `src/pedestrians/pedestrians.js` and `assets/npc/`) is merged into this branch (clean merge). The game loads only the three small `_lod1` models (about 0.85 MB), not the 2 MB ones. `assets/ASSETS.md` now credits `npc/` (daily check needed it) and `licenses.html` is regenerated; the credit says the Blender script `dev/build_npc_stylised.py` is not in the repo and the base mesh is not recorded. `vehicle/cars-and-gears` (rebuilt cars, steering and grip, atmosphere sound, adaptive resolution, `docs/LITE_AND_FULL_PLAN.md`) is NOT merged: it conflicts with this branch in 10 files (`main.js`, `menu.js`, `controls.js`, `radiowheel.js`, `defs.js`, `rapier-vehicle.js`, `vehicle.js`, `selftest.mjs`, `stage_cloudflare.py`, `stream-b.md`).
Re: Anshul's PROPOSAL (Lite and Full): still open, the owner has not answered the four decisions. His adaptive resolution duplicates the frame-time governor already in `main.js` (`gov`). `validate_city` passes on this branch (his note says it fails on main).
For the other stream: Anshul's Claude: (1) commit `dev/build_npc_stylised.py` and say where the NPC base mesh came from (licence); (2) merge `origin/claude/audit-fixes` (or main once PR 83 merges) into `vehicle/cars-and-gears` and resolve the 10 files before anything else; keep the home-screen app (`index.html`, `sw.js`, `manifest.webmanifest`), the horn and street sound in `engine.js`, and the bundle step in the deploy.
Status: open

## 2026-11-18 03:00  A-2026-11-18-06: city and highway flow v1: the other world's files are prefetched, so the switch is quick
Branch: claude/audit-fixes (PR 83)  Commit: see the PR
What changed: new `src/world/prefetch.js` (each file once, one at a time, low priority, nothing on a save-data connection, a failed file is retried later; self-test added, 111 checks). `src/main.js` (shared, 3 small lines, plus the import): on the India map within about 300 km of Delhi the Delhi pack files (`graph.json` 14.6 MB and the small ones) are fetched into the browser cache; inside Delhi within 800 m of a gate the India files (skeleton, rails, trains, terrain) are. The switch is still a page load behind the black fade (the two worlds are different scales and `main.js` builds one world at boot), but it now finds its files on the device; with the bundle the scripts are one cached file. A true in-place switch with no reload needs the world set-up in `main.js` made re-runnable (the `cityMode` constant is used in about 30 places): that is v2, best done after PR 85 lands, as a separate step.
Overlap with PR 85 (`claude/city-exits`): it also edits `src/main.js` (gates, `startNav`) and `src/ui/citymap.js`; my edit is in `updateGateExit` and the `enterBtn` line, so expect a small conflict: keep both sides.
Not verified: the prefetch trigger on a real drive (the map is 1:100 and the built-in browser cannot drive 300 km); the live copy has the first version of the trigger (8000 map metres, about 800 km): the corrected 3000 is in the repo but not deployed, because the Cloudflare sign-in on this machine expired (`npx wrangler login` needed).
For the other stream: nothing.
Status: info

## 2026-11-18 02:00  A-2026-11-18-05: deploy now bundles the scripts (cold start: 142 script requests down to 1)
Branch: claude/audit-fixes (PR 83)  Commit: see the PR (live: version f9d20b6c)
What changed: `tools/bundle.mjs` ran with the owner's go-ahead (esbuild 0.24.2 fetched by npx). Live page: 44 requests instead of about 200, one `dist/game.js` (3.7 MB, 1.3 MB gzipped); India title ready in 5.5 s and Delhi in 3.2 s in the built-in browser (warm asset cache; the earlier Delhi start there took about 40 s). `?src=1` loads the unbundled source game (checked, 149 script requests). `CLAUDE.md` "Where deploys go" now includes the bundle step. The source files are unchanged; only the staged copy is bundled. Not verified: a real phone or a cold cache on a slow network.
For the other stream: Anshul: when you deploy, include the bundle step (`CLAUDE.md`).
Status: info

## 2026-11-18 01:00  A-2026-11-18-04: "stuck on Building the world" and slow start: error screen, no service worker on iPhone, bundle tool (not run)
Branch: claude/audit-fixes (PR 83)  Commit: see the PR (live: version 37d2a99f)
What changed: the owner reported the live game stuck on "Building the world" on a phone and not opening on a desktop; I could not reproduce it (it opens in about 5 s in the built-in browser). That text is the page's own placeholder, so the game script never started on their device. `index.html`: a boot watchdog shows the first error (or "Still loading after 25 s" and a Reload button that also clears the service worker and caches) on the loading screen, so the cause can be read off a phone. `src/ui/install.js`: iPhone gets no service worker and any earlier one is removed. New `tools/bundle.mjs`: deploy-time esbuild bundle (142 script files, about 1.7 MB gzipped, to one file; `?src=1` keeps the unbundled game), **written but never run**: the sandbox refused the esbuild download, so it is not wired into any deploy and is untested.
Not verified: the cause on the owner's devices; the bundle. For the other stream: nothing.
Status: info

## 2026-11-17 23:50  A-2026-11-17-04: phone layout, sound, Add to Home Screen, tuner set up, handoff and tracker updated
Branch: claude/audit-fixes (PR 83)  Commit: see the PR (live on the owner's Cloudflare account)
What changed: **phone** (the owner sent a screenshot): `src/ui/railboard.js` (small strip with two trains on a short screen), `index.html` (nothing from the road shows through a menu; compact title menu on a short screen; round map under the speed readout), seen in an emulated 740 x 340 phone. **Sound:** `src/audio/engine.js` (`horn`, `cityBed`), `src/input/touchui.js` (Horn button), `src/main.js` (key K, Delhi street bed, iPhone unlock on touchend and click, `navigator.audioSession`, resume on return). **App icon:** `manifest.webmanifest`, `sw.js`, `assets/icons/`, `src/ui/install.js`, a button in `src/ui/menu.js`; `tools/stage_cloudflare.py` stages them. **Tuner:** KV `SETTINGS` created on the owner's account and its id is in `cloudflare/wrangler.jsonc`; the Publish password is set as a secret (not in the repo). **Docs:** `HANDOFF.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/WORK_REMAINING.md`, `CHECKLIST.md` (4 new manual checks), and the tracker (`tracker/public/index.html`, redeployed; the other session's four edits for PR 85 were folded in). Line endings kept (`index.html` and `engine.js` are CRLF).
Not verified: a real phone (frame rate, sound, the icon opening full screen), the flyover traffic. Mumbai at the low tier is about 800 to 1000 draw calls: next cost cut.
For the other stream: Anshul: nothing new. If you deploy to your own account, the KV id in `cloudflare/wrangler.jsonc` is the owner's: your account needs its own (`CLAUDE.md`).
Status: info

## 2026-11-17 18:30  Tracker deployed to the owner's Cloudflare account; PRs 76 and 77 merged
Branch: claude/tracker-cloudflare  Commit: see the PR
What changed: the tracker Worker is deployed at https://game-for-peace-tracker.mailrajulsingh-in.workers.dev on the owner's own account (mailrajulsingh.in@gmail.com; wrangler there is logged in as the owner; Anshul's account was not used or touched; the game's own site and `cloudflare/public` were not touched). KV namespace `TRACKER` created, secret `TRACKER_PASSWORD` set (the owner has it; not in the repo), `run_worker_first` so every response carries `x-robots-tag: noindex`. Live checks: page 200, API 401 without or with a wrong key, 200 with it, a write and read and delete round trip through the real KV. Also: PR 76 (docs) and PR 77 (infill, loading screen) merged after resolving conflicts in tilemesh.js, cityworld.js, selftest.mjs and this log (self-test 107); looked at in the game: default start 358 calls and 300k triangles (infill adds about 88 calls), Karol Bagh 494k. The page text of the tracker is public; only the saved ticks and remarks are behind the password (Cloudflare Access would protect the text too).
For the other stream: nothing to do; to update the tracker run `cd tracker && npx wrangler deploy` while wrangler is logged in as the owner.
Status: open

## 2026-11-18 18:00  Tracker page: source in the repo, a Cloudflare Worker copy prepared (NOT deployed)
Branch: claude/tracker-cloudflare  Commit: see the PR
What changed: new folder `tracker/` (nothing else touched, not `cloudflare/public`): `public/index.html` (the owner's checklist: checkboxes, status, remarks and comments on every item of the plan, N0 to N20, backlog, limits, technicals, docs; the same file is a claude.ai Artifact where state is kept by the Artifact's db, and on Cloudflare uses `/api/tracker`), `worker.js` (serves the page, keeps state in KV, every call needs the shared password in `x-tracker-key`, the Worker secret `TRACKER_PASSWORD`; merge by newer `at`; 256 KB body cap; noindex), `wrangler.jsonc` (a separate Worker `game-for-peace-tracker` with a KV binding `TRACKER`), `README.md`. Checked: the Worker logic with a mock store (auth, 503 when unset, merge, delete, caps) and the page in Cloudflare mode against it in the browser (unlock, tick, remark saved on the server, kept after reload).
For the other stream: Anshul or the owner deploys it once; steps in `tracker/README.md` (`npx wrangler whoami`, `kv namespace create TRACKER` and paste the id into `wrangler.jsonc`, `secret put TRACKER_PASSWORD`, `wrangler deploy`). It does not touch the game's Worker.
Status: open

## 2026-11-18 12:00  Delhi P1 first increment: infill buildings along the block frontage, the loading screen waits for the city
Branch: claude/delhi-p1-infill  Commit: see the PR
What changed: new `src/world/city/infill.js` (pure, generator: rows of lots along the edges of the built-up blocks, 1 to 3 rows by area style, set back from the carriageway and its pavement by the nearest street's width, never on a street, park, water, mapped building or another lot, 25 m clear of the tile edge; deterministic; 20 to 80 ms a tile, spread over frames), `tilemesh.js` (infill buildings are appended to `tile.buildings` so streetlife, claims and wall circles treat them like the pack's; own meshes `infill` and `infillShop`, one quad a wall, no roof tanks), `cityworld.js` (`CELLED` 250 m, visible within 520 m, no shadows; `?noinfill` turns it off), `src/main.js` (shared: `whenCityReady()`, the loading screen waits for 5 tiles or all near ones, 20 s at most; before it dismissed on bare plains), `tools/selftest.mjs` (106 checks). Measured: coverage of mapped plus infill in the sampled tiles from 6 to 19 percent to roughly 15 to 30 percent (the map data allows lots only along streets; interiors of big blocks stay open); frame at the default start 260 calls and 209k triangles (was 268 and 242k), in dense Karol Bagh 250 calls and 357k. Area styles use `identity.json` area names with a table in `infill.js` (Old Delhi 3 rows and tall, Lutyens 1 low row at 10 percent). This is Phase P1 of `docs/DELHI_POLISH_PLAN.md` (PR 76): update its status line when that merges. Not done in P1: interiors and forecourts of large blocks, plazas, per-area facade variety (P3), phones.
## 2026-11-18 11:00  Delhi scale check and the phased polish plan (docs only)
Branch: claude/delhi-scale-plan  Commit: see the PR
What changed: new `docs/DELHI_POLISH_PLAN.md` (measured scale table, phases P1 to P8, N0 to N20 status), a pointer in `docs/OVERALL_PLAN.md`. No code. Finding: lane, storey and street widths and the car are the right scale; the city looks empty because building coverage of a 1 km tile is only 6 to 19 percent (OpenStreetMap has gaps), roads have no medians or junction shaping, facades repeat.
## 2026-11-18 13:00  Connaught Place: the Central Park is an open park again; buildings take their area's wall colours
Branch: claude/delhi-cp-accuracy  Commit: see the PR
What changed: `landmarks/plans_modern.js` (the `connaught-place` model drew a white colonnade ring on the OUTLINE of the landmark footprint, OSM way 164675825, which is the Central Park in the middle of the Inner Circle, so a solid white wall stood where the park is; now it draws only the park: lawn, crossing paths, the plaza over Rajiv Chowk, the great flag; the colonnaded blocks are the ordinary mapped buildings of the ring outside the Inner Circle road), `tilemesh.js` (ordinary buildings, residential, commercial, retail and other, take their wall colours from the identity area: CP white, Lutyens cream, Old Delhi sandstone; before, `identity.json` walls were not used for buildings), new `tools/audit_city.mjs` (large buildings mostly on parks: 54 in the pack; stadiums and sports complexes are expected; others to look at: connaught-place (this fix), purana-qila 5,237 m2 residential 16 m over a park, humayuns-tomb, transit polygons in parks at tiles 2_-5, -12_6 and 9_0, a 24,772 m2 civic block over Chhatrasal Stadium). Seen in the browser: from the Inner Circle road and in the park. Google Maps data was not used (its terms forbid copying or building a dataset from it); the base stays OpenStreetMap. Not done: colonnades on the CP ring buildings (P3), the other audit hits.

## 2026-11-18 17:00  Where am I (menu coordinate line), the map-wide audit, generation rules; the zebra rule fixed
Branch: claude/where-and-rules  Commit: see the PR
What changed: (1) `src/main.js` `where()` and `window.__where()`, `src/ui/menu.js` `whereLine()` (a Stream B file, the owner asked): every menu screen has a bottom line with real latitude and longitude, game x and z, heading, the place, the street and its class, the area and the nearest landmark, with a Copy button. In a city lat and lon are the inverse of `projectLL` from the pack origin, in the India world from the game frame. (2) `tools/audit_city.mjs` (replaces the first version): scans all 1,925 Delhi tiles in 2 seconds for five classes with lat and lon of each hit: park_building 30, street_building 119, void_block 4,684 (mostly at the edge of the data, outside Delhi; the list is sorted by distance from Connaught Place), landmark_offset 3, footway_run 94; `--write` makes `docs/CITY_AUDIT.md` and `tools/city_audit_baseline.json`; selftest fails when a class gets worse. (3) `src/world/city/rules.js` (pure): rules that fix a class everywhere: a transit block 40 percent or more on a park is not extruded, a mapped building that a ground road runs through for 15 m or more is not drawn (landmarks are kept); tilemesh asks it per tile. (4) `tilemesh.js` zebra rule fixed after the owner's screenshot (Kashmere Gate ISBT plaza): a footway is a zebra only where it crosses a carriageway at 40 degrees or more over 16 m or less; a footway lying inside a carriageway and not crossing it is not drawn (it showed as tan and white strips on the asphalt); service lanes (under 3 m half width) are not counted as roads. (5) selftest 106 checks (one new). Not done: the 4,684 voids need the P1 infill (PR 77, not merged); pink balls on the ground are bougainvillea shrubs under flyovers (round magenta crowns without a trunk); landmark_offset listings (delhi-zoo, jln-stadium, anand-vihar-isbt) not corrected; the audit covers data classes, not looks (flicker, textures).
For the other stream: `menu.js` has a new bottom line on every screen.
Status: open

## 2026-11-18 16:00  Delhi look, step 2: junction shaping (rounded corners, kerb arcs, filled bends)
Branch: claude/delhi-junctions (on claude/delhi-look-roads, PR 80)  Commit: see the PR
What changed: `tilemesh.js` only: `junctionShapes()` and a record of every ground road end (`addJ`, grouped by node). For each node with 2 or more ground roads, taken in order round the node: where two neighbouring roads meet at under 180 degrees the corner gets a fillet (asphalt between the two road edges and an arc of radius 3 to 7 m tangent to both, a 12 cm kerb along the arc, a 1.8 m pavement ring outside it); on the outside of a bend (over 180 degrees) the notch is filled with a triangle. Roads are still rectangles ending at the node, so the fillets are additive; none is drawn where a piece is shorter than twice the tangent length. Seen in the browser at a T junction. Cost: about +32k triangles in the loaded area at q=med (224k to 256k; most of it is in the pavement and kerb meshes, which are cut into 250 m cells and hidden beyond 450 m). Not done: junction patches and stop lines at big signalled junctions, lane arrows, road wear, the kerb arcs have no collision (kerbs are not walls anyway), nodes on tile edges only get the pairs of roads that lie in the same tile, no self-test for the geometry yet.
For the other stream: nothing.
Status: open

## 2026-11-18 15:00  Delhi look, first step: real asphalt and paving textures on the city's roads and pavements
Branch: claude/delhi-look-roads (on claude/delhi-flicker, PR 79)  Commit: see the PR
What changed: `tilemesh.js` (`TEX_ROAD` 5 m and `TEX_WALK` 4 m, both divisors of 1000 so tiles meet; road and pavement strips get world-space UVs; `makeMaterials` builds `road` and `walk` from `assets/roads/asphalt_*` and `pavement_*` (colour, normal, roughness maps, already in the repo for the India map) with the vertex colours kept as a tint (`color` 2.6 and 1.55) and the same depth offsets). Before, every road and pavement in the city was one flat vertex colour. Seen in the browser at the default start: grain, patches and paving. Cost: none measurable (257 calls, 224k triangles at q=med). Tried and not enabled: `?fx=1` (ambient occlusion, bloom) adds contact shadows and a warmer grade but made each frame very slow in the browser pane. Not done (the owner compared with a GTA V frame: roads, junctions and proportions look basic): junction shaping (rounded corners, kerb radii), road wear and lane arrows, facade relief, real trees and props, car and traffic models, grade and lighting; see the look plan in the PR.
For the other stream: nothing.
Status: open

## 2026-11-18 14:30  Delhi flicker, the grey rectangles: footways crossing a road are now zebra crossings (added to PR 79)
Branch: claude/delhi-flicker  Commit: see the PR
What changed: `tilemesh.js` only: a footway or cycleway is drawn grey (pavement colour, +5.5 cm) where it runs beside streets, and where it crosses a carriageway (checked with `mouthFree` on the street's own samples) it is drawn as white zebra bars across the road (0.9 m pitch, markings layer) instead of a grey slab. The owner's screenshot showed light grey rectangles across the road in front of the car that flickered: they were footway strips lying in the road's own plane (64 such crossings within 500 m of the default start; the nearest 9 m ahead of the start). Seen in the browser: the crossing at the default start. Side-street mouths: the pavement strip of the main street now lies under the side street's road (3 cm under 5 cm) instead of in its plane.
For the other stream: nothing.
Status: open

## 2026-11-18 14:00  Delhi flicker: ground layers get real height steps, the city stands 30 cm off the terrain, a 1 m near plane in chase views
Branch: claude/delhi-flicker  Commit: see the PR
What changed: `tilemesh.js` (`LIFT`: ground 0, parks and water +1.5 cm, pavement +3 cm, road +5 cm, markings +7 cm; they were all at height 0 and told apart only by polygon offsets, which shimmer with distance), `cityworld.js` (`gy` = engine terrain + 0.3 m: the city's ground and the engine's own flat terrain were one plane), `src/main.js` (shared: `setNear()`, in a city the camera's near plane is 1 m unless the camera is on or in the car (0.3 m): depth precision at 300 m to 1 km is about three times better; the far plane stays 14 km). Measured in the browser by shifting the camera 2 to 5 cm and counting pixels in flat areas that change colour: chase view 1.04 to 0.89 percent, low view 0.97 to 0.57, high view 0.205 to 0.024; what is left is silhouette edges (painted red: only flyover parapets and piers). A still camera while game time advances: 0 percent, so no shadow-map or draw-order flicker with a still view. Not reproduced: the flicker the owner saw while driving (grass and road parts); if it persists it may be shadow edges moving with the car, distance cut-offs of the near-detail meshes (350 to 450 m), or the engine terrain, none tested while moving. To tell them apart: `&shadows=off`, `&noinfill`, `&life=off`.
For the other stream: nothing.

## 2026-11-18 23:00  A-2026-11-18-03: DEPLOY RULE CHANGE: deploys now go to Rajul's Cloudflare account; first deploy done
Branch: claude/audit-fixes  Commit: a0f9a8f (deployed)
What changed: owner decision. The latest build (audit fixes v1 to v4 on top of main) is live at https://game-for-peace.mailrajulsingh-in.workers.dev (Rajul's account, `mailrajulsingh.in@gmail.com`, version `17594f28`). Deployed from a scratch copy, so `cloudflare/public` is untouched. `CLAUDE.md` and `HANDOFF.md` now say: from now on new versions deploy on Rajul's account, and **Anshul's account keeps the older original versions (`/` and `/next` on game-for-peace.anshul-rawat.workers.dev): do not deploy over them.** Checked live in a browser: the India game and `?play&city=delhi` (Connaught Place) load, `terrain.bin` and the attribution file are served; the only console errors are `/api/settings` 503 and `settings.json` 404 (the tuner's KV setup is not done on this account, as before). The Delhi city takes about 40 s to start in the test browser. Not checked: phones, the flyover traffic (v4), sound.
For the other stream: Anshul's Claude: do not deploy to or change Anshul's Cloudflare account for new versions; the deploy steps are in `CLAUDE.md` ("Where deploys go"). Nothing else.
Status: open

## 2026-11-18 22:00  A-2026-11-18-02: v4, ambient traffic on flyovers, ramps and underpasses (R14, owner said yes)
Branch: claude/audit-fixes  Commit: see the PR
What changed: `citytraffic.js` takes every layer up to 3 up or down (was ground only); each car has a height `h` from `deckHeight` / `underDepth`, is drawn at it, follows a piece to the next only at the same level, sees only cars (and the player, from the new `py` argument) within 3 m of its own height, and its obstacle circles carry that height so the physics already ignores the other level. `citypeds.js`, `citybus.js` ignore cars on another level; `cityworld.js` and `main.js` pass the player's height. Parked cars stay on the ground.
Not verified: **not run in a browser** (the local server was refused), and no headless test can build `CityTraffic` (it needs three.js). Needs a person: drive up a Delhi flyover and through an underpass with traffic on, and watch for cars floating, cars stopping for the level below, and cars turning onto the wrong level at ramps. Anything wrong: revert `citytraffic.js` hunks marked R14.
For the other stream: nothing.
Status: open

## 2026-11-18 20:00  A-2026-11-18-01: audit fixes v1 to v3 (random streams, tile back-off, routing measurement)
Branch: claude/audit-fixes  Commit: see the PR (not merged, nothing deployed)
What changed: v1 `citytraffic.js`, `citypeds.js`: each owns a seeded random stream (`this.rnd`), no module-level generator (R15). v2 `cityworld.js`: a failed tile is asked for again after 1 s, 2 s, 4 s ... up to 30 s (R10 in part). v3 new `tools/measure_city.mjs`: graph parse 41 ms and city routes 80 to 140 ms on a desktop (`docs/STATUS.md`). Also merged the newest `main` (PRs 78 and 82); the selftest is 109 checks. Not verified: no browser run (the local server was refused), and no test constructs `CityTraffic` or `CityPeds`, so v1 and v2 are syntax-checked and covered only by the existing 109 checks.
For the other stream: nothing new.
Status: info

## 2026-11-17 22:00  A-2026-11-17-01: audit fixes (R01, R04 to R07, R11, R16 to R19), docs and rules edited
Branch: claude/audit-fixes  Commit: see the PR (not merged, nothing deployed)
What changed: owner approved the independent audit's findings; answers in `docs/DECISIONS.md`, status in `docs/STATUS.md`. **Shared files touched (small):** `src/main.js` (sector `load` is all-or-nothing and rolls back on failure; `save()` shows one toast when a write fails), `tools/selftest.mjs` (+3 checks, 108 total), `tools/stage_cloudflare.py` (now stages `.bin`, `.txt`, `.wasm`: terrain.bin and the attribution files were missing from a release), `HANDOFF.md`, `OVERVIEW.md`, `PARALLEL_PLAN.md` (a banner pointing to `docs/STATUS.md`), `CLAUDE.md` (reserve shared files first, status words open/info/done, IDs, evidence fields). **Stream B files touched at the owner's request:** `src/core/runtime.js` (handles carry a registry/pool domain, a foreign handle no longer resolves; `droppedTime` counts clamped frame gaps), `src/player/onfoot.js` (swept capsule controller with `y0`/`y1` on obstacle circles; `chooseExit` now sees cars as obstacles). Also: `LICENSE.md` (all rights reserved for our own work), `tools/daily_check.py` (new stage-list check, honest about `git fetch`), `.claude/commands/sync.md` (stream from `git config user.name`), `docs/SHARED_SIM_PLAN.md`, `docs/OVERALL_PLAN.md` (N21 to N26, after Delhi), `docs/ONFOOT.md`, OSM2World licence label.
Self-test: 108 checks pass. Not done or not verified: the game was **not** run in a browser this session (a local server was refused), so `main.js` is only syntax-checked; R04's rollback has no headless test (main.js cannot be imported); the world does not yet give obstacle circles `y0`/`y1`, so the capsule treats every circle as a column; R02 (phones), R09, R10, R13 need measuring.
For the other stream: Anshul: when you next deploy, run `python tools/stage_cloudflare.py` from this branch's merge so terrain.bin and the attribution file go out; please review the `runtime.js` and `onfoot.js` changes (your files). Nothing else.

Status: open

## 2026-11-18 10:00  Delhi seen from the air: denser far city, no random trees, one ground tone
Branch: claude/delhi-aerial-look  Commit: see the PR
What changed: `cityworld.js` (`cityConfig`: the engine's own scatter has no trees or bushes in a city, they stood in empty plains and in the middle of nowhere beyond the pack; the three ground tones are one grey-tan so the terrain under and past the city has no pale green and peach blotches; the dense far ring `dense: bd < 2800` passed to the skyline), `skyline.js` (`MAX_DENSE` 650 boxes a tile and buildings from 90 m2 up in the first far ring, 260 and the old thresholds beyond it; most Delhi buildings are 9 m and under 700 m2, so the old far layer showed almost none). Frame at `?play&city=delhi&q=med`: 268 calls and 242k triangles (was 328 and 241k): the far layer is 35k triangles. Seen in the browser: a low aerial view out to the fog is now built-up; Purana Qila from above. Not changed, and true to the data: the Yamuna floodplain east of Purana Qila has few buildings in the pack and the pack ends at the NCR edge; the fog at altitude is white and starts at about 1.1 km; the detailed city loads 1.3 km round the CAR, not the free camera.
For the other stream: nothing.
Status: open

## 2026-11-18 09:00  Delhi is always the real city: no stylised Delhi on the India map, an Enter Delhi city button
Branch: claude/enter-delhi-button  Commit: see the PR
What changed: `src/main.js` only (shared, small). (1) The India map no longer builds the Delhi region's stylised street edge (`district`) or its stylised sidewalk people along the highway (`delhiRegion()`); the highway outside Delhi is open land. (2) A start in Delhi without a highway hand-over (a plain launch whose last city was Delhi, `at=delhi`, `?loc=delhi`) redirects into the real city at Connaught Place. (3) A new `Enter Delhi city` button on the India map within 80 km of Delhi (`enterBtn`, bottom centre) opens the city at its centre; driving into the 120 m zone on the highway still takes you in through a gate. (4) `entering`, `CITY_GATES` and `enterBtn` are declared at the top: the GPS code reads them while the world is built (a first try that declared them lower left the game stuck at Starting the physics; found by looking at the console). Seen in the browser: plain launch lands in Delhi at Connaught Place; `?loc=delhi` redirects; the highway at 260 m out has no buildings and shows the button. Not done: Mumbai, Agra and Bhopal still use the stylised street edge on the India map; the India map's own 1:100 Delhi is still just a point on the road.
For the other stream: nothing.
Status: open

## 2026-11-18 08:00  Title screen: Play India map and Explore cities; Delhi on the India map is the full city
Branch: claude/title-india-map-delhi  Commit: see the PR
What changed: `src/ui/menu.js` (Stream B file, owner asked: the title screen now has `Play: India map` first, then `Explore cities`, Garage, Settings, Travel; Play in a city or an explored place goes to the India map, in the India map it just starts), `src/main.js` (shared, small): (1) a plain launch is always the India map (before, the save remembered Delhi and a plain `?play` started inside the Delhi city); (2) the India map button inside Delhi (`leaveCity()`) leaves through the gate nearest the car onto its highway, the same hand-over as driving out; (3) Travel to Delhi and picking Delhi anywhere else opens the Delhi city pack (`goWorld('delhi')`), not the old stylised district; (4) the India map at Delhi starts `startAlong` = 260 m out on NH30 (it started at the city's own centre in the stylised district, a car park by the station, which is what looked messed up), past the 120 m zone that takes you into the city, so the `fromcity` / `skipEnter` blocks are gone: driving back toward Delhi enters the city again (tested: reaches a gate and reloads into the city). Seen in the browser: title screen, Explore cities > Delhi > India map > NH30 outside Delhi, drive back > city. Not done: the stylised district along the highway at 260 m is still the old procedural look (buildings beside the road); the 1:100 world around Delhi is not the real map.
For the other stream: `menu.js` title screen changed (button names and order only).
Status: open

## 2026-11-18 07:00  Delhi: building walls no longer stick out into streets; flyover piers are solid; gates start on the ground; props kept out of other streets (stacked on PR 71)
Branch: claude/delhi-stalls-pier (on claude/delhi-invisible-blockers, with PR 68 merged in)  Commit: see the PR
What changed: (1) `tilemesh.js`: building wall circles were 1.25 m wide centred 0.7 m inside the footprint, so every building had an invisible 0.55 m of wall in the street; now `WALL_R` 1.1 with the centre 1.1 m inside (the circle ends at the drawn wall). Wall intrusions into carriageways (circles reaching more than 0.35 m into a street, 143 streets near Connaught Place): 1,040 to 702; streets where a driven car stops: 7 to 5 (the rest are sharp bends in 5.6 m lanes with a scripted driver; not looked at by a person). (2) `tilemesh.js`: flyover piers (pack decks) are drawn but had no collision circle, so a car drove through them; they now push a 1.15 m circle. (3) `pack.js`: a gate start uses the nearest node that has a ground-level street (`degrees()`, `nearestNode(..., ground)`); before, a gate on a flyover (`nationalhighway24bypassflyover-east-1`) started the car on the ground under the deck among the piers; now 31 m on, on a road, seen. (4) `streetlife.js`: trees, poles and lamps are not placed in the carriageway of any street (`inRoad`; their own street is kept clear by their offset, a crossing street's was not): trees and poles in carriageways 84 to 8; stalls and kiosks are checked too but the count barely moved (that bucket is mostly cars and walls). Not done: building footprints that overlap the drawn street (the data: 702 circle intrusions), sharp bends in the narrowest lanes.
For the other stream: nothing.
Status: open

## 2026-11-18 06:00  Delhi: kerbs are no longer invisible walls (stacked on PR 70)
Branch: claude/delhi-invisible-blockers (on claude/delhi-shadow-cut)  Commit: see the PR
What changed: `src/world/city/cityworld.js` only: `KERB_WALL = false`, `near()` no longer hands the kerb circles (negative radius, 1.6 m, along every street edge) to the vehicle physics. They held the car to about 9 km/h at every kerb (13 of 14 streets tried: the car stopped at the kerb and crept), and the visible kerb is 15 cm. Pavements, plazas and open ground behind a kerb can now be driven onto; buildings, poles, stalls, piers, cars and people still block. Found by driving the real vehicle physics (`phys.step`) at a kerb on 24 streets: before, it stopped; after, 18 of 24 crossed (the rest are stopped by buildings or props); seen at 34 km/h onto the Jantar Mantar plaza. Also scanned: 148 streets driven end to end by a pure-pursuit script: 4 stuck (2 are other cars, 2 are narrow residential lanes where a street stall stands in the lane, ids 292416 and 292421 near (707,-1872) and (435,-1995)); ground height and deck collision on 12,945 street points: no invisible decks; wall circles on carriageways: 224 of 19,692 points, all small poles and props (0.3 to 1.3 m). Set `KERB_WALL = true` to bring the kerb walls back. Not fixed: the pier in front of the Ghazipur gate start; stalls in lanes too narrow to pass.
For the other stream: the two physics lines that skip kerb circles below 2.5 m/s (D5b) are now never reached in a city.
Status: open

## 2026-11-18 05:00  Delhi shadow cost: buildings cast only within 200 m, scenery casts none in a city (stacked on PR 69)
Branch: claude/delhi-shadow-cut (on claude/delhi-perf-cut)  Commit: see the PR
What changed: `cityworld.js` (`SHADOW_D` 200 m: a tile's buildings cast a shadow only when the tile is within 200 m of you; before 450 m, and the sun's shadow box is 140 m wide; scatter config `shadows: false` in `cityConfig`), `src/world/scatter.js` (one line: `castShadow = c.shadows !== false`; the default is unchanged, so the India world still has tree shadows). The shadow pass was 51 calls and 50k triangles of a 337 / 250k frame (measured by switching the shadow map off); now the frame is 328 calls / 241k triangles at `?play&q=med`, Connaught Place. Not seen: a building shadow at dusk (the browser pane did not redraw after a time change); tree and tuft shadows are gone in Delhi.
For the other stream: nothing.
Status: open

## 2026-11-18 04:00  Delhi frame cost: 610k to 250k triangles, 408 to 337 draw calls at the default start (q=med)
Branch: claude/delhi-perf-cut  Commit: see the PR
What changed: (1) `tilemesh.js` `Mesher.cells(size)` and `cityworld.js` (`CELLED`, `LOD_OF`, `flagMesh`): the near-detail meshes (pavements and kerbs, street furniture, markings, signs, banners, ads) are cut into 250 or 500 m cells, so the near-detail distance and the view culling work per cell and not per 1000 m tile (before, standing in a tile drew all its pavements and furniture, 280k triangles); per-kind distances (signs and banners 280 m, furniture 350 m, markings 400 m, pavements 450 m). (2) `src/main.js` (shared file, one line after `config.view = ...`): in a city the engine's own terrain, which lies flat under the city ground, uses 8, 4 and 4 cells per tile out to 4 tiles and a far ring out to 6 (it was 64, 32, 16, 8 cells out to 8 tiles and 9 far: 284k + 90k triangles of ground nobody could see). Measured in the browser at `?play&q=med` (Connaught Place), same camera: 408 calls and 610k triangles before, 337 and 250k after; the picture is the same by eye; at the Ghazipur gate 311 calls, 143k triangles, no gap at the edge. Not measured: a real frame rate or a phone; the shadow pass is still drawing every building of the nearest tiles (buildings are not cut into cells: it added more calls than it saved). Seen, not fixed: at the gate `nationalhighway24bypassflyover-east-1` a flyover pier stands directly in front of the start.

## 2026-11-18 03:00  Delhi: landmark starts were inside the landmark models; tiles were fetched twice
Branch: claude/delhi-spawn-and-tile-fixes  Commit: see the PR
What changed: `src/world/city/pack.js` only. (1) `start(id)` for a landmark now picks the nearest street node OUTSIDE the landmark footprint (`nearestNode(x, z, avoid)`); before, 38 of 63 landmark starts (e.g. `?at=new-delhi-station`, red-fort, connaught-place) were inside the footprint, and with the D8 models the car started inside a wall. Checked in the browser: all 63 starts are outside, New Delhi station start seen from the street. (2) `tile()` shares the raw tile JSON between the near city and the far skyline (a 64-entry cache): 62 fetches of 48 tiles became 48 of 48 at start. Not fixed: `/api/settings` and `/settings.json` answer 404 on the local server (only the Cloudflare worker serves them); the frame cost at the Delhi start (about 430 draw calls, 570k triangles at `q=med`) is unchanged and over the phone budget.

## 2026-11-18 02:00  D6c (first part): platform number boards at the railway stations
Branch: claude/delhi-d6c-platform-numbers  Commit: see the PR
What changed: `src/world/city/transit_rail.js` only (number atlas texture, board quads, dispose); `docs/DELHI_TRANSIT.md` section 4 note. Boards are numbered in OSM order, not the real platform numbers. Checked in the browser at New Delhi: 36 boards, 144 triangles, no console errors; not seen by eye (the pane renders black).
For the other stream: nothing.
Status: open

## 2026-11-18 01:00  D6b: stairs with escalators, fare gates, real railway coaches at the Delhi stations, sea moved below the stations
Branch: claude/delhi-d6b  Commit: see the PR
What changed: `transit_geo.js` (`flight`, `gates`), `transit_station.js`, `transit_underground.js`, `transit_rail.js` (two real rakes from `train_art.js` and `train_consist.js`), small hook in `cityworld.js` (`cityConfig`: sea at -30 m so it does not cut through the underground stations), `tools/selftest.mjs` (103 checks). Docs: `docs/DELHI_TRANSIT.md` section 11 (cost, what is not done), WORK_REMAINING D6b.*.
For the other stream: nothing.

## 2026-11-17 23:50  D8: Delhi landmark models (22 places built, 8 of them partly)
Branch: claude/delhi-d8-landmarks-d40d41  Commit: see the PR
What changed: new `src/world/city/landmarks/` (`index.js` manager, `kit.js` primitives and materials, `geo.js`, `plans.js` registry, `plans_axis.js`, `plans_mughal.js`, `plans_modern.js`). Shared files, smallest changes: `src/world/city/cityworld.js` (create `this.lmx`, call `lmx.update` each frame, pass `skip` to the tile mesher, add `lmx.circles` to `near`, `reposition`, `setNight`, `summary`), `src/world/city/tilemesh.js` (one line: a landmark with a model is not drawn as a plain block), `tools/selftest.mjs` (+1 check, 104), `tools/build_landmarks_doc.mjs` (appends `tools/city_data/delhi_model_status.md`, the status table, to `docs/DELHI_LANDMARKS.md`). The models are procedural (no files, no images), from each landmark's footprint box, yaw and height in `landmarks.json`; collision circles come back through `city.near`; name boards and info cards from the same record; keep-out claims for the extra ground. Measured (hidden pane, medium): at India Gate 411 draw calls and 364k triangles in view, the 22 models together about 150k triangles (largest: Red Fort 36k), a model builds in 0 to 26 ms (the Jama Masjid 90 ms once).
For the other stream: nothing to run. D7 and D6b: I touched no `streetlife*.js` or `transit*.js`; the railway station fronts (New Delhi, Old Delhi, Nizamuddin) are drawn by `landmarks/plans_modern.js`, platforms and canopies are still yours. A landmark with a plan is skipped by the tile mesher (`ctx.skip`), so its old label and plain block are gone; the model draws its own board.

## 2026-11-17 23:30  D7: street life and identity of Delhi (identity.json, shops, ads, vehicles, buses, people)
Branch: claude/delhi-d7-streetlife-29f2c5  Commit: see the PR
What changed: new `assets/cities/delhi/identity.json`, `src/world/city/{identity,streetart,streetlife,vehicles,citybus}.js`, `docs/DELHI_LOOK.md`; shared files touched with a few lines each: `tilemesh.js` (exports `Mesher`, one `yield*` call to `buildStreetLife`), `cityworld.js` (identity, art, buses, new mesh names, month haze, a crash guard in `updateFar` for empty far tiles), `citytraffic.js` (vehicle kinds replace the two boxes), `citypeds.js` (clothes, extra standing people), `src/pedestrians/pedestrians.js` (one line: `p.cloth` overrides the clothes colour), `tools/selftest.mjs` (104 checks).
For the other stream: nothing. `?month=N` and `?life=off` are new URL flags. Not deployed.
Status: open

## 2026-11-17 23:00  D6 merged with the D5b renderer (PR 62); Metro minimap uses the loaded transit data
Branch: claude/delhi-d6-metro-2b04f7  Commit: see the PR
What changed: merged origin/main into the D6 branch; conflicts in cityworld.js, main.js, selftest.mjs, this log resolved (both sides kept, 103 checks). `main.js` now gives `cityMap.setTransit(city.transit.data)` instead of a second fetch. Also since the first D6 entry: underground station interiors (`transit_underground.js`), platform stairs, round signs, railway rakes, walkable surfaces; see `docs/DELHI_TRANSIT.md` section 10.
For the other stream: nothing.
Status: open

## 2026-11-17 18:00  Delhi renderer fixes: city GPS, gate fade, underpasses, kerbs, performance, people, look
Branch: claude/delhi-d5b-fixes-fa289f  Commit: see the PR
What changed: new `src/ui/citymap.js`, `src/world/city/{citynav,gates,cuts,skyline,citypeds}.js`; `cityworld.js`, `tilemesh.js`, `citytraffic.js`, `pack.js` extended (graph `name`/`dn` columns, `underDepth`). Shared files, smallest changes: `src/main.js` (city map hook, autodrive on a route path, gate fade and carry, enclave save, camera floor in a city), `src/input/autodrive.js` (`lookMin`, `forward`), `src/vehicle/physics.js` and `rapier-vehicle.js` (`o.kerb` circles are skipped below 2.5 m/s), `src/world/network.js` (`worldStart(city, { road, toward })`), `src/core/saved.js` (`enclave`), `tools/selftest.mjs` (102 checks).
For the other stream: nothing required. Review the two vehicle-physics lines (kerb) and `autodrive.forward`. Deploy is still open from the D5b entry. Test in a visible browser window: `?play&q=med&city=delhi`, P for the map, pick India Gate, E for autodrive; `?bench=30&city=delhi` (needs a visible window).

## 2026-11-17 18:00  D6: Delhi Metro and railway stations drawn in the city enclave
Branch: claude/delhi-d6-metro-2b04f7  Commit: see the PR
What changed: new `src/world/city/transit_plan.js`, `transit_geo.js`, `transit.js`, `transit_station.js`, `transit_rail.js`, `transit_ui.js`; shared files touched with a few lines: `src/world/city/cityworld.js` (init, update, reposition, near, deck, summary), `src/main.js` (`city.transit.onTeleport`, `footY`, `__next.city`), `tools/selftest.mjs` (one new check, 100 now). Docs: `docs/DELHI_TRANSIT.md` section 10, CITY_PLAN, WORK_REMAINING D6.*, HANDOFF.
For the other stream: nothing to run. Press J near a Metro entrance for fast travel. Not deployed.
Status: open

## 2026-11-24 18:00  D5b: ambient traffic in the Delhi enclave; the stage script now includes the city pack
Branch: d5b-traffic  Commit: see the PR
What changed: `src/world/city/citytraffic.js` (cars on the pack streets, left-hand, one-ways, slow behind a car or the player, obstacle circles for the physics; Settings > Traffic 10/22/34); `tools/stage_cloudflare.py` no longer skips `assets/cities/` (2,251 files, 102.5 MB raw, 1,925 of them the Delhi pack; `.gitignore` keeps the staged copy out of git: `cloudflare/public/assets/cities/`).
For the other stream: **deploy** (Anshul, signed in as rawatanshul525): `git switch main && git pull && python tools/stage_cloudflare.py && cd cloudflare && npx wrangler whoami && npx wrangler deploy`. The Delhi pack in the deploy is 19.8 MB gzip; check wrangler reports no file over 25 MiB (largest is graph.json, 14.6 MB) and under 20,000 files. Rajul's machine is signed in as another account, so nothing was deployed.
Status: open

## 2026-11-24 14:00  D5 follow-up: highway gates and the menu link to the Delhi enclave
Branch: claude/keen-gauss-3b2756  Commit: see the PR
What changed: `src/main.js` (shared): driving into Delhi in the India world reloads into `?play&city=delhi&at=<gate>` (the gate of `manifest.json` whose way in best matches your heading, preferring the highway's NH number); driving out through a gate (within 40 m, heading outward, over 3 m/s) reloads the India world at Delhi with `&fromcity=1` (which switches the auto-entry off so there is no loop); choosing Delhi in the location picker opens the enclave. Tested in the browser: exit, entry, no loop. It is a page reload with the loading screen, not the 0.5 s fade of CITY_PACK section 3. The gate chosen is by heading only; the pack's `india` NH numbers rarely match the skeleton's (NH19 has no gate), so the highway you arrive on may not be the one you leave on.
For the other stream: nothing. `tools/stage_cloudflare.py` still skips `assets/cities/`; since the menu now leads to the enclave, **a deploy without the pack would break "Delhi"**: change the script (add the pack, 19.8 MB gzip, 1,925 files) before the next deploy, or revert the picker line in `setLocation`.
Status: open

## 2026-11-24 12:00  D5: the game renders the Delhi city pack (`?play&city=delhi`)
Branch: claude/keen-gauss-3b2756  Commit: see the PR
What changed: new `src/world/city/{pack,tilemesh,cityworld}.js`; `src/main.js` (shared, small: `?city=delhi` flag, a flat-land config, `CityWorld` created after the grid, its hooks in `world.height/deck/deckMesh/near/surface`, `update`, rebase, `placeOnRoad`/`backToRoad`; `regenerate` does nothing in a city; traffic is off there); `tools/selftest.mjs` (+3 checks, 95 in all: the game's loader agrees with `tools/lib/packio.mjs`, flyover ramps, the five stations clear of streets and claiming ground). What you see: real streets (width from the pack, painted sidewalks, dashed lane marks), flyovers as decks with ramps, edges and piers (the physics gets the deck as a trimesh through `world.deckMesh`, a car drives up and along it, measured), blocks, parks, water, 244k footprints extruded (heights are 97 % guesses: a style), landmark buildings (stations, India Gate...) coloured and labelled, wall circles for collisions, trees kept off streets and buildings through the registry. 1 km tiles stream within 1.3 km of the player (one build per frame, 3 to 40 ms), five draw calls a tile; measured on a desktop at medium: 326 to 370 draw calls, 206k to 270k triangles. Entry: `?play&city=delhi&at=<spawn, landmark or gate id>` (default `centre` = Connaught Place; `ndls`, `indiagate`, a gate id from `manifest.json`).
For the other stream: nothing to run. The transit session (D2): the enclave draws no rails or platforms (the India rail network is not loaded in a city; `transit.json` is yours); station buildings come from the OSM footprints in `landmarks.json` and are drawn as solid boxes coloured by type, with their ground claimed as `station` in `terrain.keepout`. Not built (D5 follow-ups): the transition from the highway gate and back (the India world and the enclave are two page loads), underpasses (layer -1 streets are not drawn), kerbs in the physics (sidewalks are painted flat), traffic and people on the pack graph, GPS and Travel inside a city, facade kits and the far skyline, identity (Phase 3), phone measurement, saved-game `city` field. `tools/stage_cloudflare.py` still skips `assets/cities/`: nothing in the menu leads to `?city=delhi` yet; when it does, the pack is 19.8 MB gzip (77.5 MB raw, 1,925 files).
Status: open

## 2026-11-23 20:00  Delhi pack D1 and D4: the city pipeline, the Delhi pack and its landmarks
Branch: claude/jovial-wilbur-a411de  Commit: see the PR
What changed: new `tools/build_city.mjs`, `tools/validate_city.mjs`, `tools/check_city.mjs`, `tools/build_landmarks_doc.mjs`, `tools/lib/{osm_pbf,geom,packio,graphroute,landmarks_resolve}.mjs`, `tools/city_data/{delhi_landmarks_src,delhi_routes}.json`, `assets/cities/delhi/` (manifest, graph, 1,925 tiles, landmarks, ATTRIBUTION: 77.5 MB raw, 19.8 MB gzip), `docs/DELHI_LANDMARKS.md`, `tools/plot_city.py`. Shared files, small edits: `tools/selftest.mjs` (imports and 3 new checks at the end, 92 in all), `tools/stage_cloudflare.py` (one line: `assets/cities/` is not staged until a loader exists, so a deploy does not carry 77 MB nobody reads), `tools/daily_check.py` (the assets size check leaves out `assets/cities`), `assets/ASSETS.md` and `tools/build_licenses.mjs` (credit rows for the Delhi pack; `licenses.html` regenerated), `docs/CITY_PACK.md` (section 5a: the format as built), `docs/CITY_PLAN.md` (status of Phase 1 and Phase 4), `docs/OPEN_DATA.md` (the two downloads), `docs/WORK_REMAINING.md` (section 11), `CHECKLIST.md` (section 9), `HANDOFF.md` (new section). Raw data (OSM extract 225 MB, Wikidata 0.5 MB) is in git-ignored `data/raw/`. No file of the railway-control or transit sessions was touched (`src/world/rail_*.js`, `src/ui/railboard.js`, `tools/build_delhi_transit.mjs`, `assets/cities/delhi/transit.json`, `docs/DELHI_TRANSIT.md`).
For the other stream: nothing to run. The transit session (D2/D3): use the same frame (`manifest.origin` 28.6139 N, 77.2090 E, x east, z south, equirectangular at that latitude: x = (lon - lon0) * cos(lat0) * 111195 m, z = -(lat - lat0) * 111195 m) and the coordinate encoding in `tools/lib/packio.mjs` (`enc`/`dec`) if you write coordinates into `transit.json`; `landmarks.json` holds the three ISBTs and the main railway stations as `type: bus | station`. Whoever builds D5: read `docs/CITY_PACK.md` section 5a first (delta-coded decimetres, columnar graph, defaults omitted, 97 % of heights guessed).

## 2026-11-23 18:00  Railway control office merged with main's signals, gates and station loops (PR 53)
Branch: claude/clever-dhawan-907ed4
What changed: my signal constants file is now `world/rail_control_signals.js` (main's `rail_signals.js` planner is untouched). `rail_view.js` keeps main's drawing (signals with lit lamps, boom gates, loops and crossovers) and gets the control office on top: `spansFor(li)` and `closedAt(line, s)` feed the drawn signals, lamps, barriers and the road-traffic gates from the control office's real train positions and gate state (a gate is down before the train needs it, and a train stops short of it otherwise). No second set of signal posts is drawn. Drawn aspects come from main's planner and occupancy, the control office brakes at its own block signals (700 m), so the two agree on occupancy, not on lamp positions.
For the other stream: nothing needed.

## 2026-11-23 12:00  Delhi transit data (D2 metro and railway stations, D3 buses)
Branch: claude/magical-lichterman-8e5391  Commit: see the PR
What changed: new `assets/cities/delhi/transit.json` (format 1, 444 KB: 11 metro lines with grade runs, 285 stations, 14 depots, 47 railway stations, 479 bus routes), `tools/build_delhi_transit.mjs` (+ `build_delhi_bus.mjs`, `lib_transit.mjs`, `lib_wikilist.mjs`, three fetchers), `tools/validate_transit.mjs`, `docs/DELHI_TRANSIT.md`. Shared files, small edits: `tools/selftest.mjs` (one check, 90 in all, imports the validator), `docs/CITY_PACK.md` (section 5 transit.json now has the real format 1), `docs/OPEN_DATA.md` (every download logged), `docs/CITY_PLAN.md` and `docs/WORK_REMAINING.md` (section 11, decision 1.11), `HANDOFF.md`, `CHECKLIST.md`. Raw files (37 MB) are in git-ignored `data/raw/delhi_transit/`.
For the other stream: nothing needed from Stream B. For the street-pack session (`tools/build_city.mjs`): use `project()` and `ORIGIN` from `tools/lib_transit.mjs` (origin 28.6139, 77.2090; R = 6,371,008.8 m) so streets and transit share one frame; `ATTRIBUTION.txt` should carry the Wikipedia (CC BY-SA 4.0) and Wikidata (CC0) lines from `transit.json` `sources`; the rail session: `rail.stations[].bodies` and `axis` hold the OSM platform layout of New Delhi and Old Delhi if you want to match the station there (nothing in `rail_*.js` was touched). For the owner: decision 1.11, the Delhi Open Transit Data GTFS needs a click-through agreement with a stated purpose, so I did not take it; buses have no timetable or frequency until then. No photograph was looked at: every look statement in the doc is unverified.
Status: open

## 2026-11-22 19:00  Owner answers recorded (CITY_PLAN, CITY_PACK)
Branch: claude/goofy-liskov-0a8557
What changed: docs only: enclave entry like a bypass, downloads approved (log each file), all well-known places, invented look-alike brands.
For the other stream: nothing.
Status: done

## 2026-11-22 18:00  City plan Phase 0: keep-out registry and the city architecture note
Branch: claude/goofy-liskov-0a8557  Commit: see the PR
What changed: `src/world/keepout.js` (new, pure: claims for lines, circles, rectangles and providers; rank station > landmark > rail > road > building > scenery; `railClaim`, `stationClaim`, `registerRail`, `roadProvider`). Shared or other files, each a small edit: `terrain.js` (`terrain.keepout`, `addZone` registers a landmark claim), `district_plan.js` (whole-plot rectangle check, own-piece overlap check, furniture and signals ask; new params `keepout`, `ignore`), `district.js` (registers and drops its plots), `scatter.js` (trees ask; tiles re-plant when a claim lands on them; CRLF file), `rail_view.js` (**two small edits for the railway-control session**: the constructor calls `registerRail`, and `buildStation` skips a building that would stand on a road), `main.js` (one line: `roadProvider(terrain.keepout, roadSet)` in `makeWorld`), `tools/selftest.mjs` (4 checks, 86 in all), `docs/CITY_PACK.md` (new), `docs/CITY_PLAN.md`, `docs/WORK_REMAINING.md` (section 10), `docs/DISTRICT.md`, `CHECKLIST.md`, `HANDOFF.md`.
For the other stream: if you add anything that covers ground (a new rail object, a station, a depot, a car park, a landmark), register it: `terrain.keepout.add(owner, kind, { t: 'rect' | 'line' | 'circle', ... })`, and ask `terrain.keepout.point/rect(..., { as: 'building' | 'scenery' })` before placing. The railway-control session: keep `registerRail` and the `ko` check in `buildStation` when you change `rail_view.js`; if you change the station layout (120 m platforms, 34 x 9 m building 17 m beyond the outer track) change `STATION_HALF_LEN` and the `stationClaim` size in `keepout.js` to match. Nothing to run.
Status: open

## 2026-11-22 15:00  City plan (docs/CITY_PLAN.md): cities one by one, Delhi NCR first
Branch: claude/flyover-physics-262398
What changed: `docs/CITY_PLAN.md` (new), `HANDOFF.md` (new section). No code.
For the other stream: nothing yet. Phase 0 (keep-out registry, city scale decision) will touch `district_plan.js`, `rail_view.js`, `landmarks.js` (Stream A) and probably `main.js`.
Status: open

## 2026-11-22 12:00  Overpasses: multi-level roads in the physics and the road set
Branch: claude/flyover-physics-262398
What changed: `world/interchange.js` (new, pure: crossings and overpasses), `world/router.js` (`Road.addLift`, lift in `at`/`nearest`/`bridgeW`, `waterW`), `world/roadset.js` (layers: `drive(x, z, natural, y)`, `deck`, `deckMesh`, `grade` follows the ground road), `world/terrain.js` (`drive(x, z, y)`, `deck`), `world/road.js` (`RoadMesh.refresh`), `world/bridges.js` (no pier on the road below, truss only over water), `world/bridge_rails.js`, `world/highway_plan.js`, `world/district_plan.js` (circles carry `y`). Your files, small edits: `vehicle/rapier-vehicle.js` (`buildPatch` makes a deck trimesh beside the ground heightfield; `reset(x, z, yaw, yHint)`; `collide` skips circles of the other level), `vehicle/physics.js` (hint passed), `traffic/sim.js` (car circles carry `y`). `main.js` (shared): `world.height(x, z, y)`, `world.ground`, `world.deck`, `world.deckMesh`, `raiseOverpasses` in `buildCityRoads` and `updateBranches`, `placeOnRoad` passes the road height, `__next.roadSet`. Self-test: one new check (78 checks): a car drives over and under a crossing, no layer snapping, traffic on the deck. `tools/vehicle_acceptance.mjs` passes. India world: two highways cross at Agra (`?play&q=med&india=world&at=agra`, the North-South road goes over the Golden Quadrilateral twice, at about 1.4 and 1.7 km from the start point; use the browser console `__next.branches` to find them: the road `ns` has two `lifts`).
For the other stream: please review the vehicle changes (they are yours). Any new world object that stands on a road should give its obstacle circles a `y` (the road height) so a car on the other level does not hit it. Known: the autodrive planner does not know about layers (it follows the road it is on, which works); slip roads are not built, so you cannot change roads at an overpass.

## 2026-11-23 01:00  Railway signals, gates across the road, no level crossing on expressways, no piers on roads, switching
Branch: feat/rail-signals (on top of PR 50)
What changed: new `world/rail_signals.js`; `world/rail_view.js` (signals with lit lamps, boom barriers across the real road, cross-board, flashing lamps, gate hut, piers skipped near roads, station passing loop with turnouts, crossovers), `world/rail.js` (expressway kinds are always bridges), `traffic/sim.js` (a `gates` list: cars stop at a closed barrier; additive), `main.js` (registers each gate with the traffic of its road); 85 self-test checks.
For the other stream: please look at the small `gates` check in `traffic/sim.js` step.
Status: open

## 2026-11-22 22:00  Loco classes and liveries, diesel sections, Vande Bharat routes, maintenance trains
Branch: feat/rail-over-road (PR 50)
What changed: `world/train_consist.js` (`locoSpec`, vande 8 or 16 cars, maintenance consist), `world/train_art.js` (Vande Bharat look, diesel locos, yellow track machine, green and brown liveries), `world/rail_view.js` (electrified sections only get wire; diesel elsewhere), `world/rail.js` (maintenance style), `tools/build_india_trains.mjs` and `assets/india/trains.json` (13 Vande Bharat services by hand); 84 self-test checks.
For the other stream: nothing needed.
Status: open

## 2026-11-22 20:00  Rail over road: a smooth ramp instead of a bump
Branch: feat/rail-over-road
What changed: `world/rail.js` (`classifyCrossings`), `world/rail_grade.js` (crossings force the profile up 7.2 m with 2.4 percent ramps), `world/rail_view.js` (no extra lift, no abutment boxes; viaduct piers and a deck do the rest), `main.js`; 83 self-test checks. Follows the flyover session's note that the old short lift looked wrong.
For the other stream: nothing needed. The road still crosses at ground level under the rail; with multi-level roads the road could dip instead, later.
Status: open

## 2026-11-22 15:00  Multi-track rail, Indian train look
Branch: feat/rail-realism (same PR 48)
What changed: new `world/train_art.js` (canvas-textured vehicles), `world/train_consist.js` (pure), `world/rail_grade.js` (wider cutting for multi-track), `world/rail_view.js` (1 to 4 tracks, lanes, new trains), `world/rail_timetable.js` (`tracksFor`, `laneOffsets`), `main.js`; 81 self-test checks.
For the other stream: nothing needed.
Status: open

## 2026-11-22 09:00  Railway realism: ground, trains, timetable, boards, announcements, sound
Branch: feat/rail-realism
What changed: new `world/rail_grade.js`, `world/rail_timetable.js`, `ui/railboard.js`, `audio/trainsound.js`, `tools/build_india_trains.mjs`, `assets/india/trains.json` (DataMeet CC0); `world/rail.js` (STYLES, trainMotion, cached routes), `world/rail_view.js` (ballast, overhead wire, viaducts, styled trains), `world/terrain.js` (`attachRail`, one more grading hook, only where no road grades), `main.js`, licences and docs; 79 self-test checks.
For the other stream: terrain.height/drive now also ask the rail grader (a Set lookup first, so cheap). The multi-level road session must not break that order (road grade first, then rail where the road did not change the height).
Status: open

## 2026-11-21 20:00  Real railway network, stations, rail bridges
Branch: feat/real-rail
What changed: `tools/build_india_rails.mjs` (new), `assets/india/rails.json` (new, Natural Earth, public domain), `world/rail.js` (`RailNetwork`), `world/rail_view.js` (rewritten: edges, stations, bridges, trains), `main.js`, `ui/gps.js`, licences and docs; 77 self-test checks.
For the other stream: please read WORK_REMAINING 7.9: road interchanges need the physics to support two ground heights at one point (`world.height`), which is in your files. That is the next engine step if you want flyovers.
Status: open

## 2026-11-21 16:00  Railways: track, trains, level crossings
Branch: feat/rail (stacked on feat/gps-landscape)
What changed: `world/rail.js` and `world/rail_view.js` (new), `main.js` (RailView wiring, rail obstacle circles in `world.near`, `?rail=off`), one new self-test (76 checks).
For the other stream: the train circles are in `world.near`; road traffic does not stop at the barriers yet (a toll-style speed cap in `traffic/sim.js` would do it).
Status: open

## 2026-11-21 10:00  GPS, Indian milestones, field look, lag governor
Branch: feat/gps-landscape
What changed: `ui/gps.js` (new: minimap and full map, key P), `main.js` (Gps wiring, adaptive resolution governor `?gov=off`, gate board info, nav debug no longer triggered by `?nav=<city>`), `world/highway_plan.js` and `highway.js` (stones every 100 m with lettering atlas, gantries every 600 m, also on the 'highway' style, no tolls there), `road.js` (tag), `world/terrain.js` and `groundmat.js` (rectangular field parcels with real land cover, vertex colour shows through the grass), `index.html` (minimap CSS). Self-test 75.
For the other stream: please check lag on a real phone (governor) and review the plate atlas draw call (one extra mesh per highway piece).
Status: open

## 2026-11-20 12:00  Autodrive planner: sport no longer crashes
Branch: feat/autodrive-modes
What changed: `input/autodrive.js` (planner: horizon from stopping distance, bends and cars brought back with v^2 = v0^2 + 2ad, toll plazas, safe sport passing with lane checks and smooth lane slides, drop back), `traffic/sim.js` (additive: `leaderAhead(player, range, lat)` and `laneGap`), `main.js` (autodrive uses the active road's own traffic in the India world, lane count, tolls). Sport cornering budget 3.4 m/s2 (5 ran wide and hit the median at 190 km/h). 75 self-test checks (a six-run heavy-traffic test).
For the other stream: please read `docs/DRIVE_MODES.md` (planner section). Known: the traffic sim can spawn a car about 100 m ahead (minSpawnGap); sport therefore does not pass in the oncoming lane.
Status: open

## 2026-11-20 09:00  Autodrive levels and drive-mode styles; PRs 42 and 43 merged
Branch: feat/autodrive-modes
What changed: PR 42 and 43 are merged into main. `input/autodrive.js` (Stream B area, additive): two levels, Auto (drives and steers) and Cruise (holds speed and gap, the player steers), and a style per drive mode (`STYLES`: Eco gentle, Normal 90, Sport fast, tight, overtakes on the right ignoring the rules, Off-road careful). `main.js`: E and the Auto button cycle Off, Auto, Cruise. HANDOFF.md (shared) has a new top section; docs and CHECKLIST updated; 74 self-test checks.
For the other stream: pull main; drive Mumbai to Goa and try E in each drive mode; review `input/autodrive.js`. Autodrive does not stop at signals yet (WORK_REMAINING 9.5).
Status: open

## 2026-11-20 06:00  One continuous India world, separate Explore cities
Branch: feat/one-world (stacked on feat/overtaking, PR 42)
What changed: the main game (Play, no address options) is now one India world: every highway through a city is built as it nears, roads and junctions stream in and out, no reload. `main.js` (road registry: primary, branches, activeRec, buildCityRoads, updateBranches, navigation HUD, `exploreCity`/`goWorld`), `world/network.js` (`worldStart`), `world/router.js` (signed arcs for the other arm), `ui/menu.js` ("Explore cities" is the old locations list; Travel has Navigate and fast travel), `core/saved.js` (city), 73 self-test checks pass. Address: `?india=world&at=<city>`; `?loc=<region>` is an Explore city.
For the other stream: pull and drive Mumbai to Goa, Delhi to Jaipur; tell me if roads pop in late or traffic misbehaves at junctions. Gates and signs for the far arm of a branch road are not built yet.
Status: open

## 2026-11-20 03:00  Travel screen; Indian lane discipline in traffic
Branch: feat/overtaking
What changed: owner asked how to get from the Kerala map to Mumbai and to keep Indian driving rules in mind. `ui/menu.js` (Travel screen), `main.js` (`currentCityId`, `travelTo`), `traffic/sim.js` (keep-left spawning for slow kinds, overtaking on the right and return left, class speed caps, lateral drift; Stream B file, additive), `traffic/junction.js` (hand-over fields), docs (`docs/TRAFFIC.md` section with the rules and sources, `docs/INDIA_MAP_PLAN.md`, `docs/WORK_REMAINING.md`, `CHECKLIST.md`), one new self-test (73 checks). Rules are from the 2018 MoRTH speed notification and the 2017 Driving Regulations (secondary sources; roundabout and junction priority not verified, so not built).
For the other stream: please review the lane-change logic and the speed caps; the rules are written in `docs/TRAFFIC.md`.
Status: open

## 2026-11-20 00:00  Indian building styles, city buses and cows
Branch: feat/building-styles
What changed: `world/district.js` (domes and chhatris for `mughal`, jharokha balconies for `old-city`), `traffic/sim.js` (kinds `bus` and `cow`, `slow` speed factor, bus no longer part of the pack share), `traffic/traffic.js` (shapes, no lights on a cow; Stream B files, additive), `world/regions.js` (buses and cows in the mixes), one self-test (72 checks), docs. Checked in the browser (Agra: domes and a cow in the lane).
For the other stream: cows hold up queues because cars do not overtake: please decide if overtaking should come next.
Status: open

## 2026-11-19 22:00  Districts for Delhi, Agra and Bhopal
Branch: feat/districts-2
What changed: `world/regions.js` (district and crossing street for Delhi, Agra, Bhopal), one test updated (four regions have a district), `docs/DISTRICT.md`, `docs/WORK_REMAINING.md`. Checked in the browser (Delhi, Agra). The look is the Mumbai kit in other colours: see 3.2.
For the other stream: pedestrians now spawn in those three worlds too.
Status: open

## 2026-11-19 20:00  N11 junction: crossing streets in region worlds
Branch: feat/n11-junction
What changed: `world/regions.js` (optional `junctions`, validated; Mumbai has two), `main.js` (`buildRegionJunctions`: a second road with the district along it, traffic and a shared signal; side roads of region worlds now grow and draw: `updateBranches` no longer returns early outside `?india=`; India-mode roads may bend tighter), `docs/DISTRICT.md`, `docs/WORK_REMAINING.md`. One new self-test (71 checks). Checked in the browser: both Mumbai streets draw, cars run on them. Limits are in `docs/DISTRICT.md`.
For the other stream: nothing required.
Status: open

## 2026-11-19 18:00  Limits batch 2 and region blending (N9 step)
Branch: feat/limits-2
What changed: `traffic/sim.js` (cars wait for a player standing in a crossing), `main.js` (toll toast, India drive activities, results card, region grid), `world/terrain.js` + `world/scatter.js` (region palette and tint blending by position), `world/india_network.js` (Jaipur to Kota, Agra to Lucknow), `assets/india/waypoints.json`, `skeleton.json`, `terrain.bin` rebuilt (30 roads; corridor floor includes the new roads), `docs/REGIONS.md`, `docs/WORK_REMAINING.md`. Tests: 70 checks (player yield, region blending). Checked in the browser: along Delhi to Mumbai the ground colour goes from Delhi green-grey through ochre Rajasthan to Deccan green.
For the other stream: `traffic/sim.js` change is additive.
Status: open

## 2026-11-19 14:00  Real elevation and land cover; licenses page
Branch: feat/limits-and-n8 (PR 37)
What changed: owner asked for real elevation and land cover and a licence list linked from the title page. Downloaded (owner approved, "download all the pack"): AWS Terrain Tiles (528 tiles) and Esri / Impact Observatory land cover (64 blocks) into `data/raw` (git-ignored; `.gitignore` already covers `data/`); `tools/fetch_india_terrain.py`, `tools/build_india_grids.py` -> `assets/india/terrain.bin` + `terrain.json` (3.2 MB, listed in `assets/ASSETS.md`); `world/terrain.js` (`config.terrain.macro`: real relief, cover, `cover()`), `world/scatter.js`, `world/groundmat.js` (bare ground shows sand from the vertex colour), `main.js` (loads the grid in `?india=` mode, `?real=off`); `tools/build_licenses.mjs` -> `licenses.html` (generated from `assets/ASSETS.md` plus data and library lists), linked from the title screen and the Credits screen (`ui/menu.js`); `tools/stage_cloudflare.py` now also stages `licenses.html` and `india_map.html` (shared file, one line). Tests: 70 checks (grid values at known cities, terrain follows a grid, cover drives forest and colour, no grid changes nothing, `licenses.html` is current). Differences from the plan: land cover from Esri (CC BY 4.0) not ESA WorldCover (ESA's service refused the connection here and the tiles are 90 MB each); elevation from the AWS terrain tiles, not raw SRTM. Licence statements are credited as applicable and unreviewed.
For the other stream: please review `licenses.html` too.
Status: open

## 2026-11-19 09:00  Limits batch and N8 step 2
Branch: feat/limits-and-n8
What changed: credits screen in the pause menu (`ui/menu.js`), branch-road bridges in `world.near` (`main.js`), an asphalt patch over the crossing (`world/junction_signals.js`), N8: sectors hold content: `world/regionmap.js` (new), `world/network.js` (`guidePoint`), `main.js` (sector `meta` and `load` build the crossing roads of a city, `unload` removes them; the arc-distance trigger is gone), debug panel line for side roads, `docs/STREAMING.md`, `docs/WORK_REMAINING.md` updated. One new self-test (69 checks). Checked in the browser with the sector manager pumped by hand: Delhi's six roads at the start, Jaipur's crossing road built 1.1 km before it, Delhi's removed after moving away. Note: `__next.step()` does not run the sector system (only the real frame loop does).
For the other stream: nothing required.
Status: open

## 2026-11-19 05:00  Owner approved merging PRs 27 to 36; known-limits reference file
Branch: feat/landscape-look (PR 36)
What changed: `docs/WORK_REMAINING.md` lists every known limit by area with a tag (person, owner, build, which stream) and priority, plus the owner decisions waiting; `HANDOFF.md` points to it. The owner asked for PRs 27 to 36 to be merged in order on 19 Nov 2026.
For the other stream: after the merge, pull `main`, read `docs/WORK_REMAINING.md` (sections 0.2, 2.5, 4 and 9 are yours) and review the additive changes in the files named in 0.2.
Status: open

## 2026-11-19 03:00  Crossing behaviour: shared signals, stopping at red, turning, signal poles
Branch: feat/landscape-look (PR 36)
What changed: new `traffic/junction.js` (`Junction`: shared three-phase signal, `transfer` hands a car to another road's sim), `traffic/sim.js` (junction stop and turn logic, car fields for the turn blend, stuck limit raised to 48 s at junctions; Stream B file, additive), `traffic/traffic.js` (`addJunction`, `removeJunction`, junction clock), new `world/junction_signals.js` (poles and lamps), `main.js` (junction built with the side roads). One long self-test block added (68 checks): signal phases, never green on two roads, cars stop at the line on red, turns happen, no car in two sims, car cap respected. Checked in the browser at Delhi (six-road star cycles, cars turn, poles visible, no console errors). Not done: yielding inside the crossing, avoiding a player who runs a red, turn lanes, real indicators, pedestrians and the navigation graph at junctions.
For the other stream: please review the changes in `traffic/sim.js` and `traffic/traffic.js` (additive); the junction rules are in `traffic/junction.js`.
Status: open

## 2026-11-19 01:00  Traffic on every road of the world
Branch: feat/landscape-look (PR 36)
What changed: `traffic/sim.js` (`branchMode`), `traffic/traffic.js` (`addRoad`, `removeRoad`, `updateExtra`; extra sims share the instanced meshes; `circles` and `setMode` cover them), `main.js` (each branch road gets a sim while the player is within 700 m), one self-test extension (68 checks: cars appear on the side road, keep to its lanes, live near the player, are cleared when off, circles reach physics). Checked in the browser at Delhi. Not done: cars turning between roads, giving way or traffic lights at crossings (two roads' cars can pass through each other), pedestrians and the navigation graph on side roads, continuing cars when you leave and return.
For the other stream: this touches `traffic/sim.js` and `traffic/traffic.js` (your files; additive). Please say how you want crossing behaviour done (priority, signals, turning).
Status: open

## 2026-11-18 23:00  Multi-road engine step 1: RoadSet and branch roads at junctions
Branch: feat/landscape-look (PR 36)
What changed: new `world/roadset.js` (`RoadSet`: nearest, grade, drive, style over several roads; `terrain.attachRoad(roadSet)` in `main.js`), `world/router.js` (`config.road.start` and `guideBack`, `hAt` height blend: a road can start on another road; both arms can follow guides), `main.js` (branch roads built near each city of an `?india=` route and removed when far, their meshes updated and repositioned like the main road), one self-test (68 checks: branch starts at the road's height, follows its guide, nearest-road answers, one-road behaviour unchanged). Checked in the browser: six roads form a star at Delhi, no console errors, about 3 ms per headless step. Not done: traffic, pedestrians and the navigation graph on branches, interchanges and ramps, paint cut-outs, collision for branch bridges and walls, the physical choice replaced the panel only partly.
For the other stream: `terrain.road` is now a `RoadSet` (it has `nearest`, `hit`, `style`, `grade`, `drive`); code that wants one Road should keep using the `road` it is given. Traffic and navigation over several roads are your area; please say how you want that shaped.
Status: open

## 2026-11-18 21:00  Junction network: routes across roads, city gates, junction panel
Branch: feat/landscape-look (PR 36)
What changed: `world/network.js` (`slice`, `routeGuide`, `junctionChoices`), `main.js` (`?india=route&from&to`, junction panel, regenerate on choosing another road), `world/highway_plan.js` + `highway.js` + `road.js` (city gate boards over the road before each city, `gates` option), `docs/INDIA_MAP_PLAN.md`. Self-test cases added (67 checks, still passing). Checked in the browser (Delhi to Mumbai route, Jaipur gate and panel, switching to NH 62). Limit: one road at a time; the junction is a choice, not a visible crossing; no real side roads, no network traffic or navigation yet.
For the other stream: the next step needs the engine to hold several roads at once (terrain, scatter, traffic, navigation all take one `Road` today). Please look at how much of that is yours before I start.
Status: open

## 2026-11-18 19:00  Drive a real highway: ?india= guided road
Branch: feat/landscape-look (PR 36)
What changed: `main.js` (`?india=<road>&from=<city>&toward=<city>` loads the skeleton, builds the guide, picks the nearest region and a highway style, route readout, OpenStreetMap credit), `world/router.js` (`guideArc`, `arcAtS`), `world/highway_plan.js` and `highway.js` (gantry boards name the next cities with real distance left when the road has a guide), `docs/INDIA_MAP_PLAN.md`. One more self-test case (67 checks). Checked in the browser: Delhi to Lucknow follows its guide, readout and credit show. Limits: one road, no junctions, no real elevation, no city worlds.
For the other stream: the road model change is additive (`config.road.guide` is optional). Please read the network design in section 9 of the India plan.
Status: open

## 2026-11-18 17:00  Drive modes (Eco, Normal, Sport, Off-road) and the road network model
Branch: feat/landscape-look (PR 36)
What changed: owner asked for drive modes like a modern car. `vehicle/physics.js` (`DRIVE_MODES`, `combineMods`, `setDriveMode`), `vehicle/rapier-vehicle.js` (limiter, throttle map, hill descent control, loose-ground grip, shift points, traction limit, engine braking; Stream B files, smallest change, both physics classes keep one surface), `main.js` (N key and button, HUD tag, saved choice), `input/controls.js` (`drivemode`), `core/saved.js` (`driveMode`), `index.html` (button, tag), `docs/DRIVE_MODES.md`. `tools/vehicle_acceptance.mjs` now checks every mode for every vehicle (all pass). Also in this push: `world/network.js` (road network model, `cleanPath`, `guideFor`) and a `config.road.guide` option in `world/router.js` so a road can follow a real highway path (tested: it stays within 450 m of the guide); not wired into the game yet. 67 self-tests pass.
For the other stream: please feel-test the modes on a phone and with a gamepad; the numbers are tuned by script only. Sound per mode is not done.
Status: open

## 2026-11-18 15:00  Real road shapes (OpenStreetMap-derived) in the India skeleton
Branch: feat/landscape-look (PR 36)
What changed: owner approved the OSM download. `tools/fetch_india_routes.mjs` fetched 28 simplified driving routes from the OSRM demo server (OSM data, ODbL) into `assets/india/waypoints.json` (20 KB, credit and licence in `meta`); `tools/build_india_skeleton.mjs` and `buildSkeleton` use them (skeleton now 64 KB, `assets/india/skeleton.json`); `india_map.html` draws the real shapes with the credit; `.gitignore` ignores `data/`; self-tests check the waypoints (66 checks). An Overpass trial was far too big (8 MB for one highway) and was stopped and deleted. Credit line in the game itself is still to do. Not used by the game world yet.
For the other stream: ODbL share-alike on `assets/india/waypoints.json` and the skeleton: please read `docs/OPEN_DATA.md`.
Status: open

## 2026-11-18 13:00  India game space and skeleton file; open data research
Branch: feat/landscape-look (PR 36)
What changed: `docs/OPEN_DATA.md` (data and open-source projects, licences, what needs approval; nothing downloaded), `src/world/india_network.js` (`toGame`, `fromGame`, `smoothPath`, `buildSkeleton`, `GAME_SCALE` 100), `tools/build_india_skeleton.mjs`, `assets/india/skeleton.json` (generated, 32 KB, listed in `assets/ASSETS.md`), `india_map.html` default 1:100, one self-test (66 checks, includes a check that the shipped skeleton is current). Not used by the game yet: the game still loads one road from the start.
For the other stream: nothing required; section 9 of the India plan still needs your review.
Status: open

## 2026-11-18 11:00  Owner decisions on the India map recorded
Branch: feat/landscape-look (PR 36)
What changed: `docs/INDIA_MAP_PLAN.md` section 9: real road lines (as a skeleton for procedural detail), GTA-like compression (about 1:100 on highways, cities near full scale), one continuous world generated by distance. Design and order of work written down; nothing built. Needs Anshul's review before work starts (it changes the road model from one polyline to a network).
For the other stream: read section 9 and say if the engine side (sectors, nav graph, traffic) can take a road network.
Status: open

## 2026-11-18 09:00  Traffic slows at toll plazas; Himachal and Ladakh retuned
Branch: feat/landscape-look (PR 36, more commits)
What changed: `traffic/sim.js` (cars on nh6 roads ease down to 4 m/s through toll plazas, using the same plaza list as the plan: `validTolls`, `tollCap` in `world/highway_plan.js`), `world/regions.js` (Himachal v2: mountains everywhere, the road climbs about 240 m in 5 km with 39 m minimum bend radius; Ladakh v2: tan barren ground, `arid` 0.8). Checked in the browser: cars measured at 4 m/s in the plaza; Himachal, Kerala, Ladakh, Deccan, Rajasthan all load and look as intended at first glance. Kerala has no palm trees (no art): banyan-like trees only. 65 checks pass.
For the other stream: nothing required.
Status: open

## 2026-11-18 07:00  Highway details on six-lane national highways
Branch: feat/landscape-look (PR 36, more commits)
What changed: new `world/highway_plan.js` (pure rules) and `world/highway.js` (meshes): guardrails, km stones, bilingual green sign gantries, toll plazas on `nh6` roads only; wired into `road.js` (`RoadMesh.highway`, `extras.dests`) and `main.js` (`world.near` gets the circles; `placeOnRoad` now starts the player in the first lane on the traffic side for the region's drive side, which also fixes a start on the wrong side of two-lane roads in left-hand regions), `india_network.js` (`HINDI`, `destinationsFor`). One self-test (65 checks). Looked at in the browser in the Deccan world: gantry, guardrail, toll plaza, bridge rails visible. Not done: traffic does not slow for the toll plaza, service roads, interchanges, night lighting of signs, nothing measured on a phone. Merged-mesh cost: a few thousand triangles per piece of road in range.
For the other stream: the Indian signs use system fonts for Devanagari; check they show on a phone.
Status: open

## 2026-11-18 05:00  India-only worlds: five Indian regions replace the old picker
Branch: feat/landscape-look (PR 36, more commits)
What changed: `world/regions.js` (regions himachal, ladakh, rajasthan, kerala, deccan; optional `roads.router` numbers passed to the route planner; DEFAULT_CONFIG import), `world/locations.js` (old five ids hidden from the picker, `LEGACY` map, `START_LOCATION` mumbai, `pickerLocations()`), `main.js` (start in Mumbai, old saved choice moves to its replacement, picker shows India only, `uArid`), `world/groundmat.js` (optional palette `arid` mixes sand into the ground so Rajasthan and Ladakh look dry). Old ids and share codes still load. Looked at in the browser (Rajasthan closely, the others only loaded without errors). 64 checks pass.
For the other stream: the title and picker show Indian places only now; check the menu text on a phone.
Status: open

## 2026-11-18 03:00  India-only direction: network data, map page, two Indian road styles
Branch: feat/landscape-look (PR 36, more commits)
What changed: `docs/INDIA_MAP_PLAN.md` (research, scale, what makes an Indian game, order of work, owner decisions), `src/world/india_network.js` (98 cities, 28 highways including the Golden Quadrilateral, North-South and East-West corridors, the six rail trunk routes, route and distance helpers; calibrated so the four GQ sides total about 5,800 km), `india_map.html` + `src/debug/indiamap.js` (draws it, plans a route between two clicked cities), `roadstyles.js` (new `nh6` six-lane divided highway and `ghat` mountain road; styles may now list their own `lanes`), small additions in `road.js`, `traffic/sim.js`, `world/navgraph.js`, `regions.js`. Two self-tests (64 checks). Not done: hairpin routing for ghat roads, service roads, gantry signs, toll plazas, interchanges, the five non-India worlds are still there, no real alignments (needs the OSM decision).
For the other stream: nothing required. `lanes` on a road style is new (see `laneOffsets`).
Status: open

## 2026-11-18 01:00  Landscape pass 2: tree species built in code, shore and depth on water, sharper forests
Branch: feat/landscape-look (PR 36, more commits)
What changed: new `world/species.js` (oak, birch, poplar, cypress, a rare autumn maple: trunk, branches and a crown of leaf clusters, leaf textures drawn on a canvas, no outside assets; mixed into the scanned trees by `nature.js`, two kept on the low preset), `world/groundmat.js` (ground under water goes from pale turquoise shallows to deep blue, wet sand, a moving line of foam at the shore; new `uTime` uniform), `main.js` (water opacity 0.74 so the bed shows), `terrain.js` (sharper forest edges). Looked at in the browser only. Cost: each species adds about 300 triangles and two draw calls per variant per tile; not measured on a phone.
For the other stream: phone frame rate and memory check on the mid and low presets.
Status: open

## 2026-11-17 23:50  Mouse look on foot, plant variety, patchwork land colour, moving water
Branch: feat/landscape-look
What changed: `main.js` (mouse look and touch drag in foot mode; water material now has four moving ripple layers, stronger normals), `world/nature.js` + `world/scatter.js` (each plant kind now has several variants: sizes, shapes, colours, a rare autumn tree, three wildflower cards drawn in code; variants are placed in patches, not at random), `world/terrain.js` + `world/groundmat.js` (patchwork of hay-yellow, fresh and deep green fields on open lowland). No new outside assets; the scanned art is still one broadleaf tree, six conifers, one shrub, one fern, one grass: real new species need packs the owner downloads (see `docs/ASSET_PLAN.md`). Water has no shore foam or depth colour yet.
For the other stream: look at it on a phone (more variants cost draw calls: the low preset keeps the old few).
Status: open

## 2026-11-17 23:00  N15 first increment: activities and a versioned save
Branch: feat/n15-activities
What changed: new `src/activities/activities.js` (data-driven point-to-point drives, runner, ratings, best times), `src/core/save.js` (version 2 envelope, migration, corrupt text kept in `gfp-next.bad`, newer saves never overwritten), `saved.js` (`sanitiseProgress`), `runtime.js` (events `activity:started`, `activity:finished`), `main.js` (markers, beacon, timer line, G to start, save wiring), `player/onfoot.js` (`Interactions` prefix filter). `docs/ACTIVITIES.md`. Two self-tests (62 checks). Checked in the browser: prompt, start, finish, best time saved. Par times are guesses.
Also: `HANDOFF.md` (shared) got a post-N6 section for N7 to N15 and `docs/ASSET_PLAN.md` was written (no assets downloaded). For the other stream: nothing needed to merge. Later: points of interest for activities from region data (yours to supply), a map/route layer, more kinds.
Status: open

## 2026-11-17 21:00  N14 first increment: on foot, get in and out
Branch: feat/n14-onfoot
What changed: new `src/player/onfoot.js` (kinematic controller, safe exit spot, interaction registry), `src/input/controls.js` (`G` interact, Shift run), `src/main.js` (mode `foot`, `exitVehicle`/`enterVehicle`, parked vehicle on handbrake, prompt button, third-person camera, Registry handle on `vehicle:exited`/`vehicle:entered`). `docs/ONFOOT.md`. Three self-tests (60 checks). Checked in the browser: exit, walk, prompt, get back in, no errors. Not built: interiors, other vehicles, a rigged model, phone on-foot controls, phone measurement.
For the other stream: you own the vehicle side of N14 (`TouchUI` on-foot controls, occupants, camera). Nothing is required of you to merge.
Status: open

## 2026-11-17 18:00  N11 first increment: Mumbai district (buildings, sidewalks, crossings, furniture)
Branch: feat/n11-district
What changed: new `src/world/district_plan.js` (pure layout: plots along both sides at the frontage line, never on bridges, tunnels, water, landmark zones or bends; lamps every 36 m, bus shelters, market stalls, signal poles; crossings shared with the navigation graph via `navgraph.crossingAt`; obstacle circles along building fronts) and `src/world/district.js` (original procedural meshes: shop fronts with awnings and signs, floors of windows, cornices, balconies, water tanks, colonial and art-deco looks, raised sidewalks, zebras, furniture; lit windows at night), wired through `road.js` (`RoadMesh` extras) and `main.js` (`world.near` gets the circles, `setNight`). The Mumbai region record turns it on (`district` field, validated; version 2, tree-clear strip 30 m). Two new self-tests (53 checks). Checked in the browser: renders, no errors, the truck stops at a building front. `docs/DISTRICT.md` lists what is built and what is not: **no junction or local street yet, no promenade, no designed route, no phone measurement.** `assets/ASSETS.md`: no external assets used.
For the other stream: nothing. The district needs your eyes on a phone for frame rate.
Status: open

## 2026-11-17 15:00  N10 navigation graph built
Branch: feat/n10-nav
What changed: new `src/world/navgraph.js` (generic `NavGraph` with spatial hash, bounded cached A*, validate and recover; `RoadNav` builds lane, lane-change, sidewalk and crossing edges from the road in sector chunks, with bridge and tunnel flags, grade, curvature, speed targets, signalled crossings and stop-line marks), new `src/debug/navdebug.js` (`?nav` view); `src/main.js` builds the graph per world, loads and unloads chunks from the sector manager and shows a `navigation` line in `?debug`. Four new self-tests (51 checks): lanes on the right side of travel for both drive sides, sidewalks never on the carriageway, vehicle and pedestrian routes use only their own edges, bounded and cached search, chunks join in any loading order, routes invalidate and recover when a sector unloads, bridges and tunnels keep a walkway, roundabout, dead end and flyover on synthetic graphs. Contract and measurements in `docs/NAVIGATION.md`. The generated road has no junctions yet (N11).
For the other stream: consumers (traffic N12, pedestrians N13): use the query contract in `docs/NAVIGATION.md`; do not read nodes by scanning the graph per frame.
Status: open

## 2026-11-17 13:00  N9 region model built (Mumbai, Delhi, Agra, Bhopal as data)
Branch: feat/n9-regions
What changed: new `src/world/regions.js` (versioned schema, validator, migration hook, `regionToLocation`, `regionTransition`) with Mumbai, Delhi and Agra moved out of `locations.js` into region records (their worlds are byte-identical: config hash before and after matched) and a new procedural Bhopal profile (lakes, bridges, two-lane roads, lighter traffic); `locations.js` appends `REGIONS.map(regionToLocation)`; configs now carry `region: { id, version }` (share codes carry it; older codes still load); traffic density takes the region's `traffic.scale` (`sim.js` and `traffic.js` accept `scale`, `main.js` passes it). Three new self-tests (47 checks): validation and rejection of 15 kinds of bad data, two regions through the same code deterministically with share-code round trip and a legacy code, and traffic scale. Decisions (geography mapping, OSM policy, elevation, determinism, transitions) in `docs/REGIONS.md`. OSM is NOT used; the owner must decide on ODbL before it is.
For the other stream: nothing to do; the data fields for vehicle mix, buildings and population are waiting for N11 to N13.
Status: open

## 2026-11-17 11:00  N8 sectors and shared-asset streaming built
Branch: feat/n8-sectors
What changed: new `src/world/sectors.js` (sector manager: 512 m sectors, states, priority queue with look-ahead, concurrency and per-update budgets, hysteresis, cancel and abort, pins, failure retry, reset), new `src/core/assets.js` (ref-counted asset cache: one load for many askers, pinned while held, LRU eviction, abort when nobody waits); `src/main.js` runs the sector manager as a runtime system (focus is the player or camera), routes the traffic pack through the cache, rebuilds sectors on `world:rebuilt`, and shows a `sectors` line in the `?debug` panel. Six new self-tests (44 checks): lifecycle and budgets, hysteresis and pins, cancel/abort/late results/retry, a 1500-step stress with reversals, teleports and resets, twenty rebuilds in a row. Design note and measurements in `docs/STREAMING.md`. In the browser: 19 sectors loaded in 12 s of autodrive, pack loaded once, references equal sectors alive plus one after a region change, no errors. Terrain tiles and scenery are NOT moved behind sectors (deliberately).
For the other stream: Stream A (world) review the sector boundary in `docs/STREAMING.md`; sector `meta` is the hook for spawn profiles (N9) and navigation chunks (N10).
Status: open

## 2026-11-16 23:00  N6 switch-over done in the repo (owner request)
Branch: feat/n6-switchover
What changed: `index.html` is now the new engine (title "Game for Peace"); the original game moved to `classic.html` (still uses `game.js` and `audio.js`, which stay for rollback); `next.html` is a tiny redirect to `./` that keeps the query string and hash, so old links with `?loc=` and `?seed=` still work; `tuner.html` previews `index.html`; `tools/stage_cloudflare.py` copies `classic.html`; OVERVIEW, HANDOFF, CHECKLIST, PERFORMANCE and PARALLEL_PLAN updated. Checked locally: `/next.html?loc=mumbai&...` lands on `/?loc=mumbai&...` and loads the new game; `/classic.html` loads the old one; tuner opens. Self-test 33, vehicle acceptance, collision audit, all locations build a road, daily check 0 failed (one warning: `cloudflare/public` is out of date, as expected until staging). NOT done: the real-phone and driving acceptance the plan wanted before this switch (the owner asked to proceed); nothing deployed.
For the other stream: Anshul (the only deployer): `git switch main && git pull`, `python tools/stage_cloudflare.py`, `npx wrangler whoami` (must be the project account), `cd cloudflare && npx wrangler deploy`. Rollback: the live version before this deploy is `4ab7b600` (the old `/`); `/classic.html` is the quick stopgap. After deploy run the "After" lines of `CHECKLIST.md` section 7. The old game (`classic.html`, `game.js`) is your file; it is frozen, not deleted.
Status: open

## 2026-11-16 21:00  Retaining walls and parapets (N3 A)
Branch: feat/ground-detail
What changed: new `src/world/retaining.js` (wired into `road.js` like bridges and tunnels: `update`, `reposition`, `dispose`): where the land beside the road falls away more than 1.8 m within 3 m of the bed, a low stone parapet (0.9 m) with a coping runs along the road edge and a wall face goes down the drop (at most 5 m); where the land climbs more than 1.4 m, a wall with coping stands on the bed edge (up to 4.5 m). Skips bridges and tunnels. Visual only. Measured: Himalayas has about 22% of road sides with a drop (all of them small, at most about 2 m), and no cuts steep enough for a wall (the grading eases the hill in), so in practice you see parapets and an occasional wall at a bend; Alps, California and Mumbai have almost none. Checked by eye in the Himalayas at medium tier, no console errors, self-test 33 checks. Phone cost not measured (one merged mesh per 200 m piece).
For the other stream: nothing.
Status: done

## 2026-11-16 20:00  Southern lighthouse and a richer Taj hotel (N3 A)
Branch: feat/ground-detail
What changed: `src/world/landmarks.js`: new `lighthouse` landmark (tapering red and white banded tower, gallery with railing, lantern room and cap, keeper's cottage, boundary walls; three obstacle circles) placed on the Southern Coast by a spec in `locations.js` (`{ kind: 'lighthouse', s: 700, off: 80, sea: true, range: 3000 }`); `tajHotel` gets string courses and cornices on every block, parapet finials, four corner turrets with domes, balcony rails, an entrance porch and forecourt lamps. Checked by eye at medium tier (south seed `peace`, Mumbai): both render, no console errors. Self-test 33 checks. The lighthouse has no interior and is not lit at night (no beam yet).
For the other stream: nothing.
Status: done

## 2026-11-16 18:00  Ground normal maps now used (N3 A)
Branch: feat/ground-detail
What changed: `src/world/groundmat.js`: the grass and rock normal maps were loaded but never used; the ground shader now perturbs the surface normal with them (two grass scales blended into the rock map on steep slopes, faded out between 25 and 110 m so far ground does not shimmer). Full tier only; the `lite` tier is unchanged. Checked in California at high tier: renders, no shader or console errors. Tall grass (a separate layer of blades) is NOT done. Not measured for frame cost on a phone: add to the N4 phone run.
For the other stream: nothing.
Status: done

## 2026-11-16 17:00  Core architecture addendum added to the plan
Branch: feat/collision-audit
What changed: `docs/open-world-core-architecture-addendum.md` (verbatim) and an "Addendum: open-world core architecture" section in `PARALLEL_PLAN.md` mapping its fifteen areas to N7 to N20, what exists, the gaps, and two change requests (an N7a core contracts note; an N14a player-facing layer for HUD, map, prompts, accessibility). Docs only.
For the other stream: read the new section. Do not start N7. When the gate opens, the first joint task is the contracts note.
Status: open

## 2026-11-16 16:00  Tunnel doorways were blocked by the hill (fixed)
Branch: feat/collision-audit
What changed: (1) a real bug in `src/world/router.js` `deep()`: it read the road point into an object that `bridgeW()` overwrites, so tunnels were detected from a point a few metres off and began where the hill was only 2 to 3 m high; fixed (own object). All tunnels move a little because of this (share codes keep working; tunnel places differ slightly). (2) The land over the tube now stands at least `TUBE_ROOF` (9.6 m) above the road from `FACE_W` inward, and the way is cut clear in front of the portal. The tube and portal wall start at `PORTAL_W` (`tunnelW`), a few metres before the hill face, because the terrain mesh is coarser than the road. (3) New `src/world/tunnel_holes.js`: the terrain is not drawn inside the tube's arch for 30 m behind the 4 nearest portals (a fragment-shader discard chained onto the ground material, works with `?ground=flat`); `tunnels.js` lists its portals (`portals()`), `main.js` feeds them each frame. `road.js` and `tunnels.js` use `tunnelW >= PORTAL_W` instead of the old cover rule. `tools/collision_audit.mjs` now also checks the doorway numbers (land over the road at the portal at most 3 m, at least 9 m 14 m inside). Checked by eye entering and leaving in the Himalayas at low and high tier and `ground=flat`: open arch, interior visible, no console errors. Self-test 33, daily check 0 failed, all locations build a road.
For the other stream: nothing. The photographic ground shader is in `groundmat.js` (not edited; the holes chain after it).
Status: done

## 2026-11-16 14:00  Collision audit: tunnel walls and bridge rails hold; asset job recorded
Branch: feat/collision-audit
What changed: new `tools/collision_audit.mjs` drives the real vehicle physics on the real graded ground (`terrain.drive`, with the bridge rails) sideways into a tunnel wall and a bridge edge, Alps and Himalayas. Result: in a tunnel the car stops at 4.2 to 4.4 m from the centre line (the mountain, left whole over the road, is the wall); on the Alps bridge it stops at the rail, 3.1 m. No fix needed. Bridge piers are below the deck and not reachable while the rails hold. `PARALLEL_PLAN.md` now records the owner's instruction that Claude sources or builds all assets for N11 to N14 (write `docs/ASSET_PLAN.md` first).
For the other stream: nothing.
Status: done

## 2026-11-16 12:00  Post-N6 plan (N7 to N15) added and reviewed; status refreshed
Branch: docs/post-n6-plan
What changed: `docs/post-n6-open-world-plan.md` (the owner's open-world India plan, verbatim); `PARALLEL_PLAN.md` has a new status table (done / not done for N0 to N6) and an "After N6" section with N7 to N15, what each builds on in the current code, and six review notes (gate, missing Asset Acquisition Brief, product direction change, risks, ownership, owner decisions); `HANDOFF.md` status corrected (PR 22 merged) and points to the new plan. No runtime code changed.
For the other stream: read the new section in `PARALLEL_PLAN.md`. Do not start N7. The N7 kickoff report is Stream B's first task once N0 to N6 are accepted.
Status: open

## 2026-11-14 18:00  N3 started; request for Stream B: bridge rail collision
Branch: main  Commit: 1ee42db
What changed: nothing in code. Tried two-plane tree cards on far scenery tiles: saved 0.4% of triangles, so dropped it (trees are not where the cost is; N4 should measure the ground and road meshes first).
For the other stream: bridge rails are drawn but the car drives through them. The physics ground is one heightfield (`rapier-vehicle.js`), which is your file. Ask: add thin cuboid colliders along the bridge edges (use `Road.bridgeW === 1` stretches and `road.carriedW` for the half width), or tell me the hook you want and I will expose a list of rail segments from `world/bridges.js`.
Status: done (Rajul's Claude built the rail collision on the world side, see the 2026-11-15 23:00 entry; no change needed from Anshul)

## 2026-11-16 10:00  Steel truss on long bridges (N3 A2)
Branch: feat/plan-n0-n1 (stacked on PR 22)
What changed: `src/world/bridges.js`: on bridges of at least 90 m (`TRUSS_MIN`) a steel pony truss is drawn along both sides: top chord, an upright and a diagonal per 6 m bay (`TRUSS_BAY`), 3.3 m above the deck (`TRUSS_H`), one merged mesh per 200 m piece; bays sit at fixed road distances so pieces line up and each bay is built by the piece holding its first upright; new `steel` material, freed in `dispose()`. Checked on the 726 m Alps lake bridge (seed `alps`): continuous, no gaps, no console errors. Visual only; the rails (bridge_rails.js) still stop the car. Self-test 33 checks.
For the other stream: nothing. The chase camera can sit close to the near truss member on a bridge; tell me if it bothers you.
Status: done

## 2026-11-16 09:00  Tunnel interior: walkway, speed-limit, exit and SOS signs (N3 A3)
Branch: feat/plan-n0-n1 (stacked on PR 22)
What changed: `src/world/tunnels.js`: a raised walkway (a 0.7 m wide, 0.32 m high ledge with its inner face) along both walls of every tunnel stretch, and instanced wall signs drawn to canvas textures: a red-ringed 60 every 200 m, a green EXIT every 60 m and an orange SOS box every 120 m, facing the road, all freed in `dispose()`. Checked in the Himalayas (seed `hill`): ledge and all three signs visible, no console errors. The walkway is visual only (the car can drive over its edge at the very side; it is outside the 5.4 m shoulder). Self-test 33 checks.
For the other stream: nothing.
Status: done

## 2026-11-15 23:00  Master Plan N0 done on the real clone; bridge rail collision built (N3 A1, A2)
Branch: feat/n0-n3-docs-and-rails
What changed: all five open PRs (16 to 20) were merged into `main` in order (log files conflicted each time; both entries kept, newest first). New `src/world/bridge_rails.js` (pure, tested): collision circles along both rails of every bridge, wired in as `roadMesh.bridges.near` and `world.near` in `src/main.js`; `collide()` in `src/vehicle/rapier-vehicle.js` (Stream B) treats circles with `slide: true` as a wall to scrape along (little speed lost, small bounce, nose turned parallel) instead of a tree. New `WORLD_CONTRACT.md` documents the road, terrain and obstacle interfaces as the code is. `HANDOFF.md` and `PARALLEL_PLAN.md` refreshed, with an ordered defect list. Self-test 27 checks (new: rail circles sit on the drawn rail and nowhere else; no car, truck or bike gets through a rail at up to 220 km/h, physics stays finite). In the real game a car at about 100 km/h was stopped by a bridge rail and stayed on the deck.
For the other stream: read `WORLD_CONTRACT.md`; review the `collide()` change (two lines) and the `slide` flag; your 2026-11-14 request for rail colliders is done. Not tested: tunnel walls and bridge piers have no obstacle circles.
Status: done

## 2026-11-15 22:00  New car model (Stream B files touched, please read)
Branch: feat/nfs-handling (PR 20)
What changed: the car is now `assets/car_04_concept.glb`: Khronos's CarConcept (CC BY 4.0, Eric Chadwick / Darmstadt Graphics Group; credited in `assets/ASSETS.md`), cut by `tools/blender/make_car_concept.py` from 213,347 triangles, about 100 meshes and 11.8 MB to 67,806 triangles, 41 draw calls and 3.2 MB. It has a real interior (the old stand-in dashboard is skipped via `interior: true`), clearcoat paint (`Paint_Body`, recolourable from the garage swatches), wheels named `Wheel_FL/FR/RL/RR`. The Khronos and 3D Commerce logos in the original (tyre sidewalls, licence plate) are replaced by plain materials. `src/vehicle/defs.js` (Stream B): car body numbers now match the model (front 1.49, rear 1.31, track 1.96, wheel radius 0.384, camera back 8.4 / up 3.3, eye [0, 1.02, 0.3], lights, shadow size, collision circles) and the final drive went 4.0 to 4.4 to keep 270 km/h and the same acceleration with the bigger wheels (0-100 3.3 s, top 269 km/h, 270 to 0 in 193 m). `src/vehicle/vehicle.js` (Stream B): fixed `setModel()` overwriting every material's reflection strength with 0.7 (it undid the car-paint polish), tyre and rim names by prefix. The old `car_01_gt.glb` and the livery mask are no longer used by the car (still in assets; the old game may use them).
For the other stream: 67k triangles and 41 draw calls for the car on every tier, including phones; if that costs too much on a real phone, tell me and I will cut it further or add a lower model for the low tier. The steering wheel in the model does not turn yet.
Status: done

## 2026-11-15 21:00  Steering was numb: now quick and stable (Stream B file, at Rajul's request)
Branch: feat/nfs-handling (PR 20)
What changed: `src/vehicle/rapier-vehicle.js` `ARCADE`: new `steerRate` (2.5, wheel input speed), `yawAssist` 8 (was 3.2), `maxYaw` 1.2 (was 1.7), `tyreAssist` 0.5 (was 0.3). The extra steering lock above 2.1 (`steerLock`, default 3.5) now fades out between 90 and 200 km/h, because a wide lock at top speed spun the car (full lock at 228 km/h gave 1.1 rad of slip; now 0.19). Measured step response (time to 63% of the steady turn rate, full lock): 50 km/h 1.28 s to 0.32 s; 100 km/h 1.28 s to 0.48 s; first 10% response 0.08 to 0.17 s at all speeds. A handbrake flick at 100 km/h now gives a 15 to 20 degree drift. Selftest 25 of 25. All settings are in the tuner under "handling" with help.
For the other stream: nothing. Please tell me by feel if it is now too sharp; `steerRate` and `tyreAssist` are the sliders.
Status: done

## 2026-11-15 20:00  Look pass: grade, car paint, reflection horizon, tree card fix (shared files touched, please read)
Branch: feat/nfs-handling (PR 20)
What changed: (1) NEW `src/fx/grade.js` + tuner root "look": a CSS-filter colour grade on the canvas (contrast 1.1, saturate 1.14, brightness 0.98) and a soft vignette overlay; off on the low tier; hooked in `main.js` (also re-applied when the tuner changes `look.*`). (2) `src/vehicle/vehicle.js` (Stream B file): `polish()` runs once on each loaded model: car paint becomes metallic base plus clearcoat 1.0, glass dark and mirror-like, chrome/rim reflections up, tyres matt. (3) `src/env/environment.js` (Stream B file): a dark ground disc in the reflection scene, so reflections show a horizon. (4) `src/main.js`: PCF soft shadows on the high tier. (5) World bug fixed in `src/world/nature.js` and `scatter.js`: every plant card showed a solid black rectangle in sunlight, because double-sided cards flip their lighting normal on the back side, which made all back faces near black; the card material now keeps the front normal, the card normals are lit mostly from above, and cards cast cut-out shadows (custom depth material). Selftest 25 of 25.
For the other stream: nothing to do, but the sky/lighting/vehicle look (N2) now starts from this; tell me if the car polish clashes with anything in your model work.
Not done: a detailed car model (the current model is low-detail), sun glare/bloom, motion blur.
Status: done

## 2026-11-15 14:00  Arcade handling layer, Need for Speed style (Stream B file, at Rajul's request)
Branch: feat/nfs-handling
What changed: `src/vehicle/rapier-vehicle.js`: new `ARCADE` constants and an `arcade()` step after the tyres: sideways speed is killed faster (planted grip), throttle plus hard steering above 14 m/s lets the tail step out (power slide), the handbrake gives a drift that holds, and the car is pulled toward the yaw rate the steering asks for (crisp turn-in). Off with `?arcade=0`. Not for the bike. Original code, not ported from any other game. Measured at 82 km/h with the handbrake held for 1 s: before, slip 1.47 and the car stopped dead; now slip 0.51 and it keeps 66 km/h.
For the other stream (Anshul): the constants are plain numbers at the top of the file; please move them into the tuner (`core/tuning.js`, `tuning-docs.js`) and tune by feel on the car and the truck. The truck has not been tried.
Second pass (after Rajul said it felt nothing like Most Wanted): the car was slow (0-100 km/h in 6.2 s, 140 km/h after 12 s). `ARCADE.power/curve/aero/brake/grip` now give a hard launch and a long pull (0-100 in about 3.7 s), harder brakes (x1.35) and more grip (x1.12); the car's Afterburn is stronger (accel x2.1, 5 s, 9 s cooldown, `defs.js`). All are numbers in `ARCADE` for the tuner.
Third pass (real data, as Rajul asked): the car now has a real powertrain from published sports-coupe data (`pt` in `defs.js`: 330 kW at 6500 rpm, 7600 rpm redline, 6 gears, 4.0 final drive, Cd x A 0.66, 88% driveline efficiency, mass 1450 kg). `powertrain()` in `rapier-vehicle.js` gives engine torque from the power curve, automatic shifts with a 0.16 s torque cut, a rev limiter and a traction limit; it sets `phys.gear` and `phys.rpm`. Flat-road test: 0-100 km/h 3.3 s, 0-200 10.7 s, top 270 km/h, 270 to 0 in 194 m. All `pt` settings have tuner help. `phys.rpm` and `phys.gear` are ready for `audio/engine.js` to follow (it still guesses the gear from speed): please wire them in. Truck and bike still use the simple model.
Tuner: all handling numbers are now live in the tuner under "handling" (`ARCADE` registered in `main.js`, help in `tuning-docs.js`, root added to the selftest), and the car's `pt` powertrain numbers show under the car. Rajul can drive in the game and change them live to find what feels right; the values he settles on can be published as settings. I renamed `ARCADE.grip/aero/brake` to `gripMul/aeroMul/brakeMul` and `pt.up` to `pt.upshift` to avoid clashing with the tuner's range guesses.
Downforce added (`ARCADE.downforce`, tuner "handling"): the car is pressed into the road with 0.5 x 1.2 x ClA x speed squared, so grip rises with speed. At 211 km/h, peak cornering goes from 1.04 g to 1.13 g (+9%). Straight-line numbers unchanged.
Tyre model (Pacejka Magic Formula, standard published curve): `tyres()` in `rapier-vehicle.js` replaces Rapier's hard-cap side friction on the car (above 2.5 to 6.5 m/s the wheel's side friction stiffness is faded to 0). Each wheel gets a slip angle, a sideways force = mu x load x MF(slip angle) applied at its contact patch, and grip falls past the peak, so the car breaks away progressively. Settings in the tuner under "handling": tyreB, tyreC, tyreE, lockGrip (handbrake), tyreAssist (how much of the turn-in help stays on; was 1, now 0.3 with the tyre model). Checked: load sums to the car's weight; front and rear slip angles agree in a steady turn; straight at 270 km/h with 0.00 m drift (the old model drifted 3.5 m); body slip grows smoothly 0.01 to 0.09 as steering rises (old: nothing, then a snap); handbrake now steps the tail out. Toggle `ARCADE.tyre` off to get the old behaviour. Car only; truck and bike unchanged.
Status: open

## 2026-11-15 12:00  Mountain roads fixed: grade now stays at 11-14% (N3)
Branch: feat/n3-router-grade
What changed: `src/world/locations.js`: the Alps and Himalayas set `maxCut: 1000` (never fall back to the steep stretch; tunnels and cuts absorb the height instead) and `hardGrade: 0.11`. Before: 7-24% (Alps) and 10-21% (Himalayas) of the road was over the hard limit, peaking near 21%. After: about 2% over, peak 14.4% (11.6% on one seed). Cost: more of the road is tunnel (Alps up to 35%, Himalayas up to 37% on one seed, 0-18% on the others). Checked by eye: the Himalayas road climbs a valley with a cut bank, and a 43 m cut turns into a tunnel. Re-run `node tools/locations_check.mjs` to see the numbers.
For the other stream: nothing. Driving physics on 11-14% grades is worth a test with the car, truck and bike (the truck may struggle).

## 2026-11-15 11:00  Mountain roads are too steep (fixed, see the 12:00 entry)
Branch: feat/n3-grade-check
What changed: `tools/locations_check.mjs` now also prints the share of the road above the hard grade limit. Finding: Alps 7-24% and Himalayas 10-21% of the road is over the hard limit (14-15%), peaking near 21%; Mumbai 0%, default 3.7%. Allowing deeper cuts and a lower fallback grade (`maxCut`, `lastGrade`) helped some seeds and made others worse (Himalayas coast 21% to 47%), so I kept the config as it was. The cause is the route choice in `router.js`, not the limits. Next: make the router prefer gentler lines in the mountains (switchbacks) and re-measure with this check.
For the other stream: nothing. Expect the climb to feel steep in the Alps and Himalayas until this is fixed.
Status: done (fixed by the 12:00 entry: hardGrade 0.11, maxCut 1000)

## 2026-11-15 10:00  Marine Drive fixed and placed near the start (N3)
Branch: feat/n3-marine-drive
What changed: `src/world/landmarks.js`: the Marine Drive strip was never rotated into its own frame, so the sea wall, lamps and tetrapods drifted 100+ m off the road; fixed. It now carves its own bay in front of the sea wall, and the sea-side parts sit 7 m further from the road. Landmark search now prefers spots near the requested distance (Mumbai's three landmarks were 1.1 km behind the start). `src/world/locations.js`: Marine Drive no longer needs natural sea and starts the search at s=250.

## 2026-11-14 20:00  Coarser outer terrain ring on med and high (speed)
Branch: feat/n3-terrain-lod
What changed: `src/core/config.js` (shared): the med and high tiers get one more, coarser terrain ring (8 cells per tile at the far edge). Medium: 310k to 282k triangles per frame (-9%), same scene. Not checked by eye on hills; look at distant ridges in the Alps and Himalayas.
For the other stream: nothing.
Status: done

## 2026-11-14 19:00  Far rocks are cheap now (N3/N4 speed)
Branch: feat/n3-world-polish
What changed: `src/world/scatter.js`: real-scan rocks (about 650 triangles each) only in the near tiles; far tiles use the drawn rock. On the medium tier, triangles per frame go from 527k to 419k (-20%); rocks were about 45% of the scenery triangles. Next biggest: terrain tiles (about 184k).
For the other stream: nothing.
Status: done

## 2026-11-14  ANSHUL: please deploy main to Cloudflare (everything is merged)
Branch: main (commit e8cac92 or later)
What changed: pull requests 1 to 12 are all merged and `cloudflare/public` is already staged from `main`. Nothing is live yet: Rajul's PC is signed in to wrangler as his own account (`mailrajulsingh.in@gmail.com`), and the project rule is that only `rawatanshul525@gmail.com` is used, so Rajul did not deploy.
For the other stream (Anshul, on the PC signed in as the project account):
```bash
git switch main && git pull
npx wrangler whoami                  # must say rawatanshul525@gmail.com
cd cloudflare && npx wrangler deploy
```
In this release: road styles, bridges, tunnels with the Atal-style gate, the tuner dashboard (`/tuner.html`), photographic ground and roads, real-scan trees and rocks, quality tiers, autodrive, phone touch controls, new brake / handbrake / reverse controls (Space, X, S, Shift, E), seven camera views on V, and the car's engine sound from Rajul's own recording.
After deploying, check (about 5 minutes): the live `/` (original game) still plays; `/next.html?play` loads and drives; `/tuner.html` opens; open it on a phone and tell Rajul how it runs (nothing has been measured on a phone). Then, once, the tuner Publish setup in `HANDOFF.md` (KV namespace, `TUNER_PASSWORD`, deploy again).
Also please read `HANDOFF.md` "What is next" and tell Rajul which Stream B items you will take (vehicle models and paint, weather and sky realism, rain sound in tunnels, the physics constants for the tuner, traffic). Please also listen to the new engine sound on the live site and say what is off.
Status: open

## 2026-11-14  Engine sound from Rajul's recording, camera views on V (branch fix/driving-feel)
Branch: fix/driving-feel
What changed: `src/audio/engine.js` plays the car's engine from `assets/audio/engine_car_*.wav` (seven seamless loops cut from Rajul's own recording by `tools/make_engine_loops.mjs`, analysed with `tools/analyse_sound.mjs`): one continuous looping source per loop, the two nearest the target pitch crossfaded (equal power) and pitch-shifted at most about 20%; falls back to the synthesised engine if the files fail; `?engine=synth` forces the old one. A first version (overlapping 3 s chunks) caused a phasing swirl and was replaced. No free modern-car engine pack with a usable licence exists (searched): paid packs cost $7.50 to $30 and restrict redistribution. `src/vehicle/vehicle.js` has seven camera views (`setMode`, `aim`): middle, far, close, hood, bumper, cockpit, cinematic; V cycles them (`controls.js` action `cam`), C toggles the driver's seat, the choice is saved in `S.cam`.
Not verified: nobody has heard the new sound. If it is still unnatural, the real fix is a better recording: hold steady revs at about six speeds for 10 s each (or a rev-up from idle to the limit), recorded in the same place, so each loop is cleaner than the road-and-wind recording we cut from.
For the other stream: hard-coded constants (engine pitch range 62 to 330 Hz, loop pitches in `engine_car.json`) are tuner candidates.
Status: open

## 2026-11-14  Brakes, handbrake, reverse, grass, engine sound (branch fix/driving-feel)
Branch: fix/driving-feel
What changed (Stream B's files, at Rajul's request): controls are now throttle (W/Up), reverse (S/Down), foot brake (Space), handbrake (X), boost (Shift), autodrive (E); the input is `{ steer, throttle, brake, hand, rev }` (`src/input/controls.js`); the touch controls gained Hand and Rev circles. `src/vehicle/rapier-vehicle.js`: the foot brake never reverses; reverse brakes first while rolling forward and is capped at `revTop`; the handbrake locks the rear wheels and cuts rear grip 50%; engine braking when coasting is now a body force (about 0.3 + 0.008 u m/s2) instead of a wheel brake, because wheel brakes work worse on low-grip surfaces: that is why the car glided on grass. `src/vehicle/physics.js`: grass drag 0.06 to 0.15, sand 0.14 to 0.3, gravel 0.03 to 0.05, grass grip 0.62 to 0.55; reverse tops raised (car 9 m/s). Found: the physics engine has about 1.3 m/s2 of built-in drag at speed on top of these. `src/audio/engine.js`: the car engine is a darker modern six (pulse rpm/19, cutoffs 240 to 1350 Hz, whine and turbo whistle almost removed, wind and hiss turned down), plus tyre squeal on slip and handbrake.
Sound was compared with a recording of Rajul's own car (analysis in `tools/analyse_sound.mjs`; numbers in `CHECKLIST.md`). Honest limits: nobody has listened to the new sound; measuring our synth at speed in a hidden browser pane was too noisy to calibrate. A sample-based engine from the recording is the next step if the synthesis still does not sound like the real car.
For the other stream: these constants are still hard-coded (candidates for the tuner).
Status: open

## 2026-11-14  Car felt like it glided: body pitch and lean never moved (branch fix/car-feel)
Branch: fix/car-feel
What changed (in Stream B's files, at Rajul's request): `src/vehicle/rapier-vehicle.js`: the code that dips and squats the body (`axL`, `dPitch`, `dRoll`) ran before `this.read()` updated the speed, so it always compared the old speed with itself: acceleration read 0 and the body never pitched. It now runs after `read()`, with clamped inputs. Measured on the car: squat about 3 degrees on launch, dive about 4 degrees under hard braking, lean about 4.5 degrees outward at 0.5 g sideways (the roll sign was also flipped: the first version leaned into corners). `src/vehicle/vehicle.js`: a small speed-dependent tremble of the body (more on gravel and grass) because the road is perfectly smooth.
For the other stream: the physics constants are still hard-coded (0.02 and 0.013 pitch, 0.022 roll): good candidates for the tuner. Not tried on a phone or by ear: the engine and tyre sound (`audio/engine.js`) also affect how "connected" the car feels.
Status: open

## 2026-11-14  Autodrive, slowroads-style touch controls, phone camera, sparser Green Valley (branch feature/mobile-controls)
Branch: feature/mobile-controls
What changed (some of it in files Stream B owns, at Rajul's request after he showed slowroads.io on his phone):
- `src/input/autodrive.js` (new): the car follows the road, cruise 70 km/h, slows for the sharpest bend within 90 m; key E, an Auto button, or the AUTO circle on touch. Steering or braking by hand turns it off. Tested: 1.5 km on the default road (never more than 2 m off the centre line) and 2 km through the Himalayas including tunnels.
- `src/input/touchui.js` (new): throttle lever, BRAKE, BOOST, steering arc, RESET, CAM, AUTO; replaces the arrow pads on touch devices; `?touch` forces it on a computer. `src/input/controls.js` gains an `analog` input and the `E` action.
- `src/vehicle/vehicle.js`: chase camera honours `camMul` (closer, lower, wider); `main.js` sets it on touch devices.
- `next.html`: an Auto button in the top bar. `src/world/locations.js`: Green Valley has fewer trees set further from the road and more, taller grass (`nature.js` grass card 0.9 m).
For the other stream: please keep these when you work on input and the camera; tell Rajul's Claude if the touch layout clashes with anything you plan. Nothing was tried on a real phone.
Status: open

## 2026-11-14  Quality tiers for the photoreal look (branch render/quality-tiers)
Branch: render/quality-tiers
What changed: `?q=low`, `med`, `high` now also pick the ground and scenery: low keeps the old cheap ground and uses fewer tree, plant and rock variants; med uses a lighter photographic ground (`makeGroundMaterial('lite')`); high uses the full one. `?ground=flat|lite|full` and `?nature=flat|low|full` override. `src/main.js` (shared) chooses the levels. Measured on an M4 at 1400x800 (Alps): the photographic ground alone cost about 34% more than the old ground, the scanned scenery about 16% (timings drift when the browser pane is hidden, so treat them as rough); draw calls and triangles per tier: low 176 / 96k, med 523 / 430k, high 898 / 895k. High is about 24 ms there: too slow, needs tuning.
For the other stream: nothing needed.
Status: open

## 2026-11-14  Everything is merged into main: please deploy
Branch: main
What changed: PRs 1 to 5 are merged: road styles, bridges, tunnels, the tuner dashboard, the photoreal work (r187, photographic ground and roads, real-scan scenery, the Atal Tunnel) and the updated `HANDOFF.md` and plans. `cloudflare/public` was re-staged from `main`. Nothing is deployed: Rajul's PC has no wrangler login and the account is Anshul's.
For the other stream (Anshul, on the PC logged in to wrangler):
```bash
git switch main && git pull
cd cloudflare && npx wrangler deploy
```
Then, once, the tuner Publish setup in `HANDOFF.md` (KV namespace, `TUNER_PASSWORD`, deploy again). Look at `/next` on a phone before sharing the link: nothing here is measured on phones. Read `HANDOFF.md` section "What is next" and tell Rajul which Stream B items you will take.
Status: open

## 2026-11-14  Atal Tunnel: Blender gate and tiled interior (branch render/r0-poc)
Branch: render/r0-poc
What changed: the tunnel gate is now a real model made in Blender (`assets/atal/atal_gate.glb`, script `tools/blender/build_atal_gate.py`): banded stone pillars with red courses, layered timber, corrugated roof with barge boards, and a name board that the game paints ("ATAL TUNNEL, ROHTANG" in the Himalayas, "TUNNEL" elsewhere). Pillars move out and the span stretches for wider road styles. The tunnel walls and ceiling use real cream tiles. The box gate stays as a fallback while the model loads. The other Blender scripts (plant cards, rocks) are in `tools/blender/` too; they were run from a scratch folder, so paths inside them need adjusting before reuse.
For the other stream: nothing needed.
Status: open

## 2026-11-14  R5: real-scan trees, plants and rocks (branch render/r0-poc)
Branch: render/r0-poc
What changed: new `src/world/nature.js`. Trees, shrubs, ferns and grass are crossed cards textured with Blender renders of real Poly Haven scans (6 conifer variants, 1 broadleaf, 2 shrubs, grass); rocks are two real scans cut to ~700 triangles. `Scatter.setProps` swaps them in when loaded; `?nature=flat` keeps the drawn models. Assets in `assets/nature` (about 2.5 MB), sources in `assets/ASSETS.md`. The Blender scripts that made them are not in the repo yet (they live in a scratch folder): ask Rajul's Claude if you need to redo them.
Measured (M4, 1400x800): 6.5 ms per frame against 5.6 ms with the drawn scenery; 728k triangles against 281k.
For the other stream: nothing needed. The huge Poly Haven hero trees (pine_tree_01 958 MB, fir_tree_01 487 MB) are NOT usable in a browser game: do not download them.
Status: open

## 2026-11-14  R1: photographic ground and road materials (branch render/r0-poc)
Branch: render/r0-poc
What changed: new `src/world/groundmat.js`: the terrain now uses a standard (PBR-lit) material blending real photos of grass, rock (triplanar on cliffs), sand and snow per pixel; the palette's vertex colour still sets the character of each place. `?ground=flat` brings the old drawn ground back. Roads use photographic asphalt, gravel and paving (`road.js` materials per surface, `roadstyles.js` colours and `mats`). Textures are CC0 from ambientCG in `assets/ground` and `assets/roads`; sources in `assets/ASSETS.md`.
For the other stream: nothing needed. Files changed that you own nothing of: `src/main.js` (shared: builds the ground material, installs it after `env.attach`).
Status: open

## 2026-11-14  R0 proof of concept: three.js r187 and a realism pipeline (branch render/r0-poc, not for merge yet)
Branch: render/r0-poc
What changed: `vendor/three` upgraded from r160 to r187 with the post-processing, CSM, KTX2, Draco and meshopt addons vendored. The game runs unchanged on r187; one fix: `PCFSoftShadowMap` was removed, `main.js` now uses `PCFShadowMap`. New `src/fx/pipeline.js` (multisampled half-float target, ambient occlusion, bloom, tone mapping), off unless `?fx=1` (or `?fx=lite` without AO). `main.js` (shared): imports it, resizes it, renders through it when on, exposes `__next.fx`.
Also with `?fx=1`: a real photographed sky (`assets/sky/drakensberg_puresky_1k.hdr`, Poly Haven, CC0, 1.1 MB; credit in `assets/ASSETS.md`) drives the image-based light and reflections, dimmed by the sun's height (`main.js` sets `scene.environment` and `scene.environmentIntensity` after `env.update`). It is one clear-afternoon sky, so it does not yet change with weather. The white car paint glares strongly in it: tune the paint material (Stream B).
Measured (Apple M4, 1400x800, forced GPU sync): plain 4.7 ms per frame, full pipeline 16.5 ms, without ambient occlusion 8.3 ms. Ambient occlusion is the expensive part, so it cannot be on for phones or weak laptops.
For the other stream: nothing yet. R2 (sky, weather, lights in `env/environment.js`) comes after this decision.
Status: open


## 2026-11-14  Tuner dashboard (tuner.html), first version
Branch: tuner/dashboard
What changed: a settings dashboard for Rajul and Anshul, at `tuner.html` (open it through `python tools/serve.py`). It shows the game beside a panel of sliders and colour pickers; changes apply live, and Export writes `settings.json`, which the game loads at start.
- `src/core/tuning.js` finds every number and colour inside the registered objects: `world` (the config), `vehicles` (`src/vehicle/defs.js`), `times` and `weather` (`src/env/environment.js`), `surfaces` (`src/vehicle/physics.js`). So **any number you add to those objects shows up in the dashboard by itself**, with a guessed range. Exact ranges go in `HINTS` in `tuning.js`.
- `src/main.js` (shared, small): registers the roots, loads `settings.json`, listens for dashboard messages.
For the other stream (Stream B owns the vehicle side):
- Physics numbers that are hard-coded inside `src/vehicle/rapier-vehicle.js` (spring, damper, tyre friction, gears later) are NOT in the dashboard yet. Move them into `body` in `defs.js` (or a new exported object registered in `main.js` with `registerRoot`) and they appear. Say which ones you want first.
- Engine sound and camera numbers are the same story (`src/audio/engine.js`).
- **Publish is built** (`cloudflare/worker.js`, `cloudflare/wrangler.jsonc`, Publish / Load live / History in the dashboard). It is NOT deployed, and the live site is unaffected until someone deploys: until the two setup steps below are done the API answers 503 and the game simply uses its defaults.
- **Every setting has an "i" button** with a plain-English explanation and a range that works well (`src/core/tuning-docs.js`). A new setting in the vehicle, surface or world tables needs an entry there or `node tools/selftest.mjs` fails (sky and weather entries are checked by eye in the dashboard: undocumented ones say "No description written").
- Not built: password protection for the tuner page itself. The page is harmless without the password (it cannot publish), but anyone could open it once deployed.
For Anshul (his PC has the Cloudflare login; one-time setup, about 5 minutes), after merging `tuner/dashboard`:
```bash
cd cloudflare
npx wrangler kv namespace create SETTINGS      # prints an id
```
then add that id to `cloudflare/wrangler.jsonc` as `"kv_namespaces": [{ "binding": "SETTINGS", "id": "<the id>" }]` and run:
```bash
npx wrangler secret put TUNER_PASSWORD         # choose the shared tuner password
cd .. && python tools/stage_cloudflare.py && cd cloudflare && npx wrangler deploy
```
After that `/tuner.html` on the live site can Publish, and every player's game reads the published settings when it starts.

## 2026-11-14  Atal-Tunnel-style portal and interior (on PR #4)
Branch: world/bridges
What changed: tunnels now have a pitched-roof gate on banded stone pillars with a name board in front of each portal, a green-roof hut beside it, a cream interior with warm light strips on both walls and orange cones along the lane edges (`src/world/tunnels.js`). The board text is `road.c.tunnelName` (Himalayas: "ATAL TUNNEL, ROHTANG"; elsewhere "TUNNEL"). The Himalayas location now starts in snow with the snowline at 3300 m (`src/world/locations.js`). Stylised to match the rest of the game, not photoreal: Rajul is deciding whether to go further.
For the other stream: nothing needed.
Status: open

## 2026-11-14  Tunnel night and rain fixes (on PR #4)
Branch: world/bridges
What changed: found by driving at night in rain. Inside a tunnel the game now hides rain and snow (`src/main.js`, shared, one line after `env.update`: it hides `env.rain` and `env.snowfall` when the camera is inside a mountain, checked as `terrain.height - terrain.drive > 4`). The tunnel walls have a faint glow and the lamps are bigger, with wall lamps, so it is never pitch black.
For the other stream: the rain and thunder SOUND still plays inside tunnels (`src/audio/engine.js` is yours): you could quieten it when `terrain.height(x, z) - terrain.drive(x, z) > 4` at the camera. The truck's chase camera works inside a tunnel (checked).
Status: open

## 2026-11-14  Two pull requests are waiting for Anshul to review and merge
Branch: world/bridges
What changed: nothing new. PR #3 (tuner dashboard, branch `tuner/dashboard`) and PR #4 (bridges and tunnels, branch `world/bridges`) are open against `main`. Rajul has left the merging to Anshul.
For the other stream: please review and merge both, #3 first (it unblocks the Cloudflare setup for Publish; steps are in the tuner entry below). After each merge, merge `origin/main` into your own branch and run `node tools/selftest.mjs`. If #4 shows a conflict after #3 merges, it is only `src/main.js` / `tools/selftest.mjs`: tell Rajul's Claude and it will fix it.
```bash
gh pr view 3 --repo anshulsingh2098/game-for-peace
gh pr view 4 --repo anshulsingh2098/game-for-peace
```
Status: open

## 2026-11-14  Tunnels replace deep cuttings
Branch: world/bridges
What changed: a cutting deeper than 18 m for 40 m or more is now a tunnel: the mountain is left whole over the road, a concrete tube with lamps follows the road, and an arched portal wall stands where the hillside starts to cover it (`src/world/tunnels.js`, `Road.tunnelW`, `Road.tunnelRise`, `Road.carriedW`). In the Alps and Himalayas 4 to 25% of the road is tunnel; the deepest remaining cutting is about 30 m (it was 266 m).
For the other stream: `src/main.js` (shared, one line): the chase camera's floor now uses `terrain.drive` instead of `terrain.height`, so in a tunnel the camera stays on the road instead of popping up onto the mountain. Wheels still roll on `terrain.drive`, unchanged. Traffic: `road.carriedW(s) > 0` means a bridge or tunnel.
Status: open

## 2026-11-14  Phase 2 started: bridges
Branch: world/bridges
What changed: where the road crosses water it is now carried on a concrete deck with rails and piers instead of a raised causeway. New `src/world/bridges.js`; `router.js` gets `bridgeW(s)` (1 on a bridge, 0 on land); `road.js` draws the bridges and drops the verge on them. On a bridge the land is left alone (the sea stays), `terrain.drive()` returns the deck height, and a car that leaves the deck edge falls into the water.
For the other stream: `terrain.drive(x, z)` is what wheels roll on, as before, so the vehicle code needs no change. There are no collision walls on the rails yet: the car can drive off the side (say if you want invisible walls added to `near()`). Traffic should use `road.bridgeW(s) === 1` if it needs to know it is on a bridge.
Status: open

## 2026-11-14  Phase 1 is on main (PR #2 merged)
Branch: main
What changed: nothing new; the entry below is now in `main`.
For the other stream: bring it into your branch with
```bash
git fetch && git merge origin/main
node tools/selftest.mjs
```
Stream A starts Phase 2 (bridges, tunnels or switchbacks, location polish) on `world/bridges`.

## 2026-11-14  DIRECTION CHANGE: the whole game goes photorealistic (read `team/photoreal-plan.md`)
Branch: plan/photoreal
What changed: nothing in code yet. Rajul decided the game should look as real as possible (the flat stylised rule is dropped), with free assets first and Blender for the rest. The plan keeps three.js but upgrades it from r160 and splits the work by stream (R0 to R6).
For the other stream: this touches your areas: `env/environment.js` (sky, weather, light), vehicle models in `assets/`, `audio/`. Please read the plan and tell Rajul whether the split works for you before either of you starts. R0 (renderer upgrade) must land first and will edit `src/main.js`.
Status: open

## 2026-11-14  Phase 1 done: road styles, textures, bend fix, city roads
Branch: world/road-styles  Commit: see `git log` (latest on the branch)
What changed:
- New `src/world/roadstyles.js`: five road styles as data (two-lane, highway, boulevard, dirt, gravel). `road.js`, `router.js`, `terrain.js`, `scatter.js` read widths from it.
- **Look:** roads keep the game's original stylised look (the same drawn road texture, tinted per surface). Photoreal textures were tried and removed because they clashed with the rest of the game. Anything new must match the existing flat, low-poly style.
- Shared files touched, all small: `src/main.js` (new `?road=highway|boulevard|dirt|gravel` option; RoadMesh gets `road.style`), `src/core/config.js` (new `road.style`, `minRadius` 75 -> 130), `tools/selftest.mjs` (one new check; 20 pass).
- Mumbai, Delhi, Agra use the boulevard, California the highway (`src/world/locations.js`).
For the other stream: before your own merge, bring this in:
```bash
git fetch && git merge origin/world/road-styles
node tools/selftest.mjs
```
The road lookup in `router.js` (`nearest`, `at`, `hit.d`) is unchanged; `road.style` now also exists (widths, `outer`, `surfaces`) if traffic needs lane positions. No `SURFACES` keys were added: dirt and gravel use the existing `gravel`.
Status: open

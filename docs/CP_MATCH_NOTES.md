# CP match: defects seen in screenshots and the console, and improvements to make (20 Nov 2026)

Collected while taking screenshots and reading the browser console (visible pane, desktop Mac, `q=med`). Each line says what was seen and where; nothing here is fixed unless marked. Severity: A = looks wrong or breaks play, B = clearly short of the GTA and CP references, C = tidy-up.

## Seen and probably wrong
- **A. [FIXED 20 Nov 2026, phase 1: the catwalk box was sized per axis and never turned, so a diagonal street got a 6 m by 6 m slab; now 8.2 m long along the board and thin; seen at x 787, z -2258] Hoardings (billboards on poles) draw a huge dark slab under or over the board**, like a floating black table (seen at the signalled junction near x 794, z -2263 and in the sign screenshots). `streetlife.js` hoarding geometry; needs a real frame and a thin back.
- **[RETRACTED 20 Nov 2026] Quality governor drops to Eco**: wrong. The ECO label in the top bar and the badge at the bottom left is the DRIVE MODE (Eco, Normal, Sport, Off-road), switched by the owner's clicks on that button. No evidence the resolution governor trips; its code (`gov` in `main.js`) only lowers the resolution when frames average over 30 ms.
- **A. Frame hitches while tiles build**: worst frame 167 ms in one run, 1,033 ms in another (p99 66 ms) in a tab that had been reloaded many times; clean tabs gave worst 39 to 45 ms. Needs a build-time budget check with the new wear and signs.
- **A. Memory grows**: JS heap 270 to 531 MB in fresh tabs, up to 958 MB after many reloads. Look for tiles, canvases and textures that are not disposed (the new sign atlas and plaza texture are created once, but check tile disposal of `rsign` and `junk`).
- **B. [PARTLY FIXED 20 Nov 2026, phase 2: asphalt tint 2.6 to 6, seen at dawn on the Inner Circle: a lighter grey, lane lines still crisp; GTA's mid grey still needs a midday look and the track and patch colours re-matched] Road colour reads almost black** (Karol Bagh, the Inner Circle at dawn); GTA asphalt is mid grey with lighter patches. The wheel-track strips show as dark bands from above. Lighten the road tint and soften the tracks.
- **B. Bare orange earth between roads and buildings outside CP** (Karol Bagh, Old Delhi, markets): the same fault CP had. Needs paving, forecourts and ground variety by area.
- **B. Cars (traffic) are boxes, pedestrians are cartoon figures, trees are crossed picture cards or lollipops, hedges are green boxes, plaza kiosks are blue-roofed boxes.** Placeholder shapes against the GTA references.
- **B. CP columns are still square posts** (now 5.6 m by 0.7 m); no base or capital, no round fluted shaft; facades are flat boxes with identical window rows and plain roofs; no corner drum blocks or pediments; brand boards are small and dim.
- **B. Plaza slabs**: checker pattern too regular and too light, no tactile strip, no polish; the arcade walk under the columns still uses the old pavers; the kerb where the plaza meets the pavement is the plain kerb.
- **B. Lighting is flat and hazy**; the dawn tint turns everything brown; no hard sun and long shadows on the street like the GTA and CP photos.
- **B. [FIXED 20 Nov 2026 (A-2026-11-20-06): name boards, speed plates and gantries now at all junctions of tertiary roads and up, give way at minor roads, chevrons on bends, Hindi on every board] Signs only at signalled nodes** (40 poles a tile at most): none at ordinary junctions, no STOP signs on side roads, no overhead direction boards, name blades small and not Hindi; Inner Circle entries get no stop line (those nodes are not signals in the data).
- **C. Console [CHECKED 20 Nov 2026]**: the only 404 is `GET /api/settings` (the tuner's stored settings, served by the Cloudflare Worker, absent on the local dev server): expected and harmless locally; `favicon.ico` and the touch icon are linked in `index.html` and load. The city JSON files appear once each in the network list (not fetched twice there), but Chrome warns they are "preloaded but not used within a few seconds": a timing warning, left alone because `index.html` is shared and the preload speeds up loading.
- **C. `window.__cam`, `window.__next` are debug hooks left in production code.**

## Not measured, so unknown
- Feel of the new steering by a person; phone frame rate and memory; the wheel spin against speed with the car drawn at 0.88; whether the wider lanes make buildings overlap roads elsewhere (only the audit counts were checked); the ground-truth heights and widths I estimated for CP (blocks 15.5 to 17.5 m, circles 12 m and 16 m).

## Improvements, in order of visible payoff
1. Fix the hoarding slabs (A) and the governor trips (A).
2. Round fluted columns, facade modules, drum corners, brand boards and shop light (CP plan steps 3 to 5).
3. Road colour and tracks lighter; paved ground outside CP; hedge, planter and kiosk shapes.
4. Light and colour grade: warm stucco, hard sun, shadow under the arcade, dusk and night glow.
5. Signs: STOP and give-way signs at side roads, overhead direction boards, Hindi on name blades, bus stops.
6. Replace the placeholder cars, people and trees (needs assets with a licence recorded in `assets/ASSETS.md`).
7. Per-area wear: a measured grime map instead of my area guesses; tyre marks near junctions; drain grates; broken kerbs; bins and sweepers in the clean areas.
8. A driven lap and U-turn by a person in each vehicle; a scripted lap for regression.

## What is next (20 Nov 2026, after phases A to C), in order
1. **Measure on a visible window, then a phone.** Every frame number since the wear overlays, columns and signs is missing (the window was not visible); bench `?play&city=delhi&q=med&bench=30` on the desktop and a named phone; check triangles and heap. Gate for everything below.
2. **A person drives it** (lap, U-turn, a junction turn) in each vehicle: `steerMax` 0.62, the car at 0.88 scale and the lower camera were set from numbers, never felt.
3. **Delhi markings decision**: the double yellow centre lines and white edge lines follow the owner's GTA frames; Delhi's own roads vary (white centre lines are common): say which to use where.
4. **Pavements and surroundings** (frames G8, G9): painted red and white kerbs, mast-arm signals and LIVE signal heads are DONE (20 Nov 2026); still to do: wide pavements, planting strips with clipped hedges and palms (needs a palm asset), power poles with wires.
5. **CP facade**: brand-board band and plain drum corner blocks are DONE (20 Nov 2026); arched drum windows with sills, a pediment, string courses, pilasters and blade signs are DONE and the night glow was looked at (20 Nov 2026); soffit lights, glowing street lamp heads and drum window surrounds are DONE (21 Nov 2026); still to do: light that falls on the walk and the columns (a real light or a baked gradient), the street lamps' light on the road, balustrade posts, arched heads and shutters on the upper windows, paired corner columns, a deeper entablature, hanging lamps, the dusk grade.
6. **Road surface finish**: oil stains and soft irregular blotches (the bands are still regular strips), tyre marks near junctions, drain grates, red and white painted kerbs, real flutes on the columns.
7. **Placeholders**: traffic cars, people, trees, hedge boxes, plaza kiosks (needs licensed assets recorded in `assets/ASSETS.md`).
8. **Anshul's Claude to review** the lane widening (audit `footway_run` 94 to 120), the steering lock and the car scale (A-2026-11-20-01).
9. **Merge PR 101** (the owner's word; it is large: P1 infill, CP colonnade, roads, markings, signs, wear, physics values, car size): consider splitting if a reviewer wants smaller pieces.
10. **Other parts of Delhi** get the same kits only after CP is accepted by the owner at the six camera spots.

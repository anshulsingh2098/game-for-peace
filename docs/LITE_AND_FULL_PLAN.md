# Plan: Web Lite (Delhi only) and Full (downloadable, all India)

Status: DRAFT by Stream B (Anshul's Claude), 2026-11-17. Needs Anshul's and Rajul's yes before work starts.

## Why

The current build tries to run the whole game (all India, many locations, heavy cars, city pack) in one browser page. On a Mac mini M4 and a laptop it lags. A browser tab has a hard ceiling (memory, no real threads for streaming, no big downloads). So we split the product in two, from one codebase:

| | **Web Lite** | **Full** |
|---|---|---|
| Where | Browser, instant play, free | Downloadable app for PC (Windows/Mac) and mobile |
| World | **Delhi only** | All India, other cities, later more |
| Features | Driving and GTA-like loop in Delhi: traffic, pedestrians, on foot, activities, radio, missions | Everything in Lite plus all regions, heavy graphics |
| Graphics | Budgeted to run well on weak devices | Heavy: high-poly cars, PBR, long draw distance, WebGPU or native renderer |
| Download | Under 25 MB to first drive, Delhi tiles stream in | Large asset packs installed once |

## Targets (the gates; "done" means these are measured, not guessed)

- Lite: steady 60 fps on an M-series Mac and a mid laptop with integrated graphics; 30 fps on a mid phone; p99 frame under 25 ms; no hitch over 50 ms while driving.
- Lite: first drive in under 10 s on a normal connection; under 25 MB downloaded before the first drive; heap under 300 MB.
- Full: 60 fps on a mid gaming PC at high; defined per device class after Phase 5 benchmarks.
- Measured with `&bench=30` (already in the repo) on real devices, results kept in `PERFORMANCE.md`.

## Phases

### Phase 0: Measure and freeze scope (about 1 week)
- Run the benchmark on the M4 Mac, the lagging laptop and one phone: low and med, India map and Delhi city. Record in `PERFORMANCE.md`. Find out which cost dominates (GPU fill, draw calls, JS, generation spikes).
- Add a build switch `BUILD = lite | full` (one constant, read in `main.js` and the stage script) so one source tree makes both.
- Freeze Lite scope (this document's table). Anything outside it is a Full feature.
- Resolve the open merge: bring `origin/main` into `vehicle/cars-and-gears` (14 files conflict; see `team/stream-b.md`) so both streams work from one base.

### Phase 1: Cut Lite down (1 to 2 weeks)
- Lite boots straight into the Delhi city. No India map, no location picker, no other regions in the Lite bundle.
- Lite garage: 2 cars (one road car, one more) at a low-poly budget (15k triangles or less, few draw calls, shared materials). The 68k-triangle cars move to Full.
- One quality tier plus automatic adjustment (see Phase 2). Remove the tier menu from Lite.
- Menu simplified: Play, Garage, Settings.
- Lite stage script ships only Delhi assets (`tools/stage_cloudflare.py --build lite`).

### Phase 2: Performance engineering for Delhi (2 to 3 weeks)
- Draw calls: merge static city geometry per tile, instance repeated props, share materials; target under 300 draw calls.
- Tile generation and streaming in a Web Worker, spread over frames, no main-thread spikes.
- LOD for buildings, cars, props; cheaper far skyline.
- Shadows: one cascade, smaller map, short distance; off on weak devices.
- Texture compression (KTX2) and mesh compression (meshopt) once the benchmark shows download or memory limits.
- Adaptive quality: watch the frame time and step resolution scale, shadows and draw distance down (and back up) automatically.
- Physics and traffic on a fixed step, bounded pools (the runtime in `src/core/runtime.js` already supports this).

### Phase 3: GTA-like loop in Delhi (3 to 5 weeks, overlaps Phase 2)
- Traffic and pedestrians at Lite budgets (already started: N12, N13).
- On foot, enter and exit vehicles (N14), activities and missions (N15), radio, day and night, weather, wanted-style events if wanted.
- Each feature must stay inside the Phase 2 budgets; a feature that breaks the gate is cut back, not shipped.

### Phase 4: Launch Web Lite
- Deploy to Cloudflare from a scratch folder as today (never from `cloudflare/public`).
- Lite telemetry: anonymous frame-time and device class, so we see real devices.
- Phone gate: two real phones hold 30 fps.

### Phase 5: Full client (starts after Lite is stable)
- Packaging: PC app (Tauri or Electron wrapper around the same engine, so no rewrite), mobile app (Capacitor or native wrapper) with local asset packs.
- Downloadable content packs: India world, each extra city, high-detail cars, high-res textures, music.
- Heavy graphics path: WebGPU renderer, PBR materials, high-poly cars, long draw distance, post effects.
- Cloud or local saves shared with Lite where possible.

### Phase 6: Engine decision for Full
Only after Phase 5 benchmarks: stay on the web engine inside a native shell, or move Full to a native engine (Unity or Unreal) and keep Lite as the web build. We decide with numbers, not before. Moving early would throw away the Delhi city, road, traffic and vehicle code.

## Who does what

| Phase | Stream A (World, Rajul) | Stream B (Vehicle and Game, Anshul) |
|---|---|---|
| 0 | Benchmark Delhi city on devices; clean `main` | Benchmark vehicle and India map; merge `origin/main`; add the `BUILD` switch (shared `main.js`, small) |
| 1 | Delhi-only world bundle, boot into Delhi, remove other regions from Lite | Lite garage (2 low-poly cars), simplified menu, Lite stage script |
| 2 | Tile merge and instancing, worker streaming, building and far LOD, shadows for the city | Car LOD, physics and traffic budgets, adaptive quality, texture and mesh compression |
| 3 | Delhi content: landmarks, missions' places, streets | Traffic, pedestrians, on-foot, activities, radio |
| 4 | Delhi launch checks | Deploy, telemetry, phone gate |
| 5 | India world and other cities as packs | Packaging, high-detail cars, heavy renderer path |
| 6 | Input to the decision | Lead the decision |

Shared files (`src/main.js`, `src/core/config.js`, `tools/selftest.mjs`, `tools/stage_cloudflare.py`) change in small, logged steps, as `CLAUDE.md` says.

## Decisions needed from the owners

1. Is Lite Delhi-only with 2 cars, as above?
2. PC and mobile Full app: web wrapper (Tauri/Capacitor, reuses everything) first, native engine later only if needed?
3. Which devices are the official minimum for Lite?
4. Is anything else a must-have in Lite (for example a wanted-level or police)?

## Risks

- Delhi city alone may still be too heavy on weak phones; Phase 0 numbers decide how far geometry must drop.
- Two builds from one tree can drift; the `BUILD` switch and one selftest for both guard against it.
- A native-engine move for Full means rebuilding the world and vehicle code; hence Phase 6 waits for data.

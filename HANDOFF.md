# Handoff

State of the work as of 14 November 2026. Read `OVERVIEW.md` first for what the project is.

## Where things stand

- **Branch checked out:** `phase/3-driving` (tip `52680e3` plus the two documentation files).
- **`main` and GitHub:** both at `ebca95a`, the original game with three bug fixes. None of the engine rebuild is merged or pushed.
- **Live site:** deployed from the `main` version by another session. It does not include the new engine.
- **Self-test:** 15 checks pass (`node tools/selftest.mjs`).

Branch chain, each building on the one before: `main` → `phase/0-groundwork` (phases 0 and 1) → `phase/2-roads` → `phase/3-driving`.

## Uncommitted work in this folder that is not mine

Several sessions have used this one checkout. These changes belong to them and are deliberately left alone:

| Files | From | Note |
|---|---|---|
| `audio.js`, `index.html` (modified) | Music interface session | Local tracks and radio streams for the current game. Not reviewed. |
| `assets/car_02_sport.*`, `assets/car_03_rally.*`, `dev/build_car2_sport.py`, `dev/build_car3_rally.py`, `dev/previews/car2_*`, `car3_*` (untracked) | Vehicle model session | Sports car and rally hatchback models. Not reviewed, not wired into either game. |

Rules that follow from this:
- Commit with explicit paths (`git add -- src tools next.html …`), never `git add -A`.
- Do not switch to `main` or merge until those changes are committed or set aside by their owner; a branch switch carries them along.
- `cloudflare/public` is the live deploy folder. Do not run `tools/stage_cloudflare.py` against it without the owner's say-so.

## What is finished in the new engine

- Terrain from a seed with sea, lowland and mountains; tiles in detail rings; far ring to about 5 km; floating origin; pooled buffers.
- A road that grows on demand in both directions, graded into the land; two-lane surface with markings.
- Trees, rocks, bushes and grass per tile, kept clear of the road; rippled water.
- Driving the car, truck and bike anywhere: grip per surface, slopes, reverse, water, tree and rock collisions; chase and driver cameras; keyboard, touch and gamepad; speed and surface read-out.

## What is next (rest of Phase 3)

1. Sky, time of day and weather, ported from `game.js` (`TIMES`, `TOD_KEYS`, `WX`, sky shader, rain, snow, wet road).
2. Headlights and tail lights (`LIGHTS`, glow sprites, spot light).
3. Engine sound and radio, reusing `Sound` and `Radio` from `audio.js`.
4. Buffs and paint.
5. Menu, garage, settings and pause on top of the new engine, then switch `index.html` over. This step edits `index.html` and `audio.js`, so it must wait until the music session's changes are settled.

## Known problems to pick up

- **Road over water:** 0 to 13% of road length on test seeds runs on a causeway. Bridges are planned with road styles (Phase 5).
- **Deep cuttings:** one test seed (`bay`) has a cutting over 100 m deep. Tunnels, or a router that can make switchbacks, would fix it.
- **Tight bends:** the smoothed centre line can be as tight as about 45 m radius against a 75 m target, which is too tight for high speed. Raising `road.minRadius` in `src/core/config.js` is the quick fix.
- **Frame rate not measured on a visible tab.** Frame cost was measured by stepping frames by hand (8 to 10 ms on this PC at medium quality). The browser pane throttled animation during testing.
- **Driving view never seen in a screenshot.** Orientation, cameras and steering direction were checked numerically only.
- **Wheel count:** each model reports twice as many wheel nodes as wheels (8 on the car). Spin and steer are applied to all of them, as in the current game; check for double rotation if wheels look wrong.
- **Old seeds changed:** sea was cut from 46% to 22% of the world in Phase 2, so worlds from Phase 1 look different.

## How I test engine work

- `node tools/selftest.mjs` for the pure modules.
- `python tools/serve.py 8791`, then the browser at `http://localhost:8791/next.html?q=med&debug`.
- `window.__next` exposes the engine for checks from the console: `step(dt, now)` runs one frame by hand, `auto` overrides the driving input, `phys`, `road`, `grid`, `scatter` and `renderer` are the live objects.
- A leak check is a drive of several kilometres while watching tile, scenery and road-piece counts stay flat.

## Other sessions

- "Game for Peace repo check (fork)": handled accounts and the Cloudflare deploy; agreed to leave the engine to this session.
- "Engine rebuild: Phases 0-1 (terrain)": stopped early; nothing of it remains.
- "Music interface" and "Model the sports car and rally hatchback": idle, with the uncommitted work listed above.

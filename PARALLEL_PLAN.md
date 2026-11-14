# Parallel plan: two people, two Claudes, no collisions

Built from `HANDOFF.md` and `OVERVIEW.md` (state of 14 Nov 2026, branch `phase/3-driving`). Read those first.

Two streams. Each person owns one stream and one set of files. Claude only edits files its stream owns.

| | Stream A: **World** | Stream B: **Vehicle & Game** |
|---|---|---|
| Person | (name) | (name) |
| Works on | Roads, terrain, scenery, locations, landmarks, world tools | Driving, vehicles, traffic, sound, menus, radio, graphics, the old game |
| Branch prefix | `world/...` | `vehicle/...` |

## Status (15 Nov 2026, evening)

- **Merged:** pull requests 1 to 20 (see `HANDOFF.md` "Where things stand" for what is new). `main` builds, the self-test passes 27 checks, the daily check has no failures.
- **Waiting on people:** Anshul deploys `main` and reviews the handling, sound and car changes in his files (see `team/stream-a.md`); Rajul and Anshul run `CHECKLIST.md` on desktop and two real phones; the tuner Publish setup (KV and `TUNER_PASSWORD`).
- **Stream B has not started on its own:** `team/stream-b.md` has one entry, written by Rajul's Claude for Anshul. N1, N2 and N5 below are Stream B's phases; Rajul's Claude did parts of N1 (powertrain, tyres, steering, sound telemetry) and N2 (grade, paint, car model) at Rajul's request, **unreviewed by Anshul**.
- **Direction:** the whole game goes photorealistic, see `team/photoreal-plan.md`. It stays a calm endless driving game: no pursuits or missions without a product decision.

## Phases from here (the plan, replacing the original phase numbers below)

Each phase ends with: `python tools/daily_check.py` clean, the relevant `CHECKLIST.md` items ticked by a person, a merge into `main`, a deploy by Anshul, and `HANDOFF.md` updated. Stream A and Stream B can run side by side, as before; the "(A)" and "(B)" marks say who owns the files.

| Phase | Owner | Work | Done when |
|---|---|---|---|
| **N0** this week | both | Anshul deploys `main`. Both go through the whole checklist, on two real phones too. Listen to the engine sound. Every defect goes into the team log as an open entry. | Live `/next` works on two phones; the defect list exists and is ordered. |
| **N1** Driving and sound | B | Cleaner engine recordings (steady revs at six speeds, 10 s each) and a second pass on the loops; tyre, road and wind sounds; rain sound out of tunnels; a physics feel pass with the hard-coded constants moved into the tuner (`rapier-vehicle.js`, `physics.js`); sports car and rally hatchback integrated; manual gears. | Rajul drives the car, truck and bike and says the feel and sound are natural; the tuner exposes the physics constants. |
| **N2** Sky, weather, vehicle look | B (A helps) | An HDRI that follows weather and time of day (`env/environment.js`), fog and clouds, wet and snow surfaces, headlight beams; fix the white paint glare; detailed vehicle models and clearcoat paint (R2, R3); a calmer, hazier colour grade like slowroads. | Every weather at day, dusk and night looks right on the checklist; vehicles look close to real. |
| **N3** World polish | A | Tall-grass look and normal maps on the ground; tree levels of detail; Marine Drive seafront, southern coast landmark, better hotel model; bridge rail collision (shared collision list), steel truss bridge and retaining walls from the Atal references, interior signs and walkway; steep-land driving checks in the Alps and Himalayas; research real Rohtang terrain from open height data. | The checklist's world items pass in all eight locations; no known visual defect at a landmark. |
| **N4** Phones and speed | both | Compressed textures (KTX2) and meshes (meshopt), draw-call and triangle budgets per tier, tune the high tier (9.1 ms on a desktop now, see `PERFORMANCE.md`; phones not measured), a loading screen, automatic quality choice, a frame-time budget per tier. | Two real phones hold a steady frame rate on low and medium; download size is written down. |
| **N5** Features | B | Traffic with modes (`src/traffic/`, uses `road.carriedW` and the road lookup), the "My music" station for local songs in the radio, controller rumble, vehicle customisation in the garage, a password for the tuner page and the Publish setup. | Each feature has a checklist line and passes it. | **Status 16 Nov:** My music, controller rumble, saved-choice validation, tuner worker hardening and traffic are built and tested (PR 22); the tuner page's own login and the live Publish setup are still decisions/ops for the owner, and nothing has been tried on a phone.
| **N6** Switch-over and launch | both | `index.html` becomes the new engine, `game.js` is retired, `next.html` stays as an alias for a while, final full checklist, final deploy. | The live `/` is the new game and plays well on phones and computers. |

Order: N0 first, then N1 and N3 in parallel (different files), N2 after N1 starts, N4 once N1 to N3 have landed, N5 any time after N1, N6 last.

## File ownership (the anti-collision rule)

**Stream A owns:** `src/world/*` (router, road, terrain, tiledata, chunks, scatter, props, textures, locations, landmarks), `src/env/backdrop.js`, `tools/locations_check.mjs`, new `src/world/*` files and a new `tools/worldconfig*` tool.

**Stream B owns:** `src/vehicle/*`, `src/input/*`, `src/audio/*`, `src/ui/*`, `src/env/environment.js`, new `src/traffic/*`, `assets/*`, `dev/*` (Blender scripts), `index.html`, `game.js`, `audio.js`, `music/`.

**Shared (edit rarely, tiny diffs, tell the other person first):** `src/main.js`, `src/core/config.js`, `tools/selftest.mjs`, `tools/stage_cloudflare.py`, `HANDOFF.md`.

**Never merge, always regenerate:** `cloudflare/public/*`. It is built by `python tools/stage_cloudflare.py`. If it conflicts, take either side, then re-run the script.

**Interfaces that must not change without telling the other stream:**
- A promises B: the road lookup in `router.js` (nearest road point, direction, width, lane layout) and the surface table. B's traffic builds on it.
- B promises A: the vehicle position/speed that `main.js` hands to the world each frame, and `defs.js` stats.
- If one needs to change, add a new function and keep the old one working. Remove the old one only in a later phase.

## Talking to each other's Claude

Both Claudes read `CLAUDE.md` automatically. It tells them to log changes in `team/stream-a.md` (Rajul) and `team/stream-b.md` (Anshul), and to read both at the start of a session. Type `/sync` in Claude to pull and get a summary of what the other stream needs from you. When you want the other person's Claude to do something, say "log it for the other stream" and tell them to run `/sync`.

## Git routine (both people, every day)

1. Start: `git fetch`, then `git switch -c world/<task>` (or `vehicle/<task>`) from the latest integration branch.
2. Commit small and often, only files your stream owns. Never `git add -A` blindly: check `git status` first.
3. Before pushing: `git merge origin/<integration branch>`, run `node tools/selftest.mjs`, then push your branch.
4. Merge into the integration branch only at the end of a phase, in the order agreed below. One person merges at a time.
5. **One deployer.** Deploys happen only from the integration branch after a merge (wrangler is logged in on Anshul's PC).
6. Line endings: the repo mixes LF and CRLF. Do not run tools that rewrite whole files. Make surgical edits and check `git diff --stat` for huge diffs.
7. The old game (`index.html`, `game.js`) is Stream B's. Stream A never touches it.

## The original phases (kept for reference: Phases 0 to 2 are done for Stream A; the rest is folded into "Phases from here" above)

## Phase 0: sync (together, about 30 minutes, do first)

- [ ] Owner of the repo fast-forwards `main` to `phase/3-driving` (`git switch main; git merge --ff-only origin/phase/3-driving; git push`). The phase branches form one straight chain, so this is clean. If the owner prefers to keep `main` untouched, both use `phase/3-driving` as the integration branch instead.
- [ ] Commit this file to the integration branch so both Claudes see it.
- [ ] Each person picks A or B, creates their first branch, runs `node tools/selftest.mjs` (19 checks should pass) and `python tools/serve.py 8791`.
- [ ] Both read the "Known problems" in `HANDOFF.md`.

## Phase 1: foundations (parallel)

**Stream A: road styles and bend fix**
- Phase 5 road styles: multi-lane highway, boulevard, dirt trail, gravel stage (`road.js` styles, `router.js` width/lane data).
- Tight bends: raise `road.minRadius` in `config.js` (shared file: one line, announce it) and check with `tools/locations_check.mjs`.
- Done when: each style renders on a test seed, selftest passes, locations still load.

**Stream B: cleanup and drivetrain**
- **Keep** the old game's local music upload (players add their own songs; files stay in their browser, never uploaded to the server). Port it into the new engine's radio (`audio/radio.js`, `ui/radiowheel.js`) as a "My music" station next to the live stations. Stop `stage_cloudflare.py` copying the repo's `music/` mp3s into the deploy, since they are commercial tracks (shared file: announce it).
- Integrate the sports car and rally hatchback (`assets/car_02_sport.glb`, `car_03_rally.glb`, `defs.js`, garage entries, paint).
- Real drivetrain with manual gears in `rapier-vehicle.js`.
- Done when: both new cars drive, gears work, a local song uploaded in the new engine plays on the wheel, selftest passes, the deploy carries no `music/` files.

**End of Phase 1:** A merges first, then B merges `A` into their branch, tests, merges. Deploy `/next` once.

## Phase 2: the big features (parallel)

**Stream A: bridges, tunnels, location polish**
- Bridges for road over water, tunnels or switchbacks for deep cuttings (`router.js`, `road.js`, `terrain.js`). Keep the road lookup interface stable.
- Phase 4 leftovers: southern coast landmark, Marine Drive sea meeting the promenade, a better hotel model.
- Done when: `locations_check` shows no causeway over water on the test seeds, no cutting over about 60 m.

**Stream B: traffic**
- New `src/traffic/*`: cars that follow the road lane by lane, selectable modes (off, light, busy). Uses A's road lookup. Hook-up in `main.js` is a few lines.
- Controller rumble and vehicle customisation (garage in `ui/menu.js`).
- Done when: traffic drives a 5 km loop without leaks (tile/object counts stay flat), modes switch in settings.

**End of Phase 2:** same merge order (A, then B), selftest, one deploy.

## Phase 3: polish and tools (parallel)

**Stream A: terrain, performance, world tool**
- Steep land in the Alps and Himalayas: drive-test and fix grading.
- Frame cost: the ground patch rebuild spikes (up to about 25 ms), measure on a phone.
- World config tool (Phase 9): a page or panel to tweak and share world settings (uses `config.js` share codes).

**Stream B: weather, graphics, mobile**
- Weather and time polish, graphics options menu (`env/environment.js`, `ui/menu.js`).
- Test menus on a real phone and at desktop width; judge the engine sound by ear and retune `audio/engine.js`.
- Drive-feel pass by keyboard and gamepad.

## Phase 4: switch-over (together)

- Switch `index.html` to the new engine, retire `game.js`, keep `next.html` as an alias for a while.
- Both test on desktop and phone, fix what the other found (small fixes, in the owner's files).
- Final merge to `main`, one deploy, update `HANDOFF.md`.

## Rules for each Claude (paste this at the top of your prompt)

> You are working on Game for Peace with a teammate whose Claude works at the same time. You are **Stream <A or B>**. Read `HANDOFF.md`, `OVERVIEW.md` and `PARALLEL_PLAN.md` first. Only edit files your stream owns. For shared files make the smallest possible change and tell me. Work on a branch named `<world|vehicle>/<task>`, commit only your own files, run `node tools/selftest.mjs` before every push, never touch `cloudflare/public`, never deploy, never merge into the integration branch unless I say so. Keep line endings as they are. Today's task is <the Phase and bullet>.

## Quick start prompts

**Stream A, first task:**
> You are Stream A (World). Do Phase 1 of `PARALLEL_PLAN.md`: the four road styles, then the `road.minRadius` fix. Branch `world/road-styles`.

**Stream B, first task:**
> You are Stream B (Vehicle & Game). Do Phase 1 of `PARALLEL_PLAN.md`: keep the local music upload and bring it into the new engine, integrate the two new cars, then add manual gears. Branch `vehicle/cars-and-gears`.

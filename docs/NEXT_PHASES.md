# Next phases (handoff to Anshul's Claude, Stream B)

Written 17 Nov 2026 by Rajul's Claude because the owner's session limit ended. **Read first:** `CLAUDE.md`, `docs/STATUS.md` (the status ledger), `docs/DECISIONS.md` (owner answers, do not ask again), the top of `HANDOFF.md`, then `team/stream-a.md` (newest 6 entries) and `team/stream-b.md`. Then run `/sync` and `python tools/daily_check.py`.

## Where things stand (17 Nov 2026, `main` at the merge of PR 83; PRs 83 and 85 merged)
- **Live** on the owner's Cloudflare account (not yours): https://game-for-peace.mailrajulsingh-in.workers.dev. Your account keeps the older original versions (`/` and `/next`): do not deploy over them. Deploy method: `CLAUDE.md`, "Where deploys go" (scratch folder, `tools/stage_cloudflare.py --out`, `node tools/bundle.mjs`, `npx wrangler@4 deploy`, check `wrangler whoami` says `mailrajulsingh.in@gmail.com`; the login may need the owner to run `npx wrangler@4 login` in a terminal).
- **Self-test:** 112 checks. **Daily check:** green.
- **Built this session:** audit fixes (R01, R04 to R07, R11, R15 to R19), swept-capsule on-foot controller, ambient traffic on flyovers and underpasses (not yet seen by a person), phone layout, horn and Delhi street sound, Add to Home Screen app, tuner storage and password (on the owner's account), deploy-time bundle (one script instead of 142), prefetch of the other world's files before a highway/city switch, your cartoon NPCs (merged from `vehicle/npc-models`), PR 85 (roads out of Delhi, Other cities list).
- **Not merged:** `vehicle/cars-and-gears` (yours). It conflicts with `main` in 14 files and 42 hunks. Rajul's Claude tried and stopped: the two sides carry **different driving models** (main: N1 powertrain, `makeTelemetry`, `DRIVE_MODES`, `TYRE_SIGN`, kerb and flyover physics; your branch: `Drivetrain`, `GRIP`, `DOWNFORCE`, `SCRUB`), and nobody can feel-test a blind merge.

## Phase 1: bring your branch up to date (first, before anything else)
1. `git fetch && git switch vehicle/cars-and-gears && git merge origin/main`. Conflicts: `HANDOFF.md`, `next.html`, `src/audio/engine.js`, `src/audio/radio.js`, `src/input/controls.js`, `src/main.js` (9 hunks, one of 205 lines), `src/ui/menu.js`, `src/ui/radiowheel.js`, `src/vehicle/defs.js`, `src/vehicle/rapier-vehicle.js` (10 hunks), `src/vehicle/vehicle.js`, `team/stream-b.md`, `tools/selftest.mjs`, `tools/stage_cloudflare.py`.
2. **Keep from main (do not drop):** the N7 to N15 structure in `main.js` (runtime, sectors, regions, on foot, activities, saves), the home-screen app (`index.html`, `sw.js`, `manifest.webmanifest`, `src/ui/install.js`), the boot watchdog in `index.html`, the horn (key K, `engine.horn`) and the Delhi street bed (`engine.cityBed`), `src/world/prefetch.js` and its three lines in `main.js`, the bundle step (`tools/bundle.mjs`, `tools/stage_cloudflare.py` extension list), `next.html` as the redirect it is on main, `LICENSE.md`, ASSETS credits.
3. **Keep from your branch:** the rebuilt cars, wheel and body detail, steering and grip feel, gearbox, atmosphere sound (moon, birdsong, crickets), radio and radio wheel changes, `docs/LITE_AND_FULL_PLAN.md`. **Your adaptive resolution duplicates the frame-time governor already in `main.js` (`gov`): keep one, the existing one.**
3a. **The driving model needs a decision you must make with the owner's numbers, not by guesswork:** take main's telemetry and drive-mode contract (`VEHICLE_CONTRACT.md`, `tools/vehicle_acceptance.mjs --check` must pass) and port your grip, downforce and gearbox feel onto it as tuner settings, rather than replacing main's model. Run `node tools/selftest.mjs` and `python tools/vehicle_acceptance.mjs --check` after each file.
4. Merge only when both pass and a person has driven a lap in each of the three vehicles. Log it in `team/stream-b.md`, open a PR, and ask the owner to merge (never merge without the owner's word).

## Phase 2: things only your side can do
- Commit `dev/build_npc_stylised.py` and say in `assets/ASSETS.md` where the NPC base mesh came from (the credit currently says "to confirm").
- Answer in your log the owner's open items: your Lite/Full proposal's four decisions are **still unanswered by the owner**; ask the owner and record the answers in `docs/DECISIONS.md`. Note the phone and slow-start work already done (bundle, prefetch, phone layout) covers part of "Lite".
- Review (they are your files) `src/core/runtime.js` (handle domains, `droppedTime`) and `src/player/onfoot.js` (capsule), changed at the owner's request.

## Phase 3: city and highway flow (plan in the chat history, summarised here)
- **v1 done:** prefetch. **v2 (next):** a true no-reload switch between the India map and a city. The blocker: `cityMode` is a `const` read in about 30 places of `src/main.js` and the world is built once at boot by top-level awaits. Make the world set-up a function that can be torn down and run again (dispose renderer targets, scene groups, sectors, nav, traffic; keep the WebGL context, the sound context and the touch UI), then switch with the existing black fade. Do it as its own PR, small steps, with the gate hand-over (`gateJump`, `gfp-gate` carry) kept as the fallback behind `?reload=1`.
- **v3:** a deterministic generated city for places with no real map pack, from the city's real road skeleton and region style, seeded by the city id (same every time), using the Delhi renderer. **v4:** real packs for more cities in the owner's order (`docs/OVERALL_PLAN.md` section C: Gurgaon and Noida, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad ...). Load a city's data only on first entry (a Delhi pack is about 78 MB).

## Phase 4: speed and phones (measure on real devices first; `PERFORMANCE.md`)
- Mumbai at the low tier is about 800 to 1000 draw calls and 350 k triangles (California baseline 183). Biggest groups: landmarks (about 290 meshes), rails (about 190). Merge or instance them, cull them by distance.
- Run `?play&city=delhi&q=low&bench=30` and `?play&q=low&bench=30` on a real phone and a real Mac; write the numbers into `PERFORMANCE.md` with the commit, device, tier, window visible, p95 and p99 (`CLAUDE.md`, "Evidence, not adjectives").
- Router: a route across Delhi takes 80 to 140 ms on a desktop (`node tools/measure_city.mjs`): move it to a worker or make it cooperative (`docs/SHARED_SIM_PLAN.md` step 2).
- Check the Add to Home Screen icon, sound after the first tap, the Horn button and layout on a real iPhone and an Android phone (`CHECKLIST.md` has four new lines).

## Phase 5: open audit items and plans (`docs/STATUS.md`)
R10 byte budget and AbortSignal for the city tile cache; R13 per-landmark height checks; R08 shared simulation contracts (`docs/SHARED_SIM_PLAN.md`, build one step only when a second city needs it). Then N17 to N20. **N21 to N26 (campaigns, protagonists, multiplayer) only after the Delhi city card in `docs/CITY_PLAN.md` is all ticked** (owner decision).

## Things a person must do (nobody can do these for them)
Drive a Delhi flyover and underpass with traffic on (`CHECKLIST.md`, v4); try a real phone; sign in to Cloudflare when a deploy is needed; choose the city order; answer the Lite/Full questions. The tuner Publish password is held by the owner only (never write it in the repo or a log).

## Rules that always apply
Only edit your own stream's files; shared files in small logged steps and reserve them first; run `node tools/selftest.mjs` and `python tools/daily_check.py` before every push; keep line endings (the repo mixes LF and CRLF: `index.html` and `src/audio/engine.js` are CRLF); never deploy or merge unless the owner says so.

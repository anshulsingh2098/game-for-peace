# Stream B log (Vehicle & Game: Anshul's Claude writes here, Rajul's Claude only reads)

Newest entries first. Format is in `CLAUDE.md`.

## 2026-11-14  Steering turns much tighter (turn assist, more grip, cornering scrub)
Branch: vehicle/cars-and-gears  Commit: see `git log`
What changed: `src/vehicle/rapier-vehicle.js` only. Holding the throttle in a corner used to make the car turn 3 to 4 times wider; now a turn assist nudges the body toward the yaw rate the steering asks for (capped at what the tyres hold), tyres bite harder (GRIP 1.15 -> 1.35), and hard cornering scrubs a little speed (SCRUB 0.12). About 35% tighter radius under full throttle (car, 60 km/h: 56 m -> 37 m); rally car sharpest. All five vehicles still follow the road at speed. Deployed (live version `a9295923`). **Follow-up:** at high speed the steering barely moved (lock shrank with 1/speed^2, so 3 to 4 degrees at 200 km/h). Added aerodynamic grip (DOWNFORCE 0.8 at 60 m/s and above) and a minimum lock of a fifth of full lock: at 200 km/h the wheels now turn about 7 degrees and the car 26 degrees per second (was 16). Slalom at top speed is stable. Not deployed yet.
For the other stream: nothing. If the tuner dashboard is merged, `GRIP`, `SCRUB`, `DOWNFORCE`, `V_DF` and the steering numbers are good first candidates to expose; they are constants at the top of `rapier-vehicle.js`.
Status: open

## 2026-11-14  Deployed again: bridges and tunnels are live (merged into the Stream B branch)
Branch: vehicle/cars-and-gears  Commit: see `git log` (merge of origin/world/bridges is the latest code commit)
What changed:
- Merged `origin/world/bridges` (PR #4 content: bridges, tunnels, rain/snow hidden in tunnels, Atal-style tunnel gate) into this branch; the only conflict was `tools/selftest.mjs` (both appended tests, both kept). 24 checks pass.
- **Deployed** (live version `2385b2c6`): cars, gears, My music, steering setting, road styles, bridges and tunnels. Staged to a scratch folder and deployed with `wrangler deploy --assets <scratch>`, so `cloudflare/public` was not touched.
- Driven with the Rapier vehicle: through an Alps tunnel at about 117 km/h with every wheel in contact the whole way; across a California bridge deck at about 79 km/h, wheels in contact, not in the water.
- **Not deployed:** the tuner dashboard (PR #3, `tuner/dashboard`). `tuner.html` is 404 on the live site. It still needs merging plus the Cloudflare KV and `TUNER_PASSWORD` steps from your entry.
For the other stream:
- Nothing to run. PR #4's code is already live via this branch. When the PRs are merged on GitHub, `main` will catch up; after that `git fetch && git merge origin/main`.
- The rain and thunder sound still plays inside tunnels (`src/audio/engine.js` is ours). We will quieten it when `terrain.height - terrain.drive > 4` at the camera; not done yet.
- Heads-up: the PR for `vehicle/cars-and-gears` into `main` has not been opened yet (no `gh` on this PC); the prefilled link is in the chat.
Status: open

## 2026-11-14  Phase 1 done and DEPLOYED: new cars, gears, My music, steering setting
Branch: vehicle/cars-and-gears  Commit: see `git log` (merge of origin/main is the latest code commit)
What changed:
- **Deployed to the live site** (version `6599f890`) from this branch **after merging `origin/main`** (so Stream A's road styles are in it). Deployed by Anshul's Claude from a scratch folder (`stage_cloudflare.py --out <scratch>` then `wrangler deploy --assets <scratch>`), so `cloudflare/public` was not touched or committed. Anyone who deploys from `main` later will not lose any of this once this branch is merged.
- Two new vehicles (Ember RS sports car, Dust Runner rally hatchback), 5 in the garage.
- Gearbox: `src/vehicle/drivetrain.js`; automatic by default, manual with E / Z, N switches, gamepad bumpers, on-screen buttons. HUD shows gear and revs.
- My music: the player's own songs on the radio wheel (kept in the browser, never uploaded).
- Steering: more responsive, with a Settings option (Relaxed / Normal / Responsive default / Sharp); tyres bite 15% harder.
- **The deploy no longer carries `music/`** (`tools/stage_cloudflare.py` has no `music` tree): the old mp3s and playlist are gone from the live site. The old game at `/` copes (empty playlist plus add-your-own-files).
- Shared files touched, all small: `src/main.js` (gear, steering, radio and music hooks), `tools/selftest.mjs` (new tests; merge with A's kept both, 22 checks pass), `tools/stage_cloudflare.py` (no `music`), `HANDOFF.md`, `OVERVIEW.md`.
For the other stream:
- Nothing to run. To get this work, after it is merged into `main`: `git fetch && git merge origin/main`.
- Re: tuner dashboard (your entry): thanks, yes, we want the vehicle numbers in it. First choices: steering (rate, lock, assist), tyre grip, suspension spring and damper, gear ratios and rev limits in `drivetrain.js`. Not done yet; `tuner/dashboard` is not merged into this branch, so nothing here depends on it.
- Re: bridges: no change needed in vehicle code; invisible walls on rails would be nice later.
Status: open


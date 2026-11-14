# Stream B log (Vehicle & Game: Anshul's Claude writes here, Rajul's Claude only reads)

Newest entries first. Format is in `CLAUDE.md`.

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


# Owner decisions (so nobody asks twice)

Newest first. A decision here is the owner's word; an agent follows it and does not ask again. To change one, the owner says so and the line is edited with a date.

## 17 Nov 2026 (later still): deploys go to Rajul's Cloudflare account (paid services); Anshul's account keeps the older original versions (`.workers.dev` and `/next`). First deploy done: https://game-for-peace.mailrajulsingh-in.workers.dev, version `17594f28`. Rule and method are in `CLAUDE.md`.

## 17 Nov 2026 (later): R14 yes, flyovers and underpasses carry ambient city traffic. Built as v4 in `src/world/city/citytraffic.js`.

## 17 Nov 2026: answers to the independent studio audit (`Game_for_Peace_Independent_Studio_Audit.md`, baseline 4e21bf8)
| # | Decision | Where it landed |
|---|---|---|
| R01 | Add the data attribution to the release. The stage script now includes `.bin`, `.txt` and `.wasm`; `daily_check.py` fails if terrain or attribution files drop out. No deploy is implied: only Anshul deploys. | `tools/stage_cloudflare.py`, `tools/daily_check.py` |
| R07 | The on-foot controller follows the open-world industry standard (a swept capsule, as in GTA-style games): sliding, step-up, ground snap, vertical extents on obstacles, no tunnelling. Built as pure JavaScript on the existing world interface. | `src/player/onfoot.js`, `docs/ONFOOT.md` |
| R12, N21 to N26 | Wanted, but **only after the Delhi work is done** (the Delhi city card in `docs/CITY_PLAN.md` all ticked). Nothing from N21 on is started before then. | `docs/OVERALL_PLAN.md` section "After N20" |
| R17 | Delegated to Claude: all rights reserved for our own code and art, third-party material under its own licence. Reversible: the owner can swap in an open licence later. | `LICENSE.md` |
| R18, R19 | Edit the status and log rules. One status ledger, supersede links, status words, task IDs, reservation before editing a shared file. | `docs/STATUS.md`, `CLAUDE.md` |
| R08 | Plan now, design in order, build only when a second city needs it. | `docs/SHARED_SIM_PLAN.md` |
| Audit proposals AP-01 to AP-04 | Accepted (status ledger, release check, lifecycle reliability, device and city acceptance protocol). AP-05 to AP-08 are accepted as design and research only, after Delhi. | `docs/STATUS.md`, this file |
| Small calls | `daily_check.py` says what it really does (it runs `git fetch`); `/sync` identifies the stream from `git config user.name`, not the branch name. OSM2World's licence label corrected to MIT (to confirm at the pinned commit). | `tools/daily_check.py`, `.claude/commands/sync.md`, `docs/OPEN_DATA.md` |
| Order of work | By the audit's priority: R01 first, then R04 to R06, R11, R16, then R07. All done in branch `claude/audit-fixes`. | `team/stream-a.md` |

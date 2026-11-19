# Owner decisions (so nobody asks twice)

Newest first. A decision here is the owner's word; an agent follows it and does not ask again. To change one, the owner says so and the line is edited with a date.

## 21 Nov 2026: Delhi's markings and look follow REAL DELHI, not GTA: white broken centre line on two-way roads (a double yellow only for no-overtaking stretches, off because the map does not give them), white solid edge lines and white zebra and stop lines on main roads, black and white painted kerbs on main roads and medians. The Delhi main region (Connaught Place, Janpath, Kartavya Path and India Gate, Lutyens' Delhi, Jantar Mantar, Palika Bazaar) is finished and accepted FIRST; the same kit goes to other parts of Delhi only after that. Work is phased, one phase and one gate at a time: `docs/DELHI_MAIN_PLAN.md`. Overhead wires stay out of the NDMC area (cables are underground there) and belong to markets, Old Delhi and villages.

## 19 Nov 2026: Connaught Place (and Delhi) look: match the owner's reference photos element by element and exactly (architecture, colours, light, boards, trees, paving, benches, famous places), photoreal and GTA-like in scale; CP first, the rest of Delhi after. Real place and shop names may be used as plain map labels and plain lettering on boards; **no copied logos, brand artwork or trade dress** (draw a simple original board in the same colours and layout). Reference photos are study only and stay out of the repository. Plan: `docs/CP_MATCH_PLAN.md`, log: `docs/CP_MATCH_LOG.md`.

## 17 Nov 2026 (end of session): Delhi phases P1 to P8, look steps L1 to L6 and N17 to N20 are assigned to Anshul's Claude (`docs/NEXT_PHASES.md`, "Assigned to Anshul: Delhi phases ..."), to be worked in blocks, one phase at a time, after B1 to B3. This is an ownership override: for these tasks Anshul's Claude may edit Stream A (world) files, in small logged PRs; the owner merges. N17 to N20 start only after P8 is judged and the owner says go.

## 17 Nov 2026 (last): phone check and optimisation, sound, Add to Home Screen (full screen, landscape), tuner storage and password, handoff, plan and tracker updated. The owner reported the phone screenshot (board covering the controls); fixed. The tuner password was generated and given to the owner in chat; it is not in the repo.

## 18 Nov 2026 (night): the owner asked to merge everything (PRs 93 to 98 merged), to fix the trees (they look wrong), the conflicts (buildings on roads and tracks, trains through buildings, cars and people through trains, cars that sink or fall into tunnels) in phases (`docs/CITY_CONFLICTS_PLAN.md`), and to keep every doc current.

## 18 Nov 2026: product split. The browser game (Web Lite) plays **Delhi only**; the **whole India map and more cities are in a downloadable app for PC and phone** (Full), for better compute and graphics from the hardware and room for better engines. Plan: `docs/LITE_AND_FULL_PLAN.md` (accepted in principle). The engine for Full is chosen after benchmarks (its Phase 6), not before. Open: cars in Lite, minimum device, PC or phone first, a "get the full game" button (defaults in the plan). Consequences: the India map, highway driving, "Other cities" and the city and highway flow (v2 to v4, B7) belong to Full; Lite boots into Delhi; N17 to N20 go in shared code for both; N21 onward starts in Full.

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

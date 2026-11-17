# Status ledger (the one place that says what is true)

When this file and an older text disagree, **this file wins**. `OVERVIEW.md`, `HANDOFF.md`, `PARALLEL_PLAN.md` and `docs/WORK_REMAINING.md` keep their history; where they conflict with this file, they are superseded (links below). Dates written inside old entries (some say 22 to 24 Nov) are unreliable: order things by git history and commit hashes.

Ledger as of commit `774a667` on `main`, plus branch `claude/audit-fixes` (17 Nov 2026). Columns follow the audit's rule that "built" is not "accepted": **Code** = in the repository; **Auto** = covered by `tools/selftest.mjs` or a daily-check script; **Seen** = looked at in a rendered browser; **Device** = tried on a real phone or a measured desktop; **Accepted** = a person signed it off; **Live** = deployed (only Anshul deploys).

| Phase | Code | Auto | Seen | Device | Accepted | Live |
|---|---|---|---|---|---|---|
| N0 baseline | yes | yes | yes | no | no | no |
| N1 driving, sound | yes | yes (acceptance script) | partly | no | no | no |
| N2 weather, look | yes | n/a | partly (matrix) | no | no | no |
| N3 world polish | yes | partly | partly | no | no | no |
| N4 performance | yes | bench only | desktop | no | no | no |
| N5 features | yes | partly | yes | no | no | no |
| N6 switch-over | yes (`index.html` is the new engine; installable app, `manifest.webmanifest`) | yes | yes (desktop and an emulated phone) | no | no | yes, on Rajul's account since 17 Nov 2026 (Anshul's account still has the old build) |
| N7 runtime | yes | yes (audit R05 and R16 fixed: handle domains, dropped-time count) | n/a | n/a | no | no |
| N8 streaming | yes | yes | yes | no | no | no |
| N9 regions | yes | yes | yes | n/a | no | no |
| N10 navigation | yes | yes | yes | n/a | no | no |
| N11 district | yes (Delhi enclave is the real city) | yes | yes | no | no | no |
| N12 traffic | partly (city traffic has signal and crossing logic, flyovers, ramps and underpasses carry cars since v4, R14, not yet seen in a browser) | yes | yes | no | no | no |
| N13 pedestrians | partly (boxes, no rigged art) | yes | yes | no | no | no |
| N14 on foot | yes (capsule controller, this branch) | yes | no | no | no | no |
| N15 activities, saves | partly (settings and scores only, no world resume) | yes | yes | no | no | no |
| N16 more regions | Delhi pack D1 to D8 built | yes | yes | no | no | no |
| N17 to N20 | not started | | | | | |
| N21 to N26 | after Delhi (`docs/OVERALL_PLAN.md`) | | | | | |

## Owner overrides on record
- N7 to N15 were started before N0 to N6 were accepted, at the owner's request (15 and 16 Nov 2026). The "N7 must wait" gate in `PARALLEL_PLAN.md` is superseded.
- One Claude has done both streams' work, all logged, until Anshul takes over his stream.
- All answers of 17 Nov 2026: `docs/DECISIONS.md`.

## Superseded statements (kept for history, do not plan from them)
| Old text | Replaced by |
|---|---|
| `OVERVIEW.md`: a calm driving game with no missions or pursuits; "the new engine is not main" | An open-world India game (owner, 15 Nov 2026); the new engine is `index.html`. |
| `PARALLEL_PLAN.md`: "nothing in N7 to N15 is begun" | N7 to N15 first increments exist (table above). |
| `docs/WORK_REMAINING.md` rows saying the city has no gate entry or no signals | Delhi has gate entry, and `CityTraffic` has signal and crossing code (its file header still says "no signals yet": stale text). |
| N14 "capsule controller" gap in the 17 Nov audit | Built on 17 Nov 2026 (`docs/ONFOOT.md`). |
| OSM2World "LGPL" in `docs/OPEN_DATA.md`, `docs/CITY_PLAN.md` | MIT at the audited commit; confirm before use. |

## Open audit findings (17 Nov 2026) and where each stands
Fixed on `claude/audit-fixes`: R01, R04, R05, R06, R07, R11, R15 (v1), R16, R17 (licence), R18, R19; R10 in part (v2: failed city tiles wait 1 s, 2 s, 4 s ... up to 30 s before being asked again; still open: a byte budget for the raw tile cache and an AbortSignal through the fetch). Planned, not built: R08 (`docs/SHARED_SIM_PLAN.md`), R14 was decided yes (owner, 17 Nov 2026) and built as v4 (below). **Measured (v3, `node tools/measure_city.mjs`, a desktop):** reading the graph 12 ms, `JSON.parse` 41 ms, decode 12 ms, router build 43 ms; city routes 80 to 140 ms for a route across the city (about 5 to 9 dropped frames at 60 fps), so a long route on the main thread is a real hitch and a phone will be several times worse: the cooperative or worker router in `docs/SHARED_SIM_PLAN.md` step 2 is justified, to be sized with a phone measurement. Not touched, need people: R02 (devices), R13 (per-landmark height checks come with the Delhi person's list). R12, R20: after Delhi.
Known gaps after the fixes: nothing has been tried on a rendered page this session; R04's rollback is in `main.js`, which no headless test can import; the capsule has no camera collision, no stairs or interiors yet (N18).

## Acceptance protocol (AP-04)
For a build to be called accepted, a person records: the commit hash, the device or desktop and its visible-window frame rate (not a hidden tab), the quality tier, the route or location, the duration, and the result, in the team log. `CHECKLIST.md` sections 3 to 5 are the manual part. The city acceptance card is `docs/CITY_PLAN.md`.

## Phone, sound, app, tuner (17 Nov 2026)
Built and seen in an emulated 740 x 340 phone: compact title menu, small station board, map under the speed readout, Horn button, Add to Home Screen button. Built, not heard or tried on a real phone: sound unlock on iPhone, the horn, the Delhi street bed, the home-screen icon opening full screen. Tuner storage and password: set on the owner's account (live API answers 200 and rejects a wrong password with 401). Mumbai at the low tier: about 800 to 1000 draw calls (the California baseline in `PERFORMANCE.md` is 183): the next cost cut is merging or culling landmarks and rails.

## 17 Nov 2026, end of session
PRs 83 (audit fixes, phone, sound, app icon, tuner, bundle, prefetch, NPCs) and 85 (roads out of Delhi) are merged into `main`; self-test 112. `vehicle/cars-and-gears` (Anshul) is not merged: 14 files and 42 hunks conflict and the two sides carry different driving models; the steps are in `docs/NEXT_PHASES.md`. The owner's session limit ended here; the next session starts from `docs/NEXT_PHASES.md`.

## 18 Nov 2026: product split
Web Lite plays Delhi only; the India map and more cities are in a downloadable PC and phone app (`docs/LITE_AND_FULL_PLAN.md`, accepted in principle; four details open). New tasks B14 to B16 in `docs/NEXT_PHASES.md`.

## Anshul's side: done and left (18 Nov 2026, from git and the logs)
**Done by Anshul's Claude:** Rapier driving and menus, radio, locations and landmarks (14 Nov); bridges and tunnels; five-vehicle work, gearbox, steering feel, rebuilt car models, ride height (on his branches, taken out of `main` on the owner's request, A-2026-11-18-15); cartoon NPCs (in `main`, loaded as small `_lod1` models); animated exit from the car with the cartoon player (in `main`); adaptive resolution (not merged: `main` already has the governor); the Lite/Full plan (accepted in principle 18 Nov, `docs/LITE_AND_FULL_PLAN.md`); atmosphere sound with moon, birds and crickets (not in `main`).
**Left (all in `docs/NEXT_PHASES.md`, marks `[ ]`):** B1 car, engine-sound and atmosphere work as separate PRs for the owner's yes; B2 port the steering and grip feel as tuner settings; B3 retire `vehicle/cars-and-gears`; B4 NPC provenance; B5 review `runtime.js` and `onfoot.js`; B6 the four open Lite details; B7 no-reload switch (Full only); B8 Mumbai draw calls; B9 real-phone benchmark; B10 Delhi router off the main thread; B11 tile cache budget; B12 close old log entries; B13 deploy; B14 `BUILD` switch and Lite boots into Delhi; B15 Lite budgets; B16 Full app plan; Delhi P1 to P8 (P1, P2 street-driving test first), L1 to L6 (L3 started by Rajul's Claude), N17 to N20 (after P8). **Nothing in B1 to B16, P1 to P8, L1, L2, L4 to L6 or N17 to N20 has been started since the assignment** (no commit by Anshul's Claude on `main` or his `vehicle/*` branches after 20:52 on 17 Nov).


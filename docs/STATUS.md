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
| N6 switch-over | yes (`index.html` is the new engine) | yes | yes | no | no | yes, on Rajul's account since 17 Nov 2026 (Anshul's account still has the old build) |
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

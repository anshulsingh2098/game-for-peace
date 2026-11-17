# Overall plan: Game for Peace (written 17 Nov 2026 by Rajul's session; keep it current)

One file for the whole picture: what the game is, what is built, what is waiting for people, what comes next, and the limits that slow the work. Details live in the files it points to.

## 1. What the game is
A browser driving game (three.js, Rapier physics, floating origin) set in India only, in the manner of an open-world driving game. One continuous India world at 1:100 over the real highway network (roads, cities, railways, terrain and land cover from open data), plus full-size 1:1 city enclaves entered from a highway gate (Delhi first). Two people work in parallel with their own Claudes: Stream A (World, Rajul) and Stream B (Vehicle and Game, Anshul); only Anshul deploys. The live site is still the old build. Rules for the Claudes: `CLAUDE.md`.

## 2. Where we are (17 Nov 2026; `main` passes 105 self-test checks; nothing deployed)
| Area | State |
|---|---|
| Engine, driving, sound, weather, traffic (N0 to N6) | Built, merged. Not accepted on real devices. |
| India world (N7 to N10) | One continuous world over 30 highways, sectors streamed in and out, real elevation and land cover, field-parcel land, region looks, Indian lane discipline, tolls, boards, km stones, GPS minimap and map. |
| Cities and districts (N11) | Mumbai, Delhi, Agra, Bhopal procedural districts (the old strip kind) and the new **Delhi city enclave** from a real pack. |
| Railways | Real network (86 stations, 383 edges), multi-track lines, cuttings, viaducts, overhead wire, stations, switching, signals with lit aspects, level crossings with barriers and traffic stopping, expressways never crossed on the level, rail over road on a ramp, seven kinds of train with real names and a 2016 timetable, Vande Bharat on its routes, diesel and electric locos, maintenance trains, a railway control office (blocks, precedence, braking), sound and announcements. |
| Roads | Multi-level roads (overpasses, deck layers in physics). Not built: slip roads, cloverleafs. |
| Delhi (the first complete city) | Pack (406k street edges, buildings, parks, water), landmark data (63), Metro and rail and bus data, renderer (streets, flyovers, underpasses, kerbs, signals, zebra crossings, people, parked cars, facade kits, night windows, shadows, far skyline), city map and GPS, gate fade, Metro viaducts, stations, trains, J fast travel, underground stations, 22 landmark models, identity file, shops, ads, wires, trees, nine vehicle kinds, DTC buses on real routes, season and haze. |
| Autodrive, drive modes | Auto and Cruise levels, four modes, a look-ahead planner. |
| Credits and licences | `licenses.html` (owner review pending). |

## 3. What people must do (Claude cannot)
1. **Phones and real devices:** run `?bench=30` and `?bench=30&city=delhi` on two phones and a visible desktop window; the game is slow for the owner on desktop (a resolution governor was added). Listen to the engine and train sounds. Test touch controls. (`WORK_REMAINING` 0.1, 0.4, 12.2)
2. **A Delhi person** to judge the city and list what feels wrong (12.12); the same later for each city.
3. **Anshul:** review everything in Stream B files (traffic, physics, autodrive, activities), run the N0 gate, and **deploy** (stage the city pack first: 12.1; this machine is signed in to a different Cloudflare account).
4. **Legal review (the owner's lawyer):** OpenStreetMap ODbL for the road and city data; the 10 audio.com train clips (local only); announcement recordings from the YouTube playlist (local only, supplied by the owner); the Delhi Open Transit Data terms (needs the owner to accept in their own name); the 2016 DataMeet train data (CC0 for the compilers; the Railways' own rights unverified); `licenses.html`.
5. **Owner decisions** (`WORK_REMAINING` section 1): which city after Delhi, licensed music for the radio, the official map outline, the asset budget, on-foot play on phones, GTFS terms (1.11), the tuner login.
6. **Native speakers** for the regional announcement translations (7.11) and Hindi signage.

## 4. The plan ahead, in order
**A. Finish and judge Delhi (now)**
1. D6c and D7b: leftovers listed in `WORK_REMAINING` (railway trains at stations, platform stairs, more Metro detail, gabled roofs, more facade variety, bus timetable after the GTFS decision, Metro photos check).
2. D8b: the remaining landmarks beyond the first 22 (Sansad Bhavan details, markets as places, airport, stadium) and checking the models against photographs.
3. Measure on devices; cut cost where over budget (`docs/CITY_PACK.md` section 4).
4. A Delhi person's list, then a fixing pass. Delhi is "complete" when the city card in `docs/CITY_PLAN.md` is all ticked.
5. Things to do in Delhi (Phase 6): city tours between landmarks, taxi and delivery missions on the real street graph, Metro ticket game, photo mode.
**B. Railways (follow-ups)**
Trains stopping at every red and following their real timetables, boarding a train as fast travel, signals and points everywhere (not only stations), junction track layouts, narrow-gauge hill railways (Kalka-Shimla, Darjeeling, Nilgiri), real train sound recordings (CC0), Mumbai local frequencies from a real timetable.
**C. The next cities (Phase 7, one at a time; each repeats the Delhi packages D1 to D8)**
Gurgaon and Noida (NCR), then Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, then Agra, Jaipur, Pune, Ahmedabad, Lucknow, Varanasi, Amritsar, Kochi. The owner picks the order.
**D. The wider world (the open-world plan, `docs/post-n6-open-world-plan.md`)**
N16 expanded India regions (the nine region worlds become real, other states and terrain looks), N17 emergency services and world events, N18 deeper interiors and commerce (shops you can enter, buying), N19 vehicle depth (Indian vehicles: auto-rickshaws, buses, trucks with truck art, models, damage, customising), N20 long-term persistence and polish (saves, progress, options, accessibility, performance on low-end phones).
**E. Cross-cutting**
Roads: slip roads, cloverleafs, service roads, medians. People and animals. Weather by region and season (monsoon, fog, dust). Sound by region. Real Indian vehicle and building art (an asset budget decision). A proper menu and tutorial. Language options.

## 5. Limits and pacing (read before starting big work)
- Plan limits on 17 Nov: the 5-hour window was 81 percent used (resets in about 2.5 hours) and the weekly window 64 percent (resets in about 5.8 days). Parallel sessions burn the limit fast: three at once ended a window. Prefer two sessions at a time, and give each a small, finishable scope; a session that hits the limit stops mid-task and must be told to resume.
- The main conversation's context was 82 percent full (auto-compact at 97): start a fresh session for the next block of work and point it at `HANDOFF.md`.
- The browser pane runs at about 1 frame per second when hidden; real frame rates need a visible window.
- Several things are only checked by script or a few screenshots; "done" in the docs means built and tested headless, not judged by a person.
- A session that is denied an action stops and reports; the owner has to say "merge", "commit" or "push" plainly for a Claude to do it.

## 6. How to work
Read `HANDOFF.md` (newest state at the top), then this file, then `docs/WORK_REMAINING.md` for the exact list. One writer per set of files. Run `node tools/selftest.mjs` before every push. Log shared changes in `team/stream-a.md`. Merge only when the owner says so. Never deploy.

## 7. Where things are
`HANDOFF.md` state and next steps; `docs/WORK_REMAINING.md` every known limit with priority; `docs/CITY_PLAN.md` and `docs/CITY_PACK.md` the city programme; `docs/DELHI_TRANSIT.md`, `docs/DELHI_LANDMARKS.md`, `docs/DELHI_LOOK.md` Delhi data and look; `docs/INDIA_MAP_PLAN.md` the India world; `docs/OPEN_DATA.md` every download and licence; `docs/post-n6-open-world-plan.md` the N7 to N20 programme; `CHECKLIST.md` the manual checks; `licenses.html` credits.

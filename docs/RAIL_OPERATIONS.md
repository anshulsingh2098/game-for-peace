# How Indian Railways really operates trains (research notes for the headless train-control sim)

Researched 2026-11-17. Purpose: give the simulation real practice and real numbers.

**Evidence labels used below**
- **CONFIRMED** = I opened the page/document and read the number or statement there.
- **UNCONFIRMED** = not found in any source I opened. Sub-flags: `(snippet)` = seen only in a search-result snippet, page itself not opened; `(none)` = no source found at all; `(secondary)` = only a quiz/exam-prep/news page; `(conflict)` = sources disagree. Never treat UNCONFIRMED as fact.
- IRFCA pages (irfca.org) are an enthusiast-maintained FAQ, not official; they are the main source I could open in full. Wikipedia is a lead only.
- Primary sources I could NOT open: General Rules (GR/SR), Signal Engineering Manual (IRSEM), IR Schedule of Dimensions (IRSOD), RDSO Kavach spec SPN/196/2020 main text, Railway Board timetable/precedence orders. Anything that needs them is flagged.

Source keys: 
- [IRFCA-OPS1] https://irfca.org/faq/faq-ops.html
- [IRFCA-OPS2] https://irfca.org/faq/faq-ops2.html
- [IRFCA-OPS3] https://irfca.org/faq/faq-ops3.html
- [IRFCA-SIG1] https://irfca.org/faq/faq-signal.html
- [IRFCA-SIG2] https://irfca.org/faq/faq-signal2.html
- [IRFCA-SIG3] https://irfca.org/faq/faq-signal3.html
- [IRFCA-SIG4] https://irfca.org/faq/faq-signal4.html
- [IRFCA-SIG5] https://irfca.org/faq/faq-signal5.html
- [IRFCA-FRT] https://irfca.org/faq/faq-freight.html
- [IRFCA-GRLC] https://www.irfca.org/docs/rulebook/gr-lc.html (General Rules, level crossings chapter, transcribed)
- [PIB-KAVACH] https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/feb/doc202626781101.pdf (PIB, 6 Feb 2026)
- [WIKI-KAVACH] https://en.wikipedia.org/wiki/Kavach_(train_protection_system)
- [WIKI-VB] https://en.wikipedia.org/wiki/Vande_Bharat_Express
- [DFC-PR] https://dfccil.com/images/uploads/img/DFC-Press-Release_DFC-achieves-avg-speed-of-99.38-kmph-on-EDFC_30.05.2021_SV17.pdf (DFCCIL press release, 30 May 2021)

---

## 1. Control office, TMS/CTC, crossing decisions, the train graph
- Each division has a control office; some have outstation control offices. A line is split into **control sections**, usually yard-to-yard, each with a "control board" (phones/radio to every station, cabin, yard, shed). **A control section normally covers about 150-200 km.** CONFIRMED [IRFCA-OPS3].
- Hierarchy: Chief Controller (HQ) > Deputy Chief Controllers / dispatchers (set day-to-day policy, precedence) > **Section Controllers** (one per control board, implement the plan). Separate loco/power/stock controllers. CONFIRMED [IRFCA-OPS3].
- Section controllers regulate traffic on track capacity, loco availability and train readiness; goods trains are almost wholly under section control, while passenger trains also involve station staff. Station master has final authority over his station's entry/pass/departure; at big stations the cabin crew and section controller decide platform/route detail. CONFIRMED [IRFCA-OPS3].
- **Train graph ("control chart")**: distance on one axis (split by block sections, stations, level crossings), time on the other; path slope = speed; colours by class (red = mail/express, blue = ordinary passenger, black = goods); stabled train = horizontal line; scheduled path dotted, actual path solid; now produced by software. CONFIRMED [IRFCA-OPS3].
- **CTC/TMS**: CTC lets one controller operate points and signals remotely over a long section with automatic colour-light signalling. First CTC: NER Gorakhpur-Chhapra (then MG). Large CTC at Tundla for Ghaziabad-Kanpur (about 250 km of about 400 km covered at time of writing); 12 more CTCs sanctioned 2020. A TMS (Bombardier) gives centralised monitoring of Mumbai suburban (Churchgate-Virar). CONFIRMED [IRFCA-SIG4].
- RDSO draft spec describes TMS as (a) centralised operation of signalling over many interlocked stations and (b) centralised real-time train monitoring/charting; each section controller position sees only its section. UNCONFIRMED (snippet) https://rdso.indianrailways.gov.in/works/uploads/File/TMS%20-%20DRAFT%20SPEC.pdf
- **How crossing/precedence is decided**: the higher-precedence train goes first, the other waits "regardless of how much detention this results in, and even if the other train is already late"; equal precedence in opposite directions: the train nearer its destination goes first; crew-hours or loco fuelling may override. CONFIRMED [IRFCA-OPS3].
- The working timetable can include a crossing-and-precedence table (which trains cross where and when); a "controlled detention" can hold a train to await a connection. CONFIRMED [IRFCA-OPS1].

## 2. Block working
- **Absolute block system** is the most widespread method of train working on IR; blocks may be worked manually, automatically or both. Neale's ball token instruments are phased out except on isolated branches. CONFIRMED [IRFCA-SIG4].
- Core principle: a block section lies between two stations' last stop signals; "Line Clear" is obtained from the station ahead via block instruments before the station in rear may dispatch; instruments are set to "Train on Line" and locked after dispatch; the rear station gets "Line Clear" for the next train only after the previous train clears the block section. Block instruments are set to "line blocked" for engineering blocks. CONFIRMED (partial, wording from) [IRFCA-OPS2], [IRFCA-SIG2].
- Last stop signal of a station = starter, or advanced starter where provided. It governs entry to the block section and needs authority (token/line clear ticket/instrument) to proceed. CONFIRMED [IRFCA-SIG2].
- Line clear for a station requires the line clear to the "clearing point" (overlap) beyond the reception signal; on single line measured from trailing points, on double line from the starter. CONFIRMED [IRFCA-SIG2].
- **Intermediate Block (IB) signal**: stop signal on a block section created by subdividing a long section; it protects the section ahead like a starter. CONFIRMED [IRFCA-SIG2].
- **Automatic block (ABS)**: automatic stop signals (marked with an "A" plate) change by track occupancy; a train may pass an automatic signal at red after stopping and waiting about a minute or two, then proceeding with caution. CONFIRMED [IRFCA-SIG2].
- Train presence is detected by **track circuits** (AC types up to about 5 km long) or **axle counters** (used where track circuits cannot work). CONFIRMED [IRFCA-SIG4].
- **ABS signal spacing normally 1 km**, adjustable by Signal Sighting Committee for gradient etc. UNCONFIRMED (snippet): Railway Board signal directorate letter https://indianrailways.gov.in/railwayboard/uploads/directorate/signal/2024/09_10_24.pdf (URL returned 404 to me).
- Max 2 km for 4-aspect ABS; headway of about 2.5 min / capacity gain 15-20 percent. UNCONFIRMED (secondary) https://www.rrb.iitk.ac.in/sathee-railway-exams/student-corner/railway-gk/signaling/automatic-signaling
- **Typical absolute-block section length: UNCONFIRMED (none).** (Control section 150-200 km is not the block section.)
- Fog rule (Northern Rly): in ABS territory speed capped at 60 km/h after passing a green signal and 30 km/h after double yellow; absolute block 60 km/h in dense fog; detonators 270 m behind first stop signal. CONFIRMED [IRFCA-SIG2] (fog operation).

## 3. Signal aspects, station signal order, overlap, braking distance
- Colour-light types: 2-aspect (green over red), 3-aspect (green/yellow/red), 4-aspect MACL (yellow-green-yellow-red lamps, adds Attention/Double Yellow). CONFIRMED [IRFCA-SIG1], [IRFCA-SIG2].
- IR indications: **Stop (red); Caution (yellow, be ready to stop at next signal); Attention (double yellow, next signal is at Caution); Proceed (green)**. A signal behind a diverging route shows at most Caution/Attention when points are set off the main line. CONFIRMED [IRFCA-SIG2].
- **Calling-on signal**: always combined with a stop signal; when off shows "Proceed Slow" so a train can enter an occupied line (coupling, long platforms, entering station limits to clear the block behind). Shunt signals: shunting normally at max 15 km/h. CONFIRMED [IRFCA-SIG3].
- Station order on approach (full set): Distant/Warner > **Outer** > **Home** > (loop homes bracketed) > **Starter** > **Advanced Starter**. Home is not optional; Outer is the outermost stop signal at "B"-class stations. CONFIRMED [IRFCA-SIG2].
- Class "A" station: home signals only; Class "B": Outer + Home (+ Starter on double line), allowing two simultaneous receptions on the two loops; B class is used on most single lines. CONFIRMED [IRFCA-SIG2].
- **Overlap (clearing distance)**: block overlap at the reception signal = **180 m** for MACL/MAUQ/MLQ (older 2-aspect/LQ: **400 m**). Signal overlap beyond the starter/other stop signals = **120 m** (MACL/MAUQ), 180 m for 2-aspect/LQ. CONFIRMED [IRFCA-SIG2], [IRFCA-SIG4].
- Advanced starter placed about **180 m beyond trailing points**; Outer about 180 m behind home on class B. CONFIRMED [IRFCA-SIG2].
- **Braking distance**: distant signal placed "full braking distance" before the first stop signal, "2 km or so" so a max-speed train can stop; two distants standard where speed above 100 km/h and goods trains need over 1 km. The 1000 m / 1200 m figures appear as warner-to-next-station and distant spacing tests (1200 m for warner, 1 km for distant). CONFIRMED [IRFCA-SIG2] for those statements; **a single "IR braking distance = 1000 m" constant is UNCONFIRMED** (it is a rule-of-thumb for goods trains, not a formal constant I could open).
- **Sighting/visibility**: 3-/4-aspect signals visible at least **200 m**; 2-aspect outer: 1200 m if speed above 100 km/h, else 800 m; home/starter/lone warner: 400 m. CONFIRMED [IRFCA-SIG2].

## 4. Loop / crossing stations, interlocking, speeds
- Station layout: through ("main") line with one or more **loop lines**; trains "cross" (opposite directions) or "overtake" (same direction) by one standing on a loop. Crossings are the main capacity limiter on single line (a B-class station can receive two trains simultaneously on loops). CONFIRMED [IRFCA-SIG2].
- Interlocking standards: **Std I** (mechanical, branch lines, through speed max 50 km/h); **Std II** (main line isolated from loops, through speed max 75 km/h); **Std III** (trunk routes, loops isolated by sand humps/trap points/derailing switches, through speed limited only by section speed). CONFIRMED [IRFCA-SIG4].
- Loop reception speed: **15 km/h** onto loop in older (MLQ/LQ) working; loop speed under multi-aspect/Kavach trials **30 km/h** (turnout restriction). CONFIRMED [IRFCA-SIG2], [WIKI-KAVACH]. A typical colour-light turnout limit (30 km/h on 1 in 12 turnout) is UNCONFIRMED (none).
- Home signal cannot be cleared unless route points are set, locked and (in track-circuited yards) route is track-clear; gate signals cannot be cleared unless gate is closed to road. CONFIRMED [IRFCA-SIG4].
- **Loop line length**: station-specific examples from East Coast Rly station working rules (BCHL about 702-778 m standing length STR-STR; KTGA about 720 m; BGHU 735-800 m). UNCONFIRMED (snippet; documents on eastcoastrail.indianrailways.gov.in were not opened). **Standard "686 m" BG: UNCONFIRMED (none)**; 650 m is only seen as a BG turn-back siding figure (secondary exam site). Treat loop length as a per-station game parameter, not a constant.
- Train lengths (to size loops): 58 BOXN wagons is the usual full freight rake; 16-car Vande Bharat about 384 m. CONFIRMED [IRFCA-FRT], [WIKI-VB]. A 24-coach LHB train is about 600 m (secondary, UNCONFIRMED).

## 5. Priority classes and precedence
- Traditional IR order (high to low): breakdown train going to accident > Presidential/Ministerial train > Mail > Express > Troop train > Specials engaged by public > Ordinary passenger > Mixed > Parcel > breakdown returning > **fast through goods** > work trains > ballast/material trains. CONFIRMED [IRFCA-OPS3].
- In practice Rajdhani/Shatabdi (and other prestige/"Minister's list"/"board-monitored" trains) rank above mail/express; mails are now lumped with express and superfast. CONFIRMED [IRFCA-OPS3].
- Suburban/EMU/MEMU and locals with many halts are often given higher precedence than long-distance Mail/Express (except Rajdhani/Shatabdi); even a Rajdhani can trail a stopping train. CONFIRMED [IRFCA-OPS3].
- Important goods (priority container, parcel) can be given precedence over passenger trains to give them a clear run; goods trains generally low. CONFIRMED [IRFCA-OPS3].
- Where Vande Bharat/Duronto/Tejas sit exactly: sources disagree (exam-prep pages put Vande Bharat top or near top). UNCONFIRMED (conflict). Official numbered "General Order of Precedence" list (Mail/Express = 5, Fast Passenger = 7, Passenger = 9, express goods 12, through goods 13): UNCONFIRMED (snippet) https://m.indiarailinfo.com/faq/post/467 (page returned 403).
- **How long a freight waits**: no official figure; IRFCA says precedence holds "regardless of how much detention". Average goods speed on trunk routes 40-45 km/h (see 11). Typical crossing/overtake wait times (minutes): UNCONFIRMED (none).

## 6. Timetable and running time logic
- Working timetable contents: schedules with make-up time, load tables per loco class, crossing and precedence table, speed restrictions (turnouts, curves), connections/detentions, engineering allowances, level crossing lists, max speeds per stock type, ghat/banking rules. CONFIRMED [IRFCA-OPS1].
- Time components: minimum running time, **extra allowance** (acceleration/deceleration, EA for caution orders), **Traffic Recovery Time (TRT)** for line occupancy, make-up allowance, recovery time (typically allotted to final section within a division). Example breakdown: min vs normal running 6 min + recovery 2 min + loss of time for passenger 4 min = 12 min total, 10 min actually allowed. CONFIRMED [IRFCA-OPS1] (example, not a standard).
- **Superfast** = notionally commercial speed above **55 km/h** on BG (surcharge category). CONFIRMED [IRFCA-OPS1].
- Max speeds: Vande Bharat max operating **160 km/h** (reached Tughlakabad-Agra; average about 83 km/h). CONFIRMED [WIKI-VB]. Railway Board reportedly cut 160-capable trains to 130 km/h on 24 Jun 2024: UNCONFIRMED (conflict, snippet). Rajdhani/Shatabdi/Duronto 130 km/h and Mail/Express 110 km/h (plan to raise about 400 trains to 130 in 2026): UNCONFIRMED (snippet) https://www.indiatvnews.com/news/india/indian-railways-plans-major-speed-upgrade-400-mail-express-trains-set-to-run-at-130-kmph-2026-06-05-1043781
- Goods on mainline BG generally **75 km/h**; some container/parcel/special freight up to **100 km/h**; WAG-9 hauling 58 BOXN-HA reached 100 km/h in trial; Gomoh-Mughalsarai BOXN trials at 100 km/h. CONFIRMED [IRFCA-FRT].
- Passenger (ordinary) max speed: UNCONFIRMED (none). MEMU/EMU suburban max speed: UNCONFIRMED (none).
- **Standard station halt**: no standard found. Real examples show 2 minutes approved for new mail/express stops. UNCONFIRMED (snippet) https://www.freepressjournal.in/amp/bhopal/8-long-route-trains-get-halt-at-bargawan-station-wcr-in-madhya-pradesh-check-all-details . Technical halts (bankers, crew change, loco change) are added in the schedule. CONFIRMED (existence) [IRFCA-OPS1].
- Train load rule of thumb: 8-wheel coach = 2 units; "15/30" = 15 coaches; 58 BOXN or 42 BCN freight rake. CONFIRMED [IRFCA-OPS1], [IRFCA-FRT]. Vande Bharat 8/16/20 coaches (192/384/480 m). CONFIRMED [WIKI-VB]. Per-coach length about 24 m derived from that (384/16).

## 7. Delays and recovery
- Long-distance trains routinely lose half an hour to hours; schedule slack, especially in the last section of a division, lets them recover. Prestigious trains get operational priority. CONFIRMED [IRFCA-OPS1].
- Early-running trains are detained outside station limits until the platform/section is free; this is sometimes planned in the schedule. CONFIRMED [IRFCA-OPS1].
- **Punctuality definition**: on time = arrives within **15 minutes** of schedule, measured at terminating station only. UNCONFIRMED (snippet; PAC/CAG reports reported in press) https://www.tribuneindia.com/news/india/15-minute-leeway-still-one-in-3-trains-misses-punctuality-target/ . Recent mail/express on-time rate around 73-77 percent: UNCONFIRMED (snippet).
- Regulation = the controller changes order of trains (hold a lower-precedence train at a loop) to protect higher ones. CONFIRMED [IRFCA-OPS3].
- Terminal turnaround minimum times: UNCONFIRMED (none) for passenger; see 8 for rake-level hours.

## 8. Platforms, rake links, reversals, loco change
- Each station has a **platform and siding occupancy chart** per day-of-week built from schedules; a new train needs a free slot. At small stations the station master picks platforms ("Master's Acceptance"); at large ones section controllers/cabin decide. CONFIRMED [IRFCA-OPS3].
- **Rake link** (issued by zonal railway): which trains share rakes, formation/splitting, composition, maintenance station, **lie-over periods**, km earned per round trip. **Two-way rake sharing is very common** (rake works train A then return train B). Trains over about 2000 km usually have dedicated rakes. CONFIRMED [IRFCA-OPS3].
- Primary maintenance of coaching stock about every **3500 km** (formerly 2500 km). Rake usage about 16 h/day on short trips, 18 h/day on long; allow 1-2 h/day for late running and 4-6 h/day cleaning/maintenance. Rakes needed by journey time: up to 8 h = 1; 8-17 h = 2; 17-26 h = 3; 26-36 h = 4. CONFIRMED [IRFCA-OPS3].
- Loco crew/loco change and banker attach/detach are scheduled technical halts (example Kasara/Igatpuri/Itarsi/Katni). Loco and rake links are separate documents. CONFIRMED [IRFCA-OPS1], [IRFCA-OPS3].
- Passenger-train terminal turnaround (arrive-to-depart minutes): UNCONFIRMED (none). Locomotive crew report-time before departure: IRFCA mentions fixed pre-departure times (not extracted precisely) so treat as UNCONFIRMED.

## 9. Anti-collision: Kavach and SPAD
- **SPAD** = Signal Passed At Danger (passing a stop signal at red without authority). Kavach prevents it by automatically braking before the signal; after a SPAD it enters Trip Mode with emergency brakes. CONFIRMED [PIB-KAVACH], [WIKI-KAVACH].
- Kavach = indigenous ATP by RDSO; trackside RFID tags for location, stationary units reading interlocking data, UHF radio, Movement Authority calculated and sent to the loco; onboard unit generates braking curves; SIL-4. CONFIRMED [PIB-KAVACH].
- Functions: SPAD prevention, overspeed, turnout speed restriction, permanent speed restrictions, automatic horn near level crossings, roll back/forward protection, automatic **Stop-on-Sight** when two trains face each other in a block section. CONFIRMED [PIB-KAVACH]. Brakes applied via Brake Interface Unit (higher of driver/Kavach demand). CONFIRMED [WIKI-KAVACH].
- Trials: a 130 km/h train slowed to 30 km/h before a loop; a Vande Bharat at 160 km/h stopped 10 m before a red signal (Mathura-Palwal, Feb 2024). CONFIRMED [WIKI-KAVACH] (Wikipedia, lead only).
- Coverage: **more than 2,200 route km**, Kavach 4.0 over 1,300 route km in five zones (Feb 2026). CONFIRMED [PIB-KAVACH]. Older: 1,456 km Aug 2024; 708 stations and 1,107 locos by 14 Jul 2025. CONFIRMED [WIKI-KAVACH].
- Numeric braking parameters (deceleration rates, safe braking distance in Kavach spec): UNCONFIRMED (none), RDSO spec not opened.
- TCAS = earlier name/trial of the same family; AWS in-cab warning used on Mumbai/Howrah suburban. CONFIRMED [IRFCA-SIG4].

## 10. Level crossings
- General Rules: gates kept "constantly closed and securely fastened across the thoroughfare" and opened only for road traffic (GR 16.xx). Gateman watches passing trains; must close gates if the gate or its signal fails. CONFIRMED [IRFCA-GRLC].
- **Interlocked gate**: the **gate stop signal** cannot be cleared until the gate is closed to road traffic; gate signal marked with a yellow "G" plate. If a gate signal is at on, a train stops, waits a minute or two, then proceeds slowly and must wait for the gateman's hand signal. CONFIRMED [IRFCA-SIG2], [IRFCA-SIG4].
- Gate signals are placed at least the block-overlap distance from the gate; warner behind a gate signal is not cleared unless the next station's first stop signal is at least **1200 m** ahead of the gate signal. CONFIRMED [IRFCA-SIG2].
- Gate buzzer trigger in rear of gate: 5 km on IR (8 km DFC); station master informs gateman when a train leaves if station is under 5 minutes away. UNCONFIRMED (snippet) https://dfccil.com/upload/Appendix_2A.pdf
- **Minutes before arrival that a gate must close**: UNCONFIRMED (none). Road-user waiting time: UNCONFIRMED (none). 17,083 manned LCs as of 1 Apr 2024: UNCONFIRMED (snippet).
- Level crossing gates are part of block working: a gate stop signal in ABS/absolute block is one more stop signal on the section; Kavach honks automatically near LCs (see 9).

## 11. Freight and DFC (optional)
- Typical block rakes: 58 BOXN (3828 t) or 42 BCN (2560 t) wagons; most freight revenue now from block rakes. CONFIRMED [IRFCA-FRT].
- Goods train speed: mainline BG generally 75 km/h; average on trunk routes **40-45 km/h**; fast container 100 km/h. CONFIRMED [IRFCA-FRT].
- Goods trains rarely stop at passenger halts, so they can get a clear run if released just ahead of a stopping passenger (example: goods leaving 5 min before Gujarat Mail). CONFIRMED [IRFCA-OPS3].
- Dedicated Freight Corridors (DFC): average freight speed 99.38 km/h on EDFC (New Khurja-New Bhaupur) and 89.50 km/h on WDFC in 2021; WDFC 1506 route km, EDFC 1875 route km (incl. PPP section). CONFIRMED [DFC-PR]. Design: 1.5 km long trains, 100 km/h. UNCONFIRMED (secondary) https://rrb.iitk.ac.in/sathee-railway-exams/student-corner/railway-gk/indian-railway-features/dedicated-freight-corridor
- Freight share of traffic (tonne-km / trains): UNCONFIRMED (none).

---

## Constants table
| Name | Value | Unit | Source | Status |
|---|---|---|---|---|
| control_section_length | 150-200 | km | [IRFCA-OPS3] | CONFIRMED |
| block_overlap_multiaspect | 180 | m | [IRFCA-SIG2] | CONFIRMED |
| block_overlap_2aspect | 400 | m | [IRFCA-SIG2] | CONFIRMED |
| signal_overlap_multiaspect | 120 | m | [IRFCA-SIG2] | CONFIRMED |
| advanced_starter_beyond_points | 180 | m | [IRFCA-SIG2] | CONFIRMED |
| outer_behind_home_classB | 180 (beyond overlap) | m | [IRFCA-SIG2] | CONFIRMED |
| distant_to_stop_signal | ~2000 | m | [IRFCA-SIG2] | CONFIRMED ("2 km or so") |
| warner_gate_min_gap | 1200 | m | [IRFCA-SIG2] | CONFIRMED |
| goods_braking_distance_needing_2_distants | >1000 | m | [IRFCA-SIG2] | CONFIRMED |
| sighting_distance_multiaspect | 200 | m | [IRFCA-SIG2] | CONFIRMED |
| abs_signal_spacing | 1000 | m | Railway Board letter (snippet) | UNCONFIRMED |
| abs_headway | ~150 | s | rrb.iitk.ac.in (secondary) | UNCONFIRMED |
| abs_stop_wait_before_proceed | 60-120 | s | [IRFCA-SIG2] | CONFIRMED ("a minute or two") |
| shunting_speed | 15 | km/h | [IRFCA-SIG3] | CONFIRMED |
| loop_entry_speed_conventional | 15 | km/h | [IRFCA-SIG2] | CONFIRMED |
| loop_speed_under_kavach_trial | 30 | km/h | [WIKI-KAVACH] | CONFIRMED (Wikipedia) |
| thru_speed_std1 / std2 / std3 | 50 / 75 / section | km/h | [IRFCA-SIG4] | CONFIRMED |
| fog_speed_green / double_yellow | 60 / 30 | km/h | [IRFCA-SIG2] | CONFIRMED (N. Rly fog rule) |
| vande_bharat_max | 160 | km/h | [WIKI-VB] | CONFIRMED (some reports say 130 cap) |
| rajdhani_shatabdi_max | 130 | km/h | news snippet | UNCONFIRMED |
| mail_express_max | 110 | km/h | news snippet | UNCONFIRMED |
| passenger / MEMU max | 75-100 (guess) | km/h | none | UNCONFIRMED |
| freight_max_mainline | 75 | km/h | [IRFCA-FRT] | CONFIRMED |
| freight_fast_container_max | 100 | km/h | [IRFCA-FRT] | CONFIRMED |
| freight_avg_trunk | 40-45 | km/h | [IRFCA-FRT] | CONFIRMED |
| superfast_min_commercial_speed | 55 | km/h | [IRFCA-OPS1] | CONFIRMED |
| freight_rake_wagons | 58 BOXN / 42 BCN | wagons | [IRFCA-FRT] | CONFIRMED |
| vande_bharat_rake | 8 / 16 / 20 coaches = 192 / 384 / 480 m | coaches, m | [WIKI-VB] | CONFIRMED |
| loop_length_standard | 686 or 650 (guess) | m | none | UNCONFIRMED (use per station; real examples 702-800) |
| station_halt_mail_express | 2 (guess) | min | news snippet | UNCONFIRMED |
| punctuality_threshold | 15 | min | tribuneindia (snippet) | UNCONFIRMED |
| rake_usage_per_day | 16 short / 18 long | h | [IRFCA-OPS3] | CONFIRMED |
| rake_primary_maintenance_interval | 3500 | km | [IRFCA-OPS3] | CONFIRMED |
| lc_gate_close_lead_time | (none) | min | none | UNCONFIRMED |
| lc_buzzer_distance | 5 | km | DFCCIL Appendix 2A (snippet) | UNCONFIRMED |
| terminal_turnaround_min | (none) | min | none | UNCONFIRMED |
| freight_wait_at_loop | (none) | min | none | UNCONFIRMED |
| DFC avg freight speed | 99.38 EDFC / 89.50 WDFC | km/h | [DFC-PR] | CONFIRMED |
| kavach_coverage | >2200 | route km | [PIB-KAVACH] | CONFIRMED |

## What the game simplifies
- No block-instrument/token detail: a block section is a track segment holding at most one train; Line Clear is implicit.
- Signals are 4-aspect colour light only; aspects derived from the next two blocks; no semaphore, calling-on or shunt signals except as optional.
- Precedence is a numeric class priority; Minister's-list/political overrides and crew hours are omitted.
- Loop lengths, halts, turnaround times and recovery margins are game parameters (flagged UNCONFIRMED), not official values.
- Level crossings: gate closes a fixed lead time before the train and the gate signal is cleared only when closed; no road traffic model.
- Kavach is modelled as: brake to stop before a red signal and enforce turnout/loop speeds; no UHF/RFID detail.
- Rake and loco links are a simple "after turnaround, this rake works the return train"; no maintenance cycles.

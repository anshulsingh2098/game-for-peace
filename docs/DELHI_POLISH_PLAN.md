# Delhi polish plan, scale check and where we are on N0 to N20 (18 Nov 2026)

Written by Rajul's Claude after the owner said the city "looks weird, roads are not good" and asked for a phased plan for Delhi's infrastructure, graphics, landmarks, roads, banners, hoardings, shops, real places and Metro stations.

## 1. Scale check (measured in the running game, `?play&city=delhi&q=med`)

| Thing | Measured | Real Delhi | Verdict |
|---|---|---|---|
| Car (Dusk GT) | wheelbase 2.96 m, track 1.64 to 1.96 m | sedan 2.6 m, 1.55 m | fine |
| Lane width | 3.2 m (residential 2.8 m) | 3.0 to 3.5 m (lanes in Delhi are often marked 3.0 m) | fine |
| Street widths (median, pieces) | secondary 6.4 m, tertiary 6.0 m, residential 5.6 m, service 2.8 m, footway 1.2 m, up to 19 m for 6 lanes | local 5 to 7 m, arterial 14 to 25 m per carriageway side | roads are the right width; the arterials are drawn as two one-way pieces with nothing between them |
| Storey height | 3.2 m | 3.0 to 3.4 m | fine |
| Buildings (tile 0,-2) | median 4 floors (12.8 m), p90 5 floors, max 28 floors, median footprint 393 m2, none guessed in this tile | Lutyens and CP 3 to 6 floors | fine |
| Pavement | 1.8 m each side, kerb 0.15 m | 1.5 to 3 m, often broken or missing | fine as a start |
| **Building coverage of the ground** | **6 to 19 % of a 1 km tile** (central tiles 17 to 19 %, others 6 to 9 %) | built-up Delhi 30 to 70 %, Old Delhi 60 to 80 % | **the main reason it looks empty** |

So the *numbers* of scale are right. What looks wrong is:

1. **Voids.** OpenStreetMap's building footprints are incomplete in Delhi (many residential areas are unmapped), so blocks are drawn as flat grey ground with a few buildings. A car in a narrow service lane crosses a huge empty grey plaza (seen at -300, -1900).
2. **Roads read as plain strips.** No medians (a dual carriageway is two one-way pieces with a grey void between), no junction shaping, thin markings, one asphalt tone, no wear, patches, speed breakers or lane arrows, pavements that are always the same.
3. **Facades repeat** (same windows every storey, flat colours, few balconies, AC units, water tanks, shutters, signs).
4. **Few landmarks have models** (22 of 63), and none was compared to a photograph.
5. **The Metro and rail look unchecked** against photographs except Blue Line and Laxmi Nagar.

## 2. The phased plan (each phase ends with: a measured frame cost, a look at screenshots, `node tools/selftest.mjs`, a PR, the log entry; budgets from `docs/CITY_PACK.md` section 4; frame today at the default start is about 270 calls and 240k triangles at `q=med`)

**Phase P1: fill the voids (the biggest visible gain).**
- **Status 19 Nov 2026:** frontage rows built (PR 76 and the infill branch), interiors of big blocks added (`infill.js`, back-to-back rows with 3.2 m lanes). `node tools/measure_voids.mjs` (new): 100 m cells in blocks with under 3 % cover in the 5 sample areas went from 19 to 10 (Chandni Chowk 0, Karol Bagh 0, Lajpat Nagar 0, Connaught Place 2, Khan Market 8, the last two are Lutyens lawns, fill 10 % by design). Coverage of block ground is still 16 to 38 % (target 50 to 60 %): in the pack 20 to 55 % of a tile's ground is in no block face at all, and the interior lots are mostly refused because they hit a mapped building or fall outside an irregular block. Open: forecourts, parking and plazas, the coverage targets.
- Infill buildings in unmapped parts of urban blocks, procedurally and deterministically: along street frontage first (street-facing rows with 1 to 3 m setback, 3 to 5 floors, shared walls), driven by land use and an area profile (`identity.json`: Old Delhi dense and tall and narrow, Karol Bagh and Lajpat Nagar markets, Lutyens low bungalows, urban villages, DDA flats). Never on a road, claim or landmark (keep-out registry). Target coverage by area: Old Delhi 60 %, markets 50 %, DDA 35 %, Lutyens 15 %.
- Forecourts, parking and plazas where a block stays open: paving texture, trees, parked cars, a few stalls (not a flat grey plane).
- Done when: no 100 m by 100 m grey void inside an urban block in the 5 sample areas; coverage numbers above; frame within budget (infill buildings are instanced or merged, windows by shader not geometry).

**Phase P2: roads and infrastructure.**
- Medians on dual carriageways (kerbed strip, shrubs, lamp poles), joined junction patches with rounded corners, stop lines, zebra crossings at every signal, lane arrows, speed breakers on residential streets, wear (patches, oil, edge dirt) by shader.
- Pavement variety: width by class, tactile strips, broken slabs in old areas, steps and ramps at crossings; street furniture: bus shelters (DTC), auto and e-rickshaw stands, police booths, petrol pumps, public toilets, telecom boxes, signal poles with the Indian two-lamp head, sodium street lights, overhead wires (some exist).
- Flyovers and underpasses: ramps joined to roads, parapets, pier art, painted pillars, lights, signs; no flyover pier in front of a start (done), checked by a drive script at every gate.
- Done when: a scripted drive of 150 streets finds none stopped by anything invisible (the pure-pursuit drive script used on 18 Nov was typed into the browser console and is not in `tools/` yet: add it as the first task of this phase), junction screenshots at 8 junctions look right, frame within budget.

**Phase P3: buildings, shops and the look of a street.**
- Facade kits per area (windows, balconies, AC units, water tanks, rolling shutters, awnings, signs on the first two floors, paint colours and grime by age), roof clutter (tanks, antennas, drying clothes, terraces), setbacks and arcades (Connaught Place's colonnade).
- Real shops and real spots: use OpenStreetMap POI names for shops, restaurants, banks, hospitals, schools, mosques, temples, gurdwaras (ODbL, credited), with generic signage (no brand logos or trademarks), opening hours from OSM where present, and a few hand-made famous places (Karim's, Paranthe Wali Gali, Khan Market's shops, Janpath, Palika Bazaar, Sarojini Nagar, Chandni Chowk's lanes). Stalls and carts placed by market type (done as a start).
- Done when: five named streets (Chandni Chowk, Karol Bagh, Connaught Place, Khan Market, Lajpat Nagar) are checked against 5 photographs each, listed in `DELHI_LOOK.md`, and a Delhi person has marked them.

**Phase P4: banners, posters, ads and hoardings.**
- Wall posters (peeling layers, political and film posters, "stick no bills" gaps), lamp-post banners, unipoles at junctions (done), rooftop hoardings, metro pillar wraps, flyover ads, bus-shelter panels (done), bus body ads, shop-shutter paintings, wall ads (painted brands), digital screens at CP and stations. Content: generic or fictional brands, in Hindi and English, rotated by month (festivals: Diwali, Holi, Independence Day).
- Done when: ad density per area follows `identity.json`, no readable real trademarks, cost under 20 draw calls.

**Phase P5: landmarks.**
- The remaining 41 landmark models in priority order (Sansad Bhavan details, Safdarjung Tomb, Humayun's Tomb gardens, Bangla Sahib, Birla Mandir, Akshardham detail, markets as places, IGI T3, Bharat Mandapam, stadiums), each compared with photographs (owner's call on sources), interiors for 3 (Red Fort's Diwan-i-Am, a Metro station, a market lane).
- Done when: every landmark in `docs/DELHI_LANDMARKS.md` has a model or a marker with a card, and the 22 existing ones are checked.

**Phase P6: Metro and railway stations.**
- Interchange stairs and escalators for every line, tunnels between underground stations and portals, platform screen doors by line, signage (Hindi, English, line colours), concourse lighting, fare gates, lifts, entrance kiosks with the DMRC look, train liveries per line with correct cars per rake, announcements on the platform; railway: platform numbers (done), shed roofs by station, real timetable link, Old Delhi and Nizamuddin architecture.
- Done when: the 11 lines have a photo-checked livery and one station of each type is walked end to end.

**Phase P7: people, vehicles, life.**
- Auto-rickshaws, e-rickshaws, cycle-rickshaws, scooters and bikes with riders, DTC and cluster bus liveries, street vendors, cows and dogs, crowds by hour, festival days, weather and haze by month (done as a start), sound (horns, azaan, temple bells, vendors) from licensed sources.
- Done when: traffic mix follows `identity.json` by area and hour; frame within budget.

**Phase P8: measure and judge.**
- `?bench=30&city=delhi` on two phones and a visible desktop window; a low level (fewer props and far buildings) for phones; a Delhi person's list; fixing pass. Delhi is complete when the city card in `docs/CITY_PLAN.md` is ticked.

Order: P1, P2, P3 first (they decide how the city feels), then P4 and P6 in parallel (different files), P5 across the rest, P7, P8 at the end of each block. Two sessions at a time at most (usage limits, `OVERALL_PLAN.md` section 5).

## 3. Where we are on N0 to N20 (18 Nov 2026)

Built means built and tested by script and looked at in a desktop browser; **nothing is accepted on a real phone or by Anshul**.

| Phase | What | State |
|---|---|---|
| N0 | Baseline, checklist, real phones | Baseline and checklist done; **phones, listening, Anshul's deploy and review open** |
| N1 | Driving, sound | Built (powertrains, acceptance script); **nobody has driven it by feel or listened** |
| N2 | Weather and look | Partly: matrix captured on a desktop for California only; dawn, fog and storm at dusk and night, other locations open |
| N3 | World polish | Mostly built (rails, tunnels, bridges, ground, hotel, lighthouse); tall grass, tree levels of detail open |
| N4 | Phones and speed | Loading screen and `?bench=30` built; **no phone measured**; Delhi frame cut from 610k to 240k triangles this week |
| N5 | Features | Built (traffic levels, My music, rumble, saves, tuner worker); customisation, tuner login, live publish setup open |
| N6 | Switch-over | Done in the repo; **not deployed, not accepted on devices** |
| N7 | Runtime and entities | First increment built |
| N8 | Sectors and streaming | First increment built |
| N9 | Regions | First increment built (Mumbai, Delhi, Agra, Bhopal profiles; the India world blends them) |
| N10 | Navigation graph | First increment built (main road; side roads open; Delhi has its own graph) |
| N11 | District slice | First increment built (Mumbai); **Delhi's real city replaces the stylised district**; junction, promenade, route open |
| N12 | Indian traffic | First increment built (two-wheelers, rickshaws, signals; junction routing, overtaking open; Delhi has its own traffic, buses on real routes) |
| N13 | Pedestrians | First increment built (boxes, sidewalk walkers); real models and reactions open |
| N14 | On foot | First increment built; capsule controller on Rapier checked; phones not decided |
| N15 | Activities and saves | First increment built (point to point, save v2) |
| N16 | Expanded regions | **Started: Delhi is the first complete city** (pack, renderer, Metro, rail, buses, 22 landmarks, street life); Mumbai, Bhopal and others are still stylised; Gurgaon, Noida next |
| N17 | Emergency services and events | Not started (tone decision pending) |
| N18 | Interiors and commerce | Not started (shops you can enter, petrol pumps) |
| N19 | Vehicle depth | Not started (three classes plus the concept car exist) |
| N20 | Persistence and polish | Not started (save v2 with migration exists) |

Summary: N0 to N15 are in the repo as first increments; **N16 is under way through Delhi; N17 to N20 have not started**. The gate the plans set (real-device acceptance of N0 to N6) is still not met.

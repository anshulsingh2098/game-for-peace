# City plan: real, unique, explorable cities, one by one (written 22 Nov 2026)

The owner's brief: city centres are a mess today (see "What is wrong now"), and each city must become a place you can explore at length, with what makes it that city: landmarks, colours and look, weather, people, cars, vegetation. Example: a player from Delhi should be able to roam Delhi, Noida and Gurgaon, go to the Buddh International Circuit for an F1-style race, to Cyber City, ride the Delhi Metro, see major railway stations, big hotels, parks, ministry buildings. Everything built from open data and city maps, **in phases, one city at a time**, finishing a phase before the next.

Rules that always apply: every download needs the owner's yes (file, source, size); licences below are what search results and project pages said, not legal advice (`docs/OPEN_DATA.md` has the running list); OpenStreetMap data is ODbL (credit on screen, share-alike for the derived data files); **no Google Maps/Earth data or screenshots** (terms of service forbid it); no copyrighted photos or models in the repo; real-name landmarks are built as our own procedural or CC0 models.

## What is wrong now (seen at Agra, 22 Nov 2026)
- Buildings of the procedural district (`district_plan.js`, built for one Mumbai boulevard) stand on top of other roads and the railway: it only knows its own road, so anything else that crosses (rail, a second highway, the station) is built through. Giant flat-coloured slabs (station canopies or building blocks) overlap tracks and roads.
- The district is one strip of buildings along one road. A real city is a street graph with blocks, not a strip.
- Every city looks the same (same palette, same dome-and-balcony kit, same cars), and no city has its real landmarks.
- **Scale problem to decide first:** the India world is 1:100 (1 game metre = 100 real metres; a whole city such as Delhi is a few hundred game metres across), so a real city street layout cannot exist inside it. Cities need their own **1:1 enclave** (a "city bubble", entered from the highway outside the city, with the same road and rail components at real size), or a larger local scale. This is the first design decision (Phase 0).

## Data we can use (all need the owner's yes before download)
| Need | Source | Licence (as found; verify) | Notes |
|---|---|---|---|
| Streets, blocks, one-ways, bridges, flyovers, junctions, landuse, parks, water | OpenStreetMap (Geofabrik India extract or Overpass API per city), `highway`, `landuse`, `leisure`, `natural`, `waterway` | ODbL | Cut offline with osmium/ogr2ogr into a small per-city file |
| Building footprints, levels, heights, names | OSM `building*`; Microsoft/Google Open Buildings and Overture as fill where OSM is sparse | ODbL; Open Buildings CC BY 4.0 or ODbL (unverified which) | OSM `building:levels` and `height` where present, otherwise a guess from landuse |
| Metro, railway lines, stations, platforms | OSM `railway=subway/light_rail/station`, `public_transport` relations | ODbL | Delhi Metro line colours and station names are tagged |
| Landmarks, hotels, ministries, parks, malls, stadiums, circuits | OSM `tourism`, `historic`, `amenity`, `leisure=track/stadium`; Wikidata for ids, names, heights and dates | OSM ODbL; Wikidata CC0 | The curated list of what to build by hand comes from these |
| Reference of how a place looks (colours, materials, facade style) | Wikimedia Commons categories (look only; copy no files) | per-file licences | Use as colour and style reference, write the values into data |
| Climate, rain, heat, fog, dust, monsoon | IMD normals; Koppen-Geiger; NASA POWER or ERA5 (Copernicus) | public / CC BY (verify) | Drives per-city weather tables |
| Land cover, trees, parks | ESA WorldCover (CC BY 4.0), OSM `natural=wood`, `landuse=forest`; city species lists from forest-department or botanical sources | CC BY / ODbL | Neem, peepal, gulmohar, ashoka, bougainvillea in Delhi; coconut and rain trees on the coast, etc. |
| People and traffic mix | Census of India and city transport surveys (modal share), road traffic data | public (verify) | Two-wheelers, autos, e-rickshaws, buses, taxis, metro; clothing and crowd by area |
| Tools (code) | osmium, osmium-tool, ogr2ogr, OSM2World (LGPL) as a reference | permissive / LGPL | Build-time only, in `tools/` |

## Phases (finish and verify each before the next)

### Phase 0: stop the mess and decide the architecture (before any city work)
1. Write down the current district, landmark, rail, road and station code paths and who owns which ground (read `docs/DISTRICT.md`, `rail_view.js`, `district_plan.js`, `landmarks.js`).
2. A shared **keep-out and ownership registry** (pure, tested): every road, rail edge, station and landmark registers the ground it covers (polylines with widths, polygons); the district, scatter and props ask it before placing anything. This alone fixes buildings on rails and roads.
3. Decide the city scale (1:1 enclave versus larger local scale), how a player enters and leaves a city, how Travel/GPS/autodrive and the rest of the India world treat it, the performance budget (desktop, phone), and the **city pack format**: a versioned binary/JSON of streets, blocks, footprints, landuse, POIs, transit, plus an identity file (palette, weather, vegetation, people and traffic mix, signage languages). Write it in `docs/CITY_PACK.md`.
4. Fix the existing Agra mess with the registry as proof; a visual check list per city (see the "city card" below).
Done when: nothing is built through a road, rail or station in any current city; the architecture note is agreed by the owner.

**Status (22 Nov 2026, PR from `claude/goofy-liskov-0a8557`): items 1, 2 and 4 are built, item 3 is written and waits for the owner.**
- Item 1: the audit of who places what is in `docs/CITY_PACK.md` section 1 (with the measured overlaps: in Agra 143 of 430 planned plots, in Delhi 184 of 469, in Mumbai 101 of 247 stood on a rail bed, a station or another road).
- Item 2: `src/world/keepout.js`, the registry, wired into the district, scatter and station buildings; 4 new self-test checks (86 in all). After it, no plot touches a rail, station, landmark zone or second road in Agra, Delhi or Mumbai, plots no longer overlap each other on bends, and trees keep off rails and stations. Not yet asking the registry: `landmarks.js` and props.
- Item 3: `docs/CITY_PACK.md` (recommendation: 1:1 city enclaves entered from the highway gates, budgets, the pack format). **Open for the owner: agree enclaves (question 1 below).**
- Item 4: Agra, Delhi and Mumbai are fixed by the registry as measured; Kolkata has no district of its own yet and was not measured. Nobody has looked at it from the air or on a phone; `CHECKLIST.md` has a line for it. The station canopies and buildings are still plain boxes (Phase 5).

### Phase 1: the city pipeline (offline tool, one pilot: Delhi NCR)
1. `tools/build_city.mjs` (or python): input an OSM extract and a bounding box or polygon, output a city pack: street graph with classes and names, blocks, building footprints with levels/height/use, landuse, parks and water, metro and rail, POIs and landmarks, one-way and lane counts where tagged. Deterministic, documented, with the attribution file.
2. Validation script in `tools/` (counts, bounds, no self-overlap, sizes) and a self-test that checks the shipped pack is current.
3. Delhi NCR first as three packs (Delhi, Gurgaon, Noida-Greater Noida) because the owner knows it and can judge it.
Done when: a Delhi pack builds from a stated extract, passes validation, and its size and load time are within the budget.

**Status (session D1+D4, branch `claude/jovial-wilbur-a411de`): items 1 to 3 are built for Delhi (package D1); Gurgaon and Noida are not.** `tools/build_city.mjs delhi` cuts the NCT of Delhi out of the Geofabrik northern-zone extract (`docs/OPEN_DATA.md` lists file, size, sha256, licence) and writes `assets/cities/delhi/`: 406,472 street edges, 296,072 graph nodes, 244,405 building footprints (97 % with a guessed height: only 1,068 have a `height` tag and 7,342 `building:levels`), 81,795 blocks, 2,884 points of interest, 25 gates on the national highways, 1,925 one-km tiles, 63 landmarks; 77.5 MB raw, **19.8 MB gzip (budget 20 MB)**; builds in about 20 s and is deterministic. `tools/validate_city.mjs` (schema, hashes, geometry, no self-crossing, footprints against streets through the keep-out registry, sizes) passes; `tools/selftest.mjs` checks the shipped pack is current and valid and that the street graph routes (92 checks). What was cut to fit and what the data does not have: `manifest.json` `cuts` and `docs/CITY_PACK.md` section 5a. Not done: Gurgaon and Noida packs, railways and metro (D2), bus routes (D3), filling thin building coverage from Overture or Open Buildings, `identity.json` (Phase 3).


### Phase 2: the city renders and drives (Delhi, geometry only)
1. Street mesh and sidewalks from the graph (junctions, flyovers and underpasses with the new layer system: `Road.addLift`, `RoadSet` layers, `docs/INDIA_MAP_PLAN.md` overpasses), blocks and building footprints extruded to real or guessed heights, with a small set of facade kits per building use.
2. Traffic and pedestrians on the real street graph (lane counts, one-ways, signals at tagged junctions), parking, auto and e-rickshaw stands.
3. Streaming: chunks around the player, level of detail, mobile budget.
Done when: you can drive and walk a recognisable Delhi (Connaught Place ring, Kartavya Path, Ring Road, Mathura Road) without geometry errors and at the target frame rate.

**Status (D5, branch `claude/keen-gauss-3b2756`): the first slice of item 1 is built and looked at in a desktop browser.** `?play&city=delhi` renders streets (pack widths, painted sidewalks, lane marks), flyovers through deck meshes (physics and visuals; a car drives up, along and off), blocks, parks, water, 244k extruded footprints (guessed heights), landmark buildings and the five stations at their footprints (claimed in the keep-out registry), streamed per 1 km tile, five draw calls a tile. Not done: items 2 and 3 of Phase 2 (traffic and people on the graph, level of detail and the phone budget: only desktop counts, 326 to 370 draw calls and 206k to 270k triangles at medium), underpasses, kerbs, the highway-gate transition, facade kits.

### Phase 3: identity of the city (look, weather, people, cars, plants)
Per city an identity file, used by every system: colour palette and materials by area (Lutyens bungalow zone, old Delhi, glass towers, urban villages), sky and haze (Delhi winter smog, loo in May, monsoon), time-of-day light, vegetation species and density by area, street furniture and signage (Hindi/English/Urdu/Punjabi, metro signs), people (clothing by season, crowd density by place and time), vehicle mix (Maruti Suzuki, autos, e-rickshaws, DTC buses, delivery bikes), horn and ambient sound.
Done when: a blind side-by-side of Delhi and Mumbai screenshots is easy to tell apart.

### Phase 4: landmarks and points of interest (Delhi first list)
Curated from OSM and Wikidata, each built as our own model with a collision shape, a name board, and a short info card: India Gate and Kartavya Path, Rashtrapati Bhavan, Parliament, North and South Block (ministries), Red Fort, Jama Masjid, Humayun's Tomb, Qutub Minar, Lotus Temple, Akshardham, Lodhi Garden, Connaught Place, New Delhi, Old Delhi and Nizamuddin railway stations, Anand Vihar, IGI airport, Delhi Metro stations and lines (line colours), Taj Palace and other big hotels, malls and markets (Chandni Chowk, Sarojini), Cyber City and Gurgaon towers, Noida Sector 18, Buddh International Circuit, Jewar airport site. Order by how recognisable each is.
Done when: the first ten are built, placed from data (not by hand), and recognisable from the road.

**Status (D4, Delhi, same session): the data half is done, nothing is built.** `assets/cities/delhi/landmarks.json` holds 63 curated places (the plan's starting list plus markets, stadiums, stations, ISBTs, convention centres): English and Hindi name, position and footprint from OSM (60 found in OSM, 3 kept at the listed position), height where OSM or the list has one, Wikidata id, opening hours where tagged, a one-paragraph fact card, a `look` note and a proposed procedural model id. `docs/DELHI_LANDMARKS.md` has the list and six themed routes with drive and walk times from the street graph (generated by `tools/build_landmarks_doc.mjs`). Caveats: the `look` notes were not checked against photographs; the cards are a first draft from public facts, dates cross-checked against Wikidata; branded hotels and malls are left out on purpose (owner rule). The models (D8) and the registry claims for landmark footprints (the `landmarks.js` hook) are not done.

### Phase 5: transit (metro and rail inside the city)
Delhi Metro lines and stations (elevated, underground, interchange), trains, platforms, boarding as fast travel; major railway stations with real platform counts and layout (links to the railway control system, session "AI railway traffic control"); airport and bus terminals.

### Phase 6: things to do (activities)
A real-circuit race at the Buddh International Circuit (F1-style cars, laps, time trials, ghost), city tours between landmarks, taxi and delivery missions on the real street graph, photo mode, Metro ticket game. Uses the existing activities system (`docs/ACTIVITIES.md`).

### Phase 7: repeat for the next cities
Order: Delhi NCR, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, then Ahmedabad, Pune, Jaipur, Lucknow, Varanasi, Agra (Taj Mahal city), Amritsar, Kochi and the rest of the 86 stations in `rails.json`. Each city follows the same card below and does not start until the previous city passes it.

## The city card (done checklist for one city)
- [ ] Data: pack built from a stated extract; attribution in the credits; owner approved downloads.
- [ ] Streets, blocks and buildings from data; no object on a road, rail or station.
- [ ] Landmarks: top 10 built and placed; hotels, ministries or civic buildings, parks, stations, stadium or circuit as relevant.
- [ ] Transit: metro or local rail, stations, the main railway station.
- [ ] Identity: palette, weather table, plants, signage, vehicle mix, crowd, sound.
- [ ] People and traffic on the real street graph, at the budget.
- [ ] Phone and desktop frame rate measured (`?bench=30`); `CHECKLIST.md` line added; self-test checks added.
- [ ] The owner (or someone from that city) judged it: a short list of what feels wrong.

## Open questions for the owner
1. City scale: 1:1 enclaves entered from the highway (recommended) or a larger scale for the whole map?
2. OK to download an OSM extract for Delhi NCR (Geofabrik north zone is a few hundred MB; a bounding box through Overpass is much smaller)?
3. Which Delhi landmarks and places matter most to you, in order?
4. Real names on shops and brands: use real brand names (legal risk) or invented look-alikes?
## Owner answers (22 Nov 2026, relayed by the session "Multi-level road physics for flyovers", quoting the owner)
1. **City scale:** "entered from highway like a bypass in real world": 1:1 city enclaves entered from the highway, as a bypass or exit would be (`docs/CITY_PACK.md` section 3). **Agreed.**
2. **Downloads:** "yes download all maps you need": OSM extracts and the other open data in the table above are approved. Still required: a note of each file (source, size, licence, date, sha256) in `docs/OPEN_DATA.md`; ODbL credit on screen; no Google data. Phase 1 does not start until Phase 0 (PR 51) is merged.
3. **Places:** "every significant place that stays in hot topic and conversation but logically arranged as the real world": cover all well-known landmarks and areas of a city, not a short list, placed where they really are (from OSM and Wikidata positions). Phase 4's "first ten" is the first milestone, not the scope.
4. **Brands and shop names:** "invented lookalikes", never real brand names or logos (shop signs, hotels, malls, fuel stations, vehicles).

# Work remaining: every known limit, in one place (written 19 Nov 2026)

This is the reference for what still needs doing. Every limit Claude reported while building N7 to N15, the landscape pass, the India map, the junction network and the drive modes is listed here, grouped by area. Update it when you fix something (move the line to "Done" at the bottom with the date) and when you find a new problem. The phase tables are in `PARALLEL_PLAN.md`; the India design is `docs/INDIA_MAP_PLAN.md`; data sources are `docs/OPEN_DATA.md`; assets are `docs/ASSET_PLAN.md`.

Tags: **[person]** needs a human or a real device, Claude cannot do it. **[owner]** a decision only the owner can make. **[build]** Claude can build it. **[B]** mostly in Stream B's files (Anshul), **[A]** Stream A's.
Priority: **P1** wrong or risky as it stands, **P2** missing feature that matters, **P3** polish.

## 0. Things that apply to everything
| # | Limit | Tag |
|---|---|---|
| 0.1 | Nothing has been tried on a real phone: frame rate, memory, touch controls, Hindi fonts, loading time. Everything was looked at in a desktop browser pane or by script. | P1 [person] |
| 0.2 | Anshul has not reviewed any of N7 to N15, the landscape work, the India map, the junction network or the drive modes. Many Stream B files were changed additively (`traffic/sim.js`, `traffic/traffic.js`, `vehicle/physics.js`, `vehicle/rapier-vehicle.js`, `main.js`). | P1 [person] [B] |
| 0.3 | The live site is not updated. Only Anshul deploys. `cloudflare/public` is out of date by design. | [person] |
| 0.4 | N0 and N4 real-device acceptance, listening to the engine, and the N6 launch are still open. | P1 [person] |
| 0.5 | Tests are headless or look at a few screenshots. Nothing was driven for a long session (leaks, hitches over 10 minutes). | P2 [person] |

## 1. Owner decisions waiting
| # | Decision | Notes |
|---|---|---|
| 1.1 | A lawyer's reading of OpenStreetMap ODbL share-alike for `assets/india/waypoints.json` and the skeleton | The data is already in the repo, credited |
| 1.2 | Which city after Mumbai gets a full district (Delhi, Jaipur, Kolkata, Chennai, Bengaluru, Hyderabad) | Drives N11 and N16 |
| 1.3 | Licensed or original music for the radio (Bollywood songs are copyrighted) | |
| 1.4 | Which official map outline to use for India (the coastline sketch is not a boundary) | |
| 1.5 | Asset budget and who downloads packs by hand (Indian vehicles, rigged people, building kit) | `docs/ASSET_PLAN.md` |
| 1.6 | Whether on-foot play is wanted on phones | |
| 1.7 | Whether to use real elevation and land cover (NASA SRTM or Copernicus, ESA WorldCover) and approve the downloads | `docs/OPEN_DATA.md` |
| 1.8 | The tuner page login and the live Publish setup (N5 leftovers) | |
| 1.9 | (answered 22 Nov: agreed) **City scale: 1:1 city enclaves entered from the highway** (`docs/CITY_PACK.md` section 3), the budgets in section 4 and the pack format in section 5 | Blocks Phase 1 of `docs/CITY_PLAN.md` |
| 1.10 | (answered 22 Nov: yes, download the maps needed; log each file in OPEN_DATA.md) OSM extract for Delhi NCR | CITY_PLAN Phase 1 |
| 1.11 | **Delhi Open Transit Data GTFS** (DTC, cluster buses, DMRC timetables): it needs a click-through agreement with a stated purpose and identity, and the Terms restrict use to that purpose; not taken. Terms accepted by the owner on 17 Nov 2026 but the portal answers 403 Forbidden to every download (see OPEN_DATA.md): retry later or ask DoT via the Contact page, and ask whether derived route and frequency data may be published in an open-source game, or keep OSM-only (no timetable or frequency). | `docs/DELHI_TRANSIT.md` section 1 |

## 2. Engine and phases N7 to N10
| # | Limit | Tag |
|---|---|---|
| 2.1 | N7: the core-contracts note and the HUD and map layer change requests (N7a) are not written | P3 [build] |
| 2.2 | N8: sectors now own the crossing roads, signals and traffic of each city on a route (built when a sector holding a city is within 900 m, removed beyond 1,200 m), carry a region and a blend near borders (`world/regionmap.js`), and show side-road counts in the debug panel. Terrain, plain roads and scenery still stream by tile and road piece, not by sector, and the world is still one guided road at a time. | P1 [build] |
| 2.3 | N9: inside the India world, regions blend by position and there is no reload between them (20 Nov 2026); the separate Explore cities worlds still load fresh when picked | P3 [build] |
| 2.4 | N9: in `?india=` mode the ground colours and plant tint now blend between regions by position (`T.regionAt`, `regionTint`: nearest and second nearest region, blend within 150 km of the border); water colour, tree species mix and road style do not change by region; the nine regions as standalone worlds are still impressions from recipes | P2 [build] |
| 2.5 | N10: the navigation graph covers the main road only; side roads and junctions are not in it | P1 [build] [B] |
| 2.6 | `config.road.guide` roads now run over real elevation (see 8.6); land under non-India modes is still a region recipe | P3 [build] |

## 3. Cities and districts (N11)
| # | Limit | Tag |
|---|---|---|
| 3.1 | Mumbai district: a boulevard and a two-lane street now cross the main road (region data `junctions`, with the district, traffic and a shared signal); their corner buildings overlap the main road's plots; still no promenade, no designed route, no phone numbers | P2 [build] |
| 3.2 | Delhi, Agra and Bhopal have a built-up district and a crossing street (region data). Mughal buildings now have a central dome and four corner pavilions (chhatris) and old-city buildings have projecting balconies (jharokha), so they no longer look like Mumbai; arches, jali screens, haveli courtyards, narrow lanes and minarets are not built; Jaipur, Kolkata, Chennai, Bengaluru, Hyderabad and the other regions have no district | P2 [build] [owner 1.2] |
| 3.3 | No city worlds are inserted into the India map: a city is only a name on a gate sign and a junction | P2 [build] |
| 3.4 | Buildings are procedural boxes with textures; no interiors | P2 [build] |
| 3.5 | Dhabas, roadside shrines, chai stalls, truck art, market clutter are not built | P3 [build] |
| 3.6 | Signage is English and Hindi on highway signs only; no regional languages, no shop signs in Hindi | P3 [build] |

## 4. Traffic, pedestrians, vehicles (N12, N13)
| # | Limit | Tag |
|---|---|---|
| 4.1 | City buses (red, cream band) and cows (slow, cars queue behind them) are in the traffic mixes; two-wheelers and auto-rickshaws are procedural boxes; still no hand-carts, tempos, e-rickshaws, bus liveries by city, or real models | P2 [build] [owner 1.5] |
| 4.2 | Horns, indicators, two-wheelers weaving between lanes, wrong-way riders and lane-less behaviour are not built; lane discipline (keep left, overtake on the right, slow kinds left) and class speed caps are (see docs/TRAFFIC.md); overtaking on single-lane-each-way roads and roundabout / uncontrolled-junction priority are not built (the priority rule was not verified from primary text) | P3 [build] [B] |
| 4.3 | Pedestrians are box figures: no real models, no reactions to the car or the player, not solid to the car | P2 [build] [B] [owner 1.5] |
| 4.4 | Pedestrians and the navigation graph exist on the main road only (not on side roads or at junctions) | P1 [build] [B] |
| 4.5 | A car that has left the 700 m window of a side road is gone; cars respawn when you return, they do not continue | P3 [build] [B] |
| 4.6 | Cars wait for a player standing in the crossing, keep left and overtake on the right; they still do not give way to each other inside a crossing, have no turn lanes or indicators, and a turned car appears mid-road with a short blend | P2 [build] [B] |
| 4.7 | Passing a toll plaza on the player's road shows a toast (85 rupees car, 270 truck, two-wheelers free; FASTag); there is no money system, no queue and traffic only slows | P3 [build] [B] |
| 4.8 | Traffic budgets are tuned by count (about 25 cars at High across a junction), not measured on a phone | P1 [person] |

## 5. On foot and activities (N14, N15)
| # | Limit | Tag |
|---|---|---|
| 5.1 | On-foot: no interiors, only the player's own vehicle can be entered, the player is a box figure with swinging legs, the camera does not avoid walls | P2 [build] [B] |
| 5.2 | On-foot on touch screens: only the G button and drag-to-look; walking uses the driving pads | P2 [build] [B] |
| 5.3 | Pointer lock (mouse capture) was not tested in a real browser session | P2 [person] |
| 5.4 | Activities: the two shipped drives plus, in `?india=` mode, "Drive to <next city>" for the next two cities of the route (par = guide distance at 30 m/s); a results card shows time, rating and best. Still no other kinds, no leaderboard, no map or route line, par times are guesses | P2 [build] |
| 5.5 | Save: no cloud save, no versioned migration beyond version 2 yet (the machinery exists) | P3 [build] |

## 6. Landscape, plants, water
| # | Limit | Tag |
|---|---|---|
| 6.1 | The scanned art is one broadleaf tree, six conifers, one shrub, one fern and one grass tuft; the other species are built in code with flat leaf textures and look like painted blobs up close | P2 [build] [owner 1.5] |
| 6.2 | No palms (Kerala), no mango, neem, banyan, bamboo or teak art | P2 [owner 1.5] |
| 6.3 | The field patchwork colour is stronger on real farmland in `?india=` mode; elsewhere it is subtle and was judged on the default location only | P3 [build] |
| 6.4 | Water: four moving ripple layers, shore foam and shallow-to-deep colour exist; no reflections of the surroundings, no waves with height, no flow along rivers | P2 [build] |
| 6.5 | Every new variant adds draw calls (two per variant per tile); the low preset keeps fewer but nothing is measured on a phone | P1 [person] |
| 6.6 | Rajasthan and Ladakh dryness is one number (`arid`); no real desert dunes, no snow line control per region beyond the old numbers | P3 [build] |
| 6.7 | Kerala, Himachal, Ladakh and Deccan were looked at once; they may need colour, plant and road tuning | P3 [person] |

## 7. Roads, highways, rail
| # | Limit | Tag |
|---|---|---|
| 7.1 | Junctions have no ramps, flyovers or cloverleaves; a round asphalt patch now covers the lane paint at the crossing (colour looked bluish under the sky light and was retuned, not re-checked) | P2 [build] |
| 7.2 | Branch roads' bridges are now in the collision list (`world.near`); their tunnels and retaining walls are drawn but still not in it | P2 [build] |
| 7.3 | Service roads behind a barrier, concrete median barriers, elevated sections are not built | P2 [build] |
| 7.4 | The `ghat` hill road has tighter bends in Himachal (39 m minimum radius) but not the stacked hairpins seen in the tea-garden photos | P2 [build] |
| 7.5 | Centre-line colour on Indian roads is unconfirmed (sources disagree); lane and shoulder widths follow common practice, not the IRC tables, which were not found | P3 [person] |
| 7.6 | Sign gantries are not lit at night; Hindi text uses system fonts that may be missing on a device | P2 [person] |
| 7.7 | Railways: the real network (Natural Earth) with its own ground (cuttings, embankments, stone viaducts, smooth gentle grades: `rail_grade.js`), ballast with boulders and concrete sleepers, 25 kV overhead wire, stations with platforms and name boards, rail bridges over roads, level crossings, and seven kinds of train (ICF express, Rajdhani, Vande Bharat, freight, Western and Central Railway locals) that accelerate, cruise, brake and wait at the ends of their section. Real names and numbers from the timetable: station departure boards, announcements (English and Hindi) at the scheduled arrival, train sound with Doppler. Control office (23 Nov 2026, `docs/RAIL_CONTROL.md`, research `docs/RAIL_OPERATIONS.md`): every train of the network is simulated with blocks, signals, loops, precedence, holds, platforms, gates and Kavach-style braking; trains near the player obey it. Limits of that layer: block and loop sizes are game values (map 1:100), loops are not drawn, a few trains per day are lost to deadlock breaking, punctuality is poor under the compressed network, no rake links; the railway clock now runs 1 minute per 8 seconds. Older limits: the physical-train items below are replaced by this (`?control=off` keeps the old ones); the timetable's printed running times are not kept; the timetable is about 2016; Mumbai local frequencies are approximate; no points (switches), signals, boarding or fast travel by rail; cuttings are carved into the land only near the track and tunnels are not built; viaducts have simple piers, not detailed arches; the voice depends on the device; no real recordings; barrier arms exist but road traffic does not stop at them | P2 [build] |
| 7.10 | Recorded railway sounds (10 clips from audio.com) play locally but their licence is unverified, so they are not in the repository and must not be deployed until the owner has reviewed them (OPEN_DATA.md); the real announcement voice clip is not used because it names one train | P1 [owner] |
| 7.11 | The synthesised station voice (SpeechSynthesis) speaks the state language and Hindi only (English off, owner: it sounds bad); `?tts=en` adds English, `?tts=off` silences all; was fully off for a day by mistake of scope. (old text: `?tts=on` turns it back on. Without real clips supplied by the owner (7.12) stations are silent except for the recorded ambience and the board. Regional-language arrival announcements (Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Punjabi, Odia, Assamese) are unreviewed translations; only the arrival wording exists in them; the device needs a voice for the language, otherwise it falls back to a default voice and may read it badly | P2 [person] |
| 7.12 | Real announcement clips (YouTube playlist): the plumbing is built and waits for the owner's files (assets/audio/announce/ with manifest.json); a clip that names a train is played only for that train, other clips only if marked generic; legal review pending, not to be deployed | P1 [owner] |
| 7.13 | Railway lines now have 1 to 4 parallel tracks by how many real trains use the section (30 or more: double, 100: three, 150: four; 99 double, 19 triple, 5 four-track sections), trains keep left (outbound on the left track, back on the right), wider cuttings, portal masts with cross girders and a wire over each track. Limits: the count comes from the timetable, not from the real track count; no crossovers, points or sidings drawn (a train jumps between tracks while it waits at the end of its run); stations have two platforms around all tracks, no island platforms or footbridges | P2 [build] |
| 7.14 | Train look (drawn by `world/train_art.js`): LHB red-and-grey and ICF blue coaches with barred sleeper windows and sealed AC windows, yellow destination boards with the real train name, number and Hindi and English routes, coach numbers (S4, B2, A1), Hindi class lettering, WAP-7 style locos with a sloping cab, headcode display and number, goods trains of BOXN, tank and container wagons with a brake van, Mumbai locals with yellow noses, Vande Bharat. Limits: boxes with painted textures, not modelled; no interiors, no passengers at windows, no weathering or dirt, no real fonts for the boards, loco shape is simplified (no detailed bogies or cab interiors), rooftop AC units are boxes; Blender models were not made: the per-train text needs run-time textures, and a Blender pipeline needs the loader and a licence check of any reference | P2 [build] |
| 7.15 | Locomotive liveries and services (owner's reference sheet, 22 Nov 2026): colour does NOT show the kind of service on Indian Railways, so class and livery are drawn from the train's seed: blue (common multi-purpose), red (older electric), green (newer eco-themed), brown (typical of diesel freight), yellow (maintenance and inspection: track machines with wagons, slow, rare). Classes WAP-7, WAP-5, WAP-4, WAG-9, WAG-12 (electric), WDG-4 and WDP-4 (diesel, no pantograph) are labelled on the loco. About 11 percent of the network (quiet branch sections, a guess, not the real electrification map) has no overhead wire and diesel locos; any section used by a Vande Bharat, Rajdhani, Shatabdi or Duronto is always electrified. A second sheet that gives colours a meaning (red passenger, blue superfast and so on) contradicts the first and is not used | P2 [person] |
| 7.16 | Vande Bharat: 13 services and their returns (26 trains), hand-written from public route lists (facts only; numbers and times approximate, intermediate times interpolated by distance): New Delhi to Varanasi, to Katra; Mumbai Central to Gandhinagar; Chennai to Mysuru; Howrah to New Jalpaiguri; Visakhapatnam to Secunderabad; Bhopal to Delhi; Mumbai CSMT to Solapur, Shirdi, Madgaon; Ajmer to Delhi; Secunderabad to Tirupati; Mangaluru to Thiruvananthapuram. Only those routes carry a Vande Bharat (8 or 16 cars, white with the blue band, sloping nose); only the cities of the game appear as stops. Not built: the real 2024 and later routes beyond these, sleeper Vande Bharat, Vande Metro | P2 [person] |
| 7.17 | Signals, gates and switching (22 Nov 2026, after the owner's review): colour-light signals (home 150 m before a station or junction, distant 650 m, block signals about 900 m apart, a gate signal 260 m before a level crossing; on the left of the line they govern; red, yellow, green by which blocks hold a train) are drawn with lit lamps; level crossings have boom barriers that lie ACROSS the road (3.3 m from the outer rail, one per approach, traffic keeps left), a cross-board, flashing lamps and a gateman's hut, and road traffic stops at a closed gate; expressway-class roads (the Golden Quadrilateral and the north-south and east-west corridors) are never crossed on the level, even next to a station; viaduct piers are never placed within 22 m of a road; stations have a passing loop with turnouts (switch blade, lever stand, points indicator) and multi-track lines have crossovers. Limits: trains do NOT obey the signals (their motion is closed-form), the lamp order, distances and aspect set are not from the rules (only the principles were checked), no track circuits, no interlocking, no signal posts at the platform ends, no points inside the track chunks away from stations, no junction track layouts (edges simply meet), the gate hut and boom positions use the road as built so a crossing without a built road gets no gate | P1 [build] |
| 7.9 | Road interchanges (flyovers, ramps, cloverleafs) cannot be built yet: the car's physics reads one ground height per point (`world.height(x, z)`), so two roads cannot cross at different heights. Needs a multi-level layer (height by layer chosen from the car's own height) in the physics and the road set. Rail over road works because the rail is not driven | P1 [build] [B] |
| 7.9 | Road interchanges, part built: a road that crosses another highway outside a city is raised on a deck over it (`world/interchange.js`, `Road.addLift`, layers in `RoadSet`), and the car drives over and under without snapping. Still open: slip roads and loops joining the two levels (cloverleaf, trumpet), so today you cannot change roads at an overpass; the crossings found are only those between a road and the roads loaded with it (the skeleton has few mid-route crossings; Agra has two); the lower road's own mesh is not widened for a ramp | P2 [build] [B] |
| 7.8 | The road is one generated path per highway; real elevation and real curves between waypoints are not used | P2 [build] |

## 8. India map and data
| # | Limit | Tag |
|---|---|---|
| 8.1 | Highway numbers and the intermediate cities are from secondary sources that disagree; they are labelled approximate and must be checked against NHAI and Railways tables before being shown as fact | P1 [person] |
| 8.2 | The skeleton roads are simplified driving routes (a waypoint every 20 to 60 real km) from the OSRM demo server over OpenStreetMap data, not surveyed alignments; they are the fastest route through each city list and can differ from the numbered highway | P2 [build] |
| 8.3 | Data gaps: Jaipur to Kota and Agra to Lucknow added (30 roads); other real links are still missing, only the corridors entered exist | P3 [build] |
| 8.4 | The main game (`?india=world`, the default) is one continuous India world: you start at a city, every highway through each city on your way is built as you near it and released behind you, junctions are made on any road, no reload. Limits: only the roads within about 2.4 km of a city are drawn crossing, far-arm (the other direction) gate and toll furniture on branch roads is not built, never measured on a phone, no free roaming off the roads over fields beyond the terrain macro | P1 [build] [person] |
| 8.5 | The OpenStreetMap credit now also appears under Credits in the pause menu (all asset credits summarised); the full licence list stays `assets/ASSETS.md` | P3 [done in part] |
| 8.6 | Real elevation and land cover are in (`?india=` mode, `assets/india/terrain.bin`, 5 km cells): relief scaled to 0.08 vertically, forest, farmland, bare and built-up from the land cover. Limits: 5 km cells are coarse (no river valleys, small lakes or coast detail); the vertical scale is a taste choice (a real 6,000 m peak is 480 game m); the land cover is Esri / Impact Observatory (CC BY 4.0), not ESA WorldCover, and its year is unconfirmed; real water bodies other than the sea are not modelled; only `?india=` drives use it, the nine regions still use recipes | P2 [build] [person] |
| 8.7 | The coastline on the map page is a sketch, not a boundary | P3 [owner 1.4] |
| 8.8 | Festivals, seasons by region, monsoon waterlogging, heat haze and winter fog are not built | P3 [build] |
| 8.9 | `licenses.html` (linked from the title screen and the Credits screen) credits every data set, library and asset as applicable; the owner has not reviewed it yet, and several licence statements (Esri land cover terms and year, Tilezen attribution wording, SRTM, GMTED and ETOPO terms) come from search results, not a legal review | P1 [owner] |

## 9. Drive modes
| # | Limit | Tag |
|---|---|---|
| 9.1 | Modes are tuned by script only; nobody has felt them on a phone or with a gamepad | P1 [person] |
| 9.2 | No per-mode engine sound, no raised ride height or suspension change for Off-road, no Comfort mode, no Eco efficiency score, no per-mode rumble | P3 [build] [B] |
| 9.3 | The Eco (110 km/h) and Off-road (85 km/h) limits are the same for every vehicle; the truck's own top speed is 111 km/h so Eco barely changes it | P3 [build] [B] |
| 9.4 | Hill descent control holds a crawl by braking; it does not shift gears | P3 [build] [B] |
| 9.5 | Autodrive has two levels (Auto, Cruise) and a style per drive mode, with a look-ahead planner (bends, cars, toll plazas, safe passing in Sport; see DRIVE_MODES.md). It never stops for junction signals in any mode (Eco and Normal should stop on red, Sport may run it); Sport does not pass in the oncoming lane on one-lane roads; no indicators or horn | P2 [build] [B] |
| 9.6 | The autodrive styles are tested by script (six heavy-traffic runs, 0 hits, up to 183 km/h on six lanes) and 280 s on the Delhi road in a browser (0 hits); nobody has felt them; the traffic simulation can still spawn a car about 100 m ahead, which no planner can avoid | P1 [person] |

## 10. Assets and sound
| # | Limit | Tag |
|---|---|---|
| 10.1 | No Indian vehicle models (auto-rickshaw, two-wheelers, local buses, Tata trucks, Ambassador); no rigged pedestrians; no Indian building kit; only procedural stand-ins | P2 [owner 1.5] |
| 10.2 | Ambient sound per region, temple bells, call to prayer, horn variety are not built | P3 [build] [owner 1.3] |
| 10.3 | Cleaner engine recordings and a second sound pass (N1) are still open | P2 [person] |

## Done (move lines here with the date)
- 22 to 23 Nov 2026: railways in full (7.7 to 7.17), multi-level roads (7.9), city Phase 0, autodrive planner, GPS. Next: the Delhi flagship city (`docs/CITY_PLAN.md`, packages D1 to D8).
- 22 Nov 2026: the railway now rises over a road on its own long ramp (profile in `rail_grade.js`, at most 2.4 percent, 7.2 m clearance), instead of an extra lift with short abutments; no steep bump any more. Open: the road does not dip under the track, and the deck is simple.
- 22 Nov 2026: multi-level roads (7.9 first part): lifts, deck layer in the physics, overpass built where two highways cross outside a city, drive over and under. Open: slip roads and cloverleafs.
- 21 Nov 2026: railway realism: own ground with cuttings and viaducts, ballast, overhead wire, train kinds and physics, real train names and timetables, departure boards, announcements, train sound.
- 21 Nov 2026: the full real railway network (7.7), stations, rail bridges and level crossings. Open: road interchanges (7.9).
- 21 Nov 2026: railways, first increment (7.7): track, trains, level crossings.
- 21 Nov 2026: GPS minimap and full India map (key P, tap a city to navigate); Indian km stones with city and real km every 10 km, boards listing crossing roads before cities, furniture on four-lane highways too; field parcels in Indian tones; adaptive resolution governor against lag. Still open: rail and trains (7.7), lag never measured on a real device (0.1).
- 20 Nov 2026: one continuous India world as the main game, with the old locations list as separate Explore cities (2.3, 8.4); autodrive levels (Auto / Cruise) and drive-mode driving styles (9.5).
- 20 Nov 2026: Travel screen (reach any city from any world over the highways); Indian lane discipline and class speed limits in traffic (4.2, 4.6 part).
- 19 Nov 2026: domes, chhatris and jharokha balconies on district buildings (3.2 part); city buses and cows in traffic (4.1 part).
- 19 Nov 2026: districts and a crossing street for Delhi, Agra and Bhopal (3.2 part; the look is still the Mumbai kit).
- 19 Nov 2026: Mumbai crossing streets with district, traffic and signal (3.1 part); India-mode roads allow tighter bends (7.4 part).
- 19 Nov 2026: cars wait for the player in a crossing (4.6 part), toll toast (4.7 part), India drive activities and a results card (5.4 part), Jaipur to Kota and Agra to Lucknow roads (8.3 part), region palette and tint blending along a route (2.4 part).
- 19 Nov 2026: real elevation and land cover downloaded and used in `?india=` mode (8.6); `licenses.html` linked from the title and Credits screens (8.9).
- 19 Nov 2026: credits screen in the pause menu; branch-road bridges in collision; asphalt patch over lane paint at junctions; N8 sector-driven city junctions, region lookup by position and debug stats (see 2.2, 7.1, 7.2, 8.5).
- 18 to 19 Nov 2026: tunnel doorways, mouse look on foot, plant variants, patchwork land, moving water with foam, five Indian worlds, highway furniture, toll slowing, India skeleton and map page, drive modes, guided roads, junction choice panel, multi-road engine step 1, traffic on every road, crossing behaviour (all first increments: see their limits above).

## 10. City plan, Phase 0 leftovers (22 Nov 2026)
| # | Limit | Tag |
|---|---|---|
| 10.1 | The keep-out registry (`world/keepout.js`) is asked by the district, scatter and station buildings only; `landmarks.js`, props and pedestrian/traffic spawn points do not ask yet. | P2 [build] |
| 10.2 | Only Agra, Delhi and Mumbai were measured (overlap counts in `docs/CITY_PACK.md`); Kolkata and the other cities have no district region. Nobody has looked at the result from the air, in rain, or on a phone; the registry's cost per frame on a phone is not measured. | P1 [person] |
| 10.3 | Scatter tiles are re-planted when a claim lands on them (rails register once, plots per piece): measure the hitching on a phone. | P2 [person] |
| 10.4 | The station platforms, canopies and the roof slabs are still plain boxes at fixed size; a station only skips its building when it would stand on a road. Replace with modelled stations in Phase 5. | P3 [build] |
| 10.5 | The provider claim (roads) is answered by point samples for a rectangle (nine points), so a thin road across the middle of a small plot can be missed; plots are at least 8 m wide and roads are at least 7 m, so a 4 m gap is the worst case. | P3 |
| 10.6 | Stations and rail bridges still lift the railway over the road in `rail_view.js` (`BRIDGE_H`); the road should go over the rail (PR 49 note). Not touched here. | P2 [build] |

## 11. Delhi transit (D2 and D3, 23 Nov 2026)
Done: `assets/cities/delhi/transit.json` (11 metro lines, 285 stations, 14 depots, 47 railway stations, 479 bus routes), `tools/build_delhi_transit.mjs` and its fetchers, `tools/validate_transit.mjs` and a self-test check, `docs/DELHI_TRANSIT.md`. Open:
| # | What | Priority |
|---|---|---|
| 11.1 | Decision 1.11 (GTFS terms). Without it buses have no frequency and no operator for 374 of 479 routes. | P1 [owner] |
| 11.2 | Nobody looked at photographs: all the look statements (station colours, signage, train livery, viaduct size, DTC green, cluster orange and blue) are unverified. D6 and D7 start by looking at Commons references. | P1 [person] |
| 11.3 | Five stations where OSM and Wikipedia disagree on elevated or ground (`DELHI_TRANSIT.md` 3.2) and five railway stations whose platform counts differ (4.1): someone who knows Delhi checks them. | P2 [person] |
| 11.4 | Bus routes are stop chains, not roads: snap to the street graph when D1 and D5 land. | P2 [build] |
| 11.5 | Register the metro viaduct and the stations in the keep-out registry (`src/world/keepout.js`) as D6 builds them; the railway session owns `rail_*.js`, nothing was changed there. | P2 [build] |
| 11.6 | (done 24 Nov: the flagship table is on `main`, with the package status line) | |
| 11.7 | The data is a snapshot of Nov 2026 (Wikipedia list with the 2026 openings and renames, OSM as of the fetch); rerun the fetchers and `build_delhi_transit.mjs` to refresh (the public Overpass server is often busy and the fetcher retries). | P3 |
## 11. City pipeline and the Delhi pack, leftovers (D1 and D4)
| # | Limit | Tag |
|---|---|---|
| 11.1 | 97 % of Delhi's 244k footprints have a guessed height (OSM has `height` on 1,068, `building:levels` on 7,342). Real heights need another source (Overture, Open Buildings: licences and sizes unverified, nothing downloaded) or a height model; Old Delhi and many colonies have few mapped buildings. | P2 [decide] |
| 11.2 | Only the NCT of Delhi is built. Gurgaon and Noida-Greater Noida are the same tool with a second entry in `CITIES` (`tools/build_city.mjs`) and their own boundary relation; Faridabad and Ghaziabad were not planned. Budget: 20 MB gzip each. | P2 [build] |
| 11.3 | The Delhi pack is 19.8 of 20 MB gzip. Anything added (rails, metro, identity, more landmarks, building parts) must cut something or move to a second tile level; `docs/CITY_PACK.md` section 5a says what is already cut. A brotli build would be about 15 % smaller. | P2 [decide] |
| 11.4 | Landmark `look` notes and cards are first drafts: the looks were not compared with photographs (no image was looked at), the cards were cross-checked only against Wikidata dates and heights. A person should read them. Three entries are placed at the listed position (not found in OSM): `arun-jaitley-stadium`; the markets (`nomatch`) have a square footprint, not a real outline. | P1 [person] |
| 11.5 | 5,135 footprints that lie mostly on a street and 311 duplicates are dropped; the street widths that decide this are guessed from lanes. Look at a few dense lanes (Old Delhi, urban villages) in D5 for missing houses. | P2 [person] |
| 11.6 | Gates: 25 gates, ids like `nh44-north-14`; merged by ref and 250 m; some are minor (SH18, NH344P). The mapping of each gate to the India world's highway (`india`) and the 1:100 world's gate positions belongs to the enclave work (Phase 2). `rail_gates` is empty. | P2 [build] |
| 11.7 | Blocks are plain faces of the street graph (no street width taken off); the renderer must inset them. Landuse polygons are clipped at tile edges with Sutherland-Hodgman (concave shapes may show an edge along the tile border). | P3 [build] |

## 12. The Delhi enclave renderer, leftovers (D5, 24 Nov 2026; worked down 17 Nov 2026 by the session "Delhi renderer fixes")
Done earlier: `?play&city=delhi[&at=<spawn|landmark|gate id>]` (`src/world/city/`), streets, flyovers with ramps and piers (driveable), blocks, parks, water, extruded footprints, landmark buildings and stations at real footprints, keep-out claims, ambient traffic, picker link.
**Done in this pass (branch `claude/delhi-d5b-fixes-fa289f`):**
- **12.6 City map and GPS**: round mini-map (heading up, streets by class, route, landmark pins, Metro lines from `transit.json`), full city map on P (pan, zoom, landmark and gate search, tap a pin or a street to navigate), A* on the pack graph with a start and end on the street (`world/city/citynav.js`, `ui/citymap.js`), turn banner, re-routing, arrival, autodrive on the route (`PathRoad`); how maps work is in `docs/CITY_PACK.md` section 5b.
- **12.7 Gate transition**: 0.5 s fade before and after the reload, the car's speed carried across, every pack gate mapped to the India road arm that leaves Delhi the same way (`world/city/gates.js`, `worldStart(city, { road, toward })`), the save remembers `enclave` (a plain `?play` starts in the city you left from).
- **12.3 Underpasses**: layer -1 streets are drawn (walls, roof, ramp) and driveable (ground lowered along them for the wheels, a roof deck for cars crossing above, a shader cut in the ground meshes: `world/city/cuts.js`).
- **12.4 Kerbs**: a raised kerb stone beside every sidewalk (none at side-street mouths) and wall circles that stop a car at speed and let it mount at walking pace (`o.kerb` in both vehicle physics).
- **12.2 Performance (meshing, LOD, skyline)**: a tile is meshed in slices of 3 ms a frame, lane marks and kerbs only within 450 m, a far skyline of boxes of the tall and big buildings out to 3.8 km (`world/city/skyline.js`). Measured here (desktop, medium, the browser pane hidden so no real frame rate, CPU of `update` and draw submit only): median 0.9 ms, 95 % under 2.4 ms, 99 % under 6.8 ms per frame while driving; a tile's meshing no longer exceeds one 3 ms slice (worst slice 5 ms) plus 5 to 6 ms to add it to the scene (was 3 to 41 ms in one frame); 299 draw calls, 285k triangles, 171 MB JS heap with 14 tiles and 35 skyline tiles. GPU time and phones are not measured.
- **12.5 (part)** pedestrians on the pavements (`world/city/citypeds.js`, the existing figures), signals at the flagged junctions (14 s phases, cars stop at red), cars already turn at junctions.
- **12.8 (part)** facade kits by use (shop-front ground floors, balcony residential, office glazing, arched government), night windows, wall foot shading, roof tanks, mottled ground colour, guessed heights bent by use and footprint.

Still open (what is left of 12):
| # | What | Priority |
|---|---|---|
| 12.1 | **Deploy (stage script fixed 24 Nov: it now stages the pack, which is git-ignored under `cloudflare/public/assets/cities/`; 2,251 files, 102.5 MB raw; still not deployed because this machine is signed in to Cloudflare as a different account than the project's):** old text: `tools/stage_cloudflare.py` skips `assets/cities/`, but the location picker's Delhi now opens the enclave: stage the pack (19.8 MB gzip, 1,925 files, check the Cloudflare file limits) before any deploy, or revert the picker line in `setLocation`. | P1 [build] |
| 12.2 | Phones and a real frame rate: run `?bench=30&city=delhi` on a desktop with the window visible and on two phones (the browser pane that did this pass was hidden); a worker for the meshing if a phone cannot spare 3 ms a frame. | P1 [person] |
| 12.5 | Left of traffic and people: zebra crossings are painted and used only at nodes flagged crossing or signal (cars stop for people on them; people wait for cars within 22 m but not for the signal phase); no parking, no autos or e-rickshaws, no traffic-pack models. | P2 [build] |
| 12.8 | Left of the look: real shadows from buildings, gabled roofs, per-building facade variety beyond the four kits, far blocks are plain boxes, street trees; ground colour is mottled but not by land use. 97 % of heights are still the pack's guesses (bent, not measured). | P2 [build] |
| 12.9 | Station buildings are plain boxes from OSM footprints (Anand Vihar and Sarai Rohilla are 24 m squares from the list, not real footprints); no platforms or tracks (D6). | P2 [build] |
| 12.10 | Metro and rail inside the enclave are not drawn; register viaducts and stations in the keep-out registry when D6 builds them (11.5). | P2 [build] |
| 12.11 | The India highway you arrive on may not be the gate you leave on; Delhi to the other NCR cities (Gurgaon, Noida) has no pack. | P3 [build] |
| 12.12 | Nobody who knows Delhi has looked at it: street layout, colours and heights need a person's list of what feels wrong (city card). | P1 [person] |

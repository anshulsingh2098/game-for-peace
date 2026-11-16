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

## 2. Engine and phases N7 to N10
| # | Limit | Tag |
|---|---|---|
| 2.1 | N7: the core-contracts note and the HUD and map layer change requests (N7a) are not written | P3 [build] |
| 2.2 | N8: sectors now own the crossing roads, signals and traffic of each city on a route (built when a sector holding a city is within 900 m, removed beyond 1,200 m), carry a region and a blend near borders (`world/regionmap.js`), and show side-road counts in the debug panel. Terrain, plain roads and scenery still stream by tile and road piece, not by sector, and the world is still one guided road at a time. | P1 [build] |
| 2.3 | N9: moving between regions is a full reload behind the loading screen; no seamless transition, no blending at borders | P2 [build] |
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
| 7.7 | Railways exist only as hand-entered data and a dashed line on the map page: no tracks, no level crossings, no trains, nothing rideable | P2 [build] |
| 7.8 | The road is one generated path per highway; real elevation and real curves between waypoints are not used | P2 [build] |

## 8. India map and data
| # | Limit | Tag |
|---|---|---|
| 8.1 | Highway numbers and the intermediate cities are from secondary sources that disagree; they are labelled approximate and must be checked against NHAI and Railways tables before being shown as fact | P1 [person] |
| 8.2 | The skeleton roads are simplified driving routes (a waypoint every 20 to 60 real km) from the OSRM demo server over OpenStreetMap data, not surveyed alignments; they are the fastest route through each city list and can differ from the numbered highway | P2 [build] |
| 8.3 | Data gaps: Jaipur to Kota and Agra to Lucknow added (30 roads); other real links are still missing, only the corridors entered exist | P3 [build] |
| 8.4 | One road per `?india=` drive from the player's start, plus side roads within 2.4 km of a city on the route; no free roaming across the country yet; the junction panel regenerates the world (short loading screen) | P1 [build] |
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

## 10. Assets and sound
| # | Limit | Tag |
|---|---|---|
| 10.1 | No Indian vehicle models (auto-rickshaw, two-wheelers, local buses, Tata trucks, Ambassador); no rigged pedestrians; no Indian building kit; only procedural stand-ins | P2 [owner 1.5] |
| 10.2 | Ambient sound per region, temple bells, call to prayer, horn variety are not built | P3 [build] [owner 1.3] |
| 10.3 | Cleaner engine recordings and a second sound pass (N1) are still open | P2 [person] |

## Done (move lines here with the date)
- 20 Nov 2026: Travel screen (reach any city from any world over the highways); Indian lane discipline and class speed limits in traffic (4.2, 4.6 part).
- 19 Nov 2026: domes, chhatris and jharokha balconies on district buildings (3.2 part); city buses and cows in traffic (4.1 part).
- 19 Nov 2026: districts and a crossing street for Delhi, Agra and Bhopal (3.2 part; the look is still the Mumbai kit).
- 19 Nov 2026: Mumbai crossing streets with district, traffic and signal (3.1 part); India-mode roads allow tighter bends (7.4 part).
- 19 Nov 2026: cars wait for the player in a crossing (4.6 part), toll toast (4.7 part), India drive activities and a results card (5.4 part), Jaipur to Kota and Agra to Lucknow roads (8.3 part), region palette and tint blending along a route (2.4 part).
- 19 Nov 2026: real elevation and land cover downloaded and used in `?india=` mode (8.6); `licenses.html` linked from the title and Credits screens (8.9).
- 19 Nov 2026: credits screen in the pause menu; branch-road bridges in collision; asphalt patch over lane paint at junctions; N8 sector-driven city junctions, region lookup by position and debug stats (see 2.2, 7.1, 7.2, 8.5).
- 18 to 19 Nov 2026: tunnel doorways, mouse look on foot, plant variants, patchwork land, moving water with foam, five Indian worlds, highway furniture, toll slowing, India skeleton and map page, drive modes, guided roads, junction choice panel, multi-road engine step 1, traffic on every road, crossing behaviour (all first increments: see their limits above).

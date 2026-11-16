# India map plan: an India-only game (drafted 18 Nov 2026)

The owner's direction: the whole game is **India only**, with the real shape of the country, its real road network (National Highways, the Golden Quadrilateral and the two corridors) and its real railways (the trunk routes between the big cities), and the feel of an Indian GTA-style game. This is the plan and what was built first. Nothing here is deployed.

## 1. Sources and licence (read before using any data)
- **City positions** are facts (latitude and longitude, to about 0.1 degree), entered by hand in `src/world/india_network.js`. **Corridor lists** (which cities a highway or trunk railway passes) come from public descriptions: [Golden Quadrilateral](https://en.wikipedia.org/wiki/Golden_Quadrilateral), [North-South and East-West Corridor](https://en.wikipedia.org/wiki/North-South_and_East-West_Corridor), [NH 44](https://en.wikipedia.org/wiki/National_Highway_44_(India)), the Indian Railways Golden Quadrilateral and Golden Diagonal (the six trunk routes: four sides and two diagonals, about 9,100 route km, carrying over half of the traffic).
- **The two reference maps the owner supplied are not used as data.** They are Wikimedia maps under share-alike licences, and tracing them would bind us to those terms. We draw our own geometry from facts.
- **Exact road alignments and rail track** would need OpenStreetMap (ODbL attribution and share-alike) or the government's open data. That is still **the owner's decision** (see `docs/REGIONS.md`). Until it is made, the network is a schematic of corridors between cities, not surveyed roads.
- Border and coast: only a rough coastline sketch is drawn (not an authoritative boundary). For any shipped map the owner should pick the official Survey of India outline.
- Not checked against NHAI or Railways tables: highway numbers (NH44, NH48, NH19, NH16, NH27) and the intermediate cities are from secondary sources that disagree in places. They are labelled approximate in the data.

## 2. What the data module holds (built)
`src/world/india_network.js`: about 90 cities with tier (metro, major, city, town), state and tags (port, airport, hill, pilgrimage); the highways (Golden Quadrilateral as four sides, North-South Corridor, East-West Corridor, plus NH-style links) and the six rail trunk routes, each an ordered list of city ids. Helpers: distances (great circle times a road factor), route length, game length at a scale, travel time, a nearest-city lookup, a shortest road path between any two cities. `india_map.html` draws it. The self-test checks the data (every id known, every position in India, every leg a plausible length, the network connected, every region record near its city).

## 3. Scale (the main design decision)
India is about 3,000 km tall. Driving it 1:1 is not a game. Proposed, as the plan's `metresPerGameMetre` already allows:
- **Cities and towns:** 1:1 playable districts (the Mumbai district is the model), built one at a time.
- **Highways between them:** compressed about **1:20 to 1:30**, so Delhi to Mumbai (about 1,400 road km) is about 50 to 70 km of driving, roughly 35 to 45 minutes at highway speed. Landscape along the way changes by state (Rajasthan desert, Deccan plateau, Western Ghats, Gangetic plain).
- **Rail and fast travel:** trunk railways are rideable (trains as vehicles and as fast travel with a short cutscene) so the player never drives 40 minutes to cross a state twice.
- Open question for the owner: one continuous world (hard, streaming-heavy, N8 sectors help) or highway "legs" loaded between region hubs (simpler, the plan's current "full reload" transition, later "seamless").

## 4. What makes it an Indian game (research summary and mapping to phases)
Sources are mostly game-store blurbs, so these are design ideas, not facts about any game. Themes that recur, and where each lands:
| Idea | Phase | Status |
|---|---|---|
| Dense mixed traffic: two-wheelers weaving, autos, buses, trucks, stray cows, hand-carts, tempos | N12 | two-wheelers and autos built (boxes); cows, carts, buses not |
| Horns as language; lane-less behaviour; wrong-way riders | N12 | not built |
| Signage in English and Hindi plus the regional language; "Dhaba", "Petrol Pump", "Toll" | N11 | not built |
| Toll plazas on highways (FASTag lanes), police checkposts, RTO | N15 | not built |
| Dhabas, chai stalls, roadside temples and shrines, truck art, mile markers (km stones) | N11 | stalls built; rest not |
| Monsoon: grip, waterlogged underpasses, mud shoulders; heat haze; winter fog in the north | N2/N12 | rain and fog exist; waterlogging not |
| Festivals: Diwali lights and crackers, Holi colours, Ganesh Chaturthi processions, Durga Puja pandals, Eid and Navratri crowds | N16+ | not built |
| Rail: level crossings with gates, platforms, trains crossing, local trains in Mumbai | N14/N16 | not built |
| Landmarks per region (Gateway, India Gate, Taj Mahal, Hawa Mahal, Charminar, Howrah Bridge, Marine Drive) | N3/N9 | four built |
| Vehicles: Ambassador, Maruti 800 and Alto, Royal Enfield, Activa, Tata trucks, Bolero, Thar, auto, e-rickshaw, cycle-rickshaw | N12 | procedural placeholders only |
| Activities: taxi fares, delivery runs (tiffin dabbawalas in Mumbai), pilgrim routes, highway races, photo spots | N15 | one drive built |
| Audio: city ambience, temple bells and call to prayer at distance, film songs on the radio (licensing!), horn variety | N1 | not built |
The legal point for music: Bollywood songs are copyrighted; the radio must use licensed or original tracks.

## 5. Replacing the non-India worlds
The game still has five old worlds (default hills, Alps, Himalayas, California, southern coast). **India-only means replacing them**, with the terrain recipes kept and new region records: Himachal (Manali and Shimla road), Ladakh (Leh high desert), Rajasthan (Jodhpur and Jaisalmer, desert highway), Kerala (backwaters, palms, Kochi), and a Deccan plateau (Pune to Bengaluru). First step built: see section 6. The old ids stay loadable by URL for old share codes until the owner says otherwise.

## 6. Order of work (proposed)
1. (built) the schematic network, its checks and the 2D map.
2. Five Indian region records re-skinning the old worlds (built if listed in the log).
3. A highway generator: a road between two cities follows the corridor, compressed, through the region terrains in between (needs the scale decision).
4. Toll plazas, km stones, bilingual signs, dhabas along the highways (cheap, high flavour).
5. Rail: tracks beside or across the road, level crossings, a rideable train.
6. Region by region districts (Delhi, then Agra, Jaipur, Kolkata, Chennai, Bengaluru, Hyderabad), each with its own landmarks and traffic mix.
7. Festivals and weather seasons by region.

## 8. How Indian roads look, by kind (owner's photos and research; styles built 18 Nov 2026)
Built as road styles (`src/world/roadstyles.js`, try `?road=nh6` or `?road=ghat`): 
- **`nh6`, National Highway, six lanes:** two carriageways of three 3.5 m lanes, a planted grass median about 4.8 m wide between two raised kerbs, white dashed lane lines, solid white edge lines, a 1.5 m paved shoulder, red-soil verge. Traffic keeps left. This is the look of the Golden Quadrilateral and the Mumbai-Pune expressway in the photos. Lane widths and median follow common Indian practice; the exact IRC:SP:84 tables were not found in the search and should be checked.
- **`ghat`, mountain road:** 6.5 m wide, dashed white centre line, white edge lines, a low stone parapet on the outer edge, red-brown soil on the hill side. The photos (Munnar and Nilgiris tea gardens, Western Ghats) show tight hairpins every few hundred metres; our router keeps a 130 m minimum bend radius, so a hill region needs its own routing numbers (`road.minRadius` about 25 to 40, steeper `maxGrade`) before it looks right. Not done.
- **Marking colours:** white for lane and edge lines; yellow is used for restrictions (no overtaking) and sources disagree on the centre line colour (IRC:35 says white generally, yellow for restrictions); not final.
Not built yet, all visible in the photos: **service roads** beside the highway behind a concrete or W-beam barrier, **green overhead gantry signs** with Hindi and English, **toll plazas**, **elevated interchanges and cloverleaf flyovers** (the night photo and the aerial of a multi-level interchange), **flyovers and underpasses with waterlogging**, a **railway line running beside the highway**, **truck lay-bys**, and per-state differences: Rajasthan and Gujarat (wide, straight, desert-dust verges, camels and tractors), Punjab and Haryana (flat divided highways, mustard fields), Uttar Pradesh and Bihar (dense roadside settlement, narrow state roads, mixed traffic), Maharashtra ghats (concrete expressway through monsoon green hills, tunnels), Kerala (narrow, built-up, palm-lined), Tamil Nadu and Karnataka (tea and coffee hills, hairpins), Himachal and Ladakh (cliff-side single-carriageway, rock fall barriers).

## 7. Decisions needed from the owner
(1) OSM/ODbL yes or no for real alignments; (2) continuous world or hub-and-legs; (3) scale 1:20 or 1:30 for highways; (4) which cities come first after Mumbai; (5) licensed or original music; (6) which official outline to use for the map.

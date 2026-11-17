
## Landmark models: status (package D8, 17 Nov 2026)

Models are built in code (`src/world/city/landmarks/`, no files, no images) from each landmark's own record: the footprint's oriented box (centre, yaw, half extents) and the height come from `landmarks.json`; layouts that the data does not hold (interiors, annexes) are placed along the data's own axes from the known plans and are **approximate**. Each model has two layers (base always, detail within 380 m), collision circles, a name board (English over Hindi) and an info card when you are within 70 m. Look: written from knowledge of the places and the `look` notes; **no photographs were looked at in this session** (no image search was available), so colours and proportions are a first draft for a person who knows the place to judge.

| Landmark | Status | What is drawn | Not done / approximate |
|---|---|---|---|
| India Gate | built | plinth, arch through the depth, cornice, attic with INDIA, bowl; the canopy with the statue 148 m east; two rows of avenue trees west | lawns, ponds and paths are the map's own, not modelled; canals not drawn; canopy position is by memory of the plan |
| Rashtrapati Bhavan | built | red base, cream upper walls, two wings, central block, 12-column portico, grand steps, drum and great dome (55 m), kiosks | forecourt, Jaipur Column and the Mughal Gardens not drawn |
| North Block, South Block | built | long blocks, base and cream storeys, eaves, kiosks, a domed central entrance on the side facing the axis | courtyards not cut in; the facades are a texture of arches, not carved |
| Sansad Bhavan (new) | partly | triangular prism from the footprint, cornice, central drum and dome, emblem stand-in | the emblem is a stack of cylinders; no Gyan Dwar |
| Samvidhan Sadan (old Parliament) | built | ring of 96 columns (the real 144 are more), inner wall, dome | |
| Red Fort | built | walls with merlons and bastions from the OSM outline, Lahori Gate with towers, kiosks, flag and barbican, Chatta Chowk, Naubat Khana, Diwan-i-Aam, Diwan-i-Khas, Rang Mahal, Moti Masjid, lawns | the interior positions are fractions along the line from the west gate (approximate); Delhi Gate, Hayat Bakhsh garden, Salimgarh not drawn |
| Jama Masjid | built | raised platform and stairs, three gateways, cloisters, prayer hall with a great iwan, three striped domes, two minarets (height from data), corner kiosks | the stairs of the east gate are 5 steps (the real flight is 35); the hall's calligraphy not drawn |
| Humayun's Tomb | built | arcaded platform with stairs, octagonal-plan mausoleum with four iwans, eight kiosks, marble drum and dome, finial, the charbagh causeways and channels | the real double dome profile and the lattice work; the entry gates; Bu Halima's garden |
| Qutub Minar and complex | built | five fluted storeys (angular and round flutes), balconies and brackets, cupola (height from data), the Iron Pillar, Alai Darwaza, the arched screen with cloister columns, the stump of Alai Minar | positions of the complex are from memory of the plan; the inscription bands are not drawn |
| Lotus Temple | built | 27 marble petals in three rings, platform, nine pools | petals are straight-edged lofts, not curved shells |
| Akshardham | partly | plinth, pink sandstone hall with colonnades, central dome, eight domes, 20 pinnacles | no carved detail, the elephant plinth is suggested by blocks, the shikhar profile is simplified |
| Connaught Place | built | the inner circle as a ring of white colonnaded blocks from the footprint polygon, central park, the flag | the outer circle is not drawn |
| Purana Qila | partly | walls and bastions, Bara Darwaza, Qila-i-Kuhna mosque, Sher Mandal | other gates; the layout inside is by fractions of the axis |
| Safdarjung's Tomb | built | plinth, body with four iwans, four corner towers with kiosks, marble dome, charbagh channels | |
| Jantar Mantar | partly | Samrat Yantra (the big gnomon), two Jai Prakash bowls (drawn as raised drums with a dark floor), Ram Yantra pair, two blocks | the bowls are not hollow; layout approximate |
| Gurudwara Bangla Sahib | built | marble hall, gilded dome and four kiosks, sarovar with walkway, entrance gate, Nishan Sahib | |
| Agrasen ki Baoli | partly | walls with niches and a dark floor; the shaft is a painted floor, the ground is not carved | the descending stair |
| IGI Airport T3 | partly | glazed block from the footprint, roof tiers, a ring of piers | no piers (gates), no mudra sculptures |
| New Delhi, Old Delhi, Hazrat Nizamuddin stations | partly | fronts: facade blocks, entrance portico, clock tower with dome, turrets, kiosks, parapet | platforms and canopies belong to `transit*.js` (D6); no clocks |
| Lodhi Garden, Bharat Mandapam, Birla Mandir, National Museum, War Memorial, Raj Ghat, Sis Ganj, Fatehpuri, Hauz Khas, Tughlaqabad, other markets and stadiums | not built | still the plain extruded footprints | |

**Not verified:** no phone measured; no night look checked; the name boards and cards were checked in the browser pane only; no photograph comparison; collision was checked as circles present near the India Gate plinth, not by driving into every model; Hindi on the boards depends on the system's Devanagari font.

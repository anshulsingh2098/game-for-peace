# CP landmarks, showrooms and architecture, round two (owner request 22 Nov 2026)

Owner: find the major places in Connaught Place that people know (PVR Plaza and others), name them with something similar and easy to identify, match the architecture, pavements, hallways and pillars more closely, and add the many showrooms, cafes and cinemas. Study photos: the five sent on 22 Nov (P1 rain at the arcade, P2 corner block with an arched gate, P3 pavilion block with roof garden and petrol pump, P4 the cinema by day, P5 the cinema at dusk) plus a sixth, the Raymond shop, which is an `.avif` file this session cannot open. Study only, nothing copied.

## 1. Where the plan stands (asked "what was next as per the phased plan")
`docs/DELHI_MAIN_PLAN.md`: phases 1 to 6 done and open as PRs 104 to 111 (markings, facade, light, wet paving, pavements and palms, Kartavya and Lutyens area rules; then the open items, shadows, hedges, trees, cars, people). Next in that plan:
- **Phase 7, licensed or own assets** (cars, people, trees, hedges, kiosks): needs your yes for each download; own Blender models for the auto, palm, chai kiosk, bench and stool where no free model fits (Blender was not connected in this session).
- **Phase 8, performance and acceptance**: a phone benchmark, a second desktop, you scoring the main region at twelve spots; deploy only on your yes.
- **Phase 9, other parts of Delhi** with the same kits.
- Still open from `docs/OPEN_ITEMS.md`: 25 items (phone test, your scores, Anshul's Claude on the shared sun and dusk presets, k6 roundabout, truck and cycle-rickshaw not seen, dome against your photo, canals on Kartavya Path).
This landmarks work is a new, owner-asked branch of CP work that sits between phases 5 and 7: it feeds the same check loop and the same six spots, and the PVR-like cinema becomes spot 7.

## 2. What the five photos show (element by element)
| Element | Seen | In the game now |
|---|---|---|
| Pavement | P1: wet red-brown granite slabs in large squares, a dark grey ribbed tactile guide strip running diagonally, a stone bench and a red cube seat on the walk | pale cream slabs; no tactile strip; no red-brown granite |
| Arcade | P1: round white columns, plain capital, set 3 m apart, a deep walkway, warm shop light and neon (green, yellow, red) inside | round fluted columns with base and capital, soffit lights |
| Fascia | P1, P2, P3: one long board over the arcade, brand lettering in red, blue, teal, black, white; P3 shows a long red board with white capitals | the brand band, 32 invented boards |
| Upper floors | P1 and P2: more boards ON the upper floors (black and teal panels with white lettering, "bar" signs), roof railings and rooftop gardens with trees (P3) | none: upper floors have windows only |
| Pavilion and corner block | P2 and P3: a central block taller than its wings with an attic pediment, a large arched window with a fan light, paired columns, a round-headed gate through the ground floor, balustrades | drums and cornices, not this pavilion or the gate |
| Cinema | P4 and P5: a tall white block with a blank wall and huge gold letters across the top, three big film posters in lit frames, a yellow lit canopy and fascia at street level, AC units and cables on the roof; at dusk the letters, posters and the long yellow strip glow | not built |
| Petrol pump | P3: a blue and red canopy on white columns at the end of a block | not built |
| Street | P2 and P3: hedges and potted trees at the plinth, cars parked nose-in along the block, scooters, people in front | hedges now leafy; parked cars few |
| Light and colour | P1 overcast and wet, P2 hazy, P3 clear blue sky, P5 dusk violet with floodlit building | sun, dusk, night presets |

## 3. The places (what is known)
Named places within 450 m, from OpenStreetMap (Overpass, 22 Nov 2026), are in `assets/cities/delhi/cp_places.json`: 129 places (11 bars, 19 cafes, 1 cinema, 41 fast food, 57 restaurants; shops and banks were not fetched, the server was overloaded). Their positions are the OSM points; the board goes to the nearest arcade front. 65 carry a similar-but-different game name (the owner's call); the rest are local names kept as plain lettering for the owner to confirm. Examples of the renaming: PVR Rivoli Cinema to PVX Rivolo Cinema, Wenger's to Wenzel's, Keventer's to Keventa's, Saravana Bhavan to Saravan Bhawan, Hard Rock Cafe to Hard Rack Cafe, Starbucks to Starbeans, Cafe Coffee Day to Cafe Coffee Dawn, McDonald's to MacDonnell's. Known from the OSM data and a web search: Rivoli at x 716, z -1901; Wenger's and Keventer's at about x 885, z -2177; Saravana Bhavan at x 704, z -2035; Hard Rock at x 1050, z -1694. Not found in the OSM nodes: PVR Plaza itself (a building outline; one web source puts it in H Block), Regal, Odeon, the Palika Bazaar gate (it is a landmark in `landmarks.json` at x 966, z -1879), Hanuman Mandir, United Coffee House, Rajiv Chowk station entrances. Block letters from the web are only partly reliable and are not used for placement.

## 4. Phased plan (each phase: build, look at the game against the photos, measure, log, small commit; nothing merged)
- **L1 Data (done in this commit):** the place file, the naming rule, this plan. Open: shops, banks and the cinema outlines (a second Overpass query when the server is free), the owner confirming the naming.
- **L2 Boards from data (DONE 22 Nov, see `docs/CP_MATCH_LOG.md`):** replace the random 32 boards with the real place list: the atlas grows to about 130 cells (a 2048 by 1024 canvas), each place's board sits on the nearest arcade front, the cinema and big places get taller boards. Boards on the upper floors as in P1 and P2. Check: spot 2 and 4 read the right names; cost of the bigger atlas.
- **L3 The cinema landmark (PVX Plaza):** a landmark building from P4 and P5: tall white block, huge gold letters, three lit poster frames, a yellow canopy and fascia, roof AC units; the dusk glow. Then the old Rivolo cinema front. Check against P4 and P5 at a new spot 7, day and dusk.
- **L4 The pavilion block:** the attic pediment with the fan-light arch, paired columns, the round-headed gate through the block, balustrade, roof railing and a roof garden of small trees, as in P2 and P3. Applied at the radial mouths first.
- **L5 Pavements and hallways:** red-brown granite slabs with the dark ribbed guide strip under the arcade (an own texture, drawn in code), a wider arcade walk, ceiling coffers, wet gloss at night; stone benches, the red cube seats, tree guards.
- **L6 Petrol pump and street life:** the blue and red canopy station, parked cars nose-in along the blocks, scooters, potted trees; the Palika Bazaar gate, the Central Park flagpole, a Hanuman Mandir front and the Rajiv Chowk entrances, each checked against a photo the owner supplies for those.
- **L7 Night and phone check:** the glow of the cinema, boards and canopy at night; frame cost on a desktop and, when one exists, a phone.
Decisions needed: (a) the naming rule (similar names for chains, real names for local places) and the examples above; (b) photos of the Palika Bazaar gate, Hanuman Mandir and a Rajiv Chowk entrance, or leave those generic; (c) the Raymond shop photo as a `.jpg` or `.png`; (d) whether the old cinemas (Regal, Odeon, Rivoli) all get a front or only the PVR-like one.

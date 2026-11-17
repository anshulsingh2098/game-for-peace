# How Delhi looks, and how the game draws it (package D7, written 17 Nov 2026)

Purpose: the look reference behind `assets/cities/delhi/identity.json` and the street-life code (`src/world/city/identity.js`, `streetart.js`, `streetlife.js`). Nothing here is copied: pages were read as reference, no image is stored, every brand, slogan, film poster and notice in the game is invented (section 7).

**Honest summary.** The web research of this session was a handful of searches (standard mode). Where a source confirmed a point it is linked; where it did not, the point is marked **(not verified)** and is general knowledge or a guess that the owner can correct. Numbers in `identity.json` that are guesses carry `"guess": true`.

## 1. Areas and what they look like

| Area (zone id) | Look | Source / status |
|---|---|---|
| **Old Delhi, Chandni Chowk** (`oldDelhi`) | Narrow lanes with unbroken rows of four-storey shop-houses, Urdu/Hindi/English signboards stacked up the facade, banners and cables forming an overhead net, cycle rickshaws carrying parcels, handcarts, crowds | [Bazaar photo essay](https://pad.ma/HA), [Peregrine Treks](https://peregrinetreks.com/blog/chandni-chowk), [Gulf News](https://gulfnews.com/food/chandni-chowk-where-the-streets-dont-need-a-name-1.1622725649023), [Alamy caption: tangle of utility wires](https://www.alamy.com/a-tangle-of-utility-wires-and-cables-above-the-streets-in-chandni-image150932683.html), [ThePrint on the revamp](https://theprint.in/feature/chandni-chowk-had-a-grand-makeover-dream-3-yrs-on-vendors-vehicles-and-trash-take-over/2335543) (vendors and vehicles are back after the makeover). Sky tangled with wires and tinsel: travel writing, impressionistic |
| **Connaught Place** (`cp`) | White-painted two-storey Georgian blocks with an open colonnade, ground floor shops and restaurants, residences/offices above, a park in the middle; global chains and old cinemas; Palika Bazaar underground and street stalls on Janpath | [Wikipedia: Connaught Place](https://wikipedia.com/wiki/Connaught_Circus), [Make Heritage Fun](https://www.makeheritagefun.com/?p=78619). Modelled on the Royal Crescent in Bath (Wikipedia) |
| **Lutyens' Delhi** (`lutyens`) | Wide tree-lined avenues, one species per avenue, low white and cream bungalows in big plots, roundabouts, little commerce | Trees: [Pradip Krishen, "What's wrong with the trees of Lutyens' Delhi?"](https://vikalpsangam.org/article/pradip-kishen-on-choosing-trees-for-avenues/): eight species dominate (jamun, neem, arjun, imli, sausage tree, baheda, pilkhan, peepal); neem on Shahjahan Road, jamun on Ashoka Road and Rajpath; amaltas on Amrita Shergil Marg ([Hindustan Times via PressReader](https://www.pressreader.com/india/hindustan-times-delhi/20180819/281590946410561)). Gulmohar is a park tree (Lodhi Gardens, Nehru Park), not an avenue tree. White bungalows: **(not verified in this pass)** |
| **Karol Bagh, Lajpat Nagar, Sarojini Nagar, Sadar Bazaar** (`karolbagh`, `lajpat`, `sarojini`, `sadar`) | Dense retail: cloth and ready-made garments, jewellery, electronics and mobile repair, hardware and plumbing (Sadar), street stalls and tarpaulin canopies (Sarojini), footpath vendors | **(not verified: the search returned nothing on these markets.)** Taken from general knowledge: Karol Bagh = garments, jewellery, electronics, Hanuman statue flyover; Lajpat Nagar = salwar-suit cloth, sweets, central market; Sarojini = open stalls of export-surplus clothes; Sadar Bazaar = wholesale hardware, toys, stationery |
| **Urban villages** (`village`) | Four-to-five-storey self-built blocks with balconies, lanes 3 to 5 m wide, small shops on the ground floor, wires and water tanks on roofs | general knowledge **(not verified)** |
| **DDA flats** (`dda`) | Four-storey walk-up blocks of plain cream or grey plaster in rows (Dwarka, Rohini, Vasant Kunj style), parks, few shops (one market per sector) | general knowledge **(not verified)** |
| **Business districts** (`business`) | Glass-and-steel towers (Nehru Place, Aerocity, and the Gurgaon look outside the NCT), wide roads, brand banners | general knowledge; Gurgaon is outside the pack |

## 2. Colours
Sandstone red (Red Fort, Humayun's Tomb: already in landmark walls), whitewash and cream plaster (Lutyens, CP), grey cement and unpainted brick/concrete (urban villages, DDA flats before repaint), strong paint on shop shutters, dust over everything (a warm grey-beige wash), a hazy pale-yellow sky most of the year. The palettes per zone are in `identity.json`.

## 3. Signage conventions
- Shop name boards: a painted or flex board over the shopfront, the name in Hindi (Devanagari) and English, sometimes Urdu in Old Delhi, with the owner's phone numbers and "Since 19xx" lines; boards stack up the facade, the highest being the biggest.
- Hoardings: unipoles (a single steel pole with a large board) at junctions, boards on flyover railings, bus-shelter panels, banners on lamp posts, painted wall adverts, film-style posters, civic notices (generic: "Do not spit", "Keep Delhi clean"). **All text and art is invented**; real brands, film posters and party symbols are never reproduced.
- Street name signs are not drawn yet.

## 4. Street furniture
Bus shelters and DTC stops, kiosks (a 2 m box: tea, paan, cigarettes), chai and paan stalls, fruit and vegetable carts, dustbins, concrete electric poles with wires, transformer boxes, police booths, Metro pillars (D6), flyover pillars with posters, signal heads (the pack has the signal nodes), cloth canopies and tarpaulin in markets, string lights at night in markets.

## 5. Vehicles
- **CNG autos**: green body with a yellow roof (Delhi's livery; [National Geographic](https://www.nationalgeographic.com/science/article/120412-delhi-india-auto-rickshaws), [Republic](https://www.republicworld.com/india/cng-autos-out-evs-in-delhi-to-stop-ice-two-wheeler-registrations-from-2026-what-we-know)); electric autos are coming in other colours (blue and pink reported, sources differ), so the game uses them sparingly.
- **E-rickshaws** (four-seat open vehicles), **cycle rickshaws** (Old Delhi lanes), **black-and-yellow taxis**: the taxi colour was **not verified** in the searches (Delhi's own taxis are mixed: yellow-and-black, white and others).
- **DTC buses**: green for non-AC; the AC buses were red or maroon in older years (sources differ), now electric buses in a green-based livery; fleet about 6,300 (4,538 electric, 1,759 CNG in April 2026 per `DELHI_TRANSIT.md`). **Cluster buses** (DIMTS contract): orange for non-AC, blue for AC (one source; others mention only orange). The game draws both in the same low-floor body. Destination boards (route number plus terminal) were not described by any source: the design copies the general Indian style (route number large on a lit board above the windscreen).
- Two-wheelers (about 40 % of traffic, **guess**), hatchbacks, SUVs, tempos, trucks with truck art (garish painted panels): generic Indian proportions, no brand shapes or logos.
- Stray cows and dogs: sparingly (not drawn in this pass).

## 6. People, plants, weather
- **People**: kurta and salwar, saris, shirts and trousers, school uniforms, vendors in aprons and lungis, porters with red shirts, rickshaw pullers in dull checked shirts, jackets and woollen caps in winter. Mix by area in `identity.json` (guesses).
- **Plants**: neem, peepal, jamun, ashoka (the tall narrow tree), gulmohar and amaltas in bloom, bougainvillea on walls and boundary fences; species per avenue in Lutyens (source in section 1).
- **Weather**: winter smog (the CSE analyses report AQI in the "very poor" to "severe" range for almost all of November in bad years; [CSE](https://www.cseindia.org/content/downloadreports/12957), [Open Magazine on 2026](https://openthemagazine.com/india/haze-after-dussehra-delhis-air-slips-to-poor-as-winter-smog-season-looms)); the monsoon months are clearer ([Prana Air summary](https://www.pranaair.com/blog/delhi-air-quality-index-aqi-air-pollution/), a commercial blog). May heat ("loo", dust winds) and monthly rainfall totals were **not verified**: the `identity.json` temperatures and rain figures are climate-normal guesses and marked.

## 7. What the game draws (this package) and what it does not
Drawn: zone-dependent shop name boards, awnings, stacked boards (market zones), kiosks and carts, wires; unipoles, bus-shelter ad panels, lamp-post banners and wall posters from an invented brand list; street trees by area; a richer set of vehicle shapes (autos, e-rickshaws, cycle rickshaws, taxis, tempos, two-wheelers, DTC and cluster buses with route boards); buses on their real routes; passengers at stops; clothing mix; seasonal haze from the month.
Not drawn: street name signs, stray animals, water tankers, truck-art detail beyond colour panels, scaffolding, Hindi on every board (a fixed set of about 40 invented names), the Gurgaon towers (outside the pack), HD people models.

## 8. Rules for the invented content
Brand names are short invented words ("Shree Ganga Sweets" is a generic type name, not a known chain; "Kapoor"-style surnames are avoided on big boards); logos are plain shapes; slogans are generic; the political and film items are generic types ("Grand Sale", "Blockbuster this Friday" with a generic silhouette) and carry no real names or symbols.

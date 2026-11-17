# Delhi forest, tree cover, parks and gardens: the pack against the official figures (18 Nov 2026)

Tools: `node tools/check_city_green.mjs` (areas by class) and `node tools/check_city_places.mjs` (20 known places: is the point inside a park, forest or scrub polygon, else how far is the nearest one). Pack source: OpenStreetMap (Geofabrik northern-zone extract of 16 Nov 2026, `docs/OPEN_DATA.md`).

## Official figures (India State of Forest Report 2021, from press reports: Business Standard, Lokmat Times, Hindustan Times; the full report is the Forest Survey of India's)
Delhi's area 1,483 km2. Forest cover about 195 km2 (13.2 percent): very dense 6.2, moderately dense 56.6, open 131.7 km2 (forest means more than 1 hectare with more than 10 percent canopy). Tree cover outside forests 147 km2. Total green cover 342 km2 (23.06 percent). The split into reserved and protected forest was not in the sources found; the survey's state annexure has it.

## What the pack holds (the pack box is 1,925 km2, larger than Delhi: it takes in the NCR around it)
| Class | km2 in the pack | Note |
|---|---|---|
| forest | 58.6 | `landuse=forest`, `natural=wood`, `leisure=nature_reserve` |
| scrub | 85.8 | `natural=scrub` and heath (the Ridge and Asola Bhatti are mostly this) |
| park | 46.0 | `leisure=park` and recreation grounds |
| grass | 8.4 | `landuse=grass`, `natural=grassland` (Rajpath and India Gate lawns are this) |
| sports / golf | 7.1 / 3.6 | |
| garden | 1.1 | `leisure=garden` (Mughal Gardens) |
| farmland | 80.2 | the Yamuna floodplain and the NCR edge |
Forest plus scrub, 144 km2, is about 74 percent of the survey's 195 km2 forest cover, over a larger box, so the map under-reports forest (the survey counts canopy from satellites, the map counts what a volunteer drew). The 147 km2 of tree cover outside forests (colony streets, plots, avenues) is not in the map at all; the game now adds trees to residential blocks (`colony` in `streetlife.js`, capped at 260 per tile) and along streets by the area profile.

## Known places (`check_city_places.mjs`)
Inside the right class: Lodhi Garden (park), Sanjay Van (forest), Asola Bhatti (scrub), Garden of Five Senses (forest), Okhla bird sanctuary (forest), Mughal Gardens (garden). Within 3 to 140 m of a polygon (the point was an estimate, so probably there): Nehru Park, Deer Park Hauz Khas, Aravalli Biodiversity Park, Central Ridge (Buddha Jayanti Park), Northern Ridge, National Zoological Park, the Delhi Golf Club, Rajpath and India Gate lawns, Jahanpanah city forest. Further (245 to 320 m): Yamuna Biodiversity Park, Millennium Park, Talkatora Garden, Tughlakabad: either the point was off or the polygon is missing; check on a map. No polygon carries a name in the pack, so named parks cannot be listed.

## Gaps and what would close them
1. The builder (`tools/build_city.mjs`) keeps `leisure`, `landuse` and `natural` tags only: it drops `boundary=protected_area` and `boundary=national_park` (the Ridge reserve forests), `landuse=orchard`, `landuse=cemetery` as green, `leisure=common`, `natural=tree_row`. Rebuilding needs the 225 MB Geofabrik extract (a download that needs the owner's yes) and the builder.
2. Park names are not kept in the pack, so labels and per-park rules (for example the Ridge as dense kikar) cannot use them.
3. Compare in the game against the Forest Survey's own forest map, or the Delhi Forest Department's reserved-forest list, for the Ridge boundaries (Northern, Central, South Central, Southern Ridge, about 7,777 ha by the department's own counts; not verified here).

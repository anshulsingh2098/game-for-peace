# Open data and open-source projects that could improve the game (researched 18 Nov 2026)

Nothing here is downloaded. Every download needs the owner's yes (file, source, size). Licence statements come from search results and the projects' own pages, not from a lawyer: confirm before shipping. "Verified" means a source said it; "unverified" means I could not confirm it.

## Data for the India map
| Data | Use in the game | Licence (as found) | Size / how | Status |
|---|---|---|---|---|
| **OpenStreetMap**, trunk and primary roads (ref NH), railways, place nodes | The real road and rail skeleton: waypoints for every national highway and trunk railway; city and junction positions | **ODbL 1.0**: credit "© OpenStreetMap contributors" on screen; the derived road database must be shared under ODbL (the game code and art are separate). Verified. | A tiny extract via the Overpass API (a few MB for all NH ref roads) or a country file from Geofabrik (about 1 to 2 GB, far more than needed) | Best source for highways; needs the owner's yes and a lawyer's reading of share-alike |
| **Natural Earth** roads (1:10m) | Would be a public-domain coarse road layer | Public domain (verified) | about 9 MB | **Doubtful for India**: the "basic" 10 m roads came from a North American source; whether India's highways are in the global version is unverified. Check the file before relying on it |
| **NASA SRTM** 30 m elevation | Real mountains, plateaus and plains for the coarse national heightmap | Public domain (US government; I could not confirm from these searches: check USGS) | tiles of about 25 MB each; India needs a few hundred, but we only need a coarse resample (about 1 MB) | Good; verify licence text |
| **Copernicus GLO-30 DEM** 30 m | Same, newer and cleaner than SRTM | Free, but attribution required ("Produced using Copernicus WorldDEM-30 © DLR e.V."); whether India's tiles are public is unverified | AWS open data bucket, tiles of about 25 MB | Alternative to SRTM |
| **ESA WorldCover** 10 m land cover (2020, 2021) | Where forests, cropland, grass, bare ground, water and built-up land really are: drives our tree density, field colours, deserts and cities for each region instead of guessing | **CC BY 4.0** (verified), credit ESA | 3x3 degree tiles; AWS bucket esa-worldcover; we need a coarse resample | Very good fit: our landscape complaint (flat green land) is a land-cover problem |
| **Google Open Buildings / Microsoft footprints** (India) | Building footprints and heights guesses for city districts | ODbL (OSM wiki) or CC BY 4.0 for the combined set (a catalog says either); unverified which applies | large (hundreds of MB for India) | Later, for city districts only |
| **Overture Maps** | Roads, buildings, places in one clean download | Mixed: ODbL parts and others; unverified | large | Alternative to OSM extracts |
| **Survey of India / Bhuvan (ISRO)** | Official outline and names | Restrictive terms in general; not researched | - | Avoid until the owner chooses an official outline |

## Open-source tools worth using (code, not data)
| Project | What for | Licence | Note |
|---|---|---|---|
| **OSM2World** (Java) | Turns OSM data into 3D meshes (roads, buildings, bridges) usable in three.js | LGPL-3.0 (verified), free for commercial use; still in development | Good reference or offline converter for city districts; its output of OSM data is still subject to ODbL |
| **tilemaker / osmium / ogr2ogr** | Cut an OSM extract down to what we need, offline | permissive (not verified here) | Build-time tools only, in `tools/` |
| **Valhalla / OSRM** | Realistic routing between cities (for taxi missions and traffic) | permissive (unverified) | Only if the road network grows large |
| **Rapier, three.js** | Already used | MIT / Apache | - |
| **Poly Haven, ambientCG** | CC0 textures, HDRIs, plants; already used | CC0 | More species and ground textures for each state |
| **Kenney, Quaternius, Poly Pizza** (CC0 low-poly assets) | Characters, props, vehicles | CC0 | The owner downloads packs by hand; the search found no CC0 Indian vehicles there |
| **CGTrader free Indian bus, jeep, rickshaw** | Indian vehicles | "Royalty Free" platform licences, not CC0; some paid (an auto-rickshaw about $5) | Read each licence; a paid model needs the owner's approval; distribution rights in a web game are the question |

## What I recommend we use first
1. **OSM trunk roads** (ref NH, plus trunk railways) as the national skeleton. A few MB, the best coverage, and the share-alike duty applies only to our small derived road file, which we can publish under ODbL with credit. Needs the owner's yes.
2. **ESA WorldCover** and **SRTM or Copernicus** resampled coarse, for believable land, forest, farms and desert in every state. CC BY and public-domain or attribution-only terms are easy to meet.
3. Everything else later, per city.

## Pipeline (build time, never at run time)
raw files (kept out of git, in a local `data/` folder) -> `tools/` scripts -> small tiles in `assets/india/` with a source and licence line in `assets/ASSETS.md` -> the game loads tiles by sector. `tools/build_india_skeleton.mjs` is the first script; it already runs without downloads, from the hand-entered city network.

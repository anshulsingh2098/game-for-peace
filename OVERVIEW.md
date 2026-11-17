# Game for Peace: overview

> **Read `docs/STATUS.md` first.** It is the one status ledger; where this file disagrees with it, this file is superseded. Dates written inside this file can be wrong (some are in the future): trust git history. Owner decisions are in `docs/DECISIONS.md`.

A calm, endless driving game that runs in the browser. Built with JavaScript, three.js and WebGL; everything in the world is generated on the player's device from a seed, so there is nothing to download but the page, the scripts and three small vehicle models.

- **Repository:** https://github.com/anshulsingh2098/game-for-peace
- **Live site:** https://game-for-peace.anshul-rawat.workers.dev (Cloudflare). `/` is the new engine (from the N6 switch-over, once deployed); `/classic.html` is the original game; `/next.html` redirects to `/`.
- **Account for everything:** rawatanshul525@gmail.com (git, GitHub, Cloudflare). No other account is to be used.

## Two games in one folder

The project is in the middle of an engine rebuild, so there are two entry pages.

| Page | What it is | Code |
|---|---|---|
| `classic.html` | **The original game (was `index.html`, kept for rollback).** One endless road with land shaped around it; the car is held to a 9 m strip. Menu, garage, paint, settings, weather, day and night, engine sounds, radio. This is what is live. | `index.html`, `game.js`, `audio.js` |
| `index.html` | **The game: the new engine** (`next.html` is now only a redirect to it). An open world generated terrain-first, a road routed through it, scenery, free-roam driving on Rapier physics, weather, time of day, shadows, engine sound, live radio, menus and garage, and eight locations (landscapes and Indian city landmarks). Not yet the main page. | `src/`, `vendor/three/`, `vendor/rapier/` |

The switch-over (N6) has been done in the repo: `index.html` is the new engine and `game.js` serves only `classic.html`.

## How to run it

```
python tools/serve.py
```

Then open `http://localhost:8765/` for the game or `http://localhost:8765/classic.html` for the original. Opening the HTML files directly from disk does not work: browsers block the scripts.

Useful address options for `index.html`: `?seed=word` (which world), `?loc=id` (location: alps, himalayas, california, south, mumbai, delhi, agra), `?q=low|med|high` (quality), `?shadows=on|off`, `?play` (skip the title screen), `?dev` or `?debug` (developer panels and stats), `?phys=old` (the old simple physics).

Checks before committing engine work:

```
node tools/selftest.mjs
```

## The new engine, module by module (`src/`)

| File | Job |
|---|---|
| `main.js` | Entry point: builds the world, runs the frame loop, driving / free-camera / ride modes, screen controls, menus, locations |
| `core/rng.js` | Alea seeded random numbers |
| `core/noise.js` | Seeded simplex noise, layered (fbm) and ridged noise |
| `core/config.js` | `WorldConfig`: the seed and every generation number in one object; quality presets; share codes |
| `world/terrain.js` | Pure functions of the config: natural height, height with the road graded in, ground colour, forest mask, driving surface |
| `world/tiledata.js` | Fills the arrays for one terrain tile, with skirts to hide seams (no three.js, so it is testable) |
| `world/chunks.js` | Tile grid around the player: three detail rings plus a coarse far ring, pooled buffers, per-frame build budget, floating origin |
| `world/router.js` | The road: long-range scouting plus short-range steering, spline centre line, grade limits, nearest-road lookup, grading |
| `world/road.js` | Road surface and lane markings from a road style, in 200 m pieces |
| `world/scatter.js`, `props.js` | Trees, rocks, bushes and grass per tile, as instances; collision circles |
| `world/locations.js` | Location profiles: config overrides plus the starting sky, and the landmarks a place has |
| `world/landmarks.js` | Stylised models of the Gateway of India, Taj Mahal Palace hotel, Marine Drive, India Gate and Taj Mahal; placement beside the road, levelling, collision |
| `world/textures.js` | Textures drawn at start-up (grass, asphalt, foliage, water ripples) |
| `vehicle/rapier-vehicle.js` | The driving physics: a Rapier rigid body with ray-cast wheels, a heightfield ground patch, buffs, surfaces, water, collisions |
| `vehicle/physics.js` | The older bicycle-model physics (fallback with `?phys=old`) and the shared surface table |
| `vehicle/defs.js` | Car, truck and bike: stats and body measurements |
| `vehicle/vehicle.js` | Model loading, wheels (spin, Ackermann steering, suspension travel), cockpit, chase and driver cameras |
| `vehicle/paint.js` | Vehicle recolouring |
| `input/controls.js` | Keyboard, touch pads and gamepad as one input |
| `env/environment.js` | Sky dome, sun, clouds, stars, lights, sun shadows, fog, time of day, weather, rain, snow, lightning, wet roads |
| `env/backdrop.js` | Four hazed ranges of distant mountains behind the far terrain |
| `audio/engine.js` | Synthesised engine, wind, gravel, rain and thunder sounds |
| `audio/radio.js`, `stations.js` | Live internet radio: one stream at a time, and the list of 35 stations (19 from India) |
| `ui/radiowheel.js` | The GTA-style radio wheel (hold Q) |
| `ui/menu.js` | Title screen, garage, location picker, settings and pause menus |
| `debug/flycam.js`, `stats.js` | Free camera and stats panel |
| `input/autodrive.js` | Autodrive: the car follows the road (pure pursuit, speed from bend sharpness) |
| `input/touchui.js` | Slowroads-style touch controls for phones |
| `world/roadstyles.js`, `bridges.js`, `tunnels.js` | Road cross-sections as data; bridges over water; tunnels with the Atal-style gate |
| `world/groundmat.js`, `nature.js` | Photographic ground shader; real-scan trees, plants and rocks |
| `core/tuning.js`, `tuning-docs.js`; `tuner.html` | The settings dashboard and the help text behind its "i" buttons |
| `fx/pipeline.js` | Optional realism pipeline (`?fx=1`) |

Other folders: `vendor/three/` (three.js r187, local copy with the realism addons), `vendor/rapier/` (Rapier 0.19.3, Apache-2.0), `tools/` (dev server, self-test, location check, Cloudflare staging script), `assets/` (vehicle models), `dev/` (Blender scripts that build the models, old patch scripts), `cloudflare/` (deploy folder), `music/` (the old game's radio playlist; song files are not in git).

## Roadmap

| Phase | Content | State |
|---|---|---|
| 0 | Groundwork: local three.js, dev server, self-test, staging script | Done |
| 1 | Terrain engine: noise, config, tiles with levels of detail, floating origin | Done |
| 2 | Road routing and grading, road mesh, scenery, water | Done |
| 3 | Free-roam driving, sky, weather, time, lights, sound, then menus and the switch-over of `index.html` | Done in `/next` (Rapier driving, brake / handbrake / reverse, autodrive, seven camera views, touch controls, shadows, buffs, paint, live radio, menus); the switch-over of `index.html` remains (N6) |
| 4 | Locations: California Coast, Mumbai (Marine Drive, Gateway of India, Taj Mahal Palace hotel), Delhi (India Gate), Agra (Taj Mahal), Himalayas, southern coast, Alps | Done (seven locations plus the default); polish remains |
| 5 | Road styles: multi-lane highway, boulevard, dirt trail, gravel stage; bridges and tunnels | Done (five styles, bridges, tunnels with an Atal-style gate) |
| 6 | Real drivetrain with manual gears, new vehicles (sports car, rally hatchback), tuning, customisation, controller rumble | Models drafted by another session, not integrated |
| 7 | Traffic with selectable modes | Not started |
| 8 | Music interface: public radio streams | Done in `/next` as live radio only (local tracks dropped); the old game still has the earlier version |
| 9 | Weather and time polish, graphics options, world config tool | Not started |

Design choices already made: terrain-first rebuild with free roam; locations come first after the engine; both the Taj Mahal Palace hotel and the Taj Mahal are wanted; the site stays a plain static site with no bundler; the game keeps its own name, look and assets.

## Known limits

- Locations will be stylised impressions with recognisable landmarks, not accurate maps.
- Browsers offer controller rumble only; true steering-wheel force feedback is not available to web games.
- The old game's radio songs were commercial tracks; the files in `music/` are not in git, but `tools/stage_cloudflare.py` copies that folder into the deploy, so the live site may carry them until the music upload is removed.

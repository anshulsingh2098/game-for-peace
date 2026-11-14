# Game for Peace: overview

A calm, endless driving game that runs in the browser. Built with JavaScript, three.js and WebGL; everything in the world is generated on the player's device from a seed, so there is nothing to download but the page, the scripts and three small vehicle models.

- **Repository:** https://github.com/anshulsingh2098/game-for-peace
- **Live site:** https://game-for-peace.anshul-rawat.workers.dev (Cloudflare; currently the original game)
- **Account for everything:** rawatanshul525@gmail.com (git, GitHub, Cloudflare). No other account is to be used.

## Two games in one folder

The project is in the middle of an engine rebuild, so there are two entry pages.

| Page | What it is | Code |
|---|---|---|
| `index.html` | **The current game.** One endless road with land shaped around it; the car is held to a 9 m strip. Menu, garage, paint, settings, weather, day and night, engine sounds, radio. This is what is live. | `index.html`, `game.js`, `audio.js` |
| `next.html` | **The new engine.** An open world generated terrain-first, a road routed through it, scenery, free-roam driving, weather, time of day and engine sound. Still a preview: no menu, garage, paint or radio yet. | `src/`, `vendor/three/` |

When the new engine can do everything the current game does, `index.html` switches to it and `game.js` is retired.

## How to run it

```
python tools/serve.py
```

Then open `http://localhost:8765/` for the current game or `http://localhost:8765/next.html` for the new engine. Opening the HTML files directly from disk does not work: browsers block the scripts.

Useful address options for `next.html`: `?seed=word` (which world), `?q=low|med|high` (quality), `?debug` (stats panel).

Checks before committing engine work:

```
node tools/selftest.mjs
```

## The new engine, module by module (`src/`)

| File | Job |
|---|---|
| `main.js` | Entry point: builds the world, runs the frame loop, driving / free-camera / ride modes, screen controls |
| `core/rng.js` | Alea seeded random numbers |
| `core/noise.js` | Seeded simplex noise, layered (fbm) and ridged noise |
| `core/config.js` | `WorldConfig`: the seed and every generation number in one object; quality presets; share codes |
| `world/terrain.js` | Pure functions of the config: natural height, height with the road graded in, ground colour, forest mask, driving surface |
| `world/tiledata.js` | Fills the arrays for one terrain tile, with skirts to hide seams (no three.js, so it is testable) |
| `world/chunks.js` | Tile grid around the player: three detail rings plus a coarse far ring, pooled buffers, per-frame build budget, floating origin |
| `world/router.js` | The road: long-range scouting plus short-range steering, spline centre line, grade limits, nearest-road lookup, grading |
| `world/road.js` | Road surface and lane markings from a road style, in 200 m pieces |
| `world/scatter.js`, `props.js` | Trees, rocks, bushes and grass per tile, as instances; collision circles |
| `world/textures.js` | Textures drawn at start-up (grass, asphalt, foliage, water ripples) |
| `vehicle/physics.js` | Free-roam physics: grip-limited tyres, surfaces, slopes, water, collisions (no three.js) |
| `vehicle/defs.js` | Car, truck and bike: stats and body measurements |
| `vehicle/vehicle.js` | Model loading, wheels, cockpit, chase and driver cameras |
| `input/controls.js` | Keyboard, touch pads and gamepad as one input |
| `env/environment.js` | Sky dome, sun, clouds, stars, lights, fog, time of day, weather, rain, snow, lightning, wet roads |
| `audio/engine.js` | Synthesised engine, wind, gravel, rain and thunder sounds |
| `debug/flycam.js`, `stats.js` | Free camera and stats panel |

Other folders: `vendor/three/` (three.js 0.160.0, local copy), `tools/` (dev server, self-test, Cloudflare staging script), `assets/` (vehicle models), `dev/` (Blender scripts that build the models, old patch scripts), `cloudflare/` (deploy folder), `music/` (radio playlist; song files are not in git).

## Roadmap

| Phase | Content | State |
|---|---|---|
| 0 | Groundwork: local three.js, dev server, self-test, staging script | Done |
| 1 | Terrain engine: noise, config, tiles with levels of detail, floating origin | Done |
| 2 | Road routing and grading, road mesh, scenery, water | Done |
| 3 | Free-roam driving, sky, weather, time, lights, sound, then menus and the switch-over of `index.html` | Driving, sky, weather, lights and engine sound done; buffs, paint, radio, menus and the switch-over remain |
| 4 | Locations: California Coast, Mumbai (Marine Drive, Gateway of India, Taj Mahal Palace hotel), Delhi (India Gate), Agra (Taj Mahal), Himalayas, southern coast, Alps | Not started |
| 5 | Road styles: multi-lane highway, boulevard, dirt trail, gravel stage; bridges and tunnels | Not started |
| 6 | Real drivetrain with manual gears, new vehicles (sports car, rally hatchback), tuning, customisation, controller rumble | Models drafted by another session, not integrated |
| 7 | Traffic with selectable modes | Not started |
| 8 | Music interface: local tracks and public radio streams | Drafted by another session, not committed |
| 9 | Weather and time polish, graphics options, world config tool | Not started |

Design choices already made: terrain-first rebuild with free roam; locations come first after the engine; both the Taj Mahal Palace hotel and the Taj Mahal are wanted; the site stays a plain static site with no bundler; the game keeps its own name, look and assets.

## Known limits

- Locations will be stylised impressions with recognisable landmarks, not accurate maps.
- Browsers offer controller rumble only; true steering-wheel force feedback is not available to web games.
- The radio's original songs were commercial tracks and are not in git or on the live site.

# Stream A log (World: Rajul's Claude writes here, Anshul's Claude only reads)

Newest entries first. Format is in `CLAUDE.md`.

## 2026-11-14  Phase 1 done: road styles, textures, bend fix, city roads
Branch: world/road-styles  Commit: 46c2d60
What changed:
- New `src/world/roadstyles.js`: five road styles as data (two-lane, highway, boulevard, dirt, gravel). `road.js`, `router.js`, `terrain.js`, `scatter.js` read widths from it.
- Real CC0 textures in `assets/roads/` (ambientCG, licence in that folder). Weather (rain, snow) reaches all road materials through a stand-in in `road.js`, so `src/env/environment.js` is unchanged.
- Shared files touched, all small: `src/main.js` (new `?road=highway|boulevard|dirt|gravel` option; RoadMesh gets `road.style`), `src/core/config.js` (new `road.style`, `minRadius` 75 -> 130), `tools/selftest.mjs` (one new check; 20 pass).
- Mumbai, Delhi, Agra use the boulevard, California the highway (`src/world/locations.js`).
For the other stream: before your own merge, bring this in:
```bash
git fetch && git merge origin/world/road-styles
node tools/selftest.mjs
```
The road lookup in `router.js` (`nearest`, `at`, `hit.d`) is unchanged; `road.style` now also exists (widths, `outer`, `surfaces`) if traffic needs lane positions. No `SURFACES` keys were added: dirt and gravel use the existing `gravel`.
Status: open

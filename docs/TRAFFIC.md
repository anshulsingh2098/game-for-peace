# Indian traffic (N12): what is built and what is not

Code: `src/traffic/sim.js` (simulation, pure), `src/traffic/traffic.js` (drawing), region data `traffic.mix` and `traffic.scale` (`regions.js`). Tests: two checks added in `tools/selftest.mjs` (55 in all) on top of the earlier traffic tests (lanes, sides, spawn gaps, determinism, collision, autodrive).

## Built
- **Vehicle mix from region data.** `trafficKinds(pack, mix)`: the thirteen pack vehicles keep their relative weights and together stand for the mix's car, van, truck and bus share; `two-wheeler` and `auto-rickshaw` are added in proportion to the mix (Mumbai: 20 and 14 of 100). A place that is not a region has no mix and keeps the pack as it is.
- **Two new vehicle types**, drawn from original boxes until there are real models (`boxGeometry` in `traffic.js`): a motorbike with its rider and a three-wheeler auto-rickshaw (yellow body, black hood). Two-wheelers ride at the edge of their lane (their lateral offset is a fixed 0.2 to 1.1 m from the lane centre), are smaller obstacle circles, and otherwise follow the same lane rules (gap keeping, stopping for the player, stuck removal).
- **Traffic signals.** At the navigation graph's signalled crossings (boulevards and highways) vehicles obey a 40 s cycle (green 24 s, amber 3 s, red 13 s, offset per crossing): on red, or on amber when they cannot stop, they brake at 3 m/s² to stop 1.5 m before the stop line; they do not enter on red unless already too close to stop (tested: a few percent). Pedestrians (N13) cross on red.
- Density is region data (`traffic.scale` multiplies Off, Low, Mid and High), spawning is deterministic, the active cap is the mode's, recovery of stuck cars exists (12 s).

## Not built (N12 asks for these)
- **Intersections and turns.** There are no junctions in the generated world yet, so traffic only follows lanes; routing over the navigation graph, turning and yielding wait for N11's junction and local street. The sim still drives by the road lookup, not by `NavGraph.route` (it would give the same result on a single road).
- **Overtaking and weaving** by two-wheelers beyond their lane-edge position, horns, indicators.
- Real models for two-wheelers and rickshaws, and engine and horn sounds for them (the asset job, `docs/ASSET_PLAN.md` to be written).
- A phone measurement of the extra draw calls (two more instanced meshes at most).

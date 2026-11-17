# Pedestrians (N13): what is built and what is not

Code: `src/pedestrians/sim.js` (pure simulation), `src/pedestrians/pedestrians.js` (drawing), wired in `main.js` for regions that have both a `district` and a `population` density above zero (Mumbai today). Tests: two checks in `tools/selftest.mjs` (57 in all).

## Built
- **Sidewalk-only spawn** on loaded sidewalk nodes of the navigation graph, 35 to 120 m from the player, never within 3 m of someone, at a bounded rate (one try per 0.4 s). Walkers are a bounded pool of 48; the cap is the region's population density times the level (Off, Low, Mid, High follow the traffic setting: 0, 0.4, 0.7, 1.0 of 24). They are removed beyond 170 m and when their chunk unloads (tested).
- **Movement only on `walk` edges and, at crossing nodes, `cross` edges.** Tested over 400 simulated seconds: never on the carriageway except on a crossing.
- **Crossing behaviour.** About half of commuters and tourists decide to cross at a crossing (few vendors). They wait at the kerb until safe: on a signalled crossing only while the vehicle signal is red, one second in, with enough red left to get across (nobody started on a non-red signal in the test); on an unsignalled one while no vehicle within 40 m is moving and the player's vehicle is not near. A person on a crossing marks it `occupied`; the traffic sim stops vehicles at the stop line for it (tested: cars do not drive through an occupied crossing). A person mid-crossing freezes if the player's vehicle comes fast and close.
- **Archetypes** from region data (`commuter`, `vendor`, `tourist`): different speeds, vendors and tourists stop and idle; walkers keep a gap behind the one ahead on a sidewalk.
- **Drawing:** four instanced meshes (torso, head, two swinging legs) tinted per person from clothes and skin palettes, shown within 150 m; about four draw calls.

## Not built (N13 asks for these, or needs assets)
- **Real people.** The figures are boxes: no rigged models or walk cycles (asset job). No varied heights, clothes or accessories.
- **Reactions** to events and to the player (a hit, a horn), and any collision with the player's vehicle: walkers are not solid to the car (they only avoid being on a crossing when it comes fast).
- **Near, mid and far simulation tiers**: all walkers update every frame (at most 24, cheap).
- **Entering buildings, sitting, queueing, destinations,** and walkers where there is no district (Bhopal has population data but no sidewalks yet).
- Not measured on a phone.

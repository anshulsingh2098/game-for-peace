# Stream B log (Vehicle & Game: Anshul's Claude writes here, Rajul's Claude only reads)

Newest entries first. Format is in `CLAUDE.md`.

## 2026-11-16 00:30  Master Plan N2: weather and lighting made to read (weather matrix, fixes)
Branch: feat/plan-n0-n1 (stacked on PR 22)
What changed: `src/env/environment.js`: bad weather now lowers the reflected sky light (`scene.environmentIntensity = 1 - 0.55 * dark`) and the sky hemisphere light, darkens wet ground to 66%, and has denser fog (overcast .75, rain .42, storm .28, snow .32); `src/fx/grade.js` + `src/main.js`: the colour grade fades colour and brightness with the weather (rain: saturate 0.77, brightness 0.91). Before this, rain and storm at midday looked almost like clear weather. Captured the matrix on a desktop (California): `VISUAL_MATRIX.md` says what was and was not looked at. White paint: 1.1% of bright pixels clipped, not a blown blob.
For the other stream (Anshul): judge the weather and the night on your own screen and a phone; dawn, overcast/fog/storm at dusk and night, other locations and low/high tiers are not captured yet.
Status: open

## 2026-11-15 23:50  Master Plan N0 and N1 done by Rajul's Claude on Rajul's instruction (both streams); Anshul please review
Branch: feat/plan-n0-n1
What changed: (1) Telemetry contract `phys.telemetry()` and `VEHICLE_CONTRACT.md` (one meaning for speed, gear, revs, slip, with units); the sound reads gear and revs from it. (2) The truck and bike now have real powertrain data in `defs.js` (truck: 300 kW diesel, 8 gears, 0.5 s shifts; bike: 75 kW, 6 gears, quick shifts, own lean model via `tyres: false`) and use `powertrain()`; the truck also uses the tyre model. (3) Gearbox hunting fixed: it never upshifts into a gear it would shift straight out of; downshift points are data (`down`, `downEasy`); per-vehicle `brakeMul`, `downforce`. (4) New `tools/vehicle_acceptance.mjs` (in `daily_check.py`): car 0-100 in 3.3 s, top 269, 130 to 0 in 55 m; truck 0-100 in 32 s, top 111, 88 to 0 in 45 m, climbs a 10% hill at 44 km/h; bike 0-100 in 4.2 s, top 200; all repeatable to the last digit. (5) Tunnel signal from the road (`road.tunnelW` at the camera's nearest road point): no rain, snow or thunder inside, roomier reverb; checked in the Himalayas (hidden inside, visible before and after). (6) Vendored Rapier init patched to the object form its own warning asks for (the deprecation message is gone). (7) `CHECKLIST.md` has lines for the rails, car, handling, look, camera and tuner.
For the other stream (Anshul): read `VEHICLE_CONTRACT.md`, drive all three vehicles and listen to the sound (nothing here has been judged by a person); the engine sound for truck and bike still uses the synthesised voice, now fed real revs and gear.
Status: open

## 2026-11-15 18:00  Drivetrain telemetry in the sound, camera juice, handling feel knobs (done by Rajul's Claude on Rajul's request; Stream B files)
Branch: feat/nfs-handling (PR 20)
What changed: (1) `src/vehicle/rapier-vehicle.js`: `phys.gear` and `phys.rpm` now stay valid off the throttle too (gearbox changes down while coasting, revs idle at a standstill and rise with throttle in first gear). (2) `src/main.js` passes `rpm01` (0..1 between idle and redline) and `gear` to `sound.update`; `src/audio/engine.js` uses them for pitch, the seven-loop crossfade and the shift dip when they are given, and falls back to the old speed-based guess for the truck and bike (they have no `p.pt`). (3) Chase camera (`src/vehicle/vehicle.js`, constants in new pure module `src/vehicle/camfx.js`, tuner root "camera"): springy FOV kick on boost and hard acceleration (about +7 degrees, 0.5 s, small overshoot), faint speed shake (zero below 28 m/s, about 1.7 cm and 0.2 degrees of roll at 70 m/s, doubled with boost), and slower camera yaw in slides (`driftLag`). (4) Handling: new tuner settings `combined` (traction circle: power costs cornering grip, so hard throttle in a low gear gives power oversteer), `steerLock` (front lock at speed, default 3.5, was fixed at 2.1), `lockGrip` 1 (a locked rear wheel keeps no sideways grip); `tyreAssist` stays 0.3. All have help in `core/tuning-docs.js`; selftest 25 of 25, daily_check 10 passed.
Not verified by hand: the sound (nobody has listened with the real revs), the camera feel, and drift feel. A handbrake flick at 100 km/h only reaches about 0.1 rad body slip (a stable, high-grip car); drifts start at lower speed. Please drive it, then tune with the tuner sliders under "handling" and "camera".
For the other stream (Rajul): nothing to do.
Status: open


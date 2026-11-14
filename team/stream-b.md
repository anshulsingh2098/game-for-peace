# Stream B log (Vehicle & Game: Anshul's Claude writes here, Rajul's Claude only reads)

Newest entries first. Format is in `CLAUDE.md`.

## 2026-11-15 18:00  Drivetrain telemetry in the sound, camera juice, handling feel knobs (done by Rajul's Claude on Rajul's request; Stream B files)
Branch: feat/nfs-handling (PR 20)
What changed: (1) `src/vehicle/rapier-vehicle.js`: `phys.gear` and `phys.rpm` now stay valid off the throttle too (gearbox changes down while coasting, revs idle at a standstill and rise with throttle in first gear). (2) `src/main.js` passes `rpm01` (0..1 between idle and redline) and `gear` to `sound.update`; `src/audio/engine.js` uses them for pitch, the seven-loop crossfade and the shift dip when they are given, and falls back to the old speed-based guess for the truck and bike (they have no `p.pt`). (3) Chase camera (`src/vehicle/vehicle.js`, constants in new pure module `src/vehicle/camfx.js`, tuner root "camera"): springy FOV kick on boost and hard acceleration (about +7 degrees, 0.5 s, small overshoot), faint speed shake (zero below 28 m/s, about 1.7 cm and 0.2 degrees of roll at 70 m/s, doubled with boost), and slower camera yaw in slides (`driftLag`). (4) Handling: new tuner settings `combined` (traction circle: power costs cornering grip, so hard throttle in a low gear gives power oversteer), `steerLock` (front lock at speed, default 3.5, was fixed at 2.1), `lockGrip` 1 (a locked rear wheel keeps no sideways grip); `tyreAssist` stays 0.3. All have help in `core/tuning-docs.js`; selftest 25 of 25, daily_check 10 passed.
Not verified by hand: the sound (nobody has listened with the real revs), the camera feel, and drift feel. A handbrake flick at 100 km/h only reaches about 0.1 rad body slip (a stable, high-grip car); drifts start at lower speed. Please drive it, then tune with the tuner sliders under "handling" and "camera".
For the other stream (Rajul): nothing to do.
Status: open


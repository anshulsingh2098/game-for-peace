# Vehicle contract

What a vehicle reports about itself, and the settings that shape it. Read by the HUD, the engine sound, the tools and the tests. The report is `phys.telemetry()` (both physics classes; `src/vehicle/physics.js` `makeTelemetry`). Fields the physics does not have are `null`. Units are metres, seconds, radians, rpm.

| Field | Meaning | Unit |
|---|---|---|
| `id` | `car`, `truck` or `bike` | |
| `x`, `z`, `yaw` | position (world) and heading (`atan2(forward z, forward x)`) | m, rad |
| `speed` | speed over the ground, never negative | m/s |
| `u` | forward speed, negative when reversing | m/s |
| `v` | sideways speed | m/s |
| `kmh` | `u * 3.6` | km/h |
| `throttle`, `brake`, `hand` | what the driver asked for | 0..1 |
| `steerInput` | steering asked for, right is + | -1..1 |
| `steerAngle` | actual front road-wheel angle | rad |
| `yawRate` | turn rate | rad/s |
| `gear`, `gearCount` | gear index (0 is first) and how many gears; `null` with no gearbox model | |
| `rpm` | engine speed; `null` with no powertrain | rpm |
| `rpm01` | `(rpm - idle) / (redline - idle)` clamped; `null` with no powertrain | 0..1 |
| `slip` | body sideslip angle | rad |
| `wheelSlip` | the largest wheel slip angle; `null` on the old physics | rad |
| `surface` | surface key under the car | |
| `grounded` | share of the wheels touching the ground | 0..1 |
| `buff` | a buff (boost, haul, lean) is active | bool |

**One meaning each:** speed is always metres per second in `speed`/`u`/`v` and km/h only in `kmh`; `rpm` is always engine revolutions per minute and `rpm01` the normalised value the sound uses. Do not invent a second speed or rev value elsewhere.

## Powertrain and handling data (`defs.js` `body.pt`, tuner "vehicles")

Every vehicle has a `pt` block of published-style data: `kw` (peak power), `peak`, `redline`, `idle`, `launch` (rpm), `gears` (ratios), `final`, `eff`, `cdA` (drag area), `upshift`, `down`, `downEasy` (shift points as a share of the rev limit), `shiftTime` (s), `tcs` (traction limit), `brakeMul`, `downforce`, and `tyres: false` for the bike, which keeps its own lean model. `src/vehicle/rapier-vehicle.js` `powertrain()` turns it into force at the wheels. Global handling numbers (grip, slide, drift, steering speed, tyre curve) are in `ARCADE` (tuner group "handling"); the chase camera is in `CAMFX` (group "camera"); the colour grade in `LOOK` (group "look"). `?phys=old` still selects the old bicycle model and `?arcade=0` the plain tyre model, until their removal is approved.

## Numbers a person can compare (`node tools/vehicle_acceptance.mjs`)

Run it after any handling change. It prints, per vehicle, on a flat headless road: time to 50, 100, 160 and 200 km/h, top speed, braking distance, steady-corner lateral g and slip, handbrake slide and recovery, speed after 8 s on asphalt, gravel, grass and snow, parked and climbing on a 10% hill, whether two identical runs agree exactly, and a telemetry sanity check. `--check` (used by `daily_check.py`) exits with an error when a limit is broken. These are measurements, not approval: a person still has to drive each vehicle (`CHECKLIST.md`).

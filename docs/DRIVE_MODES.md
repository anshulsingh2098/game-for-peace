# Drive modes (Eco, Normal, Sport, Off-road)

Press **N** (or the mode button in the top bar) to cycle. The choice is saved and applies to every vehicle. The HUD shows the mode next to the speed, and the tag brightens when the speed limiter is working. Defined in `src/vehicle/physics.js` (`DRIVE_MODES`, `combineMods`), applied by both physics classes (`setDriveMode`), kept apart from the vehicle's buff so both can be active.

| | Eco | Normal | Sport | Off-road |
|---|---|---|---|---|
| Speed limiter | 110 km/h (engine fades out over the last 10%) | none | none | 85 km/h |
| Engine force | x0.8 | x1 | x1.1 | x1.15 (low-range pull) |
| Throttle map (part throttle) | soft (exponent 1.7) | linear | sharp (0.75) | soft (1.3) |
| Gearbox | shifts early (x0.86) | normal | holds gears (x1.03) | early (x0.85) |
| Steering authority at speed | x0.96 | x1 | x1.12 | x1 |
| Traction limit | x0.9 (stricter) | x1 | x1.18 (relaxed) | x1.05 |
| Lifting off (engine braking) | x1.7 (one-pedal feel) | x1 | x1.1 | x1.4 |
| Grip on gravel, grass, snow, sand | x1 | x1 | x1 | x1.3 |
| Rolling resistance | x0.92 | x1 | x1 | x0.85 |
| Hill descent control | no | no | no | holds about 12 km/h on a steep downhill with no pedal pressed |

Measured with `node tools/vehicle_acceptance.mjs` (it checks every mode for every vehicle and fails if a limit or ordering breaks): the car in Eco tops out at 109 km/h, Off-road at 85; 0 to 100 km/h takes 4.4 s in Eco, 3.3 s Normal, 2.8 s Sport; on grass Off-road reaches 60 km/h in 3.5 s against 4.3 s Normal; on a 10% downhill with no pedals the car rolls at 108 km/h in Normal and 13 km/h with hill descent control. The numbers are a first tuning by script, not judged by a person on a real device.

Not built: sound changes per mode (a louder Sport exhaust), raised ride height or suspension changes for Off-road, a separate Comfort mode, a trip-computer efficiency score for Eco, per-mode steering weight on a gamepad (rumble), and mode-specific limits per vehicle (the Eco and Off-road limiters are the same for car, truck and bike; the truck's own top speed is 111 km/h, so Eco barely changes it).

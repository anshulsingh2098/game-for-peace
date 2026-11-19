# Performance report (Master Plan N4)

## How to measure on any device

Open the game with `&bench=30` added to the address, e.g. `http://<address>/?play&loc=california&q=med&bench=30`. After the loading screen and a 4 second pause it drives on autodrive for 30 seconds, then shows a green panel and writes `BENCH {...}` to the console (also kept in `window.__bench`): average, 95% and 99% frame time, worst frame, draw calls, triangles, geometries, textures, downloaded megabytes and the JS heap where the browser reports it. Run it for `q=low`, `q=med` and `q=high` and for two or three locations, on each phone, and paste the panel text into the team log or here. The existing on-screen stats panel (`?stats`, see `HANDOFF.md`) shows the live counters.

## Measured on 15 November 2026 (desktop, Apple silicon, Claude app browser pane, 1280 x 720, California seed `peace`, 8 s autodrive)

The pane's display refresh caps frames at about 180 per second (5.6 ms), so a 5.6 ms result means "at the cap", not "5.6 ms of work".

| Tier | Avg frame | 95% under | 99% under | Worst | Draw calls | Triangles | Geometries | Textures | Downloaded | JS heap |
|---|---|---|---|---|---|---|---|---|---|---|
| low | 5.6 ms (180 fps, capped) | 5.7 | 6.1 | 6.3 | 183 | 140,190 | 180 | 37 | 11.7 MB | 58 MB |
| med | 5.6 ms (180 fps, capped) | 5.7 | 6.2 | 11.1 | 520 | 427,618 | 331 | 49 | 12.3 MB | 49 MB |
| high | 9.1 ms (110 fps) | 11.2 | 11.7 | 16.8 | 878 | 826,238 | 573 | 49 | 12.3 MB | 74 MB |

- The old note "high is about 24 ms on an M4" is out of date: the high tier is now 9.1 ms here (cheaper far rocks and terrain rings, and 1280 x 720 instead of 1400 x 800). It is the one tier clearly under load.
- The car alone is 67,806 triangles and 41 draw calls on every tier (about 16% of the medium tier's triangles and 8% of its draw calls).
- Downloaded size is the first load with the browser cache cold in this pane (12.3 MB with everything the medium and high tiers fetch; the low tier fetches 11.7 MB). It includes the engine loops (about 3 MB), the textures, the car (3.2 MB) and the scenery.

## Not measured yet (needs people and devices)

- Any real phone (the plan's gate: two phones holding a steady 30 fps on low and medium).
- Slow-network start, time to first drive, memory over a long session, and world regeneration leaks.
- GPU time separately from CPU time.

## Decisions taken in this pass

- No change to texture or mesh compression yet (KTX2 and meshopt are only worth it if a phone shows a download or memory problem; measure first).
- Loading screen added (`#loading` in `next.html`): shows what is still loading and fades out at the first drawn frame.

## Crash damage and the new cars, 20 Nov 2026 (desktop, Claude app browser pane, 905 x 664, `q=med`, fly camera so the draw call counts are not comparable with the street view)
The Nissan GT-R LB Works, p50 frame time: fresh 12.5 ms, dented (four 16 m/s hits) 13.4 ms, burning (eight more at 25 m/s) 13.4 ms; draw calls 1,183, 1,195, 1,196. So crash damage costs about 1 ms and 12 draw calls on this machine. **Not measured on a phone.** To measure on an iPhone: open the live address with `&bench=30` on a fresh start and note the average and the 95th percentile; then get out, take one of the new cars (carjack), hit a wall at 50 km/h until it smokes and run `&bench=30` again on that car (use `?damage=cosmetic` to compare dents only, `?damage=off` for none). Record the iPhone model, the iOS version, the tier and both results here.

## Lag after the new cars, and the fix (20 Nov 2026; desktop, Claude app browser pane, `q=med`, Delhi start, the same spot each time)
| | Live build before the fix (`21f0a0c`) | Lite cars, two traffic detail levels, 3 near cars |
|---|---|---|
| Draw calls per frame | 828 | 538 |
| Triangles per frame | 1.63 M | 1.02 M |
| Geometries | 574 | 365 |
| JS heap | 640 MB | 610 MB |
What was heavy: the seven new garage cars (38,000 to 110,000 triangles, 15 to 22 materials each), the traffic versions of them (about 3,000 triangles, 260 parked cars around the player, about 0.6 M triangles in all), and five nearby cars drawn as the full garage model (0.3 M more, plus a stall the first time each model loaded). Walking up to the parked mission car: worst frame 17 ms and none over 50 ms with the fix.
The fix: `tools/make_car_lite_glb.py` rebuilt the seven garage cars as about 20,000 triangles (13,000 body, 4 wheels of 1,500), 7 draw calls and 0.8 to 1 MB each (were 2 to 3 MB), with vertex colours instead of pictures; the traffic pack has a far version of each model (about 700 triangles) used beyond 45 m (`LOD_NEAR` in `citytraffic.js`); the near full-model cars are 3 within 24 m (tuner: `traffic.near.count`, `traffic.near.range`). The frame time itself stayed at about 11 ms in this pane (its refresh), so the measure that moved is the work per frame, not the pane's rate. **Not measured on a phone or a slower laptop.**


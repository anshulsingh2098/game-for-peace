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

## Phone measurements

| Date | Phone | Browser | Build | Tier | Seconds | Average | p95 | p99 | Worst | Draw calls | Triangles | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 22 Nov 2026 | iPhone 14 Pro, iOS 18.7 | Safari 26.1, in a tab (not the home-screen app), landscape | live, main 6f768c6, `?play&city=delhi&q=med&bench=30` | med | 30 | 43.5 fps (23 ms) | 33 ms | 72 ms | 142 ms | 392 | 576,441 (536 geometries, 65 textures) | read from the owner's screenshot of the on-screen block; start at Connaught Place on autodrive, daylight; 0 MB downloaded |

Reading (A-2026-11-22-13): the average is above 30 fps, but the plan's gate is a *steady* 30 fps: p95 33 ms sits on the edge (one frame in twenty is slower than 30 fps) and p99 72 ms and the worst frame 142 ms are visible hitches, most likely tile building and the resolution governor. The triangle count (576 k) is 46 percent above the desktop number at the same spot (394 k, 22 Nov) because the phone and the build differ; the next run should be q=low, then dusk and night. Not yet measured: q=low, dusk, night, a second phone.

# Daily checklist

Before any work each day, in this order. Tick the boxes in your own copy; anything that fails goes into the team log (`team/stream-a.md` or `-b.md`) as an open entry, and work on it before new features.
Rule for Claude: every time a feature is added, or something is found that nobody has verified, add a line here (a script check if a computer can judge it, a manual check if a person must look).

## 1. Automatic (about two minutes)

```bash
python tools/daily_check.py
```

- [ ] Prints 0 failed. Warnings are read and understood (uncommitted files, open log entries, deploy folder out of date).
- [ ] It covers: git is up to date, self-test passes, every location builds a road, deploy folder is current, assets and vendor sizes, every asset has a credit line, open team-log entries.

## 2. Sync with the team

- [ ] `git switch main && git pull`, or run `/sync` in Claude.
- [ ] Read the newest entries in `team/stream-a.md` and `team/stream-b.md`; anything addressed to you and `open` is a task for today.
- [ ] `HANDOFF.md` "What is next" still matches reality; `PARALLEL_PLAN.md` status table is current.

## 3. Look at the game (desktop). Start `python tools/serve.py`, open `http://localhost:8765/?play`

Open the browser console (F12): nothing red except known favicon 404s.

- [ ] **Default world** drives: keys steer, accelerate, brake; menu, garage, settings, pause (Esc) open and close.
- [ ] **Every location** loads from the picker: Green Valley, Alps, Himalayas, California, Southern Coast, Mumbai, Delhi, Agra. Ground, trees and road look right for the place.
- [ ] **Road styles**: add `&road=highway`, `boulevard`, `dirt`, `gravel`: each renders, lines and kerbs present, no gaps or streaks.
- [ ] **Shadows**: trees, the car and rocks cast clean shadows: no black streaks, stripes or flicker on trees or the car (check the Alps at midday).
- [ ] **Ground**: photographic grass, rock on cliffs, snow, sand. No seams at tile edges, no shimmering as you drive. Compare with `&ground=flat`.
- [ ] **Scenery**: real trees, shrubs and rocks, no dark fringes or flicker. Compare with `&nature=flat`.
- [ ] **Bridge**: drive onto one (Alps, seed `alps`, near road distance 340; it is 726 m long and has a steel truss on both sides: top chord, uprights and diagonals, lined up from piece to piece with no gaps; short bridges have rails only): deck, rails, piers; the car rides the deck. **Rails stop the car**: steer into one at speed, the car scrapes or stops and never goes over the edge (try the car, truck and bike). Rails sit just where they are drawn (not a metre away).
- [ ] **Tunnel** (Himalayas, seed `hill`): gate with a readable "ATAL TUNNEL, ROHTANG" board, portal, tiled lit interior, cones, a raised walkway along both walls, speed-limit (60), green EXIT and orange SOS signs on the walls, camera stays inside, no rain inside. Try the truck.
- [ ] **Weather and time**: clear, overcast, fog, rain, storm, snow, each at day, dusk and night: nothing goes black or white, road looks wet in rain, tunnel and bridge look right at night.
- [ ] **Driving controls**: W / Up gas, S / Down reverse (brakes first if still rolling forward, then reverses), **Space foot brake** (stops and holds the car, never reverses), **X handbrake** (the tail slides), **Shift boost**, E autodrive. On a phone: Brake, Hand, Rev and Boost circles. Lifting off the gas slows the car at a natural rate, on grass much faster than on the road (it must not glide). Measured: 100 km/h to a stop in about 3 s on the foot brake; reverse tops out at about 32 km/h for the car.
- [ ] **Engine sound** is the real recording of Rajul's car (seven seamless loops in `assets/audio`, made by `tools/make_engine_loops.mjs`): deep and bold, no thin whine, smooth through the gears, no swirling or clicking at loop points, no sudden jumps when the revs change. `?engine=synth` plays the old synthesised engine for comparison. Nobody has listened to it yet: judge by ear and say what is off. If it still sounds unnatural the next step is a longer recording of steady revs at each speed (see the note in `team/stream-a.md`).
- [ ] **Camera views**: V cycles Chase, Far chase, Close chase, Hood, Bumper, Driver seat, Cinematic (a TV-style cut beside the road) and back; C jumps to the driver's seat and back; the Camera button and the CAM circle on a phone do the same as V. Each view shows the road ahead, nothing clips through the car body, and the choice is remembered.
- [ ] **Car feel** (drive by hand, any vehicle): the nose rises a little when you accelerate and dips when you brake hard; the body leans outward in a fast corner; a faint tremble at speed, stronger on gravel and grass. It should not feel like gliding on rails. (Measured on the car: about 3 degrees squat on launch, about 4 degrees dip under hard braking, about 4.5 degrees of lean at 0.5 g sideways.)
- [ ] **The car** ("Dusk GT", Khronos CarConcept): glossy paint with reflections, dark glass, lit tail lights, plain licence plate; **no Khronos or 3D Commerce logo anywhere** (look at the tyre sidewalls and the plate up close); the four wheels turn and the front ones steer; the garage colour swatches recolour the body; driver's-seat view (V or C) shows a full interior with the steering wheel and dash.
- [ ] **Handling** (car): steering reacts at once (not numb) at 50, 100 and 200 km/h; no spin at full lock at top speed; a handbrake flick at 100 km/h gives a slide you can hold and catch; gears change with a small power dip and the revs drop at each shift; the rev limiter holds at the top.
- [ ] **Look**: richer colour and a soft dark edge (grade and vignette); trees are full and green with **no black rectangles** in sunlight; the car's paint shows a horizon and sky in its reflection.
- [ ] **Camera effects**: the view stretches a little when you boost or launch hard; no camera shake by default.
- [ ] **Autodrive** (press E, or the Auto button): the car follows the road by itself at about 70 km/h, slows for bends, goes through tunnels and over bridges; steering or braking by hand takes over. Try the Himalayas (seed `hill`) and the default world. With traffic on, it drives in its own lane (right, or left in India), follows a slower car at a gap, and never hits a car.
- [ ] **Green Valley** looks like open meadow with tall grass and trees set back from the road, not a forest at the verge.
- [ ] **Quality tiers**: add `&q=low`, `&q=med`, `&q=high`. Low: old cheap ground, fewer tree variants, no shadows; med: lighter photographic ground; high: full ground, bigger shadows and view. Each looks acceptable and none shows broken ground. Phones start on low. (Draw calls and triangles for the Alps at 1400x800: low 176 / 96k, med 523 / 430k, high 898 / 895k. High took about 24 ms on an M4: too slow, still to be tuned.)
- [ ] **Vehicles**: the garage lists Dusk GT (your original sports car with the striped paint), Freight Hauler, Volt Bike and Aero Concept (the new detailed coupe); all four drive; paint colours work; white paint does not glare to a white blob.
- [ ] **Radio and sound**: radio wheel (hold Q) plays a station; engine, wind and rain sounds; no rain, snow or thunder sound or picture inside a tunnel (try the Himalayas, seed `hill`, rain).
- [ ] **Traffic** (Settings > Traffic: Off, Low, Mid, High; Off on phones, Low on medium, Mid on high by default): the cars are real vehicle shapes (sedans, SUVs, vans, taxis, police, ambulance, trucks, garbage and fire trucks) in many colours, not boxes; they drive in their own lanes on the right (on the left in Mumbai, Delhi and Agra), oncoming cars pass on the other side; none appear close to you; a car behind or ahead keeps a gap and slows for bends; a car stops (does not drive through) if you stop in its lane; driving into one is a solid hit; on a bridge and in a tunnel they stay on their lane; the frame rate does not drop at High; switching to Off removes them. Look at the wheels (round, dark tyres with a lighter rim) and the colours (taxis yellow; ordinary cars mostly black, white, silver and grey).
- [ ] **My music**: in the radio wheel press "Add my songs" and pick a few audio files (also try a text file and a very large file: they are left out with a message). A "My music" tab appears, the songs play one after another and loop, "Next song" skips, "Radio off" stops. After a reload the songs are gone (they are never uploaded or stored); check that nothing was sent over the network (browser network panel).
- [ ] **Controller rumble** (a gamepad that can vibrate): a thump on hitting something, a light buzz on gravel or grass, a rumble in a slide, a push on boost; Settings > Controller rumble > Off stops it. Playing with no gamepad works exactly as before.
- [ ] **Saved choices**: in the browser console `localStorage.setItem('gfp-next', '{"paint":null,"radioVol":"loud","vehicle":"x"}')` then reload: the game starts normally with defaults and no red errors.

## 4. Tuner (`http://localhost:8765/tuner.html`)

- [ ] Panel connects ("about 290 settings"). Move a weather fog slider: the game changes live.
- [ ] A vehicle mass change rebuilds the car; a world setting regenerates the map.
- [ ] "i" button shows text and a range for any setting you try. Reset all, Export, Import work. **Each section header has a "Reset section" button** that shows only while something in it has changed, and resets only that section. New groups: handling, camera, look.
- [ ] Publish: only after the Cloudflare setup (see `HANDOFF.md`): wrong password is refused, right password publishes, Load live and History work.
- [ ] Worker checks (after the Cloudflare setup): a wrong password is refused after a short wait (about 0.4 s) every time; a body over 64 KB is refused; a number over 10 million is refused; `/api/settings` without the password cannot publish; with no KV or no password the API answers 503 and the rest of the site still loads.

- [ ] Mumbai (`?loc=mumbai`): the buildings, sidewalks, zebra crossings, lamps and stalls look right, nothing floats or sinks, you cannot drive through a building front, windows glow at dusk and night, the frame rate stays smooth on a phone (district piece cost not yet measured on a device).

## 5. Phone (do this at least weekly, and before any deploy)

- [ ] Open the live or local address on a real phone (same wifi: start the server with `python tools/serve.py --lan`; it prints the address to type into the phone. Plain `python tools/serve.py` is only reachable from the computer itself).
- [ ] Loads in a reasonable time; touch controls work; menus fit the screen; text readable.
- [ ] **Touch layout** (or on a computer: add `&touch` and use a phone-sized window): left, a vertical throttle lever (stays where you leave it) with BRAKE and BOOST; right, the steering handle on its arc (springs back to the middle) with AUTO, CAM and RESET; speed at the top left. Works held sideways and upright.
- [ ] **Phone camera**: lower, closer and wider than on a computer (compare with the slowroads.io screenshots).
- [ ] Frame rate feels smooth (note it); the phone does not heat up or crash after five minutes.
- [ ] **The new car is heavy** (about 68,000 triangles, 41 draw calls on every tier): note the frame rate with the car next to the same drive with `?q=low`; tell the team if it is a problem.
- [ ] Write down what you saw. Nothing so far has been measured on a phone.

## 6. Speed (when you changed rendering, scenery or textures)

- [ ] **Benchmark** (`&bench=30` on the address, see `PERFORMANCE.md`): run it on `q=low`, `q=med` and `q=high`, on desktop and on each phone; copy the green panel into the team log. Compare with the table in `PERFORMANCE.md`.
- [ ] **Loading screen** shows while the game starts (what is loading, a bar) and fades away by itself; nothing is left on the screen.

- [ ] In the console: `__next.renderer.info.render` shows calls and triangles; note them (the car alone is about 41 calls and 68,000 triangles). Reference on an M4 at 1400x800: plain about 5 to 7 ms a frame, 460 draw calls, 730k triangles.
- [ ] The assets folder stayed under 30 MB (script checks this).

## 7. Before and after a deploy

- [ ] `python tools/daily_check.py` is clean; `cloudflare/public` is current (the script checks).
- [ ] Deploy only from Anshul's PC: `cd cloudflare && npx wrangler deploy`.
- [ ] After: the live `/` is the new game and loads and plays on a phone and a computer; `/classic.html` (the original game) still loads; `/next.html` redirects to `/` and keeps `?loc=...`; the console has no new errors; `/tuner.html` opens; `/api/settings` answers 200 (set up) or 503 (not set up), never a broken page.

## 8. End of day

- [ ] Everything committed and pushed (branch, then a pull request into `main`).
- [ ] New checks added to this file.
- [ ] `HANDOFF.md` updated if the state changed; a team-log entry for anything the other person needs.

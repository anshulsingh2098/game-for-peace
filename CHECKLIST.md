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

## 3. Look at the game (desktop). Start `python tools/serve.py`, open `http://localhost:8765/next.html?play`

Open the browser console (F12): nothing red except known favicon 404s.

- [ ] **Default world** drives: keys steer, accelerate, brake; menu, garage, settings, pause (Esc) open and close.
- [ ] **Every location** loads from the picker: Green Valley, Alps, Himalayas, California, Southern Coast, Mumbai, Delhi, Agra. Ground, trees and road look right for the place.
- [ ] **Road styles**: add `&road=highway`, `boulevard`, `dirt`, `gravel`: each renders, lines and kerbs present, no gaps or streaks.
- [ ] **Shadows**: trees, the car and rocks cast clean shadows: no black streaks, stripes or flicker on trees or the car (check the Alps at midday).
- [ ] **Ground**: photographic grass, rock on cliffs, snow, sand. No seams at tile edges, no shimmering as you drive. Compare with `&ground=flat`.
- [ ] **Scenery**: real trees, shrubs and rocks, no dark fringes or flicker. Compare with `&nature=flat`.
- [ ] **Bridge**: drive onto one (default world, seed `peace`): deck, rails, piers; the car rides the deck. (Known: no rail collision.)
- [ ] **Tunnel** (Himalayas, seed `hill`): gate with a readable "ATAL TUNNEL, ROHTANG" board, portal, tiled lit interior, cones, camera stays inside, no rain inside. Try the truck.
- [ ] **Weather and time**: clear, overcast, fog, rain, storm, snow, each at day, dusk and night: nothing goes black or white, road looks wet in rain, tunnel and bridge look right at night.
- [ ] **Autodrive** (press E, or the Auto button): the car follows the road by itself at about 70 km/h, slows for bends, goes through tunnels and over bridges; steering or braking by hand takes over. Try the Himalayas (seed `hill`) and the default world.
- [ ] **Green Valley** looks like open meadow with tall grass and trees set back from the road, not a forest at the verge.
- [ ] **Quality tiers**: add `&q=low`, `&q=med`, `&q=high`. Low: old cheap ground, fewer tree variants, no shadows; med: lighter photographic ground; high: full ground, bigger shadows and view. Each looks acceptable and none shows broken ground. Phones start on low. (Draw calls and triangles for the Alps at 1400x800: low 176 / 96k, med 523 / 430k, high 898 / 895k. High took about 24 ms on an M4: too slow, still to be tuned.)
- [ ] **Vehicles**: car, truck and bike each drive; paint colours work; white paint does not glare to a white blob.
- [ ] **Radio and sound**: radio wheel (hold Q) plays a station; engine, wind and rain sounds; (known: rain plays inside tunnels).

## 4. Tuner (`http://localhost:8765/tuner.html`)

- [ ] Panel connects ("about 290 settings"). Move a weather fog slider: the game changes live.
- [ ] A vehicle mass change rebuilds the car; a world setting regenerates the map.
- [ ] "i" button shows text and a range for any setting you try. Reset all, Export, Import work.
- [ ] Publish: only after the Cloudflare setup (see `HANDOFF.md`): wrong password is refused, right password publishes, Load live and History work.

## 5. Phone (do this at least weekly, and before any deploy)

- [ ] Open the live or local address on a real phone (same wifi: `http://<your computer's address>:8765/next.html`).
- [ ] Loads in a reasonable time; touch controls work; menus fit the screen; text readable.
- [ ] **Touch layout** (or on a computer: add `&touch` and use a phone-sized window): left, a vertical throttle lever (stays where you leave it) with BRAKE and BOOST; right, the steering handle on its arc (springs back to the middle) with AUTO, CAM and RESET; speed at the top left. Works held sideways and upright.
- [ ] **Phone camera**: lower, closer and wider than on a computer (compare with the slowroads.io screenshots).
- [ ] Frame rate feels smooth (note it); the phone does not heat up or crash after five minutes.
- [ ] Write down what you saw. Nothing so far has been measured on a phone.

## 6. Speed (when you changed rendering, scenery or textures)

- [ ] In the console: `__next.renderer.info.render` shows calls and triangles; note them. Reference on an M4 at 1400x800: plain about 5 to 7 ms a frame, 460 draw calls, 730k triangles.
- [ ] The assets folder stayed under 30 MB (script checks this).

## 7. Before and after a deploy

- [ ] `python tools/daily_check.py` is clean; `cloudflare/public` is current (the script checks).
- [ ] Deploy only from Anshul's PC: `cd cloudflare && npx wrangler deploy`.
- [ ] After: the live `/` (original game) still loads and plays; `/next` loads; the console has no new errors; `/tuner.html` opens; `/api/settings` answers 200 (set up) or 503 (not set up), never a broken page.

## 8. End of day

- [ ] Everything committed and pushed (branch, then a pull request into `main`).
- [ ] New checks added to this file.
- [ ] `HANDOFF.md` updated if the state changed; a team-log entry for anything the other person needs.

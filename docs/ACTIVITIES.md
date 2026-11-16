# Activities and saves (N15)

## Activities
`src/activities/activities.js`. An activity is a record: `{ id, region ('*' = all), title, startS, distance, limit, par, radius }` (metres along the road, seconds). `activitiesFor(regionId)` picks the ones for the current world. Today there is one kind, **point to point**: stop (under 6 m/s) near the green beacon beside the road, press **G** (or tap the button), reach the gold beacon within `limit` seconds. Rating: gold at or under `par`, silver within 25% over, bronze for finishing. Leaving the vehicle, switching mode or rebuilding the world cancels a run (no penalty, not counted as a play). Events: `activity:started`, `activity:finished`.
Shipped: "Marine Drive dash" (Mumbai, 1400 m, par 85 s, limit 150 s) and "Road sprint" (every region, 1000 m). **Par times are guesses, not measured with a real driver.** Add an activity by adding a record to `ACTIVITIES`; `validateActivity` checks it (the self-test checks all shipped ones). Start and goal come from `road.at(s)`, so they follow the generated road; no city name is in engine code.

## The save
`src/core/save.js` (envelope, migration, recovery) and `src/core/saved.js` (field checks). One record in localStorage `gfp-next`: the settings as flat fields, `v: 2`, and `progress: { activities: { id: { plays, best?, rating? } } }`.
- Old records (no version, or 1) migrate by gaining empty progress.
- Text that is not valid JSON or not an object is copied to `gfp-next.bad` and the game starts from defaults.
- A record from a **newer** build (`v` above 2) is read as far as this build understands and is never written over.
- Storage that throws (private mode, full) means defaults and no saving, without errors.
- Progress entries are checked on load (ids, numbers, ratings) and capped at 200.
Next migration: bump `SAVE_VERSION`, add the step in `parseSave`/`loadSave`, add a test.

Not built: other activity kinds (races, deliveries, photo spots, on-foot tasks), a map or route line to the goal, a results screen, a leaderboard, cloud saves, points-of-interest data from region records (the plan has Stream A supplying it).

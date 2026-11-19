# Plan: "Karol Bagh Run", a simple mission game (owner idea, 20 Nov 2026). PLAN ONLY: nothing is built.

## The idea, and is it logical?
Steal one of the most expensive cars in Delhi, a pin appears on the map for the Karol Bagh car market, drive it there, sell it, get cash.
**Yes, it holds together, and it fits what the game already has**, with three conditions:
1. **It needs a reason to be hard.** A pure "steal, drive, sell" loop is a 90-second errand: the car is yours the moment you take it, the market is a few km away, and nothing pushes back. It needs a pressure (a clock, a chase, a damaged-car price) or it feels empty.
2. **The market must be somewhere a stolen car can go.** Karol Bagh is real, central, and known for car parts and used-car dealing (the game already has it as a `market` zone and the landmark `karol-bagh-market`, x -1855, z -3569). In the game it should be a back lane, not the main road.
3. **Money needs somewhere to go**, or the cash is a number nobody cares about (see "what cash buys").

## What the game already gives us (read from the code, 20 Nov 2026)
| Need | Already there | Missing |
|---|---|---|
| Cars to steal | carjacking (PR 136): on foot, G near a car, driver thrown, you drive it | a "target car" that is special (rare model, a price, a map pin) |
| Expensive cars | GT-R R35 and GT-R50 as models, rare in traffic (1 in 80) | a fixed list of targets and where they stand |
| A mission runner | `ActivityRunner` (`src/activities/activities.js`): timed drive to a goal, gold/silver/bronze, results saved in `S.progress`; start markers and goal beacons in `main.js` | a mission with several steps (find, steal, deliver) |
| Map pins and a route | `CityMap` places, GPS route to a place (`setDest`), minimap | a pin that appears only when the mission is on |
| Damage | `damage.js`: dents, smoke, fire, wreck (Anshul) | price depends on damage |
| Money | **nothing** (`main.js` says "no money system yet") | a wallet, saved, shown in the HUD |
| Police / heat | nothing | optional (phase 3) |

## Storylines, three options
**A. "The Chop Shop" (your idea, as it stands).** A contact in Karol Bagh pays cash for premium cars. Steal, deliver, sell. Tone: crime, GTA-like. Needs heat (police) to be tense. Plain and quick to build. Risk: the game is called *Game for Peace* and a pure theft loop is off-brand.
**B. "Repo Man" (recommended).** You work for a legitimate-looking finance agent in Karol Bagh who recovers cars from people who skipped loan payments. The "most expensive cars" are the repossession targets. You still pull a driver out and take the car (the carjacking you already have), but the target is a *named defaulter* from a short card ("Mr Khanna, black GT-R, last seen near India Gate"), the pin shows where the car is, and the market is the dealer who auctions it. Same mechanics as your idea, **same cash**, but a reason, a tone you can defend, and a place to grow (each case a different Delhi district and a short story line: the defaulter is not always a villain).
**C. "Peace Fund" (Robin Hood).** The cars belong to a corrupt builder; the cash goes to a fund that repairs something in the city (a school gate, a bus shelter, a hospital wing) and you *see* it appear in the world. Strongest tie to the game's name, but the most work (the world has to change when you pay).

**Recommendation: B for the first version, with C as the reward later** (cash buys repairs, see below). It keeps your mechanics and your "sell at Karol Bagh" ending exactly, and costs almost nothing extra.

## Mission flow (version 1, works for A, B or C: only the text differs)
1. **Start:** the Garage or the menu shows "Missions". Pick "Karol Bagh Run". A card names the target car and the pay (a price from a table, the more expensive the car the more it pays).
2. **Find:** a pin shows the area (not the exact spot): a rare car (R35 or GT-R50) is placed on a real street there, parked or driving, from a fixed list of spawn points chosen on the real map. The mission places it, so it is always there (the random 1-in-80 traffic GT-R stays as it is).
3. **Take it:** on foot, G (carjacking, already built). The mission starts its clock and the pin moves to the Karol Bagh market.
4. **Deliver:** drive to the market's back lane (a marker); the route line works as for any place. Arrive with the car, stop inside the circle, a short "Selling..." beat (two seconds), then the cash.
5. **Pay:** base price x condition (the damage state: new 100 percent, dents 85, a smoking car 50, a wreck 0) x time (faster is a bonus, like the existing gold/silver/bronze). A toast and a HUD wallet.
6. **Fail:** the car is wrecked (burnt out), or the clock runs out (set generous), or you abandon it (the mission cancels). No harsh penalty in v1.

## Phases (each one small, tested, then logged; owner gate between)
- **M1 Wallet and a deal:** a wallet in the save (`S.cash`), shown in the HUD, a `sell` function with the price table and the damage multiplier, a self-test for the price maths. (No mission yet: a dev command sells the current car.)
- **M2 The mission:** a mission definition (data: id, title, target car, spawn spots, pay), the steps above built on the existing runner, markers, GPS and carjacking; the Karol Bagh market marker; a "Missions" entry in the menu; saved progress.
- **M3 Pressure:** a simple "heat": after you take the car, a few traffic cars become chasers (the traffic system already has cars that follow lanes; chasing is new) or a timer pops a patrol car; **optional, test first**.
- **M4 Story and cash use:** four or five cases with a line of text each; the cash buys something (below).
- **M5 Phone and acceptance:** touch prompts, a phone run, owner sign-off.

## What cash buys (so money matters)
Cheapest: unlock the garage cars (today every car is free). Better: a **Peace Fund** (option C): spend cash to repair places in Delhi; the world shows it. Or: repair and respray your own car at a Karol Bagh workshop (uses the damage and paint code that exist).

## Risks and decisions for the owner
1. **Tone:** A (theft) or B (repossession) or C (Robin Hood)? B is the plan above.
2. **Rare cars on purpose:** the mission places them, so should they also keep appearing in normal traffic? (Plan: no, the R35 stays at 1 in 80, the GT-R50 only in missions.)
3. **Police:** none in v1 (plan), simple chasers in M3 only if v1 feels too easy.
4. **Real names:** the cars carry real brands (the licence question of `NEW_CARS_PLAN.md` still stands); a story about "stolen" real-brand cars is one more reason to decide that before a public deploy.
5. **Not touched here:** carjacking is from PR 136, the runner and map are old code; this plan adds a new `src/missions/` module (pure data and logic, self-tested), a few lines in `main.js` (Stream B file: log and ask first) and the menu.

## Also pending from the owner (separate from this plan, not started)
- Car damage and blast: less easily wrecked, a longer fire and blast, less wreckage per impact, **and these as settings in the master settings tab** (the tuner: `HEALTH` and `DENT` in `src/vehicle/damage.js` are the numbers).
- NPC traffic cars show the real car graphics only after the player gets in a car (to investigate: the traffic models may be loaded late or skipped before the first vehicle change).

# Railway control office (AI traffic control), built 23 Nov 2026

Real practice and sources: `docs/RAIL_OPERATIONS.md` (read it first; every number there is marked CONFIRMED or UNCONFIRMED). This note says what the code does and where it departs from the real railway.

## Files (all pure and headless except the view)
| File | What |
|---|---|
| `src/world/rail_signals.js` | constants (`SIG`, each marked REAL / GAME / UNCONFIRMED), precedence classes, four aspects, `legTime` |
| `src/world/rail_control_graph.js` | `ControlGraph`: blocks, loops, signals, nodes, platforms of every edge; `segsFor(route)` |
| `src/world/rail_services.js` | `buildServices`: the day's trains (real timetable, goods, Mumbai locals) with booked times; `CLOCK_K` |
| `src/world/rail_control.js` | `RailControl`: the simulation of every train, precedence, holds, platforms, gates, deadlock breaker, `audit()` |
| `src/world/rail_view.js` | draws only trains within 1.1 km of the player, signal posts, barrier arms; `?control=off` gives the old physical trains |

## How it works
- **Blocks and signals.** Single track edges are *absolute block*: a train gets the whole stretch up to the next loop or none of it (no head-on meeting). Edges with 2 to 4 tracks are *automatic block*: one or two tracks per direction, blocks of 700 m, one train per block, signal aspects R / Y / YY / G from the clear blocks ahead (`aspectAt`). Crossing loops (480 m) at station ends and every 1.7 km on long edges of 1 and 2 track lines. Nodes can carry several trains only if their paths share an edge.
- **Movement authority.** A train holds the blocks under its body and is granted blocks ahead; the end of its authority is a red signal. It brakes on a curve at 85 % of its braking power (what Kavach enforces), so it cannot pass a red signal (`stats.emergency` counts clamps; the self-test requires 0).
- **Precedence.** Requests are served in class order (Rajdhani / Shatabdi / Duronto / Vande Bharat, Mail / Express, suburban, passenger, goods), then the more delayed first. A lower class train standing in a loop is **held** when a higher class train, running or about to start (the office knows the timetable), will need the stretch ahead before it could clear it (crossing and overtaking). A hold never takes the last line of the loop from the higher class train and never lasts more than 420 s.
- **Stations.** Stopping trains use the loop line (a platform), through trains the main line; the line a train stands on gives its platform number (announcements use it). Trains never leave before their booked time; on time they run at the booked pace (7 % allowance), late they run at full speed (recovery). A terminating train leaves for the yard after 25 s.
- **Level crossings.** The gate closes (8 s) before the train needs the crossing; a train stops 10 m short if it is not down; it opens after the tail has passed. `stats.lcViolations` must be 0.
- **Deadlocks.** A wait-for cycle between stopped trains is found every 20 s and the lowest class train of the cycle is taken out ("shunted to the yard"), counted in `stats.deadlockBreaks`. The design does not make them impossible (see limits).
- **Cost.** Fixed 0.5 s steps for the whole network: two simulated days of about 850 services (up to 150 trains on the line at once) take about 1.2 s headless; in the game the simulation costs a fraction of a frame per step and only trains near the player get meshes.

## Timetable and clock
The map is 1:100, trains are full size. At the old clock (1 railway minute per second) the lines could carry only a fraction of the real timetable, so the control office runs `CLOCK_K = 8` seconds per railway minute (a game day is 3.2 hours): departure times of day come from the timetable, running and halt times from the game's own train performance. The board clock follows the office (`rail.clockMin()`), so a board departure is when the train really leaves; arrival announcements are given when a train is within 900 m of its stop and name the real platform.

## Measured (two simulated days, 60 goods trains, `node tools/selftest.mjs` prints it)
No collision, no signal passed at danger, no gate violation. Some 0.5 to 1 % of trains are lost to deadlock breaking, 15 to 20 % of trains still on the line at any time are waiting for a signal. Punctuality (within 90 s of the booking, UNCONFIRMED threshold) is about 50 % for Rajdhani class, 42 % mail, 81 % suburban, 19 % goods; mean delay 300 s for premium and mail, 1000 s for goods: precedence works (premium < goods) but the compressed network is congested.

## Limits (also in WORK_REMAINING 7.7)
- Distances are 1:100 while trains are real size, so block, loop and loop speed constants are game values; most edges are shorter than a real block.
- Deadlocks are possible (two full loops of trains facing each other); the breaker removes a train. `SIG.LAST_LINE` forbids taking the last line of a loop and removes most of them, but holds back too many trains, so it is off.
- Loop lines are not drawn: a train in a loop stands on a lane beside the track. Points, crossovers and station layouts are not modelled; a station is the block at the node end of each edge.
- Rake links are not tracked (a terminating train just leaves); suburban trains are shuttles every 90 s between Mumbai and its two nearest stations; goods trains are random far station pairs. Kavach is the braking curve only. Signal posts are drawn on the near side of the line; the track layout (3rd track unused in 3-track edges) is approximate.
- Platform numbers are by position (line order), not by railway nomination.

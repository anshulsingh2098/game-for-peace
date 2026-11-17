# On foot (N14)

Press **G** next to a stopped vehicle (under 2.5 m/s) to get out; the character appears beside the door on level, dry, clear ground (`chooseExit`). The vehicle waits on its handbrake and counts as two obstacle circles. Press **G** within 3.4 m of it to get back in. Touch and mouse: the button that appears above the controls ("Get out (G)" / "Get in (G)").

| Input | On foot |
|---|---|
| A / D | turn |
| W / S | walk / back up |
| Shift | run |
| Space | jump |
| G | interact (get in or out) |
| Mouse | click the game to capture the mouse (Esc releases): it turns the character and tilts the camera. On a touch screen, drag on the scene. |

Code: `src/player/onfoot.js` (controller, exit chooser, interaction registry), wiring in `src/main.js` (`exitVehicle`, `enterVehicle`, mode `foot`), keys in `src/input/controls.js` (`run`, `interact`).
Events: `vehicle:exited` and `vehicle:entered` carry a Registry handle (type `vehicle`); it stops resolving when the player is back in.
Anything usable registers with `Interactions.add({ id, x, z, r, prompt, onUse, enabled })`; the nearest in range supplies the prompt.

Not built in this increment: interiors, other vehicles to enter, a rigged or animated player model (a box figure with swinging legs is used), a camera that avoids walls, phone-specific on-foot touch controls (only the G button; walking uses the existing pads). Not measured on a real phone.

## The capsule controller (17 Nov 2026, audit R07)
`OnFoot` is now a swept capsule (radius 0.35 m, height 1.8 m), the usual open-world design:
- **Sweep:** each frame's move is cut into pieces of at most half the radius, so a thin post or a fast sprint at a slow frame rate cannot be skipped.
- **Slide:** a blocked piece slides along the obstacle, up to three times, so corners and two walls at once work; an obstacle behind the movement is ignored.
- **Height:** an obstacle circle may carry `y0` (underside) and `y1` (top). It blocks only if it overlaps the capsule's band above the step height, so the character steps over a kerb (`y1` low), walks under a bridge deck or canopy (`y0` above the head), and is stopped by a wall. Circles with neither field are columns, as before, so the existing world works unchanged.
- **Ground:** step-up to `maxStep`, slope limit judged over the next half metre, water wade limit, ledge fall, jump, unchanged.
Not built yet: camera collision, stairs and multi-storey floors, interiors (N18), and the world supplying `y0`/`y1` for decks and canopies (Stream A data; until then every circle is a column). `chooseExit` now treats cars as obstacles too (audit R06): with every exit spot taken the character stays in the vehicle ("No room to get out here").
Tests: `tools/selftest.mjs`, "audit R07" and "audit R06".

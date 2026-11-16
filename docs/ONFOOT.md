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

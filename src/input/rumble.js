/* Controller rumble: what the gamepad should feel, decided from the vehicle's telemetry (see VEHICLE_CONTRACT.md). Pure, so the self-test can check it;
   Controls.rumble() in controls.js plays the result on a connected gamepad if the browser supports vibration. Never required for play.
   rumbleFor(t, level) -> { strong, weak, ms } (strong = the heavy motor, weak = the light one, both 0..1, ms = how long) or null. level 0 turns it off, 1 is full strength. */
const ROUGH = { gravel: 0.22, grass: 0.16, sand: 0.2, snow: 0.1 };            // surface -> a steady light buzz at speed (asphalt is smooth)
export function rumbleFor(t, level = 1) {
  if (!t || !(level > 0)) return null;
  let strong = 0, weak = 0, ms = 100;
  if (t.impact > 2) { strong = Math.min(1, t.impact / 12); weak = Math.min(1, 0.4 + t.impact / 20); ms = 160; }                  // a hit: a thump that grows with how hard it was
  const rough = ROUGH[t.surface]; if (rough && t.speed > 3) weak = Math.max(weak, rough * Math.min(1, t.speed / 30));              // loose or soft ground
  if (t.speed > 8 && t.slip > 0.25) { weak = Math.max(weak, Math.min(0.6, t.slip)); strong = Math.max(strong, 0.12); }              // sliding
  if (t.buff && t.throttle > 0.5) strong = Math.max(strong, 0.22);                                                                // boost
  if (t.hand > 0.5 && t.speed > 8) strong = Math.max(strong, 0.3);                                                                // handbrake locking the rear wheels
  if (strong < 0.02 && weak < 0.02) return null;
  return { strong: Math.min(1, strong * level), weak: Math.min(1, weak * level), ms };
}

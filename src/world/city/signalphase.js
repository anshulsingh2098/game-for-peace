/* The state of a traffic signal, as pure logic (no three.js) so tools/selftest.mjs can check it. The cars (citytraffic.js `green`) obey one rule: a signal is green for one axis (0 = east-west, 1 = north-south) for 14 s, then the other axis has it, offset per junction by `node * 7 % 28` seconds. The heads (signalheads.js) show the same: green, then amber for the last 2.5 s of the slot (the cars still treat amber as green), red while the other axis has its slot. */
export const SLOT = 14, AMBER = 2.5;
export function signalPhase(time, node, tx, tz) {
  const axis = Math.abs(tx) > Math.abs(tz) ? 0 : 1, u = time + (node * 7 % 28), slot = Math.floor(u / SLOT), within = u - slot * SLOT;
  if (slot % 2 !== axis) return 'red';
  return within >= SLOT - AMBER ? 'amber' : 'green';
}
export const lampLit = (state, kind) => (kind === 0 && state === 'red') || (kind === 1 && state === 'amber') || (kind === 2 && state === 'green');

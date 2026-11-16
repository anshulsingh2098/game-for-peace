/* Railway signals (pure; rail_view.js draws them). Placement and aspects follow Indian Railways practice as far as the sources allow (docs/OPEN_DATA.md):
   colour-light (MACLS) signals stand on the LEFT of the line they govern as seen by the driver, a distant signal stands well back of the first stop signal (the home) so a train can stop at the home,
   the home protects the station or junction (before the first points), block signals divide a long section so two trains never share a block, and a gate signal protects a level crossing (a yellow "G" plate).
   Aspects: red (stop), yellow (caution: the next signal is red), double yellow (attention: the next signal is yellow; four-aspect only), green (proceed).
   Not verified: exact distances (a home is placed 150 m before a node, a distant 650 m before it, block signals about 900 m apart: the game's metres, not scaled), the order of lamps on the head. */
export const HOME_BEFORE = 150, DISTANT_BEFORE = 650, BLOCK_EVERY = 900, MIN_APART = 220;

/* the signals of an edge of length `len` whose ends are the nodes a (s = 0) and b (s = len): [{ s, dir (+1 governs trains running towards b), kind, side }] sorted by s.
   node: function end('a' | 'b') -> { station, junction } or null. Signals for dir -1 stand at the same places for the other direction. */
export function planSignals(len, endA, endB, gates = []) {
  const out = []; const add = (s, dir, kind) => { if (s > 25 && s < len - 25) out.push({ s, dir, kind }); };
  if (endA) { add(HOME_BEFORE, -1, 'home'); if (len > 1100) add(DISTANT_BEFORE, -1, 'distant'); }                    // trains arriving at node a run in the -s direction
  if (endB) { add(len - HOME_BEFORE, 1, 'home'); if (len > 1100) add(len - DISTANT_BEFORE, 1, 'distant'); }
  for (let s = BLOCK_EVERY; s < len - 300; s += BLOCK_EVERY) for (const dir of [1, -1]) if (!out.some(o => o.dir === dir && Math.abs(o.s - s) < MIN_APART)) add(s, dir, 'block');
  for (const g of gates) for (const dir of [1, -1]) add(g - dir * 260, dir, 'gate');                                         // a gate signal 260 m before a level crossing
  return out.sort((x, y) => x.s - y.s);
}
/* the aspect of signal k of `sigs` for trains running in its direction, from which blocks are occupied.
   occupied(from, to): is any train between distances from and to of the edge. A signal's block runs to the next signal of the same direction (or the edge end). closedGate: for a 'gate' signal, whether the gate is shut. */
export function aspectOf(sigs, k, len, occupied, closedGate = true) {
  const sg = sigs[k], dir = sg.dir, same = sigs.filter(o => o.dir === dir), idx = same.indexOf(sg), ahead = dir > 0 ? same.slice(idx + 1) : same.slice(0, idx).reverse();
  const end = (ahead[0] ? ahead[0].s : (dir > 0 ? len : 0)), blk = dir > 0 ? [sg.s, end] : [end, sg.s];
  if (sg.kind === 'gate' && !closedGate) return 'red';
  if (occupied(blk[0], blk[1])) return 'red';
  if (sg.kind === 'distant' || sg.kind === 'block') { const nx = ahead[0]; if (nx) { const e2 = ahead[1] ? ahead[1].s : (dir > 0 ? len : 0), b2 = dir > 0 ? [nx.s, e2] : [e2, nx.s]; if (occupied(b2[0], b2[1])) return 'yellow'; } }
  return 'green';
}
export const ASPECT_LAMPS = { red: [1, 0, 0, 0], yellow: [0, 1, 0, 0], green: [0, 0, 1, 0], double: [0, 1, 0, 1] };           // lamps top to bottom: red, yellow, green, yellow

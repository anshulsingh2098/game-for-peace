/* Signalling and operating constants of the railway control layer (pure: no three.js, no DOM). Real practice and the sources are in docs/RAIL_OPERATIONS.md; every number below is marked
   REAL (found in a source), GAME (a choice, because the world is drawn 1:100 and a real block of 1 to 2 km would be longer than most edges) or UNCONFIRMED (no source found).
   Units: game metres and seconds (a train is real size and real speed; the land between cities is 100 times smaller). */

/* precedence classes, 0 is served first (docs/RAIL_OPERATIONS.md section 5: the official numbered list could not be opened, so the order is the commonly described one) */
export const PRIORITY = { premium: 0, mail: 1, suburban: 2, passenger: 3, freight: 4 };
export const PRIORITY_NAMES = ['Rajdhani / Shatabdi / Duronto / Vande Bharat', 'Superfast / Mail / Express', 'Suburban', 'Passenger', 'Freight'];
/* the precedence class of a real timetable train (DataMeet types: Raj, Shtb, JShtb, Drnt, SF, GR, Exp) */
export function classOf(t) {
  const s = String(t.name || '').toLowerCase(), ty = String(t.type || '');
  if (/vande|rajdhani|shatabdi|duronto|tejas/.test(s) || /^(Raj|Shtb|JShtb|Drnt)$/.test(ty)) return 'premium';
  return 'mail';
}

export const SIG = {
  BLOCK_AUTO: 700,          // GAME: automatic-block signal spacing (REAL: about 1 km, UNCONFIRMED; shortened for the 1:100 world)
  LOOP_LEN: 480,            // GAME: loop length, must hold the longest train (REAL: loops of 650 to 800 m exist, UNCONFIRMED standard)
  LOOP_MIN_EDGE: 700,       // GAME: an edge shorter than this gets no loop
  LOOP_GAP: 60,             // GAME: stub of single line between a loop's points and the node (REAL: advanced starter 180 m beyond points)
  LOOP_SPACING: 1700,       // GAME: another crossing loop every this many metres on a long single line
  LOOP_SPEED: 8.3,          // REAL: loop turnout 15 km/h conventional (30 km/h under Kavach trial); the game uses 30 km/h (8.3 m/s)
  LOOP_TURNOUT: 70,         // GAME: length of the turnout at each end of a loop where the loop speed applies
  LAST_LINE: false,         // GAME: forbid taking the last free line of a loop unless the train can go straight on
  BRAKE_USE: 0.85,          // the driver, and Kavach, brake with 85 % of the train's capability so a stop is always possible
  STOP_GAP: 3,              // m a train stops short of a signal
  RECOVERY: 0.07,           // UNCONFIRMED: running-time allowance (recovery margin) built into every booked run
  PUNCTUAL: 90,             // UNCONFIRMED: a train is punctual when it arrives within this many seconds of the booking (REAL: 15 min of 1440 on the clock is the nearest official figure)
  HOLD_MAX: 420,            // GAME: longest a controller keeps a lower class train in a loop for a higher one
  STUCK_LIMIT: 1500,        // GAME: a train that has not moved for this long is treated as deadlocked and taken out (should never happen, the self-test counts it)
  PLAN_AHEAD: 500,          // GAME: seconds ahead the control office plans for trains that have not started yet
  LOOKAHEAD: 7000,          // m of route the controller looks along for higher class trains that need the same line
  TURNAROUND: 25,           // GAME: a terminating train stands this long (passengers alight), then the rake leaves for the yard (REAL minimum turnaround: UNCONFIRMED)
  GATE_CLOSE_T: 8,          // GAME: seconds a level crossing barrier takes to come down
  GATE_LEAD: 6,             // GAME: extra seconds the gate is closed before the train needs it
  GATE_AFTER: 6,            // m past the crossing the train's tail must be before the gate opens
  GATE_ZONE: 10,            // m before the crossing a train stops if the gate is not down
};

/* aspects of a four-aspect colour light signal (REAL): red stop, yellow be ready to stop at the next signal, double yellow the next is yellow, green clear; n = clear blocks ahead */
export const aspectFor = n => n <= 0 ? 'R' : n === 1 ? 'Y' : n === 2 ? 'YY' : 'G';
export const brakeDist = (v, b) => v * v / (2 * b);
/* time (s) of a leg of length L between two stops for a train that accelerates, cruises and brakes (closed form, no signals in the way) */
export function legTime(L, vmax, accel, brake) {
  L = Math.max(L, 1); const da = vmax * vmax / (2 * accel), db = vmax * vmax / (2 * brake);
  if (da + db > L) { const vt = Math.sqrt(2 * L / (1 / accel + 1 / brake)); return vt / accel + vt / brake; }
  return vmax / accel + vmax / brake + (L - da - db) / vmax;
}

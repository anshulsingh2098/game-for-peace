/* Activities (N15): data-driven things to do in the world. This first kind is a point-to-point drive: start at a marker beside the road, reach the goal marker inside the time limit, get a
   rating against a par time. An activity is plain data (below); the runner knows nothing about three.js, the DOM or any city, so the self-test runs it headless.
   Definition: { id, region ('*' = every region), title, startS, distance, limit (s), par (s), radius (m) }. startS and distance are metres along the road; main.js turns them into world
   positions with road.at(). Ratings: gold at or under par, silver within 25% over, bronze for finishing in time.
   Events: 'activity:started' { id }, 'activity:finished' { id, outcome: 'done' | 'failed' | 'cancelled', time, rating }. */
export const ACTIVITIES = [
  { id: 'mumbai-marine-dash', region: 'mumbai', title: 'Marine Drive dash', startS: 60, distance: 1400, limit: 150, par: 85, radius: 14 },
  { id: 'road-sprint', region: '*', title: 'Road sprint', startS: 80, distance: 1000, limit: 120, par: 70, radius: 14 }
];
export const activitiesFor = (regionId, list = ACTIVITIES) => list.filter(a => a.region === regionId || a.region === '*');
export const rate = (def, time) => time <= def.par ? 'gold' : time <= def.par * 1.25 ? 'silver' : 'bronze';
export const RATING_ORDER = ['bronze', 'silver', 'gold'];

/* check an activity record; returns a list of problems (empty when valid) */
export function validateActivity(a) {
  const p = [], num = (k, lo, hi) => { if (!(Number.isFinite(a[k]) && a[k] >= lo && a[k] <= hi)) p.push(k + ' must be a number from ' + lo + ' to ' + hi); };
  if (!a || typeof a !== 'object') return ['not an object']; if (!/^[a-z0-9-]{1,40}$/.test(a.id || '')) p.push('id must be lower-case letters, digits and dashes'); if (typeof a.title !== 'string' || !a.title) p.push('title is needed');
  if (typeof a.region !== 'string') p.push('region is needed'); num('startS', 0, 1e5); num('distance', 100, 1e5); num('limit', 10, 3600); num('par', 5, 3600); num('radius', 3, 60); if (a.par > a.limit) p.push('par is longer than the time limit'); return p;
}

export class ActivityRunner {
  constructor(bus = null) { this.bus = bus; this.state = 'idle'; this.def = null; this.goal = null; this.t = 0; this.dist = 0; this.result = null; }
  /* def plus the resolved goal point { x, z } in world metres; false if one is already running */
  start(def, goal) { if (this.state === 'running') return false; this.def = def; this.goal = goal; this.t = 0; this.dist = Math.hypot(goal.x, goal.z); this.state = 'running'; this.result = null; if (this.bus) this.bus.emit('activity:started', { id: def.id }); return true; }
  update(dt, x, z) {
    if (this.state !== 'running' || !(dt > 0)) return; this.t += dt; this.dist = Math.hypot(x - this.goal.x, z - this.goal.z);
    if (this.dist <= this.def.radius) this.finish('done'); else if (this.t > this.def.limit) this.finish('failed');
  }
  cancel() { if (this.state === 'running') this.finish('cancelled'); }
  finish(outcome) { const d = this.def, time = +this.t.toFixed(2); this.result = { id: d.id, outcome, time, rating: outcome === 'done' ? rate(d, time) : null }; this.state = 'idle'; if (this.bus) this.bus.emit('activity:finished', this.result); }
}

/* record a finished activity in the saved progress (returns the new progress and whether it is a new best) */
export function recordResult(progress, result) {
  const acts = { ...(progress && progress.activities) }, old = acts[result.id] || { plays: 0 }; let best = old.best, rating = old.rating, isBest = false;
  if (result.outcome === 'done') { if (best === undefined || result.time < best) { best = result.time; isBest = true; } if (!rating || RATING_ORDER.indexOf(result.rating) > RATING_ORDER.indexOf(rating)) rating = result.rating; }
  acts[result.id] = { plays: Math.min(1e6, (old.plays || 0) + (result.outcome === 'cancelled' ? 0 : 1)), ...(best !== undefined ? { best } : {}), ...(rating ? { rating } : {}) };
  return { progress: { ...(progress || {}), activities: acts }, isBest };
}

/* Missions (docs/MISSION_PLAN.md, phases M1 and M2). The first one is "Repo Man": a dealer in Karol Bagh pays cash for premium cars recovered from people who stopped paying their loans.
   Pure data and logic (no three.js, no DOM), so tools/selftest.mjs runs it. main.js turns a case into a pin, a parked target car and a market marker.
   A case: { id, title, client (who owns the car), story (one or two lines), car ('r35' | 'everest': the garage car it becomes), kind (the traffic model that stands on the street), paint (hex), at (a landmark id of the Delhi pack:
   the car is parked in the street nearest to it), base (the dealer's price for a clean car, rupees), par and limit (seconds) }.
   The pay is base x condition x time: a car with dents is worth less, a smoking one half, a burnt-out one nothing, and a quick job earns up to 20 percent more. */
export const MARKET = { id: 'karol-bagh-market', name: 'Karol Bagh car market' };      // a landmark of assets/cities/delhi/landmarks.json
export const CASES = [
  { id: 'khanna-gtr', title: "Mr Khanna's GT-R", client: 'Mr Khanna', story: "Missed eleven payments on a black GT-R. It sits outside his house near Jantar Mantar. Take it to the dealer in Karol Bagh.", car: 'r35', kind: 'gtr-sports', paint: '#16181d', at: 'jantar-mantar', base: 450000, par: 420, limit: 1200 },
  { id: 'mehra-endeavour', title: "The Mehras' Endeavour", client: 'the Mehra family', story: "A white Endeavour, six months behind. It is parked near India Gate. The dealer pays less than for a GT-R, but it is an easy job.", car: 'everest', kind: 'endeavour-suv', paint: '#e8e9ec', at: 'india-gate', base: 160000, par: 600, limit: 1500 },
  { id: 'bedi-gtr', title: "Mr Bedi's red GT-R", client: 'Mr Bedi', story: "A red GT-R near Khan Market, a long drive from the dealer. He stopped answering calls in March.", car: 'r35', kind: 'gtr-sports', paint: '#b11f1f', at: 'khan-market', base: 520000, par: 780, limit: 1800 }
];
export const caseById = id => CASES.find(c => c.id === id) || null;

/* Indian digit grouping: 450000 -> "4,50,000" */
export function rupees(n) {
  n = Math.max(0, Math.round(+n || 0)); let s = String(n); if (s.length <= 3) return '₹' + s; const last = s.slice(-3); let rest = s.slice(0, -3), out = ''; while (rest.length > 2) { out = ',' + rest.slice(-2) + out; rest = rest.slice(0, -2); } return '₹' + rest + out + ',' + last;
}

/* what the dealer thinks of the car: d = the vehicle's damage { state: 'ok' | 'smoking' | 'dead' | 'burning' | 'wrecked', frame: 0..1 (the body's health) } */
export function conditionOf(d) {
  const st = d && d.state || 'ok', frame = d && Number.isFinite(d.frame) ? Math.max(0, Math.min(1, d.frame)) : 1;
  if (st === 'wrecked') return { mult: 0, label: 'burnt out: scrap' };
  if (st === 'burning') return { mult: 0.1, label: 'on fire' };
  if (st === 'dead') return { mult: 0.25, label: 'dead engine' };
  if (st === 'smoking') return { mult: Math.min(0.5, 0.25 + frame * 0.3), label: 'smoking' };
  return { mult: frame >= 0.95 ? 1 : frame >= 0.8 ? 0.9 : frame >= 0.6 ? 0.75 : 0.6, label: frame >= 0.95 ? 'clean' : frame >= 0.8 ? 'a few dents' : frame >= 0.6 ? 'dented' : 'badly dented' };
}
/* the pay: c the case, a { damage, seconds } -> { base, mult, label, bonus (0 to 0.2), total } */
export function priceOf(c, a) {
  const cond = conditionOf(a && a.damage), s = a && Number.isFinite(a.seconds) ? a.seconds : c.limit;
  const bonus = s <= c.par ? 0.2 : s >= c.limit ? 0 : 0.2 * (c.limit - s) / (c.limit - c.par);
  return { base: c.base, mult: cond.mult, label: cond.label, bonus: +bonus.toFixed(3), total: Math.round(c.base * cond.mult * (1 + bonus) / 100) * 100 };
}

/* a case is plain data: this returns what is wrong with one (an empty list when it is fine); `landmarks` (a Set of ids) is optional */
export function validateCase(c, landmarks = null) {
  const p = []; if (!c || typeof c !== 'object') return ['not an object']; if (!/^[a-z0-9-]{1,40}$/.test(c.id || '')) p.push('id');
  for (const k of ['title', 'client', 'story']) if (typeof c[k] !== 'string' || !c[k]) p.push(k); if (!['r35', 'everest'].includes(c.car)) p.push('car'); if (!['gtr-sports', 'endeavour-suv'].includes(c.kind)) p.push('kind');
  if (!/^#[0-9a-f]{6}$/i.test(c.paint || '')) p.push('paint'); for (const k of ['base', 'par', 'limit']) if (!(Number.isFinite(c[k]) && c[k] > 0)) p.push(k); if (c.par >= c.limit) p.push('par must be under limit');
  if (landmarks && !landmarks.has(c.at)) p.push('at: no such landmark ' + c.at); return p;
}

/* the run: one case in progress. Phases: 'find' (the pin leads to the car), 'deliver' (you have it: the pin leads to the market), 'sold', 'failed'. */
export class Run {
  constructor(c) { this.c = c; this.phase = 'find'; this.t = 0; this.prev = null; this.why = ''; this.result = null; }
  tick(dt) { if (this.phase === 'find' || this.phase === 'deliver') { this.t += dt; if (this.t > this.c.limit) this.fail('Out of time: the client has moved the car.'); } }
  get left() { return Math.max(0, this.c.limit - this.t); }
  taken(prevVehicle) { if (this.phase !== 'find') return false; this.phase = 'deliver'; this.prev = prevVehicle; return true; }
  sell(damage) { if (this.phase !== 'deliver') return null; this.result = priceOf(this.c, { damage, seconds: this.t }); this.phase = 'sold'; return this.result; }
  fail(why) { if (this.phase === 'sold' || this.phase === 'failed') return; this.phase = 'failed'; this.why = why || 'Case closed.'; }
  get active() { return this.phase === 'find' || this.phase === 'deliver'; }
}

/* the saved part: { cash, missions: { id: { done, best } } } from raw saved data, nothing else trusted */
export function sanitiseWallet(raw) {
  const out = { cash: 0, missions: {} }; if (!raw || typeof raw !== 'object') return out;
  if (Number.isFinite(raw.cash)) out.cash = Math.max(0, Math.min(1e9, Math.round(raw.cash)));
  const m = raw.missions; if (m && typeof m === 'object' && !Array.isArray(m)) { let n = 0; for (const [id, e] of Object.entries(m)) { if (n++ >= 50 || !/^[a-z0-9-]{1,40}$/.test(id) || !e || typeof e !== 'object') continue; out.missions[id] = { done: Number.isInteger(e.done) && e.done >= 0 ? Math.min(e.done, 1e6) : 0, best: Number.isFinite(e.best) ? Math.max(0, Math.min(1e9, Math.round(e.best))) : 0 }; } }
  return out;
}

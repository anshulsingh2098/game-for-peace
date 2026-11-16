/* Real train names, numbers and timetables on the railway (assets/india/trains.json, built by tools/build_india_trains.mjs from DataMeet, CC0, about 2016 timings).
   Pure (no three.js, no DOM): the self-test checks it.
   TrainBook: which real trains use which track edge (a train's stops in game cities are joined by the shortest way over the rail network), which real identity a train on an edge gets, the departure
   board of a city at a time of day, and the text of a station announcement. The railway clock (RAIL_CLOCK) runs RAIL_SPEED game minutes per real second, starting at 08:00. */
export const RAIL_SPEED = 1, RAIL_START = 8 * 60;                            // 1 game minute per real second: the time on station boards moves, a day takes 24 real minutes
export const clockMinutes = (realSeconds, start = RAIL_START) => ((start + realSeconds * RAIL_SPEED) % 1440 + 1440) % 1440;
export const fmtTime = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const hash = (a, b = 0) => { let x = (a * 2654435761 + b * 40503 + 12345) >>> 0; x = (x ^ (x >>> 15)) >>> 0; x = Math.imul(x, 2246822519) >>> 0; x = (x ^ (x >>> 13)) >>> 0; return x / 4294967296; };
const clean = s => String(s || '').replace(/\bExpres+\b/i, 'Express').replace(/\s+/g, ' ').trim();
export const styleOf = t => { const s = (t.name + ' ' + t.type).toLowerCase(); return /rajdhani/.test(s) ? 'rajdhani' : /vande/.test(s) ? 'vande' : 'express'; };

export class TrainBook {
  constructor(json, network) {
    this.cities = json.cities || {}; this.trains = json.trains.map(t => ({ ...t, name: clean(t.name) })); this.locals = json.locals || []; this.net = network; this.byEdge = new Map(); this.byCity = new Map();
    this.trains.forEach((t, i) => {
      const stn = t.stops.map(s => network.byCity.get(s[0])).filter(Boolean); for (const s of t.stops) { let l = this.byCity.get(s[0]); if (!l) this.byCity.set(s[0], l = []); l.push(i); }
      for (let k = 1; k < stn.length; k++) { const steps = stn[k - 1].id === stn[k].id ? [] : network.route(stn[k - 1].id, stn[k].id); if (!steps) continue; for (const st of steps) { let l = this.byEdge.get(st.edge.edgeId); if (!l) this.byEdge.set(st.edge.edgeId, l = new Set()); l.add(i); } }
    });
  }
  /* the real train a physical train on edge `edgeId` stands for (seed picks one when several use the edge), or null */
  identify(edgeId, seed = 0) { const set = this.byEdge.get(edgeId); if (!set || !set.size) return null; const arr = [...set], t = this.trains[arr[Math.floor(hash(edgeId, seed) * arr.length)]]; return t; }
  destination(t, from) { const last = t.stops[t.stops.length - 1], first = t.stops[0]; const to = last[0] === from ? first[0] : last[0]; return this.cities[to] || to; }
  /* the next `n` departures from a city after minute `now` of the day: { n, name, to, time, minutes } sorted by time, wrapping past midnight */
  departures(cityId, now, n = 4) {
    const out = []; for (const i of this.byCity.get(cityId) || []) { const t = this.trains[i], st = t.stops.find(s => s[0] === cityId); if (!st || st[2] === null) continue; if (t.stops[t.stops.length - 1][0] === cityId) continue; const dep = ((st[2] % 1440) + 1440) % 1440; out.push({ n: t.n, name: t.name, to: this.destination(t, cityId), time: fmtTime(dep), minutes: ((dep - now) % 1440 + 1440) % 1440 }); }
    out.sort((a, b) => a.minutes - b.minutes || (a.n < b.n ? -1 : 1)); const seen = new Set(), res = []; for (const o of out) { if (seen.has(o.n)) continue; seen.add(o.n); res.push(o); if (res.length >= n) break; } return res;
  }
  /* arrivals at a city within the minute `now` (for the announcer): trains whose arrival time equals the clock */
  arrivalsAt(cityId, now) {
    const out = []; for (const i of this.byCity.get(cityId) || []) { const t = this.trains[i], st = t.stops.find(s => s[0] === cityId); if (!st || st[1] === null || t.stops[0][0] === cityId) continue; if (Math.round(((st[1] % 1440) + 1440) % 1440) === Math.round(now)) out.push({ n: t.n, name: t.name, from: this.cities[t.stops[0][0]] || t.stops[0][0], to: this.destination(t, cityId) }); } return out;
  }
}

/* the words of a station announcement, English and Hindi, in the usual Indian Railways style (written for this game; the recordings of the real ones are not used) */
export function announcement(kind, t, platform, cityName) {
  const n = t.n, nm = t.name, to = t.to || '';
  if (kind === 'arriving') return { en: `Attention please. Train number ${n}, ${nm}, to ${to}, is arriving on platform number ${platform}. Please stand behind the yellow line.`, hi: `यात्रीगण कृपया ध्यान दें। गाड़ी संख्या ${n}, ${nm}, प्लेटफॉर्म संख्या ${platform} पर आ रही है। कृपया पीली रेखा के पीछे रहें।` };
  if (kind === 'departing') return { en: `Attention please. Train number ${n}, ${nm}, to ${to}, will depart from platform number ${platform} shortly.`, hi: `यात्रीगण कृपया ध्यान दें। गाड़ी संख्या ${n}, ${nm}, प्लेटफॉर्म संख्या ${platform} से कुछ ही देर में रवाना होगी।` };
  if (kind === 'local') return { en: `Attention please. The ${to} ${t.speed || 'slow'} local is arriving on platform number ${platform}.`, hi: `यात्रीगण कृपया ध्यान दें। ${to} जाने वाली लोकल प्लेटफॉर्म संख्या ${platform} पर आ रही है।` };
  return { en: `Welcome to ${cityName} station. Please stand behind the yellow line.`, hi: `${cityName} स्टेशन पर आपका स्वागत है। कृपया पीली रेखा के पीछे रहें।` };
}

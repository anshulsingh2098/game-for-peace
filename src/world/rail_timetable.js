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

/* how many parallel tracks a section has: single where few trains use it, double on busy lines, three and four on the busiest trunk routes (Indian Railways has multi-track corridors) */
export const tracksFor = n => n >= 150 ? 4 : n >= 100 ? 3 : n >= 30 ? 2 : 1;
export const TRACK_GAP = 5.3;                                                                                       // metres between track centres on Indian broad gauge
export const laneOffsets = c => Array.from({ length: c }, (_, i) => (i - (c - 1) / 2) * TRACK_GAP);

export class TrainBook {
  constructor(json, network) {
    this.cities = json.cities || {}; this.trains = json.trains.map(t => ({ ...t, name: clean(t.name) })); this.locals = json.locals || []; this.net = network; this.byEdge = new Map(); this.byCity = new Map();
    this.trains.forEach((t, i) => {
      const stn = t.stops.map(s => network.byCity.get(s[0])).filter(Boolean); for (const s of t.stops) { let l = this.byCity.get(s[0]); if (!l) this.byCity.set(s[0], l = []); l.push(i); }
      for (let k = 1; k < stn.length; k++) { const steps = stn[k - 1].id === stn[k].id ? [] : network.route(stn[k - 1].id, stn[k].id); if (!steps) continue; for (const st of steps) { let l = this.byEdge.get(st.edge.edgeId); if (!l) this.byEdge.set(st.edge.edgeId, l = new Set()); l.add(i); } }
    });
  }
  tracks(edgeId) { const set = this.byEdge.get(edgeId); return tracksFor(set ? set.size : 0); }
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
/* the state language of a station, spoken first as at real stations (Hindi and English follow); the Hindi-speaking states have none. The regional texts below are plain translations of the arrival wording written for the game
   and have NOT been checked by native speakers (WORK_REMAINING 7.11). lang is the BCP 47 tag the browser's speech voices use. */
export const STATE_LANG = { Maharashtra: 'mr-IN', 'West Bengal': 'bn-IN', 'Tamil Nadu': 'ta-IN', Telangana: 'te-IN', 'Andhra Pradesh': 'te-IN', Karnataka: 'kn-IN', Kerala: 'ml-IN', Gujarat: 'gu-IN', Punjab: 'pa-IN', Odisha: 'or-IN', Assam: 'as-IN' };
const REGIONAL_ARRIVING = {
  'mr-IN': (n, nm, p) => `प्रवाशांनी कृपया लक्ष द्यावे. गाडी क्रमांक ${n}, ${nm}, फलाट क्रमांक ${p} वर येत आहे.`, 'bn-IN': (n, nm, p) => `যাত্রীগণ দয়া করে মনোযোগ দিন। ট্রেন নম্বর ${n}, ${nm}, ${p} নম্বর প্ল্যাটফর্মে আসছে।`,
  'ta-IN': (n, nm, p) => `பயணிகள் கவனத்திற்கு. வண்டி எண் ${n}, ${nm}, நடைமேடை எண் ${p} இல் வந்து கொண்டிருக்கிறது.`, 'te-IN': (n, nm, p) => `ప్రయాణికులకు విజ్ఞప్తి. రైలు నంబర్ ${n}, ${nm}, ప్లాట్‌ఫారం నంబర్ ${p} కు వస్తోంది.`,
  'kn-IN': (n, nm, p) => `ಪ್ರಯಾಣಿಕರ ಗಮನಕ್ಕೆ. ರೈಲು ಸಂಖ್ಯೆ ${n}, ${nm}, ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಸಂಖ್ಯೆ ${p} ಕ್ಕೆ ಬರುತ್ತಿದೆ.`, 'ml-IN': (n, nm, p) => `യാത്രക്കാരുടെ ശ്രദ്ധയ്ക്ക്. ട്രെയിൻ നമ്പർ ${n}, ${nm}, പ്ലാറ്റ്ഫോം നമ്പർ ${p} ലേക്ക് വരുന്നു.`,
  'gu-IN': (n, nm, p) => `મુસાફરોને વિનંતી છે કે ધ્યાન આપો. ટ્રેન નંબર ${n}, ${nm}, પ્લેટફોર્મ નંબર ${p} પર આવી રહી છે.`, 'pa-IN': (n, nm, p) => `ਯਾਤਰੀ ਕਿਰਪਾ ਕਰਕੇ ਧਿਆਨ ਦੇਣ। ਗੱਡੀ ਨੰਬਰ ${n}, ${nm}, ਪਲੇਟਫਾਰਮ ਨੰਬਰ ${p} 'ਤੇ ਆ ਰਹੀ ਹੈ।`,
  'or-IN': (n, nm, p) => `ଯାତ୍ରୀମାନେ ଦୟାକରି ଧ୍ୟାନ ଦିଅନ୍ତୁ। ଟ୍ରେନ ନମ୍ବର ${n}, ${nm}, ପ୍ଲାଟଫର୍ମ ନମ୍ବର ${p} କୁ ଆସୁଛି।`, 'as-IN': (n, nm, p) => `যাত্ৰীসকল অনুগ্ৰহ কৰি মনোযোগ দিয়ক। ট্ৰেইন নম্বৰ ${n}, ${nm}, প্লেটফৰ্ম নম্বৰ ${p} লৈ আহি আছে।`,
};
export function announcement(kind, t, platform, cityName, state = '') {
  const a = announce1(kind, t, platform, cityName), lang = STATE_LANG[state]; if (lang && kind === 'arriving' && REGIONAL_ARRIVING[lang]) a.regional = { lang, text: REGIONAL_ARRIVING[lang](t.n, t.name, platform) }; return a;
}
function announce1(kind, t, platform, cityName) {
  const n = t.n, nm = t.name, to = t.to || '';
  if (kind === 'arriving') return { en: `Attention please. Train number ${n}, ${nm}, to ${to}, is arriving on platform number ${platform}. Please stand behind the yellow line.`, hi: `यात्रीगण कृपया ध्यान दें। गाड़ी संख्या ${n}, ${nm}, प्लेटफॉर्म संख्या ${platform} पर आ रही है। कृपया पीली रेखा के पीछे रहें।` };
  if (kind === 'departing') return { en: `Attention please. Train number ${n}, ${nm}, to ${to}, will depart from platform number ${platform} shortly.`, hi: `यात्रीगण कृपया ध्यान दें। गाड़ी संख्या ${n}, ${nm}, प्लेटफॉर्म संख्या ${platform} से कुछ ही देर में रवाना होगी।` };
  if (kind === 'local') return { en: `Attention please. The ${to} ${t.speed || 'slow'} local is arriving on platform number ${platform}.`, hi: `यात्रीगण कृपया ध्यान दें। ${to} जाने वाली लोकल प्लेटफॉर्म संख्या ${platform} पर आ रही है।` };
  return { en: `Welcome to ${cityName} station. Please stand behind the yellow line.`, hi: `${cityName} स्टेशन पर आपका स्वागत है। कृपया पीली रेखा के पीछे रहें।` };
}

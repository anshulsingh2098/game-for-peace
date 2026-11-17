/* What makes the city this city (docs/CITY_PACK.md section 6, docs/DELHI_LOOK.md): the reader of assets/cities/<id>/identity.json. Pure JavaScript (no three.js, no DOM), so tools/selftest.mjs can test it.
   Zones are circles (lat/lon in the file, metres in the pack frame here) that name an area type; the areas carry palettes, shop density and kinds, ads, trees, people and the vehicle mix. Every street-life
   system (streetlife.js, citytraffic.js, citypeds.js, the sky) asks this one object. */
const R_EARTH = 6371008.8;

export function projectLL(origin, lat, lon) { const k = Math.PI / 180; return { x: R_EARTH * Math.cos(origin.lat * k) * (lon - origin.lon) * k, z: -R_EARTH * (lat - origin.lat) * k }; }
/* a deterministic hash of an integer to [0, 1) */
export const hash = n => { let h = (n | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/* pick a key of { key: weight } with r in [0, 1) */
export function pickWeighted(w, r) { let t = 0; for (const k in w) if (typeof w[k] === 'number' && k !== 'guess') t += w[k]; let a = r * t; let last = null; for (const k in w) { if (typeof w[k] !== 'number' || k === 'guess') continue; last = k; a -= w[k]; if (a < 0) return k; } return last; }

export class Identity {
  constructor(json, origin) {
    if (!json || json.format !== 1) throw new Error('identity.json: unknown format');
    this.j = json; this.areas = json.areas; this.zones = json.zones.map(z => ({ ...z, ...projectLL(origin, z.lat, z.lon) })); this.species = new Map(json.vegetation.species.map(s => [s.id, s])); this.cache = new Map();
  }
  /* the area type at (x, z): the smallest zone that contains the point, else 'default' */
  zoneAt(x, z) { let best = null; for (const q of this.zones) { const d = Math.hypot(q.x - x, q.z - z); if (d < q.r && (!best || q.r < best.r)) best = q; } return best; }
  areaNameAt(x, z) { const q = this.zoneAt(x, z); return q ? q.area : 'default'; }
  area(name) { return this.areas[name] || this.areas.default; }
  areaAt(x, z) { return this.area(this.areaNameAt(x, z)); }
  /* the area of a building: its zone, but a commercial building outside every zone takes the `landuseArea` of its use */
  areaOfBuilding(b, x, z) { const q = this.zoneAt(x, z); if (q) return q.area; const m = this.j.landuseArea && this.j.landuseArea[b.use]; return m || 'default'; }
  /* a vehicle kind for the area with r in [0, 1) */
  vehicleKind(areaName, r) { return pickWeighted(this.area(areaName).traffic, r); }
  /* a shop kind for the area with r in [0, 1) */
  shopKind(areaName, r) { const a = this.area(areaName); return pickWeighted(a.shopKinds || this.areas.market.shopKinds, r); }
  /* the month's sky: { fog, smog, dust, tempC } for m 1..12 */
  month(m) { return this.j.sky.months[((m - 1) % 12 + 12) % 12]; }
  season(m) { return m >= 11 || m <= 2 ? 'winter' : m >= 7 && m <= 9 ? 'monsoon' : 'summer'; }
  clothing(m) { return this.j.people.clothing[this.season(m)]; }
  /* the density of people (0..1) at an hour of the day */
  peopleAt(hour) { return this.j.people.byHour[Math.floor(((hour % 24) + 24) % 24)]; }
  trafficAt(hour) { return this.j.traffic.byHourFactor[Math.floor(((hour % 24) + 24) % 24)]; }
}

export async function loadIdentity(base, origin, get) {
  const f = get || (async u => { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
  return new Identity(await f(base.replace(/\/$/, '') + '/identity.json'), origin);
}

/* Regions (post-N6 plan, N9): the data that makes one place the place it is, kept apart from rendering, traffic and AI code. A region is plain data (JSON-like, versioned); the engine
   reads it through `regionToLocation()` and then runs the same code for every region: no system contains a city name. Pure JavaScript, so the self-test validates every region.

   Schema (version 1) - every field below is required unless marked optional:
     schema        1 (this layout; bump it when the layout changes and add a migration in `migrateRegion`)
     id, version   id: lower-case words; version: the data version of THIS region (bump it when its numbers change: worlds are reproducible from region id + version + seed)
     name, blurb, accent                shown in the picker
     inspiration   { place, lat, lon, boundsKm: [w, h] }       what it is a stylised impression of (India: lat 6..36, lon 68..98)
     transform     { anchorLat, anchorLon, metresPerGameMetre } where the region's local (0, 0) sits on the real map and how much the game compresses real distance (1 = none). Used by
                   the connected-India map of the later phases; each region is its own generated world until then.
     climate       { time, weather }          the sky it starts with
     land          { terrain, palette, water } the numbers the terrain generator, ground colours and sea take (same fields as a world config)
     vegetation    { trees, rocks, bushes, tufts, pineBias, tint, ... }  the scatter settings
     roads         { style, maxAlt, drive: 'left' | 'right', density 0..1, router? }   router (optional): route-planner numbers for this land { maxGrade, hardGrade, maxCut, minRadius, tunnelName }, e.g. tighter bends for hill roads
     buildings     { styles: [names], density 0..1 }           broad character of the buildings (data for later phases)
     district      (optional) { styles: [palette names], floors: [min, max], market: bool }   turns on the built-up road edge (world/district.js): modular buildings, sidewalks, crossings, furniture
     traffic       { mix: { kind: weight }, scale 0..2 }       vehicle mix (kinds: car, van, truck, two-wheeler, auto-rickshaw, bus) and a density multiplier
     population    { density 0..1, archetypes: [names] }       for pedestrians (N13)
     audio         { ambient }                                  the ambient sound profile name
     landmarks     [{ kind, ... }]                              placed by world/landmarks.js; kinds in KNOWN_LANDMARKS
     provenance    { geography: 'hand-authored' | 'procedural' | 'osm', sources: [text], osm: false | { attribution, licence: 'ODbL-1.0' }, elevation?: { dataset, licence, resolutionM, datum, transform } }
   Geography policy: regions are hand-authored or procedural. OpenStreetMap-derived roads or footprints are allowed only with the ODbL attribution recorded here AND after the owner has
   reviewed the share-alike obligations; elevation data only with dataset, licence, resolution, vertical datum and transformation recorded. No Google Maps, Earth or Street View data.
   Deterministic worlds: a world is generated from the config `locationConfig(id, seed)` returns, which holds the region's id and data version (`config.region`), so the same
   region id + version + seed gives the same world and a share code carries the version it was made with (codes from before regions have no `region` key: version 0, legacy).
   Transitions: `regionTransition(fromId, toId)` says how to move between regions (today always a full reload behind the loading screen; 'seamless' is reserved for the connected map). */
import { DEFAULT_CONFIG } from '../core/config.js';
export const REGION_SCHEMA = 1;
export const KNOWN_LANDMARKS = ['gateway', 'tajHotel', 'marine', 'indiaGate', 'tajMahal', 'lighthouse'];
export const VEHICLE_KINDS = ['car', 'van', 'truck', 'two-wheeler', 'auto-rickshaw', 'bus'];
export const ROAD_STYLE_IDS = ['two-lane', 'highway', 'boulevard', 'dirt', 'gravel', 'nh6', 'ghat'];
export const TIME_IDS = ['dawn', 'day', 'dusk', 'night'], WEATHER_IDS = ['clear', 'overcast', 'rain', 'fog', 'storm', 'snow'];
export const DISTRICT_STYLES = { colonial: 1, 'art-deco': 1, modern: 1, mixed: 1, mughal: 1, 'old-city': 1 };         // palette names the district builder knows (district_plan.js PALETTES)
const INDIA = { lat: [6, 36], lon: [68, 98] };

const MUMBAI = {
  schema: 1, id: 'mumbai', version: 2, name: 'Mumbai', blurb: 'the art-deco curve of Marine Drive, the Gateway of India and the Taj Mahal Palace hotel, at golden hour by the Arabian Sea.', accent: '#ff9d5c',
  inspiration: { place: 'Mumbai, Maharashtra', lat: 18.93, lon: 72.83, boundsKm: [20, 20] },
  transform: { anchorLat: 18.93, anchorLon: 72.83, metresPerGameMetre: 1 },
  climate: { time: 'dusk', weather: 'clear' },
  land: { terrain: { seaLevel: 0, lowland: 7, continent: { scale: 3800, rise: 20 }, coast: { lo: -0.3, hi: -0.1 }, warp: { scale: 1000, amp: 150 }, hills: { scale: 520, amp: 9, octaves: 4, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 4200, start: 0.6, full: 0.95, scale: 3400, amp: 120, octaves: 4, gain: 0.4, sharp: 1.5 } }, palette: { grass: [0.56, 0.66, 0.28], grass2: [0.36, 0.52, 0.2], dry: [0.72, 0.64, 0.4], alpine: [0.5, 0.52, 0.34], rock: [0.52, 0.47, 0.4], sand: [0.9, 0.82, 0.62], treeline: 400, snowline: 2500 }, water: { color: '#2a7f8e' } },
  vegetation: { clearRoad: 30, trees: 0.0042, rocks: 0.0003, bushes: 0.0016, tufts: 0.008, pineBias: -0.95, tint: [1, 1.04, 0.78] },
  roads: { style: 'boulevard', maxAlt: 150, drive: 'left', density: 1 },
  district: { styles: ['colonial', 'art-deco', 'colonial', 'mixed'], floors: [3, 7], market: true },
  buildings: { styles: ['colonial', 'art-deco'], density: 0.8 },
  traffic: { mix: { car: 62, 'two-wheeler': 20, 'auto-rickshaw': 14, truck: 4 }, scale: 1 },
  population: { density: 0.9, archetypes: ['commuter', 'vendor', 'tourist'] },
  audio: { ambient: 'coastal-city' },
  landmarks: [{ kind: 'marine', s: 250, off: 40 }, { kind: 'gateway', s: 650, off: 70, sea: true }, { kind: 'tajHotel', after: 'gateway', gap: 130, range: 500, off: 95, sea: true }],
  provenance: { geography: 'hand-authored', sources: ['stylised impression: no map, survey or elevation data used'], osm: false }
};
const DELHI = {
  schema: 1, id: 'delhi', version: 1, name: 'Delhi', blurb: 'India Gate rising over wide lawns, in the warm haze of the plains.', accent: '#e0a070',
  inspiration: { place: 'New Delhi', lat: 28.61, lon: 77.23, boundsKm: [20, 20] },
  transform: { anchorLat: 28.61, anchorLon: 77.23, metresPerGameMetre: 1 },
  climate: { time: 'day', weather: 'clear' },
  land: { terrain: { seaLevel: 0, seabed: -20, lowland: 24, continent: { scale: 6000, rise: 14 }, coast: { lo: -3, hi: -2.5 }, warp: { scale: 1200, amp: 120 }, hills: { scale: 600, amp: 8, octaves: 4, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 4200, start: 0.9, full: 1.4, scale: 3400, amp: 60, octaves: 3, gain: 0.4, sharp: 1.5 } }, palette: { grass: [0.58, 0.64, 0.3], grass2: [0.4, 0.5, 0.22], dry: [0.74, 0.64, 0.4], alpine: [0.55, 0.52, 0.34], rock: [0.56, 0.5, 0.42], sand: [0.88, 0.8, 0.6], treeline: 600, snowline: 3000 }, water: { color: '#4a7f88' } },
  vegetation: { trees: 0.0036, rocks: 0.0002, bushes: 0.0016, tufts: 0.007, pineBias: -0.95, tint: [1, 1, 0.76] },
  roads: { style: 'boulevard', maxAlt: 200, drive: 'left', density: 1 },
  buildings: { styles: ['colonial', 'modern'], density: 0.6 },
  traffic: { mix: { car: 66, 'two-wheeler': 18, 'auto-rickshaw': 10, truck: 6 }, scale: 1 },
  population: { density: 0.7, archetypes: ['commuter', 'vendor', 'tourist'] },
  audio: { ambient: 'plains-city' },
  landmarks: [{ kind: 'indiaGate', s: 500, off: 95 }],
  provenance: { geography: 'hand-authored', sources: ['stylised impression: no map, survey or elevation data used'], osm: false }
};
const AGRA = {
  schema: 1, id: 'agra', version: 1, name: 'Agra', blurb: 'The Taj Mahal at sunrise: white marble, four minarets and a long reflecting pool.', accent: '#f4e9d8',
  inspiration: { place: 'Agra, Uttar Pradesh', lat: 27.18, lon: 78.04, boundsKm: [20, 20] },
  transform: { anchorLat: 27.18, anchorLon: 78.04, metresPerGameMetre: 1 },
  climate: { time: 'dawn', weather: 'clear' },
  land: { terrain: { seaLevel: 0, seabed: -20, lowland: 26, continent: { scale: 6000, rise: 12 }, coast: { lo: -3, hi: -2.5 }, warp: { scale: 1200, amp: 110 }, hills: { scale: 620, amp: 7, octaves: 4, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 4200, start: 0.9, full: 1.4, scale: 3400, amp: 50, octaves: 3, gain: 0.4, sharp: 1.5 } }, palette: { grass: [0.6, 0.64, 0.3], grass2: [0.44, 0.5, 0.22], dry: [0.78, 0.66, 0.42], alpine: [0.56, 0.52, 0.34], rock: [0.58, 0.5, 0.42], sand: [0.9, 0.82, 0.62], treeline: 600, snowline: 3000 }, water: { color: '#5d8f94' } },
  vegetation: { trees: 0.003, rocks: 0.0002, bushes: 0.0014, tufts: 0.006, pineBias: -0.95, tint: [1, 0.98, 0.74] },
  roads: { style: 'boulevard', maxAlt: 200, drive: 'left', density: 1 },
  buildings: { styles: ['mughal', 'modern'], density: 0.4 },
  traffic: { mix: { car: 55, 'two-wheeler': 25, 'auto-rickshaw': 14, truck: 6 }, scale: 0.7 },
  population: { density: 0.6, archetypes: ['tourist', 'vendor', 'commuter'] },
  audio: { ambient: 'plains-town' },
  landmarks: [{ kind: 'tajMahal', s: 600, off: 250 }],
  provenance: { geography: 'hand-authored', sources: ['stylised impression: no map, survey or elevation data used'], osm: false }
};

const BHOPAL = {
  schema: 1, id: 'bhopal', version: 1, name: 'Bhopal', blurb: 'The city of lakes: low green hills, wide still water and the warm light of central India. A test profile for the region format.', accent: '#6fbf9a',
  inspiration: { place: 'Bhopal, Madhya Pradesh', lat: 23.26, lon: 77.41, boundsKm: [20, 20] },
  transform: { anchorLat: 23.26, anchorLon: 77.41, metresPerGameMetre: 1 },
  climate: { time: 'day', weather: 'clear' },
  land: { terrain: { seaLevel: 0, seabed: -14, lowland: 7, continent: { scale: 5200, rise: 12 }, coast: { lo: -1.1, hi: -0.7 }, warp: { scale: 1100, amp: 130 }, hills: { scale: 560, amp: 22, octaves: 4, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 4200, start: 0.8, full: 1.3, scale: 3400, amp: 70, octaves: 3, gain: 0.4, sharp: 1.5 } }, palette: { grass: [0.5, 0.64, 0.28], grass2: [0.34, 0.5, 0.2], dry: [0.74, 0.64, 0.4], alpine: [0.52, 0.52, 0.34], rock: [0.54, 0.48, 0.4], sand: [0.88, 0.8, 0.6], treeline: 600, snowline: 3000 }, water: { color: '#3f8a8c' } },
  vegetation: { trees: 0.0045, rocks: 0.0003, bushes: 0.0018, tufts: 0.009, pineBias: -0.95, tint: [0.98, 1.02, 0.78] },
  roads: { style: 'two-lane', maxAlt: 220, drive: 'left', density: 0.8 },
  buildings: { styles: ['mixed', 'old-city'], density: 0.5 },
  traffic: { mix: { car: 52, 'two-wheeler': 30, 'auto-rickshaw': 12, truck: 6 }, scale: 0.6 },
  population: { density: 0.5, archetypes: ['commuter', 'vendor'] },
  audio: { ambient: 'lake-town' },
  landmarks: [],
  provenance: { geography: 'procedural', sources: ['stylised impression: no map, survey or elevation data used'], osm: false }
};

/* ---- the five Indian worlds that replace the old non-Indian ones (docs/INDIA_MAP_PLAN.md section 5). Terrain recipes come from the old worlds they replace; palettes, plants, roads and traffic are Indian. ---- */
const copy = o => JSON.parse(JSON.stringify(o));
const HIMACHAL = {
  schema: 1, id: 'himachal', version: 1, name: 'Himachal', blurb: 'Deodar and pine valleys under snow peaks, and a narrow ghat road with a stone parapet climbing from Shimla towards Manali and the Atal Tunnel.', accent: '#8fc8ff',
  inspiration: { place: 'Manali, Himachal Pradesh', lat: 32.24, lon: 77.19, boundsKm: [20, 20] },
  transform: { anchorLat: 32.24, anchorLon: 77.19, metresPerGameMetre: 1 },
  climate: { time: 'day', weather: 'clear' },
  land: { terrain: { seaLevel: 470, seabed: 395, lowland: 520, continent: { scale: 6500, rise: 90 }, coast: { lo: -0.52, hi: -0.34 }, warp: { scale: 1400, amp: 260 }, hills: { scale: 1000, amp: 90, octaves: 5, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 3400, start: -0.2, full: 0.2, scale: 6800, amp: 980, octaves: 5, gain: 0.38, sharp: 1.3 } },
    palette: { grass: [0.48, 0.72, 0.28], grass2: [0.26, 0.48, 0.18], dry: [0.6, 0.58, 0.34], alpine: [0.52, 0.54, 0.4], rock: [0.52, 0.5, 0.48], sand: [0.7, 0.66, 0.52], treeline: 520, snowline: 760 }, water: { color: '#2a7a8a' } },
  vegetation: { trees: 0.011, rocks: 0.0007, bushes: 0.0012, tufts: 0.009, pineBias: 0.45, tint: [0.92, 1.02, 0.95] },
  roads: { style: 'ghat', maxAlt: 1500, drive: 'left', density: 0.5, router: { maxGrade: 0.09, hardGrade: 0.11, maxCut: 1000, minRadius: 45, tunnelName: 'ATAL TUNNEL, ROHTANG' } },
  buildings: { styles: ['mixed'], density: 0.2 },
  traffic: { mix: { car: 38, 'two-wheeler': 26, truck: 18, bus: 18 }, scale: 0.5 },
  population: { density: 0.25, archetypes: ['commuter', 'tourist'] },
  audio: { ambient: 'mountain-valley' },
  landmarks: [],
  provenance: { geography: 'procedural', sources: ['stylised impression: no map, survey or elevation data used'], osm: false }
};
const LADAKH = {
  schema: 1, id: 'ladakh', version: 1, name: 'Ladakh', blurb: 'A thin high road through the cold desert: brown ridges, white giants, thin air, trucks and bikers on the way to Leh.', accent: '#e8e4dc',
  inspiration: { place: 'Leh, Ladakh', lat: 34.15, lon: 77.58, boundsKm: [20, 20] },
  transform: { anchorLat: 34.15, anchorLon: 77.58, metresPerGameMetre: 1 },
  climate: { time: 'day', weather: 'clear' },
  land: { terrain: { seaLevel: 0, seabed: 2500, lowland: 3000, continent: { scale: 8000, rise: 200 }, coast: { lo: -3, hi: -2.5 }, warp: { scale: 1800, amp: 320 }, hills: { scale: 1300, amp: 180, octaves: 5, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 4600, start: -0.3, full: 0.15, scale: 11500, amp: 2100, octaves: 5, gain: 0.38, sharp: 1.3 } },
    palette: { grass: [0.52, 0.5, 0.3], grass2: [0.4, 0.42, 0.24], dry: [0.62, 0.54, 0.38], alpine: [0.5, 0.45, 0.36], rock: [0.5, 0.44, 0.38], sand: [0.72, 0.64, 0.5], treeline: 3500, snowline: 3300, arid: 0.45 }, water: { color: '#2f6a78' } },
  vegetation: { trees: 0.0006, rocks: 0.0016, bushes: 0.0008, tufts: 0.004, pineBias: 0.2, tint: [1.05, 0.98, 0.85] },
  roads: { style: 'two-lane', maxAlt: 7500, drive: 'left', density: 0.3, router: { maxGrade: 0.1, hardGrade: 0.11, maxCut: 1000, minRadius: 55 } },
  buildings: { styles: ['mixed'], density: 0.1 },
  traffic: { mix: { car: 22, 'two-wheeler': 32, truck: 36, bus: 10 }, scale: 0.35 },
  population: { density: 0.1, archetypes: ['tourist'] },
  audio: { ambient: 'high-desert' },
  landmarks: [],
  provenance: { geography: 'procedural', sources: ['stylised impression: no map, survey or elevation data used'], osm: false }
};
const RAJASTHAN = {
  schema: 1, id: 'rajasthan', version: 1, name: 'Rajasthan', blurb: 'Dry golden plains and low Aravalli ridges along a wide divided national highway, thorn scrub, dust and trucks, between Jaipur and Jodhpur.', accent: '#f2b84b',
  inspiration: { place: 'Jaipur, Rajasthan', lat: 26.91, lon: 75.79, boundsKm: [20, 20] },
  transform: { anchorLat: 26.91, anchorLon: 75.79, metresPerGameMetre: 1 },
  climate: { time: 'day', weather: 'clear' },
  land: { terrain: { seaLevel: 0, seabed: -14, lowland: 30, continent: { scale: 6000, rise: 20 }, coast: { lo: -1.2, hi: -0.8 }, warp: { scale: 1200, amp: 120 }, hills: { scale: 700, amp: 18, octaves: 4, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 4200, start: 0.6, full: 1.0, scale: 3800, amp: 160, octaves: 4, gain: 0.4, sharp: 1.5 } },
    palette: { grass: [0.95, 0.64, 0.3], grass2: [0.86, 0.56, 0.27], dry: [0.96, 0.72, 0.4], alpine: [0.6, 0.52, 0.36], rock: [0.62, 0.5, 0.4], sand: [0.92, 0.8, 0.56], treeline: 900, snowline: 4000, arid: 0.8 }, water: { color: '#3a7f8a' } },
  vegetation: { trees: 0.0007, rocks: 0.0012, bushes: 0.0035, tufts: 0.003, pineBias: -0.5, tint: [1.15, 0.98, 0.65] },
  roads: { style: 'nh6', maxAlt: 400, drive: 'left', density: 0.7 },
  buildings: { styles: ['mixed', 'old-city'], density: 0.2 },
  traffic: { mix: { car: 36, 'two-wheeler': 20, truck: 32, bus: 12 }, scale: 0.8 },
  population: { density: 0.3, archetypes: ['commuter', 'vendor'] },
  audio: { ambient: 'dry-plains' },
  landmarks: [],
  provenance: { geography: 'procedural', sources: ['stylised impression: no map, survey or elevation data used'], osm: false }
};
const KERALA = {
  schema: 1, id: 'kerala', version: 1, name: 'Kerala', blurb: 'Palm-green flats, bright sand and warm water: a narrow, busy coastal road past backwaters and a lighthouse near Kochi, with auto-rickshaws and scooters everywhere.', accent: '#3ee0b0',
  inspiration: { place: 'Kochi, Kerala', lat: 9.93, lon: 76.27, boundsKm: [20, 20] },
  transform: { anchorLat: 9.93, anchorLon: 76.27, metresPerGameMetre: 1 },
  climate: { time: 'day', weather: 'overcast' },
  land: { terrain: { seaLevel: 0, lowland: 7, continent: { scale: 4200, rise: 28 }, coast: { lo: -0.28, hi: -0.1 }, warp: { scale: 1100, amp: 170 }, hills: { scale: 600, amp: 22, octaves: 4, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 4200, start: 0.3, full: 0.75, scale: 3400, amp: 260, octaves: 5, gain: 0.4, sharp: 1.6 } },
    palette: { grass: [0.42, 0.8, 0.2], grass2: [0.2, 0.58, 0.12], dry: [0.62, 0.62, 0.3], alpine: [0.34, 0.6, 0.22], rock: [0.48, 0.44, 0.4], sand: [0.92, 0.85, 0.66], treeline: 500, snowline: 2000 }, water: { color: '#1f93a0' } },
  vegetation: { trees: 0.017, rocks: 0.0003, bushes: 0.003, tufts: 0.012, pineBias: -0.95, tint: [0.88, 1.12, 0.78] },
  roads: { style: 'two-lane', maxAlt: 150, drive: 'left', density: 0.9 },
  buildings: { styles: ['mixed'], density: 0.5 },
  traffic: { mix: { car: 30, 'two-wheeler': 38, 'auto-rickshaw': 16, bus: 10, truck: 6 }, scale: 0.9 },
  population: { density: 0.6, archetypes: ['commuter', 'vendor'] },
  audio: { ambient: 'coastal-town' },
  landmarks: [{ kind: 'lighthouse', s: 700, off: 80, sea: true, range: 3000 }],
  provenance: { geography: 'procedural', sources: ['stylised impression: no map, survey or elevation data used'], osm: false }
};
const DECCAN = {
  schema: 1, id: 'deccan', version: 1, name: 'Deccan Plateau', blurb: 'Rolling green hills, teak and banyan, farm fields and a lake or two: the six-lane expressway from Mumbai climbs onto the plateau towards Pune.', accent: '#7fd46a',
  inspiration: { place: 'Pune, Maharashtra', lat: 18.52, lon: 73.86, boundsKm: [20, 20] },
  transform: { anchorLat: 18.52, anchorLon: 73.86, metresPerGameMetre: 1 },
  climate: { time: 'day', weather: 'clear' },
  land: { terrain: copy(DEFAULT_CONFIG.terrain), palette: copy({ ...DEFAULT_CONFIG.palette }), water: { color: '#2f7f86' } },
  vegetation: { trees: 0.0048, rocks: 0.0005, bushes: 0.0014, tufts: 0.02, pineBias: -0.4, tint: [1.05, 1.0, 0.8], clearRoad: 17 },
  roads: { style: 'nh6', maxAlt: 190, drive: 'left', density: 0.8 },
  buildings: { styles: ['mixed'], density: 0.3 },
  traffic: { mix: { car: 44, truck: 26, 'two-wheeler': 20, bus: 10 }, scale: 0.8 },
  population: { density: 0.3, archetypes: ['commuter', 'vendor'] },
  audio: { ambient: 'open-country' },
  landmarks: [],
  provenance: { geography: 'procedural', sources: ['stylised impression: no map, survey or elevation data used'], osm: false }
};

export const REGIONS = [MUMBAI, DELHI, AGRA, BHOPAL, HIMACHAL, LADAKH, RAJASTHAN, KERALA, DECCAN];
export const regionById = id => REGIONS.find(r => r.id === id) || null;

/* ---------- validation ---------- */
const isNum = v => typeof v === 'number' && Number.isFinite(v), isStr = v => typeof v === 'string' && v.length > 0, isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const in01 = v => isNum(v) && v >= 0 && v <= 1;
/* returns a list of problems (empty = valid); never throws */
export function validateRegion(r) {
  const e = [], need = (cond, msg) => { if (!cond) e.push(msg); };
  if (!isObj(r)) return ['region is not an object'];
  need(r.schema === REGION_SCHEMA, 'schema must be ' + REGION_SCHEMA + ' (got ' + r.schema + ')');
  need(isStr(r.id) && /^[a-z][a-z0-9-]*$/.test(r.id), 'id must be lower-case words'); need(Number.isInteger(r.version) && r.version >= 1, 'version must be an integer >= 1');
  need(isStr(r.name) && isStr(r.blurb) && /^#[0-9a-fA-F]{6}$/.test(r.accent || ''), 'name, blurb and a #rrggbb accent are required');
  const ins = r.inspiration; need(isObj(ins) && isStr(ins.place) && isNum(ins.lat) && isNum(ins.lon) && Array.isArray(ins.boundsKm) && ins.boundsKm.length === 2 && ins.boundsKm.every(v => isNum(v) && v > 0), 'inspiration needs place, lat, lon, boundsKm [w, h]');
  if (isObj(ins) && isNum(ins.lat) && isNum(ins.lon)) need(ins.lat >= INDIA.lat[0] && ins.lat <= INDIA.lat[1] && ins.lon >= INDIA.lon[0] && ins.lon <= INDIA.lon[1], 'inspiration is outside India (lat 6..36, lon 68..98)');
  const tr = r.transform; need(isObj(tr) && isNum(tr.anchorLat) && isNum(tr.anchorLon) && isNum(tr.metresPerGameMetre) && tr.metresPerGameMetre > 0, 'transform needs anchorLat, anchorLon, metresPerGameMetre > 0');
  const cl = r.climate; need(isObj(cl) && TIME_IDS.includes(cl.time) && WEATHER_IDS.includes(cl.weather), 'climate needs a known time and weather');
  const la = r.land; need(isObj(la) && isObj(la.terrain) && isObj(la.palette) && isObj(la.water), 'land needs terrain, palette and water');
  if (isObj(la) && isObj(la.terrain)) { const t = la.terrain; need(isNum(t.seaLevel) && isNum(t.lowland) && isObj(t.continent) && isNum(t.continent.scale) && t.continent.scale > 100 && isObj(t.coast) && isNum(t.coast.lo) && isNum(t.coast.hi) && t.coast.hi > t.coast.lo, 'terrain: seaLevel, lowland, continent.scale, coast.lo < coast.hi are required'); }
  if (isObj(la) && isObj(la.palette)) for (const k of ['grass', 'grass2', 'dry', 'alpine', 'rock', 'sand']) need(Array.isArray(la.palette[k]) && la.palette[k].length === 3 && la.palette[k].every(in01), 'palette.' + k + ' must be three numbers 0..1');
  if (isObj(la) && isObj(la.water)) need(/^#[0-9a-fA-F]{6}$/.test(la.water.color || ''), 'water.color must be #rrggbb');
  const v = r.vegetation; need(isObj(v) && ['trees', 'rocks', 'bushes', 'tufts'].every(k => isNum(v[k]) && v[k] >= 0 && v[k] < 0.1) && Array.isArray(v.tint) && v.tint.length === 3, 'vegetation needs trees, rocks, bushes, tufts (0..0.1) and a 3-number tint');
  const ro = r.roads; need(isObj(ro) && ROAD_STYLE_IDS.includes(ro.style) && isNum(ro.maxAlt) && ro.maxAlt > 0 && (ro.drive === 'left' || ro.drive === 'right') && in01(ro.density), 'roads needs a known style, maxAlt, drive left|right and density 0..1');
  if (isObj(ro) && ro.router !== undefined) need(isObj(ro.router) && Object.entries(ro.router).every(([k, x]) => ['maxGrade', 'hardGrade', 'maxCut', 'minRadius'].includes(k) ? isNum(x) && x > 0 : k === 'tunnelName' && isStr(x)), 'roads.router may hold maxGrade, hardGrade, maxCut, minRadius (numbers above 0) and tunnelName (text)');
  if (r.district !== undefined) { const di = r.district; need(isObj(di) && Array.isArray(di.styles) && di.styles.length > 0 && di.styles.every(x => isStr(x) && Object.prototype.hasOwnProperty.call(DISTRICT_STYLES, x)) && Array.isArray(di.floors) && di.floors.length === 2 && di.floors.every(Number.isInteger) && di.floors[0] >= 1 && di.floors[1] >= di.floors[0] && di.floors[1] <= 12 && typeof di.market === 'boolean', 'district needs known styles, floors [min, max] (1..12) and market true|false'); }
  const bu = r.buildings; need(isObj(bu) && Array.isArray(bu.styles) && bu.styles.length > 0 && bu.styles.every(isStr) && in01(bu.density), 'buildings needs styles and density 0..1');
  const tf = r.traffic; need(isObj(tf) && isObj(tf.mix) && isNum(tf.scale) && tf.scale >= 0 && tf.scale <= 2, 'traffic needs mix and scale 0..2');
  if (isObj(tf) && isObj(tf.mix)) { const ks = Object.keys(tf.mix); need(ks.length > 0 && ks.every(k => VEHICLE_KINDS.includes(k) && isNum(tf.mix[k]) && tf.mix[k] >= 0) && ks.reduce((a, k) => a + tf.mix[k], 0) > 0, 'traffic.mix: known vehicle kinds with weights, total above 0'); }
  const po = r.population; need(isObj(po) && in01(po.density) && Array.isArray(po.archetypes) && po.archetypes.every(isStr), 'population needs density 0..1 and archetypes');
  need(isObj(r.audio) && isStr(r.audio.ambient), 'audio.ambient is required');
  need(Array.isArray(r.landmarks) && r.landmarks.every(l => isObj(l) && KNOWN_LANDMARKS.includes(l.kind)), 'landmarks must be a list of known kinds (' + KNOWN_LANDMARKS.join(', ') + ')');
  const pv = r.provenance; need(isObj(pv) && ['hand-authored', 'procedural', 'osm'].includes(pv.geography) && Array.isArray(pv.sources) && pv.sources.length > 0, 'provenance needs geography (hand-authored, procedural or osm) and sources');
  if (isObj(pv)) {
    if (pv.geography === 'osm' || pv.osm) need(isObj(pv.osm) && isStr(pv.osm.attribution) && pv.osm.licence === 'ODbL-1.0', 'OpenStreetMap data needs osm.attribution and osm.licence ODbL-1.0 (and an owner review of share-alike)');
    if (pv.elevation !== undefined) need(isObj(pv.elevation) && ['dataset', 'licence', 'datum', 'transform'].every(k => isStr(pv.elevation[k])) && isNum(pv.elevation.resolutionM) && pv.elevation.resolutionM > 0, 'elevation needs dataset, licence, resolutionM, datum and transform');
  }
  return e;
}

/* an older record is brought to the current schema (none older exists yet; this is where each future change gets its step) */
export function migrateRegion(r) { if (isObj(r) && r.schema === REGION_SCHEMA) return r; throw new Error('no migration from region schema ' + (r && r.schema)); }

/* the entry the location picker and `locationConfig` use, built from a region: the same code path for every region */
export function regionToLocation(r) {
  const p = validateRegion(r); if (p.length) throw new Error('region ' + (r && r.id) + ' is not valid: ' + p.join('; '));
  return { id: r.id, name: r.name, blurb: r.blurb, accent: r.accent, drive: r.roads.drive, region: r,
    config: { terrain: r.land.terrain, palette: r.land.palette, scatter: r.vegetation, water: r.land.water, road: { style: r.roads.style, maxAlt: r.roads.maxAlt, ...(r.roads.router || {}) }, region: { id: r.id, version: r.version } },
    sky: { time: r.climate.time, weather: r.climate.weather }, landmarks: r.landmarks };
}

/* how to get from one region to another: always a full rebuild behind the loading screen for now */
export function regionTransition(fromId, toId) {
  if (!regionById(toId)) return null; return { from: fromId, to: toId, kind: fromId === toId ? 'none' : 'reload', loadingScreen: fromId !== toId };
}

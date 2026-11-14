/* Locations: named sets of world-config overrides (land shape, colours, plants, water, road) plus the sky the place starts with.
   Picking one regenerates the world from the same seed with these numbers laid over DEFAULT_CONFIG. They are stylised impressions of a
   place (its land, light and plants), not maps. `landmarks` (city sights) come in a later step.
     id, name, blurb     shown in the location picker
     drive               'left' where traffic keeps to the left (India); otherwise right
     config              overrides for makeConfig(): terrain, palette, scatter, road, water
     sky                 { time, weather } the place starts with
     accent              a colour for its card */
import { makeConfig } from '../core/config.js';

export const LOCATIONS = [
  { id: 'default', name: 'Green Valley', blurb: 'Rolling hills, forests and a lake or two. The original world.', accent: '#7fd46a', config: { scatter: { trees: 0.0034, tufts: 0.024, bushes: 0.0012, clearRoad: 17 } }, sky: { time: 'day', weather: 'clear' } },

  { id: 'alps', name: 'The Alps', blurb: 'Pine valleys, blue lakes and snow-capped peaks. Cool, clear and high.', accent: '#8fc8ff',
    config: {
      terrain: { seaLevel: 470, seabed: 395, lowland: 520, continent: { scale: 6500, rise: 90 }, coast: { lo: -0.52, hi: -0.34 }, warp: { scale: 1400, amp: 260 },
        hills: { scale: 1000, amp: 90, octaves: 5, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 3400, start: -0.2, full: 0.2, scale: 6800, amp: 980, octaves: 5, gain: 0.38, sharp: 1.3 } },
      palette: { grass: [0.48, 0.72, 0.28], grass2: [0.26, 0.48, 0.18], dry: [0.6, 0.58, 0.34], alpine: [0.52, 0.54, 0.4], rock: [0.52, 0.5, 0.48], treeline: 520, snowline: 760 },
      scatter: { trees: 0.011, rocks: 0.0007, pineBias: 0.35, tint: [0.92, 1.02, 0.95] }, water: { color: '#1c5f86' },
      road: { maxAlt: 1500, maxGrade: 0.09, hardGrade: 0.11, maxCut: 1000 } },
    sky: { time: 'day', weather: 'clear' } },

  { id: 'himalayas', name: 'The Himalayas', blurb: 'A thin high road between brown ridges and white giants. Sparse pines, thin air.', accent: '#e8e4dc',
    config: {
      terrain: { seaLevel: 0, seabed: 2500, lowland: 3000, continent: { scale: 8000, rise: 200 }, coast: { lo: -3, hi: -2.5 }, warp: { scale: 1800, amp: 320 },
        hills: { scale: 1300, amp: 180, octaves: 5, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 4600, start: -0.3, full: 0.15, scale: 11500, amp: 2100, octaves: 5, gain: 0.38, sharp: 1.3 } },
      palette: { grass: [0.52, 0.5, 0.3], grass2: [0.4, 0.42, 0.24], dry: [0.6, 0.52, 0.36], alpine: [0.5, 0.45, 0.36], rock: [0.5, 0.44, 0.38], treeline: 3500, snowline: 3300 },
      scatter: { trees: 0.003, rocks: 0.0016, bushes: 0.0008, tufts: 0.004, pineBias: 0.6, tint: [0.85, 0.95, 0.85] }, water: { color: '#2f6a78' },
      road: { maxAlt: 7500, maxGrade: 0.1, hardGrade: 0.11, maxCut: 1000, minRadius: 55, tunnelName: 'ATAL TUNNEL, ROHTANG' } },
    sky: { time: 'day', weather: 'snow' } },

  { id: 'california', name: 'California Coast', blurb: 'Golden hills tumbling to a deep blue Pacific. Sun, sea air and wide skies.', accent: '#ffc857',
    config: {
      terrain: { seaLevel: 0, lowland: 28, continent: { scale: 5200, rise: 60 }, coast: { lo: -0.3, hi: -0.12 }, warp: { scale: 1300, amp: 230 },
        hills: { scale: 760, amp: 85, octaves: 5, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 3800, start: 0.1, full: 0.5, scale: 4000, amp: 380, octaves: 5, gain: 0.4, sharp: 1.6 } },
      palette: { grass: [0.8, 0.72, 0.36], grass2: [0.58, 0.54, 0.26], dry: [0.78, 0.66, 0.4], alpine: [0.6, 0.55, 0.38], rock: [0.58, 0.52, 0.44], sand: [0.9, 0.82, 0.62], treeline: 420, snowline: 900 },
      scatter: { trees: 0.0028, rocks: 0.0008, bushes: 0.0018, tufts: 0.012, pineBias: -0.1, tint: [1.12, 1.0, 0.7] }, water: { color: '#1a6a8e' }, road: { style: 'highway' } },
    sky: { time: 'day', weather: 'clear' } },

  { id: 'south', name: 'Southern Coast', blurb: 'Palm-green flats, bright sand and warm turquoise water. Lush and humid.', accent: '#3ee0b0',
    config: {
      terrain: { seaLevel: 0, lowland: 7, continent: { scale: 4200, rise: 28 }, coast: { lo: -0.28, hi: -0.1 }, warp: { scale: 1100, amp: 170 },
        hills: { scale: 600, amp: 22, octaves: 4, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 4200, start: 0.3, full: 0.75, scale: 3400, amp: 260, octaves: 5, gain: 0.4, sharp: 1.6 } },
      palette: { grass: [0.42, 0.8, 0.2], grass2: [0.2, 0.58, 0.12], dry: [0.62, 0.62, 0.3], alpine: [0.34, 0.6, 0.22], rock: [0.48, 0.44, 0.4], sand: [0.92, 0.85, 0.66], treeline: 500, snowline: 2000 },
      scatter: { trees: 0.017, rocks: 0.0003, bushes: 0.003, tufts: 0.012, pineBias: -0.95, tint: [0.88, 1.12, 0.78] }, water: { color: '#1f93a0' },
      road: { maxAlt: 150 } },
    landmarks: [{ kind: 'lighthouse', s: 700, off: 80, sea: true, range: 3000 }],
    sky: { time: 'day', weather: 'clear' } },
  /* ---- India's cities: flat ground, warm dry light, and the sights beside the road. `landmarks` are placed by world/landmarks.js ---- */
  { id: 'mumbai', drive: 'left', name: 'Mumbai', blurb: 'the art-deco curve of Marine Drive, the Gateway of India and the Taj Mahal Palace hotel, at golden hour by the Arabian Sea.', accent: '#ff9d5c',
    config: {
      terrain: { seaLevel: 0, lowland: 7, continent: { scale: 3800, rise: 20 }, coast: { lo: -0.3, hi: -0.1 }, warp: { scale: 1000, amp: 150 },
        hills: { scale: 520, amp: 9, octaves: 4, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 4200, start: 0.6, full: 0.95, scale: 3400, amp: 120, octaves: 4, gain: 0.4, sharp: 1.5 } },
      palette: { grass: [0.56, 0.66, 0.28], grass2: [0.36, 0.52, 0.2], dry: [0.72, 0.64, 0.4], alpine: [0.5, 0.52, 0.34], rock: [0.52, 0.47, 0.4], sand: [0.9, 0.82, 0.62], treeline: 400, snowline: 2500 },
      scatter: { trees: 0.0042, rocks: 0.0003, bushes: 0.0016, tufts: 0.008, pineBias: -0.95, tint: [1.0, 1.04, 0.78] }, water: { color: '#2a7f8e' }, road: { style: 'boulevard', maxAlt: 150 } },
    sky: { time: 'dusk', weather: 'clear' },
    landmarks: [{ kind: 'marine', s: 250, off: 40 }, { kind: 'gateway', s: 650, off: 70, sea: true }, { kind: 'tajHotel', after: 'gateway', gap: 130, range: 500, off: 95, sea: true }] },

  { id: 'delhi', drive: 'left', name: 'Delhi', blurb: 'India Gate rising over wide lawns, in the warm haze of the plains.', accent: '#e0a070',
    config: {
      terrain: { seaLevel: 0, seabed: -20, lowland: 24, continent: { scale: 6000, rise: 14 }, coast: { lo: -3, hi: -2.5 }, warp: { scale: 1200, amp: 120 },
        hills: { scale: 600, amp: 8, octaves: 4, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 4200, start: 0.9, full: 1.4, scale: 3400, amp: 60, octaves: 3, gain: 0.4, sharp: 1.5 } },
      palette: { grass: [0.58, 0.64, 0.3], grass2: [0.4, 0.5, 0.22], dry: [0.74, 0.64, 0.4], alpine: [0.55, 0.52, 0.34], rock: [0.56, 0.5, 0.42], sand: [0.88, 0.8, 0.6], treeline: 600, snowline: 3000 },
      scatter: { trees: 0.0036, rocks: 0.0002, bushes: 0.0016, tufts: 0.007, pineBias: -0.95, tint: [1.0, 1.0, 0.76] }, water: { color: '#4a7f88' }, road: { style: 'boulevard', maxAlt: 200 } },
    sky: { time: 'day', weather: 'clear' },
    landmarks: [{ kind: 'indiaGate', s: 500, off: 95 }] },

  { id: 'agra', drive: 'left', name: 'Agra', blurb: 'The Taj Mahal at sunrise: white marble, four minarets and a long reflecting pool.', accent: '#f4e9d8',
    config: {
      terrain: { seaLevel: 0, seabed: -20, lowland: 26, continent: { scale: 6000, rise: 12 }, coast: { lo: -3, hi: -2.5 }, warp: { scale: 1200, amp: 110 },
        hills: { scale: 620, amp: 7, octaves: 4, lacunarity: 2.05, gain: 0.5 }, mountains: { maskScale: 4200, start: 0.9, full: 1.4, scale: 3400, amp: 50, octaves: 3, gain: 0.4, sharp: 1.5 } },
      palette: { grass: [0.6, 0.64, 0.3], grass2: [0.44, 0.5, 0.22], dry: [0.78, 0.66, 0.42], alpine: [0.56, 0.52, 0.34], rock: [0.58, 0.5, 0.42], sand: [0.9, 0.82, 0.62], treeline: 600, snowline: 3000 },
      scatter: { trees: 0.003, rocks: 0.0002, bushes: 0.0014, tufts: 0.006, pineBias: -0.95, tint: [1.0, 0.98, 0.74] }, water: { color: '#5d8f94' }, road: { style: 'boulevard', maxAlt: 200 } },
    sky: { time: 'dawn', weather: 'clear' },
    landmarks: [{ kind: 'tajMahal', s: 600, off: 250 }] }
];

export const locationById = id => LOCATIONS.find(l => l.id === id) || LOCATIONS[0];
/* the full world config for a location and seed */
export const locationConfig = (id, seed) => makeConfig({ ...locationById(id).config, seed, location: locationById(id).id });

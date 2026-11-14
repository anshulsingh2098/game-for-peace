/* Road styles: pure data (no three.js), so the mesh (road.js), the grading (router.js), the surface lookup (terrain.js)
   and the scenery clearing (scatter.js) all read the same widths. Choose one with config.road.style.

   A style is a cross-section, offsets in metres from the centre line, positive to the right of travel:
     cols      [offset, height BELOW the crown (negative = raised), colour kind, texture u]
     strips    pairs of column indices joined into surface (a pair left out is a gap)
     lines     paint: { t: offset, w: width, dash?: [dash, gap] }
     colour    kind -> [r, g, b] (multiplied by the road texture)
     surfaces  [distance from centre, key of SURFACES in vehicle/physics.js]: what wheels feel out to that distance
     shoulder  where the lift that raises the drive surface back to the road ends (see Road.drive)
   and derived below: outer, grade { flat, blend, lift: [a, b] }, clear (metres kept clear of scenery). */

/* build a symmetric style from its right half (first column at the centre line); `joins[i]` joins column i to i+1 */
function symmetric(right, joins) {
  const left = right.slice(1).reverse().map(([t, d, k, u]) => [-t, d, k, 1 - u]);
  const cols = [...left, ...right], n = left.length, strips = [];
  for (let i = 0; i < joins.length; i++) if (joins[i]) {
    strips.push([n + i, n + i + 1]);                                  // right side
    strips.push([n - i - 1, n - i]);                                  // mirrored left side
  }
  return { cols, strips };
}

function finish(s) {
  s.outer = Math.max(...s.cols.map(c => Math.abs(c[0])));
  const flat = s.outer + 2.1;                                         // two-lane: 9, 46, 10 (the numbers this was tuned with)
  s.grade = { flat, blend: flat + 37, lift: [s.shoulder, s.shoulder + 1.6] };
  s.clear = s.outer + 3.1;
  return s;
}

export const TWO_LANE = finish({
  id: 'two-lane', name: 'Two-lane road', half: 4, shoulder: 5.4,
  cols: [[-6.9, 0.75, 'gravel', 0], [-5.4, 0.06, 'gravel', 0], [-4, 0.02, 'gravel', 0.13], [-4, 0, 'asphalt', 0.13], [4, 0, 'asphalt', 0.87], [4, 0.02, 'gravel', 0.87], [5.4, 0.06, 'gravel', 1], [6.9, 0.75, 'gravel', 1]],
  strips: [[0, 1], [1, 2], [3, 4], [5, 6], [6, 7]],
  lines: [{ t: 0, w: 0.16, dash: [6, 6] }, { t: -3.6, w: 0.16 }, { t: 3.6, w: 0.16 }],
  colour: { asphalt: [0.78, 0.78, 0.80], gravel: [0.74, 0.70, 0.60], line: [0.88, 0.86, 0.78] },
  surfaces: [[4.05, 'asphalt'], [5.7, 'gravel']]
});

/* two lanes each way, a painted double line in the middle and a paved shoulder */
export const HIGHWAY = finish({
  id: 'highway', name: 'Highway', half: 9, shoulder: 10.4,
  ...symmetric([[0, 0, 'asphalt', 0.5], [9, 0, 'asphalt', 0.87], [9, 0.02, 'gravel', 0.87], [10.4, 0.06, 'gravel', 1], [12.4, 0.75, 'gravel', 1]], [true, false, true, true]),
  lines: [{ t: -0.2, w: 0.16 }, { t: 0.2, w: 0.16 }, { t: -3.75, w: 0.16, dash: [5, 9] }, { t: 3.75, w: 0.16, dash: [5, 9] }, { t: -7.5, w: 0.2 }, { t: 7.5, w: 0.2 }],
  colour: { asphalt: [0.66, 0.66, 0.69], gravel: [0.72, 0.69, 0.60], line: [0.9, 0.88, 0.8] },
  surfaces: [[9.05, 'asphalt'], [10.7, 'gravel']]
});

/* a city street: two lanes each way, a flush median, kerbs and pavements */
export const BOULEVARD = finish({
  id: 'boulevard', name: 'Boulevard', half: 8, shoulder: 11.6,
  ...symmetric([[0, 0, 'median', 0.3], [1.2, 0, 'median', 0.7], [1.2, 0, 'asphalt', 0.2], [8, 0, 'asphalt', 0.8], [8, -0.14, 'kerb', 0.8], [8.3, -0.14, 'kerb', 0.8], [11.5, -0.14, 'pave', 0.5], [11.5, 0.5, 'gravel', 1], [13.5, 0.9, 'gravel', 1]],
    [true, false, true, true, true, true, true, true]),
  lines: [{ t: -1.45, w: 0.14 }, { t: 1.45, w: 0.14 }, { t: -4.7, w: 0.14, dash: [4, 6] }, { t: 4.7, w: 0.14, dash: [4, 6] }, { t: -7.6, w: 0.16 }, { t: 7.6, w: 0.16 }],
  colour: { asphalt: [0.62, 0.62, 0.65], median: [0.5, 0.62, 0.46], kerb: [0.86, 0.85, 0.82], pave: [0.78, 0.74, 0.68], gravel: [0.7, 0.66, 0.56], line: [0.9, 0.9, 0.84] },
  surfaces: [[11.6, 'asphalt']]
});

/* a narrow dirt track with two worn ruts and a grassy middle */
export const DIRT = finish({
  id: 'dirt', name: 'Dirt trail', half: 2.6, shoulder: 3.4,
  ...symmetric([[0, 0, 'mid', 0.3], [0.9, 0.06, 'rut', 0.42], [1.8, 0, 'dirt', 0.58], [2.6, 0.04, 'dirt', 0.75], [3.4, 0.1, 'verge', 1], [5, 0.7, 'verge', 1]], [true, true, true, true, true]),
  lines: [],
  colour: { dirt: [0.62, 0.46, 0.3], mid: [0.5, 0.5, 0.3], rut: [0.4, 0.3, 0.2], verge: [0.46, 0.5, 0.26] },
  surfaces: [[2.8, 'gravel'], [3.6, 'grass']]
});

/* a rally gravel stage: loose pale surface, darker driven lines, berms either side */
export const GRAVEL = finish({
  id: 'gravel', name: 'Gravel stage', half: 3.8, shoulder: 5,
  ...symmetric([[0, 0, 'mid', 0.3], [1, 0.04, 'rut', 0.42], [2, 0, 'loose', 0.55], [3.8, 0.05, 'loose', 0.75], [4.3, -0.3, 'berm', 0.9], [5, 0.1, 'berm', 1], [6, 0.9, 'verge', 1]], [true, true, true, true, true, true]),
  lines: [],
  colour: { loose: [0.86, 0.82, 0.74], mid: [0.8, 0.76, 0.68], rut: [0.62, 0.58, 0.5], berm: [0.8, 0.76, 0.66], verge: [0.5, 0.52, 0.3] },
  surfaces: [[5.2, 'gravel']]
});

export const ROAD_STYLES = { 'two-lane': TWO_LANE, highway: HIGHWAY, boulevard: BOULEVARD, dirt: DIRT, gravel: GRAVEL };
export const roadStyleById = id => ROAD_STYLES[id] || TWO_LANE;

/* the physics key (a SURFACES key) for a point `d` metres from the centre line, or null beyond the road */
export function roadSurfaceAt(style, d) {
  for (const [dist, key] of style.surfaces) if (d < dist) return key;
  return null;
}

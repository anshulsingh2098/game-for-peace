/* Connaught Place measured from the Delhi pack: node tools/measure_cp.mjs [radius m]. Lists the named streets around the centre, fits a circle to the points of the Inner and Outer Circle (centre, radius, RMS and worst error in metres, point spacing), and counts the buildings by height inside the outer ring. Output goes to the CP match log (docs/CP_MATCH_LOG.md). */
import { readFileSync, existsSync } from 'node:fs';
import { decodeGraphColumns, decodeTile, pieceWidth } from '../src/world/city/pack.js';
const R = new URL('../assets/cities/delhi/', import.meta.url).pathname, G = decodeGraphColumns(JSON.parse(readFileSync(R + 'graph.json', 'utf8'))), M = JSON.parse(readFileSync(R + 'manifest.json'));
const C = [1045.4, -2102.2], RAD = +process.argv[2] || 520;
const nameOf = id => { const n = G.names[G.name[id]]; return n ? (typeof n === 'string' ? n : n.en || n.ref || '') : ''; };
const streets = new Map(), blds = [];
for (let tx = Math.floor((C[0] - RAD) / 1000); tx <= Math.floor((C[0] + RAD) / 1000); tx++) for (let tz = Math.floor((C[1] - RAD) / 1000); tz <= Math.floor((C[1] + RAD) / 1000); tz++) {
  const f = R + 'tiles/' + tx + '_' + tz + '.json'; if (!existsSync(f)) continue; const t = decodeTile(JSON.parse(readFileSync(f, 'utf8')), M.tileSize);
  for (const s of t.streets) { const p = s.pts; let near = false; for (let i = 0; i < p.length; i += 2) if (Math.hypot(p[i] - C[0], p[i + 1] - C[1]) < RAD) { near = true; break; } if (near) streets.set(s.id + '@' + tx + '_' + tz, { id: s.id, pts: p, name: nameOf(s.id), cls: G.classes[G.cls[s.id]], w: Math.round(pieceWidth(G, s)) }); }
  for (const b of t.buildings) { const r = b.ring; let cx = 0, cz = 0; for (let i = 0; i < r.length; i += 2) { cx += r[i]; cz += r[i + 1]; } cx /= r.length / 2; cz /= r.length / 2; if (Math.hypot(cx - C[0], cz - C[1]) < RAD) blds.push({ h: b.height || (b.levels ? b.levels * 3.2 : null), lv: b.levels, use: b.use, id: b.id, r: Math.hypot(cx - C[0], cz - C[1]), area: Math.abs(r.reduce((a, _, i) => i % 2 ? a : a + r[i] * r[(i + 3) % r.length] - r[(i + 2) % r.length] * r[i + 1], 0)) / 2 }); }
}
const byName = {}; for (const s of streets.values()) { const k = s.name || '(no name)'; (byName[k] = byName[k] || { n: 0, cls: new Set(), w: new Set() }).n++; byName[k].cls.add(s.cls); byName[k].w.add(s.w); }
console.log('NAMED STREETS within', RAD, 'm of the centre'); for (const [k, v] of Object.entries(byName).sort((a, b) => b[1].n - a[1].n).slice(0, 30)) console.log('  ', k, 'pieces', v.n, [...v.cls].join('/'), 'width', [...v.w].join(','));
function fit(P) { /* algebraic (Kasa) least squares circle fit */
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0; const n = P.length; for (const [x, y] of P) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sz += z; sxz += x * z; syz += y * z; }
  const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], b = [sxz, syz, sz], det3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]), d = det3(A), rep = (c, v) => A.map((row, i) => row.map((x, j) => j === c ? v[i] : x)), a = det3(rep(0, b)) / d, bb = det3(rep(1, b)) / d, c = det3(rep(2, b)) / d, cx = a / 2, cy = bb / 2, r = Math.sqrt(c + cx * cx + cy * cy);
  const e = P.map(([x, y]) => Math.hypot(x - cx, y - cy) - r); return { cx, cz: cy, r, rms: Math.sqrt(e.reduce((q, v) => q + v * v, 0) / n), worst: Math.max(...e.map(Math.abs)), n };
}
for (const want of ['Inner Circle', 'Outer Circle']) {
  const P = [], seg = []; for (const s of streets.values()) if (s.name === want) for (let i = 0; i < s.pts.length; i += 2) { P.push([s.pts[i], s.pts[i + 1]]); if (i) seg.push(Math.hypot(s.pts[i] - s.pts[i - 2], s.pts[i + 1] - s.pts[i - 1])); }
  if (P.length < 8) { console.log(want, ': only', P.length, 'points'); continue; } const f = fit(P); seg.sort((a, b) => a - b);
  console.log(`${want}: ${f.n} points, centre (${f.cx.toFixed(1)}, ${f.cz.toFixed(1)}), radius ${f.r.toFixed(1)} m, RMS error ${f.rms.toFixed(2)} m, worst ${f.worst.toFixed(2)} m; segment length median ${seg[seg.length >> 1].toFixed(1)} m, longest ${seg[seg.length - 1].toFixed(1)} m, angular step median ${(seg[seg.length >> 1] / f.r * 180 / Math.PI).toFixed(1)} deg`);
}
const inCP = blds.filter(b => b.r < 330), hs = inCP.map(b => b.h).filter(Boolean).sort((a, b) => a - b), use = {}; for (const b of inCP) use[b.use] = (use[b.use] || 0) + 1;
console.log(`BUILDINGS within 330 m: ${inCP.length}; with a height ${hs.length}; height min ${hs[0]} median ${hs[hs.length >> 1]} max ${hs[hs.length - 1]}; by use ${JSON.stringify(use)}`);
const big = inCP.filter(b => b.area > 400).sort((a, b) => b.area - a.area).slice(0, 16); console.log('largest footprints (area m2, radius from centre, levels, height):'); for (const b of big) console.log('  ', Math.round(b.area), Math.round(b.r), b.lv, b.h, b.use);
/* the radial roads: the angle (degrees, game x/z plane, 0 = +x) at which each one leaves the Inner Circle (first point beyond 135 m from the fitted centre) */
{ const out = {}; for (const s of streets.values()) if (/^Radial Road/.test(s.name)) for (let i = 0; i < s.pts.length; i += 2) { const dx = s.pts[i] - 1044.2, dz = s.pts[i + 1] + 2100.4, d = Math.hypot(dx, dz); if (d > 135 && d < 190) { (out[s.name] = out[s.name] || []).push(Math.round(Math.atan2(dz, dx) * 180 / Math.PI)); break; } }
  console.log('RADIAL ROAD angles at about 135-190 m:', JSON.stringify(out)); }

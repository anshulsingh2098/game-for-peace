/* Smooth circles (CP match, docs/CP_MATCH_PLAN.md "Roads"): the map draws Connaught Place's circles as straight chords (the Inner Circle: 18 m segments, 8 degrees a step), which look faceted and make the car turn in steps. Applied to each tile's streets after decoding, so the road mesh, kerbs, collision, traffic, the route line and autodrive all see the same smooth line.
   The first and the last point of every piece stay exactly where they are (the graph's nodes and the cuts at tile edges do not move). The Inner Circle is a true circle in the real plan: its points are re-laid on the fitted circle (centre 1044.2, -2100.4, radius 125.7 m, RMS 0.96 m, tools/measure_cp.mjs) every 2.5 degrees, with the radius blended back to the original over the first and last 25 m of a piece. The Middle and Outer Circles fit worse (Outer: RMS 3.4 m, worst 10 m), so they are smoothed by corner cutting (Chaikin) through their own points instead of being forced onto a circle. */
export const CP_CIRCLE = { cx: 1044.2, cz: -2100.4, R: 125.7, STEP: 2.5 * Math.PI / 180, BLEND: 25, PLAZA_R: 345 };
/* carriageway widths of the CP circles (m): the pack has 9 and 13 (guessed from lane counts); the owner's GTA frames show roads of 4 to 6 lanes and CP's circles carry several lanes each way, so they are drawn at least this wide. An estimate, not a survey: replace with measured widths when someone has them. */
export const CP_WIDTH = { 'Inner Circle': 12, 'Outer Circle': 16 };
const nameOf = (G, id) => { const n = G.names && G.name ? G.names[G.name[id]] : null; return n ? (typeof n === 'string' ? n : n.en || n.ref || '') : ''; };

export function chaikin(p, rounds = 2) {
  let a = p; for (let k = 0; k < rounds; k++) { if (a.length < 6) break; const o = [a[0], a[1]]; for (let i = 0; i + 3 < a.length; i += 2) { const x0 = a[i], z0 = a[i + 1], x1 = a[i + 2], z1 = a[i + 3], last = i + 4 >= a.length, first = i === 0; o.push(first ? x0 * 0.5 + x1 * 0.5 : x0 * 0.75 + x1 * 0.25, first ? z0 * 0.5 + z1 * 0.5 : z0 * 0.75 + z1 * 0.25); o.push(last ? x0 * 0.5 + x1 * 0.5 : x0 * 0.25 + x1 * 0.75, last ? z0 * 0.5 + z1 * 0.5 : z0 * 0.25 + z1 * 0.75); } o.push(a[a.length - 2], a[a.length - 1]); a = o; }
  return a;
}

export function arcPiece(p, c = CP_CIRCLE) {
  const n = p.length / 2; if (n < 3) return null; const A = [], Rr = []; let prev = 0;
  for (let i = 0; i < n; i++) { let a = Math.atan2(p[i * 2 + 1] - c.cz, p[i * 2] - c.cx); if (i) { while (a - prev > Math.PI) a -= 2 * Math.PI; while (a - prev < -Math.PI) a += 2 * Math.PI; } A.push(a); Rr.push(Math.hypot(p[i * 2] - c.cx, p[i * 2 + 1] - c.cz)); prev = a; if (Math.abs(Rr[i] - c.R) > 20) return null; }
  const dir = Math.sign(A[n - 1] - A[0]); if (!dir) return null; for (let i = 1; i < n; i++) if ((A[i] - A[i - 1]) * dir <= 0) return null;                 // a piece that is not a plain arc is left alone
  const span = Math.abs(A[n - 1] - A[0]); if (span < 5 * Math.PI / 180) return null;
  const e0 = Rr[0] - c.R, e1 = Rr[n - 1] - c.R, len = span * c.R, S = Math.max(2, Math.ceil(span / c.STEP)), out = [p[0], p[1]];
  for (let k = 1; k < S; k++) { const t = k / S, a = A[0] + (A[n - 1] - A[0]) * t, s = t * len, w0 = Math.max(0, 1 - s / c.BLEND), w1 = Math.max(0, 1 - (len - s) / c.BLEND), r = c.R + e0 * w0 + e1 * w1; out.push(c.cx + r * Math.cos(a), c.cz + r * Math.sin(a)); }
  out.push(p[p.length - 2], p[p.length - 1]); return out;
}

export function smoothCircles(tile, G) {
  if (!tile || !tile.streets || !G) return tile; let any = false; const streets = tile.streets.map(s => {
    if (!s.pts || s.pts.length < 6) return s; const nm = nameOf(G, s.id); if (nm !== 'Inner Circle' && nm !== 'Middle Circle' && nm !== 'Outer Circle') return s;
    let p = null; if (nm === 'Inner Circle') p = arcPiece(s.pts); if (!p && nm !== 'Inner Circle') p = chaikin(s.pts, 2); if (!p) p = s.pts; any = true; const mw = CP_WIDTH[nm], cur = s.width !== undefined ? s.width : (G.lanes ? Math.max(1, Math.round(G.lanes[s.id] * 3.4 * 10) / 10) : 0); return { ...s, pts: p, ...(mw && cur < mw ? { width: mw } : {}) };
  });
  return any ? { ...tile, streets } : tile;
}

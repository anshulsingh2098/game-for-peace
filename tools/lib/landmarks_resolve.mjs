/* Turns the curated landmark list (tools/city_data/<city>_landmarks_src.json: names, cards, look notes written for the game) into landmarks.json by finding each place in the OpenStreetMap
   data of the pack: position, footprint, height, wikidata id, opening hours. Pure (no file access); tools/build_city.mjs calls it.
   An entry is matched, in this order, by `osm` (an explicit id like w123), by `wikidata` (equal to the tag on a feature within `radius` metres), then by name (any of `match` as a
   lower-case substring of the feature's name, name:en or alt_name, within `radius`). Among several matches the one with the largest footprint wins (the complex, not the gate).
   Nothing found: the entry keeps the position written in the list and `src` says "list"; its footprint is a small square so the registry can still claim the ground, and the build prints it. */
import { r1, area, centroid, bbox, simplifyRing } from './geom.mjs';

const lc = s => (s || '').toLowerCase();
const namesOf = t => [t.name, t['name:en'], t.alt_name, t.official_name, t['alt_name:en']].filter(Boolean).map(lc);
const num = v => { if (v === undefined || v === null) return null; const m = /^\s*(-?\d+(?:[.,]\d+)?)/.exec(String(v)); return m ? parseFloat(m[1].replace(',', '.')) : null; };

/* long-axis bearing of a footprint (radians clockwise from north, in [0, pi)) from its longest edge */
export function longAxis(ring) {
  let best = 0, bl = -1; for (let i = 0; i < ring.length; i += 2) { const j = (i + 2) % ring.length, dx = ring[j] - ring[i], dz = ring[j + 1] - ring[i + 1], l = Math.hypot(dx, dz); if (l > bl) { bl = l; best = Math.atan2(dx, -dz); } }
  best = ((best % Math.PI) + Math.PI) % Math.PI; return +best.toFixed(3);
}

export function resolveLandmarks(src, cand, ctx) {
  const { X, Z, edges, edgeGeom, names, buildings } = ctx, list = [], unresolved = [];
  for (const e of src.landmarks) {
    const x = X(e.lon), z = Z(e.lat), R = e.radius || 700, match = (e.match || [e.name.en]).map(lc);
    const hit = [];
    const consider = (osm, t, ring, cx, cz, kind) => {
      if (Math.hypot(cx - x, cz - z) > R) return;
      let score = 0;
      if (e.osm && e.osm === osm) score = 100; else if (e.wikidata && t.wikidata === e.wikidata) score = 50; else { const nn = namesOf(t); if (nn.some(n => match.some(m => n.includes(m)))) score = 10; }
      if (!score) return; hit.push({ osm, t, ring, cx, cz, score, a: ring ? Math.abs(area(ring)) : 0, kind });
    };
    if (e.kind !== 'street' && !e.nomatch) {
      for (const c of cand) consider(c.osm, c.t, c.ring, c.x, c.z, 'poi');
      for (const b of buildings) if (b.name || b.wikidata) consider(b.osm, b.t, b.ring, b.c[0], b.c[1], 'building');
    }
    hit.sort((p, q) => q.score - p.score || (q.ring ? 1 : 0) - (p.ring ? 1 : 0) || q.a - p.a || p.osm.localeCompare(q.osm));
    const best = hit[0];
    const out = { id: e.id, wikidata: e.wikidata || (best && best.t.wikidata) || null, name: e.name, type: e.type, x: r1(x), z: r1(z), yaw: 0, footprint: [], height: e.height ?? null, model: e.model || 'procedural:' + e.id, look: e.look || null, card: e.card, importance: e.importance ?? 3, collision: e.collision || 'footprint', src: 'list', osm: null, hours: e.hours || null };
    if (e.hindi_note) out.hindi_note = e.hindi_note;
    const osmIds = [];
    if (e.kind === 'street') {
      const re = new RegExp(e.street, 'i'), lines = [];
      edges.forEach((ed, i) => { const nm = names[ed[10]]; if (!re.test(nm.en + ' ' + nm.hi)) return; const p = edgeGeom[i].pts; const mx = p[Math.floor(p.length / 4) * 2], mz = p[Math.floor(p.length / 4) * 2 + 1]; if (Math.hypot(mx - x, mz - z) <= R * 3) lines.push({ id: i, pts: p }); });
      if (lines.length) { out.src = 'osm'; out.lines = lines.slice(0, 40).map(l => ({ edge: l.id, pts: l.pts.map(r1) })); out.footprint = []; const all = lines.flatMap(l => l.pts); let sx = 0, sz = 0; for (let i = 0; i < all.length; i += 2) { sx += all[i]; sz += all[i + 1]; } out.x = r1(sx / (all.length / 2)); out.z = r1(sz / (all.length / 2)); const f = lines[0].pts; out.yaw = +((Math.atan2(f[f.length - 2] - f[0], -(f[f.length - 1] - f[1])) % Math.PI + Math.PI) % Math.PI).toFixed(3); }
      else unresolved.push(e.id);
    } else if (best) {
      out.src = 'osm'; out.osm = best.osm; osmIds.push(best.osm);
      for (const h of hit) if (h.score === best.score && h.ring && h.a > 20 && Math.hypot(h.cx - best.cx, h.cz - best.cz) < 120) osmIds.push(h.osm);
      if (best.ring) { let ring = best.ring; if (area(ring) < 0) { const o = []; for (let i = ring.length - 2; i >= 0; i -= 2) o.push(ring[i], ring[i + 1]); ring = o; } out.footprint = simplifyRing(ring, 0.5).map(r1); const c = centroid(ring); out.x = r1(c[0]); out.z = r1(c[1]); out.yaw = longAxis(out.footprint); out.areaM2 = Math.round(Math.abs(area(ring))); }
      else { out.x = r1(best.cx); out.z = r1(best.cz); }
      const t = best.t; if (out.height === null) { const h = num(t.height); if (h) { out.height = h; out.heightSrc = 'osm'; } else { const l = num(t['building:levels']); if (l && l >= 3) { out.height = r1(l * 3.2); out.heightSrc = 'levels'; } } } else out.heightSrc = 'list';
      if (!out.hours && t.opening_hours) out.hours = t.opening_hours; if (t.start_date) out.osmStartDate = t.start_date; if (t.wikipedia) out.wikipedia = t.wikipedia;
      out.nameOsm = { en: t['name:en'] || t.name || '', hi: t['name:hi'] || '' };
    } else if (e.nomatch) { out.src = 'list';
    } else {
      unresolved.push(e.id);
      if (out.height !== null) out.heightSrc = 'list';
    }
    if (!out.footprint.length && !out.lines) { const s = e.size || 12; out.footprint = [r1(out.x - s), r1(out.z - s), r1(out.x + s), r1(out.z - s), r1(out.x + s), r1(out.z + s), r1(out.x - s), r1(out.z + s)]; out.footprintSrc = 'square'; }
    out._osm = osmIds; list.push(out);
  }
  return { list, unresolved };
}
void bbox;

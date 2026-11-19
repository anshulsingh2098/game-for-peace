/* Builds docs/CP_MAX_CHECKLIST.md: every place of the owner's atlas pack (docs/research/delhi_atlas_pack/visual_atlas.csv) and every asset of its registry (asset_registry.csv)
   with the scope (CP now, CP surround, kit for later), our state and where it lives. The atlas rows get their game position (x, z), the pack area it falls in and the nearest landmark or named place, computed here from the Delhi pack.
   The asset states are the author's reading of the code and the logs (hand-kept in ASSET_STATE below); nothing in the list has been looked at against a photo or accepted by the owner.
   Run: node tools/build_cp_checklist.mjs */
import fs from 'node:fs';
import { Identity } from '../src/world/city/identity.js';
import { PLACES } from '../src/world/city/places.js';
const root = new URL('../', import.meta.url).pathname, pack = root + 'docs/research/delhi_atlas_pack/', base = root + 'assets/cities/delhi/';
const csv = f => { const [h, ...rows] = fs.readFileSync(pack + f, 'utf8').trim().split('\n'); const cols = h.split(','); return rows.map(r => { const v = []; let cur = '', q = false; for (const ch of r) { if (ch === '"') q = !q; else if (ch === ',' && !q) { v.push(cur); cur = ''; } else cur += ch; } v.push(cur); return Object.fromEntries(cols.map((c, i) => [c, v[i]])); }); };
const man = JSON.parse(fs.readFileSync(base + 'manifest.json')), ident = new Identity(JSON.parse(fs.readFileSync(base + 'identity.json')), man.origin);
const R = 6371008.8, o = man.origin, proj = (lat, lon) => ({ x: (lon - o.lon) * Math.PI / 180 * R * Math.cos(o.lat * Math.PI / 180), z: -(lat - o.lat) * Math.PI / 180 * R });
const lms = JSON.parse(fs.readFileSync(base + 'landmarks.json')).landmarks;
const B = '🟩 built', P = '🟨 partial', N = '⬜ not started';
/* [state, scope, where / note]  scope: CP = Connaught Place core now; SUR = CP surround (Kartavya, Lutyens, Janpath) after the core; KIT = the kit, later, all Delhi */
const S = {
  1: [B, 'CP', 'arcade bay in tilemesh.js / cpfacade.js (arch, columns, cornice, square corner pavilions after R7 (PR 113), pavilion block with gate and fan-light window, granite walk with guide strip)'], 2: [B, 'CP', 'round fluted column, base and capital (cpfacade.js)'], 3: [P, 'CP', 'shopfronts from shop rules + brand band; shutters and glass detail thin'], 4: [B, 'CP', 'arched drum windows with sills (cpfacade.js)'],
  5: [N, 'SUR', 'Lutyens hedges and avenue exist, compound walls not (OPEN_ITEMS 5)'], 6: [P, 'SUR', 'landmark domes by plan (landmarks/), drum domes at CP; no generic government dome module'], 7: [P, 'KIT', 'Old Delhi shop stacks by area rule; no narrow-plot facade module'], 8: [N, 'KIT', 'jharokha exists only in the India district builder (district.js)'], 9: [P, 'KIT', 'shop shutters in tilemesh.js'], 10: [N, 'KIT', ''], 11: [N, 'KIT', ''],
  12: [N, 'KIT', ''], 13: [N, 'KIT', ''], 14: [P, 'KIT', 'generic infill buildings only (infill.js)'], 15: [N, 'KIT', ''], 16: [P, 'KIT', 'generic infill facade'], 17: [N, 'KIT', ''], 18: [N, 'KIT', ''], 19: [N, 'KIT', ''], 20: [P, 'KIT', 'office kit (glass bands) in tilemesh.js'],
  21: [P, 'CP', 'rooftop water tanks in tilemesh.js (checked on few buildings)'], 22: [P, 'CP', 'AC boxes on the roof of the PVX Plaza cinema front only (cpfacade.js cinemaFront); none on the other fronts'], 23: [B, 'CP', 'parapet and roof cornice'], 24: [N, 'KIT', ''],
  25: [B, 'CP', 'PBR asphalt with wear, tracks, patches, cracks'], 26: [B, 'CP', 'wear by area (patches, potholes, dust)'], 27: [B, 'CP', 'kerb, painted red/white and black/white on main roads'], 28: [B, 'CP', 'pavement texture, CP stone slabs'], 29: [P, 'CP', 'hedge and island medians; no concrete median block'], 30: [B, 'KIT', 'flyover piers (deck code)'], 31: [B, 'KIT', 'flyover deck'], 32: [P, 'KIT', 'underpass walls in the cut code'],
  33: [B, 'CP', 'mast arms with live signal heads'], 34: [B, 'CP', 'Hindi/English boards, gantry with places, small signs (A-2026-11-20-06, -07)'], 35: [P, 'CP', 'bus shelters at the transit stops (streetlife.js); not placed on every CP stop'], 36: [P, 'CP', 'cpstreet.js (not hooked in yet: A-2026-11-22-02)'], 37: [B, 'CP', 'manhole covers in road wear'], 38: [P, 'CP', 'cpstreet.js (not hooked in yet)'], 39: [P, 'CP', 'cpstreet.js (not hooked in yet)'],
  40: [P, 'CP', 'pharmacy as a shop kind with board'], 41: [P, 'CP', 'mobile shop kind'], 42: [N, 'KIT', ''], 43: [N, 'KIT', ''], 44: [N, 'KIT', ''], 45: [P, 'CP', 'stalls by area rule (streetlife.js)'], 46: [P, 'CP', 'chai shop kind'], 47: [N, 'KIT', ''], 48: [P, 'KIT', 'spices shop kind, no sack props'], 49: [N, 'KIT', ''], 50: [B, 'CP', 'awnings by area rule'], 51: [N, 'CP', 'brand boards glow at night; no lightbox box model'],
  52: [P, 'CP', 'tree cards by species (first versions, T1 not accepted)'], 53: [P, 'CP', 'same'], 54: [N, 'SUR', 'banyan is not in the species list'], 55: [P, 'SUR', 'tree card'], 56: [P, 'SUR', 'tree card'], 57: [P, 'SUR', 'tree card'], 58: [N, 'KIT', 'kikar not in the species list'], 59: [N, 'KIT', ''], 60: [B, 'CP', 'planters and hedges (roundabout.js, streetlife.js)'],
  61: [B, 'CP', 'auto-rickshaw in city traffic'], 62: [B, 'CP', 'e-rickshaw'], 63: [B, 'CP', 'city bus (citybus.js)'], 64: [P, 'CP', 'two-wheeler class, one body for scooter and motorcycle'], 65: [P, 'CP', 'see 64'], 66: [P, 'CP', 'tempo'], 67: [B, 'CP', 'hatchback'], 68: [B, 'CP', 'truck'],
  69: [B, 'KIT', 'metro pillars (transit)'], 70: [B, 'KIT', 'viaduct'], 71: [B, 'CP', 'station entrance (transit_station.js; Rajiv Chowk)'], 72: [B, 'KIT', 'metro train'], 73: [B, 'CP', 'power poles with wires'], 74: [P, 'CP', 'wires between poles; no bundle model'], 75: [P, 'CP', 'cpstreet.js (not hooked in yet)'], 76: [B, 'CP', 'street lamps with light pools'], 77: [P, 'CP', 'cpstreet.js (not hooked in yet)'], 78: [P, 'CP', 'cpstreet.js (not hooked in yet)']
};
const cpNear = (x, z) => Math.hypot(x - 1045, z + 2102);
const atlas = csv('visual_atlas.csv'), assets = csv('asset_registry.csv');
let md = `# CP maxing: the research pack ticked off (places and assets)

Generated by \`tools/build_cp_checklist.mjs\` from the owner's atlas pack (\`docs/research/delhi_atlas_pack/\`). Part of \`docs/CP_MAX_PLAN.md\`. **How to read it:** *Scope* says when it is built: **CP** = Connaught Place core, now; **SUR** = CP surround (Kartavya, Lutyens, Janpath, Jantar Mantar, Bangla Sahib), right after the core; **KIT** = made as a reusable module while doing CP and applied to all Delhi later. *State* is the author's reading of the code and the logs (built means code exists and was seen once by a developer; **nothing here is accepted by the owner, nothing was checked against a photo, nothing was tried on a phone**). A tick (☑) means built (code exists and a developer saw it once), nothing more: acceptance stays open until the owner scores the CP spots; the places carry no tick because none has a reference photo yet.
The pack says 45 places and 70 assets; the files hold ${atlas.length} and ${assets.length}.

## Places (visual atlas)
The atlas has no headings, photos or licences yet (every row \`UNSURVEYED\`), so no place can be ticked beyond "exists in the game". Columns: game position (x, z) from the pack origin, the pack's area there, the nearest landmark in the pack and its distance, the nearest named place (metro, rail or landmark).

| Tick | ID | Place | Scope | x, z | Area | Nearest landmark | Nearest place | State |
|---|---|---|---|---|---|---|---|---|
`;
for (const r of atlas) {
  const p = proj(+r.approx_lat, +r.approx_lon), d = cpNear(p.x, p.z), scope = /^CP$/.test(r.district_archetype) || d < 700 ? 'CP' : d < 3500 ? 'SUR' : 'KIT';
  let lm = null, ld = 1e9; for (const l of lms) { const dd = Math.hypot(l.x - p.x, l.z - p.z); if (dd < ld) { ld = dd; lm = l; } }
  let pl = null, pd = 1e9; for (const q of PLACES) { const dd = Math.hypot(q[2] - p.x, q[3] - p.z); if (dd < pd) { pd = dd; pl = q; } }
  const area = ident.areaNameAt(p.x, p.z), state = scope === 'CP' ? '🟨 built, not scored' : (lm && ld < 250 ? '🟨 landmark model exists' : '⬜ nothing specific');
  md += `| ☐ | ${r.id} | ${r.place} | ${scope} | ${Math.round(p.x)}, ${Math.round(p.z)} | ${area} | ${lm.name.en} (${Math.round(ld)} m) | ${pl[0]} (${Math.round(pd)} m) | ${state} |\n`;
}
md += `\n## Assets (registry)\n\n| Tick | ID | Category | Asset | Scope | State | Where / note |\n|---|---|---|---|---|---|---|\n`;
for (const r of assets) { const n = +r.asset_id.slice(4), s = S[n] || [N, 'KIT', '']; md += `| ${s[0] === B ? '☑' : '☐'} | ${r.asset_id} | ${r.category} | ${r.asset_name} | ${s[1]} | ${s[0]} | ${s[2]} |\n`; }
const cnt = (sc) => assets.filter(r => (S[+r.asset_id.slice(4)] || [N, 'KIT'])[1] === sc), st = (arr, s) => arr.filter(r => (S[+r.asset_id.slice(4)] || [N])[0] === s).length;
md += `\n## Totals (assets)\n\n| Scope | Rows | built | partial | not started |\n|---|---|---|---|---|\n`;
for (const sc of ['CP', 'SUR', 'KIT']) { const a = cnt(sc); md += `| ${sc} | ${a.length} | ${st(a, B)} | ${st(a, P)} | ${st(a, N)} |\n`; }
md += `\n## Rule\nA row is ticked only with evidence in \`docs/CP_MATCH_LOG.md\` (frame at the matching spot, compared with a reference) and an entry in \`assets/ASSETS.md\`. Re-run the generator after changing the states in the script. The CP gate in \`docs/CP_MAX_PLAN.md\` needs every **CP** row built or explicitly dropped by the owner.\n`;
fs.writeFileSync(root + 'docs/CP_MAX_CHECKLIST.md', md);
console.log('checklist:', atlas.length, 'places,', assets.length, 'assets');

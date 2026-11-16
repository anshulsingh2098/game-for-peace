/* Builds licenses.html: the credits and licence list linked from the title screen. Sources: the table in assets/ASSETS.md (every file we ship) and the lists below (data, libraries, references).
   Run: node tools/build_licenses.mjs      (the self-test fails if licenses.html is out of date). Owner review pending: every entry is credited as applicable until it has been reviewed. */
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = new URL('../', import.meta.url), esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const md = s => esc(s).replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

export const DATA = [
  ['Road shapes of the India map', '© OpenStreetMap contributors. Simplified driving routes derived from OpenStreetMap data (computed with the OSRM demo server, router.project-osrm.org).', 'ODbL 1.0', 'https://www.openstreetmap.org/copyright', 'assets/india/waypoints.json, assets/india/skeleton.json (the derived road data is published in this repository under the same licence)'],
  ['Railway lines of the India map', 'Natural Earth 1:10m Railroads (naturalearthdata.com), simplified and joined into a graph.', 'Public domain', 'https://www.naturalearthdata.com/about/terms-of-use/', 'assets/india/rails.json'],
  ['Elevation of India', 'AWS Terrain Tiles (Mapzen / Tilezen). Contains 3DEP, SRTM and GMTED2010 content courtesy of the U.S. Geological Survey and ETOPO1 content courtesy of the U.S. National Oceanic and Atmospheric Administration.', 'Attribution required; see the Tilezen attribution document', 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md', 'assets/india/terrain.bin (coarse resample, 5 km cells)'],
  ['Land cover of India (forest, farmland, grassland, bare ground, built-up)', 'Esri, Impact Observatory and Microsoft: Sentinel-2 10-Meter Land Use/Land Cover (derived from ESA Sentinel-2 imagery).', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/', 'assets/india/terrain.bin (coarse resample, 5 km cells)'],
  ['Corridors, cities and railway trunk routes', 'City positions entered by hand (facts). Which cities each highway and trunk railway joins follows public descriptions of the Golden Quadrilateral, the North-South and East-West Corridors, National Highway 44 and the Indian Railways Golden Quadrilateral and Golden Diagonal. No map or table was copied.', 'Facts; no licence needed', 'https://en.wikipedia.org/wiki/Golden_Quadrilateral', 'src/world/india_network.js']
];
export const LIBS = [
  ['three.js', 'WebGL 3D library', 'MIT', 'https://threejs.org', 'vendor/three'],
  ['Rapier (rapier3d-compat)', 'Physics engine, compiled to WebAssembly', 'Apache-2.0', 'https://rapier.rs', 'vendor/rapier']
];
export const REFS = [
  ['"Railway Network Map of India, Schematic" and "National Highway Network of India" (Wikimedia Commons)', 'Supplied by the owner as visual reference only. No data, geometry or image was taken from them (they are share-alike works).'],
  ['Photographs of Indian expressways, ghat roads and interchanges', 'Supplied by the owner as visual reference only. Not included in the game or the repository.'],
  ['This is a schematic impression of India, not an official map', 'Borders, names and distances are not authoritative.']
];

export function renderLicenses() {
  const rows = readFileSync(new URL('assets/ASSETS.md', ROOT), 'utf8').split('\n').filter(l => /^\| `/.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
  const th = h => `<tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>`, tr = r => `<tr>${r.map(x => `<td>${md(x)}</td>`).join('')}</tr>`;
  const link = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t || u)}</a>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Licenses and credits</title>
<style>
  :root { color-scheme: dark; --bg: #0e1522; --fg: #e6edf7; --mut: #9fb0c8; --line: #243049; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 1000px; margin: 0 auto; padding: 24px 16px 60px; }
  h1 { font-size: 26px; margin: 0 0 6px; } h2 { font-size: 18px; margin: 32px 0 8px; border-bottom: 1px solid var(--line); padding-bottom: 4px; }
  p, li { color: var(--mut); } a { color: #8fc8ff; } code { background: #17213a; padding: 1px 5px; border-radius: 4px; font-size: 13px; word-break: break-all; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; } th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid var(--line); } th { color: var(--fg); }
  .wrap { overflow-x: auto; }
</style></head><body><main>
<h1>Licenses and credits</h1>
<p>Game for Peace. Every outside file and data set the game uses is listed here with its source and licence. This list is generated from <code>assets/ASSETS.md</code> and <code>tools/build_licenses.mjs</code> and is credited as applicable until the owner has reviewed it. <a href="index.html">Back to the game</a>.</p>
<h2>Map and land data</h2><div class="wrap"><table>${th(['Used for', 'Credit', 'Licence', 'Source', 'Where in the project'])}${DATA.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${link(r[3])}</td><td><code>${esc(r[4])}</code></td></tr>`).join('')}</table></div>
<h2>Libraries</h2><div class="wrap"><table>${th(['Name', 'What', 'Licence', 'Source', 'Where'])}${LIBS.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${link(r[3])}</td><td><code>${esc(r[4])}</code></td></tr>`).join('')}</table></div>
<h2>Assets shipped with the game</h2><div class="wrap"><table>${th(['File', 'What', 'Source', 'Author', 'Licence'])}${rows.map(tr).join('')}</table></div>
<h2>Visual references and notes</h2><ul>${REFS.map(r => `<li><b>${esc(r[0])}</b>: ${esc(r[1])}</li>`).join('')}</ul>
<p>Everything not listed (terrain, roads, trees built in code, buildings, signs, junctions, traffic behaviour, code) was made for this project.</p>
</main></body></html>
`;
}
if (process.argv[1] && process.argv[1].endsWith('build_licenses.mjs')) { writeFileSync(new URL('licenses.html', ROOT), renderLicenses()); console.log('licenses.html written'); }

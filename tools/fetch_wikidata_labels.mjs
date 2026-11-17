// Fetch Wikidata (CC0) labels (en, hi), station code (P296), opening date (P1619) and location (P625) for the Q-ids that OSM names on Delhi transit stations.
// Reads data/raw/delhi_transit/stations.json, writes data/raw/delhi_transit/wikidata.json. Run: node tools/fetch_wikidata_labels.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data/raw/delhi_transit');
const st = JSON.parse(fs.readFileSync(path.join(dir, 'stations.json')));
const ids = [...new Set(st.elements.map(e => e.tags && e.tags.wikidata).filter(q => /^Q\d+$/.test(q || '')))];
const out = {}; const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < ids.length; i += 40) {
  const url = 'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|claims&languages=en|hi&ids=' + ids.slice(i, i + 40).join('|');
  for (let a = 0; a < 4; a++) {
    const r = await fetch(url, { headers: { 'user-agent': 'GameForPeace-city-pipeline/0.1 (open-source driving game research)' } }); const t = await r.text();
    if (!t.startsWith('{')) { await sleep(15000); continue; }
    const j = JSON.parse(t);
    for (const [q, e] of Object.entries(j.entities || {})) {
      const c = e.claims || {}, v = p => c[p] && c[p][0] && c[p][0].mainsnak && c[p][0].mainsnak.datavalue && c[p][0].mainsnak.datavalue.value;
      out[q] = { en: e.labels && e.labels.en && e.labels.en.value, hi: e.labels && e.labels.hi && e.labels.hi.value, code: v('P296'), opened: v('P1619') && v('P1619').time, coord: v('P625') && [v('P625').latitude, v('P625').longitude] };
    }
    break;
  }
  await sleep(2000);
}
fs.writeFileSync(path.join(dir, 'wikidata.json'), JSON.stringify(out)); console.log('wikidata entities', Object.keys(out).length, 'of', ids.length);

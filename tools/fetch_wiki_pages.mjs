// Fetch the wikitext of en.wikipedia pages (cross-check facts only; text CC BY-SA, not copied) into data/raw/delhi_transit/wp/.
// Usage: node tools/fetch_wiki_pages.mjs "Title one" "Title two" ...   (slow on purpose: 1 request per 4 s)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data/raw/delhi_transit/wp'); fs.mkdirSync(dir, { recursive: true });
const UA = 'GameForPeace-city-pipeline/0.1 (open-source driving game research)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (const t of process.argv.slice(2)) {
  const f = path.join(dir, t.replace(/[^A-Za-z0-9]+/g, '_') + '.json'); if (fs.existsSync(f) && fs.statSync(f).size > 600) { console.log('have', t); continue; }
  for (let a = 0; a < 5; a++) {
    const r = await fetch('https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=' + encodeURIComponent(t), { headers: { 'user-agent': UA } }); const s = await r.text();
    if (s.startsWith('{') && s.includes('wikitext')) { fs.writeFileSync(f, s); console.log('ok', t, s.length); break; }
    if (s.startsWith('{')) { console.log('missing', t); break; }
    console.log('wait', t, s.slice(0, 60)); await sleep(20000);
  }
  await sleep(4000);
}

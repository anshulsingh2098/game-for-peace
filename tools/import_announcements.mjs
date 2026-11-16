/* Imports announcement recordings the owner has downloaded into assets/audio/announce/ and writes/extends manifest.json from the file names.
   Run: node tools/import_announcements.mjs <folder>        File names: city_kind_lang[_trainnumber].ext, e.g. mumbai_arriving_mr_12951.mp3 (kind: arriving | departing | welcome | any; lang: mr hi en bn ta te kn ml gu pa or as).
   Anything it cannot read from the name is left out of the guess (the entry is still added with generic: true so it can be fixed by hand). It does not download anything. */
import { readdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { CITIES } from '../src/world/india_network.js';
const src = process.argv[2]; if (!src || !existsSync(src)) { console.error('usage: node tools/import_announcements.mjs <folder with the downloaded files>'); process.exit(1); }
const dir = new URL('../assets/audio/announce/', import.meta.url).pathname, mf = join(dir, 'manifest.json'); mkdirSync(dir, { recursive: true });
const manifest = existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : [], have = new Set(manifest.map(c => c.file)), ids = new Set(CITIES.map(c => c.id)), LANGS = new Set(['mr', 'hi', 'en', 'bn', 'ta', 'te', 'kn', 'ml', 'gu', 'pa', 'or', 'as']), KINDS = new Set(['arriving', 'departing', 'welcome', 'any']);
let added = 0; for (const f of readdirSync(src)) { const ext = extname(f).toLowerCase(); if (!['.mp3', '.m4a', '.wav', '.ogg', '.webm', '.opus'].includes(ext)) continue; const name = basename(f, ext).toLowerCase().replace(/[^a-z0-9]+/g, '_'), out = name + ext; copyFileSync(join(src, f), join(dir, out)); if (have.has(out)) continue;
  const parts = name.split('_'), e = { file: out, city: parts.find(p => ids.has(p)) || null, kind: parts.find(p => KINDS.has(p)) || 'any', lang: parts.find(p => LANGS.has(p)) || null, credit: 'see the playlist', url: 'https://www.youtube.com/playlist?list=PL7nUR0WB6kMBPrzFzIpF8IQ5vbdOF36WX', title: f };
  const num = parts.find(p => /^\d{5}$/.test(p)); if (num) e.train = num; else e.generic = true; manifest.push(e); added++; }
writeFileSync(mf, JSON.stringify(manifest, null, 2)); console.log('copied files; manifest now has ' + manifest.length + ' entries (' + added + ' new). Check assets/audio/announce/manifest.json: city, kind, lang, train, credit.');

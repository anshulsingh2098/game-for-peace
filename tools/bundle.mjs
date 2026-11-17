/* Deploy-time bundle: turns the 140 separate script files of the game into one minified file, so a phone makes 2 requests for code instead of 140.
   The source stays exactly as it is (no bundler for development); only the staged copy changes.
   Usage: node tools/bundle.mjs <staged folder>      (run after tools/stage_cloudflare.py --out <staged folder>; needs network once to fetch esbuild)
   It writes <folder>/dist/game.js and points the staged index.html at it. The unbundled game is still there: add ?src=1 to the address. */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
if (!process.argv[2]) { console.error('usage: node tools/bundle.mjs <staged folder>'); process.exit(2); }
const out = resolve(process.argv[2]);
mkdirSync(out + '/dist', { recursive: true });
const r = spawnSync('npx', ['--yes', 'esbuild@0.24.2', 'src/main.js', '--bundle', '--minify', '--format=esm', '--target=es2022', '--legal-comments=none',
  '--alias:three/addons=./vendor/three/addons', '--alias:three=./vendor/three/three.module.js', '--outfile=' + out + '/dist/game.js', '--log-level=warning'], { cwd: ROOT, stdio: 'inherit' });
if (r.status !== 0) { console.error('esbuild failed'); process.exit(1); }
const f = out + '/index.html'; let h = readFileSync(f, 'utf8');
const a = '<script type="module" src="src/main.js" onerror="window.__gfpBootFail()"></script>';
if (!h.includes(a)) { console.error('index.html: the module script line was not found'); process.exit(1); }
h = h.replace(a, `<script>(function () { var s = document.createElement('script'); s.type = 'module'; s.src = /[?&]src=1/.test(location.search) ? 'src/main.js' : 'dist/game.js'; s.onerror = function () { window.__gfpBootFail(); }; document.head.appendChild(s); })();</script>`);
writeFileSync(f, h);
console.log('bundle: dist/game.js ' + (statSync(out + '/dist/game.js').size / 1e6).toFixed(2) + ' MB, index.html points at it');

/* Builds the live part of the tracker page (tracker/public/index.html) from the files that already say who does what, so the page stays current without hand-editing:
     - docs/NEXT_PHASES.md        the phases for Anshul's Claude, and "Things a person must do"         -> Anshul / Rajul
     - team/stream-a.md, stream-b.md   open entries with an ask under "For the other stream"            -> the other stream's person
     - CHECKLIST.md               every unticked "- [ ]" manual check                                   -> Rajul
     - GitHub pull requests       open and recently merged (needs the gh tool; skipped without it)      -> by branch prefix (vehicle/ = Anshul)
     - git                        Anshul's vehicle/* branches: commits not yet in main, last commit
   It writes the result between the AUTO-DATA markers in tracker/public/index.html and to tracker/public/data.json.
   Usage:  node tools/build_tracker.mjs            build (runs the self-test for the check count; add --quick to skip it)
           node tools/build_tracker.mjs --check    exit 1 if the page is out of date with its sources (used by tools/daily_check.py; the clock and commit are ignored)
           node tools/build_tracker.mjs --deploy   build, then deploy the tracker Worker (needs `npx wrangler@4 login` as the owner)
   Ids are stable (a hash of the item's title), so a person's ticks and remarks on a generated item survive each rebuild. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..'), args = process.argv.slice(2);
const rd = f => (existsSync(ROOT + '/' + f) ? readFileSync(ROOT + '/' + f, 'utf8') : '');
const sh = (cmd, a, opt = {}) => { try { return execFileSync(cmd, a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...opt }).trim(); } catch (e) { return null; } };
const id = key => 'a' + createHash('sha1').update(key).digest('hex').slice(0, 7);
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const strip = s => String(s || '').replace(/`/g, '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
const I = (key, t, d, s, w, r) => ({ id: id(key), t: clip(strip(t), 160), d: clip(strip(d), 420), s, w, r });

/* 1. the phases in docs/NEXT_PHASES.md */
function phases() {
  const md = rd('docs/NEXT_PHASES.md'), out = [], people = [];
  for (const sec of md.split(/^## /m).slice(1)) {
    const [head, ...rest] = sec.split('\n'), body = rest.join('\n').trim(); let m;
    if ((m = /^(Phase \d+):\s*(.+)$/.exec(head))) {
      const done = /\(done\)/i.test(head), doing = /\(doing\)/i.test(head), first = body.split('\n').filter(l => l.trim()).slice(0, 2).join(' ');
      out.push(I('phase:' + m[1], m[1] + ': ' + m[2].replace(/\s*\((done|doing)\)/i, ''), first, done ? 'done' : doing ? 'doing' : 'todo', 'Anshul', 'docs/NEXT_PHASES.md'));
    } else if (/^Assigned to Anshul/i.test(head)) {
      for (const l of body.split('\n')) { const t = /^- \[( |x|~)\]\s+([A-Z]+\d+):\s+(.+?)\s+—\s+(.*)$/.exec(l); if (t) out.push(I('task:' + t[2], t[2] + ': ' + t[3], t[4], t[1] === 'x' ? 'done' : t[1] === '~' ? 'doing' : 'todo', 'Anshul', 'docs/NEXT_PHASES.md')); }
    } else if (/^Things a person must do/i.test(head)) {
      for (const part of body.replace(/\n/g, ' ').split(/;\s+/).map(x => x.trim().replace(/\.$/, '')).filter(x => x.length > 12 && !/^The tuner Publish password/.test(x)).map(x => x[0].toUpperCase() + x.slice(1))) people.push(I('person:' + part.slice(0, 60), part, 'From docs/NEXT_PHASES.md, "Things a person must do".', 'todo', 'You', 'docs/NEXT_PHASES.md'));
    }
  }
  return { phases: out, people };
}

/* 2. open asks in the team logs */
function logAsks() {
  const res = { Anshul: [], Rajul: [] };
  for (const [file, asked, from] of [['team/stream-a.md', 'Anshul', 'Rajul\'s Claude'], ['team/stream-b.md', 'Rajul', 'Anshul\'s Claude']]) {
    const parts = rd(file).split(/^## /m).slice(1);
    for (const p of parts) {
      const title = p.split('\n')[0].trim(), status = (/^Status:\s*(\w+)/m.exec(p) || [])[1], ask = (/^For the other stream:\s*([\s\S]*?)(?=^Status:|^## |$)/m.exec(p) || [])[1];
      if (status !== 'open' || !ask) continue; const a = ask.replace(/\s+/g, ' ').trim();
      if (/^(nothing|none|no\b)/i.test(a) || /^nothing( new| required| to run)?\b/i.test(a)) continue;
      const t = title.replace(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+/, ''), when = (/^(\d{4}-\d{2}-\d{2})/.exec(title) || [])[1] || '';
      res[asked].push(I('log:' + file + ':' + t, t, a, 'todo', asked, file.replace('team/', '') + ' ' + when + ', from ' + from));
    }
  }
  res.Anshul = res.Anshul.slice(0, 25); res.Rajul = res.Rajul.slice(0, 25); return res;
}

/* 3. the manual checks */
function checks() {
  const groups = []; let sec = 'Checklist'; for (const l of rd('CHECKLIST.md').split('\n')) {
    const h = /^##\s+(.*)$/.exec(l); if (h) { sec = 'Checklist: ' + strip(h[1]).replace(/^\d+\.\s*/, ''); continue; }
    const m = /^- \[ \]\s+(.*)$/.exec(l); if (!m) continue; const bold = /^\*\*(.+?)\*\*/.exec(m[1]), t = bold ? bold[1] : (m[1].length > 110 ? m[1].slice(0, 110) : m[1]);
    let g = groups.find(x => x[0] === sec); if (!g) groups.push(g = [sec, []]); g[1].push(I('check:' + m[1].slice(0, 80), t, m[1], 'todo', 'You', 'CHECKLIST.md'));
  } return groups;
}

/* 4. pull requests and branches */
function prs() {
  const j = sh('gh', ['pr', 'list', '--state', 'all', '--limit', '40', '--json', 'number,title,state,headRefName'], { timeout: 30000 }); if (!j) return { list: [], items: [] };
  let a; try { a = JSON.parse(j); } catch (e) { return { list: [], items: [] }; }
  const who = b => (/^vehicle\//.test(b) ? 'Anshul' : 'Rajul'), list = a.sort((x, y) => y.number - x.number).map(p => [String(p.number), p.title, p.state.toLowerCase()]);
  const items = a.filter(p => p.state === 'OPEN').map(p => I('pr:' + p.number, 'PR ' + p.number + ': ' + p.title, 'Open pull request on branch ' + p.headRefName + '. Waiting for review and the owner\'s merge.', 'doing', who(p.headRefName), 'PR ' + p.number));
  return { list, items };
}
function branches() {
  sh('git', ['fetch', '-q'], { timeout: 30000 }); const out = [], refs = sh('git', ['for-each-ref', '--format=%(refname:short)|%(committerdate:short)|%(subject)', 'refs/remotes/origin/vehicle']) || '';
  for (const l of refs.split('\n').filter(Boolean)) { const [ref, date, subj] = l.split('|'), ahead = sh('git', ['rev-list', '--count', 'origin/main..' + ref]), behind = sh('git', ['rev-list', '--count', ref + '..origin/main']); out.push([ref.replace('origin/', ''), date + ': ' + clip(subj, 70) + ' (' + ahead + ' commits not in main, ' + behind + ' behind main)']); }
  return out;
}

/* Anshul's own commits: on main they are his finished work, on his vehicle/* branches (not yet in main) his work in progress */
function anshulWork() {
  const done = [], doing = [], seen = new Set();
  for (const l of (sh('git', ['log', 'origin/main', '--author=Anshul', '--no-merges', '-n', '14', '--format=%h|%ad|%s', '--date=short']) || '').split('\n').filter(Boolean)) { const [h, d, ...t] = l.split('|'); const subj = t.join('|'); if (seen.has(subj)) continue; seen.add(subj); done.push(I('ac:' + h, subj, 'Committed by Anshul to main on ' + d + '.', 'done', 'Anshul', 'main ' + h)); }
  for (const ref of (sh('git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/vehicle']) || '').split('\n').filter(Boolean)) for (const l of (sh('git', ['log', 'origin/main..' + ref, '--author=Anshul', '--no-merges', '-n', '6', '--format=%h|%ad|%s', '--date=short']) || '').split('\n').filter(Boolean)) { const [h, d, ...t] = l.split('|'); const subj = t.join('|'); if (seen.has(subj)) continue; seen.add(subj); doing.push(I('ab:' + h, subj, 'On his branch ' + ref.replace('origin/', '') + ' since ' + d + ', not in main yet.', 'doing', 'Anshul', ref.replace('origin/', '') + ' ' + h)); }
  return { done, doing };
}

/* 5. build */
const P = phases(), L = logAsks(), C = checks(), R = prs(), B = branches(), W = anshulWork();
let tests = null; if (!args.includes('--quick') && !args.includes('--check')) { const o = sh('node', ['tools/selftest.mjs'], { timeout: 400000 }); const m = o && /(\d+) checks passed/.exec(o); tests = m ? m[1] : null; }
const old = (/\/\*AUTO-DATA-START\*\/const AUTO = (.*?);\/\*AUTO-DATA-END\*\//s.exec(rd('tracker/public/index.html')) || [])[1]; let prev = null; try { prev = JSON.parse(old); } catch (e) { /* none yet */ }
const groups = [
  ['Tasks and phases for Anshul (docs/NEXT_PHASES.md)', P.phases],
  ['Asked of Anshul in the team log', L.Anshul],
  ['Asked of Rajul in the team log', L.Rajul],
  ['Open pull requests', R.items],
  ['Anshul: on his branches, not in main yet', W.doing],
  ['Anshul: committed to main', W.done],
  ['Things a person must do', P.people],
  ...C
].filter(g => g[1].length);
const facts = [['Tracker data', 'built from the repo files (phases, team logs, checklist, pull requests, branches); rebuild with node tools/build_tracker.mjs']];
if (tests || (prev && prev.tests)) facts.push(['Self-test', (tests || prev.tests) + ' checks passing']);
const data = { commit: sh('git', ['rev-parse', '--short', 'origin/main']) || (prev && prev.commit) || '', groups, prs: R.list.length ? R.list : (prev ? prev.prs : []), branches: B.length ? B : (prev ? prev.branches : []), tests: tests || (prev && prev.tests) || null, facts };
const stable = JSON.stringify({ ...data, commit: '' }), prevStable = prev ? JSON.stringify({ ...prev, commit: '', generated: undefined }) : '';
if (args.includes('--check')) { const same = stable === prevStable; console.log(same ? 'tracker data is up to date' : 'tracker data is OUT OF DATE: run node tools/build_tracker.mjs'); process.exit(same ? 0 : 1); }
data.generated = new Date().toISOString();
const html = rd('tracker/public/index.html'), block = '/*AUTO-DATA-START*/const AUTO = ' + JSON.stringify(data).replace(/<\//g, '<\\/') + ';/*AUTO-DATA-END*/';
if (!/\/\*AUTO-DATA-START\*\/[\s\S]*?\/\*AUTO-DATA-END\*\//.test(html)) { console.error('tracker/public/index.html has no AUTO-DATA markers'); process.exit(2); }
writeFileSync(ROOT + '/tracker/public/index.html', html.replace(/\/\*AUTO-DATA-START\*\/[\s\S]*?\/\*AUTO-DATA-END\*\//, () => block));
writeFileSync(ROOT + '/tracker/public/data.json', JSON.stringify(data, null, 1) + '\n');
console.log('tracker data: ' + groups.map(g => g[0].split(' (')[0] + ' ' + g[1].length).join(', ') + '; ' + data.prs.length + ' PRs; ' + data.branches.length + ' Anshul branches' + (data.tests ? '; self-test ' + data.tests : ''));
if (args.includes('--deploy')) { try { execFileSync('npx', ['--yes', 'wrangler@4', 'deploy'], { cwd: ROOT + '/tracker', stdio: 'inherit' }); } catch (e) { console.error('tracker deploy failed (is wrangler logged in as the owner?)'); process.exit(1); } }

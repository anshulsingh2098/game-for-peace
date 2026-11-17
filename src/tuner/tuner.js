/* The tuner dashboard: a settings panel beside a live copy of the game (next.html in an iframe).
   The game describes its own settings (core/tuning.js), this page builds sliders for them and sends the changed values back.
   Export writes settings.json; Publish sends the settings to the site's worker (cloudflare/worker.js), which every player's game reads at start.
   The draft is also kept in this browser. */
import { explain } from '../core/tuning-docs.js';
const $ = s => document.querySelector(s), frame = $('#game'), tree = $('#tree');
const DRAFT = 'gfp-tuner-draft';
let fields = [], overrides = {}, timer = 0, ready = false;
try { overrides = JSON.parse(localStorage.getItem(DRAFT) || '{}') || {}; } catch (e) { overrides = {}; }

const send = msg => frame.contentWindow && frame.contentWindow.postMessage(msg, location.origin);
function push() {
  clearTimeout(timer);
  timer = setTimeout(() => { send({ type: 'tune', overrides }); try { localStorage.setItem(DRAFT, JSON.stringify(overrides)); } catch (e) { /* private window */ } $('#count').textContent = Object.keys(overrides).length ? Object.keys(overrides).length + ' changed' : ''; }, 220);
}
const same = (a, b) => typeof a === 'number' ? Math.abs(a - b) < 1e-9 : String(a).toLowerCase() === String(b).toLowerCase();

addEventListener('message', e => {
  const d = e.data; if (e.origin !== location.origin || !d) return;
  if (d.type === 'ready') send({ type: 'hello' });
  if (d.type === 'schema') {
    fields = d.fields; ready = true; $('#status').textContent = fields.length + ' settings';
    for (const [id, list] of [['loc', d.locations], ['veh', d.vehicles]]) $('#' + id).innerHTML = list.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
    $('#loc').value = d.state.location; $('#veh').value = d.state.vehicle;
    const known = new Set(fields.map(f => f.path)); for (const p of Object.keys(overrides)) if (!known.has(p)) delete overrides[p];     // a draft from an older version may name settings that no longer exist
    // the game may already hold published settings: show them as the starting point unless this browser has a draft
    if (!Object.keys(overrides).length) Object.assign(overrides, d.overrides);
    for (const f of fields) if (f.path in overrides) f.value = overrides[f.path];
    build(); if (Object.keys(overrides).length) push();
  }
});

function build() {
  tree.innerHTML = ''; const groups = new Map();
  for (const f of fields) { (groups.get(f.group) || groups.set(f.group, []).get(f.group)).push(f); }
  const tops = new Map();
  for (const [g, list] of groups) {
    const parts = g.split(' / '), top = parts[0];
    if (!tops.has(top)) { const d = document.createElement('details'); d.className = 'top'; d.innerHTML = `<summary>${top[0].toUpperCase() + top.slice(1)}<button class="sreset" title="Put every setting in this section back to its default" hidden>Reset section</button></summary><div class="in"></div>`; tree.append(d); tops.set(top, d); }
    const box = document.createElement('details'); box.dataset.q = g.toLowerCase(); box.innerHTML = `<summary>${parts.slice(1).join(' › ') || 'General'}<button class="sreset" title="Put every setting in this section back to its default" hidden>Reset section</button></summary><div class="in"></div>`;
    const inner = box.querySelector('.in');
    for (const f of list) inner.append(row(f));
    tops.get(top).querySelector('.in').append(box);
  }
  for (const d of tree.querySelectorAll('details')) d.querySelector('summary .sreset').onclick = e => {      // a section's own button: its settings go back to default
    e.preventDefault(); e.stopPropagation(); const rows = [...d.querySelectorAll('.field')].filter(x => x._changed()); if (!rows.length) return;
    if (!confirm(`Put ${rows.length} changed setting${rows.length > 1 ? 's' : ''} in "${d.querySelector('summary').firstChild.textContent}" back to default?`)) return;
    for (const x of rows) x._reset(); marks(); push();
  };
  filter(); marks();
}
/* show each section's reset button only while something inside it differs from the default */
function marks() { for (const d of tree.querySelectorAll('details')) d.querySelector('summary .sreset').hidden = !d.querySelector('.field .row.changed'); }

function row(f) {
  const doc = explain(f.path), field = document.createElement('div'); field.className = 'field'; field.dataset.q = (f.path + ' ' + f.label + ' ' + (doc ? doc.text : '')).toLowerCase();
  const r = document.createElement('div'); r.className = 'row'; r.title = f.path + (f.type === 'number' ? '  (default ' + f.def + ')' : '');
  const info = document.createElement('button'); info.className = 'info'; info.textContent = 'i'; info.title = 'What does this do?';
  const help = document.createElement('div'); help.className = 'help'; help.hidden = true;
  const fmt = v => typeof v === 'number' ? +v.toPrecision(6) : v;
  help.innerHTML = (doc ? `<p>${doc.text}</p><p><b>Works well:</b> ${doc.range}</p>` : '<p>No description written for this setting yet.</p>')
    + `<p><b>Default:</b> ${fmt(f.def)}${f.type === 'number' ? ` &nbsp; <b>Slider:</b> ${fmt(f.min)} to ${fmt(f.max)}` : ''}</p><p class="path">${f.path}</p>`;
  info.onclick = () => { help.hidden = !help.hidden; info.classList.toggle('on', !help.hidden); };
  const label = document.createElement('label'); label.textContent = f.label; const dot = document.createElement('span'); dot.className = 'dot'; dot.title = 'Reset to default';
  const set = v => { f.value = v; if (same(v, f.def)) delete overrides[f.path]; else overrides[f.path] = v; r.classList.toggle('changed', f.path in overrides); marks(); push(); };
  let rng, num, col;
  if (f.type === 'number') {
    rng = Object.assign(document.createElement('input'), { type: 'range', min: f.min, max: f.max, step: f.step, value: f.value });
    num = Object.assign(document.createElement('input'), { type: 'number', step: f.step, value: f.value });
    rng.oninput = () => { num.value = rng.value; set(+rng.value); };
    num.onchange = () => { const v = +num.value; if (Number.isFinite(v)) { if (v < +rng.min) rng.min = v; if (v > +rng.max) rng.max = v; rng.value = v; set(v); } };
    r.append(label, rng, num, dot, info);
  } else {
    col = Object.assign(document.createElement('input'), { type: 'color', value: f.value }); col.oninput = () => set(col.value); r.append(label, col, dot, info);
  }
  dot.onclick = () => { if (!(f.path in overrides)) return; if (rng) { rng.value = f.def; num.value = f.def; } else col.value = f.def; set(f.def); };
  field._changed = () => f.path in overrides;
  field._reset = () => { if (!(f.path in overrides)) return; if (rng) { rng.value = f.def; num.value = f.def; } else col.value = f.def; f.value = f.def; delete overrides[f.path]; r.classList.remove('changed'); };
  r.classList.toggle('changed', f.path in overrides); field.append(r, help);
  return field;
}

function filter() {
  const q = $('#search').value.trim().toLowerCase();
  for (const r of tree.querySelectorAll('.field')) r.hidden = !!q && !r.dataset.q.includes(q);
  for (const d of tree.querySelectorAll('details:not(.top)')) { const any = !!d.querySelector('.field:not([hidden])'); d.hidden = !any; if (q) d.open = any; }
  for (const d of tree.querySelectorAll('details.top')) { d.hidden = !d.querySelector('.field:not([hidden])'); if (q) d.open = !d.hidden; }
}
$('#search').oninput = filter;

for (const [id, name] of [['loc', 'location'], ['veh', 'vehicle'], ['wx', 'weather'], ['tm', 'time']]) $('#' + id).onchange = e => send({ type: 'cmd', name, arg: e.target.value });
$('#newWorld').onclick = () => send({ type: 'cmd', name: 'newWorld' }); $('#toRoad').onclick = () => send({ type: 'cmd', name: 'toRoad' });
$('#reset').onclick = () => { if (!confirm('Put every setting back to its default?')) return; overrides = {}; for (const f of fields) f.value = f.def; build(); push(); };
$('#export').onclick = () => {
  const blob = new Blob([JSON.stringify({ version: 1, overrides }, null, 2) + '\n'], { type: 'application/json' }), a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'settings.json' });
  a.click(); URL.revokeObjectURL(a.href);
};
$('#import').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try { const j = JSON.parse(await file.text()); overrides = { ...(j.overrides || {}) }; for (const f of fields) f.value = f.path in overrides ? overrides[f.path] : f.def; build(); push(); } catch (err) { alert('That file is not a settings.json'); }
  e.target.value = '';
};
frame.addEventListener('load', () => { ready = false; $('#status').textContent = 'loading game…'; setTimeout(() => { if (!ready) send({ type: 'hello' }); }, 1500); });

/* ---- Publish: send the settings to the worker, which needs the password (kept for this tab only) ---- */
const PW = 'gfp-tuner-pw', say = t => { $('#status').textContent = t; };
const password = ask => { let p = ''; try { p = sessionStorage.getItem(PW) || ''; } catch (e) { /* none */ } if (!p && ask) { p = prompt('Tuner password') || ''; try { sessionStorage.setItem(PW, p); } catch (e) { /* none */ } } return p; };
const forget = () => { try { sessionStorage.removeItem(PW); } catch (e) { /* none */ } };
async function api(path, opts = {}, needPw = false) {
  const h = { ...(opts.headers || {}) }; if (needPw) { const p = password(true); if (!p) throw new Error('no password'); h.authorization = 'Bearer ' + p; }
  const r = await fetch(path, { ...opts, headers: h }); let j = {}; try { j = await r.json(); } catch (e) { /* not JSON */ }
  if (r.status === 401) { forget(); throw new Error('wrong password'); }
  if (r.status === 503) throw new Error(j.error || 'the settings API is not set up on this site yet');
  if (!r.ok) throw new Error(j.error || 'error ' + r.status); return j;
}
const adopt = o => { overrides = { ...o }; const known = new Set(fields.map(f => f.path)); for (const p of Object.keys(overrides)) if (!known.has(p)) delete overrides[p]; for (const f of fields) f.value = f.path in overrides ? overrides[f.path] : f.def; build(); push(); };

$('#publish').onclick = async () => {
  const n = Object.keys(overrides).length;
  if (!confirm(`Publish ${n} changed setting${n === 1 ? '' : 's'}?\n\nEveryone who opens the game gets them from now on${n ? '' : ' (this puts everything back to default)'}.`)) return;
  const note = prompt('A short note for the history (optional)') || '';
  try { const r = await api('api/settings', { method: 'PUT', body: JSON.stringify({ version: 1, overrides, note }) }, true); say('published ' + r.count + ' at ' + new Date(r.updated).toLocaleTimeString()); }
  catch (e) { say('not published: ' + e.message); alert('Not published: ' + e.message); }
};
$('#pull').onclick = async () => {
  if (Object.keys(overrides).length && !confirm('Replace the settings in the panel with what is live now?')) return;
  try { const j = await api('api/settings?t=' + Date.now()); adopt(j.overrides || {}); say('loaded live settings' + (j.updated ? ' from ' + new Date(j.updated).toLocaleString() : '')); } catch (e) { say('could not load: ' + e.message); }
};
let history = [];
$('#hist').onfocus = async () => {
  try { history = (await api('api/history', {}, true)).history; } catch (e) { say('history: ' + e.message); return; }
  $('#hist').innerHTML = '<option value="">History…</option>' + history.map((h, i) => `<option value="${i}">${new Date(h.updated).toLocaleString()} · ${Object.keys(h.overrides).length}${h.note ? ' · ' + h.note.replace(/[<>&]/g, '') : ''}</option>`).join('');
};
$('#hist').onchange = e => { const h = history[+e.target.value]; if (h) { adopt(h.overrides); say('loaded an earlier version: press Publish to make it live'); } e.target.value = ''; };

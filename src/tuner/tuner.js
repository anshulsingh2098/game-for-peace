/* The tuner dashboard: a settings panel beside a live copy of the game (next.html in an iframe).
   The game describes its own settings (core/tuning.js), this page builds sliders for them and sends the changed values back.
   Export writes settings.json (the file the game loads at start); the draft is also kept in this browser. */
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
    if (!tops.has(top)) { const d = document.createElement('details'); d.className = 'top'; d.innerHTML = `<summary>${top[0].toUpperCase() + top.slice(1)}</summary><div class="in"></div>`; tree.append(d); tops.set(top, d); }
    const box = document.createElement('details'); box.dataset.q = g.toLowerCase(); box.innerHTML = `<summary>${parts.slice(1).join(' › ') || 'General'}</summary><div class="in"></div>`;
    const inner = box.querySelector('.in');
    for (const f of list) inner.append(row(f));
    tops.get(top).querySelector('.in').append(box);
  }
  filter();
}

function row(f) {
  const r = document.createElement('div'); r.className = 'row'; r.dataset.q = (f.path + ' ' + f.label).toLowerCase(); r.title = f.path + (f.type === 'number' ? '  (default ' + f.def + ')' : '');
  const label = document.createElement('label'); label.textContent = f.label; const dot = document.createElement('span'); dot.className = 'dot'; dot.title = 'Reset to default';
  const set = v => { f.value = v; if (same(v, f.def)) delete overrides[f.path]; else overrides[f.path] = v; r.classList.toggle('changed', f.path in overrides); push(); };
  let rng, num, col;
  if (f.type === 'number') {
    rng = Object.assign(document.createElement('input'), { type: 'range', min: f.min, max: f.max, step: f.step, value: f.value });
    num = Object.assign(document.createElement('input'), { type: 'number', step: f.step, value: f.value });
    rng.oninput = () => { num.value = rng.value; set(+rng.value); };
    num.onchange = () => { const v = +num.value; if (Number.isFinite(v)) { if (v < +rng.min) rng.min = v; if (v > +rng.max) rng.max = v; rng.value = v; set(v); } };
    r.append(label, rng, num, dot);
  } else {
    col = Object.assign(document.createElement('input'), { type: 'color', value: f.value }); col.oninput = () => set(col.value); r.append(label, col, dot);
  }
  dot.onclick = () => { if (!(f.path in overrides)) return; if (rng) { rng.value = f.def; num.value = f.def; } else col.value = f.def; set(f.def); };
  r.classList.toggle('changed', f.path in overrides);
  return r;
}

function filter() {
  const q = $('#search').value.trim().toLowerCase();
  for (const r of tree.querySelectorAll('.row')) r.hidden = !!q && !r.dataset.q.includes(q);
  for (const d of tree.querySelectorAll('details:not(.top)')) { const any = !!d.querySelector('.row:not([hidden])'); d.hidden = !any; if (q) d.open = any; }
  for (const d of tree.querySelectorAll('details.top')) { d.hidden = !d.querySelector('.row:not([hidden])'); if (q) d.open = !d.hidden; }
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

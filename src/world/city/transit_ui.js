/* Boarding the Metro (D6, fast travel): walk (or drive up) to a station entrance, "Metro: <station>, press J" appears; J opens the list of stations on the lines that call there, a click rides
   there (a short fade, the timetable clock moves on by the ride time) and puts you at the street next to the destination's entrance. Plain DOM, no game state of its own: the hook is
   `transit.onTeleport(x, z, yaw)` which main.js sets. Browser only. */
import { lineColour, DWELL } from './transit_plan.js';

const css = `#metroHint{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);background:rgba(10,14,22,.82);color:#fff;font:600 15px system-ui,sans-serif;padding:8px 16px;border-radius:8px;z-index:30;display:none;pointer-events:none}
#metroHint b{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:8px;vertical-align:-1px}
#metroPanel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,92vw);max-height:78vh;overflow:auto;background:rgba(12,16,26,.94);color:#eee;font:14px system-ui,sans-serif;border-radius:12px;padding:16px 18px;z-index:40;display:none;box-shadow:0 8px 40px #000a}
#metroPanel h2{margin:0 0 4px;font-size:19px}#metroPanel h3{margin:14px 0 6px;font-size:14px;display:flex;align-items:center;gap:8px}#metroPanel h3 i{display:inline-block;width:14px;height:14px;border-radius:3px}
#metroPanel .row{display:flex;flex-wrap:wrap;gap:6px}#metroPanel button{background:#1d2535;color:#eee;border:1px solid #33405a;border-radius:6px;padding:6px 10px;font:13px system-ui,sans-serif;cursor:pointer}#metroPanel button:hover{background:#2b3956}
#metroPanel .hi{opacity:.65;font-size:12px;margin-left:4px}#metroPanel .x{float:right;background:none;border:none;font-size:20px}
#metroFade{position:fixed;inset:0;background:#000;color:#fff;font:600 20px system-ui,sans-serif;display:none;align-items:center;justify-content:center;opacity:0;transition:opacity .6s;z-index:50;pointer-events:none}`;

export class TransitUI {
  constructor(T) {
    this.T = T; this.at = null; this.open = false; if (typeof document === 'undefined') return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    this.hint = el('div', 'metroHint'); this.panel = el('div', 'metroPanel'); this.fade = el('div', 'metroFade');
    addEventListener('keydown', e => { if (e.code === 'KeyJ' && !e.repeat) { if (this.open) this.close(); else if (this.at) this.show(); } else if (e.code === 'Escape' && this.open) { this.close(); e.stopPropagation(); } }, true);
  }
  update(px, pz) {
    if (!this.hint) return; let best = null, bd = 11;
    for (const [id, k] of this.T.stations) for (const a of k.access) { const d = Math.hypot(a.x - px, a.z - pz); if (d < bd) { bd = d; best = { id, k }; } }
    this.at = best; if (this.open && !best) this.close();
    if (best && !this.open) { const st = best.k.e.st, c = best.k.colours[0]; this.hint.innerHTML = '<b style="background:' + c + '"></b>Metro: ' + st.name.en + ' &nbsp;·&nbsp; press J'; this.hint.style.display = 'block'; } else this.hint.style.display = 'none';
  }
  /* the rides offered from a station: per line, every other station in the order of the line, with minutes by the timetable's own speeds */
  rides(stId) {
    const T = this.T, e = T.net.stations.get(stId), out = [];
    for (const per of e.st.per) {
      const line = T.lineOf.get(per.line), here = e.calls.find(c => c.R.line === per.line); if (!here) continue; const R = here.R, list = [];
      for (let k = 0; k < R.stops.length; k++) { if (k === here.k) continue; const o = T.net.byKey.get(R.stops[k].id); if (!o) continue; const mins = Math.max(1, Math.round((Math.abs(R.stops[k].s - here.s) / 13 + Math.abs(k - here.k) * DWELL) / 60)); list.push({ id: o.id, name: o.name, mins }); }
      out.push({ line, colour: lineColour(line), to: R.to, list });
    } return out;
  }
  show() {
    const T = this.T, st = this.at.k.e.st; let h = '<button class="x" id="mpX">×</button><h2>' + st.name.en + '<span class="hi">' + (st.name.hi || '') + '</span></h2><div style="opacity:.7">Choose a station to ride to</div>';
    for (const r of this.rides(this.at.id)) { h += '<h3><i style="background:' + r.colour + '"></i>' + r.line.name.en + ' <span class="hi">towards ' + r.to + '</span></h3><div class="row">'; for (const o of r.list) h += '<button data-id="' + o.id + '" data-m="' + o.mins + '" data-l="' + r.line.name.en + '">' + o.name.en + ' <span class="hi">' + o.mins + ' min</span></button>'; h += '</div>'; }
    this.panel.innerHTML = h; this.panel.style.display = 'block'; this.open = true; this.panel.querySelector('#mpX').onclick = () => this.close();
    this.panel.querySelectorAll('button[data-id]').forEach(b => { b.onclick = () => this.ride(b.dataset.id, +b.dataset.m, b.dataset.l); });
  }
  close() { this.open = false; if (this.panel) this.panel.style.display = 'none'; }
  /* ride to station `id`: fade, move the player to the street by its first entrance, move the clock on */
  ride(id, mins, lineName) {
    const T = this.T, e = T.net.stations.get(id), st = e.st, ent = st.entrances[0] || [st.x + 8, st.z]; this.close();
    this.fade.style.display = 'flex'; this.fade.textContent = lineName + ' to ' + st.name.en + ' (' + mins + ' min)'; requestAnimationFrame(() => { this.fade.style.opacity = '1'; });
    setTimeout(() => {
      const n = T.city.pack.nearestNode(ent[0], ent[1]), yaw = Math.atan2(st.z - n.z, st.x - n.x); T.t += mins * 60; if (T.onTeleport) T.onTeleport(n.x, n.z, yaw);
      setTimeout(() => { this.fade.style.opacity = '0'; setTimeout(() => { this.fade.style.display = 'none'; }, 700); }, 900);
    }, 800);
  }
}
function el(tag, id) { const d = document.createElement(tag); d.id = id; document.body.appendChild(d); return d; }

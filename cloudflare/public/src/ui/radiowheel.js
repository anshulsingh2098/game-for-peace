/* The radio wheel, in the style of the GTA 5 one: hold Q (or tap the Radio button), point at a station or use the arrow keys,
   release Q (or click / tap) to tune in. Two pages: India and World (Tab or E switches). The hub shows the station under the pointer,
   its logo, its genre, a volume slider and Radio off. Station logos come from the stations' own sites; a coloured badge with
   initials stands in if one cannot load. */
import { REGIONS } from '../audio/stations.js';

const mk = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
const hue = s => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
const initials = n => n.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '♪';

/* a station logo (or badge) as a DOM node */
export function logo(st, cls) {
  const box = mk('span', 'logo ' + (cls || '')); box.style.setProperty('--h', hue(st.name)); box.textContent = initials(st.name);
  if (st.icon) {
    const img = new Image(); img.alt = ''; img.referrerPolicy = 'no-referrer'; img.decoding = 'async';
    img.onload = () => { if (img.naturalWidth > 8) { box.textContent = ''; box.classList.add('img'); box.appendChild(img); } };
    img.src = st.icon;
  }
  return box;
}

export class RadioWheel {
  /* onTune(i) after a choice (i = station index, -2 for off); locked(bool) tells the game to ignore driving keys while the wheel is open */
  constructor(radio, { onTune, locked }) {
    this.radio = radio; this.onTune = onTune || (() => {}); this.setLocked = locked || (() => {});
    this.open = false; this.page = 0; this.sel = -1; this.items = []; this.heldAt = 0; this.moved = false; this.R = 200;
    const root = this.root = mk('div', 'rw'); root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Radio');
    this.ring = mk('div', 'rw-ring', root);
    const hub = mk('div', 'rw-hub', root);
    this.hubLogo = mk('div', 'rw-hublogo', hub); this.hubName = mk('div', 'rw-name', hub); this.hubSub = mk('div', 'rw-sub', hub);
    this.tabs = mk('div', 'rw-tabs', hub);
    REGIONS.forEach((r, i) => { const b = mk('button', '', this.tabs); b.type = 'button'; b.textContent = r; b.onclick = e => { e.stopPropagation(); this.setPage(i); }; });
    const vol = this.vol = mk('input', 'rw-vol', hub); vol.type = 'range'; vol.min = 0; vol.max = 100; vol.value = Math.round(radio.vol * 100); vol.setAttribute('aria-label', 'Radio volume');
    vol.oninput = () => radio.setVolume(vol.value / 100); vol.addEventListener('click', e => e.stopPropagation());
    const off = this.offBtn = mk('button', 'rw-off', hub); off.type = 'button'; off.textContent = 'Radio off'; off.onclick = e => { e.stopPropagation(); this.commit(-2); };
    document.body.appendChild(root);
    root.addEventListener('pointermove', e => this.point(e));
    root.addEventListener('pointerdown', e => { if (e.target === root || e.target === this.ring) this.close(); });
    addEventListener('resize', () => { if (this.open) this.layout(); });
    addEventListener('keydown', e => this.key(e), true); addEventListener('keyup', e => this.keyup(e), true);
    radio.on(() => this.refresh());
  }
  /* stations on the current page, with their index in the radio's list */
  list() { return this.radio.stations.map((s, i) => ({ s, i })).filter(x => (x.s.region === 'India') === (this.page === 0)); }
  setPage(p) { this.page = p; this.sel = -1; this.build(); this.layout(); this.refresh(); }
  build() {
    this.ring.textContent = ''; this.items = [];
    [...this.tabs.children].forEach((b, i) => b.classList.toggle('on', i === this.page));
    for (const x of this.list()) {
      const b = mk('button', 'rw-st', this.ring); b.type = 'button'; b.title = x.s.name; b.setAttribute('aria-label', x.s.name + ', ' + x.s.genre); b.appendChild(logo(x.s));
      const item = { b, i: x.i, s: x.s };
      b.onclick = e => { e.stopPropagation(); this.commit(x.i); };
      b.onpointerenter = () => { this.sel = this.items.indexOf(item); this.refresh(); };
      this.items.push(item);
    }
  }
  layout() {
    const n = this.items.length || 1, R = Math.max(110, Math.min(innerWidth, innerHeight) / 2 - 46), size = Math.max(36, Math.min(66, (2 * Math.PI * R) / n * 0.86));
    this.root.style.setProperty('--sz', size + 'px'); this.R = R;
    this.items.forEach((t, k) => { const a = -Math.PI / 2 + (k / n) * 2 * Math.PI; t.a = a; t.b.style.left = `calc(50% + ${Math.cos(a) * R}px)`; t.b.style.top = `calc(50% + ${Math.sin(a) * R}px)`; });
  }
  /* highlight the station the pointer points at (its angle from the centre), once the pointer has left the hub */
  point(e) {
    const dx = e.clientX - innerWidth / 2, dy = e.clientY - innerHeight / 2; if (Math.hypot(dx, dy) < this.R * 0.45 || !this.items.length) return;
    const a = Math.atan2(dy, dx); let best = 0, bd = 9;
    this.items.forEach((t, k) => { let d = Math.abs(a - t.a); d = Math.min(d, 2 * Math.PI - d); if (d < bd) { bd = d; best = k; } });
    if (best !== this.sel) { this.sel = best; this.moved = true; this.refresh(); }
  }
  refresh() {
    const st = this.radio.state(), cur = this.sel >= 0 ? this.items[this.sel] : null, shown = cur ? cur.s : st.station;
    this.items.forEach((t, k) => { t.b.classList.toggle('sel', k === this.sel); t.b.classList.toggle('now', t.i === st.index); });
    this.hubLogo.textContent = ''; if (shown) this.hubLogo.appendChild(logo(shown, 'big')); else this.hubLogo.textContent = '♪';
    this.hubName.textContent = shown ? shown.name : 'Radio off';
    this.hubSub.textContent = shown ? shown.genre + ' · ' + shown.region + (cur ? '' : st.error ? ' · off air' : st.loading ? ' · tuning…' : ' · now playing') : 'Hold Q, point, release';
    this.offBtn.disabled = st.index < 0; this.vol.value = Math.round(st.vol * 100);
  }
  show() {
    if (this.open) return; const st = this.radio.state();
    this.open = true; this.moved = false; this.page = st.station && st.station.region !== 'India' ? 1 : 0; this.root.hidden = false; this.setLocked(true); this.build(); this.layout();
    this.sel = st.station ? this.items.findIndex(t => t.i === st.index) : -1; this.refresh();
  }
  close() { if (!this.open) return; this.open = false; this.root.hidden = true; this.heldAt = 0; this.setLocked(false); }
  toggle() { if (this.open) this.close(); else { this.heldAt = 0; this.show(); } }
  /* i: station index, -2 for radio off */
  commit(i) { if (i === -2) this.radio.off(); else if (i >= 0) this.radio.tune(i); this.onTune(i); this.close(); }
  key(e) {
    if (e.target && e.target.tagName === 'INPUT' && e.target !== this.vol) return;
    if (e.code === 'KeyQ' && !e.ctrlKey && !e.metaKey) {
      e.stopImmediatePropagation(); if (e.repeat) return;
      if (this.open) this.close(); else { this.show(); this.heldAt = performance.now(); }
      return;
    }
    if (!this.open) return;
    const n = this.items.length, k = e.code, stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowUp') {
      stop(); const d = (k === 'ArrowRight' || k === 'ArrowDown') ? 1 : -1;
      this.sel = this.sel < 0 ? (d > 0 ? 0 : n - 1) : (this.sel + d + n) % n; this.moved = true; this.refresh();
    } else if (k === 'Tab' || k === 'KeyE') { stop(); this.setPage((this.page + 1) % REGIONS.length); }
    else if (k === 'Enter' || k === 'Space') { stop(); if (this.sel >= 0) this.commit(this.items[this.sel].i); else this.close(); }
    else if (k === 'Escape') { stop(); this.close(); }
    else if (k === 'KeyX' || k === 'Backspace') { stop(); this.commit(-2); }
  }
  /* releasing Q after a hold tunes the highlighted station; a quick tap leaves the wheel open */
  keyup(e) {
    if (e.code !== 'KeyQ' || !this.open || !this.heldAt) return; e.stopImmediatePropagation();
    const held = performance.now() - this.heldAt; this.heldAt = 0;
    if (held > 280) { if (this.moved && this.sel >= 0) this.commit(this.items[this.sel].i); else this.close(); }
  }
}

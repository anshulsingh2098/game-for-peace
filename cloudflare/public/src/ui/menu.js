/* Menus: title screen, garage, settings and pause. The game keeps running behind them, frozen, with the camera orbiting the vehicle on the
   title and garage screens. The Menu owns only the screens; everything it changes goes through the `api` object main.js passes in:
     api.vehicles (the defs), api.state() -> { vehicle, paint{}, time, weather, quality, shadows, lights, muted, radioVol }
     api.play() api.pickVehicle(i) api.paint(i, colour) api.set(name, value) api.newWorld() api.toRoad() api.radio() api.onOpen(screen) api.onClose() */
const mk = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; };
const btn = (parent, label, fn, cls) => { const b = mk('button', cls || '', parent, label); b.type = 'button'; b.onclick = e => { e.stopPropagation(); fn(); b.blur(); }; return b; };

const OPTIONS = {
  time: [['dawn', 'Dawn'], ['day', 'Day'], ['dusk', 'Dusk'], ['night', 'Night'], ['auto', 'Cycle']],
  weather: [['clear', 'Clear'], ['overcast', 'Cloudy'], ['fog', 'Fog'], ['rain', 'Rain'], ['storm', 'Storm'], ['snow', 'Snow'], ['auto', 'Changing']],
  quality: [['low', 'Low'], ['med', 'Medium'], ['high', 'High']],
  shadows: [['on', 'On'], ['off', 'Off']],
  lights: [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']],
  sound: [['on', 'On'], ['off', 'Off']]
};
const KEYS = [['W A S D / arrows', 'Drive (S reverses)'], ['Space', 'Brake'], ['X', 'Handbrake'], ['Shift', 'Use your vehicle\'s boost'], ['E', 'Autodrive'], ['V', 'Change camera view'], ['C', 'Driver\'s seat and back'], ['B', 'Back onto the road'], ['L', 'Headlights'], ['Hold Q', 'Radio wheel (Tab: India / World)'], ['M', 'Sound on / off'], ['Esc', 'Pause']];

export class Menu {
  constructor(api) {
    this.api = api; this.screen = null; this.root = mk('div', 'menu'); this.root.hidden = true; document.body.appendChild(this.root);
    this.root.addEventListener('pointerdown', e => e.stopPropagation());
  }
  get open() { return this.screen !== null; }
  show(screen) {
    const was = this.screen; this.screen = screen; this.root.hidden = false; this.root.dataset.screen = screen; this.root.textContent = '';
    ({ title: () => this.title(), garage: () => this.garage(), locations: () => this.locations(), settings: () => this.settings(), pause: () => this.pause() })[screen]();
    if (!was) this.api.onOpen(screen); else this.api.onScreen && this.api.onScreen(screen);
  }
  hide() { if (!this.screen) return; this.screen = null; this.root.hidden = true; this.api.onClose(); }
  /* Esc: back out of a screen, or open / close the pause menu while driving */
  escape() {
    if (!this.screen) this.show('pause');
    else if (this.screen === 'pause') this.hide();
    else if (this.screen === 'title') return;
    else this.show(this.from || 'pause');
  }
  open2(screen, from) { this.from = from; this.show(screen); }

  title() {
    const p = mk('div', 'm-panel m-title', this.root);
    mk('div', 'm-kicker', p, 'A drive through an endless, generated world');
    mk('h1', '', p, 'Game for Peace');
    const col = mk('div', 'm-col', p);
    btn(col, 'Play', () => this.hide(), 'primary'); btn(col, 'Garage', () => this.open2('garage', 'title')); btn(col, 'Location', () => this.open2('locations', 'title')); btn(col, 'Settings', () => this.open2('settings', 'title'));
    mk('div', 'm-hint', p, 'Pick a car, truck or bike, then roam. Hold Q at any time to tune a live radio station from around the world, including India.');
  }

  garage() {
    const api = this.api, st = api.state(), p = mk('div', 'm-panel m-side', this.root);
    mk('h2', '', p, 'Garage');
    const cards = mk('div', 'm-cards', p), def = api.vehicles[st.vehicle];
    api.vehicles.forEach((v, i) => { const b = mk('button', 'm-card' + (i === st.vehicle ? ' on' : ''), cards); b.type = 'button'; b.style.setProperty('--c', v.color);
      mk('b', '', b, v.name); mk('small', '', b, v.tag); b.onclick = e => { e.stopPropagation(); Promise.resolve(api.pickVehicle(i)).then(() => { if (this.screen === 'garage') this.show('garage'); }); }; });
    mk('p', 'm-desc', p, def.desc);
    const bars = mk('div', 'm-bars', p);
    for (const k of ['Speed', 'Accel', 'Handling', 'Grip']) { const r = mk('div', 'm-bar', bars); mk('span', '', r, k); const t = mk('i', '', r); mk('u', '', t).style.width = def.stats[k] + '%'; }
    mk('div', 'm-top', p, 'Top speed ' + def.stats.Top + ' km/h');
    const buff = mk('div', 'm-buff', p); mk('b', '', buff, def.buff.name + ' (Shift)'); mk('span', '', buff, def.buff.desc + ' ' + def.buff.secs + ' s, then ' + def.buff.cooldown + ' s to recharge.');
    mk('h3', '', p, def.paint.label + ' colour'); const sw = mk('div', 'm-sw', p), cur = st.paint[def.id] || def.paint.colors[0];
    for (const c of def.paint.colors) { const b = mk('button', 'sw', sw); b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', 'Colour ' + c); b.setAttribute('aria-pressed', c === cur);
      b.onclick = e => { e.stopPropagation(); api.paint(st.vehicle, c); for (const x of sw.children) x.setAttribute('aria-pressed', x === b); }; }
    const row = mk('div', 'm-row', p); btn(row, 'Drive', () => this.hide(), 'primary'); btn(row, 'Back', () => this.show(this.from || 'title'));
  }

  locations() {
    const api = this.api, st = api.state(), p = mk('div', 'm-panel m-side', this.root); mk('h2', '', p, 'Location');
    mk('p', 'm-desc', p, 'Each place has its own land, colours, plants and light. The world is made fresh when you pick one.');
    const list = mk('div', 'm-locs', p);
    for (const L of api.locations) { const b = mk('button', 'm-loc' + (L.id === st.location ? ' on' : ''), list); b.type = 'button'; b.style.setProperty('--c', L.accent); mk('b', '', b, L.name); mk('small', '', b, L.blurb);
      b.onclick = e => { e.stopPropagation(); api.setLocation(L.id); this.show('locations'); }; }
    const row = mk('div', 'm-row', p); btn(row, 'Drive', () => this.hide(), 'primary'); btn(row, 'Back', () => this.show(this.from || 'title'));
  }

  settings() {
    const api = this.api, p = mk('div', 'm-panel m-side m-scroll', this.root); mk('h2', '', p, 'Settings');
    const seg = (label, key, cur, note) => { const g = mk('div', 'm-group', p); mk('h3', '', g, label); const row = mk('div', 'm-seg', g);
      for (const [v, t] of OPTIONS[key === 'sfx' ? 'sound' : key]) { const b = btn(row, t, () => { api.set(key, v); for (const x of row.children) x.setAttribute('aria-pressed', x === b); }); b.setAttribute('aria-pressed', v === cur); }
      if (note) mk('small', '', g, note); };
    const s = api.state();
    seg('Time of day', 'time', s.time); seg('Weather', 'weather', s.weather); seg('Headlights', 'lights', s.lights);
    seg('Graphics quality', 'quality', s.quality, 'Changing this reloads the world.'); seg('Shadows', 'shadows', s.shadows ? 'on' : 'off', 'Changing this reloads the world.');
    seg('Engine and weather sounds', 'sfx', s.muted ? 'off' : 'on');
    const g = mk('div', 'm-group', p); mk('h3', '', g, 'Radio volume'); const v = mk('input', 'm-range', g); v.type = 'range'; v.min = 0; v.max = 100; v.value = Math.round(s.radioVol * 100); v.oninput = () => api.set('radioVol', v.value / 100);
    const rb = mk('div', 'm-row', g); btn(rb, 'Open radio', () => api.radio());
    const k = mk('div', 'm-group', p); mk('h3', '', k, 'Controls'); const t = mk('div', 'm-keys', k); for (const [a, b] of KEYS) { mk('b', '', t, a); mk('span', '', t, b); }
    mk('small', '', k, 'On a phone or tablet the pads and buttons appear on screen.');
    const row = mk('div', 'm-row', p); btn(row, 'Back', () => this.show(this.from || 'pause'), 'primary');
  }

  pause() {
    const api = this.api, p = mk('div', 'm-panel m-title', this.root); mk('h2', '', p, 'Paused');
    const col = mk('div', 'm-col', p);
    btn(col, 'Resume', () => this.hide(), 'primary'); btn(col, 'Garage', () => this.open2('garage', 'pause')); btn(col, 'Location', () => this.open2('locations', 'pause')); btn(col, 'Settings', () => this.open2('settings', 'pause'));
    btn(col, 'Back to the road', () => { api.toRoad(); this.hide(); }); btn(col, 'New world', () => { api.newWorld(); this.hide(); }); btn(col, 'Title screen', () => this.show('title'));
  }
}

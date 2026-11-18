/* The place-name banner for phones (owner, 20 Nov 2026: no floating road numbers or name boards on a small screen; instead the name of the place when you arrive, which comes and goes).
   update(x, z, dt) looks at the named places of the city pack (landmarks.json, 63 of them: markets, districts, stations, forts). The first time you come within the place's reach it fades in at the top
   centre ("Karol Bagh" with the Hindi under it), stays about 3.5 s and fades out; it shows again only after you have left that place (farther than 1.6 x its reach) and then come back.
   Names lose their bracket: "Karol Bagh (Ajmal Khan Road)" is shown as "Karol Bagh". Pure helpers (shortName, reach) are tested in tools/selftest.mjs. */
export const shortName = s => String(s || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
export const reach = l => ({ district: 380, market: 300, station: 260, bus: 220, airport: 400, stadium: 300, fort: 300, garden: 260, zoo: 260 }[l.type] || 200);
const CSS = `#place { position: fixed; left: 50%; top: max(54px, calc(env(safe-area-inset-top) + 44px)); transform: translateX(-50%); z-index: 6; pointer-events: none; text-align: center; opacity: 0; transition: opacity .6s ease; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,.65); max-width: 86vw; }
#place.on { opacity: 1; } #place b { display: block; font: 700 26px/1.15 system-ui, sans-serif; letter-spacing: .02em; } #place i { display: block; font: 500 16px/1.3 system-ui, "Noto Sans Devanagari", "Kohinoor Devanagari", sans-serif; font-style: normal; color: #f0d98c; margin-top: 2px; }`;
export class PlaceBanner {
  constructor(getPlaces) {
    this.get = getPlaces; this.inside = new Set(); this.hide = 0; this.t = 0;
    const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
    const e = document.createElement('div'); e.id = 'place'; e.innerHTML = '<b></b><i></i>'; e.setAttribute('role', 'status'); document.body.append(e); this.el = e; this.b = e.querySelector('b'); this.i = e.querySelector('i');
  }
  show(l) { this.b.textContent = shortName(l.name && l.name.en); this.i.textContent = (l.name && l.name.hi) || ''; this.el.classList.add('on'); this.hide = 3.5; }
  update(x, z, dt) {
    const places = this.get() || []; this.t += dt;
    if (this.hide > 0) { this.hide -= dt; if (this.hide <= 0) this.el.classList.remove('on'); }
    if (this.t < 0.5) return; this.t = 0;                                  // a check twice a second is plenty
    for (const l of places) { const d = Math.hypot(l.x - x, l.z - z), r = reach(l);
      if (this.inside.has(l.id)) { if (d > r * 1.6) this.inside.delete(l.id); }
      else if (d < r) { this.inside.add(l.id); this.show(l); } }
  }
}

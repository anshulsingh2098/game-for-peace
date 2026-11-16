/* Station departure board and announcements (the words come from world/rail_timetable.js).
   StationBoard: a small panel at the top of the screen while the player is at a station: the station name, the railway clock and the next departures with real train numbers and times.
   Announcer: reads an announcement aloud with the browser's SpeechSynthesis, English and then Hindi, in an Indian English or Hindi voice when the device has one; skipped when sound is off. The speech is generated on the device;
   no recordings are used or sent anywhere. */
export class StationBoard {
  constructor(parent = document.body) {
    this.el = document.createElement('div'); this.el.id = 'stationboard'; this.el.style.cssText = 'position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:19;display:none;min-width:260px;max-width:92vw;padding:8px 12px;border-radius:12px;background:rgba(10,14,22,.82);border:1px solid rgba(255,255,255,.25);color:#fff;font:13px/1.45 system-ui,sans-serif;pointer-events:none';
    parent.appendChild(this.el); this.key = '';
  }
  show(name, hi, clock, rows) {
    const key = name + clock + rows.map(r => r.n + r.time).join(); if (key === this.key) return; this.key = key; this.el.style.display = 'block';
    this.el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:14px;font-weight:700"><span>${esc(name)}${hi ? ' · ' + esc(hi) : ''}</span><span style="color:#f2c230">${esc(clock)}</span></div>` + (rows.length ? rows.map(r => `<div style="display:flex;gap:8px"><span style="color:#9cc4ff;min-width:46px">${esc(r.time)}</span><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.n)} ${esc(r.name)}</span><span style="opacity:.8">${esc(r.to)}</span></div>`).join('') : '<div style="opacity:.7">No trains listed for this station</div>');
  }
  hide() { if (this.key !== '') { this.key = ''; this.el.style.display = 'none'; } }
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Announcer {
  constructor() { this.last = 0; this.queue = []; this.muted = false; this.ok = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; this.voices = null; }
  pick(lang) { if (!this.ok) return null; if (!this.voices || !this.voices.length) this.voices = speechSynthesis.getVoices(); const v = this.voices || [], pre = lang.slice(0, 2).toLowerCase(); return v.find(x => x.lang && x.lang.replace('_', '-').toLowerCase() === lang.toLowerCase()) || v.find(x => x.lang && x.lang.toLowerCase().startsWith(pre)) || null; }
  /* say { en, hi }; at most one announcement every `gap` seconds */
  say(a, now, gap = 25) {
    if (!this.ok || this.muted || !a || now - this.last < gap * 1000) return false; this.last = now;
    try { speechSynthesis.cancel(); for (const [lang, text] of [['en-IN', a.en], ['hi-IN', a.hi]]) { if (!text) continue; const u = new SpeechSynthesisUtterance(text), v = this.pick(lang); u.lang = lang; if (v) u.voice = v; u.rate = 0.9; u.pitch = 1; u.volume = 0.9; speechSynthesis.speak(u); } } catch (e) { return false; }
    return true;
  }
  stop() { if (this.ok) try { speechSynthesis.cancel(); } catch (e) { /* nothing to stop */ } }
}

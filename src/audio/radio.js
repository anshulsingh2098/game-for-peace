/* The radio of the new engine: one <audio> element that plays either a live internet station or one of the player's own songs ("My music").
   Live:     radio.tune(i) plays station i of the list in stations.js; radio.off() stops it and drops the connection.
   My music: radio.addFiles(files) adds songs the player chose or dropped; radio.playLocal(k) plays song k; songs play on one after another.
             The files never leave the device: they are kept in this browser (IndexedDB) so they are still there next visit, and are not
             uploaded to the server. radio.removeLocal(k) and radio.clearLocal() delete them.
   on(fn) reports { mode, index, station, track, playing, loading, error, vol, ... } after every change. */
import { STATIONS } from './stations.js';

const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i;
/* file name -> { title, artist }: drop the extension, track numbers and "(official video)" noise, split "Artist - Title" */
export function cleanName(name) {
  let n = name.replace(AUDIO_EXT, '').replace(/^AudioTranscriberAI_/, '').replace(/[\s_]+/g, ' ').trim()
    .replace(/^\d{1,3}[\s.\-_)]+/, '').replace(/\s*[(\[](official|lyrics?|audio|video|hd|hq|music video)[^)\]]*[)\]]/ig, '');
  n = n.replace(/\s+/g, ' ').replace(/^[ -]+|[ -]+$/g, '') || 'Untitled';
  const k = n.indexOf(' - ');
  return k < 0 ? { title: n, artist: '' } : { title: n.slice(k + 3).trim(), artist: n.slice(0, k).trim() };
}

/* tiny IndexedDB wrapper: every call resolves, and quietly does nothing where storage is blocked (private windows, old browsers) */
const DB = 'gfp-music', STORE = 'tracks';
function db() {
  return new Promise(ok => {
    try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key' }); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); r.onblocked = () => ok(null); } catch (e) { ok(null); }
  });
}
const idb = async (mode, fn) => { const d = await db(); if (!d) return null; return new Promise(ok => { try { const t = d.transaction(STORE, mode), q = fn(t.objectStore(STORE)); t.oncomplete = () => { d.close(); ok(q && 'result' in q ? q.result : true); }; t.onerror = t.onabort = () => { d.close(); ok(null); }; } catch (e) { ok(null); } }); };

export class Radio {
  constructor() {
    this.stations = STATIONS; this.index = -1; this.track = -1; this.local = []; this.mode = 'off'; this.vol = 0.6; this.muted = false; this.error = false; this.loading = false; this.fn = [];
    const a = this.audio = new Audio(); a.preload = 'none'; a.volume = this.vol;
    a.addEventListener('playing', () => { this.loading = false; this.error = false; this.emit(); });
    a.addEventListener('waiting', () => { if (this.mode !== 'off') { this.loading = true; this.emit(); } });
    a.addEventListener('error', () => { if (!a.getAttribute('src')) return; this.loading = false; this.error = true; this.emit(); if (this.mode === 'local') setTimeout(() => this.error && this.stepLocal(+1), 900); });
    a.addEventListener('stalled', () => { if (this.mode === 'live' && !this.error) { this.loading = true; this.emit(); } });
    a.addEventListener('ended', () => { if (this.mode === 'local') this.stepLocal(+1); });
    this.loadSaved();
  }
  on(fn) { this.fn.push(fn); }
  get station() { return this.mode === 'live' ? this.stations[this.index] || null : null; }
  get trackInfo() { return this.mode === 'local' ? this.local[this.track] || null : null; }
  /* a local song shaped like a station, so the wheel and the "now playing" chip can show either */
  localStation(k) { const t = this.local[k]; return t ? { id: t.key, name: t.title, genre: t.artist || 'My music', region: 'My music', icon: '', url: t.url, local: true } : null; }
  state() {
    return { mode: this.mode, index: this.index, station: this.station, track: this.track, trackInfo: this.trackInfo, localCount: this.local.length, playing: this.mode !== 'off' && !this.error, loading: this.loading, error: this.error, vol: this.vol };
  }
  emit() { const s = this.state(); for (const f of this.fn) f(s); }

  /* ---- live stations ---- */
  tune(i) {
    if (i < 0 || i >= this.stations.length) return this.off();
    const a = this.audio; this.mode = 'live'; this.index = i; this.track = -1; this.error = false; this.loading = true;
    a.src = this.stations[i].url; a.volume = this.muted ? 0 : this.vol; this.emit();
    a.play().catch(() => { if (this.mode === 'live' && this.index === i) { this.loading = false; this.error = a.error != null; this.emit(); } });          // a blocked start (no tap yet) is not an error
  }
  step(d) { const n = this.stations.length; this.tune(this.index < 0 ? (d > 0 ? 0 : n - 1) : (this.index + d + n) % n); }
  off() { const a = this.audio; this.mode = 'off'; this.index = -1; this.track = -1; this.error = false; this.loading = false; a.pause(); if (a.getAttribute('src')) { a.removeAttribute('src'); a.load(); } this.emit(); }

  /* ---- my music ---- */
  playLocal(k) {
    const t = this.local[k]; if (!t) return this.off();
    const a = this.audio; this.mode = 'local'; this.track = k; this.index = -1; this.error = false; this.loading = true; a.src = t.url; a.volume = this.muted ? 0 : this.vol; this.emit();
    a.play().catch(() => { if (this.mode === 'local' && this.track === k) { this.loading = false; this.error = a.error != null; this.emit(); } });
  }
  stepLocal(d) { const n = this.local.length; if (!n) return this.off(); this.playLocal(this.track < 0 ? (d > 0 ? 0 : n - 1) : (this.track + d + n) % n); }
  /* add songs the player picked or dropped (a FileList or an array); returns how many were new. Only audio files are kept. */
  addFiles(files, save = true) {
    let added = 0;
    for (const f of files) {
      if (!f || !((f.type || '').startsWith('audio/') || AUDIO_EXT.test(f.name || ''))) continue;
      const key = f.name + ':' + f.size; if (this.local.some(t => t.key === key)) continue;
      this.local.push({ ...cleanName(f.name), key, url: URL.createObjectURL(f), size: f.size }); added++;
      if (save) idb('readwrite', s => s.put({ key, name: f.name, type: f.type, size: f.size, blob: f }));
    }
    if (added) this.emit(); return added;
  }
  removeLocal(k) {
    const t = this.local[k]; if (!t) return; const playing = this.mode === 'local' && this.track === k;
    this.local.splice(k, 1); URL.revokeObjectURL(t.url); idb('readwrite', s => s.delete(t.key));
    if (playing) { if (this.local.length) this.playLocal(Math.min(k, this.local.length - 1)); else this.off(); } else { if (this.mode === 'local' && this.track > k) this.track--; this.emit(); }
  }
  clearLocal() { if (this.mode === 'local') this.off(); for (const t of this.local) URL.revokeObjectURL(t.url); this.local = []; idb('readwrite', s => s.clear()); this.emit(); }
  /* songs kept from an earlier visit */
  async loadSaved() {
    const rows = await idb('readonly', s => s.getAll()); if (!Array.isArray(rows) || !rows.length) return;
    const files = rows.sort((a, b) => a.name < b.name ? -1 : 1).map(r => new File([r.blob], r.name, { type: r.type })); this.addFiles(files, false);
  }

  setVolume(v) { this.vol = Math.max(0, Math.min(1, v)); if (!this.muted) this.audio.volume = this.vol; this.emit(); }
  setMuted(m) { this.muted = m; this.audio.volume = m ? 0 : this.vol; }
}

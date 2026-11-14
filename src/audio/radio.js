/* Live radio for the new engine: one <audio> element playing an internet stream, or the player's own songs ("My music", from their device, never uploaded).
   radio.tune(i) plays station i, radio.off() stops it (and drops the connection so nothing downloads), radio.step(+1/-1) goes to the next or
   previous station. on(fn) reports { index, station, playing, error, vol } after every change. */
import { STATIONS } from './stations.js';
import { classify, cleanName } from './localmusic.js';

export class Radio {
  constructor() {
    this.stations = [...STATIONS]; this.local = { id: 'my-music', name: 'My music', region: 'Mine', genre: 'your songs', url: '', icon: '', local: true, tracks: [], k: 0 }; this.index = -1; this.vol = 0.6; this.muted = false; this.error = false; this.loading = false; this.fn = [];
    const a = this.audio = new Audio(); a.preload = 'none'; a.volume = this.vol;
    a.addEventListener('playing', () => { this.loading = false; this.error = false; this.emit(); });
    a.addEventListener('waiting', () => { if (this.index >= 0) { this.loading = true; this.emit(); } });
    a.addEventListener('error', () => { if (!a.getAttribute('src')) return; this.loading = false; this.error = true; this.emit(); });
    a.addEventListener('ended', () => { const st = this.station; if (st && st.local) this.skipTrack(1); });                       // your songs play one after the other, round and round
    a.addEventListener('stalled', () => { if (this.index >= 0 && !this.error) { this.loading = true; this.emit(); } });
  }
  on(fn) { this.fn.push(fn); }
  get station() { return this.stations[this.index] || null; }
  state() { const st = this.station; return { track: st && st.local && st.tracks[st.k] ? st.tracks[st.k].name : null, index: this.index, station: this.station, playing: this.index >= 0 && !this.error, loading: this.loading, error: this.error, vol: this.vol }; }
  emit() { const s = this.state(); for (const f of this.fn) f(s); }
  tune(i) {
    if (i < 0 || i >= this.stations.length) return this.off();
    const a = this.audio; this.index = i; this.error = false; this.loading = true;
    const st = this.stations[i]; if (st.local) st.k = Math.min(st.k, st.tracks.length - 1);
    a.src = st.local ? st.tracks[st.k].url : st.url; a.volume = this.muted ? 0 : this.vol; this.emit();
    a.play().catch(() => { if (this.index === i) { this.loading = false; this.error = a.error != null; this.emit(); } });          // a blocked start (no tap yet) is not an error: it plays on the next tune
  }
  /* My music: files picked by the player ({ name, type, size } File objects). Returns { added, skipped: [{ name, reason }] }. They stay on the device: object URLs, never uploaded. */
  addLocal(files) {
    const { ok, skipped } = classify([...files], this.local.tracks.length);
    for (const f of ok) this.local.tracks.push({ name: cleanName(f.name), url: URL.createObjectURL(f) });
    this.syncLocal(); return { added: ok.length, skipped };
  }
  /* forget the songs and free them */
  clearLocal() { const was = this.station === this.local; for (const t of this.local.tracks) URL.revokeObjectURL(t.url); this.local.tracks = []; this.local.k = 0; if (was) this.off(); this.syncLocal(); }
  syncLocal() {
    const L = this.local, n = L.tracks.length, at = this.stations.indexOf(L); L.genre = n + (n === 1 ? ' song' : ' songs');
    if (n && at < 0) this.stations.push(L); else if (!n && at >= 0) { if (this.index > at) this.index--; this.stations.splice(at, 1); }
    this.emit();
  }
  /* in My music: the next (+1) or previous (-1) song */
  skipTrack(d) {
    const st = this.station; if (!st || !st.local || !st.tracks.length) return;
    st.k = (st.k + d + st.tracks.length) % st.tracks.length; const a = this.audio; a.src = st.tracks[st.k].url; this.loading = true; this.emit(); a.play().catch(() => { this.loading = false; this.emit(); });
  }
  off() { const a = this.audio; this.index = -1; this.error = false; this.loading = false; a.pause(); if (a.getAttribute('src')) { a.removeAttribute('src'); a.load(); } this.emit(); }
  step(d) { const n = this.stations.length; this.tune(this.index < 0 ? (d > 0 ? 0 : n - 1) : (this.index + d + n) % n); }
  setVolume(v) { this.vol = Math.max(0, Math.min(1, v)); if (!this.muted) this.audio.volume = this.vol; this.emit(); }
  setMuted(m) { this.muted = m; this.audio.volume = m ? 0 : this.vol; }
}

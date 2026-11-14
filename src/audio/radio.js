/* Live radio for the new engine: one <audio> element playing an internet stream. No files, no uploads.
   radio.tune(i) plays station i, radio.off() stops it (and drops the connection so nothing downloads), radio.step(+1/-1) goes to the next or
   previous station. on(fn) reports { index, station, playing, error, vol } after every change. */
import { STATIONS } from './stations.js';

export class Radio {
  constructor() {
    this.stations = STATIONS; this.index = -1; this.vol = 0.6; this.muted = false; this.error = false; this.loading = false; this.fn = [];
    const a = this.audio = new Audio(); a.preload = 'none'; a.volume = this.vol;
    a.addEventListener('playing', () => { this.loading = false; this.error = false; this.emit(); });
    a.addEventListener('waiting', () => { if (this.index >= 0) { this.loading = true; this.emit(); } });
    a.addEventListener('error', () => { if (!a.getAttribute('src')) return; this.loading = false; this.error = true; this.emit(); });
    a.addEventListener('stalled', () => { if (this.index >= 0 && !this.error) { this.loading = true; this.emit(); } });
  }
  on(fn) { this.fn.push(fn); }
  get station() { return this.stations[this.index] || null; }
  state() { return { index: this.index, station: this.station, playing: this.index >= 0 && !this.error, loading: this.loading, error: this.error, vol: this.vol }; }
  emit() { const s = this.state(); for (const f of this.fn) f(s); }
  tune(i) {
    if (i < 0 || i >= this.stations.length) return this.off();
    const a = this.audio; this.index = i; this.error = false; this.loading = true;
    a.src = this.stations[i].url; a.volume = this.muted ? 0 : this.vol; this.emit();
    a.play().catch(() => { if (this.index === i) { this.loading = false; this.error = a.error != null; this.emit(); } });          // a blocked start (no tap yet) is not an error: it plays on the next tune
  }
  off() { const a = this.audio; this.index = -1; this.error = false; this.loading = false; a.pause(); if (a.getAttribute('src')) { a.removeAttribute('src'); a.load(); } this.emit(); }
  step(d) { const n = this.stations.length; this.tune(this.index < 0 ? (d > 0 ? 0 : n - 1) : (this.index + d + n) % n); }
  setVolume(v) { this.vol = Math.max(0, Math.min(1, v)); if (!this.muted) this.audio.volume = this.vol; this.emit(); }
  setMuted(m) { this.muted = m; this.audio.volume = m ? 0 : this.vol; }
}

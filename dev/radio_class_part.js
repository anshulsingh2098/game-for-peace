export class Radio {
  constructor(sound) {
    this.sound = sound; this.audio = new Audio(); this.audio.preload = 'none'; this.stations = []; this.si = 0; this.order = []; this.pos = 0; this.shuffle = true;
    this.listeners = []; this.connected = false; this.cur = null; this.fails = 0;
    this.audio.addEventListener('ended', () => this.next(true));
    this.audio.addEventListener('timeupdate', () => this.emit()); this.audio.addEventListener('play', () => { this.fails = 0; this.emit(); }); this.audio.addEventListener('pause', () => this.emit());
    this.audio.addEventListener('error', () => { if (++this.fails <= this.tracks.length) setTimeout(() => this.next(true), 600); this.emit(); });
  }
  on(fn) { this.listeners.push(fn); }
  async load(url) {
    try { const r = await fetch(url); const j = await r.json(); this.stations = (j.stations || []).filter(s => s.tracks && s.tracks.length); } catch (e) { this.stations = []; }
    this.si = 0; this.buildOrder(); this.emit();
  }
  get tracks() { return (this.stations[this.si] || {}).tracks || []; }
  get track() { return this.tracks[this.order[this.pos]]; }
  buildOrder() { const n = this.tracks.length; this.order = [...Array(n).keys()]; if (this.shuffle) for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.order[i], this.order[j]] = [this.order[j], this.order[i]]; } this.pos = 0; }
  connect() { if (this.connected || !this.sound.ctx) return; try { this.sound.ctx.createMediaElementSource(this.audio).connect(this.sound.musicBus); this.connected = true; } catch (e) { /* already connected */ } }
  async play() {
    const t = this.track; if (!t) return false; this.sound.init(); this.sound.resume(); this.sound.applyVolumes(); this.connect();
    if (this.cur !== t.file) { this.audio.src = t.file; this.cur = t.file; }
    try { await this.audio.play(); return true; } catch (e) { return false; }
  }
  pause() { this.audio.pause(); }
  toggle() { return this.audio.paused ? this.play() : (this.pause(), false); }
  async next(auto) { if (!this.tracks.length) return; this.pos = (this.pos + 1) % this.tracks.length; if (this.pos === 0 && this.shuffle) this.buildOrder(); this.cur = null; await this.play(); this.emit(); }
  async prev() { if (!this.tracks.length) return; if (this.audio.currentTime > 4) { this.audio.currentTime = 0; return; } this.pos = (this.pos - 1 + this.tracks.length) % this.tracks.length; this.cur = null; await this.play(); this.emit(); }
  setStation(i) { const was = !this.audio.paused; this.si = clamp(i, 0, this.stations.length - 1); this.buildOrder(); this.cur = null; if (was) this.play(); this.emit(); }
  setShuffle(on) { this.shuffle = on; const cur = this.track; this.buildOrder(); if (cur) { const k = this.tracks.indexOf(cur); if (k >= 0) { this.order = this.order.filter(x => x !== k); this.order.unshift(k); this.pos = 0; } } this.emit(); }
  state() { return { track: this.track, playing: !this.audio.paused, t: this.audio.currentTime || 0, d: this.audio.duration || 0, stations: this.stations, si: this.si, shuffle: this.shuffle, has: this.tracks.length > 0 }; }
  emit() { const s = this.state(); for (const f of this.listeners) f(s); }
}

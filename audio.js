/* Game for Peace - audio: the radio (streams your songs) and the sound effects.
   Every effect is synthesised: a V8 car with turbo and exhaust pops, a diesel truck with air brakes, an electric bike. */
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rand = (a, b) => a + Math.random() * (b - a);

/* per-vehicle engine character */
const CFG = {
  car:   { kind: 'v8',     idle: 850, max: 7200, G: 5, pulse: r => r / 15, vol: 0.55, cutLo: 520, cutHi: 4600, lope: 0.32, growl: 0.55, whine: 0.10, hiss: 0.20 },
  truck: { kind: 'diesel', idle: 620, max: 2100, G: 8, pulse: r => r / 20, vol: 0.72, cutLo: 300, cutHi: 1700, lope: 0.28, growl: 0.28, whine: 0.04, hiss: 0.10 },
  bike:  { kind: 'ev',     idle: 0,   max: 1,    G: 1, pulse: () => 0,     vol: 0.95, cutLo: 900, cutHi: 6000, lope: 0,    growl: 0,    whine: 0,    hiss: 0.05 }
};

export class Sound {
  constructor() { this.ctx = null; this.music = 0.5; this.sfx = 0.6; this.engineOn = false; this.voice = null; this.vid = null; this.prev = {}; this.rpmSm = 0; this.lastT = 0; this._thunder = false; }
  init() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.connect(c.destination);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);                  // volume for every sound effect
    // effects enter here: cabin muffler (driver view) -> dry + a touch of room reverb
    this.fxIn = c.createGain(); this.cabin = c.createBiquadFilter(); this.cabin.type = 'lowpass'; this.cabin.frequency.value = 18000; this.fxIn.connect(this.cabin);
    this.cabin.connect(this.sfxBus);
    const ir = c.createBuffer(2, Math.floor(c.sampleRate * 1.3), c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
    const conv = c.createConvolver(); conv.buffer = ir; this.wet = c.createGain(); this.wet.gain.value = 0.16; this.cabin.connect(conv); conv.connect(this.wet); this.wet.connect(this.sfxBus);
    // shared noise
    const nb = this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const mk = (type, freq, Q) => { const src = c.createBufferSource(); src.buffer = nb; src.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q;
      const g = c.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(this.fxIn); src.start(); return { g, f }; };
    this.wind = mk('bandpass', 700, 0.5); this.rainN = mk('highpass', 2800, 0.5); this.hum = mk('lowpass', 180, 0.7); this.gravel = mk('bandpass', 1700, 0.9);
    this.applyVolumes(); return c;
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  applyVolumes() { if (!this.ctx) return; const t = this.ctx.currentTime; this.musicBus.gain.setTargetAtTime(this.music, t, 0.05); this.sfxBus.gain.setTargetAtTime(this.sfx, t, 0.05); }
  setEngineOn(on) {
    this.engineOn = on; if (on || !this.ctx) return; const t = this.ctx.currentTime;
    for (const g of [this.wind.g, this.rainN.g, this.hum.g, this.gravel.g, this.voice && this.voice.out]) if (g) g.gain.setTargetAtTime(0, t, 0.1);
  }
  get eng() { return this.voice ? this.voice.out : { gain: { value: 0 } }; }

  /* ---------- engine voices ---------- */
  wave(kind) {
    const N = 30, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    for (let n = 1; n <= N; n++) {
      let a = 1 / Math.pow(n, kind === 'v8' ? 0.72 : 0.55);
      if (kind === 'v8') a *= 1 + 1.3 * Math.exp(-Math.pow((n - 3) / 1.4, 2)) + 0.9 * Math.exp(-Math.pow((n - 8) / 2, 2));
      else a *= (n % 2 ? 1.25 : 0.7) * (1 + 1.0 * Math.exp(-Math.pow((n - 4) / 2, 2)));
      im[n] = a;
    }
    return this.ctx.createPeriodicWave(re, im);
  }
  setVehicle(id) {
    if (!this.ctx) return; const c = this.ctx, cfg = CFG[id] || CFG.car; this.vid = id; this.prev = {}; this.rpmSm = 0;
    if (this.voice) { for (const n of this.voice.stop) { try { n.stop(); } catch (e) { /* already stopped */ } } try { this.voice.out.disconnect(); } catch (e) { /* ok */ } }
    const v = { stop: [] }, out = v.out = c.createGain(); out.gain.value = 0; out.connect(this.fxIn);
    const osc = (type, wave) => { const o = c.createOscillator(); if (wave) o.setPeriodicWave(wave); else o.type = type; o.start(); v.stop.push(o); return o; };
    const lfoAM = c.createGain(); lfoAM.gain.value = 1; lfoAM.connect(out);           // amplitude "lope" (uneven firing) rides on this gain
    if (cfg.kind === 'ev') {
      v.m1 = osc('sawtooth'); v.m2 = osc('sawtooth'); v.m3 = osc('sine'); v.mt = osc('triangle');
      v.bp = c.createBiquadFilter(); v.bp.type = 'bandpass'; v.bp.Q.value = 2.5; v.g12 = c.createGain(); v.g12.gain.value = 0.5; v.m1.connect(v.g12); v.m2.connect(v.g12); v.g12.connect(v.bp); v.bp.connect(lfoAM);
      v.g3 = c.createGain(); v.m3.connect(v.g3); v.g3.connect(lfoAM); v.gt = c.createGain(); v.mt.connect(v.gt); v.gt.connect(lfoAM);
    } else {
      v.a = osc(null, this.wave(cfg.kind)); v.sub = osc('sine'); v.gr = osc('square'); v.wh = osc('sawtooth');
      v.lp = c.createBiquadFilter(); v.lp.type = 'lowpass'; v.lp.Q.value = 3.5; v.ga = c.createGain(); v.ga.gain.value = 0.9; v.a.connect(v.ga); v.ga.connect(v.lp); v.lp.connect(lfoAM);
      v.gs = c.createGain(); v.sub.connect(v.gs); v.gs.connect(lfoAM);
      v.grbp = c.createBiquadFilter(); v.grbp.type = 'bandpass'; v.grbp.Q.value = 1.6; v.gg = c.createGain(); v.gr.connect(v.grbp); v.grbp.connect(v.gg); v.gg.connect(lfoAM);
      v.whbp = c.createBiquadFilter(); v.whbp.type = 'bandpass'; v.whbp.Q.value = 6; v.gw = c.createGain(); v.wh.connect(v.whbp); v.whbp.connect(v.gw); v.gw.connect(out);
      const ns = c.createBufferSource(); ns.buffer = this.noiseBuf; ns.loop = true; ns.start(); v.stop.push(ns); v.hbp = c.createBiquadFilter(); v.hbp.type = 'bandpass'; v.hbp.frequency.value = 1100; v.hbp.Q.value = 0.8;
      v.gh = c.createGain(); ns.connect(v.hbp); v.hbp.connect(v.gh); v.gh.connect(lfoAM);
      v.lfo = osc('sine'); v.lfoD = c.createGain(); v.lfo.connect(v.lfoD); v.lfoD.connect(lfoAM.gain);
      if (cfg.kind === 'diesel') {                                                         // injector clatter
        const cs = c.createBufferSource(); cs.buffer = this.noiseBuf; cs.loop = true; cs.start(); v.stop.push(cs); const cb = c.createBiquadFilter(); cb.type = 'bandpass'; cb.frequency.value = 2200; cb.Q.value = 1.2;
        v.cg = c.createGain(); v.cg.gain.value = 0; v.cl = osc('square'); v.clD = c.createGain(); v.cl.connect(v.clD); v.clD.connect(v.cg.gain); cs.connect(cb); cb.connect(v.cg); v.cg.connect(out);
      }
      v.tw = osc('sine'); v.gtw = c.createGain(); v.gtw.gain.value = 0; v.twhp = c.createBiquadFilter(); v.twhp.type = 'highpass'; v.twhp.frequency.value = 900; v.tw.connect(v.gtw); v.gtw.connect(v.twhp); v.twhp.connect(this.fxIn);   // turbo whistle
    }
    v.lfoAM = lfoAM; this.voice = v;
  }
  burst(delay, freq, dur, gain, type = 'bandpass', Q = 1.2) {
    const c = this.ctx, t = c.currentTime + delay, s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(this.fxIn);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  pops(n, loud) { for (let i = 0; i < n; i++) this.burst(rand(0.04, 0.6), rand(500, 2200), rand(0.03, 0.08), loud * rand(0.5, 1), 'bandpass', 1.5); }
  whoosh() {
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1;
    f.frequency.setValueAtTime(350, t); f.frequency.exponentialRampToValueAtTime(5200, t + 1.1); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    s.connect(f); f.connect(g); g.connect(this.fxIn); s.start(t); s.stop(t + 1.6);
    const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.6); og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.7); o.connect(og); og.connect(this.fxIn); o.start(t); o.stop(t + 0.8);
  }
  airBrake() { this.burst(0, 4200, 0.9, 0.5, 'highpass', 0.6); this.burst(0.05, 7000, 0.5, 0.25, 'bandpass', 0.8); }
  blowOff() { this.burst(0, 3200, 0.55, 0.32, 'highpass', 0.7); const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.5);
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(g); g.connect(this.fxIn); o.start(t); o.stop(t + 0.6); }

  update(s) {
    if (!this.ctx || !this.engineOn) return;
    if (this.vid !== s.id || !this.voice) this.setVehicle(s.id);
    const c = this.ctx, t = c.currentTime, now = performance.now(), dt = Math.min(0.1, (now - (this.lastT || now)) / 1000) || 0.016; this.lastT = now;
    const cfg = CFG[s.id] || CFG.car, v = this.voice, r = clamp(s.v / s.top, 0, 1), th = s.throttle, fp = s.view === 'first';
    const P = this.prev; this.cabin.frequency.setTargetAtTime(fp ? 2300 : 18000, t, 0.15); this.wet.gain.setTargetAtTime(fp ? 0.04 : 0.16, t, 0.2);
    const loud = (fp ? 1.25 : 1) * (s.buff ? 1.25 : 1);
    if (cfg.kind === 'ev') {                                                                // ---- electric motor
      const fm = 160 + r * 2900 + th * 120; this.rpmSm += (fm - this.rpmSm) * Math.min(1, dt * 5); const f = this.rpmSm, tc = 0.07;
      v.m1.frequency.setTargetAtTime(f, t, tc); v.m2.frequency.setTargetAtTime(f * 1.006, t, tc); v.m3.frequency.setTargetAtTime(f * 0.5, t, tc); v.mt.frequency.setTargetAtTime(f * 3, t, tc);
      v.bp.frequency.setTargetAtTime(f * 1.5 + 200, t, tc); v.g3.gain.setTargetAtTime(0.5, t, tc); v.gt.gain.setTargetAtTime(0.1 + r * 0.25, t, tc);
      const regen = th < 0.2 && r > 0.2 ? 0.7 : 1;                                          // lifting off = softer, falling whirr
      v.out.gain.setTargetAtTime(cfg.vol * (0.07 + 0.14 * th + 0.1 * r) * regen * loud, t, 0.08);
      if (s.buff && !P.buff) this.whoosh();
    } else {                                                                              // ---- combustion engines
      const gp = Math.min(r * cfg.G, cfg.G - 0.001), gear = Math.floor(gp), frac = gp - gear;
      const rpm01 = s.v < 0.8 ? 0.0 : clamp(0.16 + 0.84 * (gear === 0 ? frac * 0.9 + 0.08 : frac), 0, 1);
      this.rpmSm += (rpm01 - this.rpmSm) * Math.min(1, dt * (rpm01 > this.rpmSm ? 7 : 5)); const rr = this.rpmSm;
      const rpm = cfg.idle + (cfg.max - cfg.idle) * rr, f = cfg.pulse(rpm), tc = 0.05;
      v.a.frequency.setTargetAtTime(f, t, tc); v.sub.frequency.setTargetAtTime(f * 0.5, t, tc); v.gr.frequency.setTargetAtTime(f * 2, t, tc); v.wh.frequency.setTargetAtTime(f * 6.5, t, tc);
      v.lp.frequency.setTargetAtTime(cfg.cutLo + (cfg.cutHi - cfg.cutLo) * (0.15 + 0.6 * rr + 0.4 * th) * 0.8, t, 0.06);
      v.grbp.frequency.setTargetAtTime(350 + rr * 1500, t, 0.07); v.gg.gain.setTargetAtTime(cfg.growl * (0.2 + 0.8 * th), t, 0.06);
      v.gs.gain.setTargetAtTime(0.55 + 0.25 * (1 - rr), t, 0.08); v.whbp.frequency.setTargetAtTime(f * 6.5, t, 0.06); v.gw.gain.setTargetAtTime(cfg.whine * r * (0.4 + th), t, 0.08);
      v.gh.gain.setTargetAtTime(cfg.hiss * (0.1 + th * rr), t, 0.06); v.hbp.frequency.setTargetAtTime(700 + rr * 1500, t, 0.1);
      v.lfo.frequency.setTargetAtTime(f / 4, t, 0.1); v.lfoD.gain.setTargetAtTime(cfg.lope * (1 - rr) * (1 - th * 0.5), t, 0.1);             // idle "lope" fades as the revs rise
      if (v.clD) { v.cl.frequency.setTargetAtTime(f * 1.5, t, 0.08); v.clD.gain.setTargetAtTime(0.22, t, 0.1); v.cg.gain.value = 0.035 + 0.07 * (1 - rr) + 0.035 * th; }
      const spool = clamp(th * rr * 1.2 + (s.buff ? 0.5 : 0), 0, 1); v.tw.frequency.setTargetAtTime(700 + spool * (cfg.kind === 'diesel' ? 1500 : 2600), t, 0.15); v.gtw.gain.setTargetAtTime(spool * spool * (cfg.kind === 'diesel' ? 0.02 : 0.03), t, 0.2);
      const shiftDip = P.gear !== undefined && P.gear !== gear && s.v > 4 ? 1 : 0;                                              // gear change: brief throttle cut
      if (shiftDip) { v.out.gain.cancelScheduledValues(t); v.out.gain.setValueAtTime(v.out.gain.value * 0.35, t); if (cfg.kind === 'v8') this.pops(2, 0.16); else this.burst(0, 3800, 0.25, 0.1, 'highpass'); }
      v.out.gain.setTargetAtTime(cfg.vol * (0.11 + 0.14 * th + 0.07 * rr) * loud, t + (shiftDip ? 0.09 : 0), 0.07);
      if (P.throttle > 0.7 && th < 0.3 && rr > 0.45) { if (cfg.kind === 'v8') { this.pops(4 + Math.floor(rand(0, 4)), 0.28 + (s.buff ? 0.2 : 0)); this.blowOff(); } else this.burst(0, 260, 0.5, 0.22, 'bandpass', 0.8); }   // lift off: exhaust crackle, turbo blow-off / engine brake
      if (cfg.kind === 'diesel' && s.brake && !P.brake && s.v > 9) this.airBrake();
      if (s.buff && !P.buff && cfg.kind === 'v8') { this.whoosh(); this.pops(5, 0.3); }
      P.gear = gear;
    }
    // ---- shared layers: wind, road, gravel, rain
    this.wind.g.gain.setTargetAtTime(r * r * 0.34 * (fp ? 1.2 : 1), t, 0.15); this.wind.f.frequency.setTargetAtTime(400 + r * 1300, t, 0.2);
    this.hum.g.gain.setTargetAtTime(r * 0.1, t, 0.2); this.gravel.g.gain.setTargetAtTime(s.off ? Math.min(0.28, r * 0.5) : 0, t, 0.1); this.rainN.g.gain.setTargetAtTime(s.rain * 0.2, t, 0.4);
    if (s.rev && s.id === 'truck') { if (!this._beepAt || now > this._beepAt) { this._beepAt = now + 900; const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = 1050;       // reversing beeper
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.09, t + 0.01); og.gain.setValueAtTime(0.09, t + 0.3); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.34); o.connect(og); og.connect(this.fxIn); o.start(t); o.stop(t + 0.4); } }
    P.throttle = th; P.buff = s.buff; P.brake = s.brake;
    if (s.flash > 0.9 && !this._thunder) { this._thunder = true; setTimeout(() => this.thunder(), 500 + Math.random() * 1500); } else if (s.flash < 0.2) this._thunder = false;
  }
  thunder() {
    if (!this.ctx || !this.engineOn) return; const c = this.ctx, t = c.currentTime, src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
    src.connect(f); f.connect(g); g.connect(this.fxIn); src.start(t); src.stop(t + 3.5);
  }
}

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

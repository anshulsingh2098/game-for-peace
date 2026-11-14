/* Engine and weather sounds, all synthesised. Carried over unchanged from the current game (audio.js);
   the radio is not included here: the music interface is a separate piece of work. */
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rand = (a, b) => a + Math.random() * (b - a);

/* per-vehicle engine character */
const CFG = {
  car:   { kind: 'v8',     idle: 750, max: 6200, G: 6, pulse: r => r / 19, vol: 0.64, sample: 0.34, cutLo: 240, cutHi: 1350, lope: 0.34, growl: 0.22, whine: 0.002, hiss: 0.018 },        // a modern six-cylinder: lower top note, dark and full, almost no whine
  truck: { kind: 'diesel', idle: 620, max: 2100, G: 8, pulse: r => r / 20, vol: 0.72, cutLo: 300, cutHi: 1700, lope: 0.28, growl: 0.28, whine: 0.04, hiss: 0.10 },
  bike:  { kind: 'ev',     idle: 0,   max: 1,    G: 1, pulse: () => 0,     vol: 0.95, cutLo: 900, cutHi: 6000, lope: 0,    growl: 0,    whine: 0,    hiss: 0.05 }
};

export class Sound {
  constructor() { this.ctx = null; this.music = 0.5; this.sfx = 0.6; this.engineOn = false; this.voice = null; this.vid = null; this.prev = {}; this.rpmSm = 0; this.lastT = 0; this._thunder = false; this.samples = null; }
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
    this.wind = mk('bandpass', 700, 0.5); this.rainN = mk('highpass', 2800, 0.5); this.hum = mk('lowpass', 180, 0.7); this.gravel = mk('bandpass', 1700, 0.9); this.squeal = mk('bandpass', 1500, 5);
    this.applyVolumes(); this.loadSamples(); return c;
  }
  /* The car's engine is a recording of Rajul's own car: seven seamless loops from low revs to high (assets/audio, made by tools/make_engine_loops.mjs).
     Every loop plays all the time as one continuous looping source; the two loops nearest the current pitch are crossfaded (equal power) and pitch-shifted a
     little to hit the exact note, so there is never a click, and never two copies of the same loop out of step. If the files cannot load, the synthesised engine is used. */
  async loadSamples() {
    if (/[?&]engine=synth/.test(location.search)) return;                                                       // ?engine=synth: the old synthesised engine, to compare by ear
    try {
      const meta = await (await fetch('assets/audio/engine_car.json')).json(), c = this.ctx;
      const loops = await Promise.all(meta.loops.map(async l => ({ pitch: l.pitch, buf: await c.decodeAudioData(await (await fetch('assets/audio/' + l.file)).arrayBuffer()) })));
      const out = c.createGain(); out.gain.value = 0; out.connect(this.fxIn);
      for (const l of loops) {
        l.g = c.createGain(); l.g.gain.value = 0; l.g.connect(out);
        l.src = c.createBufferSource(); l.src.buffer = l.buf; l.src.loop = true; l.src.connect(l.g); l.src.start(0, Math.random() * l.buf.duration);          // started at a random point so loops are not in step
      }
      this.samples = { loops, out };
    } catch (e) { this.samples = null; }
  }
  sampleEngine(rr, th, loud, cfg, t) {
    const S = this.samples, T = 62 * Math.pow(330 / 62, rr), L = S.loops, lt = Math.log(T);                    // target pitch: 62 Hz at idle up to 330 Hz at the limit (the range of the recording)
    let a = 0; while (a < L.length - 2 && Math.log(L[a + 1].pitch) < lt) a++;                                   // T lies between loops a and a + 1 (or beyond the ends)
    const la = Math.log(L[a].pitch), lb = Math.log(L[a + 1].pitch), f = clamp((lt - la) / (lb - la), 0, 1);
    L.forEach((l, i) => {
      const w = i === a ? Math.cos(f * Math.PI / 2) : i === a + 1 ? Math.sin(f * Math.PI / 2) : 0;
      l.g.gain.setTargetAtTime(w, t, 0.04); l.src.playbackRate.setTargetAtTime(clamp(T / l.pitch, 0.6, 1.7), t, 0.04);
    });
    S.out.gain.setTargetAtTime(cfg.sample * (0.55 + 0.45 * th) * loud, t, 0.08);
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  applyVolumes() { if (!this.ctx) return; const t = this.ctx.currentTime; this.musicBus.gain.setTargetAtTime(this.music, t, 0.05); this.sfxBus.gain.setTargetAtTime(this.sfx, t, 0.05); }
  setEngineOn(on) {
    this.engineOn = on; if (on || !this.ctx) return; const t = this.ctx.currentTime;
    for (const g of [this.samples && this.samples.out, this.wind.g, this.rainN.g, this.hum.g, this.gravel.g, this.squeal.g, this.voice && this.voice.out, this.voice && this.voice.gtw]) if (g) g.gain.setTargetAtTime(0, t, 0.1);
  }
  get eng() { return this.voice ? this.voice.out : { gain: { value: 0 } }; }

  /* ---------- engine voices ---------- */
  wave(kind) {
    const N = 30, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    for (let n = 1; n <= N; n++) {
      let a = 1 / Math.pow(n, kind === 'v8' ? 1.05 : 0.55);
      if (kind === 'v8') a *= (1 + 1.1 * Math.exp(-Math.pow((n - 2) / 1.2, 2)) + 1.3 * Math.exp(-Math.pow((n - 4) / 1.6, 2)) + 0.5 * Math.exp(-Math.pow((n - 8) / 2, 2))) * Math.exp(-Math.pow(n / 15, 2));
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
      v.lp = c.createBiquadFilter(); v.lp.type = 'lowpass'; v.lp.Q.value = cfg.kind === 'v8' ? 0.9 : 3.5; v.ga = c.createGain(); v.ga.gain.value = 0.9; v.a.connect(v.ga); v.ga.connect(v.lp); v.lp.connect(lfoAM);
      v.gs = c.createGain(); v.sub.connect(v.gs); v.gs.connect(lfoAM);
      v.grbp = c.createBiquadFilter(); v.grbp.type = 'bandpass'; v.grbp.Q.value = cfg.kind === 'v8' ? 0.8 : 1.6; v.gg = c.createGain(); v.gr.connect(v.grbp); v.grbp.connect(v.gg); v.gg.connect(lfoAM);
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
    const P = this.prev; this.cabin.frequency.setTargetAtTime(fp ? 2300 : 18000, t, 0.15); this.wet.gain.setTargetAtTime((fp ? 0.04 : 0.16) + 0.22 * (s.tunnel || 0), t, 0.2);
    const loud = (fp ? 1.25 : 1) * (s.buff ? 1.25 : 1), sampled = !!this.samples && cfg.kind === 'v8';
    if (this.samples && !sampled) this.samples.out.gain.setTargetAtTime(0, t, 0.1);
    if (cfg.kind === 'ev') {                                                                // ---- electric motor
      const fm = 160 + r * 2900 + th * 120; this.rpmSm += (fm - this.rpmSm) * Math.min(1, dt * 5); const f = this.rpmSm, tc = 0.07;
      v.m1.frequency.setTargetAtTime(f, t, tc); v.m2.frequency.setTargetAtTime(f * 1.006, t, tc); v.m3.frequency.setTargetAtTime(f * 0.5, t, tc); v.mt.frequency.setTargetAtTime(f * 3, t, tc);
      v.bp.frequency.setTargetAtTime(f * 1.5 + 200, t, tc); v.g3.gain.setTargetAtTime(0.5, t, tc); v.gt.gain.setTargetAtTime(0.1 + r * 0.25, t, tc);
      const regen = th < 0.2 && r > 0.2 ? 0.7 : 1;                                          // lifting off = softer, falling whirr
      v.out.gain.setTargetAtTime(cfg.vol * (0.07 + 0.14 * th + 0.1 * r) * regen * loud, t, 0.08);
      if (s.buff && !P.buff) this.whoosh();
    } else {                                                                              // ---- combustion engines
      const real = s.rpm01 !== undefined, gp = Math.min(r * cfg.G, cfg.G - 0.001), gear = real ? s.gear : Math.floor(gp), frac = gp - Math.floor(gp);        // real: the car's own revs and gear (powertrain in rapier-vehicle.js); otherwise they are guessed from speed
      const rpm01 = real ? clamp(s.rpm01, 0, 1) : s.v < 0.6 ? th * 0.22 : clamp(gear === 0 ? 0.12 + 0.8 * frac : 0.36 + 0.62 * frac + th * 0.04, 0, 1);       // each gear starts mid-range and climbs; a shift drops the revs
      this.rpmSm += (rpm01 - this.rpmSm) * Math.min(1, dt * (real ? (rpm01 > this.rpmSm ? 16 : 10) : rpm01 > this.rpmSm ? 8 + th * 4 : 3.2)); const rr = this.rpmSm;       // revs rise briskly under power and fall away slowly when you lift
      const rpm = cfg.idle + (cfg.max - cfg.idle) * rr, f = cfg.pulse(rpm) * (1 + (Math.random() - 0.5) * (cfg.kind === 'v8' ? 0.008 : 0.004)), tc = 0.05;    // a hair of cycle-to-cycle unevenness
      v.a.frequency.setTargetAtTime(f, t, tc); v.sub.frequency.setTargetAtTime(f * 0.5, t, tc); v.gr.frequency.setTargetAtTime(f * 2, t, tc); v.wh.frequency.setTargetAtTime(f * 6.5, t, tc);
      v.lp.frequency.setTargetAtTime(cfg.cutLo + (cfg.cutHi - cfg.cutLo) * (0.1 + 0.55 * rr + 0.45 * th * (0.5 + 0.5 * rr)), t, 0.08);
      v.grbp.frequency.setTargetAtTime(350 + rr * 1500, t, 0.07); v.gg.gain.setTargetAtTime(cfg.growl * (0.2 + 0.8 * th), t, 0.06);
      v.gs.gain.setTargetAtTime(cfg.kind === 'v8' ? 0.95 + 0.3 * (1 - rr) : 0.55 + 0.25 * (1 - rr), t, 0.08); v.whbp.frequency.setTargetAtTime(f * 6.5, t, 0.06); v.gw.gain.setTargetAtTime(cfg.whine * r * (0.4 + th), t, 0.08);
      v.gh.gain.setTargetAtTime(cfg.hiss * (0.1 + th * rr), t, 0.06); v.hbp.frequency.setTargetAtTime(700 + rr * 1500, t, 0.1);
      v.lfo.frequency.setTargetAtTime(f / 4, t, 0.1); v.lfoD.gain.setTargetAtTime(cfg.lope * (1 - rr) * (1 - th * 0.5), t, 0.1);             // idle "lope" fades as the revs rise
      if (v.clD) { v.cl.frequency.setTargetAtTime(f * 1.5, t, 0.08); v.clD.gain.setTargetAtTime(0.22, t, 0.1); v.cg.gain.value = 0.035 + 0.07 * (1 - rr) + 0.035 * th; }
      const spool = clamp(th * rr * 1.2 + (s.buff ? 0.5 : 0), 0, 1); v.tw.frequency.setTargetAtTime(500 + spool * (cfg.kind === 'diesel' ? 1100 : 850), t, 0.15); v.gtw.gain.setTargetAtTime(spool * spool * (cfg.kind === 'diesel' ? 0.015 : 0.005), t, 0.2);
      const shiftDip = P.gear !== undefined && P.gear !== gear && s.v > 4 ? 1 : 0;                                              // gear change: brief throttle cut
      if (shiftDip) { v.out.gain.cancelScheduledValues(t); v.out.gain.setValueAtTime(v.out.gain.value * 0.35, t); if (cfg.kind === 'v8' && !sampled) this.pops(1, 0.08); else this.burst(0, 3800, 0.25, 0.1, 'highpass'); }
      v.out.gain.setTargetAtTime(sampled ? 0 : cfg.vol * (0.11 + 0.14 * th + 0.07 * rr) * loud, t + (shiftDip ? 0.09 : 0), 0.07);
      if (sampled) this.sampleEngine(rr, th, loud, cfg, t);                                                         // the car's real engine recording
      if (P.throttle > 0.7 && th < 0.3 && rr > 0.6) { if (cfg.kind === 'v8') { if (!sampled && (Math.random() < 0.45 || s.buff)) this.pops(2 + Math.floor(rand(0, 3)), 0.12 + (s.buff ? 0.14 : 0)); } else this.burst(0, 260, 0.5, 0.22, 'bandpass', 0.8); }   // lift off: exhaust crackle, turbo blow-off / engine brake
      if (cfg.kind === 'diesel' && s.brake && !P.brake && s.v > 9) this.airBrake();
      if (s.buff && !P.buff && cfg.kind === 'v8') { this.whoosh(); this.pops(5, 0.3); }
      P.gear = gear;
    }
    // ---- shared layers: wind, road, gravel, rain
    this.wind.g.gain.setTargetAtTime(r * r * 0.14 * (fp ? 1.2 : 1), t, 0.15); this.wind.f.frequency.setTargetAtTime(300 + r * 600, t, 0.2);
    this.hum.g.gain.setTargetAtTime(r * 0.1, t, 0.2); this.squeal.g.gain.setTargetAtTime(s.off ? 0 : clamp((s.slip || 0) - 0.14, 0, 0.5) * 0.7 * r + (s.hand || 0) * r * 0.32, t, 0.06); this.squeal.f.frequency.setTargetAtTime(1300 + r * 900, t, 0.1); this.gravel.g.gain.setTargetAtTime(s.off ? Math.min(0.28, r * 0.5) : 0, t, 0.1); this.rainN.g.gain.setTargetAtTime(s.rain * 0.2 * (1 - (s.tunnel || 0)), t, 0.4); this.tunnel = s.tunnel || 0;          // no rain on the roof inside a tunnel
    if (s.rev && s.id === 'truck') { if (!this._beepAt || now > this._beepAt) { this._beepAt = now + 900; const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = 1050;       // reversing beeper
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.09, t + 0.01); og.gain.setValueAtTime(0.09, t + 0.3); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.34); o.connect(og); og.connect(this.fxIn); o.start(t); o.stop(t + 0.4); } }
    P.throttle = th; P.buff = s.buff; P.brake = s.brake;
    if (s.flash > 0.9 && !this._thunder && !(s.tunnel > 0.5)) { this._thunder = true; setTimeout(() => this.thunder(), 500 + Math.random() * 1500); } else if (s.flash < 0.2) this._thunder = false;
  }
  thunder() {
    if (!this.ctx || !this.engineOn || this.tunnel > 0.5) return; const c = this.ctx, t = c.currentTime, src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
    src.connect(f); f.connect(g); g.connect(this.fxIn); src.start(t); src.stop(t + 3.5);
  }
}

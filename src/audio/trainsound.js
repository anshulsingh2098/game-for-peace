/* Train sound, made on the device with Web Audio (no recordings): wheel clatter at the rail joints (one click per joint passed, 13 m rails: rate = speed / 13 for each of two bogie pairs), a low rolling rumble that grows with speed,
   the whine of an electric motor that rises with speed, and a two-tone horn now and then. The nearest train is heard from its distance, with a Doppler shift from its closing speed and stereo placement from its bearing.
   update(dt, t, now): t = { d (m), closing (m/s, positive when coming nearer), v (m/s), pan (-1..1), motor (bool), approaching (bool) } or null for silence. */
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

export class TrainSound {
  constructor(sound) { this.s = sound; this.n = null; this.clack = 0; this.hornAt = 0; }
  build() {
    const c = this.s.ctx; if (!c || !this.s.sfxBus || !this.s.noiseBuf) return false; const out = c.createGain(); out.gain.value = 0; const pan = c.createStereoPanner(); out.connect(pan); pan.connect(this.s.sfxBus);
    const rum = c.createBufferSource(); rum.buffer = this.s.noiseBuf; rum.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; const rg = c.createGain(); rg.gain.value = 0; rum.connect(lp); lp.connect(rg); rg.connect(out); rum.start();
    const mo = c.createOscillator(); mo.type = 'sawtooth'; mo.frequency.value = 140; const mf = c.createBiquadFilter(); mf.type = 'bandpass'; mf.frequency.value = 700; mf.Q.value = 3; const mg = c.createGain(); mg.gain.value = 0; mo.connect(mf); mf.connect(mg); mg.connect(out); mo.start();
    this.n = { out, pan, rg, mo, mg, mf, lp }; return true;
  }
  /* one click of a wheel on a rail joint */
  click(pitch, gain) {
    const c = this.s.ctx, N = this.n, t = c.currentTime, src = c.createBufferSource(); src.buffer = this.s.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = (1100 + Math.random() * 900) * pitch; f.Q.value = 2.2; const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.07); src.connect(f); f.connect(g); g.connect(N.out); src.start(t, Math.random() * 1.5, 0.08);
  }
  /* the two-tone horn of an Indian electric locomotive */
  horn(gain) {
    const c = this.s.ctx, N = this.n, t = c.currentTime;
    for (const [f, t0, len] of [[392, 0, 0.55], [523, 0.5, 1.0]]) { const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(); o.type = o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.006; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
      g.gain.setValueAtTime(0, t + t0); g.gain.linearRampToValueAtTime(gain, t + t0 + 0.05); g.gain.setValueAtTime(gain, t + t0 + len - 0.12); g.gain.linearRampToValueAtTime(0, t + t0 + len); o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(N.out); o.start(t + t0); o2.start(t + t0); o.stop(t + t0 + len + 0.05); o2.stop(t + t0 + len + 0.05); }
  }
  update(dt, tr, now) {
    if (!this.s.ctx || this.s.sfx === 0) { if (this.n) this.n.out.gain.value = 0; return; } if (!this.n && !this.build()) return; const N = this.n, c = this.s.ctx, T = c.currentTime;
    if (!tr || tr.d > 900) { N.out.gain.setTargetAtTime(0, T, 0.2); N.rg.gain.setTargetAtTime(0, T, 0.3); N.mg.gain.setTargetAtTime(0, T, 0.3); return; }
    const near = 1 / (1 + Math.pow(tr.d / 70, 1.5)), v = Math.max(0, tr.v), dop = clamp(343 / (343 - clamp(tr.closing, -60, 60)), 0.85, 1.18), moving = v > 0.5;
    N.out.gain.setTargetAtTime(0.75 * near, T, 0.15); N.pan.pan.setTargetAtTime(clamp(tr.pan, -1, 1), T, 0.1);
    N.rg.gain.setTargetAtTime(moving ? Math.min(1, v / 25) * 0.9 : 0.05, T, 0.2); N.lp.frequency.setTargetAtTime(150 + v * 5, T, 0.2);
    N.mg.gain.setTargetAtTime(tr.motor && moving ? 0.07 + Math.min(0.08, v / 300) : 0, T, 0.25); N.mo.frequency.setTargetAtTime((90 + v * 9) * dop, T, 0.1); N.mf.frequency.setTargetAtTime((500 + v * 28) * dop, T, 0.1);
    if (moving) { this.clack += (v / 6.5) * dt; let k = 0; while (this.clack >= 1 && k++ < 4) { this.clack -= 1; this.click(dop, 0.5 * Math.min(1, 0.4 + v / 30)); } if (this.clack > 4) this.clack = 0; }
    if (tr.approaching !== false && moving && tr.d < 500 && now > this.hornAt) { this.horn(0.16); this.hornAt = now + 30000 + Math.random() * 25000; }
  }
}

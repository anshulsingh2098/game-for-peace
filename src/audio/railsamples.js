/* Recorded railway sounds (assets/audio/trains/*.mp3), used on top of the synthesised train sound when the files are there. They are from the owner's audio.com library
   (audio.com/category/sound-effect/indian-railway; recordings by arunangshubanerjee, DKFILMS and spinopel). Their licence is NOT verified (audio.com shows only "royalty-free", and some are re-uploads),
   so the folder is git-ignored and nothing here is committed or deployed until the owner has reviewed the licences (see docs/OPEN_DATA.md). Without the files nothing changes: ok stays false.
   FILES: name -> file. play(name, { gain, rate, pan }) plays one; loop(name, gain) fades a loop in or out; stopAll(). */
export const FILES = { announce: 'announce', passby: 'passby', diesel: 'diesel', station: 'station', platform: 'platform', interior: 'interior', rural: 'rural', vestibule: 'vestibule', sanding: 'sanding', grinding: 'grinding' };

export class RailSamples {
  constructor(sound, base = 'assets/audio/trains/') { this.s = sound; this.base = base; this.buf = new Map(); this.loading = new Set(); this.loops = new Map(); this.ok = false; this.tried = false; }
  /* start loading the files (needs the audio context, so call after the first user gesture) */
  load() {
    if (this.tried || !this.s.ctx) return; this.tried = true; const c = this.s.ctx;
    for (const [name, file] of Object.entries(FILES)) { this.loading.add(name); fetch(this.base + file + '.mp3').then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))).then(b => c.decodeAudioData(b)).then(buf => { this.buf.set(name, buf); this.ok = true; }).catch(() => { /* a missing file is fine */ }).finally(() => this.loading.delete(name)); }
  }
  has(name) { return this.buf.has(name); }
  out() { return this.s.sfxBus || this.s.ctx.destination; }
  play(name, { gain = 0.7, rate = 1, pan = 0, offset = 0 } = {}) {
    const b = this.buf.get(name); if (!b || !this.s.ctx || this.s.sfx === 0) return null; const c = this.s.ctx, src = c.createBufferSource(), g = c.createGain(), p = c.createStereoPanner(); src.buffer = b; src.playbackRate.value = rate; g.gain.value = gain; p.pan.value = pan; src.connect(g); g.connect(p); p.connect(this.out()); src.start(0, offset); return { src, g };
  }
  /* a looping sound that fades to `gain` (0 fades it out and stops it) */
  loop(name, gain, fade = 0.8) {
    const c = this.s.ctx, b = this.buf.get(name); if (!c || !b) return; let l = this.loops.get(name);
    if (!l) { if (gain <= 0.001) return; const src = c.createBufferSource(), g = c.createGain(); src.buffer = b; src.loop = true; g.gain.value = 0; src.connect(g); g.connect(this.out()); src.start(0, Math.random() * b.duration * 0.8); l = { src, g, gain: 0 }; this.loops.set(name, l); }
    l.g.gain.setTargetAtTime(this.s.sfx === 0 ? 0 : gain, c.currentTime, fade / 3); l.gain = gain; if (gain <= 0.001 && !l.stopping) { l.stopping = true; setTimeout(() => { if (l.gain <= 0.001) { try { l.src.stop(); } catch (e) { /* already stopped */ } this.loops.delete(name); } else l.stopping = false; }, fade * 1500); }
  }
  stopAll() { for (const [n] of this.loops) this.loop(n, 0, 0.3); }
}

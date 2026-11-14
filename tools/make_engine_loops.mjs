/* Cuts seamless engine loops out of a recording of a real car (the game's car engine sound: src/audio/engine.js plays them).
   Usage: node tools/make_engine_loops.mjs "/path/to/recording.mp3"      (needs ffmpeg)
   Each loop is a steady stretch (found with tools/analyse_sound.mjs); its end is crossfaded into its start so it repeats without a click or a phasing swirl,
   and every loop is levelled to the same loudness. Written as 16 kHz mono WAV (engine sound has almost nothing above 3 kHz; WAV loops exactly in every browser). */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const SRC = process.argv[2] || 'recording.mp3', OUT = new URL('../assets/audio/', import.meta.url).pathname, SR = 16000, X = Math.round(0.25 * SR);
const LOOPS = [                                           // start (s), length (s), main note of the stretch (Hz)
  [243.3, 3.0, 76], [387.6, 5.8, 105], [126.8, 10, 127], [417.4, 6.8, 146], [271.2, 5.6, 207], [113.8, 10, 274], [282.2, 9, 320]
];
const wav = (samples) => { const b = Buffer.alloc(44 + samples.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40); samples.forEach((v, i) => b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 2)); return b; };
const meta = { sampleRate: SR, loops: [] };
LOOPS.forEach(([t0, len, pitch], k) => {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t0), '-t', String(len), '-i', SRC, '-ac', '1', '-ar', String(SR), '-af', 'highpass=f=28', '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  const n = raw.length / 2, S = new Float64Array(n); for (let i = 0; i < n; i++) S[i] = raw.readInt16LE(i * 2) / 32768;
  const L = n - X, out = new Float64Array(L);                                                           // output is X shorter: its tail is the head, crossfaded
  for (let i = 0; i < L; i++) out[i] = S[i];
  for (let i = 0; i < X; i++) { const a = Math.PI / 2 * i / X; out[i] = S[i] * Math.sin(a) + S[L + i] * Math.cos(a); }
  let e = 0; for (let i = 0; i < L; i++) e += out[i] * out[i]; const g = 0.2 / Math.sqrt(e / L); let pk = 0; for (let i = 0; i < L; i++) { out[i] *= g; pk = Math.max(pk, Math.abs(out[i])); } if (pk > 0.95) for (let i = 0; i < L; i++) out[i] *= 0.95 / pk;
  const file = `engine_car_${k + 1}.wav`; fs.writeFileSync(OUT + file, wav(out)); meta.loops.push({ file, pitch, seconds: +(L / SR).toFixed(2) });
});
fs.writeFileSync(OUT + 'engine_car.json', JSON.stringify(meta, null, 1) + '\n');
console.log('wrote', meta.loops.length, 'loops to', OUT);

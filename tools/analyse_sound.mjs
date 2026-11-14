/* Measures an engine recording so the synthesised engine (src/audio/engine.js) can be matched to it.
   Usage:  ffmpeg -i recording.mp3 -ac 1 -ar 22050 -f s16le recording.raw   then   node tools/analyse_sound.mjs recording.raw
   Prints the loudness, the pitch of the strongest low note (the engine's main note) and how the energy splits across bands. No dependencies. */
import fs from 'node:fs';
const buf = fs.readFileSync(process.argv[2] || 'recording.raw'), N = buf.length / 2, sr = 22050, x = new Float64Array(N);
for (let i = 0; i < N; i++) x[i] = buf.readInt16LE(i * 2) / 32768;
const W = 8192;                                                    // 0.37 s windows: 2.7 Hz resolution
function fft(re, im) {
  const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const u = i + k, v = i + k + len / 2, tr = re[v] * cr - im[v] * ci, ti = re[v] * ci + im[v] * cr; re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } }
}
const win = new Float64Array(W); for (let i = 0; i < W; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (W - 1));
const rows = []; const hop = W / 2;
for (let s = 0; s + W <= N; s += hop) {
  const re = new Float64Array(W), im = new Float64Array(W); let e = 0; for (let i = 0; i < W; i++) { re[i] = x[s + i] * win[i]; e += x[s + i] ** 2; } fft(re, im);
  const mag = new Float64Array(W / 2); for (let k = 0; k < W / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
  const bin = f => Math.round(f * W / sr), band = (a, b) => { let t = 0; for (let k = bin(a); k < bin(b); k++) t += mag[k] ** 2; return t; };
  let pk = bin(25), pm = 0; for (let k = bin(25); k < bin(450); k++) if (mag[k] > pm) { pm = mag[k]; pk = k; }                     // strongest low-frequency peak
  let cen = 0, tot = 0; for (let k = bin(40); k < bin(8000); k++) { cen += k * sr / W * mag[k] ** 2; tot += mag[k] ** 2; }
  const b = [band(20, 100), band(100, 300), band(300, 1000), band(1000, 3000), band(3000, 8000)], sum = b.reduce((a, c) => a + c, 0) || 1;
  rows.push({ t: s / sr, rms: Math.sqrt(e / W), pk: pk * sr / W, centroid: cen / (tot || 1), bands: b.map(v => v / sum) });
}
const q = (arr, p) => { const a = [...arr].sort((m, n) => m - n); return a[Math.floor(p * (a.length - 1))]; };
const loud = rows.filter(r => r.rms > q(rows.map(r => r.rms), 0.5));
console.log('windows', rows.length, 'duration s', (N / sr).toFixed(0));
console.log('rms percentiles (5,50,95)', [0.05, 0.5, 0.95].map(p => q(rows.map(r => r.rms), p).toFixed(4)).join(' '));
console.log('dominant low peak Hz (5,25,50,75,95):', [0.05, 0.25, 0.5, 0.75, 0.95].map(p => q(rows.map(r => r.pk), p).toFixed(0)).join(' '));
console.log('same, loudest half only:', [0.05, 0.25, 0.5, 0.75, 0.95].map(p => q(loud.map(r => r.pk), p).toFixed(0)).join(' '));
console.log('spectral centroid Hz (5,50,95):', [0.05, 0.5, 0.95].map(p => q(rows.map(r => r.centroid), p).toFixed(0)).join(' '));
const avg = i => (rows.reduce((a, r) => a + r.bands[i], 0) / rows.length * 100).toFixed(1);
console.log('energy share %  <100:', avg(0), ' 100-300:', avg(1), ' 300-1k:', avg(2), ' 1k-3k:', avg(3), ' 3k-8k:', avg(4));
const lAvg = i => (loud.reduce((a, r) => a + r.bands[i], 0) / loud.length * 100).toFixed(1);
console.log('loudest half  <100:', lAvg(0), ' 100-300:', lAvg(1), ' 300-1k:', lAvg(2), ' 1k-3k:', lAvg(3), ' 3k-8k:', lAvg(4));

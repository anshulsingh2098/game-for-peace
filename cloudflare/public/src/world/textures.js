/* Procedural textures drawn on a canvas at start-up. Carried over from the current game (game.js) so the
   new world keeps the same look; game.js keeps its own copies until the switch-over. */
import * as THREE from 'three';
import { alea } from '../core/rng.js';

export function canvasTex(c, repeat) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true; return t;
}
/* draws a shape and its wrapped copies, so the texture tiles without a seam */
function tileDraw(s, px, py, fn) {
  for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) { if (px + dx < -20 || px + dx > s + 20 || py + dy < -20 || py + dy > s + 20) continue; fn(px + dx, py + dy); }
}
/* grey grass detail; the ground colour comes from vertex colours and this multiplies it */
export function grassTex() {
  const s = 512, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'), R = alea('grass-texture');
  x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) {
    const px = R() * s, py = R() * s, r = 12 + R() * 40, v = 110 + Math.floor(R() * 70);
    tileDraw(s, px, py, (X, Y) => { const g = x.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, `rgba(${v},${v},${v},.35)`); g.addColorStop(1, 'rgba(150,150,150,0)'); x.fillStyle = g; x.fillRect(X - r, Y - r, r * 2, r * 2); });
  }
  for (let i = 0; i < 14000; i++) {
    const px = R() * s, py = R() * s, l = 3 + R() * 9, a = (R() - 0.5) * 1.1, v = 85 + Math.floor(R() * 150);
    x.strokeStyle = `rgba(${v},${v},${v},.55)`; x.lineWidth = 0.8 + R();
    tileDraw(s, px, py, (X, Y) => { x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.sin(a) * l, Y - Math.cos(a) * l); x.stroke(); });
  }
  return canvasTex(c, true);
}
/* asphalt with darker wheel paths, cracks and sandy gravel at both edges (u runs across the road) */
export function asphaltTex() {
  const w = 256, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), R = alea('asphalt-texture');
  x.fillStyle = '#767676'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = 70 + Math.floor(R() * 90); x.fillStyle = `rgba(${v},${v},${v + 2},.55)`; x.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); }
  for (const [u, wd, a] of [[0.30, 0.10, 0.28], [0.70, 0.10, 0.28]]) { const g = x.createLinearGradient((u - wd) * w, 0, (u + wd) * w, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  for (let i = 0; i < 26; i++) { x.strokeStyle = 'rgba(25,25,25,.35)'; x.lineWidth = 1; x.beginPath(); let px = R() * w, py = R() * h; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (R() - 0.5) * 30; py += R() * 22; x.lineTo(px, py); } x.stroke(); }
  const e = x.createLinearGradient(0, 0, w, 0); e.addColorStop(0, 'rgba(210,190,150,1)'); e.addColorStop(0.065, 'rgba(210,190,150,1)'); e.addColorStop(0.085, 'rgba(210,190,150,0)');
  e.addColorStop(0.915, 'rgba(210,190,150,0)'); e.addColorStop(0.935, 'rgba(210,190,150,1)'); e.addColorStop(1, 'rgba(210,190,150,1)'); x.fillStyle = e; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 2200; i++) { const sx = R() < 0.5 ? R() * 0.07 * w : (0.93 + R() * 0.07) * w, v = 120 + Math.floor(R() * 110); x.fillStyle = `rgba(${v},${v - 10},${v - 30},.6)`; x.fillRect(sx, R() * h, 1 + R() * 2, 1 + R() * 2); }
  const t = canvasTex(c, false); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; return t;
}
/* foliage cards: a pine silhouette or a round leafy crown */
export function leafTex(kind) {
  const c = document.createElement('canvas'), R = alea('leaf-texture', kind);
  if (kind === 'pine') {
    c.width = 256; c.height = 512; const x = c.getContext('2d'); x.lineCap = 'round';
    for (let tier = 0; tier < 15; tier++) { const y = 30 + tier * 31, hw = 16 + tier * 7.6;
      for (let n = 0; n < 170; n++) { const side = (R() - 0.5) * 2, px = 128 + side * hw * R(), l = 18 + R() * 26, sag = 0.5 + R() * 0.6;
        const L = 20 + Math.floor(R() * 38), G = 50 + Math.floor(R() * 40); x.strokeStyle = `rgba(${L},${G},${L + 8},1)`; x.lineWidth = 1.4 + R() * 2;
        x.beginPath(); x.moveTo(128 + side * hw * 0.15, y - 8 + R() * 8); x.lineTo(px, y + 6 + R() * 12); x.lineTo(px + side * 6, y + 6 + l * sag); x.stroke(); } }
  } else {
    c.width = 256; c.height = 256; const x = c.getContext('2d');
    for (let n = 0; n < 1100; n++) { const a = R() * 6.283, r = Math.sqrt(R()), px = 128 + Math.cos(a) * r * 112, py = 124 + Math.sin(a) * r * 96, rad = 5 + R() * 8;
      const top = 1 - py / 256, H = 78 + Math.floor(R() * 34), Sat = 32 + Math.floor(R() * 20), Li = 15 + top * 22 + R() * 12;
      x.fillStyle = `hsl(${H},${Sat}%,${Li}%)`; x.beginPath(); x.ellipse(px, py, rad, rad * 0.8, R() * 3, 0, 6.283); x.fill(); }
  }
  return canvasTex(c, false);
}
/* a tuft of grass blades with the odd flower */
export function tuftTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), R = alea('tuft-texture'); x.lineCap = 'round';
  for (let i = 0; i < 70; i++) { const bx = 14 + R() * 100, h = 40 + R() * 70, lean = (R() - 0.5) * 36, G = 90 + Math.floor(R() * 90), Rr = Math.floor(G * (0.55 + R() * 0.35));
    x.strokeStyle = `rgb(${Rr},${G},${Math.floor(G * 0.35)})`; x.lineWidth = 1.6 + R() * 1.6; x.beginPath(); x.moveTo(bx, 128); x.quadraticCurveTo(bx + lean * 0.3, 128 - h * 0.6, bx + lean, 128 - h); x.stroke();
    if (R() < 0.07) { x.fillStyle = R() < 0.5 ? '#f4f1e6' : '#f2d04a'; x.beginPath(); x.arc(bx + lean, 128 - h, 3.2, 0, 6.283); x.fill(); } }
  return canvasTex(c, false);
}
/* ripples for the water surface, as a tiling normal map */
export function waterNormalTex() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), im = x.createImageData(S, S), R = alea('water-texture');
  const W = [...Array(9)].map(() => ({ kx: 1 + Math.floor(R() * 5), ky: 1 + Math.floor(R() * 5), p: R() * 6.28, a: 0.5 + R() }));
  const h = (u, v) => { let s = 0; for (const w of W) s += w.a * Math.sin((w.kx * u + w.ky * v) * 6.2832 + w.p); return s; };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const u = i / S, v = j / S, e = 1 / S, dx = h(u + e, v) - h(u - e, v), dy = h(u, v + e) - h(u, v - e), nx = -dx * 1.1, ny = -dy * 1.1, l = Math.hypot(nx, ny, 1), k = (j * S + i) * 4;
    im.data[k] = (nx / l * 0.5 + 0.5) * 255; im.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; im.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[k + 3] = 255; }
  x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

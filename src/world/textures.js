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

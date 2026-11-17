/* The canvas art of the street (D7): three small atlases drawn once from the invented lists in identity.json (signage): shop name boards (256 x 64 cells, Hindi and English, a phone line), hoarding and
   bus-shelter ads (512 x 256 cells, an invented brand, a plain-shape logo and a slogan in both scripts) and vertical banners and posters (256 x 512 cells: civic notices and generic film-style boards). Nothing
   here is a real brand, film or party; see docs/DELHI_LOOK.md section 8. Browser only (canvas). `cell(atlas, i)` gives the uv rectangle of cell i; `signFor(kind, r)` picks a board of a shop kind. */
import * as THREE from 'three';

const DEVA = '"Noto Sans Devanagari","Kohinoor Devanagari","Devanagari Sangam MN","Nirmala UI","Mangal",sans-serif', LAT = '"Helvetica Neue",Arial,system-ui,sans-serif';
const BOARD = { sweets: ['#b8332b', '#fff0c8'], cloth: ['#1f4f8a', '#ffe9a8'], electronics: ['#14233f', '#ffd23f'], hardware: ['#2f5d3a', '#ffffff'], chai: ['#7a3b1c', '#fff0c8'], paan: ['#1f6b3a', '#ffe9a8'], pharmacy: ['#ffffff', '#1d7a46'], mobile: ['#2a64c9', '#ffffff'], barber: ['#5a1f5a', '#ffe9a8'], jewellery: ['#5a1020', '#f6d88a'], spices: ['#b8601c', '#fff6dc'], shoes: ['#1d1d1d', '#ffd23f'], fashion: ['#202020', '#f4f4f0'], restaurant: ['#7a1f1f', '#ffe9a8'], cafe: ['#3a2a20', '#f4e8d4'], bookshop: ['#2a3a5a', '#f4f0e0'] };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const fit = (g, text, font, maxW, size) => { let s = size; do { g.font = font(s); if (g.measureText(text).width <= maxW || s <= 8) break; s -= 2; } while (true); return s; };

function art(g, kind, x, y, s, col) {                                                          // a plain-shape logo in a box of side s
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.08;
  if (kind === 'cup') { g.fillRect(x + s * 0.2, y + s * 0.3, s * 0.5, s * 0.45); g.beginPath(); g.arc(x + s * 0.72, y + s * 0.5, s * 0.14, -1.5, 1.5); g.stroke(); g.fillRect(x + s * 0.1, y + s * 0.78, s * 0.7, s * 0.06); }
  else if (kind === 'phone') { g.fillRect(x + s * 0.3, y + s * 0.1, s * 0.4, s * 0.8); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x + s * 0.34, y + s * 0.16, s * 0.32, s * 0.6); }
  else if (kind === 'drop') { g.beginPath(); g.moveTo(x + s * 0.5, y + s * 0.1); g.quadraticCurveTo(x + s * 0.9, y + s * 0.55, x + s * 0.5, y + s * 0.9); g.quadraticCurveTo(x + s * 0.1, y + s * 0.55, x + s * 0.5, y + s * 0.1); g.fill(); }
  else if (kind === 'coin') { g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.38, 0, 7); g.stroke(); g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.2, 0, 7); g.fill(); }
  else if (kind === 'leaf') { g.beginPath(); g.moveTo(x + s * 0.15, y + s * 0.85); g.quadraticCurveTo(x + s * 0.1, y + s * 0.15, x + s * 0.85, y + s * 0.15); g.quadraticCurveTo(x + s * 0.9, y + s * 0.8, x + s * 0.15, y + s * 0.85); g.fill(); }
  else if (kind === 'bolt') { g.beginPath(); g.moveTo(x + s * 0.55, y + s * 0.05); g.lineTo(x + s * 0.2, y + s * 0.55); g.lineTo(x + s * 0.48, y + s * 0.55); g.lineTo(x + s * 0.38, y + s * 0.95); g.lineTo(x + s * 0.8, y + s * 0.4); g.lineTo(x + s * 0.52, y + s * 0.4); g.closePath(); g.fill(); }
  else if (kind === 'wave') { for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + s * 0.3, y + s * 0.7, s * (0.2 + k * 0.17), -1.1, -0.2); g.stroke(); } }
  else if (kind === 'bowl') { g.beginPath(); g.arc(x + s / 2, y + s * 0.45, s * 0.38, 0, Math.PI); g.fill(); g.fillRect(x + s * 0.3, y + s * 0.8, s * 0.4, s * 0.06); }
  else if (kind === 'cross') { g.fillRect(x + s * 0.4, y + s * 0.15, s * 0.2, s * 0.7); g.fillRect(x + s * 0.15, y + s * 0.4, s * 0.7, s * 0.2); }
  else if (kind === 'tower') { g.fillRect(x + s * 0.2, y + s * 0.3, s * 0.25, s * 0.6); g.fillRect(x + s * 0.5, y + s * 0.1, s * 0.3, s * 0.8); }
  else if (kind === 'wheel') { g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.38, 0, 7); g.stroke(); for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x + s / 2, y + s / 2); g.lineTo(x + s / 2 + Math.cos(k * 1.256) * s * 0.36, y + s / 2 + Math.sin(k * 1.256) * s * 0.36); g.stroke(); } }
  else if (kind === 'book') { g.fillRect(x + s * 0.12, y + s * 0.25, s * 0.35, s * 0.55); g.fillRect(x + s * 0.53, y + s * 0.25, s * 0.35, s * 0.55); }
  else if (kind === 'film') { g.fillRect(x + s * 0.1, y + s * 0.25, s * 0.8, s * 0.5); g.fillStyle = 'rgba(0,0,0,.6)'; for (let k = 0; k < 5; k++) g.fillRect(x + s * (0.14 + k * 0.16), y + s * 0.29, s * 0.08, s * 0.08); }
  else { for (let k = 0; k < 4; k++) g.fillRect(x + s * (0.1 + k * 0.22), y + s * (0.7 - k * 0.15), s * 0.16, s * (0.2 + k * 0.15)); }       // bars
}

export class StreetArt {
  constructor(identity) {
    this.id = identity; const sg = identity.j.signage; this.signCells = []; this.byKind = new Map();
    const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    /* shop boards: 4 x 16 cells of 256 x 64 */
    const sc = mk(1024, 1024), g = sc.getContext('2d'); let n = 0;
    for (const kind in sg.shopNames) for (const [en, hi] of sg.shopNames[kind]) { if (n >= 64) break; const x = (n % 4) * 256, y = Math.floor(n / 4) * 64, [bg, fg] = BOARD[kind] || BOARD.cloth;
      g.fillStyle = bg; g.fillRect(x, y, 256, 64); g.strokeStyle = fg; g.lineWidth = 2; g.strokeRect(x + 3, y + 3, 250, 58); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      let s = fit(g, hi, p => 'bold ' + p + 'px ' + DEVA, 236, 26); g.font = 'bold ' + s + 'px ' + DEVA; g.fillText(hi, x + 128, y + 21);
      s = fit(g, en.toUpperCase(), p => 'bold ' + p + 'px ' + LAT, 236, 15); g.font = 'bold ' + s + 'px ' + LAT; g.fillText(en.toUpperCase(), x + 128, y + 44);
      g.font = '9px ' + LAT; g.globalAlpha = 0.8; g.fillText('Ph: ' + sg.phone, x + 128, y + 57); g.globalAlpha = 1;
      const cell = { kind, i: n, u0: x / 1024, v0: 1 - (y + 64) / 1024, u1: (x + 256) / 1024, v1: 1 - y / 1024 }; this.signCells.push(cell); let l = this.byKind.get(kind); if (!l) this.byKind.set(kind, l = []); l.push(cell); n++; }
    this.signTex = tex(sc);
    /* ads: 4 x 4 cells of 512 x 256 in 2048 x 1024 */
    const ac = mk(2048, 1024), a = ac.getContext('2d'); this.adCells = [];
    sg.ads.forEach((ad, i) => { if (i >= 16) return; const x = (i % 4) * 512, y = Math.floor(i / 4) * 256;
      a.fillStyle = ad.bg; a.fillRect(x, y, 512, 256); a.fillStyle = 'rgba(255,255,255,.12)'; a.beginPath(); a.moveTo(x + 300, y); a.lineTo(x + 512, y); a.lineTo(x + 512, y + 256); a.lineTo(x + 200, y + 256); a.fill();
      art(a, ad.art, x + 14, y + 40, 150, ad.fg); a.fillStyle = ad.fg; a.textAlign = 'left'; a.textBaseline = 'middle';
      let s = fit(a, ad.brand.toUpperCase(), p => '900 ' + p + 'px ' + LAT, 320, 54); a.font = '900 ' + s + 'px ' + LAT; a.fillText(ad.brand.toUpperCase(), x + 176, y + 80);
      s = fit(a, ad.hi, p => 'bold ' + p + 'px ' + DEVA, 320, 36); a.font = 'bold ' + s + 'px ' + DEVA; a.fillText(ad.hi, x + 176, y + 140);
      s = fit(a, ad.en, p => p + 'px ' + LAT, 320, 22); a.font = s + 'px ' + LAT; a.fillText(ad.en, x + 176, y + 190); a.fillStyle = 'rgba(0,0,0,.25)'; a.fillRect(x, y + 226, 512, 30); a.fillStyle = ad.fg; a.font = '14px ' + LAT; a.fillText('T&C apply  |  ' + ad.brand + ' (invented)', x + 14, y + 241);
      this.adCells.push({ i, u0: x / 2048, v0: 1 - (y + 256) / 1024, u1: (x + 512) / 2048, v1: 1 - y / 1024 }); });
    this.adTex = tex(ac);
    /* banners and posters: 4 x 2 cells of 256 x 512 */
    const bc = mk(1024, 1024), b = bc.getContext('2d'); this.bannerCells = []; const notes = sg.notices;
    for (let i = 0; i < 8; i++) { const x = (i % 4) * 256, y = Math.floor(i / 4) * 512; b.textAlign = 'center'; b.textBaseline = 'middle';
      if (i < notes.length) { b.fillStyle = i % 2 ? '#1f5fa8' : '#f4f1e6'; b.fillRect(x, y, 256, 512); b.fillStyle = i % 2 ? '#fff' : '#1f3a6a'; b.fillRect(x + 12, y + 12, 232, 10); b.fillRect(x + 12, y + 490, 232, 10); b.font = 'bold 40px ' + DEVA; wrap(b, notes[i].hi, x + 128, y + 150, 220, 52); b.font = 'bold 28px ' + LAT; wrap(b, notes[i].en, x + 128, y + 330, 220, 34); }
      else { const g2 = b.createLinearGradient(0, y, 0, y + 512); const cols = [['#2a0f3a', '#d9531e'], ['#0f2a3a', '#e3b21a'], ['#3a0f1f', '#e8791e']][i - notes.length]; g2.addColorStop(0, cols[0]); g2.addColorStop(1, cols[1]); b.fillStyle = g2; b.fillRect(x, y, 256, 512);
        b.fillStyle = 'rgba(0,0,0,.55)'; b.beginPath(); b.arc(x + 96, y + 200, 38, 0, 7); b.fill(); b.fillRect(x + 62, y + 238, 68, 170); b.beginPath(); b.arc(x + 170, y + 215, 34, 0, 7); b.fill(); b.fillRect(x + 140, y + 250, 60, 160);
        b.fillStyle = '#fff6d8'; b.font = '900 34px ' + LAT; wrap(b, ['SHEHER KI RAAT', 'DIL KA RASTA', 'AKHRI MOD'][i - notes.length], x + 128, y + 440, 230, 38); b.font = '12px ' + LAT; b.fillText('GENERIC FILM POSTER - INVENTED', x + 128, y + 495); }
      this.bannerCells.push({ i, u0: x / 1024, v0: 1 - (y + 512) / 1024, u1: (x + 256) / 1024, v1: 1 - y / 1024 }); }
    this.bannerTex = tex(bc);
    const m = t => { const q = new THREE.MeshStandardMaterial({ vertexColors: true, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0, roughness: 0.8, metalness: 0, envMapIntensity: 0.2, side: THREE.DoubleSide }); return q; };
    this.mats = { sign: m(this.signTex), ad: m(this.adTex), ban: m(this.bannerTex) };
  }
  setNight(on) { for (const k in this.mats) this.mats[k].emissiveIntensity = on ? (k === 'sign' ? 0.55 : 0.8) : 0; }
  /* a board of a shop kind: the cell for r in [0, 1) (a kind without its own boards takes any) */
  signFor(kind, r) { const l = this.byKind.get(kind) || this.signCells; return l[Math.floor(r * l.length) % l.length]; }
  adFor(r) { return this.adCells[Math.floor(r * this.adCells.length) % this.adCells.length]; }
  bannerFor(r) { return this.bannerCells[Math.floor(r * this.bannerCells.length) % this.bannerCells.length]; }
  dispose() { for (const t of [this.signTex, this.adTex, this.bannerTex]) t.dispose(); for (const k in this.mats) this.mats[k].dispose(); }
}

function wrap(g, text, cx, cy, maxW, lh) {
  const words = text.split(' '), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } lines.push(cur);
  lines.forEach((l, i) => g.fillText(l, cx, cy + (i - (lines.length - 1) / 2) * lh));
}

/* The look of Indian trains, drawn on canvases and put on boxes (owner's photos, 22 Nov 2026): LHB coaches in the red-and-grey livery with yellow destination boards over the windows (Hindi route, the train's name, English
   route and the number in the middle), the coach number plate (S4, B2, A1), "शयनयान / SLEEPER" lettering, barred sleeper windows against sealed air-conditioned ones, blue ICF coaches with a white band, WAP-7 style electric
   locos with a sloping cab, a lit "SUPERFAST EXPRESS" display and the loco number, goods trains of open BOXN wagons, black tank wagons and container flats with a brake van, and suburban EMUs.
   Everything is made at run time: a train's textures are made when it comes into view and freed when it goes (a small cache keeps the last few).
   consist(styleName, real, seed) says which vehicles a train has; TrainArt.build(item, ctx) makes one vehicle: { obj, length, dispose }. Vehicles run along +x with the front at +x, width on z. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HINDI } from './india_network.js';
import { hash, LEN, COLOURS, LOCO, lengthOf } from './train_consist.js';

const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); };
const FONT = (px, w = 700) => `${w} ${px}px "Noto Sans Devanagari","Kohinoor Devanagari","Devanagari Sangam MN",system-ui,Arial,sans-serif`;
const ASC = (px, w = 700) => `${w} ${px}px system-ui,Arial,sans-serif`;
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const PX = 64;                                                                                                         // texture pixels per metre along the coach

/* a passenger coach side (23.5 m by 3.1 m): livery, windows of its class, doors, boards, number plate. info: { name, num, fromEn, toEn, fromHi, toHi, label } */
function coachSide(kind, liv, info) {
  const L = kind === 'emu' ? LEN.emu : LEN.coach, W = Math.round(L * PX), H = Math.round(3.1 * PX), cv = canvas(W, H), c = cv.getContext('2d'), P = COLOURS[liv] || COLOURS.lhb, m = PX;
  c.fillStyle = P.body; c.fillRect(0, 0, W, H); c.fillStyle = P.skirt; c.fillRect(0, H - 0.95 * m, W, 0.95 * m); c.fillStyle = P.roof; c.fillRect(0, 0, W, 0.28 * m);
  if (liv === 'icf') { c.fillStyle = P.stripe; c.fillRect(0, 0.55 * m, W, 0.2 * m); c.fillRect(0, H - 1.25 * m, W, 0.16 * m); }
  else if (liv === 'emu_wr' || liv === 'emu_cr' || liv === 'vande') { c.fillStyle = P.stripe; c.fillRect(0, 1.0 * m, W, 0.18 * m); c.fillRect(0, H - 1.3 * m, W, 0.18 * m); }
  else if (liv === 'maroon') { c.fillStyle = P.stripe; c.fillRect(0, 0.55 * m, W, 0.14 * m); c.fillRect(0, H - 1.25 * m, W, 0.12 * m); }
  const ac = kind === 'ac3' || kind === 'ac2' || kind === 'pantry' || kind === 'vande' || kind === 'vande_end', wy = 0.95 * m, wh = (ac ? 0.85 : 0.72) * m, ww = (ac ? 1.0 : kind === 'general' ? 1.2 : 0.9) * m, n = kind === 'emu' ? 8 : ac ? 10 : kind === 'general' ? 8 : 10, x0 = 2.6 * m, span = (L - 5.2) * m;
  for (let i = 0; i < n; i++) { const x = x0 + (i + 0.5) * span / n - ww / 2; if (kind === 'slr' && (i < 2 || i > n - 3)) continue; if (kind === 'pantry' && i % 3 === 1) continue;
    c.fillStyle = '#1a1a1c'; rr(c, x - 4, wy - 4, ww + 8, wh + 8, 9); c.fill(); c.fillStyle = ac ? '#31404c' : '#46525c'; rr(c, x, wy, ww, wh, 6); c.fill();
    if (!ac) { c.strokeStyle = '#0e0e10'; c.lineWidth = 3; for (let b = 1; b < 7; b++) { c.beginPath(); c.moveTo(x + b * ww / 7, wy); c.lineTo(x + b * ww / 7, wy + wh); c.stroke(); } if (kind === 'sleeper') { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, wy + wh * 0.58, ww, wh * 0.42); } }
    else { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x + 6, wy + 4, ww * 0.35, wh - 8); } }
  for (const dx of [0.35 * m, W - 1.6 * m]) { c.fillStyle = P.skirt; c.fillRect(dx, wy - 0.05 * m, 1.25 * m, 1.9 * m); c.fillStyle = '#16161a'; c.fillRect(dx + 0.12 * m, wy + 0.1 * m, 1.0 * m, 1.5 * m); c.fillStyle = '#ddd'; c.fillRect(dx - 0.08 * m, wy - 0.1 * m, 0.08 * m, 1.9 * m); }   // vestibule doors with grab rails
  if (kind !== 'emu' && info) {
    const board = (x, w, textFn) => { c.fillStyle = '#e9b520'; c.fillRect(x, 0.36 * m, w, 0.44 * m); c.strokeStyle = '#5a3d00'; c.lineWidth = 3; c.strokeRect(x, 0.36 * m, w, 0.44 * m); c.fillStyle = '#1b1405'; textFn(x, w); };
    const cx = W / 2, bw = 3.5 * m; c.textBaseline = 'middle';
    board(cx - bw / 2 - 4.1 * m, 4.0 * m, (x, w) => { c.font = FONT(20); c.textAlign = 'center'; c.fillText(((info.fromHi || '') + ' ⇄ ' + (info.toHi || '')).slice(0, 34), x + w / 2, 0.58 * m, w - 10); });
    board(cx - bw / 2, bw, (x, w) => { c.font = ASC(19); c.textAlign = 'center'; c.fillText(String(info.name || '').toUpperCase().slice(0, 30), x + w / 2, 0.58 * m, w - 10); });
    board(cx + bw / 2 + 0.6 * m, 4.0 * m, (x, w) => { c.font = ASC(17); c.textAlign = 'center'; c.fillText(((info.fromEn || '') + '  ' + (info.num || '') + '  ' + (info.toEn || '')).toUpperCase().slice(0, 36), x + w / 2, 0.58 * m, w - 10); });
    if (kind === 'sleeper' || kind === 'general') { c.fillStyle = '#f2c230'; c.textAlign = 'left'; c.font = FONT(34); c.fillText(kind === 'sleeper' ? 'शयनयान' : 'द्वितीय श्रेणी', W - 4.4 * m, H - 1.15 * m); c.font = ASC(14); c.fillText(kind === 'sleeper' ? 'SLEEPER' : 'GENERAL', 2.0 * m, H - 1.15 * m); }
    else if (ac) { c.fillStyle = '#f2c230'; c.textAlign = 'left'; c.font = FONT(26); c.fillText(kind === 'ac2' ? 'द्वितीय वातानुकूलित' : kind === 'pantry' ? 'पैन्ट्री कार' : 'तृतीय वातानुकूलित', W - 5.6 * m, H - 1.15 * m); c.font = ASC(14); c.fillText(kind === 'ac2' ? 'AC 2 TIER' : kind === 'pantry' ? 'PANTRY CAR' : 'AC 3 TIER', 2.0 * m, H - 1.15 * m); }
    const lab = info.label || ''; if (lab) { c.fillStyle = '#e9b520'; c.fillRect(cx - 0.45 * m, 1.9 * m, 0.9 * m, 0.7 * m); c.strokeStyle = '#5a3d00'; c.strokeRect(cx - 0.45 * m, 1.9 * m, 0.9 * m, 0.7 * m); c.fillStyle = '#1b1405'; c.textAlign = 'center'; c.font = ASC(24); c.fillText(lab, cx, 2.25 * m); }
    c.fillStyle = '#d9541f'; c.beginPath(); c.arc(cx + 4.6 * m, H - 0.55 * m, 0.33 * m, 0, 7); c.fill(); c.fillStyle = '#f2c230'; c.beginPath(); c.arc(cx + 4.6 * m, H - 0.55 * m, 0.22 * m, 0, 7); c.fill();                    // the Indian Railways disc
  } else if (kind === 'emu') { c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = ASC(18); c.fillText(info && info.label ? 'MOTORMAN  ·  ' + info.label : '', W / 2, 0.55 * m); }
  return cv;
}
/* the loco side (20.6 m by 3.9 m): body colour, white or coloured band, "INDIAN RAILWAYS", the number */
function locoSide(liv, no, model) {
  const L = LEN.loco, W = Math.round(L * PX), H = Math.round(3.9 * PX), cv = canvas(W, H), c = cv.getContext('2d'), P = LOCO[liv] || LOCO.blue, m = PX;
  c.fillStyle = P.body; c.fillRect(0, 0, W, H); c.fillStyle = '#2a2a2e'; c.fillRect(0, H - 0.5 * m, W, 0.5 * m); c.fillStyle = P.band; c.beginPath(); c.moveTo(0, 1.6 * m); c.lineTo(3.2 * m, 1.1 * m); c.lineTo(W - 3.2 * m, 1.1 * m); c.lineTo(W, 1.6 * m); c.lineTo(W, 2.0 * m); c.lineTo(W - 3.2 * m, 1.5 * m); c.lineTo(3.2 * m, 1.5 * m); c.lineTo(0, 2.0 * m); c.fill();
  for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(4.4 * m + i * 1.25 * m, 2.5 * m, 0.7 * m, 1.1 * m); }                    // louvres
  c.fillStyle = P.text; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = ASC(42); c.fillText('INDIAN RAILWAYS', W / 2, 0.75 * m); c.font = ASC(30); c.fillText(String(no), 3.6 * m, 3.35 * m); c.fillText(String(no), W - 3.6 * m, 3.35 * m); c.font = ASC(22); c.fillText(model, W / 2, 3.35 * m);
  c.fillStyle = '#16161a'; rr(c, 0.4 * m, 0.55 * m, 1.7 * m, 1.2 * m, 8); c.fill(); rr(c, W - 2.1 * m, 0.55 * m, 1.7 * m, 1.2 * m, 8); c.fill();               // cab windows
  return cv;
}
function locoFront(liv, no, head) {
  const cv = canvas(256, 256), c = cv.getContext('2d'), P = LOCO[liv] || LOCO.blue; c.fillStyle = P.body; c.fillRect(0, 0, 256, 256); c.fillStyle = P.band; c.fillRect(0, 150, 256, 26); c.fillStyle = '#2a2a2e'; c.fillRect(0, 214, 256, 42);
  c.fillStyle = '#10141a'; rr(c, 22, 54, 100, 78, 10); c.fill(); rr(c, 134, 54, 100, 78, 10); c.fill(); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(30, 60, 36, 66); c.fillRect(142, 60, 36, 66);
  c.fillStyle = '#0d0d10'; rr(c, 50, 8, 156, 36, 6); c.fill(); c.fillStyle = '#ffb000'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = ASC(22); c.fillText(head, 128, 27, 146);                  // the lit headcode display
  for (const x of [48, 208]) { c.fillStyle = '#fff6c9'; c.beginPath(); c.arc(x, 196, 14, 0, 7); c.fill(); } c.fillStyle = '#fff6c9'; c.beginPath(); c.arc(128, 150, 0, 0, 7); c.fill();
  c.fillStyle = P.text; c.font = ASC(20); c.fillText(String(no), 128, 192); return cv;
}
function wagonSide(kind, seed) {
  const L = lengthOf(kind), W = Math.round(L * PX), H = Math.round(2.9 * PX), cv = canvas(W, H), c = cv.getContext('2d'), m = PX; c.textBaseline = 'middle';
  if (kind === 'boxn') { c.fillStyle = '#5a3a2c'; c.fillRect(0, 0, W, H); c.fillStyle = '#3a271e'; for (let i = 1; i < 14; i++) c.fillRect(i * W / 14 - 3, 0.2 * m, 6, H - 0.7 * m); c.fillStyle = '#2d2f33'; c.fillRect(0, H - 0.6 * m, W, 0.6 * m); c.fillStyle = '#e9e4d6'; c.font = ASC(20); c.fillText('BOXNHL  ' + (3100000 + Math.floor(hash(seed, 1) * 899999)), W / 2, 0.55 * m); }
  else if (kind === 'tank') { c.fillStyle = '#2b2d31'; c.fillRect(0, 0, W, H); c.fillStyle = '#f1f1ee'; c.fillRect(0, H * 0.45, W, 0.12 * m); c.font = ASC(24); c.textAlign = 'center'; c.fillText(hash(seed, 2) < 0.5 ? 'PETROLEUM' : 'BTPN', W / 2, H * 0.3); c.font = ASC(18); c.fillText('TANK WAGON  ' + (4000000 + Math.floor(hash(seed, 3) * 899999)), W / 2, H * 0.7); }
  else if (kind === 'container') { const cols = [['#1d4e89', '#fff'], ['#c8431f', '#fff'], ['#6b7076', '#f2c230'], ['#2f7d4f', '#fff']], a = cols[Math.floor(hash(seed, 4) * 4)], b = cols[Math.floor(hash(seed, 5) * 4)]; c.fillStyle = '#2b2d31'; c.fillRect(0, 0, W, H); for (const [x0, col] of [[0.3 * m, a], [L * m / 2 + 0.1 * m, b]]) { c.fillStyle = col[0]; c.fillRect(x0, 0.15 * m, (L / 2 - 0.5) * m, 2.3 * m); c.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 1; i < 12; i++) c.fillRect(x0 + i * (L / 2 - 0.5) * m / 12, 0.15 * m, 3, 2.3 * m); c.fillStyle = col[1]; c.font = ASC(26); c.textAlign = 'center'; c.fillText(['CONCOR', 'ADANI', 'MAERSK', 'HAPAG'][Math.floor(hash(seed, 6) * 4)], x0 + (L / 2 - 0.5) * m / 2, 1.2 * m); } }
  else { c.fillStyle = '#b3201c'; c.fillRect(0, 0, W, H); c.fillStyle = '#f2c230'; c.fillRect(0, H * 0.5, W, 0.25 * m); c.fillStyle = '#16161a'; rr(c, W * 0.3, 0.7 * m, 0.7 * m, 0.7 * m, 4); c.fill(); rr(c, W * 0.6, 0.7 * m, 0.7 * m, 0.7 * m, 4); c.fill(); c.fillStyle = '#fff'; c.font = ASC(20); c.textAlign = 'center'; c.fillText('BRAKE VAN', W / 2, H * 0.75); }
  return cv;
}


/* Vande Bharat (owner's photos): white body, a deep blue band along the base and sweeping up round the nose, a continuous dark window band, plug doors, "वंदे भारत EXPRESS" in blue, the tricolour at the nose */
function vandeSide(info) {
  const L = LEN.coach, W = Math.round(L * PX), H = Math.round(3.1 * PX), cv = canvas(W, H), c = cv.getContext('2d'), m = PX;
  c.fillStyle = '#f2f4f5'; c.fillRect(0, 0, W, H); c.fillStyle = '#a9aeb4'; c.fillRect(0, H - 0.7 * m, W, 0.7 * m); c.fillStyle = '#1b4f9c'; c.fillRect(0, H - 1.05 * m, W, 0.3 * m); c.fillStyle = '#d3d7db'; c.fillRect(0, 0, W, 0.22 * m);
  c.fillStyle = '#16212b'; for (let i = 0; i < 5; i++) { const x = (2.0 + i * 4.3) * m; rr(c, x, 0.8 * m, 3.4 * m, 0.7 * m, 10); c.fill(); }                                                         // big tinted windows between the doors
  for (const dx of [0.5 * m, W - 2.4 * m]) { c.fillStyle = '#c6cacf'; rr(c, dx, 0.55 * m, 1.9 * m, 1.9 * m, 8); c.fill(); c.fillStyle = '#16212b'; rr(c, dx + 0.35 * m, 0.8 * m, 1.2 * m, 0.7 * m, 6); c.fill(); c.fillStyle = '#1b4f9c'; c.fillRect(dx + 0.95 * m, 0.6 * m, 0.04 * m, 1.8 * m); }
  c.fillStyle = '#1b4f9c'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = FONT(30); c.fillText('वंदे भारत', W / 2 - 1.2 * m, 1.95 * m); c.font = ASC(20); c.fillText('EXPRESS', W / 2 + 0.3 * m, 2.25 * m);
  c.fillStyle = '#1b4f9c'; c.font = ASC(18); c.textAlign = 'center'; c.fillText((info && info.label) || '', W / 2, 0.3 * m); c.fillStyle = '#e8801f'; c.fillRect(W / 2 - 3.6 * m, 2.7 * m, 0.5 * m, 0.1 * m); c.fillStyle = '#fff'; c.fillRect(W / 2 - 3.1 * m, 2.7 * m, 0.5 * m, 0.1 * m); c.fillStyle = '#1b7a3a'; c.fillRect(W / 2 - 2.6 * m, 2.7 * m, 0.5 * m, 0.1 * m);
  return cv;
}
function vandeNose(name) {
  const cv = canvas(256, 256), c = cv.getContext('2d'); c.fillStyle = '#f2f4f5'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#1b4f9c'; c.beginPath(); c.moveTo(0, 150); c.quadraticCurveTo(128, 100, 256, 150); c.lineTo(256, 256); c.lineTo(0, 256); c.fill(); c.fillStyle = '#a9aeb4'; c.fillRect(0, 226, 256, 30);
  c.fillStyle = '#10161d'; rr(c, 40, 34, 176, 82, 18); c.fill(); c.fillStyle = 'rgba(255,255,255,.14)'; rr(c, 52, 42, 60, 60, 12); c.fill(); c.fillStyle = '#fff6c9'; c.beginPath(); c.ellipse(48, 176, 14, 8, 0, 0, 7); c.ellipse(208, 176, 14, 8, 0, 0, 7); c.fill();
  c.fillStyle = '#ffb000'; c.font = ASC(14); c.textAlign = 'center'; c.fillText(name, 128, 24, 150); c.fillStyle = '#e8801f'; c.fillRect(100, 128, 18, 5); c.fillStyle = '#fff'; c.fillRect(118, 128, 18, 5); c.fillStyle = '#1b7a3a'; c.fillRect(136, 128, 18, 5);
  c.fillStyle = '#fff'; c.beginPath(); c.arc(128, 196, 18, 0, 7); c.fill(); c.fillStyle = '#e8801f'; c.font = ASC(18); c.fillText('IR', 128, 197); return cv;
}

/* A vehicle: a textured body box plus a merged mesh of dark details (bogies, buffers, roof equipment, pantograph). */
export class TrainArt {
  constructor() { this.cache = new Map(); this.order = []; this.detail = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.2 }); this.plain = new Map(); }
  t(key, make) { let e = this.cache.get(key); if (!e) { e = { tex: tex(make()) }; this.cache.set(key, e); this.order.push(key); if (this.order.length > 40) { const old = this.order.shift(), o = this.cache.get(old); if (o) { o.tex.dispose(); this.cache.delete(old); } } } return e.tex; }
  mat(texture, extra) { return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, metalness: 0.1, ...extra }); }
  flat(col) { let m = this.plain.get(col); if (!m) { m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.7, metalness: 0.15 }); this.plain.set(col, m); } return m; }
  /* item: { kind, label, end }; ctx: { liveries (consist result), real, local, loco: { no, head }, seed } */
  build(item, ctx) {
    const own = [], M = t => { const m = this.mat(t); own.push(m); return m; }; const kind = item.kind, g = new THREE.Group(), parts = [], liv = ctx.cs.livery, L = lengthOf(kind), add = (w, h, d, x, y, z, col) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); const n = b.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(col); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } b.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(b); };
    const info = { name: ctx.real ? ctx.real.name.replace(/^.*?-/, '').replace(/\s*(Express|Exp|Expres)\s*$/i, '') + ' ' + (/express|exp/i.test(ctx.real.name) ? 'EXPRESS' : '') : ctx.local ? ctx.local.name : 'PASSENGER', num: ctx.real ? ctx.real.n : '', fromEn: ctx.real ? (ctx.names[ctx.real.stops[0][0]] || '') : '', toEn: ctx.real ? (ctx.names[ctx.real.stops[ctx.real.stops.length - 1][0]] || '') : '', fromHi: ctx.real ? (HINDI[ctx.real.stops[0][0]] || '') : '', toHi: ctx.real ? (HINDI[ctx.real.stops[ctx.real.stops.length - 1][0]] || '') : '', label: item.label };
    const bogie = (x) => { add(3.4, 0.7, 2.4, x, 0.55, 0, 0x1c1c1f); add(0.5, 0.5, 2.0, x - 1.1, 0.55, 0, 0x4a4a4e); add(0.5, 0.5, 2.0, x + 1.1, 0.55, 0, 0x4a4a4e); };
    const buffers = (len) => { for (const sx of [-1, 1]) for (const z of [-0.8, 0.8]) add(0.5, 0.35, 0.35, sx * (len / 2 + 0.2), 1.05, z, 0x2a2a2e); };
    if (kind === 'loco') {
      const no = ctx.loco.no, liveryKey = ctx.cs.loco || 'blue', side = this.t('ls|' + liveryKey + '|' + no + '|' + item.label, () => locoSide(liveryKey, no, item.label)), front = this.t('lf|' + liveryKey + '|' + no + '|' + ctx.loco.head, () => locoFront(liveryKey, no, ctx.loco.head)), P = LOCO[liveryKey];
      const hood = new THREE.BoxGeometry(LEN.loco - 6.4, 3.0, 3.1), mats = [this.flat(P.body), this.flat(P.body), this.flat(P.accent), this.flat(0x2a2a2e), M(side), M(side)];
      // the side texture is the whole 20.6 m; the hood shows the middle part of it
      const uv = hood.attributes.uv, u0 = 3.2 / LEN.loco, u1 = 1 - 3.2 / LEN.loco; for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0));
      const hm = new THREE.Mesh(hood, mats); hm.position.set(0, 1.15 + 1.5, 0); g.add(hm);
      for (const sx of [-1, 1]) { const cab = new THREE.BoxGeometry(3.2, 3.9, 3.1), p = cab.attributes.position; for (let i = 0; i < p.count; i++) if (p.getX(i) * sx > 0 && p.getY(i) > 0) p.setX(i, p.getX(i) - sx * 0.7); cab.computeVertexNormals();
        const cu = cab.attributes.uv; for (let i = 0; i < cu.count; i++) { /* side faces: map the cab's own end of the side texture */ } const ce = sx > 0 ? M(front) : M(front);
        const cm = new THREE.Mesh(cab, sx > 0 ? [ce, this.flat(P.body), this.flat(P.accent), this.flat(0x2a2a2e), this.flat(P.body), this.flat(P.body)] : [this.flat(P.body), ce, this.flat(P.accent), this.flat(0x2a2a2e), this.flat(P.body), this.flat(P.body)]); cm.position.set(sx * (LEN.loco / 2 - 1.6), 1.15 + 1.95, 0); g.add(cm); }
      if (item.diesel) { add(1.4, 1.0, 1.4, 5.5, 4.55, 0, 0x2f343a); add(5.0, 0.5, 2.2, -4.5, 4.4, 0, 0x4a4f55); add(2.0, 0.3, 2.6, 1, 4.4, 0, 0x3a3f45); }                         // a diesel: radiator hoods and an exhaust, no pantograph
      else { add(2.2, 0.12, 1.6, 0, 4.55, 0, 0x2f343a); add(0.1, 0.9, 0.1, 0.9, 4.9, 0.5, 0x2f343a); add(0.1, 0.9, -0.1 + 0.2, 0.9, 4.9, -0.5, 0x2f343a); add(1.4, 0.06, 1.8, 0.2, 5.35, 0, 0x111111); add(1.4, 0.06, 1.8, 6.5, 5.35, 0, 0x111111); add(1.2, 0.12, 1.4, 6.5, 4.5, 0, 0x2f343a); }   // two pantographs
      bogie(-6.4); bogie(6.4); buffers(LEN.loco);
    } else if (kind === 'maint' || kind === 'maint_wagon') {                                                           // yellow track-maintenance machine and its wagons (the yellow livery is for maintenance and inspection)
      const yel = this.flat(0xf0c01f), dark = this.flat(0x16212b), grey = this.flat(0x55595f);
      if (kind === 'maint') { const cab = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.0, 3.1), [yel, yel, yel, grey, yel, yel]); cab.position.set(4.2, 1.4 + 1.5, 0); g.add(cab); const win = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.0, 3.2), dark); win.position.set(4.2, 3.5, 0); g.add(win); const hood = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.2, 3.1), [yel, yel, yel, grey, yel, yel]); hood.position.set(-2.4, 1.4 + 1.1, 0); g.add(hood); add(1.0, 4.2, 0.4, -4.5, 3.6, 0, 0xf0c01f); add(7.0, 0.5, 0.5, -1.0, 6.0, 0, 0xf0c01f); add(0.4, 0.4, 3.0, 4.2, 5.1, 0, 0x2f343a); }
      else { const w = new THREE.Mesh(new THREE.BoxGeometry(11.6, 1.8, 2.9), [yel, yel, yel, grey, yel, yel]); w.position.set(0, 1.4 + 0.9, 0); g.add(w); add(10, 0.5, 2.6, 0, 3.0, 0, 0x6b6f75); add(4.0, 1.4, 2.4, 2.5, 3.5, 0, 0xf0c01f); }
      bogie(-L / 2 + 2.2); bogie(L / 2 - 2.2); buffers(L);
    } else if (kind === 'boxn' || kind === 'tank' || kind === 'container' || kind === 'brake') {
      const side = this.t('w|' + kind + '|' + (ctx.seed % 7) + '|' + (item.label || ''), () => wagonSide(kind, ctx.seed + (item.i || 0) * 3));
      if (kind === 'tank') { const cyl = new THREE.CylinderGeometry(1.3, 1.3, L - 1.2, 14); cyl.rotateZ(Math.PI / 2); const cm = new THREE.Mesh(cyl, M(side)); cm.position.set(0, 1.2 + 1.45, 0); g.add(cm); add(L, 0.4, 2.4, 0, 1.15, 0, 0x1c1c1f); }
      else if (kind === 'container') { add(L, 0.35, 2.6, 0, 1.2, 0, 0x2b2d31); const b = new THREE.Mesh(new THREE.BoxGeometry(L - 0.4, 2.55, 2.45), [this.flat(0x555a60), this.flat(0x555a60), this.flat(0x555a60), this.flat(0x2b2d31), M(side), M(side)]); b.position.set(0, 1.4 + 1.275, 0); g.add(b); }
      else { const hgt = kind === 'brake' ? 3.0 : 2.4, b = new THREE.Mesh(new THREE.BoxGeometry(L - 0.2, hgt, 2.9), [this.flat(0x2b2d31), this.flat(0x2b2d31), this.flat(kind === 'boxn' ? 0x1b1b1c : 0xb3201c), this.flat(0x1c1c1f), M(side), M(side)]); b.position.set(0, 1.3 + hgt / 2, 0); g.add(b); }
      bogie(-L / 2 + 2.2); bogie(L / 2 - 2.2); buffers(L);
    } else {                                                                                                          // a passenger coach, EMU car or Vande Bharat car
      const kk = kind === 'vande_end' ? 'vande' : kind, key = 'cs|' + kk + '|' + liv + '|' + info.name + '|' + info.num, side = this.t(key, () => kk === 'vande' ? vandeSide(info) : coachSide(kk, liv, info)), P = COLOURS[liv] || COLOURS.lhb, W = kind === 'emu' ? 3.66 : 3.25;
      const body = new THREE.BoxGeometry(L, 3.1, W), sideM = M(side), endM = this.flat(new THREE.Color(P.skirt).getHex()); let mats = [endM, endM, this.flat(new THREE.Color(P.roof).getHex()), this.flat(0x1c1c1f), sideM, sideM];
      if (item.end) {                                                                                               // the cab end of an EMU or Vande Bharat: a yellow or white nose with a windscreen
        const nose = kind === 'vande_end' ? this.t('vnose|' + info.name, () => vandeNose(info.name.replace(/ Vande Bharat Express/i, '').slice(0, 24))) : this.t('nose|' + liv, () => { const cv = canvas(256, 256), c = cv.getContext('2d'); c.fillStyle = liv === 'emu_wr' || liv === 'emu_cr' ? '#f2c230' : '#f1f3f4'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#10141a'; rr(c, 30, 44, 196, 100, 14); c.fill(); c.fillStyle = '#fff6c9'; c.beginPath(); c.arc(50, 190, 13, 0, 7); c.arc(206, 190, 13, 0, 7); c.fill(); c.fillStyle = '#ffb000'; c.font = ASC(20); c.textAlign = 'center'; c.fillText(info.name.slice(0, 18), 128, 28); return cv; });
        mats = item.end > 0 ? [M(nose), endM, mats[2], mats[3], sideM, sideM] : [endM, M(nose), mats[2], mats[3], sideM, sideM]; }
      if (kind === 'vande_end') { const p = body.attributes.position, sx = item.end; for (let i = 0; i < p.count; i++) if (p.getX(i) * sx > 0) { const up = (p.getY(i) + 1.55) / 3.1; p.setX(i, p.getX(i) - sx * (0.9 + 1.6 * up)); p.setZ(i, p.getZ(i) * (0.9 - 0.12 * up)); } body.computeVertexNormals(); }          // the rounded, sloping Vande Bharat nose
      const bm = new THREE.Mesh(body, mats); bm.position.set(0, 1.25 + 1.55, 0); g.add(bm);
      bogie(-L / 2 + 3.6); bogie(L / 2 - 3.6); if (kind !== 'emu' && kind !== 'vande' && kind !== 'vande_end') buffers(L);
      if (kk === 'ac3' || kk === 'ac2' || kk === 'pantry' || kk === 'vande') { add(1.8, 0.25, 1.4, -5, 4.4, 0, 0xb4b8bd); add(1.8, 0.25, 1.4, 5, 4.4, 0, 0xb4b8bd); }                                       // the roof air-conditioning units
      if (kind === 'emu' || kind === 'vande') add(2.2, 0.12, 1.6, 0, 4.5, 0, 0x2f343a);
    }
    const dm = new THREE.Mesh(mergeGeometries(parts), this.detail); g.add(dm); g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return { obj: g, length: L, dispose: () => { for (const o of g.children) if (o.geometry) o.geometry.dispose(); for (const m of own) m.dispose(); } };
  }
}

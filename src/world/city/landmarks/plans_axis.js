/* The ceremonial axis of Lutyens' Delhi: India Gate with the canopy and the avenue trees, Rashtrapati Bhavan, and the secretariat blocks, Parliament. Local frame: x along the landmark's yaw, z across, y up. */

const SAND = 0xc27a58, SANDL = 0xd1906a, SAND_D = 0xa95f43;

/* India Gate: a 42 m arch of Bharatpur sandstone on a three-tier plinth: round-headed archway through the depth (along x, the line of Kartavya Path), a deep cornice, an attic with INDIA cut on both faces, and the shallow bowl that
   was meant for a flame on top. 150 m east of it stands the canopy (the chhatri) with the statue of Subhas Chandra Bose; two rows of avenue trees run west along the lawns. */
const indiaGate = {
  ground: s => [{ x: 0, z: 0, hx: s.hx + 6, hz: s.hz + 6 }, { x: 148, z: 0, hx: 9, hz: 9 }],
  boardY: () => 46,
  build(k, s) {
    const H = s.h || 42, hx = s.hx, hz = s.hz;
    for (let i = 0; i < 3; i++) { const g = i * 0.9; k.box(0, i * 0.7, 0, 2 * (hx - g), 0.7, 2 * (hz - g), i === 0 ? SANDL : SAND); }                      // the plinth: three tiers to 2.1 m
    const y0 = 2.1, yc = Math.round(H * 0.857), bw = 2 * hz - 4, bd = 2 * hx - 4.4, aw = bw * 0.47, ah = Math.min(yc - y0 - 7, 23);
    k.arch(0, y0, 0, bw, yc - y0, bd, aw, ah, SAND, { ry: Math.PI / 2 });                                                                                // the body with its archway through x
    k.box(0, yc, 0, bd + 2.4, 1.3, bw + 2.4, SANDL); k.box(0, yc + 1.3, 0, bd + 1.2, 1.0, bw + 1.2, SAND);                                               // cornice in two courses
    const ay = yc + 2.3, ah2 = H - 1.5 - ay; k.box(0, ay, 0, bd * 0.72, ah2, bw * 0.8, SAND);                                                            // the attic
    k.cyl(0, H - 1.5, 0, 5.4, 4.2, 1.0, SANDL, { seg: 24 }); k.dome(0, H - 0.5, 0, 4.6, 0.5, SAND, { seg: 24, rings: 3 });                                 // the shallow bowl at the top
    for (const sd of [1, -1]) {
      k.sign('INDIA', sd * (bd * 0.36 + 0.03), ay + ah2 * 0.5, 0, bw * 0.62, Math.min(2.2, ah2 * 0.6), sd * Math.PI / 2, { bg: '#c27a58', fg: '#7a3d2a' });  // the inscription
      for (const zz of [-1, 1]) k.box(sd * (bd / 2 + 0.05), y0 + 3, zz * (aw / 2 + (bw - aw) / 4), 0.14, yc - y0 - 8, (bw - aw) / 2 - 2, SAND_D, { d: true });  // the panels with the names of the fallen
      k.box(sd * (bd / 2 + 0.2), y0, 0, 0.6, 0.35, aw + 3, SANDL, { d: true });                                                                         // the sill of the archway
    }
    k.solid(0, 0, hx - 0.4, hz - 0.4, 1.5);                                                                                                              // the plinth is a wall for cars
    /* the canopy (chhatri) 148 m east: a platform, four piers each side, stepped pyramid roof, small cupola, the statue under it */
    const cx = 148, C = 0xc9855f;
    k.box(cx, 0, 0, 14, 0.9, 14, SANDL); k.box(cx, 0.9, 0, 11.5, 0.5, 11.5, SAND);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (const o of [-0.9, 0.9]) { k.box(cx + a * 4.3 + (a * o * 0.5), 1.4, b * 4.3, 1.5, 9.5, 1.5, C); }
    k.box(cx, 10.9, 0, 12.2, 1.1, 12.2, SANDL); k.box(cx, 12, 0, 9.6, 1.0, 9.6, SAND); k.box(cx, 13, 0, 7, 1.0, 7, SANDL); k.box(cx, 14, 0, 4.4, 1.0, 4.4, SAND); k.cyl(cx, 15, 0, 0.6, 1.6, 1.8, SANDL, { seg: 8 });
    k.box(cx, 1.4, 0, 1.6, 7.5, 1.0, 0x3a3c3e, { d: true }); k.box(cx, 8.9, 0, 0.95, 1.0, 0.8, 0x3a3c3e, { d: true });                                      // the dark granite statue
    k.solid(cx, 0, 7, 7, 1.4);
    /* avenue trees along the lawns west of the gate (the lawns, paths and ponds themselves come from the map) */
    for (let i = 0; i < 22; i++) for (const zz of [-42, 42]) k.tree(-170 - i * 11.5, zz + (k.rnd() - 0.5) * 3, 9 + k.rnd() * 3, 0x3f6b2e, { d: false });
  },
};

export const AXIS = { 'india-gate': indiaGate };

/* ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
const RED = 0xb04a35, CREAM = 0xe3d0a2, CHAJJA = 0xcdb27c, DOMEC = 0xd9d1bb, GREEN = 0x6f9a86;

/* Rashtrapati Bhavan: the Viceroy's House of Lutyens, facing east to Kartavya Path. A red sandstone base and cream upper walls (windows from the facade texture), two long wings reaching east round the forecourt, the central
   block with a twelve-column portico and, over it, the great dome on its columned drum (the dome reaches 55 m: the data's 20 m is the roofline of the wings), deep chhajja eaves, and domed kiosks on the roofs. */
const rashtrapatiBhavan = {
  boardY: () => 72,
  build(k, s) {
    const X = f => f * s.hx, Z = f => f * s.hz, wingH = 17, coreH = 24;
    k.polyWall(s.poly, 1.5);
    for (const sg of [-1, 1]) {                                                                                                                                  // the two wings and their links to the central block
      const zc = sg * Z(0.85), w = Z(0.3), x0 = X(-0.8), x1 = X(1.0);
      k.slab(x0, zc - w / 2, x1, zc + w / 2, 0, 3.6, RED); k.slab(x0 + 0.4, zc - w / 2 + 0.4, x1 - 0.4, zc + w / 2 - 0.4, 3.6, wingH - 3.6, CREAM, { mat: 'facade' }); k.slab(x0 - 1.4, zc - w / 2 - 1.4, x1 + 1.4, zc + w / 2 + 1.4, wingH, 1.1, CHAJJA);
      k.slab(x0, sg * Z(0.45), X(-0.5), sg * Z(0.7), 0, 3.6, RED); k.slab(x0 + 0.4, Math.min(sg * Z(0.45), sg * Z(0.7)), X(-0.5), Math.max(sg * Z(0.45), sg * Z(0.7)), 3.6, wingH - 3.6, CREAM, { mat: 'facade' });
      k.colonnade(X(-0.6), zc - sg * (w / 2 + 1.2), X(0.9), zc - sg * (w / 2 + 1.2), 3.6, 17, 0.55, 10, CREAM, { d: true, beamH: 0.9 });                           // the colonnade along the forecourt face
      for (const f of [-0.75, -0.3, 0.2, 0.6, 0.95]) k.kiosk(X(f), wingH + 1.1, zc, 5.2, 3.4, CHAJJA, DOMEC);                                                    // kiosks on the roof
    }
    k.slab(X(-0.7), -Z(0.46), X(0.46), Z(0.46), 0, 4.2, RED); k.slab(X(-0.68), -Z(0.44), X(0.44), Z(0.44), 4.2, coreH - 4.2, CREAM, { mat: 'facade' }); k.slab(X(-0.74), -Z(0.5), X(0.5), Z(0.5), coreH, 1.4, CHAJJA);     // the central block
    for (const sx of [-0.62, 0.38]) for (const sz of [-0.38, 0.38]) k.kiosk(X(sx), coreH + 1.4, Z(sz), 6.2, 4, CHAJJA, DOMEC);
    const pc = X(0.58); k.colonnade(pc, -Z(0.3), pc, Z(0.3), 4.2, 12, 0.95, 19.8, CREAM, { beamH: 1.8, beamW: 4.6, d: false, seg: 10 });                                  // the portico of twelve columns
    k.slab(pc - 2.4, -Z(0.32), pc + 2.4, Z(0.32), 24, 1.8, CHAJJA); k.slab(pc - 3, -Z(0.1), pc + 2, Z(0.1), 25.8, 2.2, CREAM);                                  // entablature and pediment
    k.stairs(X(0.66), 0, 0, Z(0.62), 1.3, 7, 4.2, RED, { ry: Math.PI });                                                                                      // the grand steps
    const dx = X(-0.12); k.cyl(dx, coreH + 1.4, 0, 15.5, 16, 10, CREAM, { seg: 28 }); k.ringColumns(dx, 0, 15.6, 24, coreH + 1.4, 0.45, 9, CREAM, { d: true, beam: false });   // the drum and its ring of columns
    k.ring(dx, 0, 0.1, 17, CHAJJA, { y: coreH + 11.4, seg: 28 }); k.cyl(dx, coreH + 11.4, 0, 16.5, 16.5, 0.9, CHAJJA, { seg: 28 });
    k.dome(dx, coreH + 12.3, 0, 14.5, 12.5, DOMEC, { seg: 28, rings: 8 }); k.cyl(dx, coreH + 24.8, 0, 1.6, 2.4, 3, CHAJJA, { seg: 12 }); k.dome(dx, coreH + 27.8, 0, 1.6, 2.2, GREEN, { seg: 10, rings: 3 }); k.cyl(dx, coreH + 30, 0, 0.05, 0.2, 3.4, 0xd9b54a, { mat: 'gold', seg: 5 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.dome(dx + Math.cos(a) * 11, coreH + 12, Math.sin(a) * 11, 1.0, 1.3, DOMEC, { seg: 8, rings: 3, d: true }); }                // small finials round the dome's foot
  },
};

/* North Block and South Block: the two secretariat buildings on Raisina Hill, either side of Kartavya Path: long, red sandstone below and cream above, a big domed entrance in the middle of the side facing the axis,
   a courtyard cut in each half, a cornice with deep eaves, and a domed kiosk at each corner and over the middle of each wing. `inner` is the side toward the axis. */
function secretariat(s) {
  return { boardY: () => 52, ground: () => [], build(k, sp) {
    const H = sp.h || 30, hx = sp.hx, hz = sp.hz, sgn = sp.l.z < 0 ? 1 : -1, inner = Math.sign(sgn * Math.sin(sp.yaw)) || 1, bh = 4.2;                                  // inner: +1 when the side facing the axis is local +x
    k.polyWall(sp.poly, 1.5);
    k.slab(-hx, -hz, hx, hz, 0, bh, RED); k.slab(-hx + 0.5, -hz + 0.5, hx - 0.5, hz - 0.5, bh, H - bh, CREAM, { mat: 'facade' }); k.slab(-hx - 1.2, -hz - 1.2, hx + 1.2, hz + 1.2, H, 1.2, CHAJJA);
    for (const zz of [-1, -0.5, 0.5, 1]) k.kiosk(0, H + 1.2, zz * hz * 0.92, 6, 4, CHAJJA, DOMEC);
    for (const xx of [-1, 1]) for (const zz of [-1, 1]) k.kiosk(xx * hx * 0.88, H + 1.2, zz * hz * 0.92, 5, 3.4, CHAJJA, DOMEC);
    const ex = inner * (hx + 0.4);                                                                                                                              // the central entrance on the inner side
    k.box(ex + inner * 2.4, 0, 0, 5.6, H + 5, 34, CREAM, { mat: 'facade' }); k.box(ex + inner * 2.4, bh, 0, 6.2, 0.8, 36, CHAJJA);
    k.dome(ex + inner * 0, H + 5, 0, 12, 10, DOMEC, { seg: 24, rings: 7 }); k.cyl(ex, H + 15, 0, 0.1, 1.2, 4, GREEN, { seg: 8 }); k.cyl(ex, H, 0, 13, 13.4, 5, CREAM, { seg: 24 });
    k.colonnade(ex + inner * 6.2, -14, ex + inner * 6.2, 14, 0, 9, 0.8, bh + 8, CREAM, { d: true });
    k.stairs(ex + inner * 12, 0, 0, 26, 1.0, 4, 1.4, RED, { ry: inner > 0 ? Math.PI : 0 });
  } };
}
Object.assign(AXIS, { 'rashtrapati-bhavan': rashtrapatiBhavan, 'north-block': secretariat(), 'south-block': secretariat() });

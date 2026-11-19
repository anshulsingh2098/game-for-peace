/* CP street furniture (docs/CP_MAX_PLAN.md workstream 2b; the owner's research pack rows AST-036 road drain, 038 traffic barricade, 039 parking bollard, 075 distribution transformer, 077 public dustbin, 078 roadside CCTV).
   One function, called once for each street piece of a Connaught Place tile from the street loop in streetlife.js (hook lines in team/stream-a.md A-2026-11-22-02); nothing here knows about three.js: every helper comes in through `h`,
   so tools/selftest.mjs runs it with stubs. Everything is placed by rule from the piece's own numbers (length, half width, sidewalk), deterministically (h.rnd(pc.id, k)), and is cheap: boxes in the vertex-coloured `prop` mesh.
   Sizes are real: dustbin 0.5 x 0.85 x 0.45 m, bollard 0.22 x 0.75 m, barricade 1.9 m wide x 1.0 m, CCTV pole 4.6 m, transformer 1.1 x 1.5 x 0.9 m, drain grating 0.6 x 0.4 m.
   h: { box(M, lx, y, lz, sx, sy, sz, tx, tz, colour), M (the prop mesher), gy, rnd(a, b), C (colour from hex), insideBuilding(x, z, pad), inRoad(x, z, r), L(x, z) -> [lx, lz], circle(x, z, r) }; at(pc, s) -> { x, z, tx, tz }.
   Returns the counts placed. */
const COL = { bin: 0x2f6b3a, binLid: 0x234f2c, bollard: 0xd9d2c0, bollardCap: 0xbdb5a2, orange: 0xe0661a, white: 0xf0efe9, drain: 0x1b1b1d, pole: 0x6b6e72, cam: 0xd8dadc, trans: 0x6c746e, ins: 0xc9c2b0 };
export function cpStreetPiece(pc, at, h) {
  const { box, M, gy, rnd, C, insideBuilding, inRoad, L, circle } = h, n = { bin: 0, bollard: 0, barricade: 0, drain: 0, cctv: 0, transformer: 0 };
  if (pc.len < 14 || !(pc.walk > 0)) return n;
  const spot = (s, off, side) => { const o = at(pc, s), px = o.x + -o.tz * off * side, pz = o.z + o.tx * off * side; return { o, px, pz, ok: !insideBuilding(px, pz, 0.4) && !inRoad(px, pz, 0.5) }; };
  /* bollards: two a kerb line at each end of the piece (where a road mouth opens), 1.1 m apart, on the pavement side only */
  for (const side of [1, -1]) for (const s of [2.6, pc.len - 2.6]) for (let k = 0; k < 2; k++) {
    const q = spot(s + (s < 5 ? 1 : -1) * k * 1.1, pc.hw + 0.5, side); if (!q.ok) continue; const [lx, lz] = L(q.px, q.pz);
    box(M, lx, gy, lz, 0.22, 0.75, 0.22, q.o.tx, q.o.tz, C(COL.bollard)); box(M, lx, gy + 0.75, lz, 0.27, 0.08, 0.27, q.o.tx, q.o.tz, C(COL.bollardCap)); circle(q.px, q.pz, 0.2); n.bollard++; }
  /* dustbins: one every 38 m on one side, green municipal bins with a darker lid */
  const side0 = rnd(pc.id, 71) < 0.5 ? 1 : -1;
  for (let s = 7 + rnd(pc.id, 72) * 10; s < pc.len - 6; s += 38) {
    const q = spot(s, pc.hw + 1.3, side0); if (!q.ok) continue; const [lx, lz] = L(q.px, q.pz);
    box(M, lx, gy, lz, 0.5, 0.85, 0.45, q.o.tx, q.o.tz, C(COL.bin)); box(M, lx, gy + 0.85, lz, 0.54, 0.08, 0.5, q.o.tx, q.o.tz, C(COL.binLid)); circle(q.px, q.pz, 0.4); n.bin++; }
  /* drain gratings: a 0.6 x 0.4 m dark grating in the gutter every 30 m on both sides */
  for (const side of [1, -1]) for (let s = 11 + rnd(pc.id, 73) * 8; s < pc.len - 8; s += 30) {
    const q = spot(s, pc.hw - 0.22, side); if (insideBuilding(q.px, q.pz, 0.1)) continue; const [lx, lz] = L(q.px, q.pz);
    box(M, lx, gy, lz, 0.6, 0.025, 0.4, q.o.tx, q.o.tz, C(COL.drain)); n.drain++; }
  /* a traffic barricade (orange and white, two rails, two legs) on about one piece in five, near the middle, on the road edge */
  if (rnd(pc.id, 74) < 0.2) { const side = rnd(pc.id, 75) < 0.5 ? 1 : -1, q = spot(pc.len * 0.5, pc.hw + 0.35, side);
    if (q.ok) { const [lx, lz] = L(q.px, q.pz), t = q.o;
      box(M, lx, gy + 0.55, lz, 1.9, 0.12, 0.06, t.tx, t.tz, C(COL.orange)); box(M, lx, gy + 0.85, lz, 1.9, 0.12, 0.06, t.tx, t.tz, C(COL.white));
      for (const e of [-0.85, 0.85]) box(M, lx + t.tx * e, gy, lz + t.tz * e, 0.06, 1.0, 0.06, t.tx, t.tz, C(COL.pole)); circle(q.px, q.pz, 0.9); n.barricade++; } }
  /* a CCTV pole (4.6 m, a camera box looking along the street) at about every second piece, 6 m from the start */
  if (rnd(pc.id, 76) < 0.5) { const side = rnd(pc.id, 77) < 0.5 ? 1 : -1, q = spot(6, pc.hw + 1.0, side);
    if (q.ok) { const [lx, lz] = L(q.px, q.pz), t = q.o; box(M, lx, gy, lz, 0.1, 4.6, 0.1, t.tx, t.tz, C(COL.pole)); box(M, lx, gy + 4.45, lz, 0.5, 0.2, 0.22, t.tx, t.tz, C(COL.cam)); circle(q.px, q.pz, 0.2); n.cctv++; } }
  /* a distribution transformer (a grey box on a plinth with three insulators) on about one piece in six, a third along, behind the walk */
  if (rnd(pc.id, 78) < 0.17) { const side = rnd(pc.id, 79) < 0.5 ? 1 : -1, q = spot(pc.len * 0.33, pc.hw + 2.0, side);
    if (q.ok && !insideBuilding(q.px, q.pz, 1.0)) { const [lx, lz] = L(q.px, q.pz), t = q.o;
      box(M, lx, gy, lz, 1.3, 0.2, 1.1, t.tx, t.tz, C(COL.ins)); box(M, lx, gy + 0.2, lz, 1.1, 1.5, 0.9, t.tx, t.tz, C(COL.trans));
      for (const e of [-0.35, 0, 0.35]) box(M, lx + t.tx * e, gy + 1.7, lz + t.tz * e, 0.1, 0.22, 0.1, t.tx, t.tz, C(COL.ins)); circle(q.px, q.pz, 0.9); n.transformer++; } }
  return n;
}

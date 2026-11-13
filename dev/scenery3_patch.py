import re
s = open('game.js', encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

# wider terrain so mountains can rise behind the forest
rep("const TOFF = [5.4, 6.6, 8.5, 11, 15, 21, 30, 42, 58, 78, 100];", "const TOFF = [5.4, 6.6, 8.5, 11, 15, 21, 30, 42, 58, 78, 100, 135, 175, 225, 285];")

# mountains + cliffs in the height function
rep("  fbm(x, y) {", "  cliff(wx, wz) { return smooth(0.58, 0.66, this.fbm(wx * 0.0045 + 3, wz * 0.0045 - 8)); }          // where rock walls rise beside the road\n  fbm(x, y) {")
rep("    return ry - 0.25 * smooth(5, 7, a) * (1 - smooth(7, 12, a)) + smooth(8, 46, a) * hills - 7.5 * river * smooth(10, 30, a);",
    "    const cf = this.cliff(wx, wz), rr = 1 - Math.abs(2 * this.fbm(wx * 0.0016 + 17, wz * 0.0016 - 3) - 1);       // ridged noise = mountain ranges\n    return ry - 0.25 * smooth(5, 7, a) * (1 - smooth(7, 12, a)) + smooth(8, 46, a) * hills - 7.5 * river * smooth(10, 30, a)\n      + cf * smooth(12, 19, a) * (26 + 22 * this.fbm(wx * 0.01 + 5, wz * 0.01)) + smooth(50, 200, a) * Math.pow(rr, 2.6) * 190;")

# snow caps per climate
for name, cap in (('temperate', 1), ('autumn', 1), ('desert', 0), ('snow', 1), ('tropical', 0.35)):
    s, n = re.subn(r'(\n  %s:\s+\{.*?mtnA: [0-9.]+) \}' % name, r'\1, cap: %s }' % cap, s, count=1, flags=re.S)
    assert n == 1, name

# rock, strata and snow colours on high ground and cliff walls
rep("gc[k + c] = lerp(lerp(gc[k + c], snd, sand * 0.5), mud, wet * 0.85); } }",
    "gc[k + c] = lerp(lerp(gc[k + c], snd, sand * 0.5), mud, wet * 0.85); } }\n"
    "        { const hh = y - ry, cf = w.cliff(wx, wz) * smooth(12, 19, Math.abs(t)), rk = Math.max(smooth(30, 58, hh) * 0.95, cf * 0.9), cap = smooth(55, 88, hh) * C.cap, strata = 0.86 + 0.14 * Math.sin(y * 1.9 + w.fbm(wx * 0.05, wz * 0.05) * 6);\n"
    "          for (let c = 0; c < 3; c++) { const rc = [0.50, 0.47, 0.43][c] * strata; gc[k + c] = lerp(lerp(gc[k + c], rc, rk), [0.93, 0.95, 1.0][c], cap); } }")

# trees: none on cliffs or very high ground (rocks instead); extra forest on the far slopes
rep("      if (y - p.y < C.wl + 0.9) continue;\n      const f = w.fbm(wx * 0.01, wz * 0.01), kind = R();",
    "      if (y - p.y < C.wl + 0.9) continue;\n      if (y - p.y > 40 || w.cliff(wx, wz) * smooth(12, 19, Math.abs(t)) > 0.2) { if (R() < 0.4) lists.rock.push([wx - ox, y - oy + 0.1, wz - oz, 0.8 + R() * 2.2, R() * 6.28, 0.55 + R() * 0.5]); continue; }\n      const f = w.fbm(wx * 0.01, wz * 0.01), kind = R();")
rep("        if (w.ter(t, wx, wz, p.y) - p.y < C.wl + 0.9) continue;\n        lists.bush.push(", "        if (w.ter(t, wx, wz, p.y) - p.y < C.wl + 0.9 || w.cliff(wx, wz) * smooth(12, 19, Math.abs(t)) > 0.2) continue;\n        lists.bush.push(")
rep("        if (w.ter(t, wx, wz, p.y) - p.y < C.wl + 0.9) continue;\n        lists.tuft.push(", "        if (w.ter(t, wx, wz, p.y) - p.y < C.wl + 0.9 || w.cliff(wx, wz) * smooth(12, 19, Math.abs(t)) > 0.2) continue;\n        lists.tuft.push(")
rep("    for (let side = -1; side <= 1; side += 2) {\n      for (let n = 0, cnt = Math.round(10 * this.q.trees * Cm.dens); n < cnt; n++) {     // shrubs near the verge",
    "    for (let side = -1; side <= 1; side += 2) for (let n = 0, cnt = Math.round(16 * this.q.trees * Cm.dens); n < cnt; n++) {     // distant forest on the mountain foothills\n"
    "      const t = side * (86 + R() * 95), s = (i0 + R() * ROWS) * DS, p = w.at(s), wx = p.x + Math.cos(p.th) * t, wz = p.z + Math.sin(p.th) * t, y = w.ter(t, wx, wz, p.y), C = this.clim(s);\n"
    "      if (y - p.y < C.wl + 0.9 || y - p.y > 52) continue; const pine = R() < Math.min(1, C.pine + 0.25);\n"
    "      lists[pine ? 'pine' : 'round'].push(T3([wx - ox, y - oy - 0.15, wz - oz, 1.0 + R() * 1.1, R() * 6.28, 0.9 + R() * 0.3], pine ? C.pineT : C.leaf));\n"
    "    }\n"
    "    for (let side = -1; side <= 1; side += 2) {\n      for (let n = 0, cnt = Math.round(10 * this.q.trees * Cm.dens); n < cnt; n++) {     // shrubs near the verge")
open('game.js', 'w', encoding='utf-8').write(s)
print('scenery patched')

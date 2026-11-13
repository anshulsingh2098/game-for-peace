s = open('game.js', encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

# ---- water level per climate ----
for sky, wl in (("skyT: [1, 1, 1, 0],", -3.0), ("skyT: [1, .75, .55, .12],", -3.0), ("skyT: [1, .78, .52, .22],", -60), ("skyT: [.78, .88, 1, .18],", -3.2), ("skyT: [.62, .88, .80, .10],", -2.2)):
    rep(sky, sky + f" wl: {wl},")

# ---- textures: water ripples, chevron sign, speed-limit sign ----
rep("function propGeometry() {", r'''function waterNormalTex() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), im = x.createImageData(S, S), R = rng(77);
  const W = [...Array(9)].map(() => ({ kx: 1 + Math.floor(R() * 5), ky: 1 + Math.floor(R() * 5), p: R() * 6.28, a: 0.5 + R() }));
  const h = (u, v) => { let s = 0; for (const w of W) s += w.a * Math.sin((w.kx * u + w.ky * v) * 6.2832 + w.p); return s; };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const u = i / S, v = j / S, e = 1 / S, dx = h(u + e, v) - h(u - e, v), dy = h(u, v + e) - h(u, v - e), nx = -dx * 3, ny = -dy * 3, l = Math.hypot(nx, ny, 1), k = (j * S + i) * 4;
    im.data[k] = (nx / l * 0.5 + 0.5) * 255; im.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; im.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[k + 3] = 255; }
  x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function signTex(kind) {
  const c = document.createElement('canvas'); c.width = 128; c.height = kind === 'chev' ? 100 : 128; const x = c.getContext('2d');
  if (kind === 'chev') {
    x.fillStyle = '#f0c12a'; x.fillRect(0, 0, 128, 100); x.strokeStyle = '#111'; x.lineWidth = 6; x.strokeRect(5, 5, 118, 90);
    x.lineWidth = 12; x.lineJoin = 'miter'; x.beginPath(); x.moveTo(38, 18); x.lineTo(82, 50); x.lineTo(38, 82); x.stroke();
  } else {
    x.fillStyle = '#f2f2f2'; x.beginPath(); x.arc(64, 64, 62, 0, 6.283); x.fill(); x.strokeStyle = '#c4161c'; x.lineWidth = 12; x.beginPath(); x.arc(64, 64, 54, 0, 6.283); x.stroke();
    x.fillStyle = '#111'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('80', 64, 68);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function propGeometry() {''')
rep("    railpost: tint(", "    signpole: tint(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6).translate(0, 1.2, 0), 0.5, 0.52, 0.55),\n    chev: { foliage: new THREE.PlaneGeometry(1.15, 0.9), mat: new THREE.MeshLambertMaterial({ map: signTex('chev'), side: THREE.DoubleSide }) },\n    limit: { foliage: new THREE.PlaneGeometry(0.9, 0.9), mat: new THREE.MeshLambertMaterial({ map: signTex('limit'), side: THREE.DoubleSide }) },\n    railpost: tint(")
rep("this.sharedGeo = new Set([this.props.pole,", "this.sharedGeo = new Set([this.props.signpole, this.props.chev.foliage, this.props.limit.foliage, this.props.pole,")

# ---- water material ----
rep("    this.uSnow = { value: 0 };", "    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x1d4a5a, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.9, normalMap: waterNormalTex(), normalScale: new THREE.Vector2(0.55, 0.55), envMapIntensity: 1.5 });\n    this.uSnow = { value: 0 };")
rep("    const t = this.skyMat.uniforms.time.value, cam = this.camera.position;", "    const t = this.skyMat.uniforms.time.value, cam = this.camera.position;\n    { const nm = this.waterMat.normalMap; nm.offset.x = (t * 0.011) % 1; nm.offset.y = (t * 0.007) % 1; const icy = cl.g1[2] > 1.2; if (icy !== this._icy) { this._icy = icy; this.waterMat.color.set(icy ? 0x9ab4c6 : 0x1d4a5a); } }")

# ---- shore colours on the terrain, no trees in water ----
rep("gc[k + c] = lerp(dirt[c], base, m) * (0.9 + 0.2 * w.vn(wx * 0.3, wz * 0.3)); }",
    "gc[k + c] = lerp(dirt[c], base, m) * (0.9 + 0.2 * w.vn(wx * 0.3, wz * 0.3)); }\n        { const below = y - ry - C.wl, wet = 1 - smooth(-0.4, 0.7, below), sand = smooth(0.35, 0.9, below) * (1 - smooth(0.9, 1.9, below)); for (let c = 0; c < 3; c++) { const mud = [0.28, 0.24, 0.17][c], snd = [0.66, 0.58, 0.40][c]; gc[k + c] = lerp(lerp(gc[k + c], snd, sand * 0.5), mud, wet * 0.85); } }")
rep("      const f = w.fbm(wx * 0.01, wz * 0.01), kind = R();", "      if (y - p.y < C.wl + 0.9) continue;\n      const f = w.fbm(wx * 0.01, wz * 0.01), kind = R();")
rep("        lists.bush.push(T3(", "        if (w.ter(t, wx, wz, p.y) - p.y < C.wl + 0.9) continue;\n        lists.bush.push(T3(")
rep("        lists.tuft.push(T3(", "        if (w.ter(t, wx, wz, p.y) - p.y < C.wl + 0.9) continue;\n        lists.tuft.push(T3(")

# ---- water mesh per chunk ----
rep("    if (li.length) meshes.push(new THREE.Mesh(geo(lp, lc, li), this.railMat));", '''    if (li.length) meshes.push(new THREE.Mesh(geo(lp, lc, li), this.railMat));
    if (Cm.wl > -20) {                                                    // lakes and rivers: the water follows the road's slope, 3 m below it
      const TW = [-110, -70, -40, -12, 12, 40, 70, 110], wp = [], wu = [], wi = [], nc = TW.length;
      for (let r = 0; r <= ROWS; r++) { const i = i0 + r, th = w.th[i], cx2 = Math.cos(th), sz2 = Math.sin(th), lvl = w.ys[i] + this.clim(i * DS).wl;
        for (const t of TW) { const wx = w.xs[i] + cx2 * t, wz = w.zs[i] + sz2 * t; wp.push(wx - ox, lvl - oy, wz - oz); wu.push(wx * 0.07, wz * 0.07); } }
      for (let r = 0; r < ROWS; r++) for (let j = 0; j < nc - 1; j++) { const a = r * nc + j; wi.push(a, a + 1, a + nc, a + 1, a + nc + 1, a + nc); }
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wp), 3)); wg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(wu), 2)); wg.setIndex(wi); wg.computeVertexNormals();
      const wm = new THREE.Mesh(wg, this.waterMat); wm.renderOrder = 1; g.add(wm);
    }''')

# ---- road signs ----
rep("lp = [], lc = [], li = [], railPosts = [];", "lp = [], lc = [], li = [], railPosts = [], chevs = [], limits = [];")
rep("          if (r % 2 === 0) railPosts.push(", "          if (r % 6 === 0) { const ii = i0 + r, tt = t * 1.12; chevs.push([w.xs[ii] + Math.cos(w.th[ii]) * tt - ox, w.ys[ii] - 0.1 - oy, w.zs[ii] + Math.sin(w.th[ii]) * tt - oz, -w.th[ii], kap > 0 ? 1 : -1]); }\n          if (r % 2 === 0) railPosts.push(")
rep("    if (railPosts.length) lists.railpost =", '''    for (let sp2 = Math.ceil(i0 * DS / 800) * 800; sp2 < (i0 + ROWS) * DS; sp2 += 800) { const p2 = w.at(sp2), tt = 6.9, wx2 = p2.x + Math.cos(p2.th) * tt, wz2 = p2.z + Math.sin(p2.th) * tt; limits.push([wx2 - ox, w.ter(tt, wx2, wz2, p2.y) - oy, wz2 - oz, -p2.th]); }
    lists.signpole = [...chevs, ...limits].map(a => [a[0], a[1], a[2], 1, 0, 1]); lists.chev = chevs.map(a => [a[0], a[1] + 1.65, a[2], a[4], a[3], a[4]]); lists.limit = limits.map(a => [a[0], a[1] + 2.05, a[2], 1, a[3], 1]);
    if (railPosts.length) lists.railpost =''')
rep("    if (lists.pole && lists.pole.length)", "    if (lists.signpole.length) fill(this.props.signpole, this.lam, lists.signpole.map(a => [...a, 0.5]), false);\n    for (const k of ['chev', 'limit']) if (lists[k].length) fill(this.props[k].foliage, this.props[k].mat, lists[k].map(a => [...a, 0.5]), false);\n    if (lists.pole && lists.pole.length)")
open('game.js', 'w', encoding='utf-8').write(s)
print('water + signs patched')

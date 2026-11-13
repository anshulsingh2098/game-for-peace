s = open('game.js', encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)

# ---------- A. sky-based reflections ----------
rep("    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;",
    "    this.pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = this.pm.fromScene(new RoomEnvironment(), 0.04).texture; this.envTimer = 0; this.envSig = '';")
rep("    this.props = propGeometry();", "    this.envScene = new THREE.Scene(); this.envScene.add(new THREE.Mesh(this.sky.geometry, this.skyMat));\n    this.props = propGeometry();")
rep("  configure(o) {", '''  refreshEnv() {                                                // reflections (car paint, wet road) come from the current sky
    const old = this.envRT; this.envRT = this.pm.fromScene(this.envScene, 0, 10, 2000); this.scene.environment = this.envRT.texture; if (old) old.dispose();
  }
  configure(o) {''')
rep("    const ln = this.lightsOn || W.dark > 0.7;", "    this.envTimer -= dt; { const sig = this.time + '|' + this.cName + '|' + Math.round(W.dark * 8) + '|' + Math.round(W.cloud * 8); if ((this.envTimer <= 0 && sig !== this.envSig) || dt === 0) { this.envSig = sig; this.envTimer = 3; this.refreshEnv(); } else if (this.envTimer <= 0) this.envTimer = 3; }\n    const ln = this.lightsOn || W.dark > 0.7;")

# ---------- B. light glow sprites + brake lights ----------
rep("  lightEmit() {", '''  makeGlow() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 1, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  addGlows(id) {
    const L = LIGHTS[id]; if (!L) return; this.glowT = this.glowT || this.makeGlow(); this.glows = [];
    const mk = (pos, col, size, kind) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowT, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 }));
      sp.position.set(...pos); sp.scale.setScalar(size); this.model.add(sp); this.glows.push({ sp, kind }); };
    for (const p of L.tail) mk(p, 0xff2a14, L.ts, 'tail'); for (const p of L.head) mk(p, 0xfff0d0, L.hs, 'head');
    this.tailMats = []; this.model.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => { if (m.name === 'Light_Tail' && !this.tailMats.includes(m)) this.tailMats.push(m); }); });
  }
  lightFx() {
    const brake = !this.demo && this.keys.down && this.v > 1, on = this.lightsNow;
    for (const m of this.tailMats || []) m.emissiveIntensity = brake ? 8 : (on ? 3 : 1.5);
    for (const g of this.glows || []) g.sp.material.opacity = g.kind === 'tail' ? (brake ? 1 : (on ? 0.7 : 0.18)) : (on ? 0.9 : 0.1);
  }
  lightEmit() {''')
rep("const VEH = {", '''const LIGHTS = {   // light positions in model space (front is +Z)
  car:   { tail: [[-0.68, 0.84, -2.27], [0.68, 0.84, -2.27]], head: [[-0.66, 0.74, 2.14], [0.66, 0.74, 2.14]], ts: 0.8, hs: 1.1 },
  truck: { tail: [[-1.1, 1.7, -7.44], [1.1, 1.7, -7.44]], head: [[-0.98, 1.72, 5.96], [0.98, 1.72, 5.96]], ts: 0.9, hs: 1.3 },
  bike:  { tail: [[0, 1.07, -1.05]], head: [[0, 0.86, 0.84]], ts: 0.6, hs: 0.9 }
};
const VEH = {''')
rep("    this.lightsNow = false; this.lightEmit(); this.applyWorld(0);", "    this.addGlows(id); this.lightsNow = false; this.lightEmit(); this.applyWorld(0);")
rep("this.updateChunks(false); this.place(dt); this.updateWorld(dt);", "this.updateChunks(false); this.place(dt); this.updateWorld(dt); this.lightFx();")

# ---------- C. power poles + wires, D. guardrails ----------
rep("    post: mergeGeometries([", '''    pole: mergeGeometries([tint(new THREE.BoxGeometry(0.2, 8.6, 0.2).translate(0, 4.3, 0), 0.30, 0.23, 0.17), tint(new THREE.BoxGeometry(2.3, 0.13, 0.13).translate(0, 8.0, 0), 0.26, 0.20, 0.15),
      tint(new THREE.BoxGeometry(0.1, 0.18, 0.1).translate(-1.0, 8.15, 0), 0.7, 0.7, 0.72), tint(new THREE.BoxGeometry(0.1, 0.18, 0.1).translate(0, 8.15, 0), 0.7, 0.7, 0.72), tint(new THREE.BoxGeometry(0.1, 0.18, 0.1).translate(1.0, 8.15, 0), 0.7, 0.7, 0.72)]),
    railpost: tint(new THREE.BoxGeometry(0.1, 0.85, 0.1).translate(0, 0.425, 0), 0.30, 0.31, 0.33),
    post: mergeGeometries([''')
rep("this.sharedGeo = new Set([this.props.cactus,", "this.sharedGeo = new Set([this.props.pole, this.props.railpost, this.props.cactus,")
rep("    this.markMat = new THREE.MeshBasicMaterial({ vertexColors: true });", "    this.markMat = new THREE.MeshBasicMaterial({ vertexColors: true });\n    this.railMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }); this.wireMat = new THREE.LineBasicMaterial({ color: 0x15151a });")
# guardrail geometry arrays
rep("const rp = [], rc = [], ru = [], ri = [], mp = [], mc = [], mi = [];", "const rp = [], rc = [], ru = [], ri = [], mp = [], mc = [], mi = [], lp = [], lc = [], li = [], railPosts = [];")
rep("      const b = r * 6; for (const c of [0, 2, 4]) quad(ri, b + c, b + c + 1, b + c + 6, b + c + 7, false);", '''      const b = r * 6; for (const c of [0, 2, 4]) quad(ri, b + c, b + c + 1, b + c + 6, b + c + 7, false);
      { const kap = (w.th[i0 + r + 1] - w.th[i0 + r]) / DS;                  // guardrail on the outside of tight bends
        if (Math.abs(kap) > 0.0034) { const t = (kap > 0 ? -1 : 1) * 6.0, v = lp.length / 3;
          for (const rr of [r, r + 1]) { const ii = i0 + rr, cx2 = Math.cos(w.th[ii]), sz2 = Math.sin(w.th[ii]), yy = w.ys[ii] - 0.02;
            for (const hh of [0.45, 0.78]) { lp.push(w.xs[ii] + cx2 * t - ox, yy + hh - oy, w.zs[ii] + sz2 * t - oz); lc.push(0.72, 0.74, 0.77); } }
          li.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
          if (r % 2 === 0) railPosts.push([w.xs[i0 + r] + Math.cos(w.th[i0 + r]) * t - ox, w.ys[i0 + r] - 0.05 - oy, w.zs[i0 + r] + Math.sin(w.th[i0 + r]) * t - oz, -w.th[i0 + r]]); } }''')
rep("    meshes.forEach(m => { m.receiveShadow = this.shadows; g.add(m); });",
    "    if (li.length) meshes.push(new THREE.Mesh(geo(lp, lc, li), this.railMat));\n    meshes.forEach(m => { m.receiveShadow = this.shadows; g.add(m); });")
# poles and wires: owned by the chunk containing the pole
rep("    const fill = (geom, mat, arr, jitter) => {", '''    const POLE = 48, pl = [];
    for (let sp = Math.ceil(i0 * DS / POLE) * POLE; sp < (i0 + ROWS) * DS; sp += POLE) pl.push(sp);
    for (const sp of pl) {
      const side = -1, t = side * 10.5, A = w.at(sp), B = w.at(sp + POLE), pos = (p, tt) => { const wx = p.x + Math.cos(p.th) * tt, wz = p.z + Math.sin(p.th) * tt; return [wx, w.ter(tt, wx, wz, p.y), wz]; };
      const a0 = pos(A, t); lists.pole = lists.pole || []; lists.pole.push([a0[0] - ox, a0[1] - oy, a0[2] - oz, 1, -A.th, 1]);
      const b0 = pos(B, t), segs = [];
      for (const off of [-1, 0, 1]) { let prev = null;
        for (let u = 0; u <= 8; u++) { const f = u / 8, th = lerp(A.th, B.th, f), px = lerp(a0[0], b0[0], f) + Math.cos(th) * off, pz = lerp(a0[2], b0[2], f) + Math.sin(th) * off, py = lerp(a0[1], b0[1], f) + 8.0 - 1.1 * (1 - Math.pow(2 * f - 1, 2));
          const cur = [px - ox, py - oy, pz - oz]; if (prev) segs.push(...prev, ...cur); prev = cur; } }
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3)); g.add(new THREE.LineSegments(wg, this.wireMat));
    }
    if (railPosts.length) lists.railpost = railPosts.map(p => [p[0], p[1], p[2], 1, p[3], 1]);
    const fill = (geom, mat, arr, jitter) => {''')
rep("    if (lists.post.length) fill(this.props.post,", "    if (lists.pole && lists.pole.length) fill(this.props.pole, this.lam, lists.pole.map(a => [...a, 0.5]), false);\n    if (lists.railpost && lists.railpost.length) fill(this.props.railpost, this.lam, lists.railpost.map(a => [...a, 0.5]), false);\n    if (lists.post.length) fill(this.props.post,")

# ---------- F. camera shake ----------
rep("    this.camera.position.set(m.position.x - dx * c.back, m.position.y + c.up, m.position.z - dz * c.back);",
    "    this.camera.position.set(m.position.x - dx * c.back, m.position.y + c.up, m.position.z - dz * c.back);\n    if (!this.demo) { const sh = Math.min(1, this.v / 40) * 0.014 * (this.buffT > 0 ? 2.4 : 1), tt = this.demoT; this.camera.position.x += Math.sin(tt * 43) * Math.sin(tt * 11) * sh; this.camera.position.y += Math.sin(tt * 37 + 1) * Math.sin(tt * 13) * sh; }")
open('game.js', 'w', encoding='utf-8').write(s)
print('visuals2 game.js patched')

# ---------- E. UI: boost speed lines ----------
u = open('index.html', encoding='utf-8').read()
def repu(a, b):
    global u
    assert a in u, a[:80]
    u = u.replace(a, b, 1)
repu('<!-- MENU -->', '<div id="speedlines" aria-hidden="true"></div>\n\n<!-- MENU -->')
repu('/* Garage 3D stage */', '''#speedlines{position:fixed;inset:0;pointer-events:none;opacity:0;transition:opacity .45s;display:none;
  background:repeating-conic-gradient(from 0deg at 50% 55%,rgba(255,255,255,0) 0 2deg,rgba(255,255,255,.2) 2.25deg 2.45deg,rgba(255,255,255,0) 2.8deg 5.5deg);
  -webkit-mask-image:radial-gradient(circle at 50% 55%,transparent 30%,#000 82%);mask-image:radial-gradient(circle at 50% 55%,transparent 30%,#000 82%);animation:streak .18s steps(2) infinite}
@keyframes streak{to{transform:rotate(1.4deg) scale(1.03)}}
body.ingame #speedlines{display:block}body.boosting #speedlines{opacity:.55}
@media (prefers-reduced-motion:reduce){#speedlines{animation:none}}
/* Garage 3D stage */''')
repu("$('#speedBox').classList.toggle('boost',f.buff);", "$('#speedBox').classList.toggle('boost',f.buff);document.body.classList.toggle('boosting',!!f.buff);")
open('index.html', 'w', encoding='utf-8').write(u)
print('ui patched')

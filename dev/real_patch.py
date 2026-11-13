s = open('game.js', encoding='utf-8').read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:60]
    s = s.replace(a, b, count)

# ---- times of day: cloud colours, realistic palette ----
a = s.index('const TIMES = {'); b = s.index('const QUALITY')
s = s[:a] + '''const TIMES = {
  dawn:  { top: '#3d5a96', mid: '#b99ab8', bot: '#f6c9a0', sun: [-0.35, 0.10, -0.9], sunCol: [1, 0.78, 0.55], light: '#ffc79a', li: 2.0, hs: '#b4c4ff', hg: '#5f5a52', hi: 0.6, stars: 0.1, cc: [1, 0.80, 0.72], ca: 0.8, mtn: '#6d6a88' },
  dusk:  { top: '#27305e', mid: '#9d6a8a', bot: '#f2a36e', sun: [-0.35, 0.06, -0.9], sunCol: [1, 0.6, 0.35], light: '#ffa468', li: 1.8, hs: '#8683c4', hg: '#463a48', hi: 0.55, stars: 0.45, cc: [0.96, 0.58, 0.48], ca: 0.75, mtn: '#5b4a72' },
  night: { top: '#03050d', mid: '#0b1230', bot: '#1f2c5c', sun: [-0.3, 0.55, -0.7], sunCol: [0.25, 0.3, 0.5], light: '#8fa6ff', li: 0.45, hs: '#1c2652', hg: '#070810', hi: 0.6, stars: 1, cc: [0.10, 0.13, 0.22], ca: 0.35, mtn: '#11172e' }
};
''' + s[b:]

# ---- sky shader with clouds ----
a = s.index('    this.skyMat = new THREE.ShaderMaterial('); b = s.index('    this.sky = new THREE.Mesh(')
s = s[:a] + '''    this.skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() },
        cloudCol: { value: new THREE.Color() }, cloudAmt: { value: 0.7 }, time: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 cloudCol; uniform float cloudAmt; uniform float time; varying vec3 vDir;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
        float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }
        void main(){ vec3 d = normalize(vDir); float h = d.y;
          vec3 c = mix(bot, mid, smoothstep(-0.02, 0.20, h)); c = mix(c, top, smoothstep(0.15, 0.85, h));
          float sd = max(dot(d, normalize(sunDir)), 0.0);
          vec2 cp = d.xz / (max(h, 0.0) + 0.30) * 1.4 + vec2(time * 0.012, 0.0);
          float cl = smoothstep(0.44, 0.80, fbm(cp)) * smoothstep(0.02, 0.22, h) * cloudAmt;
          float shade = fbm(cp * 1.8 + 3.0);
          vec3 cc = mix(cloudCol * 0.62, cloudCol, shade) + sunCol * pow(sd, 5.0) * 0.55;
          c = mix(c, cc, cl);
          c += sunCol * (pow(sd, 900.0) * 3.5 + pow(sd, 14.0) * 0.30 + pow(sd, 3.0) * 0.10) * (1.0 - cl * 0.85);
          gl_FragColor = vec4(c, 1.0); #include <tonemapping_fragment>
          #include <colorspace_fragment> }` });
''' + s[b:]

# ---- materials ----
rep("    this.groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });",
    "    this.groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: grassTex() });\n    this.roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: asphaltTex() });")
rep("this.renderer.toneMapping = THREE.ACESFilmicToneMapping;", "this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.toneMapping = THREE.ACESFilmicToneMapping;")

# ---- setTime: clouds + far mountains tint ----
rep("this.stars.material.opacity = T.stars;", "const u2 = this.skyMat.uniforms; u2.cloudCol.value.setRGB(...T.cc); u2.cloudAmt.value = T.ca; this.mtnCol = new THREE.Color(T.mtn);\n    this.stars.material.opacity = T.stars;")
rep("this.lightsOn = name === 'night'; if (this.model) this.lightEmit();", "this.lightsOn = name === 'night'; if (this.model) this.lightEmit(); this.tintFar();")

# ---- terrain colours, uv, slope rock ----
rep("grass = [0.27, 0.50, 0.18], grass2 = [0.17, 0.36, 0.14], dirt = [0.33, 0.28, 0.20];",
    "grass = [0.40, 0.50, 0.22], grass2 = [0.20, 0.31, 0.12], dirt = [0.45, 0.38, 0.28], rock = [0.50, 0.47, 0.43];")
rep("const gp = new Float32Array((ROWS + 1) * vpr * 3), gc = new Float32Array((ROWS + 1) * vpr * 3), gi = [];",
    "const gp = new Float32Array((ROWS + 1) * vpr * 3), gc = new Float32Array((ROWS + 1) * vpr * 3), gu = new Float32Array((ROWS + 1) * vpr * 2), gi = [];")
rep("        gp[k] = wx - ox; gp[k + 1] = y - oy; gp[k + 2] = wz - oz;",
    "        gp[k] = wx - ox; gp[k + 1] = y - oy; gp[k + 2] = wz - oz; gu[(r * vpr + side * nT + j) * 2] = wx * 0.11; gu[(r * vpr + side * nT + j) * 2 + 1] = wz * 0.11;")
rep("        if (asph) rc.push(0.17, 0.17, 0.19); else rc.push(dirt[0] * 1.15, dirt[1] * 1.1, dirt[2] * 1.05);",
    "        if (asph) rc.push(0.78, 0.78, 0.80); else rc.push(0.85, 0.82, 0.76);\n        ru.push((t + 5.4) / 10.8, s0 / 9);")
rep("const rp = [], rc = [], ri = [], mp = [], mc = [], mi = [];", "const rp = [], rc = [], ru = [], ri = [], mp = [], mc = [], mi = [];")
rep("      const i = i0 + r, x = w.xs[i], z = w.zs[i], ry = w.ys[i], th = w.th[i], cx = Math.cos(th), sz = Math.sin(th);\n      for (let side = 0;",
    "      const i = i0 + r, x = w.xs[i], z = w.zs[i], ry = w.ys[i], th = w.th[i], cx = Math.cos(th), sz = Math.sin(th), s0 = i * DS;\n      for (let side = 0;")
rep("    const geo = (p, c, idx) => { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3)); gg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(c), 3)); gg.setIndex(idx); gg.computeVertexNormals(); return gg; };",
    "    const geo = (p, c, idx, uv) => { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3)); gg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(c), 3)); if (uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2)); gg.setIndex(idx); gg.computeVertexNormals(); return gg; };")
rep("tg.setIndex(gi); tg.computeVertexNormals();",
    "tg.setAttribute('uv', new THREE.BufferAttribute(gu, 2)); tg.setIndex(gi); tg.computeVertexNormals();\n    { const nn = tg.attributes.normal; for (let v = 0; v < nn.count; v++) { const m = Math.min(1, Math.max(0, (0.86 - nn.getY(v)) / 0.2)) * smooth(-20, 20, Math.abs(gp[v * 3 + 1] - (gp[(v % vpr) * 3 + 1])) + 12); if (m > 0) for (let c = 0; c < 3; c++) gc[v * 3 + c] = lerp(gc[v * 3 + c], rock[c], m * 0.85); } tg.attributes.color.needsUpdate = true; }")
rep("const meshes = [new THREE.Mesh(tg, this.groundMat), new THREE.Mesh(geo(rp, rc, ri), this.groundMat), new THREE.Mesh(geo(mp, mc, mi), this.markMat)];\n    meshes.forEach(m => { m.frustumCulled = true; g.add(m); });",
    "const meshes = [new THREE.Mesh(tg, this.groundMat), new THREE.Mesh(geo(rp, rc, ri, ru), this.roadMat), new THREE.Mesh(geo(mp, mc, mi), this.markMat)];\n    meshes.forEach(m => { m.receiveShadow = this.shadows; g.add(m); });")

# ---- trees: trunk + textured crossed cards ----
a = s.index("    for (const [k, arr] of Object.entries(lists)) {"); b = s.index("    this.scene.add(g);\n    return { g,")
s = s[:a] + '''    const fill = (geom, mat, arr, jitter) => {
      const im = new THREE.InstancedMesh(geom, mat, arr.length);
      arr.forEach((a, n) => { P.set(a[0], a[1], a[2]); q.setFromEuler(e.set(0, a[4], 0)); S.set(a[3], a[3] * (a[5] || 1), a[3]); im.setMatrixAt(n, M.compose(P, q, S));
        const v = 0.80 + a[6] * 0.4; im.setColorAt(n, jitter ? col.setRGB(v, v * (0.94 + a[6] * 0.12), v * (0.92 + a[6] * 0.1)) : col.setRGB(1, 1, 1)); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); g.add(im); return im;
    };
    for (const k of ['pine', 'round']) { const arr = lists[k].map(a => [...a, R()]); if (!arr.length) continue; fill(this.props[k].trunk, this.lam, arr, false); fill(this.props[k].foliage, this.props[k].mat, arr, true); }
    if (lists.rock.length) fill(this.props.rock, this.lam, lists.rock.map(a => [...a, R()]), true);
    if (lists.post.length) fill(this.props.post, this.lam, lists.post.map(a => [...a, 0.5]), false);
''' + s[b:]
rep("lists.rock.push([wx - ox, y - oy + 0.2, wz - oz, 0.6 + R() * 1.6, R() * 6.28, 0.45]); continue;", "lists.rock.push([wx - ox, y - oy + 0.1, wz - oz, 0.5 + R() * 1.7, R() * 6.28, 0.55 + R() * 0.5]); continue;")
rep("const sc = 0.8 + R() * 0.9; lists[kind < 0.7 ? 'pine' : 'round'].push([wx - ox, y - oy - 0.1, wz - oz, sc, R() * 6.28, 1]);",
    "const sc = 0.75 + R() * 0.85; lists[kind < 0.7 ? 'pine' : 'round'].push([wx - ox, y - oy - 0.15, wz - oz, sc, R() * 6.28, 0.9 + R() * 0.3]);")
rep("o.geometry !== this.props.pine && !Object.values(this.props).includes(o.geometry)", "!this.sharedGeo.has(o.geometry)")
rep("    this.props = propGeometry();", "    this.props = propGeometry(); this.sharedGeo = new Set([this.props.rock, this.props.post, this.props.pine.trunk, this.props.pine.foliage, this.props.round.trunk, this.props.round.foliage]);")

# ---- far mountains + shadows + run control ----
rep("  lightEmit() {", '''  buildFar() {
    if (this.far) this.far.forEach(f => { this.scene.remove(f.m); f.m.geometry.dispose(); });
    this.far = [];
    for (const [rad, hmin, hamp, mix, seed] of [[1000, 70, 230, 0.55, 1], [940, 40, 130, 0.35, 2]]) {
      const N = 128, pos = [], idx = [];
      for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, nx = Math.cos(a) * 3 + seed * 11, nz = Math.sin(a) * 3 + seed * 7;
        const h = hmin + this.world.fbm(nx, nz) * hamp + this.world.fbm(nx * 4, nz * 4) * 35;
        pos.push(Math.sin(a) * rad, -40, -Math.cos(a) * rad, Math.sin(a) * rad, h, -Math.cos(a) * rad); if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x556677, side: THREE.DoubleSide, fog: false, depthWrite: false })); m.renderOrder = 0; m.frustumCulled = false; this.scene.add(m); this.far.push({ m, mix });
    }
    this.tintFar();
  }
  tintFar() { if (!this.far || !this.fogCol) return; for (const f of this.far) f.m.material.color.copy(this.mtnCol).lerp(this.fogCol, f.mix); }
  lightEmit() {''')
rep("    this.setTime(time);\n", "    this.shadows = quality !== 'low'; this.renderer.shadowMap.enabled = this.shadows;\n    this.sunL.castShadow = this.shadows; const sh = this.sunL.shadow, ext = id === 'truck' ? 30 : 17; sh.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);\n    Object.assign(sh.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: 700 }); sh.camera.updateProjectionMatrix(); sh.bias = -0.0006; sh.normalBias = 0.05; if (sh.map) { sh.map.dispose(); sh.map = null; }\n    this.setTime(time); this.buildFar();\n")
rep("this.scene.add(this.model); this.lightEmit();", "this.model.traverse(o => { if (o.isMesh) o.castShadow = this.shadows; }); this.shadow.visible = !this.shadows; this.scene.add(this.model); this.lightEmit();")
rep("this.last = t; this.update(dt);", "this.last = t; this.skyMat.uniforms.time.value = t / 1000; this.update(dt);")
rep("this.sky.position.copy(this.camera.position); this.stars.position.copy(this.camera.position);",
    "this.sky.position.copy(this.camera.position); this.stars.position.copy(this.camera.position); if (this.far) for (const f of this.far) { f.m.position.x = this.camera.position.x; f.m.position.z = this.camera.position.z; }")
open('game.js', 'w', encoding='utf-8').write(s)
print('patched')

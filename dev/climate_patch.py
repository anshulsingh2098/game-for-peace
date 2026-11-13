s = open('game.js', encoding='utf-8').read()
def rep(a, b, all_=False):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b) if all_ else s.replace(a, b, 1)

# ---------- A. constants ----------
rep("const QUALITY = {", r'''/* ---------- climate zones (they change along the road) and weather ---------- */
const ZL = 2200;                                              // metres per climate zone; zones blend over 300 m
const ZNAMES = ['temperate', 'autumn', 'desert', 'snow', 'tropical'];
const CLIM = {
  temperate: { g1: [.62, .74, .30], g2: [.34, .50, .18], dry: [.66, .60, .34], patch: .35, dens: 1, pine: .55, leaf: [1, 1, 1], pineT: [1, 1, 1], tuftT: [1, 1, 1], rock: .10, tuft: 1, cactus: 0, skyT: [1, 1, 1, 0], mtn: [.35, .45, .35], mtnA: 0 },
  autumn:    { g1: [.68, .60, .28], g2: [.48, .38, .16], dry: [.74, .55, .28], patch: .65, dens: .95, pine: .30, leaf: [1.65, .78, .32], pineT: [1.05, .95, .85], tuftT: [1.35, 1, .55], rock: .10, tuft: .9, cactus: 0, skyT: [1, .75, .55, .12], mtn: [.46, .30, .18], mtnA: .35 },
  desert:    { g1: [.88, .72, .46], g2: [.76, .58, .36], dry: [.92, .76, .50], patch: .5, dens: .06, pine: .2, leaf: [1.4, 1.1, .6], pineT: [1.3, 1.1, .8], tuftT: [1.8, 1.5, .7], rock: .55, tuft: .25, cactus: .5, skyT: [1, .78, .52, .22], mtn: [.65, .36, .22], mtnA: .65 },
  snow:      { g1: [.93, .95, .99], g2: [.80, .85, .92], dry: [.88, .90, .95], patch: .2, dens: .8, pine: .9, leaf: [1.2, 1.3, 1.45], pineT: [1.45, 1.6, 1.75], tuftT: [1.7, 1.8, 2], rock: .15, tuft: .2, cactus: 0, skyT: [.78, .88, 1, .18], mtn: [.88, .92, .98], mtnA: .7 },
  tropical:  { g1: [.30, .68, .18], g2: [.16, .46, .10], dry: [.40, .64, .20], patch: .12, dens: 1.15, pine: .08, leaf: [.78, 1.3, .62], pineT: [.9, 1.2, .8], tuftT: [.8, 1.25, .7], rock: .08, tuft: 1.2, cactus: 0, skyT: [.62, .88, .80, .10], mtn: [.18, .36, .24], mtnA: .55 }
};
export const CLIM_NAME = { temperate: 'Temperate', autumn: 'Autumn', desert: 'Desert', snow: 'Snowfields', tropical: 'Tropical' };
const WX = {
  clear:    { cloud: .55, dark: 0,   fogMul: 1,   light: 1,   rain: 0,   snow: 0, wet: 0 },
  overcast: { cloud: 1,   dark: .55, fogMul: .85, light: .55, rain: 0,   snow: 0, wet: .05 },
  fog:      { cloud: .9,  dark: .35, fogMul: .22, light: .55, rain: 0,   snow: 0, wet: .2 },
  rain:     { cloud: 1,   dark: .72, fogMul: .55, light: .38, rain: .75, snow: 0, wet: .85 },
  storm:    { cloud: 1,   dark: .95, fogMul: .40, light: .22, rain: 1,   snow: 0, wet: 1 },
  snow:     { cloud: 1,   dark: .45, fogMul: .40, light: .55, rain: 0,   snow: 1, wet: .1 }
};
export const WX_NAME = { clear: 'Clear', overcast: 'Overcast', fog: 'Fog', rain: 'Rain', storm: 'Storm', snow: 'Snow' };
const WX_AUTO = { temperate: { clear: 4, overcast: 2.5, rain: 2, fog: 1, storm: .5 }, autumn: { overcast: 3.5, rain: 3, clear: 2, fog: 1.5 }, desert: { clear: 8, overcast: 1, rain: .4 },
  snow: { snow: 4.5, overcast: 2.5, fog: 1.5, clear: 1.5 }, tropical: { rain: 3.5, clear: 3.5, storm: 1.5, overcast: 1.5 } };
const mixV = (a, b, t) => Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], t)) : lerp(a, b, t);
const mixC = (A, B, t) => { const o = {}; for (const k in A) o[k] = mixV(A[k], B[k], t); return o; };
const QUALITY = {''')

# ---------- B. cactus geometry ----------
rep("function propGeometry() {", '''function propGeometry() {
  const cg = (r1, r2, h) => new THREE.CylinderGeometry(r1, r2, h, 8);
  const cactus = mergeGeometries([
    tint(cg(0.2, 0.24, 3.4).translate(0, 1.7, 0), 0.26, 0.46, 0.26), tint(cg(0.13, 0.13, 1.0).rotateZ(Math.PI / 2).translate(0.55, 1.7, 0), 0.26, 0.46, 0.26),
    tint(cg(0.13, 0.14, 1.1).translate(0.95, 2.2, 0), 0.28, 0.50, 0.28), tint(cg(0.12, 0.12, 0.9).rotateZ(Math.PI / 2).translate(-0.5, 1.2, 0), 0.26, 0.46, 0.26),
    tint(cg(0.12, 0.13, 0.9).translate(-0.9, 1.6, 0), 0.28, 0.50, 0.28)]);''')
rep("    rock: rockGeometry(),", "    cactus,\n    rock: rockGeometry(),")
rep("this.sharedGeo = new Set([this.props.bush.foliage,", "this.sharedGeo = new Set([this.props.cactus, this.props.bush.foliage,")

# ---------- C. constructor: materials, precipitation, state ----------
rep("this.roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: asphaltTex() });",
    "this.roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: asphaltTex(), roughness: 0.95, metalness: 0 });")
rep("    this.markMat = new THREE.MeshBasicMaterial({ vertexColors: true });", '''    this.markMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.uSnow = { value: 0 }; this.addSnow(this.groundMat, 1); this.addSnow(this.roadMat, 0.5);
    this.rain = this.makeRain(); this.snowfall = this.makeSnow(); this.scene.add(this.rain, this.snowfall);
    this.wcur = { ...WX.clear }; this.zones = ['temperate']; this.zr = rng(1); this.fixedClim = null; this.fixedWx = null; this.wxTarget = 'clear'; this.wxTimer = 60; this.flash = 0; this.flashT = 5;
    this.cNow = CLIM.temperate; this.lightsNow = false; this.mtnBase = new THREE.Color(); this.mtnCol = new THREE.Color(); this._mc = new THREE.Color(); this._gr = new THREE.Color(); this._mul = new THREE.Color(); this._ft = 0;''')
rep("  resize() {", r'''  addSnow(mat, k) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uSnow = this.uSnow;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = normal.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnow;\nvarying float vUp;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 1.0), uSnow * smoothstep(0.5, 0.9, vUp) * ' + k.toFixed(2) + ');');
    }; mat.needsUpdate = true;
  }
  makeRain() {
    const N = 3500, pos = new Float32Array(N * 6), tip = new Float32Array(N * 2), seed = new Float32Array(N * 2), r = rng(33);
    for (let i = 0; i < N; i++) { const x = r() * 40, y = r() * 30, z = r() * 40, sd = r(); for (let k = 0; k < 2; k++) { const j = i * 2 + k; pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z; tip[j] = k; seed[j] = sd; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('tip', new THREE.BufferAttribute(tip, 1)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, inten: { value: 0 }, wind: { value: new THREE.Vector2(0.25, 0) } },
      vertexShader: `attribute float tip; attribute float seed; uniform float time; uniform vec3 cam; uniform float inten; uniform vec2 wind; varying float vA;
        void main(){ vec3 b = position; float W = 40.0, H = 30.0; vec3 p;
          p.x = cam.x + mod(b.x - cam.x, W) - W * 0.5; p.z = cam.z + mod(b.z - cam.z, W) - W * 0.5; p.y = cam.y - 6.0 + mod(b.y - time * (22.0 + seed * 8.0), H);
          p += tip * vec3(wind.x, 1.0, wind.y) * 0.9; vA = step(seed, inten) * (0.16 + 0.18 * seed); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.78, 0.84, 0.95, vA); }' });
    const o = new THREE.LineSegments(g, m); o.frustumCulled = false; o.renderOrder = 5; o.visible = false; return o;
  }
  makeSnow() {
    const N = 3000, pos = new Float32Array(N * 3), seed = new Float32Array(N), r = rng(44);
    for (let i = 0; i < N; i++) { pos[i * 3] = r() * 50; pos[i * 3 + 1] = r() * 30; pos[i * 3 + 2] = r() * 50; seed[i] = r(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, inten: { value: 0 } },
      vertexShader: `attribute float seed; uniform float time; uniform vec3 cam; uniform float inten; varying float vA;
        void main(){ vec3 b = position; float W = 50.0, H = 30.0; vec3 p;
          p.x = cam.x + mod(b.x - cam.x, W) - W * 0.5 + sin(time * 0.7 + seed * 30.0) * 0.8; p.z = cam.z + mod(b.z - cam.z, W) - W * 0.5 + cos(time * 0.6 + seed * 20.0) * 0.8;
          p.y = cam.y - 6.0 + mod(b.y - time * (1.6 + seed * 1.4), H); vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp((2.0 + seed * 3.0) * 300.0 / max(1.0, -mv.z), 1.5, 14.0); vA = step(seed, inten) * 0.85; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(1.0, 1.0, 1.0, smoothstep(0.5, 0.1, d) * vA); }' });
    const o = new THREE.Points(g, m); o.frustumCulled = false; o.renderOrder = 5; o.visible = false; return o;
  }
  zone(k) { while (this.zones.length <= k) { const prev = this.zones[this.zones.length - 1]; let n; do { n = ZNAMES[Math.floor(this.zr() * ZNAMES.length)]; } while (n === prev); this.zones.push(n); } return this.zones[k]; }
  clim(s) {
    if (this.fixedClim) return CLIM[this.fixedClim];
    const m = Math.round(s / ZL); let a, b, t = 0;
    if (m >= 1 && Math.abs(s - m * ZL) < 150) { a = this.zone(m - 1); b = this.zone(m); t = smooth(0, 1, (s - m * ZL + 150) / 300); } else a = b = this.zone(Math.max(0, Math.floor(s / ZL)));
    if (a === b || t <= 0.001) return CLIM[a]; if (t >= 0.999) return CLIM[b];
    const key = a + b + Math.round(t * 16); if (this._ck !== key) { this._ck = key; this._cv = mixC(CLIM[a], CLIM[b], t); } return this._cv;
  }
  pickWeather(c) { const w = WX_AUTO[c]; let tot = 0; for (const k in w) tot += w[k]; let r = Math.random() * tot; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return 'clear'; }
  updateWorld(dt) {
    this.cNow = this.clim(this.s + 250); this.cName = this.fixedClim || this.zone(Math.floor((this.s + 400) / ZL));
    if (!this.fixedWx) { this.wxTimer -= dt; if (this.wxTimer <= 0) { this.wxTarget = this.pickWeather(this.cName); this.wxTimer = 80 + Math.random() * 90; } }
    const tgt = WX[this.fixedWx || this.wxTarget], k = Math.min(1, dt * 0.35); for (const key in tgt) this.wcur[key] = lerp(this.wcur[key], tgt[key], k);
    this.applyWorld(dt);
    const lab = CLIM_NAME[this.cName] + ' · ' + WX_NAME[this.fixedWx || this.wxTarget]; if (lab !== this._lab) { this._lab = lab; this.hooks.onWorld && this.hooks.onWorld(lab); }
  }
  /* turns the current climate + weather + time of day into sky, fog, light, wetness and precipitation */
  applyWorld(dt) {
    const T = TIMES[this.time] || TIMES.dusk, W = this.wcur, cl = this.cNow, u = this.skyMat.uniforms, dk = W.dark, tmp = this._mc, gr = this._gr, mul = this._mul, sk = cl.skyT, am = Math.min(1, sk[3] * 3);
    mul.setRGB(lerp(1, sk[0], am), lerp(1, sk[1], am), lerp(1, sk[2], am));
    const eff = (hex, out) => { out.set(hex).multiply(mul); const L = out.r * 0.3 + out.g * 0.55 + out.b * 0.15; gr.setRGB(L * 0.95, L * 0.98, L * 1.04); return out.lerp(gr, dk * 0.85); };
    eff(T.top, u.top.value); eff(T.mid, u.mid.value); eff(T.bot, u.bot.value); this.fogCol.copy(u.bot.value);
    u.cloudCol.value.setRGB(...T.cc); { const L = (T.cc[0] + T.cc[1] + T.cc[2]) / 3 * 0.8; gr.setRGB(L, L, L * 1.05); u.cloudCol.value.lerp(gr, dk * 0.6); }
    u.cloudAmt.value = Math.min(1, T.ca * (0.4 + W.cloud));
    const flash = this.flash; this.stars.material.opacity = T.stars * Math.max(0, 1 - dk * 1.3); this.stars.visible = this.stars.material.opacity > 0.05;
    this.sunL.intensity = T.li * W.light + flash * 2; this.hemi.intensity = T.hi * (0.65 + 0.35 * W.light) + flash * 2.5; this.fill.intensity = (this.time === 'night' ? 0.25 : 0.7) * (0.5 + 0.5 * W.light);
    const f = this.scene.fog; f.color.copy(this.fogCol); f.near = 40 * W.fogMul; f.far = (this.fogFar || 420) * W.fogMul;
    this.mtnCol.copy(this.mtnBase).lerp(tmp.setRGB(...cl.mtn), cl.mtnA); this._ft -= dt; if (this._ft <= 0) { this._ft = 0.5; this.tintFar(); }
    this.roadMat.roughness = lerp(0.95, 0.3, W.wet); this.roadMat.envMapIntensity = 0.2 + W.wet; this.roadMat.color.setScalar(lerp(1, 0.62, W.wet)); this.groundMat.color.setScalar(lerp(1, 0.8, W.wet)); this.uSnow.value = W.snow;
    const t = this.skyMat.uniforms.time.value, cam = this.camera.position;
    this.rain.visible = W.rain > 0.02; const ru = this.rain.material.uniforms; ru.time.value = t; ru.cam.value.copy(cam); ru.inten.value = W.rain; ru.wind.value.set(0.25 + W.rain * 0.25, 0);
    this.snowfall.visible = W.snow > 0.02; const su = this.snowfall.material.uniforms; su.time.value = t; su.cam.value.copy(cam); su.inten.value = W.snow;
    if (W.dark > 0.9) { this.flashT -= dt; if (this.flashT <= 0) { this.flash = 1; this.flashT = 3 + Math.random() * 7; } } this.flash = Math.max(0, this.flash - dt * 3.5);
    const ln = this.lightsOn || W.dark > 0.7; if (ln !== this.lightsNow) { this.lightsNow = ln; if (this.model) this.lightEmit(); }
    if (this.head) { const dl = this.lightsOn ? 1 : Math.min(1, Math.max(0, (W.dark - 0.5) / 0.4)); this.head.intensity = 260 * dl; this.head.visible = dl > 0.02; }
  }
  configure(o) {
    if (o.time && o.time !== this.time) this.setTime(o.time);
    if ('weather' in o) { this.fixedWx = o.weather === 'auto' ? null : o.weather; if (!this.fixedWx) this.wxTimer = 0; }
    if ('climate' in o) { const nc = o.climate === 'auto' ? null : o.climate; if (nc !== this.fixedClim) { this.fixedClim = nc; this._ck = null; for (const v of this.chunks.values()) v.dispose(); this.chunks.clear(); this.updateChunks(true); } }
  }
  resize() {''')

# ---------- D. setTime: base values only, then applyWorld ----------
rep("this.mtnCol = new THREE.Color(T.mtn);", "this.mtnBase.set(T.mtn);")
rep("this.lightsOn = name === 'night'; if (this.model) this.lightEmit(); this.tintFar();", "this.lightsOn = name === 'night'; this.tintFar(); if (this.world) this.applyWorld(0);")
rep("top.copy(this.mtnCol).lerp(this.fogCol, f.mix);", "top.copy(this.mtnCol).lerp(this.fogCol, Math.min(1, f.mix + (1 - f.mix) * (1 - this.wcur.fogMul) * 0.9));")
rep("m.emissiveIntensity = this.lightsOn ? 4 : 0.6; if (m.name === 'Light_Tail') m.emissiveIntensity = this.lightsOn ? 3 : 1.5;", "m.emissiveIntensity = this.lightsNow ? 4 : 0.6; if (m.name === 'Light_Tail') m.emissiveIntensity = this.lightsNow ? 3 : 1.5;")

# ---------- E. chunk: climate-driven ground and trees ----------
rep("const nT = TOFF.length, vpr = nT * 2, grass = [0.62, 0.74, 0.30], grass2 = [0.34, 0.50, 0.18], dry = [0.66, 0.60, 0.34], dirt = [0.55, 0.47, 0.34], rock = [0.55, 0.52, 0.48];",
    "const nT = TOFF.length, vpr = nT * 2, dirt0 = [0.55, 0.47, 0.34], rock0 = [0.55, 0.52, 0.48], Cm = this.clim((i0 + ROWS / 2) * DS), rock = rock0.map((v, c) => lerp(v, Cm.g1[c], Cm.g1[2] > 0.9 ? 0.6 : 0));")
rep("const i = i0 + r, x = w.xs[i], z = w.zs[i], ry = w.ys[i], th = w.th[i], cx = Math.cos(th), sz = Math.sin(th), s0 = i * DS;",
    "const i = i0 + r, x = w.xs[i], z = w.zs[i], ry = w.ys[i], th = w.th[i], cx = Math.cos(th), sz = Math.sin(th), s0 = i * DS, C = this.clim(s0), grass = C.g1, grass2 = C.g2, dry = C.dry, dirt = dirt0.map((v, c) => lerp(v, C.g2[c], 0.55));")
rep("const patch = smooth(0.52, 0.72, w.fbm(wx * 0.012 + 40, wz * 0.012));", "const patch = smooth(0.52, 0.72, w.fbm(wx * 0.012 + 40, wz * 0.012)) * Math.min(1.4, C.patch * 2);")
rep("if (asph) rc.push(0.78, 0.78, 0.80); else rc.push(0.85, 0.82, 0.76);", "if (asph) rc.push(0.78, 0.78, 0.80); else rc.push(lerp(0.85, C.g2[0], 0.3), lerp(0.82, C.g2[1], 0.3), lerp(0.76, C.g2[2], 0.3));")

a = s.index("    const lists = { pine: [], round: [], rock: [], post: [], bush: [], tuft: [] };"); b = s.index("    for (let s = Math.ceil(i0 * DS / 20) * 20;")
s = s[:a] + '''    const lists = { pine: [], round: [], rock: [], post: [], bush: [], tuft: [], cactus: [] };
    const count = Math.round(26 * this.q.trees * Cm.dens), T3 = (arr, t) => [...arr, 0, t[0], t[1], t[2]];
    for (let side = -1; side <= 1; side += 2) for (let n = 0; n < count + Math.round(4 * Cm.rock * this.q.trees); n++) {
      const t = side * (9 + Math.pow(R(), 1.5) * 75), s = (i0 + R() * ROWS) * DS, p = w.at(s), wx = p.x + Math.cos(p.th) * t, wz = p.z + Math.sin(p.th) * t, y = w.ter(t, wx, wz, p.y), C = this.clim(s);
      const f = w.fbm(wx * 0.01, wz * 0.01), kind = R();
      if (kind < C.rock + (n >= count ? 1 : 0)) { lists.rock.push([wx - ox, y - oy + 0.1, wz - oz, 0.5 + R() * 1.7, R() * 6.28, 0.55 + R() * 0.5]); continue; }
      if (n >= count) continue;
      if (f < 0.32 && R() < 0.6) continue;
      const sc = 0.75 + R() * 0.85, pine = R() < C.pine; lists[pine ? 'pine' : 'round'].push(T3([wx - ox, y - oy - 0.15, wz - oz, sc, R() * 6.28, 0.9 + R() * 0.3], pine ? C.pineT : C.leaf));
    }
    for (let side = -1; side <= 1; side += 2) {
      for (let n = 0, cnt = Math.round(10 * this.q.trees * Cm.dens); n < cnt; n++) {     // shrubs near the verge
        const t = side * (7 + R() * 9), s = (i0 + R() * ROWS) * DS, p = w.at(s), wx = p.x + Math.cos(p.th) * t, wz = p.z + Math.sin(p.th) * t, C = this.clim(s);
        lists.bush.push(T3([wx - ox, w.ter(t, wx, wz, p.y) - oy - 0.05, wz - oz, 0.6 + R() * 0.9, R() * 6.28, 0.8 + R() * 0.5], C.leaf));
      }
      for (let n = 0, cnt = Math.round(46 * this.q.trees * Cm.tuft); n < cnt; n++) {     // grass tufts and flowers
        const t = side * (5.7 + Math.pow(R(), 1.4) * 22), s = (i0 + R() * ROWS) * DS, p = w.at(s), wx = p.x + Math.cos(p.th) * t, wz = p.z + Math.sin(p.th) * t, C = this.clim(s);
        lists.tuft.push(T3([wx - ox, w.ter(t, wx, wz, p.y) - oy - 0.02, wz - oz, 0.42 + R() * 0.6, R() * 6.28, 0.8 + R() * 0.5], C.tuftT));
      }
      for (let n = 0, cnt = Math.round(7 * this.q.trees * Cm.cactus); n < cnt; n++) {     // cacti in the desert
        const t = side * (7 + R() * 40), s = (i0 + R() * ROWS) * DS, p = w.at(s), wx = p.x + Math.cos(p.th) * t, wz = p.z + Math.sin(p.th) * t;
        lists.cactus.push([wx - ox, w.ter(t, wx, wz, p.y) - oy - 0.05, wz - oz, 0.8 + R() * 1.0, R() * 6.28, 0.9 + R() * 0.3]);
      }
    }
''' + s[b:]
rep("const v = 0.80 + a[6] * 0.4; im.setColorAt(n, jitter ? col.setRGB(v, v * (0.94 + a[6] * 0.12), v * (0.92 + a[6] * 0.1)) : col.setRGB(1, 1, 1)); });",
    "const v = 0.80 + a[6] * 0.4, tr = a[7] ?? 1, tg = a[8] ?? 1, tb = a[9] ?? 1; im.setColorAt(n, jitter ? col.setRGB(v * tr, v * (0.94 + a[6] * 0.12) * tg, v * (0.92 + a[6] * 0.1) * tb) : col.setRGB(1, 1, 1)); });")
rep("const arr = lists[k].map(a => [...a, R()]); if (!arr.length) continue;", "const arr = lists[k].map(a => { a[6] = R(); return a; }); if (!arr.length) continue;")
rep("for (const k of ['bush', 'tuft']) if (lists[k].length) fill(this.props[k].foliage, this.props[k].mat, lists[k].map(a => [...a, R()]), true);",
    "for (const k of ['bush', 'tuft']) if (lists[k].length) fill(this.props[k].foliage, this.props[k].mat, lists[k].map(a => { a[6] = R(); return a; }), true);\n    if (lists.cactus.length) fill(this.props.cactus, this.lam, lists.cactus.map(a => [...a, R()]), true);")

# ---------- F. start ----------
rep("start({ id, model, stats, buff, time = 'dusk', quality = 'med' }) {", "start({ id, model, stats, buff, time = 'dusk', quality = 'med', weather = 'auto', climate = 'auto' }) {")
rep("    this.setTime(time); this.buildFar();",
    "    this.zones = ['temperate']; this.zr = rng(this.world.seed + 991); this.fixedClim = climate === 'auto' ? null : climate; this.fixedWx = weather === 'auto' ? null : weather;\n    this.wxTarget = this.fixedWx || 'clear'; this.wxTimer = 40 + Math.random() * 40; this.wcur = { ...WX[this.wxTarget] }; this.flash = 0; this.flashT = 4; this._ck = null; this._lab = null; this.s = 100; this.cNow = this.clim(350); this.cName = this.fixedClim || 'temperate';\n    this.setTime(time); this.buildFar();")
a = s.index("    if (this.head) { this.head.parent"); b = s.index("    this.wheels = [];")
s = s[:a] + '''    if (this.head) { this.head.parent && this.head.parent.remove(this.head); this.head = null; }
    { const o = { car: [0.7, 2.3], truck: [1.5, 6.1], bike: [0.8, 0.95] }[id] || [0.7, 2]; const sp = new THREE.SpotLight(0xfff1d6, 0, 90, 0.5, 0.65, 1.2);
      sp.position.set(0, o[0], o[1]); sp.target.position.set(0, 0.1, o[1] + 25); this.model.add(sp, sp.target); this.head = sp; }
    this.lightsNow = false; this.lightEmit(); this.applyWorld(0);
''' + s[b:]

# ---------- G. update hook ----------
rep("    this.updateChunks(false); this.place(dt);", "    this.updateChunks(false); this.place(dt); this.updateWorld(dt);")
open('game.js', 'w', encoding='utf-8').write(s)
print('game.js patched')

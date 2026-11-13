s = open('game.js', encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)

# ---- wind sway shared by all foliage materials ----
rep("function rng(seed) {", '''const WIND = { t: { value: 0 }, a: { value: 1 } };
function sway(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWind = WIND.t; sh.uniforms.uWindAmp = WIND.a;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\nuniform float uWind;\\nuniform float uWindAmp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sw = sin(uWind * 1.3 + ip.x * 0.37 + ip.z * 0.29) * 0.6 + sin(uWind * 2.3 + ip.z * 0.53 + ip.x * 0.17) * 0.3;
        float hg = max(transformed.y, 0.0);
        transformed.x += sw * hg * 0.03 * uWindAmp; transformed.z += sw * hg * 0.018 * uWindAmp;`);
  };
  return mat;
}
function rng(seed) {''')
for k in ["leafTex('pine')", "leafTex('round')", "tuftTex()"]:
    pass
s = s.replace("mat: new THREE.MeshLambertMaterial({ map: leafTex('pine'), alphaTest: 0.45, side: THREE.DoubleSide })", "mat: sway(new THREE.MeshLambertMaterial({ map: leafTex('pine'), alphaTest: 0.45, side: THREE.DoubleSide }))")
s = s.replace("mat: new THREE.MeshLambertMaterial({ map: leafTex('round'), alphaTest: 0.45, side: THREE.DoubleSide })", "mat: sway(new THREE.MeshLambertMaterial({ map: leafTex('round'), alphaTest: 0.45, side: THREE.DoubleSide }))")
rep("mat: new THREE.MeshLambertMaterial({ map: tuftTex(), alphaTest: 0.4, side: THREE.DoubleSide })", "mat: sway(new THREE.MeshLambertMaterial({ map: tuftTex(), alphaTest: 0.4, side: THREE.DoubleSide }))")

# ---- tree shadows (high quality) ----
rep("    this.lam = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });",
    "    for (const k of ['pine', 'round']) this.props[k].depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.props[k].mat.map, alphaTest: 0.45 });\n    this.lam = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });")
rep("fill(this.props[k].trunk, this.lam, arr, false); fill(this.props[k].foliage, this.props[k].mat, arr, true); }",
    "const tm = fill(this.props[k].trunk, this.lam, arr, false), fm = fill(this.props[k].foliage, this.props[k].mat, arr, true); if (this.treeShadows) { tm.castShadow = true; fm.castShadow = true; fm.customDepthMaterial = this.props[k].depth; } }")
rep("    this.shadows = quality !== 'low';", "    this.treeShadows = quality === 'high'; this.shadows = quality !== 'low';")

# ---- demo (attract) mode and frame hooks ----
rep("start({ id, model, stats, buff, time = 'dusk', quality = 'med', weather = 'auto', climate = 'auto' }) {",
    "start({ id, model, stats, buff, time = 'dusk', quality = 'med', weather = 'auto', climate = 'auto', demo = false }) {\n    this.demo = demo; this.demoT = 0;")
rep("const k = this.keys, st = this.stats,", "const k = this.demo ? { left: 0, right: 0, up: 0, down: 0 } : this.keys, st = this.stats,")
rep("    const cruise = top * 0.5;\n    if (k.up)", "    const cruise = top * 0.5;\n    if (this.demo) this.v += (Math.min(top, 20) - this.v) * Math.min(1, dt * 0.5); else if (k.up)")
rep("    this.hooks.onFrame && this.hooks.onFrame(", "    if (!this.demo && this.hooks.onFrame) this.hooks.onFrame(")
rep("this.skyMat.uniforms.time.value = t / 1000; this.update(dt);", "this.skyMat.uniforms.time.value = t / 1000; WIND.t.value = t / 1000; WIND.a.value = 1 + this.wcur.rain * 1.4 + this.wcur.snow * 0.3; this.update(dt);")
rep("    const c = d.cam, dx = Math.sin(this.camHead), dz = -Math.cos(this.camHead);",
    "    this.demoT += dt || 0; const cam0 = d.cam, c = this.demo ? { back: cam0.back * 1.1, up: cam0.up * 0.85, look: cam0.look } : cam0, ang = this.camHead + (this.demo ? Math.sin(this.demoT * 0.11) * 0.55 : 0), dx = Math.sin(ang), dz = -Math.cos(ang);")
open('game.js', 'w', encoding='utf-8').write(s)
print('game.js polished')

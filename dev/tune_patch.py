s = open('game.js', encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)

rep("import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';",
    "import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';\nimport { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';")

# --- reflections for the vehicle and a soft fill light so shadowed sides never go black ---
rep("    this.scene.add(this.hemi, this.sunL, this.sunL.target);",
    "    this.fill = new THREE.DirectionalLight(0xffffff, 0.5); this.scene.add(this.hemi, this.sunL, this.sunL.target, this.fill, this.fill.target);\n    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;")
rep("this.sunL.color.set(T.light); this.sunL.intensity = T.li;",
    "this.sunL.color.set(T.light); this.sunL.intensity = T.li; this.fill.color.set(T.hs); this.fill.intensity = name === 'night' ? 0.25 : 0.7;")
rep("this.scene.add(this.model); this.lightEmit();",
    "this.model.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => { if ('envMapIntensity' in m) m.envMapIntensity = name_night(time) ? 0.35 : 0.7; }); }); this.scene.add(this.model); this.lightEmit();")
rep("export class Game {", "const name_night = t => t === 'night';\n\nexport class Game {")

# --- richer ground colours ---
rep("grass = [0.40, 0.50, 0.22], grass2 = [0.20, 0.31, 0.12], dirt = [0.45, 0.38, 0.28], rock = [0.50, 0.47, 0.43];",
    "grass = [0.62, 0.74, 0.30], grass2 = [0.34, 0.50, 0.18], dry = [0.66, 0.60, 0.34], dirt = [0.55, 0.47, 0.34], rock = [0.55, 0.52, 0.48];")
rep("for (let c = 0; c < 3; c++) { const base = lerp(grass[c], grass2[c], n * 0.7 + h * 0.4); gc[k + c] = lerp(dirt[c], base, m) * (0.92 + 0.16 * w.vn(wx * 0.3, wz * 0.3)); }",
    "const patch = smooth(0.52, 0.72, w.fbm(wx * 0.012 + 40, wz * 0.012)); for (let c = 0; c < 3; c++) { const base = lerp(lerp(grass[c], grass2[c], n * 0.7 + h * 0.4), dry[c], patch * 0.7); gc[k + c] = lerp(dirt[c], base, m) * (0.9 + 0.2 * w.vn(wx * 0.3, wz * 0.3)); }")
rep("x.fillStyle = '#6a6a6c'; x.fillRect(0, 0, w, h);", "x.fillStyle = '#767676'; x.fillRect(0, 0, w, h);")

# --- bushes and grass tufts ---
rep("function propGeometry() {", '''function tuftTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), R = rng(21); x.lineCap = 'round';
  for (let i = 0; i < 70; i++) { const bx = 14 + R() * 100, h = 40 + R() * 70, lean = (R() - 0.5) * 36, G = 90 + Math.floor(R() * 90), Rr = Math.floor(G * (0.55 + R() * 0.35));
    x.strokeStyle = `rgb(${Rr},${G},${Math.floor(G * 0.35)})`; x.lineWidth = 1.6 + R() * 1.6; x.beginPath(); x.moveTo(bx, 128); x.quadraticCurveTo(bx + lean * 0.3, 128 - h * 0.6, bx + lean, 128 - h); x.stroke();
    if (R() < 0.07) { x.fillStyle = R() < 0.5 ? '#f4f1e6' : '#f2d04a'; x.beginPath(); x.arc(bx + lean, 128 - h, 3.2, 0, 6.283); x.fill(); } }
  return canvasTex(c, false);
}
function propGeometry() {''')
rep("    rock: rockGeometry(),", '''    bush: { foliage: crossCards(2.8, 2.1, 1.0, 3), mat: new THREE.MeshLambertMaterial({ map: leafTex('round'), alphaTest: 0.45, side: THREE.DoubleSide }) },
    tuft: { foliage: crossCards(1.7, 1.2, 0.55, 3), mat: new THREE.MeshLambertMaterial({ map: tuftTex(), alphaTest: 0.4, side: THREE.DoubleSide }) },
    rock: rockGeometry(),''')
rep("this.sharedGeo = new Set([this.props.rock,", "this.sharedGeo = new Set([this.props.bush.foliage, this.props.tuft.foliage, this.props.rock,")
rep("const lists = { pine: [], round: [], rock: [], post: [] };", "const lists = { pine: [], round: [], rock: [], post: [], bush: [], tuft: [] };")
rep("    for (let s = Math.ceil(i0 * DS / 20) * 20;", '''    for (let side = -1; side <= 1; side += 2) {
      for (let n = 0, cnt = Math.round(10 * this.q.trees); n < cnt; n++) {     // shrubs near the verge
        const t = side * (7 + R() * 9), s = (i0 + R() * ROWS) * DS, p = w.at(s), wx = p.x + Math.cos(p.th) * t, wz = p.z + Math.sin(p.th) * t;
        lists.bush.push([wx - ox, w.ter(t, wx, wz, p.y) - oy - 0.05, wz - oz, 0.6 + R() * 0.9, R() * 6.28, 0.8 + R() * 0.5]);
      }
      for (let n = 0, cnt = Math.round(46 * this.q.trees); n < cnt; n++) {     // grass tufts and flowers
        const t = side * (5.7 + Math.pow(R(), 1.4) * 22), s = (i0 + R() * ROWS) * DS, p = w.at(s), wx = p.x + Math.cos(p.th) * t, wz = p.z + Math.sin(p.th) * t;
        lists.tuft.push([wx - ox, w.ter(t, wx, wz, p.y) - oy - 0.02, wz - oz, 0.7 + R() * 1.1, R() * 6.28, 0.8 + R() * 0.5]);
      }
    }
    for (let s = Math.ceil(i0 * DS / 20) * 20;''')
rep("    if (lists.rock.length) fill(this.props.rock,",
    "    for (const k of ['bush', 'tuft']) if (lists[k].length) fill(this.props[k].foliage, this.props[k].mat, lists[k].map(a => [...a, R()]), true);\n    if (lists.rock.length) fill(this.props.rock,")

# --- mountains: haze at the base, rock colour on top ---
rep("const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setIndex(idx);\n      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x556677, side: THREE.DoubleSide, fog: false, depthWrite: false }));",
    "const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3)); g.setIndex(idx);\n      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, depthWrite: false }));")
rep("tintFar() { if (!this.far || !this.fogCol) return; for (const f of this.far) f.m.material.color.copy(this.mtnCol).lerp(this.fogCol, f.mix); }",
    "tintFar() {\n    if (!this.far || !this.fogCol) return; const top = new THREE.Color(), hi = new THREE.Color();\n    for (const f of this.far) { top.copy(this.mtnCol).lerp(this.fogCol, f.mix); const c = f.m.geometry.attributes.color, p = f.m.geometry.attributes.position;\n      for (let i = 0; i < c.count; i++) { const k = Math.min(1, Math.max(0, (p.getY(i) + 40) / 260)); hi.copy(this.fogCol).lerp(top, 0.25 + 0.75 * smooth(0, 0.7, k)); c.setXYZ(i, hi.r, hi.g, hi.b); }\n      c.needsUpdate = true; }\n  }")

# --- light tuning ---
s = s.replace("li: 2.6, hs: '#c0cdff', hg: '#6a6458', hi: 1.0", "li: 2.8, hs: '#cfd8ff', hg: '#7d7566', hi: 1.15")
s = s.replace("li: 2.5, hs: '#9c98d8', hg: '#55464f', hi: 1.0", "li: 2.7, hs: '#aaa6e4', hg: '#66565e', hi: 1.15")
open('game.js', 'w', encoding='utf-8').write(s)
print('ok')

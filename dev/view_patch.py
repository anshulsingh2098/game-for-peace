s = open('game.js', encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)

# eye positions (model space, front is +Z)
rep("const VEH = {", "const EYES = { car: [-0.32, 1.13, 0.12], truck: [-0.5, 2.85, 3.3], bike: [0, 1.50, 0.30] };\nconst VEH = {")
rep("    this.keys = { left: 0, right: 0, up: 0, down: 0 };", "    this.keys = { left: 0, right: 0, up: 0, down: 0 }; this.view = 'third'; this.eye = new THREE.Vector3();")

# start(): view param, cockpit, rider hiding
rep("weather = 'auto', climate = 'auto', demo = false }) {", "weather = 'auto', climate = 'auto', demo = false, view = 'third' }) {")
rep("    this.addGlows(id); this.lightsNow = false;", "    this.buildCockpit(id); this.riderObjs = []; this.model.traverse(o => { if (o.name === 'Rider') this.riderObjs.push(o); }); this.setView(demo ? 'third' : view);\n    this.addGlows(id); this.lightsNow = false;")

# methods
rep("  configure(o) {", '''  buildCockpit(id) {
    if (this.cockpit && this.cockpit.parent) this.cockpit.parent.remove(this.cockpit); this.cockpit = null; this.sw = null;
    if (id === 'bike') return;
    const g = new THREE.Group(), dark = new THREE.MeshLambertMaterial({ color: 0x0c0c10 }), mid = new THREE.MeshLambertMaterial({ color: 0x1d1d24 }), glow = new THREE.MeshBasicMaterial({ color: 0x6fd0ff });
    const box = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || dark); m.position.set(x, y, z); g.add(m); return m; };
    let pos, R, tilt;
    if (id === 'car') { box(1.55, 0.16, 0.55, 0, 0.85, 0.62); box(0.5, 0.12, 0.22, -0.32, 0.975, 0.60, mid); box(0.3, 0.015, 0.05, -0.32, 1.04, 0.52, glow); box(0.34, 0.07, 0.12, 0.2, 0.94, 0.55, mid); box(0.1, 0.34, 0.1, -0.32, 0.72, 0.5, mid); pos = [-0.32, 0.93, 0.40]; R = 0.17; tilt = 0.5; }
    else { box(2.0, 0.24, 0.8, 0, 2.38, 3.95); box(0.8, 0.14, 0.26, -0.5, 2.55, 3.85, mid); box(0.5, 0.015, 0.05, -0.5, 2.63, 3.74, glow); box(0.2, 0.5, 0.15, -0.5, 2.2, 3.6, mid); pos = [-0.5, 2.55, 3.55]; R = 0.26; tilt = 0.3; }
    const sw = new THREE.Group(); sw.position.set(...pos); sw.rotation.x = tilt; const inner = new THREE.Group(); sw.add(inner);
    inner.add(new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.14, 8, 28), mid));
    for (const [w, h] of [[R * 1.9, R * 0.16], [R * 0.16, R * 0.95]]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(w, h, R * 0.1), mid); if (h > w) sp.position.y = -R * 0.47; inner.add(sp); }
    inner.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.3, R * 0.3, R * 0.2, 12).rotateX(Math.PI / 2), dark));
    g.add(sw); this.model.add(g); this.cockpit = g; this.sw = inner;
  }
  setView(v) {
    this.view = v; const fp = v === 'first';
    if (this.cockpit) this.cockpit.visible = fp; for (const o of this.riderObjs || []) o.visible = !fp; for (const gl of this.glows || []) gl.sp.visible = !fp;
    this.camera.near = fp ? 0.08 : 0.3; this.camera.updateProjectionMatrix();
  }
  configure(o) {''')
rep("    if ('weather' in o) {", "    if ('view' in o && !this.demo) this.setView(o.view);\n    if ('weather' in o) {")
rep("    for (const p of L.tail) mk(p, 0xff2a14, L.ts, 'tail'); for (const p of L.head) mk(p, 0xfff0d0, L.hs, 'head');",
    "    for (const p of L.tail) mk(p, 0xff2a14, L.ts, 'tail'); for (const p of L.head) mk(p, 0xfff0d0, L.hs, 'head'); if (this.view === 'first') for (const gl of this.glows) gl.sp.visible = false;")

# camera branch
rep("    this.camera.position.set(m.position.x - dx * c.back, m.position.y + c.up, m.position.z - dz * c.back);\n", "    const fp = this.view === 'first' && !this.demo;\n    if (!fp) this.camera.position.set(m.position.x - dx * c.back, m.position.y + c.up, m.position.z - dz * c.back);\n")
rep("    this.camera.lookAt(m.position.x + dx * c.look, m.position.y + c.up * 0.45, m.position.z + dz * c.look);\n    this.camera.fov = 56 + Math.min(14, this.v * 0.16 + (this.buffT > 0 ? 4 : 0)); this.camera.updateProjectionMatrix();",
    "    if (fp) {                                                              // driver's eyes\n      m.updateMatrixWorld(true); const e = EYES[this.id]; this.eye.set(e[0], e[1], e[2]); m.localToWorld(this.eye); this.camera.position.copy(this.eye);\n      const sh2 = Math.min(1, this.v / 40) * 0.006 * (this.buffT > 0 ? 2.4 : 1), tt2 = this.demoT; this.camera.position.x += Math.sin(tt2 * 43) * Math.sin(tt2 * 11) * sh2; this.camera.position.y += Math.sin(tt2 * 37 + 1) * Math.sin(tt2 * 13) * sh2;\n      this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(Math.atan(p.slope) * 0.9 - 0.03, -head, this.roll * 0.5);\n      if (this.sw) this.sw.rotation.z = -this.steerIn * 1.3;\n      this.camera.fov = 70 + Math.min(14, this.v * 0.18 + (this.buffT > 0 ? 4 : 0)); this.camera.updateProjectionMatrix();\n    } else {\n      this.camera.lookAt(m.position.x + dx * c.look, m.position.y + c.up * 0.45, m.position.z + dz * c.look);\n      this.camera.fov = 56 + Math.min(14, this.v * 0.16 + (this.buffT > 0 ? 4 : 0)); this.camera.updateProjectionMatrix();\n    }")
open('game.js', 'w', encoding='utf-8').write(s)
print('game.js ok')

# ---------------- UI ----------------
u = open('index.html', encoding='utf-8').read()
def repu(a, b):
    global u
    assert a in u, a[:80]
    u = u.replace(a, b, 1)
repu('<button class="icon-btn" id="pauseBtn"', '<div class="hud-actions"><button class="icon-btn" id="viewBtn" aria-label="Switch camera view" title="Switch view (C)"><svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.3"/></svg></button><button class="icon-btn" id="pauseBtn"')
# close the wrapper after the pause button element
import re
m = re.search(r'<button class="icon-btn" id="pauseBtn".*?</button>', u, re.S)
u = u[:m.end()] + '</div>' + u[m.end():]
repu('/* Garage 3D stage */', '.hud-actions{display:flex;gap:10px;align-items:flex-start}\n/* Garage 3D stage */')
repu('    <div class="row"><label>Units</label>', '    <div class="row"><label>Camera<small>Switch any time with C</small></label><div class="seg" data-key="view"><button data-v="third">Chase</button><button data-v="first">Driver</button></div></div>\n    <div class="row"><label>Units</label>')
repu("weather:'auto',climate:'auto'};", "weather:'auto',climate:'auto',view:'third'};")
repu("time:S.time,quality:S.quality,weather:S.weather,climate:S.climate});\n  toast('Driving the '+v.name);", "time:S.time,quality:S.quality,weather:S.weather,climate:S.climate,view:S.view});\n  toast('Driving the '+v.name);")
repu("function liveApply(){if(game&&game.world)game.configure({time:S.time,weather:S.weather,climate:S.climate})}", "function liveApply(){if(game&&game.world)game.configure({time:S.time,weather:S.weather,climate:S.climate,view:S.view})}")
repu("function pauseGame(){", "function toggleView(){if(!game||!game.world||game.demo)return;S.view=S.view==='first'?'third':'first';save();game.setView(S.view);syncSettings();toast(S.view==='first'?'Driver view':'Chase view')}\n$('#viewBtn').onclick=toggleView;\nfunction pauseGame(){")
repu("  if(e.key===' '&&screen==='hud'){e.preventDefault();useBuff()}", "  if(e.key===' '&&screen==='hud'){e.preventDefault();useBuff()}\n  if((e.key==='c'||e.key==='C')&&screen==='hud')toggleView();")
open('index.html', 'w', encoding='utf-8').write(u)
print('ui ok')

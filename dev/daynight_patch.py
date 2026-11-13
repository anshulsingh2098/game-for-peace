s = open('game.js', encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

# ---- a bright day phase + a continuous day/night cycle blended from the presets ----
rep("const TIMES = {", "const _c1 = new THREE.Color(), _c2 = new THREE.Color();\nconst TIMES = {\n  day:   { top: '#2f6fd6', mid: '#78b4ef', bot: '#cfe6ff', sun: [-0.30, 0.85, -0.45], sunCol: [1, 0.95, 0.8], light: '#fff2dc', li: 3.2, hs: '#cfe2ff', hg: '#7d7a6a', hi: 1.15, stars: 0, cc: [1, 1, 1], ca: 0.6, mtn: '#8aa0b8' },")
rep("/* ---------- climate zones (they change along the road) and weather ---------- */", '''const CYCLE = 360;                                            // seconds for a full day in Auto mode
const TOD_KEYS = [[0, 'night'], [0.20, 'night'], [0.27, 'dawn'], [0.36, 'day'], [0.64, 'day'], [0.73, 'dusk'], [0.82, 'night'], [1, 'night']];
const TOD_LABEL = { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' };
function mixT(A, B, t, out) {
  const o = out || {};
  for (const k in A) { const a = A[k], b = B[k];
    if (typeof a === 'string') { _c1.set(a); _c2.set(b); o[k] = '#' + _c1.lerp(_c2, t).getHexString(); }
    else if (Array.isArray(a)) o[k] = a.map((v, i) => lerp(v, b[i], t)); else o[k] = lerp(a, b, t); }
  return o;
}
/* ---------- climate zones (they change along the road) and weather ---------- */''')

# ---- applyWorld: use the current time-of-day blend, sync sun and lights each frame, headlight modes ----
rep("    const T = TIMES[this.time] || TIMES.dusk, W = this.wcur,", "    const T = this.curT(), W = this.wcur,")
rep("    mul.setRGB(lerp(1, sk[0], am), lerp(1, sk[1], am), lerp(1, sk[2], am));", "    u.sunDir.value.set(...T.sun); u.sunCol.value.setRGB(...T.sunCol); this.sunDirV.set(...T.sun).normalize(); this.mtnBase.set(T.mtn);\n    this.sunL.color.set(T.light); this.fill.color.set(T.hs); this.hemi.color.set(T.hs); this.hemi.groundColor.set(T.hg); this.lightsOn = T.li < 1.8;\n    mul.setRGB(lerp(1, sk[0], am), lerp(1, sk[1], am), lerp(1, sk[2], am));")
rep("this.fill.intensity = (this.time === 'night' ? 0.25 : 0.7) * (0.5 + 0.5 * W.light);", "this.fill.intensity = (T.li < 1.8 ? 0.25 : 0.7) * (0.5 + 0.5 * W.light);")
rep("const sig = this.time + '|' + this.cName", "const sig = this.time + (this.time === 'auto' ? Math.floor((this.tod || 0) * 36) : '') + '|' + this.cName")
rep("    const ln = this.lightsOn || W.dark > 0.7; if (ln !== this.lightsNow) { this.lightsNow = ln; if (this.model) this.lightEmit(); }\n    if (this.head) { const dl = this.lightsOn ? 1 : Math.min(1, Math.max(0, (W.dark - 0.5) / 0.4)); this.head.intensity = 260 * dl; this.head.visible = dl > 0.02; }",
    "    const hm = this.headMode, ln = hm === 'on' || (hm !== 'off' && (this.lightsOn || W.dark > 0.7)); if (ln !== this.lightsNow) { this.lightsNow = ln; if (this.model) this.lightEmit(); }\n    this._hl = (this._hl || 0) + ((ln ? 1 : 0) - (this._hl || 0)) * Math.min(1, (dt || 1) * 4);\n    if (this.head) { this.head.intensity = 260 * this._hl; this.head.visible = this._hl > 0.02; }")

# ---- time of day: blend, label, advance ----
rep("  applyWorld(dt) {", '''  curT() { return this.time === 'auto' ? this.todT(this.tod || 0) : (TIMES[this.time] || TIMES.dusk); }
  todT(tod) { let i = 0; while (i < TOD_KEYS.length - 2 && tod >= TOD_KEYS[i + 1][0]) i++; const [a, na] = TOD_KEYS[i], [b, nb] = TOD_KEYS[i + 1]; return mixT(TIMES[na], TIMES[nb], smooth(0, 1, (tod - a) / (b - a)), this._tT || (this._tT = {})); }
  timeName() { if (this.time !== 'auto') return TOD_LABEL[this.time] || ''; const t = this.tod || 0; return t < 0.22 ? 'Night' : t < 0.33 ? 'Dawn' : t < 0.68 ? 'Day' : t < 0.78 ? 'Dusk' : 'Night'; }
  applyWorld(dt) {''')
rep("    this.applyWorld(dt);\n    const lab = CLIM_NAME[this.cName] + ' · ' + WX_NAME[this.fixedWx || this.wxTarget];", "    if (this.time === 'auto') this.tod = ((this.tod || 0) + dt / CYCLE) % 1;\n    this.applyWorld(dt);\n    const lab = CLIM_NAME[this.cName] + ' · ' + WX_NAME[this.fixedWx || this.wxTarget] + ' · ' + this.timeName();")
rep("    const T = TIMES[name] || TIMES.dusk; this.time = name; const u = this.skyMat.uniforms;", "    this.time = name; if (name === 'auto' && this.tod === undefined) this.tod = 0.30; const T = this.curT(); const u = this.skyMat.uniforms;")
rep("this.lightsOn = name === 'night'; this.tintFar(); if (this.world) this.applyWorld(0);", "this.tintFar(); if (this.world) this.applyWorld(0);")

# ---- headlight mode + start/configure ----
rep("weather = 'auto', climate = 'auto', demo = false, view = 'third' }) {", "weather = 'auto', climate = 'auto', demo = false, view = 'third', lights = 'auto' }) {\n    this.headMode = lights; this.tod = 0.30; this._hl = 0;")
rep("    if ('view' in o && !this.demo) this.setView(o.view);", "    if ('view' in o && !this.demo) this.setView(o.view);\n    if ('lights' in o) this.headMode = o.lights;")
rep("this.cNow = CLIM.temperate; this.lightsNow = false;", "this.cNow = CLIM.temperate; this.lightsNow = false; this.headMode = 'auto';")
open('game.js', 'w', encoding='utf-8').write(s)
print('game.js ok')

u = open('index.html', encoding='utf-8').read()
def repu(a, b):
    global u
    assert a in u, a[:90]
    u = u.replace(a, b, 1)
repu('<div class="seg" data-key="time"><button data-v="dawn">Dawn</button><button data-v="dusk">Dusk</button><button data-v="night">Night</button></div></div>',
     '<div class="seg" data-key="time"><button data-v="auto">Auto</button><button data-v="dawn">Dawn</button><button data-v="day">Day</button><button data-v="dusk">Dusk</button><button data-v="night">Night</button></div></div>\n    <div class="row"><label>Headlights<small>Auto turns on at night and in storms</small></label><div class="seg" data-key="lights"><button data-v="auto">Auto</button><button data-v="on">On</button><button data-v="off">Off</button></div></div>')
repu("const defaults={quality:'med',time:'dusk',", "const defaults={quality:'med',time:'auto',")
repu("weather:'auto',climate:'auto',view:'third'};", "weather:'auto',climate:'auto',view:'third',lights:'auto'};")
repu(" dusk:['#1b2340','#4a3b6b','#d77a6b','#ffb36b','#ffd9a0'],", " day:['#2f6fd6','#5e9be6','#8ec3f2','#bcdcf8','#e4f1ff'],\n dusk:['#1b2340','#4a3b6b','#d77a6b','#ffb36b','#ffd9a0'],")
repu("  const c=TIMES[S.time];", "  const c=TIMES[S.time]||TIMES.dusk;")
repu("$('.stars').style.opacity=S.time==='night'?1:S.time==='dusk'?.5:.1;", "$('.stars').style.opacity=S.time==='night'?1:S.time==='day'?0:S.time==='dawn'?.1:.5;")
repu("weather:S.weather,climate:S.climate,view:S.view});\n  toast('Driving the '+v.name);", "weather:S.weather,climate:S.climate,view:S.view,lights:S.lights});\n  updateLightBtn();toast('Driving the '+v.name);")
repu("climate:S.climate,view:S.view})}", "climate:S.climate,view:S.view,lights:S.lights})}")
repu('<button class="icon-btn" id="radioBtn"', '<button class="icon-btn" id="lightBtn" aria-label="Headlights: auto, on or off" title="Headlights (L)" data-mode="AUTO"><svg viewBox="0 0 24 24"><path d="M10 6a6 6 0 0 0 0 12h1V6z"/><path d="M15 8l5-1.5M15 12h5.5M15 16l5 1.5"/></svg></button><button class="icon-btn" id="radioBtn"')
repu('/* Garage 3D stage */', '#lightBtn{position:relative}\n#lightBtn::after{content:attr(data-mode);position:absolute;bottom:-4px;right:-6px;font-size:.5rem;letter-spacing:.06em;padding:1px 5px;border-radius:99px;background:var(--glass);border:1px solid var(--line);color:var(--ink-2)}\n#lightBtn.on svg{stroke:#ffe8a3}#lightBtn.off svg{opacity:.45}\n/* Garage 3D stage */')
repu("function toggleView(){", """function updateLightBtn(){const b=$('#lightBtn');b.dataset.mode=S.lights.toUpperCase();b.classList.toggle('on',S.lights==='on');b.classList.toggle('off',S.lights==='off')}
function cycleLights(){const o=['auto','on','off'];S.lights=o[(o.indexOf(S.lights)+1)%3];save();if(game&&game.world)game.configure({lights:S.lights});updateLightBtn();syncSettings();toast('Headlights: '+S.lights)}
$('#lightBtn').onclick=cycleLights;
function toggleView(){""")
repu("  if((e.key==='c'||e.key==='C')&&screen==='hud')toggleView();", "  if((e.key==='c'||e.key==='C')&&screen==='hud')toggleView();\n  if((e.key==='l'||e.key==='L')&&screen==='hud')cycleLights();")
repu("syncSettings();renderGarage();show('menu');", "syncSettings();updateLightBtn();renderGarage();show('menu');")
open('index.html', 'w', encoding='utf-8').write(u)
print('index.html ok')

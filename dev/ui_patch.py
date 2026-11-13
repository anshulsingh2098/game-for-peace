import re
p = 'index.html'
s = open(p, encoding='utf-8').read()
data = open('data_snippet.js', encoding='utf-8').read()
garage = open('garage_snippet.js', encoding='utf-8').read()

# 1. markup
s = s.replace('<div id="art"></div>',
              '<canvas id="gc" aria-label="3D preview of the selected vehicle"></canvas><div class="gload" id="gload">Loading…</div>')
s = s.replace('<button class="btn primary drive" id="driveBtn">Drive</button>',
              '<div class="paint"><span id="paintLabel">Paint</span><div id="swatches" class="swatches"></div></div>\n      <button class="btn primary drive" id="driveBtn">Drive</button>')

# 2. css
css = """
/* Garage 3D stage */
.stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab}
.stage canvas:active{cursor:grabbing}
.stage::before{display:none}
.gload{position:absolute;inset:0;display:grid;place-items:center;color:var(--ink-2);font-size:.9rem;pointer-events:none;transition:opacity .4s;z-index:1}
.gload.done{opacity:0}
.dots{position:absolute;bottom:14px;left:0;right:0;justify-content:center;z-index:2}
.arrow{z-index:3}
.paint{display:flex;align-items:center;justify-content:space-between;gap:12px}
.paint>span{font-size:.72rem;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-3)}
.swatches{display:flex;gap:10px;flex-wrap:wrap}
.sw{width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.25);padding:0;transition:transform .15s,border-color .2s}
.sw:hover{transform:scale(1.1)}
.sw[aria-pressed="true"]{border-color:var(--ink);box-shadow:0 0 0 3px rgba(255,255,255,.15)}
"""
s = s.replace('/* Settings / pause cards */', css + '\n/* Settings / pause cards */')

# 3. script: module + imports, new data + garage
s = s.replace('<script>\n/* ---------- Data ---------- */',
 '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>\n'
 '<script type="module">\nimport * as THREE from \'three\';\n'
 'import { GLTFLoader } from \'three/addons/loaders/GLTFLoader.js\';\n'
 'import { OrbitControls } from \'three/addons/controls/OrbitControls.js\';\n'
 'import { RoomEnvironment } from \'three/addons/environments/RoomEnvironment.js\';\n/* ---------- Data ---------- */')
a = s.index('/* ---------- Data ---------- */'); b = s.index('/* ---------- State ---------- */')
s = s[:a] + data + s[b:]
a = s.index('/* ---------- Garage ---------- */'); b = s.index('/* ---------- Settings ---------- */')
s = s[:a] + garage + s[b:]
s = s.replace("v.id==='sport'", "v.id==='car'")
s = s.replace("const defaults={quality:'med',time:'dusk',music:60,sfx:60,units:'kmh',tilt:'off',vehicle:0};",
              "const defaults={quality:'med',time:'dusk',music:60,sfx:60,units:'kmh',tilt:'off',vehicle:0,paint:{}};")
open(p, 'w', encoding='utf-8').write(s)
print('ok', len(s))

import re
s = open('game.js', encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

# ---------- seasons (variants of the temperate climate) and area presets ----------
rep("const ZNAMES = ['temperate', 'autumn', 'desert', 'snow', 'tropical'];", "const ZNAMES = ['temperate', 'desert', 'snow', 'tropical'];")
rep("export const CLIM_NAME =", '''CLIM.spring = { g1: [.55, .80, .35], g2: [.36, .60, .22], dry: [.62, .68, .38], patch: .15, dens: 1, pine: .45, leaf: [1.5, 1.2, 1.35], pineT: [1, 1.05, 1], tuftT: [1.15, 1.2, 1], rock: .10, tuft: 1.5, cactus: 0, skyT: [1, 1, 1, 0], wl: -3.0, mtn: [.45, .55, .45], mtnA: .1, cap: 1 };
CLIM.winter = { g1: [1.3, 1.35, 1.5], g2: [1.0, 1.08, 1.2], dry: [1.1, 1.14, 1.28], patch: .3, dens: .7, pine: .75, leaf: [.75, .65, .55], pineT: [1.3, 1.4, 1.55], tuftT: [1.5, 1.55, 1.8], rock: .15, tuft: .3, cactus: 0, skyT: [.85, .92, 1, .12], wl: -3.2, mtn: [.8, .85, .95], mtnA: .6, cap: 1 };
const AREAS = {   // what the land looks like: forest, mountains, canyon, lakeside, plains, or the natural mix
  mixed:     { hill: 1,    mount: 1,   mS: 50, mE: 200, cLo: 0.58, cHi: 0.66, cliffH: 1,   riverW: 0.03,  riverD: 7.5, wl: 0,   dens: 1,   tuft: 1 },
  forest:    { hill: 0.9,  mount: 0.7, mS: 70, mE: 220, cLo: 0.93, cHi: 0.99, cliffH: 1,   riverW: 0.03,  riverD: 7.5, wl: 0,   dens: 1.5, tuft: 1 },
  mountains: { hill: 1.2,  mount: 1.7, mS: 30, mE: 130, cLo: 0.56, cHi: 0.62, cliffH: 1.3, riverW: 0.025, riverD: 7,   wl: 0,   dens: 0.8, tuft: 0.7 },
  canyon:    { hill: 0.8,  mount: 1,   mS: 60, mE: 200, cLo: 0.36, cHi: 0.44, cliffH: 1.5, riverW: 0.035, riverD: 6,   wl: 0,   dens: 0.5, tuft: 0.6 },
  lakeside:  { hill: 0.9,  mount: 0.8, mS: 60, mE: 220, cLo: 0.85, cHi: 0.93, cliffH: 0.8, riverW: 0.075, riverD: 9,   wl: 1.6, dens: 1.1, tuft: 1.1 },
  plains:    { hill: 0.35, mount: 0.3, mS: 90, mE: 260, cLo: 0.95, cHi: 0.99, cliffH: 0.6, riverW: 0.02,  riverD: 4,   wl: 0,   dens: 0.3, tuft: 1.5 }
};
const SEASON_NAME = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
export const CLIM_NAME =''')

# ---------- World: area parameters drive the terrain ----------
rep("    const r = rng(seed); this.seed = seed;", "    const r = rng(seed); this.seed = seed; this.A = AREAS.mixed;")
rep("  cliff(wx, wz) { return smooth(0.58, 0.66, this.fbm(wx * 0.0045 + 3, wz * 0.0045 - 8)); }", "  setArea(name) { this.A = AREAS[name] || AREAS.mixed; }\n  cliff(wx, wz) { return smooth(this.A.cLo, this.A.cHi, this.fbm(wx * 0.0045 + 3, wz * 0.0045 - 8)); }")
rep("(this.fbm(wx * 0.025, wz * 0.025) - 0.5) * 5;", "(this.fbm(wx * 0.025, wz * 0.025) - 0.5) * 5; hills *= this.A.hill;") if False else None
rep("const a = Math.abs(t), hills = (this.fbm(wx * 0.006, wz * 0.006) - 0.45) * 30 + (this.fbm(wx * 0.025, wz * 0.025) - 0.5) * 5;",
    "const a = Math.abs(t), hills = ((this.fbm(wx * 0.006, wz * 0.006) - 0.45) * 30 + (this.fbm(wx * 0.025, wz * 0.025) - 0.5) * 5) * this.A.hill;")
rep("wz * 0.0028 - 4) - 0.5) / 0.03, 2));", "wz * 0.0028 - 4) - 0.5) / this.A.riverW, 2));")
rep("- 7.5 * river * smooth(10, 30, a)\n      + cf * smooth(12, 19, a) * (26 + 22 * this.fbm(wx * 0.01 + 5, wz * 0.01)) + smooth(50, 200, a) * Math.pow(rr, 2.6) * 190;",
    "- this.A.riverD * river * smooth(10, 30, a)\n      + cf * smooth(12, 19, a) * (26 + 22 * this.fbm(wx * 0.01 + 5, wz * 0.01)) * this.A.cliffH + smooth(this.A.mS, this.A.mE, a) * Math.pow(rr, 2.6) * 190 * this.A.mount;")

# ---------- climate key depends on the chosen season (temperate only) ----------
rep("  zone(k) {", "  CK(name) { return name === 'temperate' ? ({ spring: 'spring', summer: 'temperate', autumn: 'autumn', winter: 'winter' }[this.season] || 'temperate') : name; }\n  zone(k) {")
rep("    if (this.fixedClim) return CLIM[this.fixedClim];", "    if (this.fixedClim) return CLIM[this.CK(this.fixedClim)];")
rep("    if (a === b || t <= 0.001) return CLIM[a]; if (t >= 0.999) return CLIM[b];", "    if (a === b || t <= 0.001) return CLIM[this.CK(a)]; if (t >= 0.999) return CLIM[this.CK(b)];")
rep("this._cv = mixC(CLIM[a], CLIM[b], t); }", "this._cv = mixC(CLIM[this.CK(a)], CLIM[this.CK(b)], t); }")
rep("const lab = CLIM_NAME[this.cName] + ' · '", "const lab = CLIM_NAME[this.cName] + (this.cName === 'temperate' ? ' (' + (SEASON_NAME[this.season] || 'Summer') + ')' : '') + ' · '")

# ---------- area / season in the chunk builder ----------
s = s.replace("C.wl + 0.9", "C.wl + w.A.wl + 0.9")
rep("const below = y - ry - C.wl,", "const below = y - ry - C.wl - w.A.wl,")
rep("lvl = w.ys[i] + this.clim(i * DS).wl;", "lvl = w.ys[i] + this.clim(i * DS).wl + w.A.wl;")
rep("Math.round(26 * this.q.trees * Cm.dens)", "Math.round(26 * this.q.trees * Cm.dens * w.A.dens)")
rep("Math.round(16 * this.q.trees * Cm.dens)", "Math.round(16 * this.q.trees * Cm.dens * w.A.dens)")
rep("Math.round(10 * this.q.trees * Cm.dens)", "Math.round(10 * this.q.trees * Cm.dens * w.A.dens)")
rep("Math.round(46 * this.q.trees * Cm.tuft)", "Math.round(46 * this.q.trees * Cm.tuft * w.A.tuft)")

# ---------- start / configure ----------
rep("weather = 'auto', climate = 'auto', demo = false, view = 'third', lights = 'auto' }) {", "weather = 'auto', climate = 'auto', demo = false, view = 'third', lights = 'auto', season = 'summer', area = 'mixed' }) {\n    this.season = season; this.areaName = area;")
rep("    this.world = new World((Math.random() * 1e9) | 0);", "    this.world = new World((Math.random() * 1e9) | 0); this.world.setArea(area);")
rep("    if ('climate' in o) {", "    if ('season' in o && o.season !== this.season) { this.season = o.season; this._ck = null; this.rebuildAll(); }\n    if ('area' in o && o.area !== this.areaName) { this.areaName = o.area; this.world.setArea(o.area); this.rebuildAll(); }\n    if ('climate' in o) {")
rep("  configure(o) {", "  rebuildAll() { for (const v of this.chunks.values()) v.dispose(); this.chunks.clear(); this.updateChunks(true); }\n  configure(o) {")
open('game.js', 'w', encoding='utf-8').write(s)
print('game.js ok')

# ================= UI =================
u = open('index.html', encoding='utf-8').read()
def repu(a, b):
    global u
    assert a in u, a[:90]
    u = u.replace(a, b, 1)

# cut the world rows out of Settings and build a World screen
a = u.index('    <div class="row"><label>Time of day</label>'); b = u.index('    <div class="row"><label>Music</label>')
block = u[a:b]
head_lights = re.search(r'    <div class="row"><label>Headlights.*?</div></div>\n', block, re.S).group(0)
u = u[:a] + head_lights + u[b:]
world = '''<!-- WORLD -->
<section class="screen center" id="world" aria-label="World">
  <div class="card glass">
    <h2>World</h2>
    <p class="hint-line">What you pick here stays exactly as it is. Nothing changes by itself unless you choose a mixed or auto option.</p>
    <div class="row"><label>Season</label><div class="seg" data-key="season"><button data-v="spring">Spring</button><button data-v="summer">Summer</button><button data-v="autumn">Autumn</button><button data-v="winter">Winter</button></div></div>
    <div class="row"><label>Climate<small>Season applies to Temperate</small></label>
      <select data-key="climate" id="selClimate" aria-label="Climate"><option value="temperate">Temperate</option><option value="desert">Desert</option><option value="tropical">Tropical</option><option value="snow">Snowfields</option><option value="auto">Mixed (changes as you drive)</option></select></div>
    <div class="row"><label>Area</label>
      <select data-key="area" id="selArea" aria-label="Area"><option value="mixed">Natural mix</option><option value="forest">Forest</option><option value="mountains">Mountains</option><option value="canyon">Cliffs and canyon</option><option value="lakeside">Lakeside</option><option value="plains">Open plains</option></select></div>
    <div class="row"><label>Weather</label>
      <select data-key="weather" id="selWeather" aria-label="Weather"><option value="clear">Clear</option><option value="overcast">Overcast</option><option value="fog">Fog</option><option value="rain">Rain</option><option value="storm">Storm</option><option value="snow">Snow</option><option value="auto">Auto (changes as you drive)</option></select></div>
    <div class="row"><label>Time of day</label>
      <div class="seg" data-key="time"><button data-v="dawn">Dawn</button><button data-v="day">Day</button><button data-v="dusk">Dusk</button><button data-v="night">Night</button><button data-v="auto">Cycle</button></div></div>
    <button class="btn primary" id="worldBack">Done</button>
  </div>
</section>

'''
repu('<!-- HUD -->', world + '<!-- HUD -->')
repu('<button class="btn ghost" data-go="settings">Settings</button>\n    </div>', '<button class="btn ghost" data-go="world">World</button>\n      <button class="btn ghost" data-go="settings">Settings</button>\n    </div>')
repu('<button class="btn ghost" data-go="settings" data-from="pause">Settings</button>', '<button class="btn ghost" data-go="world" data-from="pause">World</button>\n    <button class="btn ghost" data-go="settings" data-from="pause">Settings</button>')
repu("$('#settingsBack').onclick=()=>show(settingsReturn);", "$('#settingsBack').onclick=()=>show(settingsReturn);\n$('#worldBack').onclick=()=>show(settingsReturn);")
repu('/* Garage 3D stage */', '.hint-line{font-size:.82rem;color:var(--ink-2);line-height:1.45;margin:-4px 0 4px;text-align:center}\n#world .seg{flex-wrap:wrap;justify-content:flex-end}\n/* Garage 3D stage */')

# defaults: nothing changes by itself; migrate older saved settings once
repu("const defaults={quality:'med',time:'auto',", "const defaults={quality:'med',time:'day',")
repu("weather:'auto',climate:'auto',view:'third',lights:'auto'};", "weather:'clear',climate:'temperate',view:'third',lights:'auto',season:'summer',area:'mixed',worldV:2};")
repu("let screen='menu',prev='menu',playing=false;", "if(S.worldV!==2){S.worldV=2;S.time='day';S.weather='clear';S.season=S.season||'summer';S.area='mixed';if(S.climate==='autumn'){S.climate='temperate';S.season='autumn'}else if(S.climate==='auto')S.climate='temperate';try{localStorage.setItem('gameforpeace',JSON.stringify(S))}catch(e){}}\nlet screen='menu',prev='menu',playing=false;")
repu("time:S.time,quality:S.quality,weather:S.weather,climate:S.climate,view:S.view,lights:S.lights});\n  updateLightBtn();", "time:S.time,quality:S.quality,weather:S.weather,climate:S.climate,view:S.view,lights:S.lights,season:S.season,area:S.area});\n  updateLightBtn();")
repu("quality:S.quality==='high'?'med':S.quality,weather:S.weather,climate:S.climate,demo:true});", "quality:S.quality==='high'?'med':S.quality,weather:S.weather,climate:S.climate,season:S.season,area:S.area,demo:true});")
repu("climate:S.climate,view:S.view,lights:S.lights})}", "climate:S.climate,view:S.view,lights:S.lights,season:S.season,area:S.area})}")
repu("const live=screen==='hud'||screen==='pause'||(screen==='settings'&&settingsReturn==='pause');", "const live=screen==='hud'||screen==='pause'||((screen==='settings'||screen==='world')&&settingsReturn==='pause');")
repu("(screen==='menu'||screen==='garage'||(screen==='settings'&&settingsReturn==='menu'));", "(screen==='menu'||screen==='garage'||((screen==='settings'||screen==='world')&&settingsReturn==='menu'));")
open('index.html', 'w', encoding='utf-8').write(u)
print('index.html ok')

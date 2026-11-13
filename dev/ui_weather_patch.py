s = open('index.html', encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)

# settings rows
rep('    <div class="row"><label>Music</label>', '''    <div class="row"><label>Weather<small>Auto changes as you drive</small></label>
      <select data-key="weather" id="selWeather" aria-label="Weather"><option value="auto">Auto</option><option value="clear">Clear</option><option value="overcast">Overcast</option><option value="fog">Fog</option><option value="rain">Rain</option><option value="storm">Storm</option><option value="snow">Snow</option></select></div>
    <div class="row"><label>Climate<small>Auto moves through zones</small></label>
      <select data-key="climate" id="selClimate" aria-label="Climate"><option value="auto">Auto</option><option value="temperate">Temperate</option><option value="autumn">Autumn</option><option value="desert">Desert</option><option value="snow">Snowfields</option><option value="tropical">Tropical</option></select></div>
    <div class="row"><label>Music</label>''')
# css
rep('/* Garage 3D stage */', '''select{appearance:none;-webkit-appearance:none;background:var(--glass-2) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' stroke='%23f4efe6' stroke-width='2'%3E%3Cpath d='M1 1l5 5 5-5'/%3E%3C/svg%3E") no-repeat right 14px center;
  color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:9px 38px 9px 16px;font:500 .88rem var(--font);min-width:132px;cursor:pointer}
select option{color:#1b2340;background:#f4efe6}
.worldtag{position:absolute;left:50%;top:calc(var(--safe-t) + 26px);transform:translateX(-50%);padding:7px 16px;border-radius:999px;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);
  background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);white-space:nowrap;pointer-events:none;text-shadow:0 1px 8px rgba(0,0,0,.3)}
@media (max-width:520px){.worldtag{top:calc(var(--safe-t) + 78px);font-size:.7rem}}
/* Garage 3D stage */''')
# hud tag
rep('<div class="hud-top">', '<div class="worldtag" id="worldTag" aria-live="polite"></div>\n  <div class="hud-top">')
# defaults + selects
rep("tilt:'off',vehicle:0,paint:{}};", "tilt:'off',vehicle:0,paint:{},weather:'auto',climate:'auto'};")
rep("  $$('input[type=range]').forEach(r=>r.value=S[r.dataset.key]);", "  $$('input[type=range]').forEach(r=>r.value=S[r.dataset.key]);\n  $$('select[data-key]').forEach(x=>x.value=S[x.dataset.key]);")
rep("$$('.seg').forEach(g=>g.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S[g.dataset.key]=b.dataset.v;save();syncSettings()}));",
    "function liveApply(){if(game&&game.world)game.configure({time:S.time,weather:S.weather,climate:S.climate})}\n$$('.seg').forEach(g=>g.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S[g.dataset.key]=b.dataset.v;save();syncSettings();liveApply()}));\n$$('select[data-key]').forEach(x=>x.addEventListener('change',()=>{S[x.dataset.key]=x.value;save();liveApply()}));")
# game creation and start options
rep("game=new Game($('#gamecv'),{onFrame:hud});", "game=new Game($('#gamecv'),{onFrame:hud,onWorld:l=>{$('#worldTag').textContent=l}});")
rep("time:S.time,quality:S.quality});", "time:S.time,quality:S.quality,weather:S.weather,climate:S.climate});")
open('index.html', 'w', encoding='utf-8').write(s)
print('ui patched')

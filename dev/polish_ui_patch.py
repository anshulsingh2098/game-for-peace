s = open('index.html', encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)

# ---- font ----
rep('<style>', '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;500;600;700&display=swap">\n<style>')
rep('--font:ui-rounded,"SF Pro Rounded",', '--font:"Outfit",ui-rounded,"SF Pro Rounded",')

# ---- vignette / readability gradients + menu shade + stagger + gauge css ----
rep('/* Garage 3D stage */', '''/* scene polish: vignette, top/bottom shading for readable HUD, gentle colour grade */
#vignette{position:fixed;inset:0;pointer-events:none;display:none;background:
  radial-gradient(125% 105% at 50% 45%,transparent 52%,rgba(12,9,28,.42) 100%),
  linear-gradient(180deg,rgba(12,9,28,.28),transparent 18%,transparent 70%,rgba(12,9,28,.38))}
body.ingame #vignette{display:block}
#menu::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(90deg,rgba(14,10,34,.62),rgba(14,10,34,.18) 58%,transparent)}
#menu.on .brand small,#menu.on .brand h1,#menu.on .brand p,#menu.on .menu-actions{animation:rise .8s cubic-bezier(.2,.7,.2,1) both}
#menu.on .brand h1{animation-delay:.08s}#menu.on .brand p{animation-delay:.18s}#menu.on .menu-actions{animation-delay:.28s}
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.speed{position:relative;width:clamp(104px,24vw,138px);aspect-ratio:1;display:grid;place-content:center;justify-items:center;text-align:center}
.speed .gauge{position:absolute;inset:0;width:100%;height:100%;transform:rotate(135deg);overflow:visible;filter:drop-shadow(0 2px 10px rgba(0,0,0,.35))}
.speed .gauge circle{fill:none;stroke-width:5;stroke-linecap:round}
.speed .gbg{stroke:rgba(255,255,255,.16);stroke-dasharray:245 400}
.speed .gfg{stroke:var(--accent);stroke-dasharray:0 400;transition:stroke-dasharray .12s linear,stroke .3s}
.speed.boost .gfg{stroke:#fff}
.speed b{font-size:clamp(2rem,7vw,2.9rem)!important;font-weight:500!important;letter-spacing:-.02em!important;line-height:1!important}
.speed span{margin-top:2px!important;font-size:.62rem!important;letter-spacing:.26em!important}
/* Garage 3D stage */''')

# ---- markup: vignette + gauge ----
rep('<!-- MENU -->', '<div id="vignette" aria-hidden="true"></div>\n\n<!-- MENU -->')
rep('<div class="speed"><b id="spd">0</b><span id="unit">km/h</span></div>',
    '<div class="speed" id="speedBox"><svg class="gauge" viewBox="0 0 120 120" aria-hidden="true"><circle class="gbg" cx="60" cy="60" r="52"/><circle class="gfg" id="gaugeFg" cx="60" cy="60" r="52"/></svg><b id="spd">0</b><span id="unit">km/h</span></div>')
rep("  const m=S.units==='mph'?.621:1;\n  $('#spd').textContent=Math.round(f.kmh*m);",
    "  const m=S.units==='mph'?.621:1;\n  $('#spd').textContent=Math.round(f.kmh*m);\n  $('#gaugeFg').style.strokeDasharray=(245*Math.min(1,f.kmh/(VEHICLES[S.vehicle].s.Top*0.9)))+' 400';$('#speedBox').classList.toggle('boost',f.buff);")

# ---- live demo behind the menu ----
rep("  document.body.classList.toggle('ingame',name==='hud'||name==='pause'||(name==='settings'&&settingsReturn==='pause'));\n  if(game&&(name==='menu'||name==='garage'))game.stop();",
    "  syncScene();\n  if(name==='menu'){if(game&&game.demo&&game.world&&demoVeh===S.vehicle)game.resume();else startDemo()}\n  if(name==='garage'&&game){if(game.demo)game.pause();else game.stop()}\n  syncScene();")
rep("document.addEventListener('click',e=>{", """let demoVeh=-1,demoBusy=false;
function syncScene(){
  const live=screen==='hud'||screen==='pause'||(screen==='settings'&&settingsReturn==='pause');
  const demoOn=!!(game&&game.demo&&game.world)&&(screen==='menu'||screen==='garage'||(screen==='settings'&&settingsReturn==='menu'));
  document.body.classList.toggle('ingame',live||demoOn);
}
async function startDemo(){
  if(demoBusy)return;demoBusy=true;
  try{
    const v=VEHICLES[S.vehicle];await loadVehicle(v);
    if(screen!=='menu'){demoBusy=false;return}
    if(!game){game=new Game($('#gamecv'),{onFrame:hud,onWorld:l=>{$('#worldTag').textContent=l}});game.keys=keys;window.__game=game}
    demoVeh=S.vehicle;
    game.start({id:v.id,model:v._g.scene,stats:v.s,buff:v.buff,time:S.time,quality:S.quality==='high'?'med':S.quality,weather:S.weather,climate:S.climate,demo:true});
    syncScene();
  }catch(e){console.warn('demo scene unavailable',e)}
  demoBusy=false;
}
document.addEventListener('click',e=>{""")
rep("document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='hud')pauseGame()});",
    "document.addEventListener('visibilitychange',()=>{if(document.hidden){if(screen==='hud')pauseGame();else if(game&&game.demo)game.pause()}else if(screen==='menu'&&game&&game.demo&&game.world)game.resume()});")
rep("syncScene();\n  if(name==='menu')", "syncScene();\n  if(name==='menu')") if False else None
rep("syncSettings();renderGarage();show('menu');", "syncSettings();renderGarage();show('menu');")
open('index.html', 'w', encoding='utf-8').write(s)
print('ui polished')

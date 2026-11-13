s = open('index.html', encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)

# canvas + css + import
rep('<!-- MENU -->', '<canvas id="gamecv" aria-label="Game view"></canvas>\n\n<!-- MENU -->')
rep('/* Garage 3D stage */', '#gamecv{position:fixed;inset:0;width:100%;height:100%;display:none;touch-action:none}\nbody.ingame #gamecv{display:block}\nbody.ingame .sky{display:none}\n/* Garage 3D stage */')
rep("import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';", "import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';\nimport { Game } from './game.js';")

# show(): canvas visibility and stopping the run when leaving
rep("  document.body.classList.toggle('paused',name!=='hud');",
    "  document.body.classList.toggle('paused',name!=='hud');\n  document.body.classList.toggle('ingame',name==='hud'||name==='pause'||(name==='settings'&&settingsReturn==='pause'));\n  if(game&&(name==='menu'||name==='garage'))game.stop();")

# replace the stand-in gameplay with the real engine
a = s.index('/* ---------- Gameplay stand-in'); b = s.index("const setKey=(k,d)=>")
s = s[:a] + '''/* ---------- Gameplay (real engine in game.js) ---------- */
const keys={left:0,right:0,up:0,down:0};
const ring=$('#ring'),CIRC=264;
let game=null;
function hud(f){
  const m=S.units==='mph'?.621:1;
  $('#spd').textContent=Math.round(f.kmh*m);
  $('#dist').textContent=(f.distKm*m).toFixed(1)+(S.units==='mph'?' mi':' km');
  const ready=f.cd<=0;$('#buffBtn').classList.toggle('ready',ready);
  ring.style.strokeDashoffset=ready?0:CIRC*(f.cd/f.cdMax);
}
async function start(){
  const v=VEHICLES[S.vehicle];$('#buffLabel').textContent=v.buff[2];
  try{await loadVehicle(v)}catch(e){toast('Could not load the vehicle');console.error(e);return}
  if(!game){game=new Game($('#gamecv'),{onFrame:hud});game.keys=keys}
  playing=true;show('hud');
  if(v.paintHex&&v.id==='car'){}
  game.start({id:v.id,model:v._g.scene,stats:v.s,buff:v.buff,time:S.time,quality:S.quality});
  toast('Driving the '+v.name);
}
function useBuff(){
  if(!game||!playing)return;const v=VEHICLES[S.vehicle];
  if(game.useBuff())toast(v.buff[0]+' active');
}
''' + s[b:]
rep("function pauseGame(){playing=false;show('pause')}\nfunction resume(){playing=true;show('hud');last=performance.now();requestAnimationFrame(loop)}",
    "function pauseGame(){if(!game)return;playing=false;game.pause();show('pause')}\nfunction resume(){playing=true;show('hud');game.resume()}")
open('index.html', 'w', encoding='utf-8').write(s)
print('ok')

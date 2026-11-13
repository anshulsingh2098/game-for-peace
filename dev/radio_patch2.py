u = open('index.html', encoding='utf-8').read()
def rep(a, b):
    global u
    assert a in u, a[:80]
    u = u.replace(a, b, 1)

# imports + audio objects
rep("import { Game } from './game.js", "import { Sound, Radio } from './audio.js?v=1';\nimport { Game } from './game.js")
rep("let game=null;", """let game=null;
/* ---------- audio: radio + engine/weather sounds ---------- */
const sound=new Sound(),radio=new Radio(sound);
radio.load('music/playlist.json');
function applyVolumes(){sound.music=(S.musicMuted?0:S.music/100)*0.85;sound.sfx=S.sfx/100;sound.applyVolumes()}
function unlockAudio(){if(!sound.ctx){sound.init();applyVolumes()}sound.resume()}
['pointerdown','keydown','touchstart'].forEach(ev=>addEventListener(ev,unlockAudio,{passive:true}));
const ico={play:'<path d="M8 5v14l11-7z"/>',pause:'<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>'};
let lastTitle='';
radio.on(st=>{
  const t=st.track;$('#rTitle').textContent=t?t.title:'No songs yet';$('#rArtist').textContent=t?(t.artist||''):'';
  $('#rEmpty').hidden=st.has;$('#radioPanel').classList.toggle('empty',!st.has);
  $('#rPlay').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+(st.playing?ico.pause:ico.play)+'</svg>';
  $('#rProg').style.width=(st.d?Math.min(100,st.t/st.d*100):0)+'%';$('#rShuf').setAttribute('aria-pressed',st.shuffle);
  $('#radioBtn').classList.toggle('on',st.playing);
  const sel=$('#rStation');if(sel.options.length!==st.stations.length){sel.innerHTML=st.stations.map((s,i)=>`<option value="${i}">${s.name}</option>`).join('')}sel.value=st.si;sel.hidden=st.stations.length<2;
  if(t&&st.playing&&t.title!==lastTitle&&screen==='hud'){lastTitle=t.title;toast('♪ '+t.title+(t.artist?' · '+t.artist:''))}
});
$('#rPlay').onclick=async()=>{unlockAudio();const was=radio.audio.paused;await radio.toggle();S.radio=was;save()};
$('#rNext').onclick=()=>{unlockAudio();radio.next()};$('#rPrev').onclick=()=>{unlockAudio();radio.prev()};
$('#rShuf').onclick=()=>radio.setShuffle(!radio.shuffle);
$('#rStation').onchange=e=>radio.setStation(+e.target.value);
$('#rVol').value=S.music;$('#rVol').oninput=e=>{S.music=+e.target.value;S.musicMuted=false;save();$('input[data-key=music]').value=S.music;applyVolumes()};
$('#radioBtn').onclick=()=>{const p=$('#radioPanel');p.hidden=!p.hidden};$('#rClose').onclick=()=>{$('#radioPanel').hidden=true};
function toggleMute(){S.musicMuted=!S.musicMuted;save();applyVolumes();toast(S.musicMuted?'Radio muted':'Radio on')}""")

# markup: radio button + panel
rep('<button class="icon-btn" id="viewBtn"', '<button class="icon-btn" id="radioBtn" aria-label="Radio" title="Radio (R)"><svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg></button><button class="icon-btn" id="viewBtn"')
rep('<!-- PAUSE -->', '''<!-- RADIO -->
<section class="radio glass" id="radioPanel" aria-label="Radio" hidden>
  <div class="r-top"><span>Radio</span><button class="r-x" id="rClose" aria-label="Close radio">×</button></div>
  <div class="r-title" id="rTitle">No songs yet</div><div class="r-artist" id="rArtist"></div>
  <div class="r-bar"><i id="rProg"></i></div>
  <div class="r-ctl">
    <button id="rPrev" aria-label="Previous song"><svg viewBox="0 0 24 24"><path d="M7 5v14M19 5L9 12l10 7z"/></svg></button>
    <button id="rPlay" class="main" aria-label="Play or pause"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
    <button id="rNext" aria-label="Next song"><svg viewBox="0 0 24 24"><path d="M17 5v14M5 5l10 7-10 7z"/></svg></button>
  </div>
  <div class="r-vol"><span>Volume</span><input type="range" id="rVol" min="0" max="100" aria-label="Radio volume"></div>
  <div class="r-opt"><button id="rShuf" aria-pressed="true">Shuffle</button><select id="rStation" aria-label="Station" hidden></select></div>
  <p class="r-empty" id="rEmpty" hidden>Add songs to the music folder and list them in music/playlist.json.</p>
</section>

<!-- PAUSE -->''')
rep('/* Garage 3D stage */', """[hidden]{display:none!important}
.icon-btn.on{border-color:var(--accent);box-shadow:0 0 0 3px rgba(255,255,255,.08)}.icon-btn.on svg{stroke:var(--accent)}
.radio{position:fixed;right:calc(var(--safe-r) + 20px);top:calc(var(--safe-t) + 78px);width:min(310px,calc(100vw - 40px));padding:16px 18px 18px;display:flex;flex-direction:column;gap:10px;z-index:6;animation:in .35s cubic-bezier(.2,.7,.2,1)}
.radio .r-top{display:flex;justify-content:space-between;align-items:center;font-size:.7rem;letter-spacing:.26em;text-transform:uppercase;color:var(--ink-3)}
.radio .r-x{width:32px;height:32px;border-radius:50%;font-size:1.4rem;line-height:1;color:var(--ink-2)}
.radio .r-title{font-size:1.1rem;font-weight:600;line-height:1.25;overflow-wrap:anywhere}.radio .r-artist{color:var(--ink-2);font-size:.85rem;min-height:1.1em}
.radio .r-bar{height:4px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden}.radio .r-bar i{display:block;height:100%;width:0;background:var(--accent);transition:width .3s linear}
.radio .r-ctl{display:flex;justify-content:center;align-items:center;gap:16px}
.radio .r-ctl button{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--glass-2);border:1px solid var(--line)}
.radio .r-ctl button.main{width:56px;height:56px;background:linear-gradient(135deg,var(--accent),var(--accent-2));border:0;color:#1b1630}
.radio svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.radio .main svg{fill:currentColor;stroke:none}
.radio .r-vol{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:.78rem;color:var(--ink-2)}.radio .r-vol input{flex:1;min-width:0}
.radio .r-opt{display:flex;gap:10px;align-items:center;justify-content:space-between}
.radio .r-opt button{padding:7px 14px;border-radius:999px;font-size:.8rem;color:var(--ink-2);border:1px solid var(--line);background:transparent}
.radio .r-opt button[aria-pressed="true"]{color:var(--accent);border-color:var(--accent)}.radio .r-opt select{min-width:0;padding:7px 30px 7px 12px;font-size:.8rem}
.radio .r-empty{font-size:.8rem;color:var(--ink-3);line-height:1.4}.radio.empty .r-ctl,.radio.empty .r-bar{opacity:.35;pointer-events:none}
@media (max-width:520px){.radio{top:calc(var(--safe-t) + 124px);right:calc(var(--safe-r) + 12px)}}
/* Garage 3D stage */""")

# keys, pause / resume engine sound, volumes, visibility
rep("  if((e.key==='c'||e.key==='C')&&screen==='hud')toggleView();", "  if((e.key==='c'||e.key==='C')&&screen==='hud')toggleView();\n  if((e.key==='r'||e.key==='R')&&screen==='hud'){const p=$('#radioPanel');p.hidden=!p.hidden}\n  if((e.key==='n'||e.key==='N')&&screen==='hud'){unlockAudio();radio.next()}\n  if((e.key==='m'||e.key==='M')&&screen==='hud')toggleMute();")
rep("function pauseGame(){if(!game)return;playing=false;game.pause();show('pause')}", "function pauseGame(){if(!game)return;playing=false;game.pause();show('pause');sound.setEngineOn(false)}")
rep("function resume(){playing=true;show('hud');game.resume()}", "function resume(){playing=true;show('hud');game.resume();sound.setEngineOn(true)}")
rep("$$('input[type=range]').forEach(r=>r.addEventListener('input',()=>{S[r.dataset.key]=+r.value;save()}));", "$$('input[type=range][data-key]').forEach(r=>r.addEventListener('input',()=>{S[r.dataset.key]=+r.value;if(r.dataset.key==='music')S.musicMuted=false;save();applyVolumes();$('#rVol').value=S.music}));")
rep("  playing=true;show('hud');\n  game.start(", "  playing=true;show('hud');unlockAudio();applyVolumes();sound.setEngineOn(true);if(S.radio!==false&&radio.audio.paused)radio.play();\n  game.start(")
rep("game=new Game($('#gamecv'),{onFrame:hud,onWorld:l=>{$('#worldTag').textContent=l}});game.keys=keys;window.__game=game}\n  playing=true;", "game=new Game($('#gamecv'),{onFrame:hud,onWorld:l=>{$('#worldTag').textContent=l},onAudio:a=>sound.update(a)});game.keys=keys;window.__game=game}\n  playing=true;")
rep("if(!game){game=new Game($('#gamecv'),{onFrame:hud,onWorld:l=>{$('#worldTag').textContent=l}});game.keys=keys;window.__game=game}\n    demoVeh", "if(!game){game=new Game($('#gamecv'),{onFrame:hud,onWorld:l=>{$('#worldTag').textContent=l},onAudio:a=>sound.update(a)});game.keys=keys;window.__game=game}\n    demoVeh")
rep("  syncScene();\n  if(name==='menu')", "  if(name!=='hud')sound.setEngineOn(false);\n  syncScene();\n  if(name==='menu')")
rep("document.addEventListener('visibilitychange',()=>{if(document.hidden){", "let radioWas=false;\ndocument.addEventListener('visibilitychange',()=>{if(document.hidden){radioWas=!radio.audio.paused;radio.pause();if(sound.ctx)sound.ctx.suspend()}else{sound.resume();if(radioWas)radio.play()}\n  if(document.hidden){")
open('index.html', 'w', encoding='utf-8').write(u)
print('radio patched')

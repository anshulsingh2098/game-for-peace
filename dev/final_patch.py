s = open('game.js', encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

# ---- analog inputs (gamepad, tilt) alongside the keys ----
rep("    this.keys = { left: 0, right: 0, up: 0, down: 0 };", "    this.keys = { left: 0, right: 0, up: 0, down: 0 }; this.pad = { steer: 0, up: 0, down: 0 }; this.prScale = 1; this.adaptT = -3; this.fpsA = 0.016;")
rep("    const k = this.demo ? { left: 0, right: 0, up: 0, down: 0 } : this.keys, st = this.stats,", "    const k = this.demo ? { left: 0, right: 0, up: 0, down: 0 } : this.keys, pd = this.demo ? null : this.pad, upA = Math.max(k.up, pd ? pd.up : 0), dnA = (k.down || (pd && pd.down > 0.1)) ? 1 : 0, stA = Math.max(-1, Math.min(1, (k.right - k.left) + (pd ? pd.steer : 0))), st = this.stats,")
rep("    else if (k.up) this.v += (this.v < 0 ? 16 : acc) * dt;", "    else if (upA) this.v += (this.v < 0 ? 16 : acc * Math.max(0.35, upA)) * dt;")
rep("    else if (k.down) this.v -= (this.v > 0.4 ? 14 : revAcc) * dt;", "    else if (dnA) this.v -= (this.v > 0.4 ? 14 : revAcc) * dt;")
rep("if (!k.up && !k.down && Math.abs(this.v) < 0.08) this.v = 0;", "if (!upA && !dnA && Math.abs(this.v) < 0.08) this.v = 0;")
rep("    const target = (k.right - k.left); this.steerIn +=", "    const target = stA; this.steerIn +=")
rep("    if (!k.left && !k.right) this.psi -= this.psi * Math.min(1, dt * 1.6);", "    if (Math.abs(stA) < 0.05) this.psi -= this.psi * Math.min(1, dt * 1.6);")
rep("throttle: k.up ? 1 : 0.06,", "throttle: upA || 0.06,")
rep("brake: !!k.down && this.v > 1,", "brake: !!dnA && this.v > 1,")
rep("const brake = !this.demo && this.keys.down && this.v > 1,", "const brake = !this.demo && (this.keys.down || this.pad.down > 0.1) && this.v > 1,")

# ---- time-boxed chunk building (no hitches) ----
rep("    let budget = force ? 999 : 2;\n    for (let k = lo; k <= hi && budget > 0; k++) if (!this.chunks.has(k)) { this.chunks.set(k, this.buildChunk(k)); budget--; }",
    "    const t0 = performance.now();\n    for (let k = lo; k <= hi; k++) if (!this.chunks.has(k)) { this.chunks.set(k, this.buildChunk(k)); if (!force && performance.now() - t0 > 5) break; }")

# ---- adaptive resolution: drop the pixel ratio when the frame rate is low, restore it when there is room ----
rep("    const dt = Math.min(0.05, (t - this.last) / 1000);", "    const raw = (t - this.last) / 1000; this.fpsA = this.fpsA * 0.93 + raw * 0.07; this.adaptT += raw;\n    if (this.adaptT > 2.5 && !document.hidden) { this.adaptT = 0; const fps = 1 / this.fpsA; if (fps < 38 && this.prScale > 0.6) { this.prScale = Math.max(0.6, this.prScale - 0.15); this.applyPR(); } else if (fps > 57 && this.prScale < 1) { this.prScale = Math.min(1, this.prScale + 0.1); this.applyPR(); } }\n    const dt = Math.min(0.05, (t - this.last) / 1000);")
rep("  resize() {", "  applyPR() { this.renderer.setPixelRatio(Math.min(devicePixelRatio, (this.q || QUALITY.med).pr) * this.prScale); this.resize(); }\n  resize() {")
rep("    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.q.pr)); this.resize();", "    this.prScale = 1; this.adaptT = -3; this.applyPR();")
open('game.js', 'w', encoding='utf-8').write(s)
print('game.js ok')

u = open('index.html', encoding='utf-8').read()
def repu(a, b):
    global u
    assert a in u, a[:90]
    u = u.replace(a, b, 1)

# error collector (read with ?debug) and debug-only hooks
repu('<meta name="theme-color"', '<script>window.__errs=[];addEventListener("error",function(e){__errs.push(e.message+" @"+String(e.filename||"").split("/").pop()+":"+e.lineno)});addEventListener("unhandledrejection",function(e){__errs.push("promise: "+(e.reason&&e.reason.message||e.reason))});</script>\n<meta name="theme-color"')
u = u.replace("window.__game=game", "if(DEBUG)window.__game=game")
repu("window.__radio=radio;window.__sound=sound;", "if(DEBUG){window.__radio=radio;window.__sound=sound}")
repu("let game=null;", "const DEBUG=location.search.includes('debug');\nlet game=null;")

# tilt setting: Off / On / Reverse
repu('<div class="seg" data-key="tilt"><button data-v="off">Off</button><button data-v="on">On</button></div>', '<div class="seg" data-key="tilt"><button data-v="off">Off</button><button data-v="on">On</button><button data-v="rev">Reverse</button></div>')
repu("<small>Phones and tablets</small>", "<small>Phones and tablets. Try Reverse if it steers backwards</small>")

# gamepad + tilt input
repu("/* Gamepad: A = buff, Start = pause, stick = steer */\naddEventListener('gamepadconnected',()=>toast('Gamepad connected'));", """/* ---------- gamepad and tilt steering ---------- */
addEventListener('gamepadconnected',e=>toast('Gamepad connected: '+(e.gamepad.id||'').split('(')[0].trim().slice(0,28)));
let tilt=0,tiltOn=false,gpPrev=[];
function clamp1(x){return Math.max(-1,Math.min(1,x))}
async function enableTilt(){
  if(S.tilt==='off'||tiltOn)return;
  try{if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){const r=await DeviceMotionEvent.requestPermission();if(r!=='granted'){toast('Tilt steering needs motion permission');return}}}catch(e){return}
  addEventListener('devicemotion',e=>{
    const ag=e.accelerationIncludingGravity;if(!ag||ag.x==null)return;
    const ang=(((screen.orientation&&screen.orientation.angle)||window.orientation||0)%360+360)%360;
    let v=ang===0?ag.x:ang===90?-ag.y:ang===180?-ag.x:ag.y;
    if(/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))v=-v;   // iOS reports gravity with the opposite sign
    let st=clamp1(-v/4.5);if(Math.abs(st)<0.07)st=0;if(S.tilt==='rev')st=-st;
    tilt+=(st-tilt)*0.35;
  });
  tiltOn=true;
}
function padFrame(){
  requestAnimationFrame(padFrame);
  if(!game||!game.pad)return;
  const gp=(navigator.getGamepads?[...navigator.getGamepads()]:[]).find(g=>g&&g.connected);
  let st=0,up=0,dn=0;
  if(gp){
    const b=i=>gp.buttons[i]&&gp.buttons[i].pressed,v=i=>gp.buttons[i]?gp.buttons[i].value:0,ax=gp.axes[0]||0,ay=gp.axes[1]||0;
    st=Math.abs(ax)>0.12?ax:0;if(b(14))st=-1;if(b(15))st=1;
    up=Math.max(v(7),Math.max(0,-ay>0.25?-ay:0),b(12)?1:0);dn=Math.max(v(6),Math.max(0,ay>0.25?ay:0),b(13)?1:0);
    const edge=i=>b(i)&&!gpPrev[i];
    if(screen==='hud'){if(edge(0))useBuff();if(edge(3))toggleView();if(edge(2))cycleLights();if(edge(5)){unlockAudio();radio.next()}if(edge(9))pauseGame()}
    else if(screen==='pause'&&edge(9))resume();
    gpPrev=gp.buttons.map(x=>x.pressed);
  }
  game.pad.steer=clamp1(st+(tiltOn&&S.tilt!=='off'?tilt:0));game.pad.up=up;game.pad.down=dn;
}
requestAnimationFrame(padFrame);""")
repu("  playing=true;show('hud');unlockAudio();", "  playing=true;show('hud');enableTilt();unlockAudio();")
open('index.html', 'w', encoding='utf-8').write(u)
print('index ok')

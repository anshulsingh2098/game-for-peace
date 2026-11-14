/* Driving controls from keyboard, on-screen touch controls and a gamepad, merged into one input:
   { steer -1..1 (right is +), throttle 0..1, brake 0..1, hand 0..1, rev 0..1 }
     throttle  accelerate (W / Up)
     brake     the foot brake: slows and holds the car, never reverses (Space)
     hand      the handbrake: locks the rear wheels so the tail can slide (X)
     rev       reverse: brakes first if the car is still rolling forward, then reverses (S / Down)
   One-shot actions arrive through on(name, fn): 'view', 'reset', 'fly', 'pause', 'buff' (boost: Shift), 'auto', 'cam' (camera view: V). */
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'brake', KeyX: 'hand' };
const ACTIONS = { KeyC: 'view', KeyB: 'reset', KeyF: 'fly', Escape: 'pause', ShiftLeft: 'buff', ShiftRight: 'buff', KeyE: 'auto', KeyV: 'cam' };

export class Controls {
  constructor() {
    this.k = { left: 0, right: 0, up: 0, down: 0, brake: 0, hand: 0 }; this.touch = { left: 0, right: 0, up: 0, down: 0, brake: 0, hand: 0 }; this.handlers = {}; this.prev = []; this.enabled = true; this.locked = false;
    this.input = { steer: 0, throttle: 0, brake: 0, hand: 0, rev: 0 }; this.analog = { steer: 0, throttle: 0 };      // analog: the touch steering handle and throttle slider (src/input/touchui.js)
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (KEYS[e.code]) { this.k[KEYS[e.code]] = 1; if (this.enabled) e.preventDefault(); }
      if (ACTIONS[e.code] && !e.repeat) { this.fire(ACTIONS[e.code]); if (this.enabled && e.code.startsWith('Shift')) e.preventDefault(); }
    });
    addEventListener('keyup', e => { if (KEYS[e.code]) this.k[KEYS[e.code]] = 0; });
    addEventListener('blur', () => { for (const n in this.k) this.k[n] = 0; for (const n in this.touch) this.touch[n] = 0; });
  }
  on(name, fn) { this.handlers[name] = fn; }
  fire(name) { if (this.handlers[name]) this.handlers[name](); }
  /* wire up elements carrying data-k="left|right|up|down|brake|hand" as hold-to-press pads */
  bindPads(els) {
    for (const el of els) {
      const set = d => e => { e.preventDefault(); el.classList.toggle('down', !!d); this.touch[el.dataset.k] = d; };
      el.addEventListener('pointerdown', set(1)); for (const n of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(n, set(0));
    }
  }
  /* gamepad vibration: feature-detected, silent when there is no pad or the browser cannot vibrate it (see rumble.js for what to play) */
  rumble(strong, weak, ms = 100) {
    const now = performance.now(); if (now < (this.rumbleAt || 0)) return;
    const gp = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(g => g && g.connected && g.mapping === 'standard'), act = gp && (gp.vibrationActuator || (gp.hapticActuators && gp.hapticActuators[0]));
    if (!act || !act.playEffect) return; this.rumbleAt = now + ms * 0.8;
    try { const p = act.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: weak, strongMagnitude: strong }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not supported for this pad */ }
  }
  /* call once a frame; returns the merged input */
  read() {
    const i = this.input;
    if (this.locked) { i.steer = i.throttle = i.brake = i.hand = i.rev = 0; return i; }
    const k = this.k, t = this.touch; let steer = (k.right || t.right) - (k.left || t.left) + this.analog.steer, up = Math.max(k.up || t.up, this.analog.throttle), rev = k.down || t.down, brake = k.brake || t.brake, hand = k.hand || t.hand;
    const gp = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(g => g && g.connected && g.mapping === 'standard' && g.buttons.length >= 16);
    if (gp) {
      const b = n => gp.buttons[n] && gp.buttons[n].pressed, v = n => gp.buttons[n] ? gp.buttons[n].value : 0, ax = gp.axes[0] || 0, dead = x => x > 0.15 ? x : 0;
      if (Math.abs(ax) > 0.12) steer += ax; if (b(14)) steer = -1; if (b(15)) steer = 1;
      up = Math.max(up, dead(v(7)), b(12) ? 1 : 0); brake = Math.max(brake, dead(v(6))); rev = Math.max(rev, b(13) ? 1 : 0); hand = Math.max(hand, b(2) ? 1 : 0);      // RT gas, LT brake, X handbrake
      const edge = n => b(n) && !this.prev[n]; if (edge(0)) this.fire('buff'); if (edge(3)) this.fire('view'); if (edge(1)) this.fire('reset'); if (edge(9)) this.fire('pause');
      this.prev = gp.buttons.map(x => x.pressed);
    }
    i.steer = Math.max(-1, Math.min(1, steer)); i.throttle = up; i.brake = brake; i.hand = hand; i.rev = rev; return i;
  }
}

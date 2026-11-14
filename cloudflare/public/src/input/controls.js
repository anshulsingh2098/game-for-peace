/* Driving controls from keyboard, on-screen touch pads and a gamepad, merged into one input:
   { steer -1..1 (right is +), throttle 0..1, brake 0..1 }. One-shot actions arrive through on(name, fn):
   'view', 'reset', 'fly', 'pause', 'buff'. */
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
const ACTIONS = { KeyC: 'view', KeyB: 'reset', KeyF: 'fly', Escape: 'pause', Space: 'buff' };

export class Controls {
  constructor() {
    this.k = { left: 0, right: 0, up: 0, down: 0 }; this.touch = { left: 0, right: 0, up: 0, down: 0 }; this.handlers = {}; this.prev = []; this.enabled = true;
    this.input = { steer: 0, throttle: 0, brake: 0 };
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (KEYS[e.code]) { this.k[KEYS[e.code]] = 1; if (this.enabled) e.preventDefault(); }
      if (ACTIONS[e.code] && !e.repeat) { this.fire(ACTIONS[e.code]); if (e.code === 'Space' && this.enabled) e.preventDefault(); }
    });
    addEventListener('keyup', e => { if (KEYS[e.code]) this.k[KEYS[e.code]] = 0; });
    addEventListener('blur', () => { for (const n in this.k) this.k[n] = 0; for (const n in this.touch) this.touch[n] = 0; });
  }
  on(name, fn) { this.handlers[name] = fn; }
  fire(name) { if (this.handlers[name]) this.handlers[name](); }
  /* wire up elements carrying data-k="left|right|up|down" as hold-to-press pads */
  bindPads(els) {
    for (const el of els) {
      const set = d => e => { e.preventDefault(); el.classList.toggle('down', !!d); this.touch[el.dataset.k] = d; };
      el.addEventListener('pointerdown', set(1)); for (const n of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(n, set(0));
    }
  }
  /* call once a frame; returns the merged input */
  read() {
    const k = this.k, t = this.touch; let steer = (k.right || t.right) - (k.left || t.left), up = k.up || t.up, down = k.down || t.down;
    const gp = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(g => g && g.connected && g.mapping === 'standard' && g.buttons.length >= 16);
    if (gp) {
      const b = i => gp.buttons[i] && gp.buttons[i].pressed, v = i => gp.buttons[i] ? gp.buttons[i].value : 0, ax = gp.axes[0] || 0, dead = x => x > 0.15 ? x : 0;
      if (Math.abs(ax) > 0.12) steer += ax; if (b(14)) steer = -1; if (b(15)) steer = 1;
      up = Math.max(up, dead(v(7)), b(12) ? 1 : 0); down = Math.max(down, dead(v(6)), b(13) ? 1 : 0);
      const edge = i => b(i) && !this.prev[i]; if (edge(0)) this.fire('buff'); if (edge(3)) this.fire('view'); if (edge(1)) this.fire('reset'); if (edge(9)) this.fire('pause');
      this.prev = gp.buttons.map(x => x.pressed);
    }
    const i = this.input; i.steer = Math.max(-1, Math.min(1, steer)); i.throttle = up; i.brake = down; return i;
  }
}

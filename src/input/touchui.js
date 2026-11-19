/* Touch controls laid out like the owner's reference (a phone racing/vehicle game, 20 Nov 2026): for phones held in landscape (portrait works too).
   LEFT thumb: two big arrow keys stacked, UP = accelerate, DOWN = brake and reverse, and a small horn beside them.
   RIGHT thumb: two big arrow keys side by side, LEFT and RIGHT = steer; above them a row of small round buttons: HAND (handbrake, hold), BOOST, CAM, AUTO, RESET.
   Feeds Controls.touch (left, right, up, down, hand) which the vehicle reads exactly like the keys; the buttons fire the same actions as the keys.
   Built here, so next.html needs no markup; shown only on touch devices (body.touch) or with ?touch. */
const CSS = `
body.touch #pads { display: none !important; }
body.touch #hud { left: max(12px, env(safe-area-inset-left)); right: auto; top: 10px; bottom: auto; }
body.touch #autoBtn, body.touch #viewBtn, body.touch #reset { display: none; }                      /* these are small circles on the screen now */
#tui { position: fixed; inset: 0; pointer-events: none; z-index: 5; user-select: none; -webkit-user-select: none; touch-action: none; display: none; }
body.touch #tui, body.tui #tui { display: block; }
body:not([data-mode=drive]) #tui, body[data-menu] #tui { display: none !important; }
#tui .t { position: absolute; pointer-events: auto; touch-action: none; -webkit-tap-highlight-color: transparent; }
#tui .key { border-radius: 20px; border: 2px solid rgba(255, 255, 255, .55); background: rgba(8, 12, 20, .38); color: rgba(255, 255, 255, .92); display: grid; place-items: center; backdrop-filter: blur(3px); }
#tui .key svg { width: 46%; height: 46%; fill: currentColor; }
#tui .key.down { background: var(--accent, #7fd46a); color: #0b1020; border-color: transparent; }
#tui .circle { border-radius: 50%; border: 2px solid rgba(255, 255, 255, .55); background: rgba(8, 12, 20, .38); color: #fff; display: grid; place-items: center; font: 600 10px/1 system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; backdrop-filter: blur(3px); }
#tui .circle.down, #tui .circle.on { background: var(--accent, #7fd46a); color: #0b1020; border-color: transparent; }
#tui #tUp { left: max(18px, env(safe-area-inset-left)); bottom: 126px; width: 92px; height: 92px; }
#tui #tDn { left: max(18px, env(safe-area-inset-left)); bottom: 20px; width: 92px; height: 92px; }
#tui #tHorn { left: calc(max(18px, env(safe-area-inset-left)) + 106px); bottom: 66px; width: 52px; height: 52px; }
#tui #tLeft { right: calc(max(18px, env(safe-area-inset-right)) + 106px); bottom: 20px; width: 98px; height: 98px; }
#tui #tRight { right: max(18px, env(safe-area-inset-right)); bottom: 20px; width: 98px; height: 98px; }
#tui #tHand { right: max(18px, env(safe-area-inset-right)); bottom: 132px; width: 58px; height: 58px; font-size: 9px; }
#tui #tBoost { right: calc(max(18px, env(safe-area-inset-right)) + 68px); bottom: 132px; width: 58px; height: 58px; }
#tui #tCam { right: calc(max(18px, env(safe-area-inset-right)) + 136px); bottom: 132px; width: 46px; height: 46px; }
#tui #tAuto { right: calc(max(18px, env(safe-area-inset-right)) + 192px); bottom: 132px; width: 46px; height: 46px; }
#tui #tReset { right: calc(max(18px, env(safe-area-inset-right)) + 248px); bottom: 132px; width: 46px; height: 46px; }
body.touch #buff { display: none !important; }
@media (max-height: 430px) {                                              /* a phone held sideways: smaller keys so the mini-map and the speed card stay clear */
  #tui #tUp { bottom: 100px; width: 76px; height: 76px; } #tui #tDn { bottom: 16px; width: 76px; height: 76px; } #tui #tHorn { left: calc(max(18px, env(safe-area-inset-left)) + 90px); bottom: 50px; width: 46px; height: 46px; }
  #tui #tLeft { right: calc(max(18px, env(safe-area-inset-right)) + 90px); bottom: 16px; width: 82px; height: 82px; } #tui #tRight { bottom: 16px; width: 82px; height: 82px; }
  #tui #tHand, #tui #tBoost, #tui #tCam, #tui #tAuto, #tui #tReset { bottom: 108px; }
}
`;
const ARROW = { up: '<svg viewBox="0 0 24 24"><path d="M12 3 L22 19 H2 Z"/></svg>', down: '<svg viewBox="0 0 24 24"><path d="M12 21 L2 5 H22 Z"/></svg>', left: '<svg viewBox="0 0 24 24"><path d="M3 12 L19 2 V22 Z"/></svg>', right: '<svg viewBox="0 0 24 24"><path d="M21 12 L5 2 V22 Z"/></svg>' };

export class TouchUI {
  constructor(controls, getBoostLabel) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
    const root = document.createElement('div'); root.id = 'tui'; document.body.append(root); this.root = root; this.c = controls;
    const el = (tag, id, cls, html = '') => { const e = document.createElement(tag); if (id) e.id = id; e.className = cls; e.innerHTML = html; root.append(e); return e; };
    this.throttle = 0; this.setThrottle = v => { this.throttle = v; };         // kept for the callers that read it; the keys are digital now
    /* a key held while the finger is down: sets controls.touch[key] to 1 */
    const hold = (id, cls, html, key, other) => { const b = el('div', id, 't ' + cls, html);
      b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* synthetic pointers */ } b.classList.add('down'); controls.touch[key] = 1; if (other) controls.touch[other] = 0; });
      for (const n of ['pointerup', 'pointercancel']) b.addEventListener(n, () => { b.classList.remove('down'); controls.touch[key] = 0; }); return b; };
    hold('tUp', 'key', ARROW.up, 'up'); hold('tDn', 'key', ARROW.down, 'down');
    hold('tLeft', 'key', ARROW.left, 'left'); hold('tRight', 'key', ARROW.right, 'right');
    hold('tHand', 'circle', 'Hand', 'hand');
    { const h = el('div', 'tHorn', 't circle', 'Horn'), off = () => { h.classList.remove('down'); if (this.onHorn) this.onHorn(false); }; h.addEventListener('pointerdown', e => { e.preventDefault(); h.classList.add('down'); if (this.onHorn) this.onHorn(true); }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) h.addEventListener(ev, off); }
    const tap = (id, label, action) => { const b = el('div', id, 't circle', label); b.addEventListener('pointerdown', e => { e.preventDefault(); controls.fire(action); }); return b; };
    tap('tBoost', 'Boost', 'buff'); tap('tReset', 'Reset', 'reset'); tap('tCam', 'Cam', 'cam'); this.auto = tap('tAuto', 'Auto', 'auto');
  }
  setAuto(on) { this.auto.classList.toggle('on', on); }
}

/* Touch controls laid out like slowroads.io, for phones held in landscape (portrait works too):
   left: a vertical throttle slider (it stays where you leave it, like a lever), BRAKE (hold) and BOOST;
   right: a steering handle that slides along an arc and springs back to the middle, with RESET, CAM and AUTO buttons.
   Feeds Controls.analog (steer, throttle) and Controls.touch.down; the buttons fire the same actions as the keys.
   Built here, so next.html needs no markup; shown only on touch devices (body.touch) or with ?touch. */
const CSS = `
body.touch #pads { display: none !important; }
body.touch #hud { left: max(12px, env(safe-area-inset-left)); right: auto; top: 10px; bottom: auto; }
body.touch #autoBtn, body.touch #viewBtn, body.touch #reset { display: none; }                      /* these are circles on the screen now */
#tui { position: fixed; inset: 0; pointer-events: none; z-index: 5; user-select: none; -webkit-user-select: none; touch-action: none; display: none; }
body.touch #tui, body.tui #tui { display: block; }
body:not([data-mode=drive]) #tui, body[data-menu] #tui { display: none !important; }
#tui .t { position: absolute; pointer-events: auto; touch-action: none; }
#tui .circle { border-radius: 50%; border: 2px solid rgba(255, 255, 255, .55); background: rgba(8, 12, 20, .35); color: #fff; display: grid; place-items: center; font: 600 11px/1 system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; backdrop-filter: blur(3px); }
#tui .circle.down, #tui .circle.on { background: var(--accent, #7fd46a); color: #0b1020; border-color: transparent; }
#tui #tSlide { left: max(16px, env(safe-area-inset-left)); bottom: 20px; width: 64px; height: min(46vh, 280px); }
#tui #tSlide i { position: absolute; left: 31px; top: 0; bottom: 0; width: 2px; background: rgba(255, 255, 255, .35); }
#tui #tKnob { position: absolute; left: 4px; width: 56px; height: 56px; bottom: 0; }
#tui #tBrake { left: calc(max(16px, env(safe-area-inset-left)) + 84px); bottom: 20px; width: 76px; height: 76px; }
#tui #tHand { left: calc(max(16px, env(safe-area-inset-left)) + 172px); bottom: 20px; width: 58px; height: 58px; font-size: 9px; }
#tui #tRev { left: calc(max(16px, env(safe-area-inset-left)) + 172px); bottom: 90px; width: 52px; height: 52px; font-size: 10px; }
#tui #tBoost { left: calc(max(16px, env(safe-area-inset-left)) + 96px); bottom: 112px; width: 62px; height: 62px; }
#tui #tSteer { right: max(14px, env(safe-area-inset-right)); bottom: 14px; width: min(44vw, 300px); height: 120px; }
#tui #tSteer svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
#tui #tHandle { position: absolute; width: 60px; height: 60px; left: calc(50% - 30px); bottom: 20px; transition: transform .12s ease-out; }
#tui #tReset { right: max(14px, env(safe-area-inset-right)); bottom: 150px; width: 64px; height: 64px; }
#tui #tCam { right: calc(max(14px, env(safe-area-inset-right)) + 76px); bottom: 150px; width: 52px; height: 52px; }
#tui #tAuto { right: calc(max(14px, env(safe-area-inset-right)) + 140px); bottom: 150px; width: 52px; height: 52px; }
body.touch #buff { display: none !important; }
`;

export class TouchUI {
  constructor(controls, getBoostLabel) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
    const root = document.createElement('div'); root.id = 'tui'; document.body.append(root); this.root = root; this.c = controls;
    const el = (tag, id, cls, html = '') => { const e = document.createElement(tag); if (id) e.id = id; e.className = cls; e.innerHTML = html; root.append(e); return e; };

    /* throttle lever */
    const slide = el('div', 'tSlide', 't'), knob = document.createElement('div'); slide.innerHTML = '<i></i>'; knob.id = 'tKnob'; knob.className = 'circle'; slide.append(knob);
    const setThrottle = v => { v = Math.max(0, Math.min(1, v)); controls.analog.throttle = v; knob.style.bottom = (v * (slide.clientHeight - 56)) + 'px'; this.throttle = v; };
    this.setThrottle = setThrottle; setThrottle(0);
    const dragSlide = e => { const r = slide.getBoundingClientRect(); setThrottle(1 - (e.clientY - r.top - 28) / (r.height - 56)); };
    let sliding = false;
    slide.addEventListener('pointerdown', e => { e.preventDefault(); try { slide.setPointerCapture(e.pointerId); } catch (x) { /* synthetic pointers */ } sliding = true; dragSlide(e); knob.classList.add('down'); });
    slide.addEventListener('pointermove', e => { if (sliding) dragSlide(e); });
    for (const n of ['pointerup', 'pointercancel']) slide.addEventListener(n, () => { sliding = false; knob.classList.remove('down'); });

    /* buttons on the left: brake (hold) cuts the lever to zero, boost fires the vehicle's buff */
    const brake = el('div', 'tBrake', 't circle', 'Brake');
    brake.addEventListener('pointerdown', e => { e.preventDefault(); try { brake.setPointerCapture(e.pointerId); } catch (x) { /* synthetic pointers */ } brake.classList.add('down'); controls.touch.brake = 1; setThrottle(0); });
    for (const n of ['pointerup', 'pointercancel']) brake.addEventListener(n, () => { brake.classList.remove('down'); controls.touch.brake = 0; });
    const hold = (id, label, key, zeroThrottle) => { const b = el('div', id, 't circle', label);                       // hold-to-press circles: handbrake (X) and reverse (S)
      b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* synthetic pointers */ } b.classList.add('down'); controls.touch[key] = 1; if (zeroThrottle) setThrottle(0); });
      for (const n of ['pointerup', 'pointercancel']) b.addEventListener(n, () => { b.classList.remove('down'); controls.touch[key] = 0; }); return b; };
    hold('tHand', 'Hand', 'hand', false); hold('tRev', 'Rev', 'down', true);
    const boost = el('div', 'tBoost', 't circle', 'Boost'); boost.addEventListener('pointerdown', e => { e.preventDefault(); controls.fire('buff'); boost.classList.add('down'); setTimeout(() => boost.classList.remove('down'), 160); });

    /* steering handle on an arc */
    const steer = el('div', 'tSteer', 't'); steer.innerHTML = '<svg viewBox="0 0 300 120" preserveAspectRatio="none"><path d="M10 40 Q150 120 290 40" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2"/></svg>';
    const handle = document.createElement('div'); handle.id = 'tHandle'; handle.className = 'circle'; steer.append(handle);
    const setSteer = v => { v = Math.max(-1, Math.min(1, v)); controls.analog.steer = v; const R = (steer.clientWidth - 60) / 2; handle.style.transform = `translate(${v * R}px, ${-(v * v) * 26}px)`; };
    const dragSteer = e => { const r = steer.getBoundingClientRect(), R = (r.width - 60) / 2; setSteer((e.clientX - (r.left + r.width / 2)) / R); };
    let steering = false;
    steer.addEventListener('pointerdown', e => { e.preventDefault(); try { steer.setPointerCapture(e.pointerId); } catch (x) { /* synthetic pointers */ } steering = true; handle.style.transition = 'none'; handle.classList.add('down'); dragSteer(e); });
    steer.addEventListener('pointermove', e => { if (steering) dragSteer(e); });
    for (const n of ['pointerup', 'pointercancel']) steer.addEventListener(n, () => { steering = false; handle.style.transition = 'transform .12s ease-out'; handle.classList.remove('down'); setSteer(0); });

    /* buttons on the right */
    const tap = (id, label, action) => { const b = el('div', id, 't circle', label); b.addEventListener('pointerdown', e => { e.preventDefault(); controls.fire(action); }); return b; };
    tap('tReset', 'Reset', 'reset'); tap('tCam', 'Cam', 'cam'); this.auto = tap('tAuto', 'Auto', 'auto');
  }
  setAuto(on) { this.auto.classList.toggle('on', on); }
}

/* Debug fly camera for looking around the generated world before there is a vehicle in it.
   Keeps its position in world coordinates; the caller subtracts the render origin each frame.
   Keys: W A S D move, Space / E up, Q down, Shift faster, mouse wheel changes speed, drag to look.
   Touch: one finger looks, two fingers fly forward. */
export class FlyCam {
  constructor(el) {
    this.x = 0; this.y = 60; this.z = 0; this.yaw = 0; this.pitch = -0.25; this.speed = 60; this.keys = new Set(); this.touchFly = false;
    let drag = null; const pts = new Map();
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, e); drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; this.touchFly = pts.size >= 2; });
    el.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      this.yaw -= (e.clientX - drag.x) * 0.0035; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - (e.clientY - drag.y) * 0.0035)); drag.x = e.clientX; drag.y = e.clientY;
    });
    const up = e => { pts.delete(e.pointerId); if (drag && e.pointerId === drag.id) drag = null; this.touchFly = pts.size >= 2; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); this.speed = Math.max(5, Math.min(2000, this.speed * (e.deltaY > 0 ? 0.8 : 1.25))); }, { passive: false });
    addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; this.keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  /* advance by dt seconds; minY(x, z) gives the lowest allowed height at a point */
  update(dt, minY) {
    const k = this.keys, f = (k.has('KeyW') || k.has('ArrowUp') || this.touchFly ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0), s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const u = (k.has('Space') || k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0), v = this.speed * (k.has('ShiftLeft') || k.has('ShiftRight') ? 4 : 1) * dt;
    const cp = Math.cos(this.pitch), fx = -Math.sin(this.yaw) * cp, fy = Math.sin(this.pitch), fz = -Math.cos(this.yaw) * cp, rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    this.x += (fx * f + rx * s) * v; this.y += (fy * f + u) * v; this.z += (fz * f + rz * s) * v;
    const floor = minY(this.x, this.z); if (this.y < floor) this.y = floor;
  }
  /* place a three.js camera at this pose, relative to a render origin */
  apply(camera, origin) {
    camera.position.set(this.x - origin.x, this.y, this.z - origin.z); camera.rotation.order = 'YXZ'; camera.rotation.set(this.pitch, this.yaw, 0);
  }
}

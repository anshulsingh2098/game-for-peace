/* The cars close to the player are drawn with their real graphics (owner, 20 Nov 2026: "the other traffic cars load in real car graphics only when I get in them").
   A traffic car is normally one instance of a 3,000-triangle model (vehicles.js Fleet). Here the nearest few cars (at most NEAR.count, within NEAR.range metres of the player, parked ones too) that have a supplied car model are drawn as a copy of that model instead:
   the full garage model (38,000 to 110,000 triangles, loaded the first time it is needed, so until it arrives the car stays the cheap model), its body paint recoloured to the traffic car's colour on a private copy of the paint material, its wheels turning with the car's speed.
   Both numbers are settings in the tuner (traffic.near.count, traffic.near.range); 0 switches it off. Browser only (three.js). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VEHICLES } from '../../vehicle/defs.js';

export const NEAR = { count: 5, range: 32, parked: 1 };
/* traffic kind -> garage car whose full model replaces it */
export const FULL = { 'maruti-800': 'maruti', 'figo-hatch': 'figo', 'aspire-hatch': 'aspire', 'aspire-taxi': 'aspire', 'sx4-hatch': 'sx4', 'endeavour-suv': 'everest', 'gtr-sports': 'r35' };

export class NearCars {
  constructor(parent) { this.group = new THREE.Group(); parent.add(this.group); this.src = new Map(); this.pool = new Map(); this.dt = 0.016; }
  /* the full model of this kind if it has loaded (loading starts the first time it is asked for), else null */
  ensure(kind) {
    const id = FULL[kind]; if (!id) return null; let s = this.src.get(id);
    if (s === undefined) { s = { scene: null, failed: false }; this.src.set(id, s); const def = VEHICLES.find(v => v.id === id); if (!def) { s.failed = true; return null; } new GLTFLoader().loadAsync(def.file).then(g => { s.scene = g.scene; }).catch(() => { s.failed = true; }); }
    return s.scene ? s : null;
  }
  begin(dt) { this.dt = dt || 0.016; for (const l of this.pool.values()) for (const sl of l) sl.used = false; }
  /* one car: returns true when it was drawn as a full model (so the caller skips its cheap instance) */
  add(kind, x, y, z, yaw, hex, v) {
    const s = this.ensure(kind); if (!s) return false; let l = this.pool.get(kind); if (!l) this.pool.set(kind, l = []);
    let sl = l.find(q => !q.used); if (!sl) { if (l.length >= Math.max(1, NEAR.count)) return false; sl = this.make(s); l.push(sl); }
    sl.used = true; sl.obj.visible = true; sl.obj.position.set(x, y, z); sl.obj.rotation.y = -yaw + Math.PI / 2;
    if (sl.hex !== hex) { sl.hex = hex; for (const m of sl.paint) m.color.setHex(hex); }
    sl.spin += (v || 0) * this.dt / 0.33; for (const w of sl.wheels) w.rotation.x = sl.spin;
    return true;
  }
  make(s) {
    const obj = s.scene.clone(true), paint = [], wheels = [];
    obj.traverse(o => { if (/^Wheel_/.test(o.name) && !o.isMesh) { o.rotation.order = 'YXZ'; wheels.push(o); } if (!o.isMesh) return; o.castShadow = true; o.frustumCulled = true;
      const list = [].concat(o.material).map(m => { if (m && m.name === 'Paint_Body') { const c = m.clone(); paint.push(c); return c; } return m; }); o.material = Array.isArray(o.material) ? list : list[0]; });
    this.group.add(obj); return { obj, paint, wheels, hex: -1, used: false, spin: 0 };
  }
  end() { for (const l of this.pool.values()) for (const sl of l) if (!sl.used) sl.obj.visible = false; }
}

/* Signal heads at junctions where several roads cross (traffic/junction.js): one pole on the roadside before the crossing for each direction of each road, facing the cars that come to it,
   with a red, an amber and a green lamp that follow the junction's signal for that road. Positions are world metres; the group follows the render origin. */
import * as THREE from 'three';

const ON = { red: 0xff3030, amber: 0xffb020, green: 0x30ff70 }, OFF = { red: 0x3a1010, amber: 0x3a2a08, green: 0x0f3a1c };
export class JunctionSignals {
  constructor(scene, origin) { this.origin = origin; this.group = new THREE.Group(); scene.add(this.group); this.items = new Map(); this.steel = new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.6, metalness: 0.4 }); this.box = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.7 }); this.plaza = new THREE.MeshLambertMaterial({ color: 0x6a6762, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 }); this.geo = { disc: new THREE.CircleGeometry(11, 40).rotateX(-Math.PI / 2), pole: new THREE.BoxGeometry(0.2, 5, 0.2), head: new THREE.BoxGeometry(0.5, 1.4, 0.4), lamp: new THREE.CircleGeometry(0.17, 12) }; }
  add(junction) {
    const items = [], p = {};
    const disc = new THREE.Mesh(this.geo.disc, this.plaza); disc.position.set(junction.x, junction.y + 0.04, junction.z); disc.renderOrder = 2; this.group.add(disc);                       // a patch of asphalt over the crossing, so the lane paint of one road does not run across the others
    for (const arm of junction.arms) for (const dir of [1, -1]) {
      const R = arm.road, st = R.style, sim = arm.sim, side = Math.sign(sim.lateral(dir, 0)) || 1, lat = side * (st.shoulder + 1.3), sA = arm.s - dir * 13; if (sA < R.sMin + 5 || sA > R.sMax - 5) continue;
      R.at(sA, p); const x = p.x - p.tz * lat, z = p.z + p.tx * lat, vx = dir > 0 ? -p.tx : p.tx, vz = dir > 0 ? -p.tz : p.tz, th = Math.atan2(vx, vz);
      const g = new THREE.Group(); g.position.set(x, p.y, z); g.rotation.y = th; const pole = new THREE.Mesh(this.geo.pole, this.steel); pole.position.y = 2.5; g.add(pole); const head = new THREE.Mesh(this.geo.head, this.box); head.position.set(0, 5.3, 0); g.add(head);
      const lamps = {}; ['red', 'amber', 'green'].forEach((k, i) => { const m = new THREE.Mesh(this.geo.lamp, new THREE.MeshBasicMaterial({ color: OFF[k] })); m.position.set(0, 5.75 - i * 0.45, 0.205); g.add(m); lamps[k] = m; });
      this.group.add(g); items.push({ arm, lamps, last: '' });
    }
    this.items.set(junction, items); junction.disc = disc; return items.length;
  }
  remove(junction) { const items = this.items.get(junction); if (!items) return; if (junction.disc) { this.group.remove(junction.disc); junction.disc = null; } for (const it of items) { const g = it.lamps.red.parent; this.group.remove(g); for (const k in it.lamps) it.lamps[k].material.dispose(); } this.items.delete(junction); }
  /* call every frame */
  update() {
    this.group.position.set(-this.origin.x, 0, -this.origin.z);
    for (const [j, items] of this.items) for (const it of items) { const st = j.state(it.arm); if (st === it.last) continue; it.last = st; for (const k in it.lamps) it.lamps[k].material.color.setHex(k === st ? ON[k] : OFF[k]); }
  }
  dispose() { for (const j of [...this.items.keys()]) this.remove(j); this.group.parent && this.group.parent.remove(this.group); for (const g of Object.values(this.geo)) g.dispose(); this.steel.dispose(); this.box.dispose(); this.plaza.dispose(); }
}

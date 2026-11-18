/* Live signal heads (owner, 20 Nov 2026: "live signal heads"). The mast-arm signals of tilemesh.js (`mastArm`) are built with dark housings; their three lenses are NOT meshed there but handed over as lamp records, and drawn here as ONE instanced mesh of small round lamps whose colours are updated every 0.2 s from the same rule the cars obey (citytraffic.js `green`): a signal is green for one axis (0 = east-west, 1 = north-south) for 14 s, then the other axis has it, offset per junction by `node * 7 % 28` seconds. The cars know no amber; the heads show amber for the last 2.5 s of a green slot (the cars still treat it as green), so a head never shows green while the cars are stopped.
   A lamp record is [x, y, z, node, tx, tz, kind]: world metres, the node id, (tx, tz) the road direction pointing away from the node (the lamp faces that way, toward the arriving driver), kind 0 red, 1 amber, 2 green. Pure state logic is exported (`signalPhase`, `lampLit`) so tools/selftest.mjs checks it without three.js. */
import * as THREE from 'three';

export const SLOT = 14, AMBER = 2.5;
/* what a signal shows to the traffic of an axis at `time`: 'green', 'amber' or 'red' (same slots as citytraffic.js green()) */
export function signalPhase(time, node, tx, tz) {
  const axis = Math.abs(tx) > Math.abs(tz) ? 0 : 1, u = time + (node * 7 % 28), slot = Math.floor(u / SLOT), within = u - slot * SLOT;
  if (slot % 2 !== axis) return 'red';
  return within >= SLOT - AMBER ? 'amber' : 'green';
}
export const lampLit = (state, kind) => (kind === 0 && state === 'red') || (kind === 1 && state === 'amber') || (kind === 2 && state === 'green');

const BRIGHT = [new THREE.Color(0xff2a18), new THREE.Color(0xffb41a), new THREE.Color(0x22ff66)], DIM = [new THREE.Color(0x2c1210), new THREE.Color(0x2e2410), new THREE.Color(0x0f2a18)];
const CAP = 8192;

export class SignalHeads {
  constructor(group) {
    this.group = group; this.tiles = new Map(); this.dirty = false; this.acc = 0; this.n = 0; this.lamps = [];
    const geo = new THREE.CircleGeometry(0.1, 8), mat = new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, CAP); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.matrixAutoUpdate = false; this.mesh.renderOrder = 2; this.mesh.userData.near = true;
    this.mesh.setColorAt(0, DIM[0]); group.add(this.mesh);
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1); this.up = new THREE.Vector3(0, 1, 0);
  }
  addTile(key, lamps) { if (lamps && lamps.length) { this.tiles.set(key, lamps); this.dirty = true; } }
  removeTile(key) { if (this.tiles.delete(key)) this.dirty = true; }
  reposition(origin) { this.mesh.position.set(-origin.x, 0, -origin.z); this.mesh.updateMatrix(); }
  /* the instance matrices, rebuilt only when a tile arrives or leaves */
  rebuild() {
    this.lamps = []; for (const l of this.tiles.values()) for (let i = 0; i < l.length; i += 7) { if (this.lamps.length / 7 >= CAP) break; this.lamps.push(l[i], l[i + 1], l[i + 2], l[i + 3], l[i + 4], l[i + 5], l[i + 6]); }
    const L = this.lamps, n = L.length / 7; this.n = n; this.mesh.count = n;
    for (let i = 0; i < n; i++) { const o = i * 7, yaw = Math.atan2(L[o + 4], L[o + 5]); this.q.setFromAxisAngle(this.up, yaw); this.v.set(L[o], L[o + 1], L[o + 2]); this.m4.compose(this.v, this.q, this.s); this.mesh.setMatrixAt(i, this.m4); }
    this.mesh.instanceMatrix.needsUpdate = true; this.dirty = false; this.acc = 1;                         // colour at once
  }
  /* call every frame with the traffic's clock (seconds) */
  update(dt, time) {
    if (this.dirty) this.rebuild(); this.acc += dt; if (this.acc < 0.2 || !this.n) return; this.acc = 0;
    const L = this.lamps; for (let i = 0; i < this.n; i++) { const o = i * 7, st = signalPhase(time, L[o + 3], L[o + 4], L[o + 5]), k = L[o + 6]; this.mesh.setColorAt(i, lampLit(st, k) ? BRIGHT[k] : DIM[k]); }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose() { this.group.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

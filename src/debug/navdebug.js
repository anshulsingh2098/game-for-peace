/* Navigation debug view (?nav): draws the loaded navigation graph over the world. Blue and orange: lanes going with and against the road's distance; purple: lane changes;
   green: sidewalks; yellow: crossings (red where signalled); white posts: stop lines before a signalled crossing. Rebuilt only when the graph changes or the render origin moves. */
import * as THREE from 'three';
export class NavDebug {
  constructor(scene) { this.scene = scene; this.group = new THREE.Group(); this.group.renderOrder = 999; scene.add(this.group); this.version = -1; this.ox = NaN; this.oz = NaN; this.lines = null; }
  update(nav, origin) {
    const g = nav.graph; if (g.version === this.version && origin.x === this.ox && origin.z === this.oz) return; this.version = g.version; this.ox = origin.x; this.oz = origin.z; this.clear();
    const pos = [], col = [], push = (a, b, c) => { pos.push(a.x - origin.x, a.y + 0.5, a.z - origin.z, b.x - origin.x, b.y + 0.5, b.z - origin.z); col.push(...c, ...c); };
    const C = { f: [0.2, 0.6, 1], b: [1, 0.6, 0.15], lane: [0.7, 0.3, 1], walk: [0.2, 1, 0.4], cross: [1, 0.95, 0.2], sig: [1, 0.2, 0.2] };
    for (const e of g.edges.values()) { const A = g.node(e.a), B = g.node(e.b); if (!A || !B) continue; const c = e.kind === 'drive' ? (A.dir > 0 ? C.f : C.b) : e.kind === 'lane' ? C.lane : e.kind === 'walk' ? C.walk : e.signal ? C.sig : C.cross; push(A, B, c); }
    for (const n of g.nodes.values()) if (n.stopFor) push(n, { x: n.x, y: n.y + 2.5, z: n.z }, [1, 1, 1]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true })); this.lines.frustumCulled = false; this.group.add(this.lines);
  }
  clear() { if (this.lines) { this.group.remove(this.lines); this.lines.geometry.dispose(); this.lines.material.dispose(); this.lines = null; } }
  dispose() { this.clear(); this.scene.remove(this.group); }
}

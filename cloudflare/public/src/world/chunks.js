/* The tile grid: square terrain tiles kept in rings around the player.
   - Level of detail: near rings use fine tiles, far rings coarse ones (view.rings).
   - Chunk cycling: tiles that fall out of range go back to a pool and their buffers are refilled for new ground.
   - Build budget: only a few milliseconds of tile building per frame, nearest first.
   - Floating origin: tiles are drawn relative to a render origin that is moved to stay near the player,
     so numbers on the graphics card stay small however far you travel. World coordinates stay exact in JS. */
import * as THREE from 'three';
import { fillTile, tileIndex, vertexCount } from './tiledata.js';

export class TileGrid {
  constructor(scene, terrain, view, material) {
    this.terrain = terrain; this.view = view; this.material = material; this.size = view.tile;
    this.tiles = new Map(); this.pool = new Map(); this.index = new Map(); this.queue = [];
    this.inner = view.inner ?? -1; this.sink = view.sink || 0;          // far grids skip the tiles the near grid covers, and sit a little low so they never poke through it
    this.origin = { x: 0, z: 0 }; this.ptx = NaN; this.ptz = NaN; this.dirty = true; this.built = 0;
    this.group = new THREE.Group(); scene.add(this.group);
  }
  get outer() { return this.view.rings[this.view.rings.length - 1].r; }
  lodFor(d) { const R = this.view.rings; for (let i = 0; i < R.length; i++) if (d <= R[i].r) return i; return -1; }

  /* call every frame with the player's world position */
  update(px, pz) {
    const S = this.size, ptx = Math.floor(px / S), ptz = Math.floor(pz / S);
    if (ptx !== this.ptx || ptz !== this.ptz || this.dirty) { this.ptx = ptx; this.ptz = ptz; this.dirty = false; this.plan(); }
    const t0 = performance.now();
    while (this.queue.length) { this.build(this.queue.shift()); if (performance.now() - t0 > this.view.budgetMs) break; }
  }
  /* decide which tiles should exist and at what detail; queue the missing or wrong-detail ones, nearest first */
  plan() {
    const R = this.outer, { ptx, ptz } = this;
    for (const [k, t] of this.tiles) { const d = Math.max(Math.abs(t.tx - ptx), Math.abs(t.tz - ptz)); if (d > R + 1 || d <= this.inner) { this.release(t.mesh); this.tiles.delete(k); } }
    this.queue.length = 0;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dz)); if (d <= this.inner) continue;
      const lod = this.lodFor(d), tx = ptx + dx, tz = ptz + dz, t = this.tiles.get(tx + ',' + tz);
      if (!t || t.lod !== lod) this.queue.push({ tx, tz, lod, d: d + (t ? 0.5 : 0) });      // holes before upgrades at the same distance
    }
    this.queue.sort((a, b) => a.d - b.d);
  }
  build(w) {
    const S = this.size, res = this.view.rings[w.lod].res, mesh = this.acquire(res), g = mesh.geometry, a = g.attributes;
    const info = fillTile(this.terrain, w.tx * S, w.tz * S, S, res, a.position.array, a.normal.array, a.color.array, a.uv.array);
    a.position.needsUpdate = a.normal.needsUpdate = a.color.needsUpdate = a.uv.needsUpdate = true;
    const cy = (info.minY + info.maxY) / 2, hy = (info.maxY - info.minY) / 2;
    g.boundingSphere.center.set(S / 2, cy, S / 2); g.boundingSphere.radius = Math.hypot(S * 0.7072, hy);
    mesh.position.set(w.tx * S - this.origin.x, -this.sink, w.tz * S - this.origin.z); mesh.visible = true;
    const k = w.tx + ',' + w.tz, old = this.tiles.get(k); if (old) this.release(old.mesh);      // the old tile stays on screen until its replacement is ready
    this.tiles.set(k, { tx: w.tx, tz: w.tz, lod: w.lod, mesh }); this.built++;
  }
  acquire(res) {
    const free = this.pool.get(res); if (free && free.length) return free.pop();
    const n = vertexCount(res), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    let idx = this.index.get(res); if (!idx) { idx = new THREE.BufferAttribute(tileIndex(res), 1); this.index.set(res, idx); }
    g.setIndex(idx); g.boundingSphere = new THREE.Sphere();
    const mesh = new THREE.Mesh(g, this.material); mesh.receiveShadow = true; mesh.userData.res = res; this.group.add(mesh); return mesh;
  }
  release(mesh) { mesh.visible = false; const res = mesh.userData.res; let free = this.pool.get(res); if (!free) this.pool.set(res, free = []); free.push(mesh); }

  /* move the render origin next to the player when they have drifted far from it. Returns true if it moved. */
  rebase(px, pz) {
    const o = this.origin, lim = this.view.rebase; if (Math.abs(px - o.x) < lim && Math.abs(pz - o.z) < lim) return false;
    const S = this.size; o.x = Math.floor(px / S) * S; o.z = Math.floor(pz / S) * S; this.reposition();
    return true;
  }
  /* put every tile back in place after the origin moved (also used by a grid that shares another grid's origin) */
  reposition() { const S = this.size, o = this.origin; for (const t of this.tiles.values()) t.mesh.position.set(t.tx * S - o.x, -this.sink, t.tz * S - o.z); }
  /* rebuild the tiles touching a world-space box (the road was extended through ground that was already built) */
  invalidate(box) {
    const S = this.size, pad = 50; let hit = false;
    for (const t of this.tiles.values()) if (t.tx * S < box.maxX + pad && (t.tx + 1) * S > box.minX - pad && t.tz * S < box.maxZ + pad && (t.tz + 1) * S > box.minZ - pad) { t.lod = -1; hit = true; }
    if (hit) this.dirty = true;
  }
  /* throw every tile away and start again (new seed, new settings) */
  reset(terrain, view) {
    for (const t of this.tiles.values()) this.release(t.mesh); this.tiles.clear(); this.queue.length = 0;
    if (terrain) this.terrain = terrain; if (view) { this.view = view; this.inner = view.inner ?? -1; this.sink = view.sink || 0; } this.dirty = true;
  }
  stats() {
    const lod = this.view.rings.map(() => 0); for (const t of this.tiles.values()) if (t.lod >= 0) lod[t.lod]++;
    let pooled = 0; for (const f of this.pool.values()) pooled += f.length;
    return { tiles: this.tiles.size, lod, queue: this.queue.length, pooled, built: this.built };
  }
}

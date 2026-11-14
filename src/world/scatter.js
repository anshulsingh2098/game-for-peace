/* Scenery: trees, rocks, bushes and grass placed per terrain tile and drawn as instances.
   Placement is a pure function of the seed and the tile, so a place always grows the same trees.
   Tiles out to `near` get everything; tiles out to `far` get only trees and rocks.
   Each tile also keeps collision circles {x, z, r} (world coordinates) for trees and rocks. */
import * as THREE from 'three';
import { alea } from '../core/rng.js';
import { propGeometry } from './props.js';

const q = new THREE.Quaternion(), e = new THREE.Euler(), M = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3(), col = new THREE.Color();

export class Scatter {
  constructor(scene, terrain, config, origin) {
    this.terrain = terrain; this.config = config; this.origin = origin; this.size = config.view.tile; this.props = propGeometry();
    this.tiles = new Map(); this.queue = []; this.ptx = NaN; this.ptz = NaN; this.dirty = true; this.count = 0;
    this.group = new THREE.Group(); scene.add(this.group);
  }
  update(px, pz) {
    const Sz = this.size, ptx = Math.floor(px / Sz), ptz = Math.floor(pz / Sz), v = this.config.view.scenery;
    if (ptx !== this.ptx || ptz !== this.ptz || this.dirty) {
      this.ptx = ptx; this.ptz = ptz; this.dirty = false;
      for (const [k, t] of this.tiles) if (Math.max(Math.abs(t.tx - ptx), Math.abs(t.tz - ptz)) > v.far + 1) { this.drop(t); this.tiles.delete(k); }
      this.queue.length = 0;
      for (let dz = -v.far; dz <= v.far; dz++) for (let dx = -v.far; dx <= v.far; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dz)), full = d <= v.near, tx = ptx + dx, tz = ptz + dz, t = this.tiles.get(tx + ',' + tz);
        if (!t || t.full !== full) this.queue.push({ tx, tz, full, d });
      }
      this.queue.sort((a, b) => a.d - b.d);
    }
    const t0 = performance.now();
    while (this.queue.length) { const w = this.queue.shift(), k = w.tx + ',' + w.tz, old = this.tiles.get(k); if (old) this.drop(old); this.tiles.set(k, this.build(w)); if (performance.now() - t0 > 2.5) break; }
  }
  build({ tx, tz, full }) {
    const T = this.terrain, c = this.config.scatter, pal = this.config.palette, Sz = this.size, x0 = tx * Sz, z0 = tz * Sz, sea = T.seaLevel, dens = this.config.view.scenery.density, road = T.road;
    const lists = { pine: [], round: [], rock: [], bush: [], tuft: [] }, hits = [];
    const clear = (x, z, m) => !(road && road.nearest(x, z) && road.hit.d < m) && !T.inZone(x, z, 3);
    const R = alea(this.config.seed, 'trees', tx, tz);
    for (let n = Math.round(c.trees * Sz * Sz * dens); n > 0; n--) {
      const x = x0 + R() * Sz, z = z0 + R() * Sz, keep = R(), kind = R(), sc = 0.75 + R() * 0.85, rot = R() * 6.28, tall = 0.9 + R() * 0.3, shade = R();
      if (keep > T.forest(x, z) * 1.15 - 0.1 || !clear(x, z, c.clearRoad)) continue;
      const h = T.height(x, z), up = h - sea; if (up < 3 || up > pal.treeline + 25) continue;
      if (Math.abs(T.height(x + 3, z) - h) > 1.8 || Math.abs(T.height(x, z + 3) - h) > 1.8) continue;        // too steep for a tree
      const pine = kind < 0.2 + 0.75 * Math.min(1, up / pal.treeline) + (c.pineBias || 0);                                    // more pines with altitude
      lists[pine ? 'pine' : 'round'].push([x - x0, h - 0.15, z - z0, sc, rot, tall, shade]); hits.push({ x, z, r: 0.4 * sc });
    }
    for (let n = Math.round(c.rocks * Sz * Sz * dens); n > 0; n--) {
      const x = x0 + R() * Sz, z = z0 + R() * Sz, sc = 0.5 + R() * 1.9, rot = R() * 6.28, squash = 0.55 + R() * 0.5, shade = R();
      if (!clear(x, z, c.clearRoad - 2)) continue; const h = T.height(x, z); if (h < sea - 1) continue;
      lists.rock.push([x - x0, h + 0.1, z - z0, sc, rot, squash, shade]); hits.push({ x, z, r: 0.9 * sc });
    }
    if (full) {
      const D = alea(this.config.seed, 'undergrowth', tx, tz);
      for (let n = Math.round(c.bushes * Sz * Sz * dens); n > 0; n--) {
        const x = x0 + D() * Sz, z = z0 + D() * Sz, sc = 0.6 + D() * 0.9, rot = D() * 6.28, tall = 0.8 + D() * 0.5, shade = D();
        if (!clear(x, z, 7)) continue; const h = T.height(x, z), up = h - sea; if (up < 2.5 || up > pal.treeline) continue;
        lists.bush.push([x - x0, h - 0.05, z - z0, sc, rot, tall, shade]);
      }
      for (let n = Math.round(c.tufts * Sz * Sz * dens); n > 0; n--) {
        const x = x0 + D() * Sz, z = z0 + D() * Sz, sc = 0.42 + D() * 0.6, rot = D() * 6.28, tall = 0.8 + D() * 0.5, shade = D();
        if (!clear(x, z, 5.6)) continue; const h = T.height(x, z), up = h - sea; if (up < 2.5 || up > pal.treeline + 40) continue;
        lists.tuft.push([x - x0, h - 0.02, z - z0, sc, rot, tall, shade]);
      }
    }
    const g = new THREE.Group(), pr = this.props, tint = c.tint; let count = 0;
    const fill = (geom, mat, arr, jitter) => {
      const im = new THREE.InstancedMesh(geom, mat, arr.length);
      arr.forEach((a, n) => {
        P.set(a[0], a[1], a[2]); q.setFromEuler(e.set(0, a[4], 0)); S.set(a[3], a[3] * a[5], a[3]); im.setMatrixAt(n, M.compose(P, q, S));
        const v = 0.80 + a[6] * 0.4; if (jitter) col.setRGB(v, v * (0.94 + a[6] * 0.12), v * (0.92 + a[6] * 0.1)); else col.setRGB(1, 1, 1);
        if (jitter && tint && mat !== pr.solid) col.setRGB(col.r * tint[0], col.g * tint[1], col.b * tint[2]);            // a place's leaves lean greener, yellower or drier
        im.setColorAt(n, col);
      });
      im.castShadow = true; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); g.add(im); count += arr.length;
    };
    for (const k of ['pine', 'round']) if (lists[k].length) { fill(pr[k].trunk, pr.solid, lists[k], false); fill(pr[k].foliage, pr[k].mat, lists[k], true); count -= lists[k].length; }
    for (const k of ['bush', 'tuft']) if (lists[k].length) fill(pr[k].foliage, pr[k].mat, lists[k], true);
    if (lists.rock.length) fill(pr.rock, pr.solid, lists.rock, true);
    g.position.set(x0 - this.origin.x, 0, z0 - this.origin.z); this.group.add(g); this.count += count;
    return { tx, tz, full, g, hits, count };
  }
  drop(t) { this.group.remove(t.g); for (const m of t.g.children) m.dispose(); this.count -= t.count; }
  reposition() { const Sz = this.size; for (const t of this.tiles.values()) t.g.position.set(t.tx * Sz - this.origin.x, 0, t.tz * Sz - this.origin.z); }
  /* collision circles of the tile containing a world point (trees and rocks) */
  colliders(x, z) { const t = this.tiles.get(Math.floor(x / this.size) + ',' + Math.floor(z / this.size)); return t ? t.hits : []; }
  /* collision circle lists of every tile within r of a world point */
  near(x, z, r) {
    const S = this.size, out = this._near || (this._near = []); out.length = 0;
    for (let tz = Math.floor((z - r) / S); tz <= Math.floor((z + r) / S); tz++) for (let tx = Math.floor((x - r) / S); tx <= Math.floor((x + r) / S); tx++) { const t = this.tiles.get(tx + ',' + tz); if (t && t.hits.length) out.push(t.hits); }
    return out;
  }
  dispose() { for (const t of this.tiles.values()) this.drop(t); this.tiles.clear(); this.group.parent && this.group.parent.remove(this.group); }
  stats() { return { tiles: this.tiles.size, things: this.count, queue: this.queue.length }; }
}

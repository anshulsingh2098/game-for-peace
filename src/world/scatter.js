/* Scenery: trees, rocks, bushes and grass placed per terrain tile and drawn as instances.
   Placement is a pure function of the seed and the tile, so a place always grows the same trees.
   Tiles out to `near` get everything; tiles out to `far` get only trees and rocks.
   Each tile also keeps collision circles {x, z, r} (world coordinates) for trees and rocks. */
import * as THREE from 'three';
import { alea } from '../core/rng.js';
import { propGeometry } from './props.js';

/* plant cards cast leaf-shaped shadows: the depth material used for shadows must cut out the transparent parts of the card, or every card casts a solid rectangle */
const depthCache = new WeakMap();
const shadowMat = mat => { if (!mat.map || !mat.alphaTest) return null; let d = depthCache.get(mat); if (!d) { d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mat.map, alphaTest: mat.alphaTest }); depthCache.set(mat, d); } return d; };
const q = new THREE.Quaternion(), e = new THREE.Euler(), M = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3(), col = new THREE.Color();

export class Scatter {
  constructor(scene, terrain, config, origin) {
    this.terrain = terrain; this.config = config; this.origin = origin; this.size = config.view.tile; this.props = propGeometry();
    this.tiles = new Map(); this.queue = []; this.ptx = NaN; this.ptz = NaN; this.dirty = true; this.count = 0;
    this.group = new THREE.Group(); scene.add(this.group);
    if (terrain.keepout) { this._ko = bb => this.invalidateBox(bb); terrain.keepout.listeners.push(this._ko); }       // new ground claimed (a rail, a plot): trees already planted there are replanted
  }
  invalidateBox(bb) { const Sz = this.size; for (let i = Math.floor(bb[0] / Sz); i <= Math.floor(bb[2] / Sz); i++) for (let j = Math.floor(bb[1] / Sz); j <= Math.floor(bb[3] / Sz); j++) { const k = i + ',' + j, t = this.tiles.get(k); if (t) { this.drop(t); this.tiles.delete(k); this.dirty = true; } } }
  /* swap in the real-scan models (world/nature.js) and rebuild every tile with them */
  setProps(patch) { this.nature = patch; for (const t of this.tiles.values()) this.drop(t); this.tiles.clear(); this.queue.length = 0; this.dirty = true; }
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
    const wide = road ? Math.max(0, road.style.clear - 10) : 0;                 // wider roads keep more room clear (two-lane: 0)
    const ko = T.keepout, clear = (x, z, m) => !(road && road.nearest(x, z) && road.hit.d < m + wide) && !T.inZone(x, z, 3) && !(ko && ko.point(x, z, 1.5, { as: 'scenery' }));          // not on a road, rail, station, landmark or building (keepout.js)
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
        if (!clear(x, z, 7)) continue; const cvB = T.cover ? T.cover(x, z) : null; if (cvB && D() < cvB.bare * 0.95 + cvB.built * 0.85) continue; const h = T.height(x, z), up = h - sea; if (up < 2.5 || up > pal.treeline) continue;
        lists.bush.push([x - x0, h - 0.05, z - z0, sc, rot, tall, shade]);
      }
      for (let n = Math.round(c.tufts * Sz * Sz * dens); n > 0; n--) {
        const x = x0 + D() * Sz, z = z0 + D() * Sz, sc = 0.42 + D() * 0.6, rot = D() * 6.28, tall = 0.8 + D() * 0.5, shade = D();
        if (!clear(x, z, 5.6)) continue; const cvT = T.cover ? T.cover(x, z) : null; if (cvT && D() < cvT.bare * 0.9 + cvT.built * 0.8) continue; const h = T.height(x, z), up = h - sea; if (up < 2.5 || up > pal.treeline + 40) continue;
        lists.tuft.push([x - x0, h - 0.02, z - z0, sc, rot, tall, shade]);
      }
    }
    const g = new THREE.Group(), pr = this.props, tint = (T.regionTint && T.regionTint(x0 + Sz / 2, z0 + Sz / 2)) || c.tint; let count = 0;
    const fill = (geom, mat, arr, jitter, vt) => {
      const im = new THREE.InstancedMesh(geom, mat, arr.length);
      arr.forEach((a, n) => {
        P.set(a[0], a[1], a[2]); q.setFromEuler(e.set(0, a[4], 0)); S.set(a[3], a[3] * a[5], a[3]); im.setMatrixAt(n, M.compose(P, q, S));
        const v = 0.80 + a[6] * 0.4; if (jitter) col.setRGB(v, v * (0.94 + a[6] * 0.12), v * (0.92 + a[6] * 0.1)); else col.setRGB(1, 1, 1);
        if (jitter && tint && mat !== pr.solid) col.setRGB(col.r * tint[0], col.g * tint[1], col.b * tint[2]);            // a place's leaves lean greener, yellower or drier
        if (jitter && vt) col.setRGB(col.r * vt[0], col.g * vt[1], col.b * vt[2]);                                    // this variant's own colour (a yellower birch, an autumn oak)
        im.setColorAt(n, col);
      });
      im.castShadow = c.shadows !== false; const sm = shadowMat(mat); if (sm) im.customDepthMaterial = sm; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); g.add(im); count += arr.length;
    };
    const nat = this.nature, defs = k => nat && nat[k] && nat[k].length ? nat[k] : [pr[k]];                   // real-scan variants when loaded, else the drawn model
    /* variants are not scattered at random: slow patches across the land favour one kind (a stand of birch, a clump of dark fir), mixed with some chance, as in real woods. Each variant has a weight w (rare ones are small) */
    const cl = (x, z) => 0.5 + 0.5 * Math.sin(x * 0.011 + 1.3 + Math.sin(z * 0.017) * 1.6) * Math.cos(z * 0.0127 - 0.7 + Math.sin(x * 0.009) * 1.4);
    const variants = (k, f) => {
      const all = defs(k), n = all.length; if (n < 2) { if (lists[k].length) f(all[0], lists[k]); return; }
      const tw = all.reduce((sum, d) => sum + (d.w || 1), 0), subs = all.map(() => []);
      for (const a of lists[k]) { const c = Math.max(0, Math.min(0.999, (cl(a[0] + x0, a[2] + z0) - 0.5) * 1.7 + 0.5)); let u = (0.7 * c + 0.3 * a[6] * 0.999) * tw, i = 0; while (i < n - 1 && u >= (all[i].w || 1)) { u -= all[i].w || 1; i++; } subs[i].push(a); }
      all.forEach((d, i) => { if (subs[i].length) f(d, subs[i]); });
    };
    for (const k of ['pine', 'round']) if (lists[k].length) variants(k, (d, sub) => { if (d.trunk) { fill(d.trunk, pr.solid, sub, false); fill(d.foliage, d.mat, sub, true, d.tint); count -= sub.length; } else fill(d.foliage, d.mat, sub, true, d.tint); });
    for (const k of ['bush', 'tuft']) if (lists[k].length) variants(k, (d, sub) => fill(d.foliage, d.mat, sub, true, d.tint));
    if (lists.rock.length) { if (full && nat && nat.rock && nat.rock.length) nat.rock.forEach((d, vi) => { const sub = lists.rock.filter((_, i) => i % nat.rock.length === vi); if (sub.length) fill(d.geom, d.mat, sub, true); }); else fill(pr.rock, pr.solid, lists.rock, true); }
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
  dispose() { if (this._ko) { const L = this.terrain.keepout.listeners, i = L.indexOf(this._ko); if (i >= 0) L.splice(i, 1); } for (const t of this.tiles.values()) this.drop(t); this.tiles.clear(); this.group.parent && this.group.parent.remove(this.group); }
  stats() { return { tiles: this.tiles.size, things: this.count, queue: this.queue.length }; }
}

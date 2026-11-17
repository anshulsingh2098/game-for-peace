/* A small dependency-free reader for OpenStreetMap .osm.pbf files (build time only; used by tools/build_city.mjs).
   Usage: await readPbf(path, { node(id, lat, lon, tags|null), way(id, refs[], tags), relation(id, members[{type,ref,role}], tags) }, { skip: { nodes, ways, relations } })
   Callbacks run in file order (nodes, then ways, then relations, as in every planet or Geofabrik file). Tags are plain objects. Lat and lon are degrees.
   Only what the pack needs is decoded: dense nodes, ways, relations; no history, no visible flags. Numbers above 2^53 never occur in OSM ids. */
import { openSync, readSync, closeSync, fstatSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

class Reader {
  constructor(buf, pos = 0, end = buf.length) { this.b = buf; this.p = pos; this.end = end; }
  varint() { // unsigned, up to 2^53 exactly (higher bits are dropped; they never occur for the fields we read, except negative int32 which we treat below)
    let r = 0, m = 1, c; const b = this.b;
    do { c = b[this.p++]; r += (c & 0x7f) * m; m *= 128; } while (c & 0x80);
    return r;
  }
  svarint() { const n = this.varint(); return n % 2 ? -(n + 1) / 2 : n / 2; }
  skip(wt) { if (wt === 0) this.varint(); else if (wt === 1) this.p += 8; else if (wt === 2) { const l = this.varint(); this.p += l; } else if (wt === 5) this.p += 4; else throw new Error('bad wire type ' + wt); }
  bytes() { const l = this.varint(), s = this.p; this.p += l; return [s, s + l]; }
  packed(signed, out = []) { const [s, e] = this.bytes(); const r = new Reader(this.b, s, e); while (r.p < e) out.push(signed ? r.svarint() : r.varint()); return out; }
}
const utf8 = (b, s, e) => b.toString('utf8', s, e);

function parseBlock(buf) {
  const st = [], groups = []; let gran = 100, latOff = 0, lonOff = 0; const r = new Reader(buf);
  while (r.p < r.end) {
    const k = r.varint(), f = k >> 3, wt = k & 7;
    if (f === 1 && wt === 2) { const [s, e] = r.bytes(); const t = new Reader(buf, s, e); while (t.p < e) { const kk = t.varint(); if ((kk >> 3) === 1) { const [a, z] = t.bytes(); st.push(utf8(buf, a, z)); } else t.skip(kk & 7); } }
    else if (f === 2 && wt === 2) groups.push(r.bytes());
    else if (f === 17) gran = r.varint(); else if (f === 19) latOff = r.svarint(); else if (f === 20) lonOff = r.svarint();
    else r.skip(wt);
  }
  return { st, groups, gran, latOff, lonOff };
}
function tagsOf(st, ks, vs) { if (!ks.length) return null; const o = {}; for (let i = 0; i < ks.length; i++) o[st[ks[i]]] = st[vs[i]]; return o; }

export async function readPbf(path, cb, opts = {}) {
  const skip = opts.skip || {}, fd = openSync(path, 'r'), size = fstatSync(fd).size; let pos = 0; const stats = { nodes: 0, ways: 0, relations: 0 };
  const read = (n) => { const b = Buffer.allocUnsafe(n); let got = 0; while (got < n) { const k = readSync(fd, b, got, n - got, pos + got); if (!k) throw new Error('short read'); got += k; } pos += n; return b; };
  try {
    while (pos < size) {
      const hl = read(4).readUInt32BE(0), hdr = read(hl); let type = '', dsz = 0; { const r = new Reader(hdr); while (r.p < r.end) { const k = r.varint(), f = k >> 3, wt = k & 7; if (f === 1) { const [s, e] = r.bytes(); type = utf8(hdr, s, e); } else if (f === 3) dsz = r.varint(); else r.skip(wt); } }
      const blob = read(dsz); if (type !== 'OSMData') continue;
      let raw = null; { const r = new Reader(blob); while (r.p < r.end) { const k = r.varint(), f = k >> 3, wt = k & 7; if (f === 1) { const [s, e] = r.bytes(); raw = blob.subarray(s, e); } else if (f === 3) { const [s, e] = r.bytes(); raw = inflateSync(blob.subarray(s, e)); } else r.skip(wt); } }
      const pb = parseBlock(raw), st = pb.st, buf = raw;
      for (const [gs, ge] of pb.groups) {
        const r = new Reader(buf, gs, ge);
        while (r.p < ge) {
          const k = r.varint(), f = k >> 3, wt = k & 7;
          if (f === 2 && wt === 2) { // DenseNodes
            const [s, e] = r.bytes(); if (skip.nodes) continue; const t = new Reader(buf, s, e); let ids = [], lats = [], lons = [], kv = [];
            while (t.p < e) { const kk = t.varint(), ff = kk >> 3, ww = kk & 7; if (ff === 1) t.packed(true, ids); else if (ff === 8) t.packed(true, lats); else if (ff === 9) t.packed(true, lons); else if (ff === 10) t.packed(false, kv); else t.skip(ww); }
            let id = 0, la = 0, lo = 0, ki = 0;
            for (let i = 0; i < ids.length; i++) {
              id += ids[i]; la += lats[i]; lo += lons[i]; let tags = null;
              if (kv.length) { while (kv[ki] !== 0 && ki < kv.length) { tags = tags || {}; tags[st[kv[ki]]] = st[kv[ki + 1]]; ki += 2; } ki++; }
              cb.node && cb.node(id, (pb.latOff + pb.gran * la) * 1e-9, (pb.lonOff + pb.gran * lo) * 1e-9, tags);
            }
            stats.nodes += ids.length;
          } else if (f === 3 && wt === 2) { // Way
            const [s, e] = r.bytes(); if (skip.ways) continue; const t = new Reader(buf, s, e); let id = 0, ks = [], vs = [], refs = [];
            while (t.p < e) { const kk = t.varint(), ff = kk >> 3, ww = kk & 7; if (ff === 1) id = t.varint(); else if (ff === 2) t.packed(false, ks); else if (ff === 3) t.packed(false, vs); else if (ff === 8) t.packed(true, refs); else t.skip(ww); }
            let a = 0; for (let i = 0; i < refs.length; i++) { a += refs[i]; refs[i] = a; }
            stats.ways++; cb.way && cb.way(id, refs, tagsOf(st, ks, vs) || {});
          } else if (f === 4 && wt === 2) { // Relation
            const [s, e] = r.bytes(); if (skip.relations) continue; const t = new Reader(buf, s, e); let id = 0, ks = [], vs = [], roles = [], mem = [], types = [];
            while (t.p < e) { const kk = t.varint(), ff = kk >> 3, ww = kk & 7; if (ff === 1) id = t.varint(); else if (ff === 2) t.packed(false, ks); else if (ff === 3) t.packed(false, vs); else if (ff === 8) t.packed(false, roles); else if (ff === 9) t.packed(true, mem); else if (ff === 10) t.packed(false, types); else t.skip(ww); }
            const members = []; let m = 0; for (let i = 0; i < mem.length; i++) { m += mem[i]; members.push({ type: types[i] === 0 ? 'n' : types[i] === 1 ? 'w' : 'r', ref: m, role: st[roles[i]] }); }
            stats.relations++; cb.relation && cb.relation(id, members, tagsOf(st, ks, vs) || {});
          } else r.skip(wt);
        }
      }
    }
  } finally { closeSync(fd); }
  return stats;
}

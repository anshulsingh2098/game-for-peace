"""Adds the nodes of one GLB (made by tools/blender/make_traffic_cars.py) to the traffic pack, leaving the existing nodes byte for byte as they were.
Run:  python3 tools/merge_traffic_pack.py <extra.glb> <extra.json>      (rewrites assets/traffic/traffic_pack.glb and traffic_pack.json; kinds already in the pack are replaced)
Both GLBs have one binary buffer and the two materials "Paint" and "Rest"; the extra nodes use the pack's own two materials."""
import json, struct, sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); PACK = os.path.join(ROOT, 'assets', 'traffic')

def read(p):
    b = open(p, 'rb').read(); jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl]); off = 20 + jl; bl = struct.unpack('<I', b[off:off + 4])[0]
    return j, b[off + 8:off + 8 + bl]
def write(p, j, binb):
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4); binb += b'\0' * ((4 - len(binb) % 4) % 4)
    j['buffers'][0]['byteLength'] = len(binb)
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
    open(p, 'wb').write(b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(binb)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(binb)) + b'BIN\0' + binb)

def main():
    xg, xj = sys.argv[1], sys.argv[2]
    base, bb = read(os.path.join(PACK, 'traffic_pack.glb')); extra, eb = read(xg); meta = json.load(open(os.path.join(PACK, 'traffic_pack.json'))); xmeta = json.load(open(xj))
    names = {n['name'] for n in extra['nodes']}
    keep = [i for i, n in enumerate(base['nodes']) if n.get('name') not in names]
    if len(keep) != len(base['nodes']): raise SystemExit('a kind is already in the pack: remove it first (rebuilding in place is not supported): ' + str([n['name'] for n in base['nodes'] if n['name'] in names]))
    pad = (4 - len(bb) % 4) % 4; bb = bb + b'\0' * pad; boff = len(bb)
    mat = {m['name']: i for i, m in enumerate(base['materials'])}; mmap = {i: mat[m['name']] for i, m in enumerate(extra['materials'])}
    bv0, ac0, me0, no0 = len(base['bufferViews']), len(base['accessors']), len(base['meshes']), len(base['nodes'])
    for v in extra['bufferViews']: v = dict(v); v['buffer'] = 0; v['byteOffset'] = v.get('byteOffset', 0) + boff; base['bufferViews'].append(v)
    for a in extra['accessors']: a = dict(a); a['bufferView'] = a['bufferView'] + bv0; base['accessors'].append(a)
    for m in extra['meshes']:
        m = json.loads(json.dumps(m))
        for p in m['primitives']:
            p['attributes'] = {k: v + ac0 for k, v in p['attributes'].items()}; p['indices'] += ac0; p['material'] = mmap[p['material']]
        base['meshes'].append(m)
    roots = []
    for i, n in enumerate(extra['nodes']):
        n = dict(n); n['mesh'] = n['mesh'] + me0; n.pop('children', None); base['nodes'].append(n); roots.append(no0 + i)
    base['scenes'][0]['nodes'] += roots
    write(os.path.join(PACK, 'traffic_pack.glb'), base, bb + eb); meta.update(xmeta); json.dump(meta, open(os.path.join(PACK, 'traffic_pack.json'), 'w'), indent=1)
    print('traffic pack now has', len(base['nodes']), 'kinds:', [n['name'] for n in base['nodes']])
main()

"""Rigged street people for the game, in a stylised but realistically proportioned look (about 7.3 heads tall, lofted limbs, a face with eyes, brows, nose, lips and ears, hair, and clothes that sit on the body).
Everything is built here from Blender primitives and lofted cross-sections: no external mesh, texture, rig or animation is used. The same 17-bone skeleton and the same clips (Walk, Run, Idle, IdleLook, Wait)
for every type, so the game can swap models freely; the joint heights never change (the ragdoll and the on-foot code depend on them).

Run:  blender -b -P dev/build_npc_stylised.py -- <out_dir> [type]
Types: commuter (the player's model too), man_kurta, woman_kurti, woman_top, elder, vendor, tourist.
Writes <out_dir>/npc_<type>_lod1.glb (about 6,500 faces), for the commuter also npc_commuter.glb (full detail), and preview pictures.
Materials are named Skin, Hair, Top, Bottom, Shoe, Sole, Accent, Eye, Iris, Lip, Glass: the game tints Skin, Hair, Top, Bottom and Accent per person, so a handful of models gives a varied crowd.
Units are metres, the figure faces -Y in Blender (+Z in glTF), feet on the ground, about 1.72 m tall."""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(__file__), 'previews')
TYPE = argv[1] if len(argv) > 1 else 'commuter'
os.makedirs(OUT, exist_ok=True)

#            sex   top      sleeve   bottom    hair     extras
TYPES = {
    'commuter':    dict(sex='m', top='shirt', sleeve='short', bottom='jeans',   hair='short', stache=True,  shoe='sneaker', skin=0x9a6a4e, hairc=0x15110e, topc=0x3f7fb5, botc=0x2b3a52, shoec=0xf0f0ee, accent=0x16181d),
    'man_kurta':   dict(sex='m', top='kurta', sleeve='long',  bottom='salwar',  hair='side',  stache=True,  shoe='sandal',  skin=0xa4745a, hairc=0x15110e, topc=0xe8e0c8, botc=0xf1efe8, shoec=0x5a4636, accent=0xc8a24a),
    'woman_kurti': dict(sex='f', top='kurti', sleeve='short', bottom='salwar',  hair='long',  dupatta=True, shoe='sandal',  skin=0xb0805f, hairc=0x1a1210, topc=0xb23a6a, botc=0x2c4a6e, shoec=0x5a4636, accent=0xe3b21a),
    'woman_top':   dict(sex='f', top='shirt', sleeve='short', bottom='jeans',   hair='bun',   bag='shoulder', shoe='sneaker', skin=0xc89070, hairc=0x201510, topc=0xe9e2d2, botc=0x35507a, shoec=0xf0f0ee, accent=0x8a4a2a),
    'elder':       dict(sex='m', top='kurta', sleeve='long',  bottom='salwar',  hair='topi',  beard=True,   glasses=True, shoe='sandal', skin=0x9a6a4e, hairc=0xcfcfcf, topc=0xf0eee6, botc=0xf0eee6, shoec=0x4a3a2a, accent=0xf4f1e8),
    'vendor':      dict(sex='m', top='shirt', sleeve='long',  bottom='trousers', hair='short', stache=True,  scarf=True,  shoe='sandal', skin=0x8a5a44, hairc=0x15110e, topc=0xe9a23b, botc=0x3d4a5c, shoec=0x5a4636, accent=0xc8321f),
    'tourist':     dict(sex='m', top='shirt', sleeve='short', bottom='shorts',  hair='cap',   backpack=True, sunglasses=True, shoe='sneaker', skin=0xe0b295, hairc=0x6a4a2a, topc=0x3fa7a0, botc=0xd9c9a3, shoec=0xf0f0ee, accent=0x2c5c8f),
}
T = TYPES[TYPE]
FEM = T['sex'] == 'f'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def srgb(h):
    r, g, b = [((h >> s) & 255) / 255 for s in (16, 8, 0)]
    f = lambda x: x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b), 1.0)

MATS = {}
def mat(name, hexcol, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(hexcol); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal; MATS[name] = m
for n, c, r, mt in [('Skin', T['skin'], 0.55, 0), ('Hair', T['hairc'], 0.75, 0), ('Top', T['topc'], 0.8, 0), ('Bottom', T['botc'], 0.85, 0), ('Shoe', T['shoec'], 0.55, 0), ('Sole', 0xe9e9e6, 0.7, 0),
                    ('Accent', T['accent'], 0.6, 0), ('Eye', 0xf2f0ea, 0.25, 0), ('Iris', 0x4a2e1c, 0.3, 0), ('Pupil', 0x0c0a09, 0.2, 0), ('Lip', 0x7a3a30, 0.5, 0), ('Glass', 0x14171c, 0.1, 0.0), ('Metal', 0xb9a15a, 0.3, 1.0)]:
    mat(n, c, r, mt)

def sm(a0, a1, x):
    t = max(0.0, min(1.0, (x - a0) / (a1 - a0))); return t * t * (3 - 2 * t)

# ------------------------------------------------------------------ geometry builders
parts = []
def finish(name, bm, material, kind, side='', subsurf=1, shade=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); scene.collection.objects.link(o)
    o.data.materials.append(MATS[material]); o['kind'] = kind; o['side'] = side
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    if shade:
        for p in me.polygons: p.use_smooth = True
    if subsurf:
        md = o.modifiers.new('s', 'SUBSURF'); md.levels = subsurf; md.render_levels = subsurf; bpy.ops.object.modifier_apply(modifier=md.name)
    o.select_set(False); parts.append(o); return o

def loft(secs, seg=14, cap_bot=True, cap_top=True, taper_front=None):
    """secs: [(z, cx, cy, rx, ry)] bottom to top; rings of `seg` points; returns a bmesh"""
    bm = bmesh.new(); rings = []
    for z, cx, cy, rx, ry in secs:
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg; ring.append(bm.verts.new((cx + rx * math.cos(a), cy + ry * math.sin(a), z)))
        rings.append(ring)
    for r in range(len(rings) - 1):
        for i in range(seg): bm.faces.new((rings[r][i], rings[r][(i + 1) % seg], rings[r + 1][(i + 1) % seg], rings[r + 1][i]))
    if cap_bot: bm.faces.new(list(reversed(rings[0])))
    if cap_top: bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); return bm

def ellip(c, r, seg=20, rings=14, rot=None):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    m = Matrix.Translation(c) @ (rot.to_4x4() if rot else Matrix.Identity(4)) @ Matrix.Diagonal((r[0], r[1], r[2], 1)); bmesh.ops.transform(bm, matrix=m, verts=bm.verts[:]); return bm

def box(c, s, bev=0.0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ Matrix.Diagonal((s[0], s[1], s[2], 1)), verts=bm.verts[:]); return bm

def cut(bm, co, no):
    """keep what is on the side of the plane the normal points to"""
    g = bm.verts[:] + bm.edges[:] + bm.faces[:]; bmesh.ops.bisect_plane(bm, geom=g, plane_co=co, plane_no=no)
    n = Vector(no); c = Vector(co); bmesh.ops.delete(bm, geom=[v for v in bm.verts if (v.co - c).dot(n) < -1e-6], context='VERTS')
    return bm

# ------------------------------------------------------------------ the body
# bone-weights by height, blending across joints; kinds: torso, leg, arm, head, neck, hand, foot, chest, hips
HIP, KNEE, ANKLE, SHOULDER, ELBOW, WRIST, WAIST, NECK = 0.88, 0.5, 0.13, 1.31, 1.05, 0.79, 0.98, 1.36
def wts(kind, side, x, z):
    if kind == 'torso':
        wh = 1 - sm(0.86, 1.04, z); wn = sm(1.38, 1.47, z); wc = sm(1.10, 1.26, z) * (1 - wn); ws = max(0.0, 1 - wh - wc - wn); w = {'Hips': wh, 'Spine': ws, 'Chest': wc, 'Neck': wn}
        if z < 0.86:                                                   # a long top or skirt below the hips follows the thigh on its side a little
            u = 0.55 * (1 - sm(0.55, 0.86, z)) * min(1.0, abs(x) / 0.06); s2 = 'L' if x >= 0 else 'R'; w = {'Hips': 1 - u, 'UpperLeg_' + s2: u}
    elif kind == 'leg':
        s2 = side; wh = sm(HIP - 0.03, HIP + 0.07, z); wl = 1 - sm(KNEE - 0.07, KNEE + 0.07, z); wf = 1 - sm(ANKLE - 0.04, ANKLE + 0.05, z); wl = max(0.0, wl - wf)
        w = {'Hips': wh, 'LowerLeg_' + s2: wl, 'Foot_' + s2: wf, 'UpperLeg_' + s2: max(0.0, 1 - wh - wl - wf)}
    elif kind == 'arm':
        s2 = side; wc = sm(SHOULDER - 0.03, SHOULDER + 0.06, z); wl = 1 - sm(ELBOW - 0.06, ELBOW + 0.06, z); wh = 1 - sm(WRIST - 0.03, WRIST + 0.05, z); wl = max(0.0, wl - wh)
        w = {'Chest': wc, 'LowerArm_' + side: wl, 'Hand_' + side: wh, 'UpperArm_' + side: max(0.0, 1 - wc - wl - wh)}
    elif kind == 'neck':
        wc = 1 - sm(1.37, 1.43, z); wd = sm(1.42, 1.48, z); w = {'Chest': wc, 'Head': wd, 'Neck': max(0.0, 1 - wc - wd)}
    elif kind == 'longhair':
        wd = sm(1.40, 1.52, z); w = {'Head': wd, 'Chest': 1 - wd}
    elif kind == 'head': w = {'Head': 1.0}
    elif kind == 'hand': w = {'Hand_' + side: 1.0}
    elif kind == 'foot': w = {'Foot_' + side: 1.0}
    elif kind == 'chest': w = {'Chest': 1.0}
    elif kind == 'hips': w = {'Hips': 1.0}
    else: w = {'Chest': 1.0}
    t = sum(w.values()) or 1.0
    return {k: v / t for k, v in w.items() if v / t > 0.003}

def skin_it(o):
    kind, side = o['kind'], o['side']; groups = {}
    for v in o.data.vertices:
        co = o.matrix_world @ v.co
        for name, wt in wts(kind, side, co.x, co.z).items():
            if name not in groups: groups[name] = o.vertex_groups.new(name=name)
            groups[name].add([v.index], wt, 'REPLACE')

# torso profile: (z, half width, half depth, centre y)
def torso_secs(grow=0.0, long_to=None, flare=0.0):
    w = [(0.84, .150, .095, 0), (0.92, .170, .108, 0), (1.06, .148, .096, 0), (1.18, .162, .104, -.004), (1.28, .172, .112, -.008), (1.36, .186, .100, -.004), (1.41, .090, .075, 0), (1.46, .056, .056, 0)]
    f = [(0.84, .152, .097, 0), (0.92, .182, .110, 0), (1.06, .124, .088, 0), (1.18, .146, .100, -.006), (1.28, .152, .116, -.014), (1.36, .152, .094, -.004), (1.41, .084, .072, 0), (1.46, .052, .052, 0)]
    base = f if FEM else w
    return [(z, 0.0, cy, (rx + grow) , (ry + grow * 0.8)) for z, rx, ry, cy in base]

def add_body():
    # skin of the torso is only seen at the neck; build it whole anyway (a top sits over it)
    finish('Torso', loft(torso_secs(), 16, True, False), 'Skin', 'torso')
    finish('Neck', loft([(1.38, 0, 0.004, .052, .052), (1.44, 0, 0.0, .048, .05), (1.50, 0, -.004, .046, .05)], 12, False, False), 'Skin', 'neck')
    for s, sd in ((1, 'L'), (-1, 'R')):
        # legs: thigh, knee, calf, ankle
        leg = [(0.075, s * .085, 0, .036, .040), (0.10, s * .085, 0, .037, .040), (0.16, s * .085, 0, .040, .043), (0.28, s * .085, .006, .052, .054), (0.40, s * .085, .008, .061, .060), (0.50, s * .085, 0, .060, .062), (0.56, s * .085, -.002, .066, .068),
               (0.68, s * .085, -.003, .082, .084), (0.80, s * .085, -.002, .092, .094), (0.90, s * .085, 0, .097, .098)]
        finish('Leg', loft(leg, 12, True, True), 'Skin', 'leg', sd)
        arm = [(0.78, s * .268, 0, .029, .030), (0.84, s * .268, 0, .031, .032), (0.95, s * .267, 0, .039, .040), (1.06, s * .265, 0, .040, .041), (1.20, s * .240, 0, .047, .048), (1.30, s * .222, 0, .051, .052), (1.37, s * .205, 0, .053, .054)]
        finish('Arm', loft(arm, 12, True, True), 'Skin', 'arm', sd)
        finish('Hand', ellip((s * .268, -.002, .722), (.027, .019, .052), 14, 10), 'Skin', 'hand', sd)
        finish('Thumb', ellip((s * .249, -.022, .75), (.010, .010, .026), 8, 6, Matrix.Rotation(s * 0.3, 3, 'Y')), 'Skin', 'hand', sd)
        for k, (fx, fz) in enumerate(((.012, .672), (.004, .668), (-.004, .672), (-.012, .682))):                                                 # four short fingers, slightly curled
            finish('Finger', ellip((s * (.268 + fx), -.006, fz), (.0075, .008, .022), 6, 5), 'Skin', 'hand', sd, 0)

def add_head():
    hz = 1.575
    finish('Head', ellip((0, 0.0, hz), (.083, .099, .109), 24, 18), 'Skin', 'head')
    finish('Jaw', ellip((0, -.034, hz - .066), (.064, .068, .058), 18, 12), 'Skin', 'head')
    finish('Nose', ellip((0, -.1, hz - .028), (.0095, .017, .024), 10, 8, Matrix.Rotation(0.25, 3, 'X')), 'Skin', 'head', '', 0)
    for s in (1, -1):
        finish('Ear', ellip((s * .0865, .004, hz - .004), (.0095, .02, .029), 10, 8), 'Skin', 'head', '', 0)
        finish('EyeW', ellip((s * .0335, -.0915, hz + .008), (.0118, .0085, .0118), 12, 10), 'Eye', 'head', '', 0)
        finish('Iris', ellip((s * .0335, -.0985, hz + .008), (.0075, .004, .0075), 10, 8), 'Iris', 'head', '', 0)
        finish('Pupil', ellip((s * .0335, -.1015, hz + .008), (.0034, .0025, .0034), 8, 6), 'Pupil', 'head', '', 0)
        finish('Brow', box((s * .034, -.0915, hz + .029), (.032, .008, .0075)), 'Hair', 'head', '', 0)
    finish('Lip', ellip((0, -.0925, hz - .062), (.0245, .0085, .0075), 12, 8), 'Lip', 'head', '', 0)
    finish('LipLow', ellip((0, -.091, hz - .0745), (.0185, .0075, .0065), 12, 8), 'Lip', 'head', '', 0)

def hair_cap(scale=1.0, back=0.014, lift=0.012, low=0.0):
    bm = ellip((0, back, 1.575 + lift), (.0895 * scale, .106 * scale, .117 * scale), 40, 28)
    cut(bm, (0, 0, 1.535 - low), (0, -0.30, 1.0)); return bm                                    # hairline: higher at the front, lower at the back

def add_hair():
    h = T['hair']
    if h == 'short': finish('HairCap', hair_cap(), 'Hair', 'head', '', 0)
    elif h == 'side':
        finish('HairCap', hair_cap(1.01, 0.012, 0.014), 'Hair', 'head', '', 0); finish('HairPart', ellip((-.03, -.03, 1.675), (.05, .075, .03), 12, 8, Matrix.Rotation(0.3, 3, 'Y')), 'Hair', 'head', '', 0)
    elif h == 'long':
        finish('HairCap', hair_cap(1.02, 0.016, 0.016, 0.02), 'Hair', 'head', '', 0)
        finish('HairBack', loft([(1.27, 0, .095, .075, .042), (1.36, 0, .092, .095, .058), (1.48, 0, .075, .10, .078), (1.58, 0, .05, .098, .095), (1.66, 0, .02, .09, .10)], 14, True, False), 'Hair', 'longhair')
    elif h == 'bun':
        finish('HairCap', hair_cap(1.01, 0.014, 0.012, 0.01), 'Hair', 'head', '', 0); finish('Bun', ellip((0, .07, 1.70), (.04, .04, .04), 12, 10), 'Hair', 'head', '', 0)
    elif h == 'topi':
        finish('Topi', loft([(1.655, 0, 0.0, .088, .104), (1.665, 0, 0.0, .092, .108), (1.72, 0, 0.0, .088, .104), (1.735, 0, 0.0, .075, .09)], 18, False, True), 'Accent', 'head')
        finish('HairSide', ellip((0, .035, 1.58), (.09, .09, .06), 16, 10), 'Hair', 'head', '', 0)
    elif h == 'cap':
        finish('HairNape', ellip((0, .06, 1.56), (.085, .05, .05), 14, 10), 'Hair', 'head', '', 0)
        finish('CapCrown', loft([(1.625, 0, 0.0, .094, .112), (1.68, 0, 0.0, .098, .115), (1.725, 0, 0.0, .088, .105), (1.74, 0, 0.0, .05, .06)], 18, False, True), 'Accent', 'head')
        finish('CapBrim', ellip((0, -.115, 1.645), (.075, .07, .008), 14, 8, Matrix.Rotation(-0.1, 3, 'X')), 'Accent', 'head', '', 0)
    if T.get('stache'): finish('Stache', ellip((0, -.095, 1.526), (.03, .012, .007), 10, 8), 'Hair', 'head', '', 0)
    if T.get('beard'): finish('Beard', cut(ellip((0, -.045, 1.505), (.066, .074, .06), 16, 12), (0, 0, 1.49), (0, 0.2, -1.0)), 'Hair', 'head', '', 0)
    if T.get('glasses') or T.get('sunglasses'):
        for s in (1, -1): finish('Lens', ellip((s * .0335, -.1055, 1.583), (.0185, .0035, .0135), 12, 8), 'Glass' if T.get('sunglasses') else 'Eye', 'head', '', 0)
        finish('Bridge', box((0, -.106, 1.59), (.02, .004, .004)), 'Metal', 'head', '', 0)
        for s in (1, -1): finish('Temple', box((s * .0865, -.052, 1.59), (.004, .105, .004)), 'Metal', 'head', '', 0)

def add_clothes():
    top, sl, bot = T['top'], T['sleeve'], T['bottom']
    secs = torso_secs(0.011)
    if top == 'shirt': secs = [(0.78, 0, 0, .206, .126), (0.86, 0, 0, .2, .124)] + secs[1:7]
    elif top == 'kurta': secs = [(0.56, 0, 0, .19, .122), (0.66, 0, 0, .192, .122), (0.76, 0, 0, .2, .124), (0.86, 0, 0, .205, .126)] + secs[1:7]
    elif top == 'kurti': secs = [(0.60, 0, 0, .215, .135), (0.72, 0, 0, .205, .128), (0.86, 0, 0, .2, .122)] + secs[1:7]
    secs = [(z, cx, cy, rx, ry) for z, cx, cy, rx, ry in secs]
    shirt = loft(secs + [(1.41, 0, 0, .1, .082)], 16, False, False)
    finish('Top', shirt, 'Top', 'torso')
    finish('Collar', loft([(1.395, 0, 0.004, .066, .062), (1.435, 0, 0.002, .058, .056)], 14, False, False), 'Top', 'neck')
    if T.get('scarf'): finish('Scarf', loft([(1.37, 0, -.01, .105, .1), (1.42, 0, -.012, .08, .085), (1.46, 0, -.006, .068, .07)], 14, False, False), 'Accent', 'neck')
    if T.get('dupatta'):                                                                                                                       # a narrow scarf over the left shoulder, hanging down the front
        finish('Dupatta', loft([(0.78, 0.115, -.122, .034, .012), (0.95, 0.12, -.121, .040, .013), (1.12, 0.115, -.118, .046, .014), (1.28, 0.09, -.112, .05, .016), (1.39, 0.045, -.1, .05, .02)], 12, True, True), 'Accent', 'chest')
    for s, sd in ((1, 'L'), (-1, 'R')):
        zend = 1.12 if sl == 'short' else 0.80
        base = [(0.80, s * .268, 0, .029, .03), (0.84, s * .268, 0, .031, .032), (0.95, s * .267, 0, .039, .04), (1.06, s * .265, 0, .040, .041), (1.20, s * .240, 0, .047, .048), (1.30, s * .222, 0, .051, .052), (1.37, s * .205, 0, .053, .054)]
        sec = [(z, cx, cy, rx + 0.008, ry + 0.008) for z, cx, cy, rx, ry in base if z >= zend - 0.001]
        if sl == 'long': sec = [(0.80, s * .268, 0, .042, .043)] + sec[1:]
        else: sec = [(zend, s * (.265 - (zend - 1.06) * 0.3), 0, .049, .05)] + [x for x in sec if x[0] > zend + 0.01]
        finish('Sleeve', loft(sec, 12, False, True), 'Top', 'arm', sd)
    # trousers
    for s, sd in ((1, 'L'), (-1, 'R')):
        if bot in ('jeans', 'trousers'):
            k = .007 if bot == 'jeans' else .014
            leg = [(0.075, .040 + k, .043 + k), (0.16, .043 + k, .046 + k), (0.28, .054 + k, .057 + k), (0.40, .062 + k, .062 + k), (0.50, .061 + k, .064 + k), (0.56, .067 + k, .07 + k), (0.68, .083 + k, .086 + k), (0.80, .093 + k, .097 + k), (0.90, .098 + k, .1 + k)]
        elif bot == 'salwar':
            leg = [(0.075, .045, .048), (0.14, .052, .055), (0.30, .085, .09), (0.46, .098, .102), (0.62, .108, .112), (0.76, .112, .116), (0.90, .108, .108)]
        else:                                                                                                                                      # shorts
            leg = [(0.50, .083, .086), (0.56, .08, .084), (0.68, .092, .096), (0.80, .099, .103), (0.90, .103, .104)]
        finish('Pants', loft([(z, s * .085, 0, rx * (0.93 if z >= 0.78 else 1.0), ry * (0.93 if z >= 0.78 else 1.0)) for z, rx, ry in leg], 12, False, True), 'Bottom', 'leg', sd)
    finish('Hip', loft([(0.84, 0, 0, .146, .09), (0.92, 0, 0, .162, .102), (0.96, 0, 0, .152, .098)], 16, True, True), 'Bottom', 'hips')
    if bot in ('jeans', 'trousers'): finish('Belt', loft([(0.945, 0, 0, .18, .114), (0.975, 0, 0, .18, .114)], 16, False, False), 'Accent', 'hips', '', 0)

def add_shoes():
    for s, sd in ((1, 'L'), (-1, 'R')):
        if T['shoe'] == 'sneaker':
            finish('Shoe', ellip((s * .085, -.035, .062), (.05, .122, .052), 16, 12), 'Shoe', 'foot', sd); finish('Toe', ellip((s * .085, -.105, .05), (.047, .062, .04), 12, 8), 'Shoe', 'foot', sd)
            finish('Sole', box((s * .085, -.04, .014), (.1, .27, .03)), 'Sole', 'foot', sd, 1, False)
        else:
            finish('FootSkin', ellip((s * .085, -.04, .052), (.044, .112, .04), 14, 10), 'Skin', 'foot', sd); finish('Sole', box((s * .085, -.04, .012), (.098, .27, .024)), 'Shoe', 'foot', sd, 1, False)
            finish('Strap', box((s * .085, -.06, .06), (.095, .035, .024)), 'Shoe', 'foot', sd, 0, False); finish('Strap2', box((s * .085, .045, .06), (.092, .03, .03)), 'Shoe', 'foot', sd, 0, False)

def add_gear():
    if T.get('bag') == 'shoulder':
        finish('Bag', box((.215, .0, .88), (.07, .24, .22)), 'Accent', 'chest', '', 1); finish('Strap', box((.0, -.0, 1.2), (.03, .03, .44)), 'Accent', 'chest', '', 0)
    if T.get('backpack'):
        finish('Pack', box((0, .15, 1.15), (.28, .12, .38)), 'Accent', 'chest', '', 1)
        for s in (1, -1): finish('PackStrap', box((s * .09, -.03, 1.2), (.04, .028, .3)), 'Accent', 'chest', '', 0)

add_body(); add_head(); add_hair(); add_clothes(); add_shoes(); add_gear()
# skin colours only where bare: remove the skin part of what a garment covers entirely (saves faces and avoids poke-through)
for o in list(parts):
    if o.name.split('.')[0] == 'Leg' and T['bottom'] in ('jeans', 'trousers', 'salwar'): parts.remove(o); bpy.data.objects.remove(o, do_unlink=True)
for o in list(parts): skin_it(o)

# ---- armature
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
arm_obj = bpy.context.active_object; arm_obj.name = 'Rig'; arm = arm_obj.data; arm.name = 'RigData'
for b in list(arm.edit_bones): arm.edit_bones.remove(b)
def bone(name, head, tail, parent=None):
    b = arm.edit_bones.new(name); b.head = head; b.tail = tail
    if parent: b.parent = arm.edit_bones[parent]; b.use_connect = False
    return b
bone('Root', (0, 0, 0), (0, 0, 0.1))
bone('Hips', (0, 0, 0.88), (0, 0, 0.98), 'Root')
bone('Spine', (0, 0, 0.98), (0, 0, 1.2), 'Hips')
bone('Chest', (0, 0, 1.2), (0, 0, 1.36), 'Spine')
bone('Neck', (0, 0, 1.36), (0, 0, 1.44), 'Chest')
bone('Head', (0, 0, 1.44), (0, 0, 1.72), 'Neck')
for s, sd in ((1, 'L'), (-1, 'R')):
    bone('UpperArm_' + sd, (s * 0.24, 0, 1.31), (s * 0.265, 0, 1.05), 'Chest')
    bone('LowerArm_' + sd, (s * 0.265, 0, 1.05), (s * 0.268, 0, 0.79), 'UpperArm_' + sd)
    bone('Hand_' + sd, (s * 0.268, 0, 0.79), (s * 0.268, 0, 0.68), 'LowerArm_' + sd)
    bone('UpperLeg_' + sd, (s * 0.085, 0, 0.88), (s * 0.085, 0, 0.5), 'Hips')
    bone('LowerLeg_' + sd, (s * 0.085, 0, 0.5), (s * 0.085, 0, 0.13), 'UpperLeg_' + sd)
    bone('Foot_' + sd, (s * 0.085, 0, 0.13), (s * 0.085, -0.2, 0.04), 'LowerLeg_' + sd)
bpy.ops.object.mode_set(mode='OBJECT')


# ---- join the parts into one skinned mesh and bind it to the skeleton
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.active_object; body.name = 'Body'
bpy.ops.object.shade_smooth()
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); arm_obj.select_set(True); bpy.context.view_layer.objects.active = arm_obj
bpy.ops.object.parent_set(type='ARMATURE_NAME')

# ---- animations. Pose rotations are on the bone's own axes, in radians. Forward is -y in Blender: for an upright bone (spine, neck, head) +x leans forward; for a hanging bone (thigh, shin, upper arm, forearm) -x swings
# forward. All cycles loop (the last frame equals the first). Clips: Walk (1.0 s, one stride of two steps), Run (0.67 s), Idle (4 s), IdleLook (3 s), Wait (2 s, a foot tap).
bpy.context.view_layer.objects.active = arm_obj
bpy.ops.object.mode_set(mode='POSE')
pb = arm_obj.pose.bones
for b in pb: b.rotation_mode = 'XYZ'
TAU = 2 * math.pi

def make_action(name, frames, fn):
    act = bpy.data.actions.new(name); arm_obj.animation_data_create(); arm_obj.animation_data.action = act
    for f in range(frames + 1):
        t = f / frames
        scene.frame_set(f)
        for b in pb: b.rotation_euler = (0, 0, 0); b.location = (0, 0, 0)
        fn(t)
        for b in pb:
            b.keyframe_insert('rotation_euler', frame=f); b.keyframe_insert('location', frame=f)
    return act

def gait(t, amp, knee0, knee1, arm, elbow, lean, bob, twist, rollk):
    """a walking or running stride; phi is the left leg's phase, the right is half a cycle behind"""
    for sd, ph in (('L', t * TAU), ('R', t * TAU + math.pi)):
        s, c = math.sin(ph), math.cos(ph)
        pb['UpperLeg_' + sd].rotation_euler.x = -amp * s + 0.05                                                                  # the thigh swings forward (negative x) while s is positive
        pb['LowerLeg_' + sd].rotation_euler.x = knee0 + knee1 * max(0.0, c) ** 2 + 0.55 * knee1 * 0.3 * max(0.0, -s)           # the knee folds through the swing and a little at toe-off
        pb['Foot_' + sd].rotation_euler.x = 0.5 * amp * math.sin(ph - 0.5)                                         # the toes lift at the heel strike and push off behind
        pb['UpperArm_' + sd].rotation_euler.x = arm * s                                                                          # arms swing against the legs
        pb['LowerArm_' + sd].rotation_euler.x = -(elbow + 0.45 * arm * max(0.0, -s))                                             # the elbow bends more as the arm swings forward
    p = t * TAU
    pb['Hips'].location.z = bob * (0.5 - 0.5 * math.cos(2 * p)) - bob * 0.5                                                      # the body rises over the standing leg twice a stride
    pb['Hips'].rotation_euler.y = twist * math.sin(p)                                                                            # the hips turn with the leading leg ...
    pb['Spine'].rotation_euler.y = -twist * 1.2 * math.sin(p)                                                                    # ... and the shoulders against them
    pb['Chest'].rotation_euler.y = -twist * 0.4 * math.sin(p)
    pb['Head'].rotation_euler.y = twist * 1.0 * math.sin(p)                                                                      # the head stays looking ahead
    pb['Hips'].rotation_euler.z = rollk * math.sin(p)                                                                            # the pelvis drops a little on the swinging side
    pb['Spine'].rotation_euler.z = -rollk * 1.1 * math.sin(p)
    pb['Spine'].rotation_euler.x = lean; pb['Head'].rotation_euler.x = -lean * 0.8
    pb['Hips'].rotation_euler.x = lean * 0.4

def walk(t): gait(t, 0.42, 0.10, 0.62, 0.40, 0.30, 0.05, 0.028, 0.10, 0.04)
def run(t):
    gait(t, 0.85, 0.35, 1.25, 0.85, 1.35, 0.24, 0.06, 0.16, 0.05)
    for sd in ('L', 'R'): pb['UpperLeg_' + sd].rotation_euler.x -= 0.12

def idle(t):
    s = math.sin(t * TAU); s2 = math.sin(t * TAU * 2 + 0.7)
    pb['Chest'].rotation_euler.x = 0.015 + 0.018 * s2                                                                            # breathing
    pb['Spine'].rotation_euler.x = 0.01
    pb['Head'].rotation_euler.y = 0.10 * math.sin(t * TAU + 1.0); pb['Head'].rotation_euler.x = -0.01 - 0.01 * s2
    pb['Hips'].rotation_euler.z = 0.03 * math.sin(t * TAU)                                                                       # weight shifts slowly from one foot to the other
    pb['Spine'].rotation_euler.z = -0.03 * math.sin(t * TAU)
    pb['Hips'].location.x = 0.012 * math.sin(t * TAU)
    for sd, k in (('L', 1), ('R', -1)):
        pb['UpperArm_' + sd].rotation_euler.x = 0.04 + 0.02 * k * s; pb['LowerArm_' + sd].rotation_euler.x = -0.14 - 0.03 * s2
        pb['UpperLeg_' + sd].rotation_euler.x = -0.02 * k * s * 0.5

def look(t):
    idle(t); u = math.sin(t * math.pi)                                                                                           # 0 at both ends, so it loops
    ang = 0.8 * math.sin(t * TAU) * u
    pb['Head'].rotation_euler.y += ang; pb['Neck'].rotation_euler.y = ang * 0.35; pb['Chest'].rotation_euler.y = ang * 0.25; pb['Hips'].rotation_euler.y = ang * 0.08
    pb['Head'].rotation_euler.x += 0.05 * u

def wait(t):
    idle(t); p = t * TAU * 2                                                                                                     # impatient: a foot taps and a hand goes to the elbow
    tap = max(0.0, math.sin(p * 2)) ** 2
    pb['UpperLeg_R'].rotation_euler.x = -0.10 - 0.10 * tap; pb['LowerLeg_R'].rotation_euler.x = 0.18 + 0.12 * tap; pb['Foot_R'].rotation_euler.x = -0.25 * tap
    pb['UpperArm_L'].rotation_euler.x = -0.35; pb['LowerArm_L'].rotation_euler.x = -1.25; pb['Hand_L'].rotation_euler.x = -0.15
    pb['Head'].rotation_euler.y = 0.35 * math.sin(t * TAU) + 0.3

ACTS = [('Walk', 24, walk), ('Run', 16, run), ('Idle', 96, idle), ('IdleLook', 72, look), ('Wait', 48, wait)]
acts = {}
for name, frames, fn in ACTS: acts[name] = make_action(name, frames, fn)
bpy.ops.object.mode_set(mode='OBJECT')
for a in acts.values(): a.use_fake_user = True
arm_obj.animation_data.action = acts['Walk']
for a in acts.values():
    tr = arm_obj.animation_data.nla_tracks.new(); tr.name = a.name; tr.strips.new(a.name, 1, a)
arm_obj.animation_data.action = None
walk_act = acts['Walk']


# ---- export, previews, and the low-detail copy the game loads
HI_FACES = len(body.data.polygons)
scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items else 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x, scene.render.resolution_y = 700, 900
scene.world = bpy.data.worlds.new('w'); scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.2, 0.22, 0.26, 1); scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.9
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0)); fl = bpy.context.active_object
fm = bpy.data.materials.new('floor'); fm.use_nodes = True; fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.12, 0.13, 0.15, 1); fl.data.materials.append(fm)
for loc, e in (((2.5, -3, 3), 450), ((-3, -2, 2), 200), ((0, 3, 3), 250)):
    bpy.ops.object.light_add(type='AREA', location=loc); l = bpy.context.active_object; l.data.energy = e; l.data.size = 2.5
    l.rotation_euler = (Vector((0, 0, 1.0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add(); cam = bpy.context.active_object; scene.camera = cam; cam.data.lens = 70
def shot(name, loc, target=(0, 0, 0.9), clip='Walk', frame=1):
    cam.location = loc; cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    arm_obj.animation_data.action = acts[clip]; scene.frame_set(frame)
    scene.render.filepath = os.path.join(OUT, 'npc_%s_%s.png' % (TYPE, name)); bpy.ops.render.render(write_still=True)
shot('front', (0.9, -5.2, 1.0), clip='Idle', frame=1)
shot('walk', (3.2, -4.0, 1.05), clip='Walk', frame=7)
shot('head', (0.45, -1.15, 1.6), target=(0, 0, 1.57), clip='Idle', frame=1)
if TYPE == 'commuter':
    glb = os.path.join(OUT, 'npc_commuter.glb')
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_animations=True, export_nla_strips=True, export_skins=True, export_apply=False, export_yup=True)
print('NPC', TYPE, 'full detail faces', HI_FACES)
bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = body; body.select_set(True)
ratio = min(1.0, 6500.0 / max(1, HI_FACES))
if ratio < 1.0:
    dm = body.modifiers.new('lod', 'DECIMATE'); dm.ratio = ratio
    while body.modifiers[0].name != 'lod': bpy.ops.object.modifier_move_up(modifier='lod')
    bpy.ops.object.modifier_apply(modifier='lod')
for o in list(bpy.data.objects):
    if o.type in ('LIGHT', 'CAMERA') or o is fl: bpy.data.objects.remove(o, do_unlink=True)
lod = os.path.join(OUT, 'npc_%s_lod1.glb' % TYPE)
bpy.ops.export_scene.gltf(filepath=lod, export_format='GLB', export_animations=True, export_nla_strips=True, export_skins=True, export_yup=True)
print('LOD1 faces', len(body.data.polygons), lod)

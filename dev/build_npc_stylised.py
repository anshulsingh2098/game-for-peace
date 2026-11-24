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
    'woman_top':   dict(sex='f', tee=True, top='shirt', sleeve='short', bottom='jeans',   hair='bun',   bag='shoulder', shoe='sneaker', skin=0xc89070, hairc=0x201510, topc=0xe9e2d2, botc=0x35507a, shoec=0xf0f0ee, accent=0x8a4a2a),
    'elder':       dict(sex='m', top='kurta', sleeve='long',  bottom='salwar',  hair='topi',  beard=True,   glasses=True, shoe='sandal', skin=0x9a6a4e, hairc=0xcfcfcf, topc=0xf0eee6, botc=0xf0eee6, shoec=0x4a3a2a, accent=0xf4f1e8),
    'vendor':      dict(sex='m', top='shirt', sleeve='long',  bottom='trousers', hair='short', stache=True,  scarf=True,  shoe='sandal', skin=0x8a5a44, hairc=0x15110e, topc=0xe9a23b, botc=0x3d4a5c, shoec=0x5a4636, accent=0xc8321f),
    'rider':       dict(sex='m', top='shirt', sleeve='long',  bottom='jeans',   hair='helmet', stache=True, gloves=True, shoe='sneaker', skin=0x9a6a4e, hairc=0x15110e, topc=0xffffff, botc=0x2b3a52, shoec=0x2a2a2d, accent=0xc8321f),
    'tourist':     dict(sex='m', tee=True, stripe=True, top='shirt', sleeve='short', bottom='shorts',  hair='cap',   backpack=True, sunglasses=True, shoe='sneaker', skin=0xe0b295, hairc=0x6a4a2a, topc=0x3fa7a0, botc=0xd9c9a3, shoec=0xf0f0ee, accent=0x2c5c8f),
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
for n, c, r, mt in [('Skin', T['skin'], 0.55, 0), ('Hair', T['hairc'], 0.75, 0), ('Top', T['topc'], 0.8, 0), ('Bottom', T['botc'], 0.85, 0), ('Shoe', T['shoec'], 0.55, 0), ('Sole', 0xb9b9b4, 0.7, 0),
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

def loft(secs, seg=14, cap_bot=True, cap_top=True, taper_front=None, fold=0.0, nf=4):
    """secs: [(z, cx, cy, rx, ry)] bottom to top; rings of `seg` points; returns a bmesh"""
    bm = bmesh.new(); rings = []
    for z, cx, cy, rx, ry in secs:
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg; f = 1 + fold * math.sin(nf * a + z * 9.0) * (1.0 if z < 1.2 else 0.4); ring.append(bm.verts.new((cx + rx * f * math.cos(a), cy + ry * f * math.sin(a), z)))
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
    w = [(0.84, .150, .095, 0), (0.92, .168, .106, 0), (1.00, .150, .096, 0), (1.10, .156, .100, -.002), (1.20, .172, .108, -.006), (1.28, .182, .110, -.010), (1.33, .203, .102, -.006), (1.37, .182, .088, -.002), (1.40, .118, .076, 0), (1.43, .072, .064, 0), (1.46, .056, .056, 0)]
    f = [(0.84, .152, .097, 0), (0.92, .182, .110, 0), (1.00, .138, .092, 0), (1.06, .124, .088, 0), (1.14, .134, .094, -.003), (1.22, .150, .114, -.016), (1.29, .156, .110, -.012), (1.335, .184, .098, -.005), (1.37, .162, .086, -.002), (1.40, .108, .074, 0), (1.43, .068, .062, 0), (1.46, .052, .052, 0)]
    base = f if FEM else w
    return [(z, 0.0, cy, (rx + grow) , (ry + grow * 0.8)) for z, rx, ry, cy in base]

def core(secs): return [x for x in secs if 0.915 <= x[0] <= 1.375]

def add_body():
    # skin of the torso is only seen at the neck; build it whole anyway (a top sits over it)
    finish('Torso', loft(torso_secs(), 16, True, False), 'Skin', 'torso')
    finish('Neck', loft([(1.38, 0, 0.004, .052, .052), (1.44, 0, 0.0, .048, .05), (1.50, 0, -.004, .046, .05)], 12, False, False), 'Skin', 'neck')
    for s, sd in ((1, 'L'), (-1, 'R')):
        # legs: thigh, knee, calf, ankle
        leg = [(0.075, s * .085, 0, .036, .040), (0.10, s * .085, 0, .037, .040), (0.16, s * .085, 0, .040, .043), (0.28, s * .085, .006, .052, .054), (0.40, s * .085, .008, .061, .060), (0.50, s * .085, 0, .060, .062), (0.56, s * .085, -.002, .066, .068),
               (0.68, s * .085, -.003, .082, .084), (0.80, s * .085, -.002, .092, .094), (0.90, s * .085, 0, .097, .098)]
        finish('Leg', loft(leg, 12, True, True), 'Skin', 'leg', sd)
        arm = [(0.78, s * .268, 0, .029, .030), (0.84, s * .268, 0, .031, .032), (0.95, s * .267, 0, .039, .040), (1.06, s * .265, 0, .040, .041), (1.20, s * .238, 0, .041, .043), (1.30, s * .210, 0, .041, .043), (1.36, s * .192, 0, .040, .043), (1.385, s * .17, 0, .032, .036), (1.405, s * .153, 0, .014, .018)]
        finish('Arm', loft(arm, 12, True, True), 'Skin', 'arm', sd)
        finish('Hand', ellip((s * .268, -.002, .722), (.027, .019, .052), 14, 10), 'Skin', 'hand', sd)
        finish('Thumb', ellip((s * .249, -.022, .75), (.010, .010, .026), 8, 6, Matrix.Rotation(s * 0.3, 3, 'Y')), 'Skin', 'hand', sd)
        for k, (fx, fz) in enumerate(((.012, .672), (.004, .668), (-.004, .672), (-.012, .682))):                                                 # four short fingers, slightly curled
            finish('Finger', ellip((s * (.268 + fx), -.006, fz), (.0075, .008, .022), 6, 5), 'Skin', 'hand', sd, 0)

def gs(d, r): return math.exp(-(d / r) ** 2)

def add_head():
    hz = 1.575
    bm = ellip((0, 0.0, hz), (.083, .099, .109), 36, 28)                                                                                     # a sculpted head: narrower jaw, chin, brow ridge, eye sockets, cheeks, mouth groove
    for v in bm.verts:
        x, y, z = v.co; dz = z - hz; t = sm(0.0, -.109, dz)
        x *= 1 - 0.30 * t ** 1.3; y *= 1 - 0.10 * t; dz *= 1 + 0.09 * t
        if y < 0:
            y -= .008 * gs(dz + .100, .022) * gs(x, .028)                                                                                       # chin
            y -= .006 * gs(dz - .027, .012) * gs(x, .06)                                                                                        # brow ridge
            for s in (1, -1):
                y += .0065 * gs(math.hypot(x - s * .0335, dz - .008), .019)                                                                     # eye sockets
                y -= .0045 * gs(math.hypot(x - s * .054, dz + .040), .03)                                                                       # cheeks
            y += .0035 * gs(dz + .0685, .0045) * gs(x, .022)                                                                                    # mouth groove
        v.co = (x, y, hz + dz)
    finish('Head', bm, 'Skin', 'head')
    finish('NoseBridge', ellip((0, -.0905, hz - .004), (.0060, .010, .021), 10, 8, Matrix.Rotation(0.2, 3, 'X')), 'Skin', 'head', '', 0)
    finish('NoseTip', ellip((0, -.0985, hz - .031), (.0092, .0105, .0088), 10, 8), 'Skin', 'head', '', 0)
    for s in (1, -1):
        finish('NoseWing', ellip((s * .0095, -.0945, hz - .0325), (.0062, .0085, .007), 8, 6), 'Skin', 'head', '', 0)
        finish('Ear', ellip((s * .0845, .004, hz - .006), (.0095, .02, .029), 10, 8), 'Skin', 'head', '', 0)
        finish('EyeW', ellip((s * .0335, -.088, hz + .008), (.0122, .0088, .0122), 12, 10), 'Eye', 'head', '', 0)
        finish('Iris', ellip((s * .0335, -.0948, hz + .008), (.0077, .004, .0077), 10, 8), 'Iris', 'head', '', 0)
        finish('Pupil', ellip((s * .0335, -.0978, hz + .008), (.0034, .0025, .0034), 8, 6), 'Pupil', 'head', '', 0)
        finish('Lid', cut(ellip((s * .0335, -.0875, hz + .0085), (.0132, .0098, .0132), 12, 10), (0, 0, hz + .0095), (0, 0.12, 1.0)), 'Skin', 'head', '', 0)   # upper eyelid
        finish('Brow', box((s * .034, -.0905, hz + .0315), (.030, .0072, .0055)), 'Hair', 'head', '', 0)
    finish('Lip', ellip((0, -.0885, hz - .0625), (.021, .0068, .0062), 12, 8), 'Lip', 'head', '', 0)
    finish('LipLow', ellip((0, -.0868, hz - .0745), (.0165, .0066, .0058), 12, 8), 'Lip', 'head', '', 0)

def hair_cap(scale=1.0, back=0.014, lift=0.012, low=0.0):
    bm = ellip((0, back, 1.575 + lift), (.0895 * scale, .106 * scale, .117 * scale), 40, 28)
    cut(bm, (0, 0, 1.575 - low), (0, 1.22, 1.0)); return bm                                    # hairline: higher at the front, lower at the back

def merge(bms):
    bm = bmesh.new()
    for b2 in bms:
        me = bpy.data.meshes.new('t'); b2.to_mesh(me); b2.free(); bm.from_mesh(me); bpy.data.meshes.remove(me)
    return bm

def strand(P, d, L, r, seg=6, rings=4):
    """a thin tapered lock of hair: an elongated ellipsoid starting at P and running along d"""
    d = Vector(d).normalized(); rot = d.to_track_quat('Z', 'Y').to_matrix()
    return ellip(Vector(P) + d * L / 2, (r, r * .85, L / 2), seg, rings, rot)

def cap_pt(phi, th, k=1.04):
    """a point on the hair cap (phi from the crown down, th around: 0 = front) and the direction running down the surface"""
    sp, cp, st, ct = math.sin(phi), math.cos(phi), math.sin(th), math.cos(th)
    P = Vector((.0895 * sp * st * k, .014 - .106 * sp * ct * k, 1.587 + .117 * cp * k))
    return P, Vector((.0895 * cp * st, -.106 * cp * ct, -.117 * sp)).normalized()

def hairline(y, low=0.0): return 1.575 - 1.22 * y - low

def cap_strands(rings, count, L, r, low=0.0, swirl=0.0, bias=None, wob=0.0):
    out = []
    for i, phi in enumerate(rings):
        n = count(phi)
        for j in range(n):
            th = 2 * math.pi * (j + .5 * (i % 2)) / n
            P, d = cap_pt(phi, th)
            if bias is not None: d = (d + bias(P, th)).normalized()
            d = (d + Vector((math.cos(th + 1.57) * swirl, math.sin(th + 1.57) * swirl, 0))).normalized()
            l = L * (1 - .25 * ((j * 7 + i * 3) % 5) / 4)
            E = P + d * l
            if P.z < hairline(P.y, low) + .004: continue
            while l > .02 and E.z < hairline(E.y, low) - .002: l -= .008; E = P + d * l
            out.append(strand(P - d * .01, d, l + .01, r * (1 + wob * ((j * 3 + i) % 3 - 1))))
    return out

def add_hair():
    h = T['hair']
    if h == 'short': finish('HairCap', hair_cap(), 'Hair', 'head', '', 0)
    elif h == 'side':
        finish('HairCap', hair_cap(1.01, 0.012, 0.014), 'Hair', 'head', '', 0); finish('HairPart', ellip((-.03, -.035, 1.672), (.04, .055, .018), 12, 8, Matrix.Rotation(0.3, 3, 'Y')), 'Hair', 'head', '', 0)
    elif h == 'long':
        finish('HairCap', hair_cap(1.02, 0.016, 0.016, 0.02), 'Hair', 'head', '', 0)
        finish('HairBack', loft([(1.27, 0, .095, .075, .042), (1.36, 0, .092, .095, .058), (1.48, 0, .075, .10, .078), (1.58, 0, .05, .098, .095), (1.64, 0, .03, .082, .10), (1.68, 0, .02, .05, .075)], 14, True, False), 'Hair', 'longhair')
    elif h == 'bun':
        finish('HairCap', hair_cap(1.01, 0.014, 0.012, 0.01), 'Hair', 'head', '', 0); finish('Bun', ellip((0, .07, 1.70), (.04, .04, .04), 12, 10), 'Hair', 'head', '', 0)
    elif h == 'topi':
        finish('Topi', loft([(1.605, 0, 0.0, .087, .104), (1.615, 0, 0.0, .091, .108), (1.67, 0, 0.0, .088, .104), (1.69, 0, 0.0, .075, .09)], 18, False, True), 'Accent', 'head')
        finish('HairSide', ellip((0, .035, 1.58), (.09, .09, .06), 16, 10), 'Hair', 'head', '', 0)
    elif h == 'cap':
        finish('HairNape', ellip((0, .06, 1.56), (.085, .05, .05), 14, 10), 'Hair', 'head', '', 0)
        finish('CapCrown', loft([(1.625, 0, 0.0, .094, .112), (1.68, 0, 0.0, .098, .115), (1.725, 0, 0.0, .088, .105), (1.74, 0, 0.0, .05, .06)], 18, False, True), 'Accent', 'head')
        finish('CapBrim', ellip((0, -.115, 1.645), (.075, .07, .008), 14, 8, Matrix.Rotation(-0.1, 3, 'X')), 'Accent', 'head', '', 0)
    st = []
    if h == 'short':
        st = cap_strands((.30, .55, .80, 1.05, 1.28), lambda f: int(7 + 12 * math.sin(f)), .06, .0075, 0.0, .2, None, .12)
        for s2 in (1, -1): st += [strand((s2 * .084, .004, 1.585), (s2 * .1, .15, -1.0), .048, .0085), strand((s2 * .0835, -.014, 1.600), (s2 * .1, .1, -1.0), .036, .0075)]        # sideburns
    elif h == 'side':
        st = cap_strands((.30, .55, .80, 1.05, 1.28), lambda f: int(7 + 12 * math.sin(f)), .065, .0078, 0.0, .1, lambda P, th: Vector((-.7, 0, 0)) if P.x < .02 else Vector((.4, 0, 0)), .15)    # swept to the right of the part
        for s2 in (1, -1): st += [strand((s2 * .084, .004, 1.585), (s2 * .1, .15, -1.0), .05, .0085)]
    elif h == 'bun':
        st = []
        for i, phi in enumerate((.55, .8, 1.05, 1.28)):
            n = int(6 + 8 * math.sin(phi))
            for j in range(n):
                th = 2 * math.pi * (j + .5 * (i % 2)) / n; P, d = cap_pt(phi, th); tgt = (Vector((0, .07, 1.70)) - P).normalized(); d = (d * .65 + tgt * .35).normalized()
                if P.z < hairline(P.y, .01) + .004: continue
                st.append(strand(P - d * .012, d, .05, .0072))
        finish('HairTie', loft([(1.678, 0, .07, .044, .044), (1.69, 0, .07, .047, .047), (1.70, 0, .07, .044, .044)], 12, False, False), 'Accent', 'head', '', 0)
    elif h == 'long':
        st = cap_strands((.35, .6, .85, 1.1, 1.3), lambda f: int(7 + 10 * math.sin(f)), .075, .0085, .02, .12, None, .1)
        fr = [strand((s2 * .079, -.02, 1.60), (s2 * .25, -.08, -1.0), .26, .0125) for s2 in (1, -1)]                                                       # two locks falling in front of the shoulders
        finish('HairFront', merge(fr), 'Hair', 'longhair', '', 0)
    elif h == 'topi':
        for s2 in (1, -1): st += [strand((s2 * .083, .012 + .012 * k, 1.60 - .012 * k), (s2 * .1, .2, -1.0), .05 - .005 * k, .0085) for k in range(3)]
    if st: finish('HairStrands', merge(st), 'Hair', 'head', '', 0)
    if h == 'helmet':                                                                                                                           # an open-face motorcycle helmet: a hard shell, a rim and a chin strap
        bm = ellip((0, .012, 1.592), (.103, .122, .121), 36, 26); cut(bm, (0, 0, 1.556), (0, .55, 1.0)); finish('Helmet', bm, 'Accent', 'head', '', 0)
        finish('HelmetRim', loft([(1.612, 0, -.056, .0, .0)], 4, False, False), 'Accent', 'head', '', 0) if False else None
        for s2 in (1, -1): finish('Strap', box((s2 * .066, -.02, 1.51), (.008, .02, .09), 0), 'Shoe', 'head', '', 0, False)
    if T.get('stache'): finish('Stache', ellip((0, -.095, 1.526), (.03, .012, .007), 10, 8), 'Hair', 'head', '', 0)
    if T.get('beard'): finish('Beard', ellip((0, -.068, 1.474), (.042, .03, .024), 16, 10), 'Hair', 'head', '', 0)
    if T.get('glasses') or T.get('sunglasses'):
        for s in (1, -1):
            if T.get('sunglasses'): finish('Lens', ellip((s * .0335, -.1055, 1.583), (.0185, .0035, .0135), 12, 8), 'Glass', 'head', '', 0)
            else:                                                                                                                              # clear glasses: a thin metal rim round each eye
                rim = bmesh.new(); N, M = 20, 6
                vs = [[rim.verts.new(((.0185 + .0014 * math.cos(b2)) * math.cos(a2), 0.0014 * math.sin(b2), (.0135 + .0014 * math.cos(b2)) * math.sin(a2))) for b2 in [2 * math.pi * j / M for j in range(M)]] for a2 in [2 * math.pi * i / N for i in range(N)]]
                for i in range(N):
                    for j in range(M): rim.faces.new((vs[i][j], vs[i][(j + 1) % M], vs[(i + 1) % N][(j + 1) % M], vs[(i + 1) % N][j]))
                bmesh.ops.transform(rim, matrix=Matrix.Translation((s * .0335, -.1055, 1.583)), verts=rim.verts[:]); finish('Rim', rim, 'Metal', 'head', '', 0)
        finish('Bridge', box((0, -.106, 1.59), (.02, .004, .004)), 'Metal', 'head', '', 0)
        for s in (1, -1): finish('Temple', box((s * .0865, -.052, 1.59), (.004, .105, .004)), 'Metal', 'head', '', 0)

def add_clothes():
    top, sl, bot = T['top'], T['sleeve'], T['bottom']
    secs = torso_secs(0.011)
    TUCK = top == 'shirt' and bot != 'shorts'
    if top == 'shirt': secs = ([] if TUCK else [(0.78, 0, 0, .206, .126), (0.86, 0, 0, .2, .124)]) + core(secs)
    elif top == 'kurta': secs = [(0.56, 0, 0, .19, .122), (0.66, 0, 0, .192, .122), (0.76, 0, 0, .2, .124), (0.86, 0, 0, .205, .126)] + core(secs)
    elif top == 'kurti': secs = [(0.60, 0, 0, .215, .135), (0.72, 0, 0, .205, .128), (0.86, 0, 0, .2, .122)] + core(secs)
    secs = [(z, cx, cy, rx, ry) for z, cx, cy, rx, ry in secs]
    shirt = loft(secs + [(1.395, 0, 0, .122, .09), (1.425, 0, 0, .088, .074)], 24, False, False, None, .006 if top == 'shirt' else .008, 5)
    finish('Top', shirt, 'Top', 'torso')
    def front_y(z):
        for (z0, _, c0, _, r0), (z1, _, c1, _, r1) in zip(secs, secs[1:]):
            if z0 <= z <= z1: t = (z - z0) / (z1 - z0); return (c0 - r0) * (1 - t) + (c1 - r1) * t
        return -.11
    def prof(z):
        for (z0, _, c0, r0x, r0), (z1, _, c1, r1x, r1) in zip(secs, secs[1:]):
            if z0 <= z <= z1: t = (z - z0) / (z1 - z0); return c0 * (1 - t) + c1 * t, r0x * (1 - t) + r1x * t, r0 * (1 - t) + r1 * t
        return 0.0, .17, .11
    tee = T.get('tee')
    if top in ('shirt', 'kurta', 'kurti') and not tee:                                                                                          # buttons down the front, and a turned-down collar on a shirt
        for z in ((1.30, 1.22, 1.14, 1.06, .98) if top == 'shirt' else (1.30, 1.23, 1.16)):
            if z > secs[0][0] + .02: finish('Button', ellip((0, front_y(z) - .002, z), (.0065, .0035, .0065), 8, 6), 'Sole' if top == 'shirt' else 'Accent', 'chest', '', 0)
    if top == 'shirt' and not tee:
        for s2 in (1, -1): finish('CollarFlap', ellip((s2 * .038, -.064, 1.41), (.024, .009, .015), 10, 8, Matrix.Rotation(-s2 * 0.7, 3, 'Y')), 'Top', 'neck', '', 0)
        cy, rx, ry = prof(1.19); finish('Pocket', box((.07, cy - ry - .002, 1.19), (.05, .006, .056), 0), 'Top', 'chest', '', 0)                  # a chest pocket
        finish('PocketFlap', box((.07, cy - ry - .0045, 1.222), (.054, .007, .014), 0), 'Top', 'chest', '', 0)
    if tee:                                                                                                                                     # a ribbed round neck, and on some a chest stripe
        finish('NeckRib', loft([(1.40, 0, .004, .074, .07), (1.428, 0, .003, .066, .064)], 16, False, False), 'Accent', 'neck', '', 0)
        if T.get('stripe'):
            for z0 in (1.12, 1.19):
                cy, rx, ry = prof(z0 + .02); finish('Stripe', loft([(z0, 0, cy, rx + .004, ry + .004), (z0 + .04, 0, cy, rx + .004, ry + .004)], 24, False, False), 'Accent', 'chest', '', 0)
    if top in ('kurta', 'kurti'):                                                                                                               # embroidered neckline and hem borders
        finish('NeckTrim', loft([(1.388, 0, .004, .071, .067), (1.402, 0, .004, .069, .065)], 16, False, False), 'Accent', 'neck', '', 0)
        z0 = secs[0][0]; cy, rx, ry = prof(z0 + .035)
        finish('HemTrim', loft([(z0 - .002, 0, secs[0][2], secs[0][3] + .006, secs[0][4] + .006), (z0 + .05, 0, cy, rx + .006, ry + .006)], 24, False, False), 'Accent', 'torso', '', 0)
    finish('Collar', loft([(1.395, 0, 0.004, .066, .062), (1.435, 0, 0.002, .058, .056)], 14, False, False), 'Top', 'neck')
    if T.get('scarf'): finish('Scarf', loft([(1.37, 0, -.01, .105, .1), (1.42, 0, -.012, .08, .085), (1.46, 0, -.006, .068, .07)], 14, False, False), 'Accent', 'neck')
    if T.get('dupatta'):                                                                                                                       # a narrow scarf over the left shoulder, hanging down the front
        finish('Dupatta', loft([(0.78, 0.115, -.122, .034, .012), (0.95, 0.12, -.121, .040, .013), (1.12, 0.115, -.118, .046, .014), (1.28, 0.09, -.112, .05, .016), (1.39, 0.045, -.1, .05, .02)], 12, True, True), 'Accent', 'chest')
    for s, sd in ((1, 'L'), (-1, 'R')):
        zend = 1.12 if sl == 'short' else 0.80
        base = [(0.80, s * .268, 0, .029, .03), (0.84, s * .268, 0, .031, .032), (0.95, s * .267, 0, .039, .04), (1.06, s * .265, 0, .040, .041), (1.20, s * .238, 0, .041, .043), (1.30, s * .210, 0, .041, .043), (1.36, s * .192, 0, .040, .043), (1.385, s * .17, 0, .032, .036), (1.405, s * .153, 0, .014, .018)]
        sec = [(z, cx, cy, rx + 0.005, ry + 0.005) for z, cx, cy, rx, ry in base if z >= zend - 0.001]
        if sl == 'long': sec = [(0.80, s * .268, 0, .042, .043)] + sec[1:]
        else: sec = [(zend, s * (.265 - (zend - 1.06) * 0.3), 0, .046, .047)] + [x for x in sec if x[0] > zend + 0.01]
        finish('Sleeve', loft(sec, 12, False, True), 'Top', 'arm', sd)
        ze = sec[0][0]; cx0 = sec[0][1]; r0 = sec[0][3]
        finish('Cuff', loft([(ze - .004, cx0, 0, r0 + .008, r0 + .009), (ze + .026, cx0, 0, r0 + .007, r0 + .008)], 12, False, False), 'Accent' if top == 'kurti' else 'Top', 'arm', sd, 0)
    # trousers
    for s, sd in ((1, 'L'), (-1, 'R')):
        if bot in ('jeans', 'trousers'):
            k = .007 if bot == 'jeans' else .014
            leg = [(0.075, .040 + k, .043 + k), (0.16, .043 + k, .046 + k), (0.28, .054 + k, .057 + k), (0.40, .062 + k, .062 + k), (0.50, .061 + k, .064 + k), (0.56, .067 + k, .07 + k), (0.68, .083 + k, .086 + k), (0.80, .093 + k, .097 + k), (0.90, .098 + k, .1 + k)]
        elif bot == 'salwar':
            leg = [(0.075, .045, .048), (0.14, .052, .055), (0.30, .085, .09), (0.46, .098, .102), (0.62, .108, .112), (0.76, .112, .116), (0.90, .108, .108)]
        else:                                                                                                                                      # shorts
            leg = [(0.50, .083, .086), (0.56, .08, .084), (0.68, .092, .096), (0.80, .099, .103), (0.90, .103, .104)]
        finish('Pants', loft([(z, s * .085, 0, rx * (0.93 if z >= 0.78 else 1.0), ry * (0.93 if z >= 0.78 else 1.0)) for z, rx, ry in leg], 12, False, True, None, .005 if bot == 'salwar' else .003, 3), 'Bottom', 'leg', sd)
    finish('Hip', loft([(0.84, 0, 0, .156, .098), (0.90, 0, 0, .178, .114), (0.97, 0, 0, .172, .108)], 16, True, True), 'Bottom', 'hips')
    if bot in ('jeans', 'trousers') and top == 'shirt' and TUCK:
        finish('Belt', loft([(0.898, 0, 0, .189, .123), (0.935, 0, 0, .189, .123)], 16, False, False), 'Accent', 'hips', '', 0)
        finish('Buckle', box((0, -.1255, .9165), (.03, .007, .028), 0), 'Metal', 'hips', '', 0)
    if bot in ('jeans', 'trousers'):
        for s2 in (1, -1): finish('Hem', loft([(.074, s2 * .085, 0, .052, .055), (.112, s2 * .085, 0, .05, .053)], 12, False, False), 'Bottom', 'leg', 'L' if s2 == 1 else 'R', 0)

def loftY(secs, dx, seg=14):
    """a loft along the foot's length: secs = [(y, centre z, half width, half height)], heel (+y) to toe (-y)"""
    bm = bmesh.new(); rings = []
    for y, cz, rx, rz in secs:
        rings.append([bm.verts.new((dx + rx * math.cos(2 * math.pi * i / seg), y, cz + rz * math.sin(2 * math.pi * i / seg))) for i in range(seg)])
    for r in range(len(rings) - 1):
        for i in range(seg): bm.faces.new((rings[r][i], rings[r][(i + 1) % seg], rings[r + 1][(i + 1) % seg], rings[r + 1][i]))
    bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1]); bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); return bm

def add_shoes():
    for s, sd in ((1, 'L'), (-1, 'R')):
        dx = s * .085
        if T['shoe'] == 'sneaker':
            # upper: a heel counter, a collar round the ankle, a low instep with laces, a rounded toe box; a thick sole in a slightly different shade
            finish('Shoe', loftY([(.098, .052, .029, .042), (.078, .068, .036, .054), (.045, .074, .040, .047), (.0, .062, .043, .040), (-.05, .050, .044, .033), (-.10, .040, .043, .028), (-.15, .032, .038, .022), (-.185, .026, .024, .016), (-.196, .024, .012, .011)], dx), 'Shoe', 'foot', sd)
            finish('Sole', loftY([(.104, .018, .032, .018), (.06, .017, .043, .017), (-.02, .017, .051, .017), (-.10, .018, .054, .018), (-.16, .022, .046, .021), (-.2, .029, .026, .017)], dx), 'Sole', 'foot', sd)
        else:
            # a bare foot (heel, arch, instep, toes) on a thin leather sole with a toe-post strap and a heel strap
            finish('FootSkin', loftY([(.092, .045, .028, .038), (.07, .06, .036, .05), (.03, .062, .042, .052), (-.03, .05, .047, .042), (-.09, .04, .051, .032), (-.14, .033, .049, .025), (-.175, .028, .038, .02)], dx), 'Skin', 'foot', sd)
            for k, (tx, tl, tz) in enumerate(((-.034, .02, .017), (-.016, .02, .017), (0.002, .018, .016), (.018, .016, .014), (.033, .013, .012))):
                finish('Toe', ellip((dx + s * tx * -1, -.19 - (tl - .02) * 0.5, tz + .008), (.0105, .016 + tl * .3, .0095), 8, 6), 'Skin', 'foot', sd, 0)
            finish('Sole', loftY([(.1, .0065, .034, .0065), (.0, .0065, .05, .0065), (-.1, .0075, .056, .0075), (-.19, .0085, .044, .0085)], dx), 'Shoe', 'foot', sd)
            finish('Strap', loftY([(-.052, .047, .056, .052), (-.082, .042, .054, .048)], dx), 'Shoe', 'foot', sd, 0)
            finish('Strap2', loftY([(.07, .063, .042, .054), (.098, .056, .036, .05)], dx), 'Shoe', 'foot', sd, 0)

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

def ride(t):
    pb['Hips'].location = (0, -0.03, -0.30)                                                                                        # sits on the seat, a little behind the middle of the bike
    pb['Spine'].rotation_euler.x = 0.50; pb['Chest'].rotation_euler.x = 0.18; pb['Head'].rotation_euler.x = -0.58
    for sd, k in (('L', 1), ('R', -1)):
        pb['UpperLeg_' + sd].rotation_euler.x = -1.30; pb['UpperLeg_' + sd].rotation_euler.z = -0.06 * k
        pb['LowerLeg_' + sd].rotation_euler.x = 1.45; pb['Foot_' + sd].rotation_euler.x = -0.15
        pb['UpperArm_' + sd].rotation_euler.x = -1.95; pb['UpperArm_' + sd].rotation_euler.z = 0.04 * k
        pb['LowerArm_' + sd].rotation_euler.x = -0.30; pb['Hand_' + sd].rotation_euler.x = -0.25

ACTS = [('Walk', 24, walk), ('Run', 16, run), ('Idle', 96, idle), ('IdleLook', 72, look), ('Wait', 48, wait), ('Ride', 1, ride)]
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
shot('headside', (1.0, 0.7, 1.62), target=(0, 0, 1.52), clip='Idle', frame=1)
shot('feet', (0.75, -0.8, 0.32), target=(0, -0.02, 0.07), clip='Idle', frame=1)
if TYPE == 'rider': shot('ride', (4.2, -0.1, 0.95), target=(0, -0.1, 0.9), clip='Ride', frame=1); shot('ride3', (2.6, -2.8, 1.3), target=(0, -0.1, 0.9), clip='Ride', frame=1)
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

"""Shared car-building kit for Blender (run through a build_car*.py script, not directly).

Builds a production-car-style model: one continuous body surface (nose, wings, shoulder line, glasshouse, tail) made from cross-sections along
the car, split into 'Body' (everything below the glasshouse and the hood/boot decks) and 'Cabin' (the glasshouse, which the game hides in the
driver's view), plus lamps, grille, mirrors, handles, plates, exhausts, an interior and detailed wheels.

What the game relies on (do not change): the car faces -Y in Blender (+Z in glTF) with its origin on the ground at the middle; four wheel pivots
named Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR at the axle positions, each with one child mesh Wheel_XX_Mesh; an object named Cabin; materials
named Glass, Light_Head, Light_Tail and Paint_*; Chrome, Tyre, Rim, Trim_Black, Carbon, Disc, Caliper for the rest. Units are metres.
"""
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

scene = None
M = {}
root = None

# ------------------------------------------------------------------ setup and materials
def setup(name):
    global scene, root
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    M.clear(); M.update(materials())                 # in place, so scripts that imported M keep seeing the materials
    root = bpy.data.objects.new(name, None); scene.collection.objects.link(root)
    return root

def mat(name, color, metal=0.0, rough=0.5, emit=None, emit_s=0.0, coat=0.0, coat_rough=0.03, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        try: b.inputs['Coat Roughness'].default_value = coat_rough
        except KeyError: pass
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = emit_s
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
        try: m.blend_method = 'BLEND'
        except Exception: pass
    return m

def materials():
    return {
        'glass':   mat('Glass',        (0.015, 0.025, 0.04), 0.0, 0.04, alpha=0.55),
        'tyre':    mat('Tyre',         (0.012, 0.012, 0.014), 0.0, 0.88),
        'rim':     mat('Rim',          (0.30, 0.31, 0.34), 1.0, 0.32),
        'trim':    mat('Trim_Black',   (0.015, 0.015, 0.02), 0.1, 0.55),
        'carbon':  mat('Carbon',       (0.03, 0.03, 0.035), 0.5, 0.3),
        'head':    mat('Light_Head',   (0.92, 0.92, 0.88), 0.0, 0.08, emit=(1, 0.95, 0.8), emit_s=0.6),
        'tail':    mat('Light_Tail',   (0.75, 0.02, 0.02), 0.0, 0.15, emit=(1, 0.05, 0.03), emit_s=1.5),
        'amber':   mat('Trim_Amber',   (0.95, 0.45, 0.02), 0.0, 0.2),
        'disc':    mat('Disc',         (0.36, 0.37, 0.40), 1.0, 0.35),
        'caliper': mat('Caliper',      (0.75, 0.05, 0.04), 0.2, 0.4),
        'chrome':  mat('Chrome',       (0.9, 0.9, 0.92), 1.0, 0.08),
        'plate':   mat('Plate',        (0.85, 0.85, 0.82), 0.0, 0.5),
        'plateY':  mat('Plate_Yellow', (0.85, 0.62, 0.05), 0.0, 0.5),
        'seat':    mat('Interior_Seat', (0.08, 0.08, 0.09), 0.0, 0.8),
        'dash':    mat('Interior_Dash', (0.05, 0.05, 0.06), 0.0, 0.7),
    }

# ------------------------------------------------------------------ small helpers
def link(obj, parent=None):
    scene.collection.objects.link(obj)
    if parent: obj.parent = parent
    return obj

def mesh_obj(name, verts, faces, mats=None):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for m in (mats or []): me.materials.append(m)
    return bpy.data.objects.new(name, me)

def activate(obj):
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.selected_objects: o.select_set(False)
    obj.select_set(True)

def apply_mod(obj, mod):
    activate(obj); bpy.ops.object.modifier_apply(modifier=mod.name)

def prim(kind, name, loc, size, matkey, rot=(0, 0, 0), parent=None, verts=24, bevel=0.0, smooth=True):
    if kind == 'box': bpy.ops.mesh.primitive_cube_add(size=1)
    elif kind == 'cyl': bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=0.5, depth=1)
    elif kind == 'sph': bpy.ops.mesh.primitive_uv_sphere_add(segments=verts, ring_count=max(8, verts // 2), radius=0.5)
    elif kind == 'cone': bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=0.5, radius2=0.0, depth=1)
    o = bpy.context.active_object; o.name = name
    o.scale = size; o.location = loc; o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(M[matkey] if isinstance(matkey, str) else matkey)
    if bevel:
        bm = o.modifiers.new('bv', 'BEVEL'); bm.width = bevel; bm.segments = 2
        apply_mod(o, bm)
    if smooth: bpy.ops.object.shade_smooth()
    o.parent = parent if parent is not None else root
    return o

def lathe(name, profile, loc, rot, matkey, parent=None, segs=48):
    """Solid of revolution about the local Z axis from (radius, z) profile points, then placed and rotated."""
    verts, faces = [], []
    n = len(profile)
    for r, z in profile:
        for k in range(segs):
            a = 2 * math.pi * k / segs
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(n - 1):
        for k in range(segs):
            a = i * segs + k; b = i * segs + (k + 1) % segs
            faces.append((a, b, b + segs, a + segs))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    me.materials.append(M[matkey] if isinstance(matkey, str) else matkey)
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); link(o, parent if parent is not None else root)
    o.location = loc; o.rotation_euler = rot
    return o

def smooth_fn(xs, ys):
    """Cubic Hermite through (xs, ys) with Catmull-Rom style tangents: smooth curves from a few knots."""
    xs = np.array(xs, float); ys = np.array(ys, float); n = len(xs)
    m = np.zeros(n)
    for i in range(n):
        if i == 0: m[i] = (ys[1] - ys[0]) / (xs[1] - xs[0])
        elif i == n - 1: m[i] = (ys[-1] - ys[-2]) / (xs[-1] - xs[-2])
        else: m[i] = (ys[i + 1] - ys[i - 1]) / (xs[i + 1] - xs[i - 1])
    def f(x):
        x = min(max(x, xs[0]), xs[-1]); i = int(np.searchsorted(xs, x, side='right') - 1); i = min(max(i, 0), n - 2)
        h = xs[i + 1] - xs[i]; t = (x - xs[i]) / h
        h00 = 2 * t**3 - 3 * t**2 + 1; h10 = t**3 - 2 * t**2 + t; h01 = -2 * t**3 + 3 * t**2; h11 = t**3 - t**2
        return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1]
    return f

# ------------------------------------------------------------------ the body loft
K = 12      # points on the right half of a cross-section, bottom centre to roof centre
def section(y, S, cab):
    """Right-half points (x, z) of the cross-section at y. S holds the knot functions; cab says whether y is inside the glasshouse."""
    zb, zbelt, zroof = S['zb'](y), S['zbelt'](y), S['zroof'](y)
    wsill, wmax, wbelt, wroof = S['wsill'](y), S['wmax'](y), S['wbelt'](y), S['wroof'](y)
    H = max(zroof - zbelt, 0.0)
    P = []
    P.append((0.0, zb))                                                            # 0 underbody centre
    P.append((wsill - 0.10, zb))                                                   # 1 underbody edge
    P.append((wsill, zb + 0.06))                                                   # 2 sill corner
    P.append((0.5 * (wsill + wmax) + 0.01, zb + 0.34 * (zbelt - zb)))              # 3 lower side
    P.append((wmax, zb + 0.70 * (zbelt - zb)))                                     # 4 widest point of the flank
    P.append((0.5 * (wmax + wbelt) + 0.005, zbelt - 0.035))                        # 5 shoulder
    P.append((wbelt, zbelt))                                                       # 6 beltline crest
    if H > 0.05:                                                                   # glasshouse: tumblehome inwards
        P.append((wbelt - 0.045, zbelt + 0.045))                                   # 7 window base
        P.append((wbelt - 0.045 - 0.50 * (wbelt - 0.045 - wroof), zbelt + 0.55 * H))   # 8 window middle
        P.append((wroof, zroof - 0.045 * min(1.0, H / 0.2)))                       # 9 roof edge
        P.append((wroof * 0.55, zroof - 0.006))                                    # 10 roof quarter
        P.append((0.0, zroof))                                                     # 11 roof centre
    else:                                                                          # deck: a gentle crown across the width
        crown = zroof - zbelt
        for k, (fx, fz) in enumerate([(0.93, 0.18), (0.80, 0.42), (0.62, 0.66), (0.36, 0.88), (0.0, 1.0)]):
            P.append((wbelt * fx, zbelt + crown * fz + (0.012 if k == 0 else 0.0)))
    return P

def build_loft(name, S, ys, cab_range, windows, paint_keys, crease_belt=0.8):
    """S: knot functions; ys: station positions (front to rear); cab_range: (y0, y1) of the glasshouse;
    windows: list of (y0, y1, kind) with kind 'ws' windshield, 'side' side windows, 'pil' pillar, 'rw' rear window, 'roof'.
    Returns (body_obj, cabin_obj)."""
    ring = []
    verts = []
    for y in ys:
        cab = cab_range[0] <= y <= cab_range[1]
        P = section(y, S, cab)
        right = [(x, y, z) for x, z in P]
        left = [(-x, y, z) for x, z in P[-2:0:-1]]
        verts.extend(right + left)
    R = 2 * K - 2
    faces, fmat, fcab = [], [], []
    def kind_at(ym):
        for y0, y1, k in windows:
            if y0 <= ym < y1: return k
        return 'roof'
    for i in range(len(ys) - 1):
        ym = 0.5 * (ys[i] + ys[i + 1]); in_cab = cab_range[0] <= ys[i] and ys[i + 1] <= cab_range[1]; kind = kind_at(ym) if in_cab else None
        for j in range(R):
            a = i * R + j; b = i * R + (j + 1) % R
            faces.append((a, b, b + R, a + R))
            seg = j if j < K - 1 else (R - j - 1) if j < R else j        # segment index counted from the bottom on either side (mirrored)
            if j >= K - 1: seg = (2 * K - 3) - j
            glass = False
            if in_cab and seg >= 7:
                if kind == 'ws' or kind == 'rw': glass = seg in (8, 9, 10)
                elif kind == 'side': glass = seg in (7, 8)
            fmat.append(1 if glass else 0); fcab.append(bool(in_cab and seg >= 6))
    # end caps: fans to the centre of the first and last ring
    for idx, i in ((0, 0), (1, len(ys) - 1)):
        base = i * R; c = len(verts); cx = sum(v[0] for v in verts[base:base + R]) / R; cy = verts[base][1]; cz = sum(v[2] for v in verts[base:base + R]) / R
        verts.append((cx, cy, cz))
        for j in range(R):
            a = base + j; b = base + (j + 1) % R
            faces.append((a, b, c) if idx == 0 else (b, a, c)); fmat.append(0); fcab.append(False)
    mats = [M[paint_keys[0]] if isinstance(paint_keys[0], str) else paint_keys[0], M['glass']]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for m in mats: me.materials.append(m)
    for p, mi in zip(me.polygons, fmat): p.material_index = mi
    body = bpy.data.objects.new(name, me); link(body, root)
    # split the glasshouse off into its own object
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    cab_faces = [f for f, c in zip(bm.faces, fcab) if c]
    cm = bpy.data.meshes.new('Cabin'); cbm = bmesh.new()
    vmap = {}
    for f in cab_faces:
        nv = []
        for v in f.verts:
            if v.index not in vmap: vmap[v.index] = cbm.verts.new(v.co)
            nv.append(vmap[v.index])
        nf = cbm.faces.new(nv); nf.material_index = f.material_index
    bmesh.ops.delete(bm, geom=cab_faces, context='FACES')
    bm.to_mesh(me); bm.free(); cbm.to_mesh(cm); cbm.free()
    for m in mats: cm.materials.append(m)
    cabin = bpy.data.objects.new('Cabin', cm); link(cabin, root)
    return body, cabin

def smooth_shade(obj, crease_angle=38):
    for p in obj.data.polygons: p.use_smooth = True
    try:
        activate(obj); bpy.ops.object.shade_auto_smooth(angle=math.radians(crease_angle))
        for mod in list(obj.modifiers):
            if 'mooth' in mod.name or 'ngle' in mod.name: apply_mod(obj, mod)
    except Exception as e:
        print('auto smooth skipped:', e)

def subdivide(obj, levels=1):
    sub = obj.modifiers.new('s', 'SUBSURF'); sub.levels = levels; sub.render_levels = levels; sub.quality = 3
    apply_mod(obj, sub)

def arches(body, positions, radius, width, trim_key='trim'):
    """Cut wheel arches through the body and add a dark wheel-house liner so the openings have depth."""
    for sx, wy, wz in positions:
        bpy.ops.mesh.primitive_cylinder_add(vertices=56, radius=radius, depth=width, location=(sx, wy, wz), rotation=(0, math.pi / 2, 0))
        cut = bpy.context.active_object
        bm = body.modifiers.new('arch', 'BOOLEAN'); bm.object = cut; bm.operation = 'DIFFERENCE'; bm.solver = 'EXACT'
        apply_mod(body, bm); bpy.data.objects.remove(cut)
    for sx, wy, wz in positions:                                                  # liner: a half barrel behind the opening, open at the bottom
        o = lathe('Liner', [(radius - 0.015, -width * 0.30), (radius - 0.015, width * 0.30)], (sx - sx * 0.0, wy, wz), (0, math.pi / 2, 0), trim_key, segs=40)
        o.location = (sx * (abs(sx) * 0.0 + 0.0) + sx * 0.0 + sx * (abs(sx) and 0.86), wy, wz); bpy.context.view_layer.update()
        # remove the lower half so the wheel and ground show through
        bm = bmesh.new(); bm.from_mesh(o.data)
        mw = o.matrix_world; kill = [f for f in bm.faces if (mw @ f.calc_center_median()).z < wz + 0.02]   # world z: keep only the upper half of the barrel
        bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(o.data); bm.free()

class Surf:
    """Ray casts against the finished body and cabin, to place parts exactly on the surface."""
    def __init__(self, *objs):
        dg = bpy.context.evaluated_depsgraph_get()
        self.trees = [BVHTree.FromObject(o, dg) for o in objs]
    def _cast(self, o, d):
        best = None
        for t in self.trees:
            h = t.ray_cast(o, d)
            if h[0] is not None and (best is None or h[3] < best[3]): best = h
        return best
    def z(self, x, y):
        h = self._cast(Vector((x, y, 3.0)), Vector((0, 0, -1))); return h[0].z if h else 1.0
    def x(self, sx, y, z):
        h = self._cast(Vector((sx * 3.0, y, z)), Vector((-sx, 0, 0))); return h[0].x if h else sx * 0.9
    def y(self, x, z, rear=False):
        h = self._cast(Vector((x, 4.0 if rear else -4.0, z)), Vector((0, -1 if rear else 1, 0))); return h[0].y if h else (2.27 if rear else -2.26)
    def normal_front(self, x, z, rear=False):
        h = self._cast(Vector((x, 4.0 if rear else -4.0, z)), Vector((0, -1 if rear else 1, 0))); return (h[0], h[1]) if h else (Vector((x, 0, z)), Vector((0, 1 if rear else -1, 0)))

# ------------------------------------------------------------------ parts
def add(kind, name, loc, size, matkey, **kw):
    return prim(kind, name, loc, size, matkey, parent=root, **kw)

def tyre_profile(R, w):
    """(radius, axial offset) profile of a tyre: tread band, rounded shoulders, bulged sidewall, bead."""
    rim_r = R * 0.62
    pts = [(rim_r, -w * 0.42), (R * 0.80, -w * 0.50), (R * 0.93, -w * 0.47), (R * 0.985, -w * 0.38), (R, -w * 0.25), (R, w * 0.25),
           (R * 0.985, w * 0.38), (R * 0.93, w * 0.47), (R * 0.80, w * 0.50), (rim_r, w * 0.42)]
    return pts

def wheel(name, x, y, z, R, tyre_w, spokes=5, twin=False, rim_key='rim', spoke_w=0.07, parts_parent=None, caliper_key='caliper'):
    """A wheel pivoted at the hub: tyre with a real profile, dished alloy with spokes, lip, centre cap, lug nuts, slotted disc and caliper.
    The pivot (an empty named `name`) is what the game spins and steers; all geometry hangs off it and is merged into one mesh `name_Mesh`."""
    hub = bpy.data.objects.new(name, None); hub.location = (x, y, z); link(hub, root)
    out = 1 if x > 0 else -1
    rot = (0, math.pi / 2, 0)
    parts = []
    t = lathe(name + '_Tyre', tyre_profile(R, tyre_w), (x, y, z), rot, 'tyre', parent=hub, segs=56); parts.append(t)
    rim_r = R * 0.62
    barrel = lathe(name + '_Barrel', [(rim_r - 0.02, -tyre_w * 0.40), (rim_r, -tyre_w * 0.43), (rim_r, tyre_w * 0.20), (rim_r * 0.80, tyre_w * 0.30), (rim_r * 0.30, tyre_w * 0.34)], (x, y, z), rot, rim_key, parent=hub, segs=48); parts.append(barrel)
    lip = lathe(name + '_Lip', [(rim_r + 0.004, tyre_w * 0.26), (rim_r + 0.004, tyre_w * 0.46), (rim_r - 0.03, tyre_w * 0.46), (rim_r - 0.03, tyre_w * 0.30)], (x, y, z), rot, 'chrome', parent=hub, segs=48); parts.append(lip)
    off = out * tyre_w * 0.30
    cap = prim('cyl', name + '_Cap', (x + off + out * 0.01, y, z), (R * 0.22, R * 0.22, 0.02), 'chrome', rot=rot, parent=hub, verts=24); parts.append(cap)
    for k in range(5):                                                            # lug nuts
        a = k * math.tau / 5 + 0.3
        parts.append(prim('cyl', f'{name}_Lug{k}', (x + off + out * 0.012, y + R * 0.16 * math.cos(a), z + R * 0.16 * math.sin(a)), (0.022, 0.022, 0.018), 'chrome', rot=rot, parent=hub, verts=8))
    n = spokes * (2 if twin else 1)
    for k in range(n):                                                            # tapered spokes from the cap to the rim, set into the dish
        a = k * math.tau / n + (0.0 if not twin else (0.07 if k % 2 else -0.07))
        L = rim_r * 0.92 - R * 0.10
        c = R * 0.10 + L / 2
        sp = prim('box', f'{name}_Spoke{k}', (x + off * 0.85, y + c * math.cos(a), z + c * math.sin(a)), (0.028, spoke_w * (0.7 if twin else 1.0), L), rim_key, rot=(a - math.pi / 2, 0, 0), parent=hub, bevel=0.004); parts.append(sp)
    disc = lathe(name + '_Disc', [(R * 0.18, -0.012), (R * 0.56, -0.012), (R * 0.56, 0.012), (R * 0.18, 0.012)], (x - out * tyre_w * 0.05, y, z), rot, 'disc', parent=hub, segs=48); parts.append(disc)
    hat = prim('cyl', name + '_Hat', (x - out * tyre_w * 0.02, y, z), (R * 0.20, R * 0.20, 0.05), 'trim', rot=rot, parent=hub, verts=20); parts.append(hat)
    cy = y + (0.07 if x < 0 else -0.07)
    parts.append(prim('box', name + '_Caliper', (x - out * tyre_w * 0.05, cy, z + R * 0.40), (0.075, 0.20, 0.10), caliper_key, parent=hub, bevel=0.014))
    for o in hub.children: o.matrix_parent_inverse = hub.matrix_world.inverted()
    return hub

def join(objs, name):
    objs = [o for o in objs if o.type == 'MESH']
    if len(objs) < 2:
        if objs: objs[0].name = name
        return objs[0] if objs else None
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); bpy.context.active_object.name = name
    return bpy.context.active_object

def headlight(sx, x, z, surf, w=0.34, h=0.115, tilt=0.18, bezel='chrome', parent=None):
    """A modern headlight unit set into the nose: dark housing, projector lens, light strip, bezel."""
    p, n = surf.normal_front(sx * x, z)
    ang = math.atan2(-n.x * 0, 1)
    base = Vector((sx * x, p.y, z))
    rz = sx * tilt
    add('box', f'HeadHousing_{sx}', (base.x, base.y - 0.004, base.z), (w + 0.03, 0.05, h + 0.025), 'trim', rot=(0, 0, rz), bevel=0.02)
    add('box', f'HeadLens_{sx}', (base.x, base.y - 0.016, base.z), (w, 0.04, h), 'head', rot=(0, 0, rz), bevel=0.025)
    add('cyl', f'HeadProj_{sx}', (base.x - sx * w * 0.18, base.y - 0.034, base.z), (h * 0.80, h * 0.80, 0.02), 'chrome', rot=(math.pi / 2, 0, 0), verts=24)
    add('box', f'HeadDRL_{sx}', (base.x + sx * w * 0.16, base.y - 0.040, base.z - h * 0.30), (w * 0.60, 0.014, 0.014), 'head', rot=(0, 0, rz), bevel=0.004)

def plate(name, x, y, z, rear=False, yellow=False):
    add('box', name + '_Frame', (x, y, z), (0.52, 0.012, 0.125), 'trim', bevel=0.004)
    add('box', name, (x, y + (0.007 if rear else -0.007), z), (0.50, 0.006, 0.105), 'plateY' if yellow else 'plate')

def mirror(sx, x, y, z, mat_key):
    add('box', f'MirrorStalk_{sx}', (sx * (x - 0.05), y + 0.02, z - 0.035), (0.11, 0.06, 0.035), mat_key, bevel=0.01)
    add('box', f'MirrorShell_{sx}', (sx * x, y, z), (0.07, 0.19, 0.11), mat_key, bevel=0.035)
    add('box', f'MirrorGlass_{sx}', (sx * (x - 0.012), y - 0.095, z), (0.05, 0.012, 0.085), 'chrome', bevel=0.004)

def exhaust(x, y, z, r=0.045, key='chrome'):
    add('cyl', f'Exhaust_{x:+.2f}', (x, y, z), (r * 2, r * 2, 0.22), key, rot=(math.pi / 2, 0, 0), verts=24)
    add('cyl', f'ExhaustIn_{x:+.2f}', (x, y + 0.115, z), (r * 1.55, r * 1.55, 0.02), 'trim', rot=(math.pi / 2, 0, 0), verts=20)

def interior(y_front, y_rear, zf, width, seat_z, wheel_pos):
    """A simple interior seen through the glass: dashboard, two seats, rear bench or boot floor, steering wheel."""
    for sx in (-1, 1):
        add('box', f'Seat_{sx}', (sx * 0.36, (y_front + y_rear) / 2 + 0.25, seat_z), (0.44, 0.50, 0.12), 'seat', bevel=0.03)
        add('box', f'SeatBack_{sx}', (sx * 0.36, (y_front + y_rear) / 2 + 0.47, seat_z + 0.28), (0.44, 0.12, 0.52), 'seat', rot=(-0.2, 0, 0), bevel=0.04)
        add('box', f'Head_{sx}', (sx * 0.36, (y_front + y_rear) / 2 + 0.50, seat_z + 0.60), (0.22, 0.10, 0.16), 'seat', bevel=0.04)
    add('box', 'Dash', (0, y_front + 0.28, zf), (1.45, 0.42, 0.13), 'dash', bevel=0.04)
    add('box', 'Console', (0, (y_front + y_rear) / 2 - 0.05, seat_z + 0.02), (0.20, 0.90, 0.20), 'dash', bevel=0.03)
    sx, sy, sz = wheel_pos
    add('cyl', 'SteerWheel', (sx, sy, sz), (0.36, 0.36, 0.035), 'trim', rot=(math.radians(-62), 0, 0), verts=28)

# ------------------------------------------------------------------ finishing
def finish(out_dir, render_dir, blend_name, glb_name, prefix, root_name):
    """Merge small parts, save, export to glTF, and render preview pictures."""
    body = bpy.data.objects.get('Body'); cabin = bpy.data.objects.get('Cabin')
    for hub in [o for o in root.children if o.name.startswith('Wheel_')]:
        join(list(hub.children), hub.name + '_Mesh')
    extras = [o for o in root.children if o.type == 'MESH' and o not in (body, cabin)]
    interior_parts = [o for o in extras if o.name.startswith(('Seat', 'Head_', 'Dash', 'Console', 'SteerWheel', 'Rear'))]
    detail_parts = [o for o in extras if o not in interior_parts]
    if interior_parts: join(interior_parts, 'Interior')
    join(detail_parts, 'Details')
    tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons)
    print('TRIS', tris)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, blend_name))
    for o in bpy.context.selected_objects: o.select_set(False)
    def sel(o):
        o.select_set(True)
        for c in o.children: sel(c)
    sel(root)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, glb_name), export_format='GLB', use_selection=True, export_apply=True)
    render(render_dir, prefix)

def render(render_dir, prefix, size=(1100, 620)):
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'CYCLES'):
        try: scene.render.engine = eng; break
        except TypeError: continue
    if scene.render.engine == 'CYCLES': scene.cycles.samples = 24; scene.cycles.device = 'CPU'
    scene.render.resolution_x, scene.render.resolution_y = size
    w = bpy.data.worlds.new('w'); w.use_nodes = True; scene.world = w
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.07, 0.12, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 1.4
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); fl = bpy.context.active_object
    fl.data.materials.append(mat('Floor', (0.08, 0.08, 0.09), 0.0, 0.45))
    for name, loc, e in (('key', (-4, -5, 6), 1100), ('rim', (5, 5, 4), 600), ('fill', (6, -4, 3), 300)):
        ld = bpy.data.lights.new(name, 'AREA'); ld.energy = e; ld.size = 5
        lo = bpy.data.objects.new(name, ld); lo.location = loc; scene.collection.objects.link(lo)
        c = lo.constraints.new('TRACK_TO'); tgt = bpy.data.objects.new('t', None); tgt.location = (0, 0, 0.6)
        scene.collection.objects.link(tgt); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
    look = bpy.data.objects.new('look', None); look.location = (0, 0, 0.65); scene.collection.objects.link(look)
    tc = cam.constraints.new('TRACK_TO'); tc.target = look; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
    for name, loc, lens in (('side', (9, 0, 0.7), 60), ('front', (0, -9, 0.9), 60), ('three_quarter', (-5.6, -5.4, 1.9), 42), ('rear', (4.5, 6.2, 1.9), 42), ('rear_three_quarter', (5.6, 5.4, 1.9), 42)):
        cam.location = loc; cam.data.lens = lens
        scene.render.filepath = os.path.join(render_dir, f'{prefix}_{name}.png')
        bpy.ops.render.render(write_still=True)

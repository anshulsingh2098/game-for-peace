"""Car 1 - wide-body blue/silver coupe. Run: blender -b -P build_car1.py -- <out_dir> <render_dir>
Front of the car points to -Y, up is +Z. Units are metres."""
import bpy, bmesh, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'assets'
REN = argv[1] if len(argv) > 1 else OUT
os.makedirs(OUT, exist_ok=True); os.makedirs(REN, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- materials ----------
def mat(name, color, metal=0.0, rough=0.5, emit=None, emit_s=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if coat: b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = emit_s
    return m

M = {
 'silver': mat('Paint_Silver', (0.62, 0.65, 0.70), 0.85, 0.28, coat=1.0),
 'blue':   mat('Paint_Blue',   (0.02, 0.06, 0.38), 0.6, 0.22, coat=1.0),
 'glass':  mat('Glass',        (0.02, 0.03, 0.05), 0.3, 0.05),
 'tyre':   mat('Tyre',         (0.015, 0.015, 0.017), 0.0, 0.85),
 'rim':    mat('Rim',          (0.78, 0.80, 0.84), 1.0, 0.22),
 'trim':   mat('Trim_Black',   (0.02, 0.02, 0.025), 0.2, 0.5),
 'carbon': mat('Carbon',       (0.03, 0.03, 0.035), 0.5, 0.3),
 'head':   mat('Light_Head',   (0.9, 0.9, 0.85), 0.0, 0.1, emit=(1, 0.95, 0.8), emit_s=0.6),
 'tail':   mat('Light_Tail',   (0.8, 0.02, 0.02), 0.0, 0.2, emit=(1, 0.05, 0.03), emit_s=1.5),
 'chrome': mat('Chrome',       (0.9, 0.9, 0.92), 1.0, 0.08),
}
SLOTS = ['silver', 'blue', 'glass']   # slots used by the body meshes

# ---------- helpers ----------
def link(obj, parent=None):
    scene.collection.objects.link(obj)
    if parent: obj.parent = parent
    return obj

def mesh_obj(name, verts, faces, mat_idx=None, mats=SLOTS):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for k in mats: me.materials.append(M[k])
    if mat_idx:
        for p, i in zip(me.polygons, mat_idx): p.material_index = i
    return bpy.data.objects.new(name, me)

def apply_mod(obj, mod):
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.selected_objects: o.select_set(False)
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)

def prim(kind, name, loc, size, matkey, rot=(0, 0, 0), parent=None, verts=24, bevel=0.0):
    if kind == 'box': bpy.ops.mesh.primitive_cube_add(size=1)
    elif kind == 'cyl': bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=0.5, depth=1)
    elif kind == 'sph': bpy.ops.mesh.primitive_uv_sphere_add(segments=verts, ring_count=12, radius=0.5)
    o = bpy.context.active_object; o.name = name
    o.scale = size; o.location = loc; o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(M[matkey])
    if bevel:
        bm = o.modifiers.new('bv', 'BEVEL'); bm.width = bevel; bm.segments = 2
        apply_mod(o, bm)
    bpy.ops.object.shade_smooth()
    if parent: o.parent = parent
    return o

# ---------- root ----------
root = bpy.data.objects.new('Car_01_GT', None); link(root)

# ---------- body loft (superellipse rings) ----------
def ring(y, zb, zt, w, n=24, p=3.8):
    zc, hh = (zb + zt) / 2, (zt - zb) / 2
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n; c, s = math.cos(t), math.sin(t)
        pts.append((w * math.copysign(abs(c) ** (2 / p), c), y, zc + hh * math.copysign(abs(s) ** (2 / p), s)))
    return pts

#        y      zb    zt    half-width
ST = [(-2.265, 0.32, 0.78, 0.82), (-2.235, 0.26, 0.80, 0.90), (-2.05, 0.20, 0.82, 0.95),
      (-1.62, 0.20, 0.88, 1.03), (-1.00, 0.20, 0.93, 0.96), (-0.60, 0.20, 0.96, 0.91),
      (0.20, 0.20, 0.96, 0.90), (1.00, 0.20, 0.96, 0.91), (1.40, 0.20, 0.98, 1.00),
      (1.90, 0.20, 0.98, 1.00), (2.20, 0.22, 0.96, 0.95), (2.245, 0.26, 0.94, 0.92), (2.275, 0.32, 0.90, 0.86)]
N = 24
verts, faces = [], []
for st in ST: verts += ring(*st, n=N)
for i in range(len(ST) - 1):
    for j in range(N):
        a = i * N + j; b = i * N + (j + 1) % N
        faces.append((a, b, b + N, a + N))
faces.append(tuple(range(N - 1, -1, -1)))                       # front cap
faces.append(tuple((len(ST) - 1) * N + j for j in range(N)))    # rear cap
body = mesh_obj('Body', verts, faces)
link(body, root)
sub = body.modifiers.new('s', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
apply_mod(body, sub)

# ---------- greenhouse loft ----------
def cab(y, zt, sc=1.0):
    zb = 0.86
    wb, wm, wt = 0.71 * sc, 0.67 * sc, 0.58 * sc
    zm = zt - 0.20
    return [(-wb, y, zb), (-wm, y, zm), (-wt, y, zt - 0.02), (0, y, zt + 0.01),
            (wt, y, zt - 0.02), (wm, y, zm), (wb, y, zb), (0, y, zb)]
G = [(-0.74, 0.98, 0.99), (-0.38, 1.40, 1.0), (-0.05, 1.42, 1.0), (0.20, 1.42, 1.0), (0.28, 1.42, 1.0),
     (0.55, 1.42, 1.0), (0.86, 1.40, 1.0), (1.12, 1.27, 0.98), (1.45, 1.00, 0.94)]
gv, gf, gm = [], [], []
for y, zt, sc in G: gv += cab(y, zt, sc)
# span -> list of material per segment (0 silver, 1 blue, 2 glass)
GL = 2; P = 0
SIDE = [GL, GL, P, P, GL, GL, P, P]
spans = [
 [P, P, GL, GL, GL, P, P, P],      # windshield
 SIDE, SIDE,                       # front side window
 [P, P, P, P, P, P, P, P],         # B pillar
 SIDE, SIDE,                       # rear side window
 [P, P, P, P, P, P, P, P],         # C pillar
 [P, P, GL, GL, GL, P, P, P],      # rear window
]
for i in range(len(G) - 1):
    for j in range(8):
        a = i * 8 + j; b = i * 8 + (j + 1) % 8
        gf.append((a, b, b + 8, a + 8)); gm.append(spans[i][j])
gf.append(tuple(range(7, -1, -1)));            gm.append(P)
gf.append(tuple((len(G) - 1) * 8 + j for j in range(8))); gm.append(P)
green = mesh_obj('Cabin', gv, gf, gm)
link(green, root)
s2 = green.modifiers.new('s', 'SUBSURF'); s2.levels = 1; s2.render_levels = 1
apply_mod(green, s2)

# ---------- wheel arches ----------
WX, WYF, WYR, WZ = 0.82, -1.62, 1.34, 0.35
for sx in (-1, 1):
    for wy in (WYF, WYR):
        bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.405, depth=0.62,
                                            location=(sx * (WX + 0.06), wy, WZ), rotation=(0, math.pi / 2, 0))
        cut = bpy.context.active_object
        bm = body.modifiers.new('arch', 'BOOLEAN'); bm.object = cut; bm.operation = 'DIFFERENCE'; bm.solver = 'EXACT'
        apply_mod(body, bm)
        bpy.data.objects.remove(cut)

# ---------- livery: painted texture (smooth edges, tiny mesh) ----------
import numpy as np
DEC = float(os.environ.get('DEC', 0.5))
if DEC < 1.0:                                   # simplify the smooth body; the texture carries the livery
    dm = body.modifiers.new('dec', 'DECIMATE'); dm.ratio = DEC
    apply_mod(body, dm)

W, H = 2048, 1024
BLUE = np.array([0.02, 0.06, 0.38]); SILVER = np.array([0.62, 0.65, 0.70])

def side_field(Y, Z):                           # livery on the car's flanks, in (y, z) metres
    s_front = np.minimum(Z - 0.50, (-0.95 + (Z - 0.5) * 1.1) - Y)      # front fender, raked edge
    s_rear = np.minimum(Y - 1.15, Z - 0.52)                           # rear quarter
    d = np.array([1.50, 0.77]); L = np.hypot(*d)                      # diagonal stripe, low at the front
    qy, qz = Y + 0.55, Z - 0.25
    t = (qy * d[0] + qz * d[1]) / L ** 2
    dist = np.abs(qy * d[1] - qz * d[0]) / L
    s_str = np.minimum.reduce([0.17 - dist, (t + 0.10) * L, (1.30 - t) * L])
    return np.minimum(np.maximum.reduce([s_front, s_rear, s_str]), 1.00 - Z)

def top_field(X, Y):                            # hood centre and fender tops, in (x, y)
    hood = np.minimum.reduce([0.40 - np.abs(X), Y + 2.15, -0.55 - Y])
    fend = np.minimum.reduce([np.abs(X) - 0.74, Y + 2.20, -0.55 - Y])
    return np.maximum(hood, fend)

def fb_field(X, Z):                             # front and rear faces, in (x, z)
    return np.minimum(np.abs(X) - 0.78, Z - 0.50)

alpha = np.zeros((H, W))                        # row 0 = bottom of the image
r = np.arange(512)[:, None]; c = np.arange(W)[None, :]
alpha[512:, :] = side_field(-2.4 + 4.8 * (c + 0.5) / W + 0 * r, 1.6 * (r + 0.5) / 512 + 0 * c)
r2 = np.arange(512)[:, None]; c2 = np.arange(1024)[None, :]
alpha[:512, :1024] = top_field(-1.1 + 2.2 * (r2 + 0.5) / 512 + 0 * c2, -2.4 + 4.8 * (c2 + 0.5) / 1024 + 0 * r2)
alpha[:512, 1024:] = fb_field(-1.1 + 2.2 * (c2 + 0.5) / 1024 + 0 * r2, 1.6 * (r2 + 0.5) / 512 + 0 * c2)
alpha = np.clip(0.5 + alpha / 0.006, 0, 1)      # anti-aliased edge

def to_srgb(v): return np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)
rgb = SILVER[None, None, :] * (1 - alpha[..., None]) + BLUE[None, None, :] * alpha[..., None]
rgba = np.concatenate([to_srgb(rgb), np.ones((H, W, 1))], axis=2)
def make_image(name, arr, path):
    img = bpy.data.images.new(name, W, H, alpha=False)
    img.pixels.foreach_set(arr.astype(np.float32).ravel())
    img.filepath_raw = path; img.file_format = 'PNG'; img.save()
    return img
livery_img = make_image('Livery', rgba, os.path.join(OUT, 'car_01_livery.png'))
mask = np.concatenate([np.repeat(alpha[..., None], 3, axis=2), np.ones((H, W, 1))], axis=2)
make_image('LiveryMask', mask, os.path.join(OUT, 'car_01_livery_mask.png'))   # white = blue panels, for in-game recolouring

LIV = bpy.data.materials.new('Paint_Livery'); LIV.use_nodes = True
_b = LIV.node_tree.nodes['Principled BSDF']
_t = LIV.node_tree.nodes.new('ShaderNodeTexImage'); _t.image = livery_img
LIV.node_tree.links.new(_t.outputs['Color'], _b.inputs['Base Color'])
_b.inputs['Metallic'].default_value = 0.75; _b.inputs['Roughness'].default_value = 0.25
_b.inputs['Coat Weight'].default_value = 1.0

def project_uvs(obj):                           # box projection into the atlas
    me = obj.data
    while len(me.uv_layers) > 1: me.uv_layers.remove(me.uv_layers[-1])
    uv = me.uv_layers[0] if len(me.uv_layers) else me.uv_layers.new(name='UVMap')
    uv.name = 'UVMap'; me.uv_layers.active = uv
    for p in me.polygons:
        n = p.normal; ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for li in p.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            if ax >= ay and ax >= az: u, w = (v.y + 2.4) / 4.8, 0.5 + 0.5 * (v.z / 1.6)
            elif az >= ay:            u, w = 0.5 * (v.y + 2.4) / 4.8, 0.5 * ((v.x + 1.1) / 2.2)
            else:                     u, w = 0.5 + 0.5 * (v.x + 1.1) / 2.2, 0.5 * (v.z / 1.6)
            uv.data[li].uv = (min(max(u, 0.002), 0.998), min(max(w, 0.002), 0.998))

body.data.materials.clear(); body.data.materials.append(LIV)
for p in body.data.polygons: p.material_index = 0; p.use_smooth = True
gl = [p.material_index == 2 for p in green.data.polygons]
green.data.materials.clear(); green.data.materials.append(LIV); green.data.materials.append(M['glass'])
for p, g in zip(green.data.polygons, gl): p.material_index = 1 if g else 0; p.use_smooth = True
project_uvs(body); project_uvs(green)

# surface height helper (for placing parts exactly on the body)
from mathutils.bvhtree import BVHTree
_dg = bpy.context.evaluated_depsgraph_get()
_bvh = BVHTree.FromObject(body, _dg)
def surf_z(x, y):
    hit = _bvh.ray_cast(Vector((x, y, 3.0)), Vector((0, 0, -1)))
    return hit[0].z if hit[0] else 1.0
def surf_y(x, z, rear=False):
    hit = _bvh.ray_cast(Vector((x, 4.0 if rear else -4.0, z)), Vector((0, -1 if rear else 1, 0)))
    return hit[0].y if hit[0] else (2.27 if rear else -2.26)
for p in green.data.polygons: p.use_smooth = True

# ---------- details ----------
def add(kind, name, loc, size, matkey, **kw): return prim(kind, name, loc, size, matkey, parent=root, **kw)

# front
for sx in (-1, 1):
    for tag, hx in (('out', 0.72), ('in', 0.52)):          # twin round headlights
        hy = surf_y(sx * hx, 0.72)
        add('cyl', f'HeadRing_{tag}_{sx}', (sx * hx, hy - 0.004, 0.72), (0.21, 0.21, 0.03), 'chrome', rot=(math.pi / 2, 0, 0), verts=28)
        add('sph', f'Headlight_{tag}_{sx}', (sx * hx, hy - 0.012, 0.72), (0.17, 0.05, 0.17), 'head', verts=20)
    gy = surf_y(sx * 0.125, 0.68)                           # kidney grille
    add('box', f'GrilleFrame_{sx}', (sx * 0.125, gy - 0.004, 0.68), (0.23, 0.05, 0.22), 'chrome', bevel=0.012)
    add('box', f'Grille_{sx}', (sx * 0.125, gy - 0.014, 0.68), (0.19, 0.05, 0.18), 'trim', bevel=0.01)
    vy0, vy1 = -1.65, -1.25                                 # hood vents follow the hood slope
    vz0, vz1 = surf_z(sx * 0.50, vy0), surf_z(sx * 0.50, vy1)
    add('box', f'HoodVent_{sx}', (sx * 0.50, (vy0 + vy1) / 2, (vz0 + vz1) / 2 + 0.004), (0.30, 0.40, 0.025), 'trim',
        rot=(math.atan2(vz1 - vz0, vy1 - vy0), 0, 0))
    iy = surf_y(sx * 0.68, 0.42)
    add('box', f'Intake_{sx}', (sx * 0.68, iy - 0.006, 0.42), (0.32, 0.05, 0.13), 'trim', bevel=0.02)
iyc = surf_y(0, 0.42)
add('box', 'Intake_centre', (0, iyc - 0.006, 0.42), (0.74, 0.05, 0.14), 'trim', bevel=0.02)
add('box', 'Splitter', (0, -2.27, 0.20), (1.56, 0.22, 0.035), 'silver', bevel=0.01)
add('box', 'SideSkirt_L', (-0.90, 0.0, 0.25), (0.08, 2.2, 0.10), 'silver', bevel=0.02)
add('box', 'SideSkirt_R', (0.90, 0.0, 0.25), (0.08, 2.2, 0.10), 'silver', bevel=0.02)
# mirrors + door handles
for sx in (-1, 1):
    add('box', f'MirrorArm_{sx}', (sx * 0.70, -0.60, 1.05), (0.16, 0.08, 0.04), 'silver')
    add('box', f'Mirror_{sx}', (sx * 0.80, -0.60, 1.10), (0.12, 0.16, 0.10), 'silver', bevel=0.03)
    add('box', f'Handle_{sx}', (sx * 0.89, 0.18, 0.93), (0.02, 0.16, 0.03), 'trim', bevel=0.005)
# rear
for sx in (-1, 1):
    ty = surf_y(sx * 0.68, 0.84, rear=True)
    add('box', f'Taillight_{sx}', (sx * 0.68, ty - 0.004, 0.84), (0.36, 0.05, 0.13), 'tail', bevel=0.02)
    add('cyl', f'Exhaust_{sx}', (sx * 0.42, 2.30, 0.31), (0.10, 0.10, 0.20), 'chrome', rot=(math.pi / 2, 0, 0), verts=16)
add('box', 'Diffuser', (0, 2.27, 0.28), (1.1, 0.06, 0.13), 'trim', bevel=0.01)
# wing: stands start on the trunk lid
WZW = 1.24
add('box', 'Wing_Blade', (0, 2.02, WZW), (1.80, 0.28, 0.03), 'carbon', bevel=0.01)
for sx in (-1, 1):
    add('box', f'Wing_End_{sx}', (sx * 0.90, 2.02, WZW - 0.02), (0.025, 0.34, 0.13), 'carbon', bevel=0.006)
    tz = surf_z(sx * 0.42, 2.00)
    add('box', f'Wing_Stand_{sx}', (sx * 0.42, 2.00, (tz + WZW) / 2), (0.03, 0.08, WZW - tz), 'carbon', bevel=0.006)

# wheels (pivot at hub so the game can spin and steer them)
def wheel(name, x, y):
    hub = bpy.data.objects.new(name, None); hub.location = (x, y, WZ); link(hub, root)
    out = 1 if x > 0 else -1
    rot = (0, math.pi / 2, 0)
    prim('cyl', name + '_Tyre', (x, y, WZ), (0.70, 0.70, 0.27), 'tyre', rot=rot, parent=hub, verts=40, bevel=0.035)
    prim('cyl', name + '_Barrel', (x + out * 0.01, y, WZ), (0.50, 0.50, 0.24), 'rim', rot=rot, parent=hub, verts=32)
    prim('cyl', name + '_Disc', (x + out * 0.115, y, WZ), (0.42, 0.42, 0.02), 'trim', rot=rot, parent=hub, verts=32)
    prim('cyl', name + '_Cap', (x + out * 0.135, y, WZ), (0.10, 0.10, 0.03), 'chrome', rot=rot, parent=hub, verts=16)
    for k in range(10):
        a = k * math.tau / 10
        prim('box', f'{name}_Spoke{k}', (x + out * 0.13, y + 0.125 * math.cos(a), WZ + 0.125 * math.sin(a)),
             (0.025, 0.065, 0.21), 'rim', rot=(a - math.pi / 2, 0, 0), parent=hub)
    for o in hub.children: o.matrix_parent_inverse = hub.matrix_world.inverted()
wheel('Wheel_FL', -WX, WYF); wheel('Wheel_FR', WX, WYF)
wheel('Wheel_RL', -WX, WYR); wheel('Wheel_RR', WX, WYR)

# ---------- optimise: decimate body, merge small parts ----------
def join(objs, name):
    objs = [o for o in objs if o.type == 'MESH']
    if len(objs) < 2: return
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); bpy.context.active_object.name = name

for hub in [o for o in root.children if o.name.startswith('Wheel_')]:
    join(list(hub.children), hub.name + '_Mesh')
join([o for o in root.children if o.type == 'MESH' and o not in (body, green)], 'Details')
tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons)
print('TRIS', tris)

# ---------- save + export ----------
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'car_01_gt.blend'))
for o in bpy.context.selected_objects: o.select_set(False)
def sel(o):
    o.select_set(True)
    for c in o.children: sel(c)
sel(root)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'car_01_gt.glb'), export_format='GLB', use_selection=True, export_apply=True)

# ---------- preview renders ----------
for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'CYCLES'):
    try: scene.render.engine = eng; break
    except TypeError: continue
if scene.render.engine == 'CYCLES': scene.cycles.samples = 24; scene.cycles.device = 'CPU'
scene.render.resolution_x, scene.render.resolution_y = 1100, 620
scene.render.film_transparent = False
w = bpy.data.worlds.new('w'); w.use_nodes = True; scene.world = w
w.node_tree.nodes['Background'].inputs[0].default_value = (0.03, 0.04, 0.09, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 1.2
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); fl = bpy.context.active_object
fl.data.materials.append(mat('Floor', (0.05, 0.05, 0.07), 0.0, 0.35))
for name, loc, e, kind in (('key', (-4, -5, 6), 900, 'AREA'), ('rim', (5, 5, 4), 500, 'AREA'), ('fill', (6, -4, 3), 250, 'AREA')):
    ld = bpy.data.lights.new(name, kind); ld.energy = e; ld.size = 5
    lo = bpy.data.objects.new(name, ld); lo.location = loc; scene.collection.objects.link(lo)
    c = lo.constraints.new('TRACK_TO'); tgt = bpy.data.objects.new('t', None); tgt.location = (0, 0, 0.6)
    scene.collection.objects.link(tgt); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
look = bpy.data.objects.new('look', None); look.location = (0, 0, 0.65); scene.collection.objects.link(look)
tc = cam.constraints.new('TRACK_TO'); tc.target = look; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
for name, loc, lens in (('side', (9, 0, 0.7), 60), ('front', (0, -9, 0.9), 60), ('three_quarter', (-5.6, -5.4, 1.9), 42), ('rear', (4.5, 6.2, 1.9), 42)):
    cam.location = loc; cam.data.lens = lens
    scene.render.filepath = os.path.join(REN, f'car1_{name}.png')
    bpy.ops.render.render(write_still=True)
print('DONE', len(bpy.data.objects), 'objects; render engine', scene.render.engine)

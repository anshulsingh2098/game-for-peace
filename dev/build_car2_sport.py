"""Car 2 - low mid-engined sports car (original design).
Run: blender -b -P build_car2_sport.py -- <out_dir> <render_dir>
Front of the car points to -Y, up is +Z. Units are metres. Same conventions as build_car1.py:
wheel pivots Wheel_FL/FR/RL/RR, greenhouse object 'Cabin', materials Glass / Light_Head / Light_Tail / Paint_Body."""
import bpy, math, sys, os
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'assets'
REN = argv[1] if len(argv) > 1 else OUT
OUT, REN = os.path.abspath(OUT), os.path.abspath(REN)      # Blender resolves relative render paths against the drive root
os.makedirs(OUT, exist_ok=True); os.makedirs(REN, exist_ok=True)
NAME, FILE, PREVIEW = 'Car_02_Sport', 'car_02_sport', 'car2'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0     # no .blend1 backups next to the assets
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
 'paint':  mat('Paint_Body',   (0.80, 0.16, 0.02), 0.55, 0.24, coat=1.0),
 'glass':  mat('Glass',        (0.02, 0.03, 0.05), 0.3, 0.05),
 'tyre':   mat('Tyre',         (0.015, 0.015, 0.017), 0.0, 0.85),
 'rim':    mat('Rim',          (0.42, 0.43, 0.47), 1.0, 0.30),
 'trim':   mat('Trim_Black',   (0.02, 0.02, 0.025), 0.2, 0.5),
 'carbon': mat('Carbon',       (0.03, 0.03, 0.035), 0.5, 0.3),
 'head':   mat('Light_Head',   (0.9, 0.9, 0.85), 0.0, 0.1, emit=(1, 0.95, 0.8), emit_s=0.6),
 'tail':   mat('Light_Tail',   (0.8, 0.02, 0.02), 0.0, 0.2, emit=(1, 0.05, 0.03), emit_s=1.5),
 'disc':   mat('Disc',         (0.36, 0.37, 0.40), 1.0, 0.35),
 'caliper': mat('Caliper',     (0.85, 0.62, 0.04), 0.2, 0.4),
 'chrome': mat('Chrome',       (0.9, 0.9, 0.92), 1.0, 0.08),
}

# ---------- helpers ----------
def link(obj, parent=None):
    scene.collection.objects.link(obj)
    if parent: obj.parent = parent
    return obj

def mesh_obj(name, verts, faces, mats, mat_idx=None):
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

root = bpy.data.objects.new(NAME, None); link(root)

# ---------- body loft (superellipse rings) ----------
def ring(y, zb, zt, w, n=24, p=3.8):
    zc, hh = (zb + zt) / 2, (zt - zb) / 2
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n; c, s = math.cos(t), math.sin(t)
        pts.append((w * math.copysign(abs(c) ** (2 / p), c), y, zc + hh * math.copysign(abs(s) ** (2 / p), s)))
    return pts

# low wedge nose, cab-forward, wide rear hips over the engine
#        y      zb    zt    half-width
ST = [(-2.170, 0.30, 0.50, 0.76), (-2.140, 0.22, 0.54, 0.87), (-1.95, 0.16, 0.61, 0.94),
      (-1.30, 0.16, 0.80, 0.99), (-0.72, 0.16, 0.84, 0.95), (-0.20, 0.16, 0.86, 0.93),
      (0.50, 0.16, 0.88, 0.94), (0.95, 0.16, 0.93, 0.99), (1.36, 0.16, 0.96, 1.03),
      (1.85, 0.18, 0.96, 1.01), (2.08, 0.22, 0.94, 0.96), (2.120, 0.28, 0.91, 0.92), (2.145, 0.36, 0.87, 0.86)]
N = 24
verts, faces = [], []
for st in ST: verts += ring(*st, n=N)
for i in range(len(ST) - 1):
    for j in range(N):
        a = i * N + j; b = i * N + (j + 1) % N
        faces.append((a, b, b + N, a + N))
faces.append(tuple(range(N - 1, -1, -1)))                       # front cap
faces.append(tuple((len(ST) - 1) * N + j for j in range(N)))    # rear cap
body = mesh_obj('Body', verts, faces, ['paint'])
link(body, root)
sub = body.modifiers.new('s', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
apply_mod(body, sub)

# ---------- greenhouse loft: forward cabin, glass engine cover running into the tail ----------
CZB = 0.78
def cab(y, zt, sc=1.0):
    wb, wm, wt = 0.75 * sc, 0.70 * sc, 0.55 * sc
    zm = CZB + (zt - CZB) * 0.42
    return [(-wb, y, CZB), (-wm, y, zm), (-wt, y, zt - 0.02), (0, y, zt + 0.01),
            (wt, y, zt - 0.02), (wm, y, zm), (wb, y, CZB), (0, y, CZB)]
G = [(-0.95, 0.83, 0.97), (-0.42, 1.12, 1.0), (-0.05, 1.16, 1.0), (0.26, 1.16, 1.0), (0.36, 1.155, 1.0),
     (0.78, 1.10, 0.97), (1.25, 1.02, 0.90), (1.74, 0.955, 0.80)]
gv, gf, gm = [], [], []
for y, zt, sc in G: gv += cab(y, zt, sc)
GL = 1; P = 0
SIDE = [GL, GL, P, P, GL, GL, P, P]
TOP = [P, P, GL, GL, P, P, P, P]
spans = [
 TOP,                              # windshield
 SIDE, SIDE,                       # side window
 [P] * 8,                          # B pillar / roof hoop
 TOP, TOP,                         # glass engine cover between the buttresses
 [P] * 8,                          # tail
]
for i in range(len(G) - 1):
    for j in range(8):
        a = i * 8 + j; b = i * 8 + (j + 1) % 8
        gf.append((a, b, b + 8, a + 8)); gm.append(spans[i][j])
gf.append(tuple(range(7, -1, -1)));            gm.append(P)
gf.append(tuple((len(G) - 1) * 8 + j for j in range(8))); gm.append(P)
green = mesh_obj('Cabin', gv, gf, ['paint', 'glass'], gm)
link(green, root)
s2 = green.modifiers.new('s', 'SUBSURF'); s2.levels = 1; s2.render_levels = 1
apply_mod(green, s2)

# ---------- wheel arches ----------
WX, WYF, WYR, WR = 0.83, -1.30, 1.36, 0.345
WZ = WR
for sx in (-1, 1):
    for wy in (WYF, WYR):
        bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=WR + 0.05, depth=0.62,
                                            location=(sx * (WX + 0.06), wy, WZ), rotation=(0, math.pi / 2, 0))
        cut = bpy.context.active_object
        bm = body.modifiers.new('arch', 'BOOLEAN'); bm.object = cut; bm.operation = 'DIFFERENCE'; bm.solver = 'EXACT'
        apply_mod(body, bm)
        bpy.data.objects.remove(cut)

DEC = float(os.environ.get('DEC', 0.5))
if DEC < 1.0:
    dm = body.modifiers.new('dec', 'DECIMATE'); dm.ratio = DEC
    apply_mod(body, dm)
for o in (body, green):
    for p in o.data.polygons: p.use_smooth = True

# surface helpers (for placing parts exactly on the body / cabin)
_dg = bpy.context.evaluated_depsgraph_get()
_bvh = BVHTree.FromObject(body, _dg)
_cbvh = BVHTree.FromObject(green, _dg)
def surf_z(x, y):
    zs = [h[0].z for h in (t.ray_cast(Vector((x, y, 3.0)), Vector((0, 0, -1))) for t in (_bvh, _cbvh)) if h[0]]
    return max(zs) if zs else 1.0
def surf_x(sx, y, z):
    hit = _bvh.ray_cast(Vector((sx * 3.0, y, z)), Vector((-sx, 0, 0)))
    return hit[0].x if hit[0] else sx * 0.9
def surf_y(x, z, rear=False):
    hit = _bvh.ray_cast(Vector((x, 4.0 if rear else -4.0, z)), Vector((0, -1 if rear else 1, 0)))
    return hit[0].y if hit[0] else (2.14 if rear else -2.17)
def slope(x, y0, y1):
    z0, z1 = surf_z(x, y0), surf_z(x, y1)
    return (z0 + z1) / 2, math.atan2(z1 - z0, y1 - y0)

# ---------- details ----------
def add(kind, name, loc, size, matkey, **kw): return prim(kind, name, loc, size, matkey, parent=root, **kw)

# front: blade headlights laid into the fender tops, slim DRL, three intakes, splitter
for sx in (-1, 1):
    zc, ang = slope(sx * 0.66, -1.98, -1.70)
    add('box', f'Headlight_{sx}', (sx * 0.66, -1.84, zc + 0.002), (0.17, 0.34, 0.03), 'head', rot=(ang, 0, sx * 0.22), bevel=0.012)
    add('box', f'HeadSurround_{sx}', (sx * 0.66, -1.84, zc - 0.004), (0.22, 0.39, 0.03), 'trim', rot=(ang, 0, sx * 0.22), bevel=0.012)
    dy = surf_y(sx * 0.50, 0.47)
    add('box', f'DRL_{sx}', (sx * 0.50, dy - 0.004, 0.47), (0.36, 0.04, 0.022), 'head', bevel=0.008)
    iy = surf_y(sx * 0.63, 0.32)
    add('box', f'Intake_{sx}', (sx * 0.63, iy - 0.006, 0.32), (0.34, 0.05, 0.14), 'trim', bevel=0.02)
    add('box', f'IntakeBlade_{sx}', (sx * 0.63, iy - 0.03, 0.32), (0.30, 0.03, 0.014), 'carbon')
    zc, ang = slope(sx * 0.36, -1.55, -1.15)                 # nose outlets ahead of the windscreen
    add('box', f'NoseVent_{sx}', (sx * 0.36, -1.35, zc + 0.003), (0.26, 0.40, 0.02), 'trim', rot=(ang, 0, sx * -0.12), bevel=0.008)
iyc = surf_y(0, 0.32)
add('box', 'Intake_centre', (0, iyc - 0.006, 0.31), (0.66, 0.05, 0.12), 'trim', bevel=0.02)
add('box', 'Splitter', (0, -2.13, 0.165), (1.62, 0.26, 0.03), 'carbon', bevel=0.008)
for sx in (-1, 1):
    add('box', f'SplitterEnd_{sx}', (sx * 0.80, -2.13, 0.215), (0.02, 0.24, 0.10), 'carbon', bevel=0.005)

# flanks: big side intakes feeding the engine, skirts, shut lines, mirrors
for sx in (-1, 1):
    xi = surf_x(sx, 0.70, 0.58)
    add('box', f'SideIntake_{sx}', (xi + sx * 0.002, 0.70, 0.58), (0.05, 0.44, 0.26), 'trim', rot=(0, 0, sx * 0.08), bevel=0.02)
    add('box', f'SideIntakeBlade_{sx}', (xi + sx * 0.024, 0.50, 0.58), (0.02, 0.05, 0.30), 'paint', rot=(0.30, 0, 0), bevel=0.006)
    add('box', f'SideSkirt_{sx}', (sx * 0.93, 0.03, 0.20), (0.08, 1.88, 0.07), 'carbon', bevel=0.015)
    for dy in (-0.66, 0.42):
        xx = surf_x(sx, dy, 0.55)
        add('box', f'DoorLine_{sx}_{dy}', (xx + sx * 0.003, dy, 0.50), (0.012, 0.012, 0.40), 'trim')
    xx = surf_x(sx, -0.1, 0.30); add('box', f'DoorSill_{sx}', (xx + sx * 0.003, -0.12, 0.30), (0.012, 1.08, 0.012), 'trim')
    xh = surf_x(sx, 0.22, 0.76); add('box', f'Handle_{sx}', (xh + sx * 0.004, 0.22, 0.76), (0.02, 0.15, 0.025), 'trim', bevel=0.005)
    add('box', f'MirrorArm_{sx}', (sx * 0.77, -0.56, 0.93), (0.14, 0.05, 0.025), 'carbon')
    add('box', f'Mirror_{sx}', (sx * 0.86, -0.55, 0.96), (0.13, 0.11, 0.085), 'paint', bevel=0.025)
    xf = surf_x(sx, 1.05, 0.84); add('cyl', f'FuelCap_{sx}', (xf + sx * 0.003, 1.05, 0.84), (0.13, 0.13, 0.012), 'trim', rot=(0, math.pi / 2, 0), verts=16)

# engine cover louvres over the rear glass
for k in range(5):
    y0 = 0.86 + k * 0.17
    zc, ang = slope(0, y0 - 0.05, y0 + 0.05)
    add('box', f'Louvre_{k}', (0, y0, zc + 0.022), (0.80 - k * 0.05, 0.085, 0.016), 'carbon', rot=(ang + 0.30, 0, 0), bevel=0.004)

# rear: full-width light bar, mesh panel, high centre exhausts, diffuser, ducktail
ty = surf_y(0, 0.80, rear=True)
add('box', 'TailBar', (0, ty - 0.012, 0.80), (1.56, 0.05, 0.035), 'tail', bevel=0.012)
for sx in (-1, 1):
    ty = surf_y(sx * 0.70, 0.74, rear=True)
    add('box', f'Taillight_{sx}', (sx * 0.70, ty - 0.008, 0.745), (0.20, 0.05, 0.085), 'tail', bevel=0.015)
    add('cyl', f'Exhaust_{sx}', (sx * 0.11, 2.13, 0.50), (0.12, 0.12, 0.16), 'chrome', rot=(math.pi / 2, 0, 0), verts=18)
    add('cyl', f'ExhaustBore_{sx}', (sx * 0.11, 2.205, 0.50), (0.09, 0.09, 0.02), 'trim', rot=(math.pi / 2, 0, 0), verts=14)
gy = surf_y(0, 0.60, rear=True)
add('box', 'RearGrille', (0, gy - 0.014, 0.60), (1.30, 0.05, 0.20), 'trim', bevel=0.02)
add('box', 'Diffuser', (0, 2.11, 0.27), (1.30, 0.10, 0.16), 'carbon', bevel=0.01)
for k in range(6): add('box', f'DiffuserFin_{k}', (-0.50 + k * 0.2, 2.15, 0.23), (0.018, 0.14, 0.15), 'carbon')
dz = surf_z(0, 1.98)
add('box', 'Ducktail', (0, 2.00, dz + 0.03), (1.74, 0.22, 0.03), 'paint', rot=(0.18, 0, 0), bevel=0.01)
for sx in (-1, 1):
    add('box', f'DucktailEnd_{sx}', (sx * 0.87, 2.00, dz + 0.02), (0.022, 0.24, 0.07), 'carbon', rot=(0.18, 0, 0), bevel=0.005)

# wheels (pivot at hub so the game can spin and steer them)
def wheel(name, x, y):
    hub = bpy.data.objects.new(name, None); hub.location = (x, y, WZ); link(hub, root)
    out = 1 if x > 0 else -1
    rot = (0, math.pi / 2, 0)
    D = WR * 2
    prim('cyl', name + '_Tyre', (x, y, WZ), (D, D, 0.28), 'tyre', rot=rot, parent=hub, verts=40, bevel=0.03)
    prim('cyl', name + '_Barrel', (x + out * 0.012, y, WZ), (0.53, 0.53, 0.25), 'rim', rot=rot, parent=hub, verts=32)
    prim('cyl', name + '_Disc', (x + out * 0.105, y, WZ), (0.42, 0.42, 0.018), 'disc', rot=rot, parent=hub, verts=36)
    prim('box', name + '_Caliper', (x + out * 0.098, y + (0.07 if x < 0 else -0.07), WZ + 0.165), (0.07, 0.19, 0.09), 'caliper', parent=hub, bevel=0.012)
    prim('cyl', name + '_Lip', (x + out * 0.138, y, WZ), (0.53, 0.53, 0.012), 'trim', rot=rot, parent=hub, verts=40)
    prim('cyl', name + '_Cap', (x + out * 0.14, y, WZ), (0.11, 0.11, 0.03), 'chrome', rot=rot, parent=hub, verts=16)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.262, minor_radius=0.016, major_segments=32, minor_segments=6,
                                     location=(x + out * 0.142, y, WZ), rotation=rot)
    t = bpy.context.active_object; t.name = name + '_RimEdge'; t.data.materials.append(M['rim']); bpy.ops.object.shade_smooth(); t.parent = hub
    for k in range(5):                                     # five split spokes
        for off in (-0.16, 0.16):
            a0 = k * math.tau / 5; a = a0 + off
            ry, rz = 0.05 * math.cos(a0) + 0.105 * math.cos(a), 0.05 * math.sin(a0) + 0.105 * math.sin(a)
            prim('box', f'{name}_Spoke{k}_{off}', (x + out * 0.134, y + ry, WZ + rz),
                 (0.024, 0.032, 0.215), 'rim', rot=(a - math.pi / 2, 0, 0), parent=hub)
    for o in hub.children: o.matrix_parent_inverse = hub.matrix_world.inverted()
wheel('Wheel_FL', -WX, WYF); wheel('Wheel_FR', WX, WYF)
wheel('Wheel_RL', -WX, WYR); wheel('Wheel_RR', WX, WYR)

# ---------- optimise: merge small parts ----------
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
for o in bpy.data.objects:                                   # crisp edges on boxes, smooth on curved skin
    if o.type == 'MESH':
        try: o.data.set_sharp_from_angle(angle=math.radians(42))
        except Exception: pass
tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons)
print('TRIS', tris)

# ---------- report ----------
def bounds():
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return lo, hi
bpy.context.view_layer.update()
lo, hi = bounds()
print('SPEC %s length=%.3f width=%.3f height=%.3f wheelbase=%.3f track=%.3f wheel_radius=%.3f front_axle_y=%.3f rear_axle_y=%.3f'
      % (NAME, hi.y - lo.y, hi.x - lo.x, hi.z - lo.z, WYR - WYF, 2 * WX, WR, WYF, WYR))
print('MATERIALS', sorted({s.material.name for o in bpy.data.objects if o.type == 'MESH' for s in o.material_slots if s.material}))

# ---------- save + export ----------
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, FILE + '.blend'))
for o in bpy.context.selected_objects: o.select_set(False)
def sel(o):
    o.select_set(True)
    for c in o.children: sel(c)
sel(root)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, FILE + '.glb'), export_format='GLB', use_selection=True, export_apply=True)

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
    lo_ = bpy.data.objects.new(name, ld); lo_.location = loc; scene.collection.objects.link(lo_)
    c = lo_.constraints.new('TRACK_TO'); tgt = bpy.data.objects.new('t', None); tgt.location = (0, 0, 0.6)
    scene.collection.objects.link(tgt); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
look = bpy.data.objects.new('look', None); look.location = (0, 0, 0.6); scene.collection.objects.link(look)
tc = cam.constraints.new('TRACK_TO'); tc.target = look; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
for name, loc, lens in (('side', (9, 0, 0.7), 60), ('front', (0, -9, 0.9), 60), ('three_quarter', (-5.6, -5.4, 1.9), 42), ('rear', (4.5, 6.2, 1.9), 42)):
    cam.location = loc; cam.data.lens = lens
    scene.render.filepath = os.path.join(REN, f'{PREVIEW}_{name}.png')
    bpy.ops.render.render(write_still=True)
print('DONE', len(bpy.data.objects), 'objects; render engine', scene.render.engine)

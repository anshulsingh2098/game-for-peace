"""Bike 1 - faceted electric sport bike. Run: blender -b -P build_bike1.py -- <out_dir> <render_dir>
Front points to -Y, up is +Z, metres. Origin on the ground between the wheels."""
import bpy, bmesh, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'assets'
REN = argv[1] if len(argv) > 1 else OUT
os.makedirs(OUT, exist_ok=True); os.makedirs(REN, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def mat(name, color, metal=0.0, rough=0.5, emit=None, emit_s=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = emit_s
    return m

M = {
 'panel':  mat('Paint_Panel',  (0.92, 0.94, 0.97), 0.35, 0.25),
 'dark':   mat('Paint_Dark',   (0.045, 0.047, 0.055), 0.45, 0.38),
 'mid':    mat('Paint_Mid',    (0.16, 0.17, 0.19), 0.5, 0.35),
 'lime':   mat('Accent_Lime',  (0.50, 0.88, 0.04), 0.0, 0.4, emit=(0.5, 0.9, 0.05), emit_s=0.5),
 'tyre':   mat('Tyre',         (0.012, 0.012, 0.014), 0.0, 0.85),
 'rim':    mat('Rim',          (0.05, 0.05, 0.06), 0.8, 0.3),
 'disc':   mat('Disc',         (0.70, 0.72, 0.76), 1.0, 0.25),
 'trim':   mat('Trim_Black',   (0.02, 0.02, 0.025), 0.2, 0.55),
 'head':   mat('Light_Head',   (1, 1, 1), 0.0, 0.1, emit=(1, 1, 1), emit_s=3.0),
 'tail':   mat('Light_Tail',   (0.8, 0.02, 0.02), 0.0, 0.2, emit=(1, 0.08, 0.04), emit_s=3.0),
}

def apply_mod(obj, mod):
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.selected_objects: o.select_set(False)
    obj.select_set(True); bpy.ops.object.modifier_apply(modifier=mod.name)

root = bpy.data.objects.new('Bike_01', None); scene.collection.objects.link(root)

def hull(name, pts, key, mirror=True):
    """Faceted solid: convex hull of the points (mirrored across x)."""
    P = [tuple(p) for p in pts]
    if mirror: P += [(-x, y, z) for x, y, z in pts if abs(x) > 1e-6]
    bm = bmesh.new(); vs = [bm.verts.new(p) for p in P]
    res = bmesh.ops.convex_hull(bm, input=vs)
    dead = list({v for v in res['geom_interior'] + res['geom_unused'] if isinstance(v, bmesh.types.BMVert)})
    if dead: bmesh.ops.delete(bm, geom=dead, context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(M[key])
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o); o.parent = root
    for p in me.polygons: p.use_smooth = False
    return o

def prim(kind, name, loc, size, key, rot=(0, 0, 0), parent=None, verts=16, smooth=True):
    if kind == 'box': bpy.ops.mesh.primitive_cube_add(size=1)
    else: bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=0.5, depth=1)
    o = bpy.context.active_object; o.name = name
    o.scale = size; o.location = loc; o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(M[key])
    if smooth: bpy.ops.object.shade_smooth()
    o.parent = parent or root
    return o
def add(kind, name, loc, size, key, **kw): return prim(kind, name, loc, size, key, **kw)

# ---------- faceted body ----------
FY, RY, WR = -0.78, 0.70, 0.34
# upper fairing / tank: one sharp wedge with a ridge down the middle, nose reaching over the front wheel
hull('Fairing', [(0.0, -0.84, 0.86), (0.16, -0.78, 0.80), (0.31, -0.62, 0.90), (0.0, -0.30, 1.12), (0.29, -0.26, 1.06),
                 (0.0, 0.18, 1.07), (0.22, 0.18, 1.05), (0.24, 0.20, 0.78), (0.35, -0.40, 0.58), (0.31, -0.62, 0.70), (0.10, -0.76, 0.66)], 'panel')
# side plates over the flanks
hull('FlankPlate', [(0.355, -0.58, 0.84), (0.355, -0.02, 1.00), (0.355, 0.16, 0.70),
                    (0.355, -0.32, 0.46), (0.27, -0.52, 0.56), (0.27, 0.12, 0.58)], 'mid')
# belly + battery pack
hull('Belly', [(0.24, -0.66, 0.50), (0.30, -0.40, 0.40), (0.22, 0.35, 0.24), (0.24, 0.45, 0.44),
               (0.14, -0.70, 0.60), (0.10, -0.30, 0.18), (0.16, 0.05, 0.16)], 'dark')
hull('Battery', [(0.22, -0.52, 0.26), (0.30, -0.42, 0.62), (0.26, 0.34, 0.72), (0.22, 0.42, 0.26),
                 (0.15, 0.58, 0.40), (0.12, -0.58, 0.40), (0.18, 0.05, 0.18)], 'dark')
hull('Head', [(0.10, -0.66, 0.96), (0.10, -0.50, 1.05), (0.08, -0.50, 0.80), (0.08, -0.70, 0.82)], 'dark')
# seat + tail that kicks up at the back
hull('Tail', [(0.14, 0.08, 0.96), (0.15, 0.55, 0.97), (0.12, 0.98, 1.07), (0.11, 0.98, 0.98),
              (0.10, 0.10, 0.80), (0.10, 0.80, 0.84), (0.0, 1.00, 1.09), (0.12, 0.30, 0.92)], 'dark')
hull('Seat', [(0.13, 0.10, 0.97), (0.13, 0.60, 0.98), (0.10, 0.62, 1.01), (0.10, 0.12, 1.00)], 'trim')
hull('TailLight', [(0.10, 0.97, 1.03), (0.12, 1.00, 1.07), (0.0, 1.03, 1.08), (0.10, 1.01, 1.01)], 'tail')
# single-sided swingarm on the +x side, thin arm on the other
hull('Swingarm', [(0.12, 0.22, 0.60), (0.21, 0.22, 0.60), (0.12, 0.22, 0.38), (0.21, 0.22, 0.38),
                  (0.12, 0.70, 0.41), (0.21, 0.70, 0.41), (0.12, 0.70, 0.28), (0.21, 0.70, 0.28)], 'dark', mirror=False)
# fenders that hug the tyres
hull('FrontFender', [(0.09, FY - 0.32, 0.52), (0.09, FY - 0.17, 0.75), (0.09, FY + 0.17, 0.75), (0.09, FY + 0.32, 0.54),
                     (0.07, FY - 0.30, 0.50), (0.07, FY + 0.30, 0.52)], 'dark')
hull('RearHugger', [(0.10, RY - 0.34, 0.54), (0.10, RY - 0.18, 0.73), (0.10, RY + 0.18, 0.73), (0.10, RY + 0.34, 0.56),
                    (0.08, RY - 0.32, 0.52), (0.08, RY + 0.32, 0.54)], 'dark')

# ---------- running gear ----------
for sx in (-1, 1):
    add('box', f'Fork_{sx}', (sx * 0.115, -0.71, 0.66), (0.055, 0.055, 0.68), 'mid', rot=(-0.26, 0, 0), smooth=False)
    add('box', f'ForkLower_{sx}', (sx * 0.10, FY - 0.03, 0.40), (0.07, 0.07, 0.24), 'dark', rot=(-0.26, 0, 0), smooth=False)
    add('box', f'Peg_{sx}', (sx * 0.22, 0.28, 0.36), (0.08, 0.14, 0.03), 'lime')
    add('cyl', f'Grip_{sx}', (sx * 0.42, -0.50, 1.07), (0.05, 0.05, 0.12), 'trim', rot=(0, math.pi / 2, 0), verts=10)
    add('box', f'Bar_{sx}', (sx * 0.25, -0.52, 1.06), (0.32, 0.03, 0.03), 'dark', rot=(0, 0, sx * 0.12))
    add('box', f'Mirror_{sx}', (sx * 0.43, -0.60, 1.14), (0.10, 0.04, 0.06), 'mid', smooth=False)
add('box', 'Caliper', (0.085, FY - 0.20, 0.30), (0.04, 0.09, 0.09), 'lime')
add('box', 'SwingarmThin', (-0.13, 0.46, 0.46), (0.05, 0.56, 0.07), 'dark', rot=(-0.28, 0, 0))
add('box', 'PivotAccent', (0.215, 0.24, 0.50), (0.02, 0.10, 0.10), 'lime')
add('box', 'FlankAccent', (0.357, -0.15, 0.62), (0.01, 0.50, 0.02), 'lime', rot=(0.22, 0, 0))
add('box', 'FlankAccentL', (-0.357, -0.15, 0.62), (0.01, 0.50, 0.02), 'lime', rot=(0.22, 0, 0))
add('box', 'HeadStrip', (0, -0.80, 0.84), (0.46, 0.02, 0.035), 'head', rot=(0.0, 0, 0))

def wheel(name, y, width):
    hub = bpy.data.objects.new(name, None); hub.location = (0, y, WR); scene.collection.objects.link(hub); hub.parent = root
    rot = (0, math.pi / 2, 0)
    kids = [prim('cyl', name + '_Tyre', (0, y, WR), (WR * 2, WR * 2, width), 'tyre', rot=rot, parent=hub, verts=36),
            prim('cyl', name + '_Ring', (0, y, WR), (0.60, 0.60, width + 0.008), 'lime' if name == 'Wheel_R' else 'disc', rot=rot, parent=hub, verts=36),
            prim('cyl', name + '_Core', (0, y, WR), (0.52, 0.52, width + 0.012), 'rim' if name == 'Wheel_R' else 'mid', rot=rot, parent=hub, verts=28),
            prim('cyl', name + '_Hub', (0, y, WR), (0.14, 0.14, width + 0.05), 'disc', rot=rot, parent=hub, verts=12)]
    for k in range(5):
        a = k * math.tau / 5
        kids.append(prim('box', f'{name}_Spoke{k}', (0, y + 0.13 * math.cos(a), WR + 0.13 * math.sin(a)),
                         (width + 0.014, 0.04, 0.2), 'trim', rot=(a - math.pi / 2, 0, 0), parent=hub, smooth=False))
    if name == 'Wheel_F':
        kids.append(prim('cyl', name + '_Disc', (0.075, y, WR), (0.40, 0.40, 0.012), 'disc', rot=rot, parent=hub, verts=28))
    for o in kids: o.matrix_parent_inverse = hub.matrix_world.inverted()
wheel('Wheel_F', FY, 0.13)
wheel('Wheel_R', RY, 0.19)

# ---------- merge small parts ----------
def join(objs, name):
    objs = [o for o in objs if o.type == 'MESH']
    if len(objs) < 2: return
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); bpy.context.active_object.name = name
for hub in [o for o in root.children if o.name.startswith('Wheel_')]: join(list(hub.children), hub.name + '_Mesh')
keep = ('Fairing', 'FlankPlate', 'Belly', 'Battery', 'Tail', 'Seat')
join([o for o in root.children if o.type == 'MESH' and o.name not in keep], 'Details')
print('TRIS', sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons))

# ---------- save + export ----------
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'bike_01.blend'))
for o in bpy.context.selected_objects: o.select_set(False)
def sel(o):
    o.select_set(True)
    for c in o.children: sel(c)
sel(root)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'bike_01.glb'), export_format='GLB', use_selection=True, export_apply=True)

# ---------- preview renders ----------
for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'CYCLES'):
    try: scene.render.engine = eng; break
    except TypeError: continue
scene.render.resolution_x, scene.render.resolution_y = 1100, 620
w = bpy.data.worlds.new('w'); w.use_nodes = True; scene.world = w
w.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.02, 0.03, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
bpy.ops.mesh.primitive_plane_add(size=40); fl = bpy.context.active_object; fl.data.materials.append(mat('Floor', (0.03, 0.03, 0.04), 0.0, 0.4))
for name, loc, e in (('key', (-4, -5, 6), 700), ('rim', (5, 5, 4), 500), ('fill', (6, -4, 3), 250)):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = e; ld.size = 5
    lo = bpy.data.objects.new(name, ld); lo.location = loc; scene.collection.objects.link(lo)
    c = lo.constraints.new('TRACK_TO'); t = bpy.data.objects.new('t', None); t.location = (0, 0, 0.5); scene.collection.objects.link(t)
    c.target = t; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
look = bpy.data.objects.new('look', None); look.location = (0, 0.1, 0.55); scene.collection.objects.link(look)
tc = cam.constraints.new('TRACK_TO'); tc.target = look; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
for name, loc, lens in (('side', (-5.2, 0.1, 0.6), 50), ('front', (0, -6.0, 0.9), 50), ('three_quarter', (3.6, -3.4, 1.3), 40), ('rear', (-3.2, 4.0, 1.2), 40)):
    cam.location = loc; cam.data.lens = lens
    scene.render.filepath = os.path.join(REN, f'bike1_{name}.png'); bpy.ops.render.render(write_still=True)
print('DONE')

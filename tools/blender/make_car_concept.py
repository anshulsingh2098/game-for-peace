"""Turns Khronos's CarConcept.glb (CC BY 4.0, Eric Chadwick / Darmstadt Graphics Group, see assets/ASSETS.md) into the lean car model the game uses.

Run:  blender -b --python tools/blender/make_car_concept.py -- <path to CarConcept.glb> assets/car_04_concept.glb

What it does (the original is 213,000 triangles and about 100 meshes; the game wants a few dozen thousand and few draw calls):
  - drops parts nobody sees (wipers, hood underside, engine bay, a second set of paint variants)
  - decimates the heavy parts (wheel rims, brake pads, body panels), keeping the UVs and the baked occlusion
  - joins the body into one mesh (one draw call per material) and each wheel into one mesh under an empty named Wheel_FL / FR / RL / RR,
    which is what src/vehicle/vehicle.js animates
  - moves the car so the tyres touch y = 0, the middle between the axles is the origin, the front points to +Z, the left side is +X
  - renames materials to the names the game looks for (Paint_Body, Glass, Light_Head, Light_Tail, ...), turns off glass transmission (too slow), and
    shrinks every texture to at most 1024 px and saves them as JPEG (WebP failed to write the shrunk occlusion map)
"""
import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SRC, OUT = argv[0], argv[1]
MAXTEX = 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)
def world_bb(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))

# ---- 1. drop what is never seen
DROP = {'BodyWindshieldWipers', 'BodyWindshieldWipersBase', 'BodyHoodInterior01', 'BodyHoodInterior02', 'BodyHoodUnder', 'Engine'}
for o in list(bpy.data.objects):
    if o.name in DROP: bpy.data.objects.remove(o, do_unlink=True)

# ---- 2. flatten the hierarchy of the body parts (keep world position), bake transforms
WHEEL_EMPTIES = {'WheelFrontL': 'Wheel_FL', 'WheelFrontR': 'Wheel_FR', 'WheelRearL': 'Wheel_RL', 'WheelRearR': 'Wheel_RR'}
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
wheel_parts = {k: [] for k in WHEEL_EMPTIES}
body_parts = []
for o in meshes:
    p = o.parent; root = None
    while p:
        if p.name in WHEEL_EMPTIES: root = p.name
        p = p.parent
    (wheel_parts[root] if root else body_parts).append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw; o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.make_single_user(object=True, obdata=True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ---- 3. decimate
def decimate(o, target):
    n = tris(o)
    if n <= target: return
    m = o.modifiers.new('d', 'DECIMATE'); m.ratio = max(0.02, target / n); m.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='d')
for o in meshes:
    n = o.name
    if 'Rim' in n: decimate(o, 1800)
    elif 'BrakePad' in n: decimate(o, 300)
    elif n.startswith('Interior'): decimate(o, max(60, int(tris(o) * 0.35)))
    elif tris(o) > 1500: decimate(o, int(tris(o) * 0.42))

# ---- 4. join the body into one mesh
bpy.ops.object.select_all(action='DESELECT')
for o in body_parts: o.select_set(True)
bpy.context.view_layer.objects.active = body_parts[0]; bpy.ops.object.join()
body = bpy.context.view_layer.objects.active; body.name = 'Body'

# ---- 5. wheels: one mesh per wheel under an empty at the wheel centre
for old, new in WHEEL_EMPTIES.items():
    e = bpy.data.objects[old]; centre = e.matrix_world.translation.copy(); parts = wheel_parts[old]
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
    w = bpy.context.view_layer.objects.active; w.name = new + '_mesh'
    bpy.context.scene.cursor.location = centre; bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    e.name = new; e.parent = None
    w.parent = e; w.matrix_parent_inverse = e.matrix_world.inverted()

# ---- 6. place: tyres touch y = 0 (z = 0 in Blender), the model's own origin is the middle of the car's CG
tyre = bpy.data.objects['Wheel_FL_mesh']; mn, mx = world_bb(tyre); R = (mx.z - mn.z) / 2
lift = -mn.z
for o in bpy.data.objects:
    if o.parent is None: o.location.z += lift
bpy.context.view_layer.update()

# ---- 7. materials the game knows by name
RENAME = {'Paint 1 Carmine': 'Paint_Body', 'Paint 2 Carmine': 'Paint_Trim', 'Headlight': 'Light_Head', 'Brakelight': 'Light_Tail', 'Tireside': 'Tyre_Side', 'Tiretread': 'Tyre'}
for a, b in RENAME.items():
    m = bpy.data.materials.get(a)
    if m: m.name = b
def bsdf(m): return m.node_tree.nodes.get('Principled BSDF') if m and m.use_nodes else None
g = bsdf(bpy.data.materials.get('Glass'))
if g:
    g.inputs['Transmission Weight'].default_value = 0.0; g.inputs['Base Color'].default_value = (0.02, 0.03, 0.04, 1); g.inputs['Roughness'].default_value = 0.04; g.inputs['Metallic'].default_value = 0.9
for name, col in (('Light_Tail', (1.0, 0.08, 0.04, 1)), ('Light_Head', (1.0, 0.94, 0.82, 1))):
    b = bsdf(bpy.data.materials.get(name))
    if b: b.inputs['Emission Color'].default_value = col; b.inputs['Emission Strength'].default_value = 1.0

# ---- 7b. no Khronos / 3D Commerce marks: the original has their logos on the tyre sidewalls (colour and embossed normal map) and on the licence plate.
#      The tyre sidewall and the plate become plain materials, and the logo image itself is blanked.
def plain(name, base, rough):
    m = bpy.data.materials.get(name); b = bsdf(m)
    if not b: return
    for sock in ('Base Color', 'Normal', 'Roughness', 'Metallic'):
        for l in list(b.inputs[sock].links): m.node_tree.links.remove(l)
    b.inputs['Base Color'].default_value = base; b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = 0.0
plain('Tyre_Side', (0.022, 0.022, 0.024, 1), 0.8)
plain('License', (0.85, 0.85, 0.8, 1), 0.6)
logo = bpy.data.images.get('Image_3')
if logo: logo.pixels.foreach_set([0.0, 0.0, 0.0, 1.0] * (logo.size[0] * logo.size[1]))

# ---- 8. textures: at most MAXTEX px
for img in bpy.data.images:
    if img.size[0] > MAXTEX or img.size[1] > MAXTEX:
        k = MAXTEX / max(img.size[0], img.size[1]); img.scale(max(1, int(img.size[0] * k)), max(1, int(img.size[1] * k)))

# ---- 9. report and export
print('RESULT tyre radius', round(R, 4), 'lift', round(lift, 4))
for o in bpy.data.objects:
    if o.type == 'MESH':
        mn, mx = world_bb(o); print('RESULT', o.name, 'tris', tris(o), 'bbox', [round(v, 3) for v in mn], [round(v, 3) for v in mx])
    else:
        print('RESULT empty', o.name, [round(v, 3) for v in o.matrix_world.translation])
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85, export_yup=True, export_materials='EXPORT', export_cameras=False, export_lights=False,
                          export_animations=False, export_extras=False)
print('RESULT exported', OUT)

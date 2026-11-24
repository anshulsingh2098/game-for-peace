"""The traffic motorbike: the owner's Volt Bike (assets/bike_01.glb) without the stick-figure dummy rider that the model carries (round head, visor, chest, arms, hands and thighs), because the traffic bike has a real rider.
Nothing is changed in the original file; this writes assets/traffic/bike_traffic.glb. The dummy is found by place: loose parts of the 'Details' mesh above the seat line between the bars and the tail (chest, arms, hands), the thigh blocks beside the tank, the head and its visor.
Run:  blender -b -P dev/make_traffic_bike.py -- <repo root>"""
import bpy, os, sys
from mathutils import Vector
root = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else os.getcwd()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(root, 'assets', 'bike_01.glb'))
sc = bpy.context.scene
det = [o for o in sc.objects if o.name == 'Details'][0]
bpy.ops.object.select_all(action='DESELECT'); det.select_set(True); bpy.context.view_layer.objects.active = det
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
parts = [o for o in sc.objects if o.name.startswith('Details')]
def box(o):
    b = [o.matrix_world @ Vector(c) for c in o.bound_box]; return [min(v[k] for v in b) for k in range(3)], [max(v[k] for v in b) for k in range(3)]
def dummy(o):                                                                   # Blender axes: -y is the front of the bike, z is up
    mn, mx = box(o)
    if mn[2] >= 0.95 and mx[2] <= 1.32 and mn[1] > -0.6 and mx[1] < 0.5: return True            # chest, arms, hands
    if 0.74 <= mn[2] < 0.95 and mx[2] <= 1.07 and mn[1] > -0.75 and mx[1] < 0.5: return True    # thighs
    if mn[2] >= 1.28 and mn[1] > -0.6 and mx[1] < -0.1: return True                             # head
    return False
gone = [o for o in parts if dummy(o)]
print('removing', len(gone), 'of', len(parts), 'loose parts of Details')
bpy.ops.object.select_all(action='DESELECT')
for o in gone: o.select_set(True)
bpy.ops.object.delete()
# the dummy's hands took the handlebar with them: put a plain one back (bar, grips, and the stalks the mirrors sit on)
trim = bpy.data.materials['Trim_Black']
def rod(name, loc, rot, r, d):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=r, depth=d, location=loc, rotation=rot); o = bpy.context.active_object; o.name = 'Details_' + name; o.data.materials.append(trim)
rod('bar', (0, -0.56, 1.06), (0, 1.5708, 0), 0.013, 0.86)
for sx in (1, -1):
    rod('grip%d' % sx, (sx * 0.38, -0.56, 1.06), (0, 1.5708, 0), 0.02, 0.13)
    rod('stalk%d' % sx, (sx * 0.43, -0.58, 1.085), (0, 0, 0), 0.008, 0.06)
keep = [o for o in sc.objects if o.name.startswith('Details')]
bpy.ops.object.select_all(action='DESELECT')
for o in keep: o.select_set(True)
bpy.context.view_layer.objects.active = keep[0]; bpy.ops.object.join(); bpy.context.active_object.name = 'Details'
bpy.ops.object.select_all(action='SELECT')
out = os.path.join(root, 'assets', 'traffic', 'bike_traffic.glb'); os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=True, export_animations=False)
print('wrote', out)

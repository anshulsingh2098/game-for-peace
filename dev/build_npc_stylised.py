"""Stylised rigged NPC (big head, small hands, chunky sneakers; the look of the reference sheet the owner supplied, but an original character).

Run:  blender -b -P dev/build_npc_stylised.py -- <out_dir> [variant]
Writes <out_dir>/npc_<variant>.glb (skinned mesh, armature, a looping 'Walk' and an 'Idle' action) and <out_dir>/npc_<variant>_*.png previews.
Variants change only the outfit colours: commuter, vendor, tourist.
Units are metres, the character faces -Y in Blender (+Z in glTF), feet on the ground, about 1.75 m tall.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(__file__), 'previews')
VARIANT = argv[1] if len(argv) > 1 else 'commuter'
os.makedirs(OUT, exist_ok=True)

PALETTE = {
    'commuter': dict(top='#f1f1ef', stripe='#16181d', pants='#c8321f', pants_stripe='#f1f1ef', hat='#3b3f46', shoes='#f4f4f2', skin='#8a5a44', accent='#d8a62a'),
    'vendor':   dict(top='#e9a23b', stripe='#7a3d12', pants='#3d4a5c', pants_stripe='#3d4a5c', hat='#f3efe4', shoes='#5a4636', skin='#9a6a4e', accent='#c8321f'),
    'tourist':  dict(top='#3fa7a0', stripe='#f1f1ef', pants='#d9c9a3', pants_stripe='#d9c9a3', hat='#2c5c8f', shoes='#f1f1ef', skin='#e0b295', accent='#e8505b'),
}[VARIANT]

def hexc(h, a=1.0):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (a,)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def srgb(c):  # glTF wants linear; Blender's colour fields are linear already, so convert
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c[:3]) + (1.0,)

MATS = {}
def mat(name, hexcol, rough=0.55, metal=0.0, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(hexc(hexcol)); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = srgb(hexc(emit)); b.inputs['Emission Strength'].default_value = 1.2
    MATS[name] = m; return m

for n, c, r, mt in [('Skin', PALETTE['skin'], 0.62, 0), ('Top', PALETTE['top'], 0.7, 0), ('Stripe', PALETTE['stripe'], 0.7, 0), ('Pants', PALETTE['pants'], 0.75, 0),
                    ('PantsStripe', PALETTE['pants_stripe'], 0.75, 0), ('Hat', PALETTE['hat'], 0.85, 0), ('Shoe', PALETTE['shoes'], 0.5, 0), ('Sole', '#e9e9e6', 0.6, 0),
                    ('Hair', '#17120f', 0.8, 0), ('Lens', '#101216', 0.15, 0), ('Frame', PALETTE['accent'], 0.35, 0.6), ('Eye', '#f6f6f4', 0.3, 0), ('Pupil', '#15110f', 0.2, 0),
                    ('Lip', '#5a2e26', 0.5, 0), ('Gold', PALETTE['accent'], 0.28, 1.0)]:
    mat(n, c, r, mt)

parts = []
def add(obj, name, material, subsurf=1, smooth=True):
    obj.name = name
    obj.data.materials.append(MATS[material])
    if smooth:
        for p in obj.data.polygons: p.use_smooth = True
    bpy.context.view_layer.objects.active = obj
    if subsurf:
        md = obj.modifiers.new('sub', 'SUBSURF'); md.levels = subsurf; md.render_levels = subsurf
    parts.append(obj); return obj

def sphere(name, loc, scale, material, segs=24, rings=16, subsurf=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, location=loc); o = bpy.context.active_object
    o.scale = scale; bpy.ops.object.transform_apply(scale=True); return add(o, name, material, subsurf)

def cube(name, loc, scale, material, bevel=0.02, subsurf=2, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot); o = bpy.context.active_object
    o.scale = scale; bpy.ops.object.transform_apply(scale=True, rotation=True)
    md = o.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 3
    return add(o, name, material, subsurf)

def cyl(name, loc, r1, r2, depth, material, rot=(0, 0, 0), verts=20, subsurf=0):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot); o = bpy.context.active_object
    return add(o, name, material, subsurf)

def torus(name, loc, major, minor, material, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=32, minor_segments=10, location=loc, rotation=rot); o = bpy.context.active_object
    o.scale = scale; bpy.ops.object.transform_apply(scale=True); return add(o, name, material, 0)

# Blender: -Y is the front. Heights in metres. Mirror helper builds left (+X) and right (-X).
def both(fn, x, *a, **k):
    return [fn(s * x if False else x * s, *a, **k) for s in (1, -1)]

# ---- head (big, slightly egg shaped), face, hair, hat, shades
HEAD_Z = 1.52
sphere('Head', (0, 0, HEAD_Z), (0.135, 0.15, 0.16), 'Skin', 32, 20, 1)
sphere('Jaw', (0, -0.035, HEAD_Z - 0.085), (0.105, 0.115, 0.095), 'Skin', 24, 14, 1)
sphere('Nose', (0, -0.15, HEAD_Z - 0.03), (0.026, 0.034, 0.03), 'Skin', 12, 8, 0)
for s in (1, -1):
    sphere('Ear', (s * 0.138, 0.01, HEAD_Z - 0.01), (0.02, 0.026, 0.04), 'Skin', 12, 8, 0)
    sphere('Brow', (s * 0.052, -0.14, HEAD_Z + 0.055), (0.05, 0.012, 0.012), 'Hair', 12, 8, 0)
sphere('Mouth', (0, -0.142, HEAD_Z - 0.085), (0.04, 0.012, 0.014), 'Lip', 12, 8, 0)
sphere('Beard', (0, -0.05, HEAD_Z - 0.115), (0.092, 0.095, 0.05), 'Hair', 20, 12, 1)
sphere('Hair', (0, 0.035, HEAD_Z + 0.015), (0.143, 0.14, 0.15), 'Hair', 24, 16, 1)
# bucket hat: crown + brim
cyl('HatCrown', (0, 0.0, HEAD_Z + 0.115), 0.155, 0.13, 0.17, 'Hat', verts=28, subsurf=1)
cyl('HatBrim', (0, -0.02, HEAD_Z + 0.055), 0.235, 0.18, 0.04, 'Hat', verts=32, subsurf=1)
# shades: two lenses + bridge + frame
for s in (1, -1):
    cube('LensFrame', (s * 0.056, -0.150, HEAD_Z + 0.015), (0.056, 0.006, 0.034), 'Frame', 0.006, 0)
    cube('Lens', (s * 0.056, -0.158, HEAD_Z + 0.015), (0.047, 0.006, 0.026), 'Lens', 0.006, 0)
    cube('Temple', (s * 0.127, -0.075, HEAD_Z + 0.02), (0.005, 0.075, 0.008), 'Frame', 0.002, 0)
cube('Bridge', (0, -0.156, HEAD_Z + 0.02), (0.014, 0.006, 0.008), 'Frame', 0.002, 0)

# ---- neck and torso (jacket), collar, chain
cyl('Neck', (0, 0, 1.385), 0.052, 0.058, 0.09, 'Skin', verts=16)
sphere('Torso', (0, 0.0, 1.17), (0.195, 0.125, 0.235), 'Top', 28, 18, 1)
sphere('Belly', (0, -0.012, 0.99), (0.17, 0.115, 0.12), 'Top', 24, 14, 1)
cyl('Collar', (0, 0, 1.345), 0.085, 0.075, 0.06, 'Top', verts=20, subsurf=1)
cube('ZipStripe', (0, -0.118, 1.12), (0.014, 0.012, 0.19), 'Stripe', 0.004, 0)
torus('Chain', (0, -0.075, 1.31), 0.092, 0.011, 'Gold', rot=(math.radians(70), 0, 0), scale=(1, 1.15, 1))

# ---- hips and legs
sphere('Hips', (0, 0.0, 0.88), (0.185, 0.125, 0.12), 'Pants', 24, 14, 1)
for s in (1, -1):
    sphere('Thigh', (s * 0.085, 0.0, 0.7), (0.1, 0.105, 0.2), 'Pants', 20, 14, 1)
    sphere('Shin', (s * 0.085, 0.0, 0.34), (0.082, 0.088, 0.21), 'Pants', 20, 14, 1)
    cube('ThighStripe', (s * 0.1765, 0.0, 0.7), (0.006, 0.028, 0.14), 'PantsStripe', 0.002, 0)
    cube('ShinStripe', (s * 0.1585, 0.0, 0.34), (0.006, 0.026, 0.13), 'PantsStripe', 0.002, 0)
    # chunky sneaker
    sphere('Shoe', (s * 0.085, -0.045, 0.085), (0.095, 0.195, 0.09), 'Shoe', 22, 14, 1)
    sphere('Sole', (s * 0.085, -0.045, 0.034), (0.1, 0.212, 0.038), 'Sole', 22, 12, 1)
    sphere('ShoeToe', (s * 0.085, -0.15, 0.08), (0.092, 0.092, 0.075), 'Shoe', 16, 10, 1)
    cube('ShoeStripe', (s * 0.178, -0.035, 0.1), (0.005, 0.08, 0.022), 'Stripe', 0.002, 0)

# ---- arms and hands (small hands)
for s in (1, -1):
    sphere('UpperArm', (s * 0.255, 0.0, 1.17), (0.062, 0.068, 0.15), 'Top', 18, 12, 1)
    sphere('Forearm', (s * 0.265, 0.0, 0.92), (0.055, 0.058, 0.15), 'Top', 18, 12, 1)
    torus('Cuff', (s * 0.268, 0.0, 0.8), 0.052, 0.013, 'Stripe')
    sphere('Hand', (s * 0.268, 0.0, 0.73), (0.045, 0.036, 0.062), 'Skin', 16, 10, 1)
    sphere('Thumb', (s * 0.245, -0.03, 0.74), (0.014, 0.014, 0.03), 'Skin', 8, 6, 0)
    sphere('Eye', (s * 0.052, -0.138, HEAD_Z + 0.002), (0.019, 0.01, 0.019), 'Eye', 10, 8, 0)
    sphere('Pupil', (s * 0.052, -0.147, HEAD_Z + 0.002), (0.009, 0.004, 0.009), 'Pupil', 8, 6, 0)

# the eyes are hidden behind the shades on this outfit; hide them unless the variant has no shades
if VARIANT != 'commuter':
    for o in list(parts):
        if o.name.split('.')[0] in ('Lens', 'LensFrame', 'Temple', 'Bridge'): parts.remove(o); bpy.data.objects.remove(o, do_unlink=True)

if PALETTE['pants'] == PALETTE['pants_stripe']:      # no trouser stripe on this outfit
    for o in list(parts):
        if o.name.split('.')[0] in ('ThighStripe', 'ShinStripe'): parts.remove(o); bpy.data.objects.remove(o, do_unlink=True)

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

# ---- skin: every part is weighted to its bone, and near a joint the weight blends smoothly into the neighbouring bone, so elbows, knees, hips, waist and neck bend instead of the parts sliding past each other
bpy.ops.object.select_all(action='DESELECT')
HEADN = ('Head', 'Jaw', 'Nose', 'Ear', 'Brow', 'Mouth', 'Beard', 'Hair', 'HatCrown', 'HatBrim', 'Lens', 'LensFrame', 'Temple', 'Bridge', 'Eye', 'Pupil')
HIP, KNEE, ANKLE, SHOULDER, ELBOW, WRIST, WAIST, NECK = 0.88, 0.5, 0.13, 1.31, 1.05, 0.79, 0.98, 1.36
BL = 0.08                                                  # half width of a blend zone, metres
def sm(a0, a1, x):
    t = max(0.0, min(1.0, (x - a0) / (a1 - a0))); return t * t * (3 - 2 * t)
def bone_for(o):
    n = o.name.split('.')[0]; sd = 'L' if sum(v.co.x for v in o.data.vertices) / max(1, len(o.data.vertices)) >= 0 else 'R'
    if n in HEADN: return 'Head', sd
    if n == 'Neck': return 'Neck', sd
    if n in ('Torso', 'Collar', 'ZipStripe', 'Chain'): return 'Chest', sd
    if n == 'Belly': return 'Spine', sd
    if n == 'Hips': return 'Hips', sd
    if n in ('Thigh', 'ThighStripe'): return 'UpperLeg_' + sd, sd
    if n in ('Shin', 'ShinStripe'): return 'LowerLeg_' + sd, sd
    if n in ('Shoe', 'Sole', 'ShoeToe', 'ShoeStripe'): return 'Foot_' + sd, sd
    if n == 'UpperArm': return 'UpperArm_' + sd, sd
    if n in ('Forearm', 'Cuff'): return 'LowerArm_' + sd, sd
    if n in ('Hand', 'Thumb'): return 'Hand_' + sd, sd
    return 'Chest', sd
def weights(n, bone, sd, z):
    """bone name -> weight for a vertex at height z of a part called n whose own bone is `bone`"""
    n = n.split('.')[0]; w = {}
    if n in ('Thigh', 'ThighStripe'):
        wh = sm(HIP - BL, HIP + BL, z); wk = 1 - sm(KNEE - BL, KNEE + BL, z); w = {'Hips': wh, 'LowerLeg_' + sd: wk, bone: max(0.0, 1 - wh - wk)}
    elif n in ('Shin', 'ShinStripe'):
        wu = sm(KNEE - BL, KNEE + BL, z); wf = 1 - sm(ANKLE - BL, ANKLE + BL, z); w = {'UpperLeg_' + sd: wu, 'Foot_' + sd: wf, bone: max(0.0, 1 - wu - wf)}
    elif n == 'UpperArm':
        wc = sm(SHOULDER - BL, SHOULDER + BL, z); wl = 1 - sm(ELBOW - BL, ELBOW + BL, z); w = {'Chest': wc, 'LowerArm_' + sd: wl, bone: max(0.0, 1 - wc - wl)}
    elif n in ('Forearm', 'Cuff'):
        wu = sm(ELBOW - BL, ELBOW + BL, z); wh = 1 - sm(WRIST - BL, WRIST + BL, z); w = {'UpperArm_' + sd: wu, 'Hand_' + sd: wh, bone: max(0.0, 1 - wu - wh)}
    elif n == 'Torso':
        ws = 1 - sm(1.05, 1.30, z); wn = sm(1.33, 1.42, z); w = {'Spine': ws, 'Neck': wn, 'Chest': max(0.0, 1 - ws - wn)}
    elif n == 'Belly':
        wh = 1 - sm(0.90, 1.02, z); wc = 0.5 * sm(1.04, 1.12, z); w = {'Hips': wh, 'Chest': wc, 'Spine': max(0.0, 1 - wh - wc)}
    elif n == 'Hips':
        ws = 0.6 * sm(0.92, 1.0, z); w = {'Spine': ws, 'Hips': 1 - ws}
    elif n == 'Neck':
        wc = 1 - sm(1.34, 1.40, z); wd = sm(1.38, 1.45, z); w = {'Chest': wc, 'Head': wd, 'Neck': max(0.0, 1 - wc - wd)}
    else:
        w = {bone: 1.0}
    t = sum(w.values()) or 1.0
    return {k: v / t for k, v in w.items() if v / t > 0.002}
for o in parts:
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    bone, sd = bone_for(o); groups = {}
    for v in o.data.vertices:
        z = (o.matrix_world @ v.co).z
        for name, wt in weights(o.name, bone, sd, z).items():
            if name not in groups: groups[name] = o.vertex_groups.new(name=name)
            groups[name].add([v.index], wt, 'REPLACE')
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

# ---- export
glb = os.path.join(OUT, 'npc_%s.glb' % VARIANT)
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_animations=True, export_nla_strips=True, export_skins=True, export_apply=False, export_yup=True)

# ---- previews
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
def shot(name, loc, target=(0, 0, 0.9), frame=None):
    cam.location = loc; cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    if frame is not None:
        arm_obj.animation_data.action = walk_act; scene.frame_set(frame)
    scene.render.filepath = os.path.join(OUT, 'npc_%s_%s.png' % (VARIANT, name)); bpy.ops.render.render(write_still=True)
def sheet(clip, frames, tag):
    for f in frames:
        arm_obj.animation_data.action = acts[clip]; scene.frame_set(f)
        cam.location = (5.4, -0.2, 1.0); cam.rotation_euler = (Vector((0, 0, 0.85)) - Vector((5.4, -0.2, 1.0))).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(OUT, 'npc_%s_%s_%02d.png' % (VARIANT, tag, f)); bpy.ops.render.render(write_still=True)
shot('front', (0.9, -5.2, 1.1), frame=1)
shot('walk', (3.2, -4.0, 1.1), frame=12)
shot('head', (0.5, -1.6, 1.55), target=(0, 0, 1.5), frame=1)
sheet('Walk', [1, 7, 13, 19], 'walk')
sheet('Run', [1, 5, 9, 13], 'run')
print('NPC built:', glb, 'tris', sum(len(p.polygons) for p in body.data.polygons) if False else len(body.data.polygons), 'faces')

# ---- low-detail copy for crowds: same skeleton and animations, about a tenth of the faces
bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = body; body.select_set(True)
dm = body.modifiers.new('lod', 'DECIMATE'); dm.ratio = 0.1
while body.modifiers[0].name != 'lod': bpy.ops.object.modifier_move_up(modifier='lod')
bpy.ops.object.modifier_apply(modifier='lod')
fl.hide_render = True
for o in list(bpy.data.objects):
    if o.type in ('LIGHT', 'CAMERA') or o is fl: bpy.data.objects.remove(o, do_unlink=True)
lod = os.path.join(OUT, 'npc_%s_lod1.glb' % VARIANT)
bpy.ops.export_scene.gltf(filepath=lod, export_format='GLB', export_animations=True, export_nla_strips=True, export_skins=True, export_yup=True)
print('LOD1 faces', len(body.data.polygons), lod)

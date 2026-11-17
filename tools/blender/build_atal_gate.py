import bpy, bmesh, math, os, sys
from mathutils import Vector
TEX = '/Users/rajulsingh/game-for-peace/assets/atal/'
OUT = os.path.dirname(os.path.abspath(__file__)) + '/'
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, tex, tint=(1, 1, 1, 1), rough=0.85, normal=True):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    c = nt.nodes.new('ShaderNodeTexImage'); c.image = bpy.data.images.load(TEX + tex + '_color.jpg'); c.image.colorspace_settings.name = 'sRGB'
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0; mix.inputs[7].default_value = tint
    nt.links.new(c.outputs['Color'], mix.inputs[6]); nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    if normal:
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(TEX + tex + '_normal.jpg'); n.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    return m
STONE = material('stone', 'stone', (0.82, 0.8, 0.76, 1)); STONE_RED = material('stone_band', 'stone', (0.62, 0.36, 0.28, 1))
WOOD = material('wood', 'wood', (0.55, 0.4, 0.32, 1), 0.7); WOOD_DARK = material('wood_dark', 'wood', (0.36, 0.2, 0.15, 1), 0.7)
ROOF = material('roof', 'roof', (0.42, 0.5, 0.58, 1), 0.55); DARK = material('dark', 'stone', (0.12, 0.14, 0.17, 1), 0.9, False)
SIGN = bpy.data.materials.new('sign'); SIGN.use_nodes = True; SIGN.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.1, 0.14, 0.19, 1)

def uv_box(bm, scale):
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            p = l.vert.co; a, b = [(p.y, p.z), (p.x, p.z), (p.x, p.y)][ax]
            l[uv].uv = (a / scale, b / scale)
def add_box(bm, size, loc, rot=0.0):
    r = bmesh.ops.create_cube(bm, size=1.0)
    for v in r['verts']:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    if rot: bmesh.ops.rotate(bm, verts=r['verts'], cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(rot, 3, 'Y'))
    bmesh.ops.translate(bm, verts=r['verts'], vec=loc)
def make(name, mat, builder, scale=1.5):
    bm = bmesh.new(); builder(bm); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); uv_box(bm, scale)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o

HALF = 7.9          # distance from the road centre to each pillar axis
COURSE = 0.38
def pillar_stone(bm):                                                     # plinth, banded courses, capital
    add_box(bm, (2.8, 3.0, 0.45), (0, 0, 0.225))
    for i in range(17):
        if i % 4 == 3: continue                                           # every fourth course is the red band, built separately
        w = 2.1 - (0.05 if i % 2 else 0); add_box(bm, (w, w + 0.2, COURSE - 0.03), (0, 0, 0.45 + i * COURSE + COURSE / 2))
    add_box(bm, (2.6, 2.8, 0.35), (0, 0, 0.45 + 17 * COURSE + 0.175))
def pillar_band(bm):
    for i in range(17):
        if i % 4 == 3: add_box(bm, (2.14, 2.34, COURSE - 0.02), (0, 0, 0.45 + i * COURSE + COURSE / 2))
PH = 0.45 + 17 * COURSE + 0.35            # pillar top height
pillars = []
for side, nm in ((-1, 'PillarL'), (1, 'PillarR')):
    a = make(nm + '_stone', STONE, pillar_stone, 1.2); b = make(nm + '_band', STONE_RED, pillar_band, 1.2)
    for o in (a, b): o.location = (side * HALF, 0, 0)
    pillars += [a, b]
# the span, built for HALF and stretched sideways in the game
EAVE = HALF + 2.6; RISE = 2.5; BASE = PH + 0.9
def beams(bm):
    for k in range(4): add_box(bm, (2 * (HALF + 1.6), 0.5, 0.42), (0, -1.0 + k * 0.67, PH + 0.21))            # lower layer along the span
    for k in range(15): add_box(bm, (0.26, 4.6, 0.36), (-HALF - 1.4 + k * (2 * HALF + 2.8) / 14, 0, PH + 0.6))   # rafters, ends showing at front and back
def fascia(bm):
    for sx in (-1, 1):
        L = math.hypot(EAVE, RISE); a = math.atan2(RISE, EAVE)
        for sy in (-1, 1): add_box(bm, (L, 0.14, 0.55), (sx * EAVE / 2, sy * 2.95, BASE + RISE / 2 + 0.1), sx * a)    # barge boards along the gable edges
    add_box(bm, (2 * EAVE + 0.4, 5.9, 0.2), (0, 0, BASE - 0.1))                                               # underside board
def roof(bm):
    L = math.hypot(EAVE, RISE) + 0.4; a = math.atan2(RISE, EAVE)
    for sx in (-1, 1): add_box(bm, (L, 5.8, 0.16), (sx * EAVE / 2, 0, BASE + RISE / 2 + 0.28), sx * a)
    add_box(bm, (0.5, 5.9, 0.22), (0, 0, BASE + RISE + 0.36))                                                 # ridge cap
def gable(bm):                                                           # dark triangular infill, front and back
    for sy in (-1, 1):
        vs = [bm.verts.new(Vector((-EAVE + 0.3, sy * 2.78, BASE))), bm.verts.new(Vector((EAVE - 0.3, sy * 2.78, BASE))), bm.verts.new(Vector((0, sy * 2.78, BASE + RISE - 0.05)))]
        bm.faces.new(vs if sy < 0 else vs[::-1])
span = [make('Span_beams', WOOD, beams), make('Span_fascia', WOOD_DARK, fascia), make('Span_roof', ROOF, roof, 1.0), make('Span_gable', DARK, gable)]
# the name board: a plane under the gable on each face, UV 0..1 so the game can paint any name on it
def sign_plane(sy):
    bm = bmesh.new(); w = HALF - 0.5; z0 = BASE - 0.2; h = 1.7
    vs = [bm.verts.new(Vector((x, sy * 2.82, z))) for x, z in ((-w, z0), (w, z0), (w, z0 + h), (-w, z0 + h))]
    f = bm.faces.new(vs if sy > 0 else vs[::-1]); uv = bm.loops.layers.uv.verify()
    for l, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1)) if sy < 0 else ((1, 0), (0, 0), (0, 1), (1, 1))): l[uv].uv = (u, v)
    me = bpy.data.meshes.new('Sign' + str(sy)); bm.to_mesh(me); bm.free(); me.materials.append(SIGN)
    o = bpy.data.objects.new('Sign' + ('F' if sy > 0 else 'B'), me); bpy.context.scene.collection.objects.link(o); return o
span += [sign_plane(1), sign_plane(-1)]
root = bpy.data.objects.new('Span', None); bpy.context.scene.collection.objects.link(root)
for o in span: o.parent = root
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT + 'atal_gate.glb', export_format='GLB', export_image_format='JPEG', export_jpeg_quality=82)
print('EXPORTED', os.path.getsize(OUT + 'atal_gate.glb') // 1000, 'KB')
# preview render
scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'; scn.cycles.samples = 48; scn.cycles.use_denoising = True
wd = bpy.data.worlds.new('w'); wd.use_nodes = True; bg = wd.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.55, 0.68, 0.9, 1); bg.inputs[1].default_value = 1.0; scn.world = wd
sun = bpy.data.lights.new('s', 'SUN'); sun.energy = 3.5; so = bpy.data.objects.new('s', sun); scn.collection.objects.link(so); so.rotation_euler = (math.radians(55), 0, math.radians(-30))
cam = bpy.data.cameras.new('c'); cam.lens = 35; co = bpy.data.objects.new('c', cam); scn.collection.objects.link(co); scn.camera = co
co.location = (9, -26, 7); direction = Vector((0, 0, 5)) - co.location; co.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
scn.render.resolution_x = 900; scn.render.resolution_y = 560; scn.render.filepath = OUT + 'preview.png'; bpy.ops.render.render(write_still=True); print('PREVIEW done')

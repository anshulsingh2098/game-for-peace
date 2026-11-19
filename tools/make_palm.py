"""Makes assets/nature/palm_royal.glb: a royal palm (Roystonea, the tall grey-trunked palm of Delhi's avenues, Kartavya Path and CP's pavements), own work, no outside model.
Run: blender -b --python tools/make_palm.py   (Blender 3.6+; writes the .glb and a preview PNG next to it)
Real size: 13 m tall, trunk 0.34 m across at the foot, swelling slightly at a third of the height, 0.24 m at the top, a 1.1 m green crownshaft, 15 arching fronds 4.2 to 5 m long.
About 2,400 triangles. Y up, the foot at y 0, centred on x, z 0. Three materials: trunk, crownshaft, frond (double sided: the material has back-face culling off).
"""
import bpy, bmesh, math, random, os, sys
random.seed(7)
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'assets', 'nature', 'palm_royal.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name, rgb, rough=0.85):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough; m.use_backface_culling = False; m.diffuse_color = (*rgb, 1); return m
M_TRUNK = mat('palm_trunk', (0.42, 0.38, 0.31)); M_SHAFT = mat('palm_crownshaft', (0.22, 0.36, 0.14)); M_FROND = mat('palm_frond', (0.15, 0.33, 0.10), 0.7)
def obj(name, bm, material):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); o.data.materials.append(material); bpy.context.collection.objects.link(o); return o
# trunk: a ring stack, 12 sides, radius profile with a gentle swell and faint ring ridges every 0.35 m
H, SIDES = 11.9, 12; bm = bmesh.new(); rings = []
n = 36
for i in range(n + 1):
    t = i / n; y = H * t; r = 0.21 - 0.07 * t + 0.04 * math.sin(math.pi * min(1, t / 0.45)) * (1 - t) + (0.012 if i % 2 else 0) + (0.09 * (1 - t / 0.06) if t < 0.06 else 0)
    rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / SIDES), y, r * math.sin(2 * math.pi * k / SIDES))) for k in range(SIDES)])
for i in range(n):
    for k in range(SIDES):
        bm.faces.new((rings[i][k], rings[i][(k + 1) % SIDES], rings[i + 1][(k + 1) % SIDES], rings[i + 1][k]))
trunk = obj('trunk', bm, M_TRUNK)
# crownshaft: a smooth green sleeve on top of the trunk
bm = bmesh.new(); y0 = H - 0.1; rr = [0.135, 0.15, 0.14, 0.1]; yy = [y0, y0 + 0.4, y0 + 0.85, y0 + 1.25]; rs = []
for r, y in zip(rr, yy): rs.append([bm.verts.new((r * math.cos(2 * math.pi * k / SIDES), y, r * math.sin(2 * math.pi * k / SIDES))) for k in range(SIDES)])
for i in range(len(rr) - 1):
    for k in range(SIDES): bm.faces.new((rs[i][k], rs[i][(k + 1) % SIDES], rs[i + 1][(k + 1) % SIDES], rs[i + 1][k]))
top = bm.verts.new((0, yy[-1] + 0.25, 0))
for k in range(SIDES): bm.faces.new((rs[-1][k], rs[-1][(k + 1) % SIDES], top))
shaft = obj('crownshaft', bm, M_SHAFT)
# fronds: a spine that rises then arches and droops, with leaflet pairs along it (each leaflet a thin tapered double-sided quad pair); 15 fronds around, in two tiers
bm = bmesh.new(); TOPY = H + 1.0
def frond(az, length, rise, droop, tilt):
    ca, sa = math.cos(az), math.sin(az); N = 22; pts = []
    for s in range(N + 1):
        t = s / N; d = length * t; y = TOPY + rise * math.sin(math.pi * 0.5 * min(1, t * 1.5)) - droop * t ** 2.3
        pts.append((ca * d, y, sa * d))
    for i in range(N):                                            # the spine, a thin strip
        a, b2 = pts[i], pts[i + 1]; w = 0.03 * (1 - i / (N * 1.3)); px, pz = -sa * w, ca * w
        v = [bm.verts.new((a[0] - px, a[1], a[2] - pz)), bm.verts.new((a[0] + px, a[1], a[2] + pz)), bm.verts.new((b2[0] + px, b2[1], b2[2] + pz)), bm.verts.new((b2[0] - px, b2[1], b2[2] - pz))]
        bm.faces.new(v)
    for i in range(2, N):                                         # leaflet pairs: longest in the middle, swept to the tip, drooping
        t = i / N; p0 = pts[i]; nx_ = pts[min(N, i + 1)]; dx, dy, dz = nx_[0] - p0[0], nx_[1] - p0[1], nx_[2] - p0[2]; ln = math.hypot(dx, dy, dz) or 1; dx, dy, dz = dx / ln, dy / ln, dz / ln
        L = 1.25 * (0.25 + 0.75 * math.sin(math.pi * min(1, t * 1.05))); wd = 0.11
        for side in (-1, 1):
            sx, sz = -sa * side, ca * side; lx, ly, lz = sx * L * 0.8 + dx * L * 0.45, -0.5 * L + dy * L * 0.3, sz * L * 0.8 + dz * L * 0.45
            base = bm.verts.new(p0); tip = bm.verts.new((p0[0] + lx, p0[1] + ly, p0[2] + lz))
            m1 = bm.verts.new((p0[0] + lx * 0.5 + dx * wd, p0[1] + ly * 0.5 + wd * 0.5, p0[2] + lz * 0.5 + dz * wd)); m2 = bm.verts.new((p0[0] + lx * 0.5 - dx * wd, p0[1] + ly * 0.5 + wd * 0.5, p0[2] + lz * 0.5 - dz * wd))
            bm.faces.new((base, m1, tip)); bm.faces.new((base, tip, m2))
for k in range(9): frond(2 * math.pi * k / 9 + random.uniform(-0.12, 0.12), random.uniform(4.4, 5.2), random.uniform(1.4, 2.0), random.uniform(2.6, 3.4), 0)            # the main tier, arching down
for k in range(6): frond(2 * math.pi * (k + 0.5) / 6 + random.uniform(-0.15, 0.15), random.uniform(3.4, 4.2), random.uniform(2.4, 3.0), random.uniform(0.9, 1.5), 0)         # the younger upper tier, more upright
fr = obj('fronds', bm, M_FROND)
for o in (trunk, shaft, fr):
    o.rotation_euler = (math.radians(90), 0, 0)      # built with y as height: turn it so Blender's Z is up (the exporter then writes glTF Y up)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
bpy.ops.object.shade_smooth()
tris = sum(len(o.data.polygons) * (1 if len(o.data.polygons[0].vertices) == 3 else 2) for o in (trunk, shaft, fr) if o.data.polygons)
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=True)
# preview
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 17; co = bpy.data.objects.new('c', cam); bpy.context.collection.objects.link(co); co.location = (0, -30, 7.0); co.rotation_euler = (math.radians(90), 0, 0); bpy.context.scene.camera = co
sun = bpy.data.lights.new('s', 'SUN'); sun.energy = 3; so = bpy.data.objects.new('s', sun); so.rotation_euler = (math.radians(50), 0, math.radians(30)); bpy.context.collection.objects.link(so)
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.7, 0.8, 0.9, 1); bpy.context.scene.world = w
sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sc.render.resolution_x = 480; sc.render.resolution_y = 640; sc.render.filepath = out.replace('.glb', '_preview.png'); sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
bpy.ops.render.render(write_still=True)
print('palm written', out, 'tris', tris)

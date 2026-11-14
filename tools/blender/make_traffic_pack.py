"""Builds the traffic vehicle set (assets/traffic/traffic_pack.glb + traffic_pack.json) from Kenney's Car Kit (CC0, https://kenney.nl/assets/car-kit; the owner downloaded kenney_car-kit.zip).

Run:  blender -b --python tools/blender/make_traffic_pack.py -- "<folder with the unzipped kit>/Models/GLB format" assets/traffic

For every vehicle in VEHICLES below it:
  - joins the body and the four wheels into one mesh, turns it so the front points where the game expects (+Z in the game, -Y in Blender), scales it to a real length,
    puts the middle of the vehicle at the origin and the tyres on the ground
  - reads each face's colour from the kit's palette image (colormap.png). For vehicles marked paintable, the faces in the model's main body colour become the "Paint" material
    (plain white, so the game tints each car a different colour); every other face keeps its palette colour as a vertex colour on the "Rest" material (windows, tyres, lights, trim).
    Vehicles with their own livery (taxi, police, ambulance, fire truck, garbage truck) keep every colour and are not tinted.
  - smooths the shading by angle, so the chunky low-poly look reads as rounded car bodies
and writes one GLB with every vehicle as its own object (named like the vehicle), plus a JSON file with each one's length, width, height and weight in the traffic mix.
"""
import bpy, sys, os, json, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]
os.makedirs(OUT, exist_ok=True)

# name: (length, width, height in metres, share of the traffic, paintable). Kenney's models are chunky and toy-like (a sedan comes out 2.7 m wide and 2.35 m tall at a real length),
# so each body is squashed to a real car's width and height and its wheels are rebuilt as true round wheels.
VEHICLES = {
    'sedan': (4.6, 1.85, 1.45, 20, True), 'hatchback-sports': (3.9, 1.75, 1.42, 12, True), 'suv': (4.7, 1.92, 1.75, 12, True), 'sedan-sports': (4.4, 1.85, 1.30, 6, True), 'suv-luxury': (5.0, 1.98, 1.80, 4, True),
    'van': (5.3, 2.00, 2.05, 8, True), 'delivery': (6.4, 2.15, 2.70, 6, True), 'truck': (7.6, 2.45, 3.10, 5, True),
    'taxi': (4.6, 1.85, 1.50, 9, False), 'police': (4.7, 1.90, 1.50, 2, False), 'ambulance': (5.8, 2.05, 2.60, 1, False), 'garbage-truck': (8.2, 2.50, 3.30, 3, False), 'firetruck': (9.0, 2.50, 3.20, 1, False),
}
import re

pal = bpy.data.images.load(os.path.join(SRC, 'Textures', 'colormap.png')); pal.colorspace_settings.name = 'sRGB'
PW, PH = pal.size; PIX = list(pal.pixels)
def sample(u, v):
    x = min(PW - 1, max(0, int(u * PW))); y = min(PH - 1, max(0, int(v * PH))); i = (y * PW + x) * 4; return PIX[i], PIX[i + 1], PIX[i + 2]
def cell(u, v): return (min(7, max(0, int(u * 8))), min(7, max(0, int(v * 8))))
def lum(c): return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def sat(c): return max(c) - min(c)

bpy.ops.wm.read_factory_settings(use_empty=True)
paint = bpy.data.materials.new('Paint'); paint.use_nodes = True
pb = paint.node_tree.nodes['Principled BSDF']; pb.inputs['Base Color'].default_value = (1, 1, 1, 1); pb.inputs['Roughness'].default_value = 0.32; pb.inputs['Metallic'].default_value = 0.35
rest = bpy.data.materials.new('Rest'); rest.use_nodes = True; nt = rest.node_tree; rb = nt.nodes['Principled BSDF']; rb.inputs['Roughness'].default_value = 0.6; rb.inputs['Metallic'].default_value = 0.05
cn = nt.nodes.new('ShaderNodeVertexColor'); cn.layer_name = 'Col'; nt.links.new(cn.outputs['Color'], rb.inputs['Base Color'])

meta, built = {}, []
WHEEL = re.compile(r'^wheel-(front|back)-(left|right)')

def ring(bm, radius, depth, seg=22):                                                          # a cylinder lying along X, centred at the origin
    import bmesh
    from mathutils import Matrix
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=radius, radius2=radius, depth=depth, matrix=Matrix.Rotation(math.pi / 2, 4, 'Y'))

for name, (target, tw, th, share, paintable) in VEHICLES.items():
    import bmesh
    from mathutils import Matrix
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + '.glb'))
    objs = [o for o in bpy.data.objects if o not in before]; names = [o.name for o in objs]
    wheels = [o for o in objs if o.type == 'MESH' and WHEEL.match(o.name)]; bodies = [o for o in objs if o.type == 'MESH' and not WHEEL.match(o.name)]
    front = [o.matrix_world.translation.copy() for o in wheels if '-front-' in o.name]; back = [o.matrix_world.translation.copy() for o in wheels if '-back-' in o.name]
    fvec = (sum(front, Vector()) / len(front)) - (sum(back, Vector()) / len(back)); fvec.z = 0
    winfo = []                                                                                       # each wheel: centre (world) and radius, read before anything moves
    for o in wheels:
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]; size = sorted([max(b[k] for b in bb) - min(b[k] for b in bb) for k in range(3)])
        winfo.append((o.matrix_world.translation.copy(), size[2] / 2, o.name))
    bpy.ops.object.select_all(action='DESELECT')
    for o in bodies: o.select_set(True)
    bpy.context.view_layer.objects.active = bodies[0]; bpy.ops.object.join(); car = bpy.context.view_layer.objects.active; car.name = name
    for n in names:                                                                                  # the original wheels and anything left over go
        o = bpy.data.objects.get(n)
        if o is not None and o is not car: bpy.data.objects.remove(o, do_unlink=True)
    car.parent = None
    theta = -math.pi / 2 - math.atan2(fvec.y, fvec.x); R = Matrix.Rotation(theta, 4, 'Z')
    car.rotation_euler = (0, 0, theta); bpy.context.view_layer.update(); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ys = [v.co.y for v in car.data.vertices]; s_len = target / (max(ys) - min(ys)); car.scale = (s_len, s_len, s_len); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    vs = [v.co.copy() for v in car.data.vertices]; cx = (max(v.x for v in vs) + min(v.x for v in vs)) / 2; cy = (max(v.y for v in vs) + min(v.y for v in vs)) / 2; mz = min(v.z for v in vs)
    kx = tw / (max(v.x for v in vs) - min(v.x for v in vs)); kz = th / (max(v.z for v in vs) - mz)
    car.data.transform(Matrix.Scale(kx, 4, Vector((1, 0, 0))) @ Matrix.Scale(kz, 4, Vector((0, 0, 1))) @ Matrix.Translation((-cx, -cy, -mz))); car.data.update()
    # face colours from the palette
    me = car.data; uv = me.uv_layers.active.data; area = {}; faces = []
    for p in me.polygons:
        us = [uv[l].uv[0] for l in p.loop_indices]; vsx = [uv[l].uv[1] for l in p.loop_indices]; u, v = sum(us) / len(us), sum(vsx) / len(vsx); c = sample(u, v); k = cell(u, v)
        faces.append((p, c, k)); area[k] = area.get(k, 0) + p.area
    if os.environ.get('TRAFFIC_DEBUG'): print('CELLS', name, sorted(((round(a, 3), k, tuple(round(x, 2) for x in next(c for _, c, kk in faces if kk == k))) for k, a in area.items()), reverse=True)[:8])
    body_cell = None
    if paintable:                                                                                  # the biggest saturated, not-too-dark, not-glass cell is the body paint
        cand = [(a, k) for k, a in area.items() if sat(next(c for _, c, kk in faces if kk == k)) > 0.18 and lum(next(c for _, c, kk in faces if kk == k)) > 0.12 and not (k[0] == 0 and k[1] == 7)]
        body_cell = max(cand)[1] if cand else None
    paint_cells = set()
    if body_cell is not None:                                                                    # the body colour spans two shades (two palette cells): take every cell of the same hue
        import colorsys
        def hue(c): return colorsys.rgb_to_hsv(*c)[0]
        base = hue(next(c for _, c, kk in faces if kk == body_cell))
        for k in area:
            c = next(c for _, c, kk in faces if kk == k); dh = abs(hue(c) - base); dh = min(dh, 1 - dh)
            if sat(c) > 0.18 and lum(c) > 0.12 and dh < 0.06 and not (k[0] == 0 and k[1] == 7): paint_cells.add(k)
    me.materials.clear(); me.materials.append(paint); me.materials.append(rest)
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER'); n_paint = 0
    for p, c, k in faces:
        is_paint = k in paint_cells; p.material_index = 0 if is_paint else 1; n_paint += is_paint
        lin = tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)                     # the palette is read back sRGB-encoded; vertex colours in the file are linear
        for l in p.loop_indices: col.data[l].color = (lin[0], lin[1], lin[2], 1)
    me.color_attributes.active_color = col
    # true round wheels: a tyre and a lighter rim, at each old wheel's place, standing on the ground
    wm = bpy.data.meshes.new(name + '_wheels'); bm = bmesh.new(); fcols = []
    for centre, rad, wn in winfo:
        p = R @ centre * s_len; px = (p.x - cx) * kx; py = p.y - cy; r = min(rad * s_len, th * 0.27); wd = min(0.24, tw * 0.12)
        for radius, depth, shade in ((r, wd, (0.035, 0.035, 0.04)), (r * 0.62, wd + 0.03, (0.55, 0.57, 0.6))):                  # the tyre, then the lighter rim a little wider than the tyre
            tmp = bmesh.new(); ring(tmp, radius, depth)
            for v in tmp.verts: v.co += Vector((px, py, r))
            vmap = {v: bm.verts.new(v.co) for v in tmp.verts}
            for f in tmp.faces: bm.faces.new([vmap[v] for v in f.verts]); fcols.append(shade)
            tmp.free()
    bm.to_mesh(wm); bm.free(); wm.materials.append(paint); wm.materials.append(rest)
    wcol = wm.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for k, p in enumerate(wm.polygons):
        p.material_index = 1
        for l in p.loop_indices: wcol.data[l].color = (*fcols[k], 1)
    wobj = bpy.data.objects.new(name + '_wheels', wm); bpy.context.collection.objects.link(wobj)
    bpy.ops.object.select_all(action='DESELECT'); car.select_set(True); wobj.select_set(True); bpy.context.view_layer.objects.active = car; bpy.ops.object.join()
    bpy.ops.object.select_all(action='DESELECT'); car.select_set(True); bpy.context.view_layer.objects.active = car; bpy.ops.object.shade_smooth_by_angle(angle=math.radians(38))
    d = car.dimensions; me = car.data; meta[name] = { 'len': round(d.y, 2), 'w': round(d.x, 2), 'h': round(d.z, 2), 'weight': share, 'paintable': bool(paintable and n_paint), 'tris': sum(len(p.vertices) - 2 for p in me.polygons) }
    built.append(car); print('RESULT', name, meta[name], 'body cell', body_cell, 'paint faces', n_paint, 'of', len(faces), 'wheels', len(winfo))

for o in built: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'traffic_pack.glb'), export_format='GLB', export_materials='EXPORT', export_cameras=False, export_lights=False, export_animations=False, export_extras=False, use_selection=True)
json.dump(meta, open(os.path.join(OUT, 'traffic_pack.json'), 'w'), indent=1)
print('RESULT exported', len(built), 'vehicles')

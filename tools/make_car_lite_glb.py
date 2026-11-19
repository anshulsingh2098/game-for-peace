"""Rebuilds a garage car as a light version (performance fix, 20 Nov 2026: the converted cars were 38,000 to 110,000 triangles with 15 to 22 materials each, and the game became slow).
Run (headless Blender):  blender -b -P tools/make_car_lite_glb.py -- <car id> <in.glb> <out.glb> [body triangles] [wheel triangles]
Reads a car made by tools/make_car_glb.py or tools/make_scan_car_glb.py and writes one that keeps the game's contract (front +Z, up +Y, +X left, metres, empties Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR with the wheel meshes under them, a material Paint_Body that the game recolours) but has:
  the whole body as ONE mesh of about 16,000 triangles (damage works on vertices, so it needs no separate doors), the wheels as four meshes of about 1,500,
  three materials only: Paint_Body (plain white), Glass (dark, half see-through) and Rest (vertex colours: the colour of the picture under each face, so tyres, lights, grille and trim keep their colour), and no pictures at all.
Typical result: 20,000 triangles, 7 draw calls, 0.5 to 1 MB. Run it from the repository folder."""
import bpy, sys, os, math, bmesh, mathutils
import numpy as np

GLASS = ('glass', 'window', 'windscreen', 'black')          # material names that are glass (the supplied R35 calls its tinted glass "Black")
def lin(c): return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

def main():
    a = sys.argv[sys.argv.index('--') + 1:]; cid, src, out = a[:3]; BODY = int(a[3]) if len(a) > 3 else 16000; WHEEL = int(a[4]) if len(a) > 4 else 1500
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src); sc = bpy.context.scene
    wheel_empties = {o.name: o for o in sc.objects if o.type == 'EMPTY' and o.name.startswith('Wheel_')}
    wheel_meshes = [o for o in sc.objects if o.type == 'MESH' and o.parent and o.parent.name in wheel_empties]
    body = [o for o in sc.objects if o.type == 'MESH' and o not in wheel_meshes]
    # images as float arrays, once
    imgs = {}
    def pixels(im):
        if im.name not in imgs:
            w, h = im.size; arr = np.empty(w * h * 4, dtype=np.float32); im.pixels.foreach_get(arr); imgs[im.name] = (arr.reshape(h, w, 4)[:, :, :3], w, h)
        return imgs[im.name]
    def base_image(m):
        if m and m.use_nodes:
            b = [n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED']
            if b:
                for l in b[0].inputs['Base Color'].links:
                    if l.from_node.type == 'TEX_IMAGE' and l.from_node.image and l.from_node.image.size[0] > 0: return l.from_node.image
        return None
    def base_colour(m):
        if m and m.use_nodes:
            b = [n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED']
            if b: c = b[0].inputs['Base Color'].default_value; return tuple(float(v) for v in c[:3])
        return (0.5, 0.5, 0.5)
    # world-space meshes; the roles and colours are decided face by face BEFORE any joining, from the original materials
    paint = bpy.data.materials.get('Paint_Body') or bpy.data.materials.new('Paint_Body')
    if not paint.use_nodes: paint.use_nodes = True
    glass = bpy.data.materials.new('Glass'); glass.use_nodes = True; gb = glass.node_tree.nodes['Principled BSDF']; gb.inputs['Base Color'].default_value = (0.02, 0.03, 0.04, 1); gb.inputs['Alpha'].default_value = 0.4; glass.blend_method = 'BLEND'
    rest = bpy.data.materials.new('Rest'); rest.use_nodes = True; nt = rest.node_tree; rb = nt.nodes['Principled BSDF']; rb.inputs['Roughness'].default_value = 0.55; rb.inputs['Metallic'].default_value = 0.1
    cn = nt.nodes.new('ShaderNodeVertexColor'); cn.layer_name = 'Col'; nt.links.new(cn.outputs['Color'], rb.inputs['Base Color'])
    def classify(o, world):
        me = o.data; mats = [s.material for s in o.material_slots]; uv = me.uv_layers[0].data if len(me.uv_layers) else None; src = me.color_attributes[0] if len(me.color_attributes) else None
        if world: me.transform(o.matrix_world)
        col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER'); idx = []
        for p in me.polygons:
            m = mats[p.material_index] if p.material_index < len(mats) else None; nm = (m.name if m else '').lower()
            if m and m.name == 'Paint_Body': idx.append(0); c = (1, 1, 1)
            elif any(g in nm for g in GLASS) and 'light' not in nm: idx.append(1); c = (0.02, 0.03, 0.04)
            else:
                idx.append(2); im = base_image(m)
                if im is not None and uv is not None:
                    arr, w, h = pixels(im); u = sum(uv[l].uv[0] for l in p.loop_indices) / p.loop_total; v = sum(uv[l].uv[1] for l in p.loop_indices) / p.loop_total; c = lin(tuple(float(x) for x in arr[min(h - 1, max(0, int(v * h))), min(w - 1, max(0, int(u * w)))]))
                elif src is not None: cs = [src.data[l].color for l in p.loop_indices]; c = tuple(sum(x[k] for x in cs) / len(cs) for k in range(3))
                else: c = lin(base_colour(m)) if False else base_colour(m)
            for l in p.loop_indices: col.data[l].color = (c[0], c[1], c[2], 1)
        for p, i in zip(me.polygons, idx): p.material_index = 0       # the slots are rebuilt below; keep the role in a custom attribute
        role = me.attributes.new('role', 'INT', 'FACE'); role.data.foreach_set('value', idx)
    for o in body: classify(o, True)
    for o in wheel_meshes: classify(o, False)
    # one body mesh
    bpy.ops.object.select_all(action='DESELECT')
    for o in body: o.parent = None; o.matrix_world = mathutils.Matrix.Identity(4); o.select_set(True)
    bpy.context.view_layer.objects.active = body[0]; bpy.ops.object.join(); car = bpy.context.view_layer.objects.active; car.name = 'Body'
    def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)
    def drop_small(o, n):
        bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table(); seen = set(); kill = []
        for f0 in bm.faces:
            if f0.index in seen: continue
            comp = [f0]; seen.add(f0.index); st = [f0]
            while st:
                f = st.pop()
                for e in f.edges:
                    for g in e.link_faces:
                        if g.index not in seen: seen.add(g.index); comp.append(g); st.append(g)
            if len(comp) < n: kill += comp
        if kill: bmesh.ops.delete(bm, geom=kill, context='FACES')
        bm.to_mesh(o.data); bm.free()
    def reduce(o, target, small):
        for k in range(5):
            t = tris(o)
            if t <= target * 1.12: break
            md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = min(1.0, target / t); md.use_collapse_triangulate = True
            bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='dec')
            if small: drop_small(o, small + 6 * k)
    if tris(car) > BODY: drop_small(car, 12); reduce(car, BODY, 18)
    for o in wheel_meshes:
        if tris(o) > WHEEL: reduce(o, WHEEL, 0)
    for o in [car] + wheel_meshes:
        me = o.data; role = me.attributes.get('role')
        if role is not None:
            vals = [d.value for d in role.data]; me.materials.clear(); me.materials.append(paint); me.materials.append(glass); me.materials.append(rest)
            for p, v in zip(me.polygons, vals): p.material_index = v
            me.attributes.remove(role)
        while len(me.uv_layers): me.uv_layers.remove(me.uv_layers[0])
        for ca in list(me.color_attributes):
            if ca.name != 'Col': me.color_attributes.remove(ca)
        me.color_attributes.active_color = me.color_attributes['Col']; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o; bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    # clean tree: a fresh root; the body and the wheel empties hang from it with their world places kept
    root = bpy.data.objects.new('Car', None); sc.collection.objects.link(root)
    for e in wheel_empties.values(): mw = e.matrix_world.copy(); e.parent = root; e.matrix_world = mw
    car.parent = root
    for o in list(sc.objects):
        if o is root or o is car or o in wheel_empties.values() or o in wheel_meshes: continue
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=True, export_materials='EXPORT', export_cameras=False, export_lights=False)
    print('RESULT', cid, 'body', tris(car), 'wheels', [tris(o) for o in wheel_meshes], 'bytes', os.path.getsize(out))
main()

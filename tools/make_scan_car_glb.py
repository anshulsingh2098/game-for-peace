"""Converts one of the two scanned cars in figosai.glb (Ford Figo and Ford Aspire, docs/NEW_CARS_PLAN.md phase C0) into a game-ready GLB.
Run:  blender -b -P tools/make_scan_car_glb.py -- <figo|figoaspire> <source.glb> <real length in metres> <out.glb>
The source holds two assembled car scans side by side (each one mesh with about 140 loose parts, one baked 4096 px colour picture each, length along +X, front at +X). The wheels are loose parts that touch the ground: they are cut out and become Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR (front +Z, up +Y, metres, +X the car's left). The body is decimated, and every face is put in the game's two materials by the colour of the picture under it: saturated, bright colour is the body paint (Paint_Body, plain white, recoloured in the game), everything else (glass, tyres, trim, lights, chrome) keeps its picture colour as a vertex colour on Rest. No picture is shipped."""
import bpy, sys, os, math, bmesh, mathutils, colorsys
import numpy as np

def lin(c): return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

def main():
    which, src, real_len, out = sys.argv[sys.argv.index('--') + 1:][:4]; real_len = float(real_len)
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src); sc = bpy.context.scene
    for o in list(sc.objects):
        if o.type == 'MESH' and o.name != which: bpy.data.objects.remove(o, do_unlink=True)
        elif o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
    car = sc.objects[which]; mat = car.data.materials[0]; img = [n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image][0]
    W, H = img.size; px = np.empty(W * H * 4, dtype=np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)[:, :, :3]
    # the wheels are not separate in the scan: find the four tyres as the dark faces low down near each corner, then cut the faces inside a cylinder round each tyre out as the wheel
    me = car.data; mw0 = car.matrix_world.copy(); uv = me.uv_layers[0].data; npoly = len(me.polygons); fc = np.zeros((npoly, 3), dtype=np.float32); fcol = np.zeros((npoly, 3), dtype=np.float32)
    for i, p in enumerate(me.polygons):
        fc[i] = mw0 @ p.center; u = sum(uv[l].uv[0] for l in p.loop_indices) / p.loop_total; v = sum(uv[l].uv[1] for l in p.loop_indices) / p.loop_total; fcol[i] = px[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W)))]
    mn = fc.min(0); mx = fc.max(0); cx, cy = (mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2; zmin = float(mn[2]); height = float(mx[2] - mn[2]); wid = float(mx[1] - mn[1])
    val = fcol.max(1); dark = (val < 0.22) & (fc[:, 2] < zmin + 0.34 * height) & (np.abs(fc[:, 1] - cy) > 0.22 * wid); wheels = {}
    for qx, sx in (('F', 1), ('R', -1)):
        for qy, sy in (('L', 1), ('R', -1)):          # facing +X with Z up, the left side is +Y
            m = dark & ((fc[:, 0] - cx) * sx > 0.18 * (mx[0] - mn[0])) & ((fc[:, 1] - cy) * sy > 0)
            if m.sum() < 30: raise SystemExit('no tyre found at ' + qx + qy + ' (%d faces)' % int(m.sum()))
            sel = fc[m]; zc = zmin + (float(sel[:, 2].max()) - zmin) / 2; R = zc - zmin; wheels[qx + qy] = (float(np.median(sel[:, 0])), float(np.median(sel[:, 1])), zc, R)
            print('TYRE', qx + qy, [round(v, 3) for v in wheels[qx + qy]], 'faces', int(m.sum()))
    bpy.ops.object.select_all(action='DESELECT'); car.select_set(True); bpy.context.view_layer.objects.active = car; bpy.ops.object.mode_set(mode='EDIT'); bm = bmesh.from_edit_mesh(car.data); bm.faces.ensure_lookup_table()
    for f in bm.faces: f.select = False
    wf = {k: [] for k in wheels}
    for i, f in enumerate(bm.faces):
        for k, (wx, wy, wz, R) in wheels.items():
            if (fc[i, 0] - wx) ** 2 + (fc[i, 2] - wz) ** 2 < (1.06 * R) ** 2 and abs(fc[i, 1] - wy) < 0.55 * R: wf[k].append(f); break
    for f in bm.faces: f.select = False
    owner = {}
    for k, faces in wf.items():
        for f in faces: owner[f.index] = k
    # separate one wheel at a time by selecting its faces by index (the faces' indices shift after each separation, so each pass is recomputed from the face centres)
    wobj = {}
    for k, (wx, wy, wz, R) in wheels.items():
        bm.faces.ensure_lookup_table()
        for f in bm.faces:
            c = mw0 @ f.calc_center_median(); f.select = ((c.x - wx) ** 2 + (c.z - wz) ** 2 < (1.06 * R) ** 2 and abs(c.y - wy) < 0.55 * R)
        bm.select_flush(True) if False else None; bmesh.update_edit_mesh(car.data); before = set(sc.objects)
        bpy.ops.mesh.separate(type='SELECTED'); new = [o for o in sc.objects if o not in before]; wobj[k] = new[0]
        bm = bmesh.from_edit_mesh(car.data)
    bpy.ops.object.mode_set(mode='OBJECT'); body = car; body.name = 'Body'
    for k, o in wobj.items(): print('WHEELFACES', k, len(o.data.polygons))
    info = None; mn = [float(mn[0]), float(mn[1]), float(mn[2])]; mx = [float(mx[0]), float(mx[1]), float(mx[2])]
    zmin = mn[2]; cx = (mn[0] + mx[0]) / 2; cy = (mn[1] + mx[1]) / 2
    k = real_len / (mx[0] - mn[0]); T = mathutils.Matrix.Rotation(math.radians(-90), 4, 'Z') @ mathutils.Matrix.Scale(k, 4) @ mathutils.Matrix.Translation((-cx, -cy, -zmin))
    root = bpy.data.objects.new('Car', None); sc.collection.objects.link(root)
    paint = bpy.data.materials.new('Paint_Body'); paint.use_nodes = True; pb = paint.node_tree.nodes['Principled BSDF']; pb.inputs['Base Color'].default_value = (0.9, 0.9, 0.92, 1); pb.inputs['Metallic'].default_value = 0.35; pb.inputs['Roughness'].default_value = 0.28
    rest = bpy.data.materials.new('Rest'); rest.use_nodes = True; nt = rest.node_tree; rb = nt.nodes['Principled BSDF']; rb.inputs['Roughness'].default_value = 0.6; rb.inputs['Metallic'].default_value = 0.05
    cn = nt.nodes.new('ShaderNodeVertexColor'); cn.layer_name = 'Col'; nt.links.new(cn.outputs['Color'], rb.inputs['Base Color'])
    def prepare(o, ratio, is_wheel):
        o.data.transform(o.matrix_world); o.parent = None; o.matrix_world = mathutils.Matrix.Identity(4); o.data.transform(T)
        bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4); bm.to_mesh(o.data); bm.free()
        if ratio < 1:
            bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
            md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = ratio; md.use_collapse_triangulate = True; bpy.ops.object.modifier_apply(modifier='dec')
        me = o.data; uv = me.uv_layers[0].data; col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        for p in me.polygons:
            u = sum(uv[l].uv[0] for l in p.loop_indices) / p.loop_total; v = sum(uv[l].uv[1] for l in p.loop_indices) / p.loop_total
            c = px[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W)))]; h, s, val = colorsys.rgb_to_hsv(*[float(x) for x in c]); is_paint = (not is_wheel) and s > 0.45 and val > 0.25
            p.material_index = 0 if is_paint else 1; l3 = lin(tuple(float(x) for x in c)) if not is_paint else (1, 1, 1)
            for l in p.loop_indices: col.data[l].color = (l3[0], l3[1], l3[2], 1)
        idx = [p.material_index for p in me.polygons]; me.materials.clear(); me.materials.append(paint); me.materials.append(rest)       # clearing the slots resets every face's index: put them back
        for p, i in zip(me.polygons, idx): p.material_index = i
        me.color_attributes.active_color = col
        while len(me.uv_layers) > 0: me.uv_layers.remove(me.uv_layers[0])
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o; bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    prepare(body, 32000 / max(1, sum(len(p.vertices) - 2 for p in body.data.polygons)), False); body.parent = root
    for key, o in wobj.items():
        prepare(o, min(1.0, 1500 / max(1, sum(len(p.vertices) - 2 for p in o.data.polygons))), True)
        ctr = sum((o.matrix_world @ mathutils.Vector(c) for c in o.bound_box), mathutils.Vector()) / 8; o.data.transform(mathutils.Matrix.Translation(-ctr))
        e = bpy.data.objects.new('Wheel_' + key, None); sc.collection.objects.link(e); e.parent = root; e.location = ctr; o.parent = e; o.location = (0, 0, 0)
        print('WHEEL', key, [round(float(v), 3) for v in ctr], 'height', round(max((o.matrix_world @ mathutils.Vector(c)).z for c in o.bound_box) - min((o.matrix_world @ mathutils.Vector(c)).z for c in o.bound_box), 3))
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=True, export_materials='EXPORT', export_cameras=False, export_lights=False)
    print('RESULT', which, 'tris', sum(len(p.vertices) - 2 for o in sc.objects if o.type == 'MESH' for p in o.data.polygons), 'bytes', os.path.getsize(out), 'scale', round(k, 3))
main()

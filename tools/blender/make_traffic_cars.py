"""Low-polygon traffic versions of the owner-supplied cars (docs/NEW_CARS_PLAN.md, phase C1b: the cars also drive around as traffic).
Run:  blender -b -P tools/blender/make_traffic_cars.py -- <out.glb> <out.json> <car id> [<car id> ...]     (reads assets/cars/<id>.glb made by tools/make_car_glb.py)
Each car becomes one node with the two materials the traffic renderer expects (src/traffic/traffic.js): "Paint" (plain white, tinted per car in the game) and "Rest" (vertex colours: glass, tyres, lights, trim), about 3,000 triangles, front +Z, standing on y 0, centred on its length. tools/merge_traffic_pack.py then adds these nodes to assets/traffic/traffic_pack.glb without touching the existing thirteen."""
import bpy, sys, os, json, math, numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TARGET = 3000
# per car: which material names are tyres, rims, glass, lights; the traffic weight (how common on a Delhi road) and the kind name
CARS = {
  'sx4':     dict(kind='sx4-hatch',    weight=9, w=1.78, tyre=['wheel.1'], glass=['glass'], light=['chassis.5', 'left front light']),
  'r35':     dict(kind='gtr-sports',   weight=1, w=1.95, tyre=['heel3A_Details_Material1'], glass=['Black', 'Light_glass', 'red_galass', 'gtr:Nissan_LBGTRType2_2017WindowA_Material1'], light=['gtr:Nissan_LBGTRType2_2017LightC_Material1']),
  'maruti':  dict(kind='maruti-800',   weight=14, w=1.44, tyre=['rim_rf'], glass=['glass.001'], light=['lights_main_2']),
  'figo':    dict(kind='figo-hatch',    weight=6, w=1.7, tyre=[], glass=[], light=[], scan=True),
  'aspire':  dict(kind='aspire-hatch',  weight=5, w=1.75, tyre=[], glass=[], light=[], scan=True),
  'everest': dict(kind='endeavour-suv', weight=5, w=1.95, tyre=['roda.1'], glass=['glass', 'glass.001'], light=['boot_ok.4']),
}
def lin(c): return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)
_AVG = {}
def avg_colour(m):
    if m.name in _AVG: return _AVG[m.name]
    _AVG[m.name] = _avg_colour(m); return _AVG[m.name]
def _avg_colour(m):
    if m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and n.image.size[0] > 0:
                a = np.empty(n.image.size[0] * n.image.size[1] * 4, dtype=np.float32); n.image.pixels.foreach_get(a); a = a.reshape(-1, 4)[::7, :3]; return tuple(float(v) for v in a.mean(0))         # read back sRGB-encoded
        b = [n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED']
        if b:
            c = b[0].inputs['Base Color'].default_value; return tuple(float(v) for v in c[:3])            # already linear
    return (0.5, 0.5, 0.5)

def main():
    argv = sys.argv[sys.argv.index('--') + 1:]; out, outjson, ids = argv[0], argv[1], argv[2:]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    paint = bpy.data.materials.new('Paint'); paint.use_nodes = True; pb = paint.node_tree.nodes['Principled BSDF']; pb.inputs['Base Color'].default_value = (1, 1, 1, 1); pb.inputs['Roughness'].default_value = 0.32; pb.inputs['Metallic'].default_value = 0.35
    rest = bpy.data.materials.new('Rest'); rest.use_nodes = True; nt = rest.node_tree; rb = nt.nodes['Principled BSDF']; rb.inputs['Roughness'].default_value = 0.6; rb.inputs['Metallic'].default_value = 0.05
    cn = nt.nodes.new('ShaderNodeVertexColor'); cn.layer_name = 'Col'; nt.links.new(cn.outputs['Color'], rb.inputs['Base Color'])
    meta, built = {}, []
    for cid in ids:
        C = CARS[cid]; before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'assets', 'cars', cid + '.glb'))
        new = [o for o in bpy.data.objects if o not in before]; meshes = [o for o in new if o.type == 'MESH']
        for o in meshes:                                                         # bake each mesh's place into its points and free it from the wheel and door nodes
            o.data = o.data.copy(); o.data.transform(o.matrix_world); o.parent = None; o.matrix_world = o.matrix_world.Identity(4)
            me = o.data; src = me.color_attributes[0] if (C.get('scan') and len(me.color_attributes)) else None; col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER'); mats = [s.material for s in o.material_slots]
            for p in me.polygons:
                m = mats[p.material_index] if p.material_index < len(mats) and mats[p.material_index] else None; nm = m.name if m else ''
                if nm == 'Paint_Body': p.material_index = 0; c = (1, 1, 1)
                elif src is not None: p.material_index = 1; cs = [src.data[l].color for l in p.loop_indices]; c = tuple(sum(x[k] for x in cs) / len(cs) for k in range(3))
                else:
                    p.material_index = 1
                    c = (0.05, 0.065, 0.08) if nm in C['glass'] else (0.03, 0.03, 0.035) if nm in C['tyre'] else lin(avg_colour(m)) if m else (0.3, 0.3, 0.3)
                    if nm in C['light']: c = tuple(min(1, v * 1.2) for v in c)
                for l in p.loop_indices: col.data[l].color = (c[0], c[1], c[2], 1)
            me.materials.clear(); me.materials.append(paint); me.materials.append(rest); me.color_attributes.active_color = col
        for o in new:
            if o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes: o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]; bpy.ops.object.join(); car = bpy.context.view_layer.objects.active
        tri = sum(len(p.vertices) - 2 for p in car.data.polygons)
        md = car.modifiers.new('dec', 'DECIMATE'); md.ratio = min(1.0, TARGET / tri); md.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier='dec'); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(38))
        # centre on the length, stand on y 0 (Blender: Y is the length, Z up; glTF export turns Y into Z)
        bb = [car.matrix_world @ v.co for v in car.data.vertices]; mn = [min(b[i] for b in bb) for i in range(3)]; mx = [max(b[i] for b in bb) for i in range(3)]
        car.data.transform(__import__('mathutils').Matrix.Translation(((-(mn[0] + mx[0]) / 2), -(mn[1] + mx[1]) / 2, -mn[2])))
        car.name = C['kind']; d = car.dimensions
        meta[C['kind']] = {'len': round(d.y, 2), 'w': C.get('w', round(d.x, 2)), 'h': round(d.z, 2), 'weight': C['weight'], 'paintable': True, 'tris': sum(len(p.vertices) - 2 for p in car.data.polygons)}
        built.append(car); print('RESULT', cid, meta[C['kind']])
    bpy.ops.object.select_all(action='DESELECT')
    for o in built: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_materials='EXPORT', export_cameras=False, export_lights=False, export_animations=False, export_extras=False, use_selection=True)
    json.dump(meta, open(outjson, 'w'), indent=1)
main()

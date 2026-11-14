import bpy, os, mathutils
base = os.path.dirname(os.path.abspath(__file__)); dl = base + '/dl/'; out = base + '/out/'
for n, target in [('namaqualand_boulder_02', 700), ('rock_07', 600)]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    f = [x for x in os.listdir(dl + n) if x.endswith('.gltf')][0]
    bpy.ops.import_scene.gltf(filepath=dl + n + '/' + f)
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); o = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    mod = o.modifiers.new('d', 'DECIMATE'); mod.ratio = min(1.0, target / tris); bpy.ops.object.modifier_apply(modifier='d')
    mn = [min(v.co[i] for v in o.data.vertices) for i in range(3)]; mx = [max(v.co[i] for v in o.data.vertices) for i in range(3)]
    k = 2.0 / max(mx[i] - mn[i] for i in range(3))                     # largest side becomes 2 m (the game scales each rock)
    for v in o.data.vertices: v.co = mathutils.Vector(((v.co[0] - (mn[0] + mx[0]) / 2) * k, (v.co[1] - (mn[1] + mx[1]) / 2) * k, (v.co[2] - mn[2]) * k))
    o.data.update()
    for im in bpy.data.images:
        if im.size[0] > 512: im.scale(512, 512)
    # keep only colour and normal maps: roughness is set in the game
    bpy.ops.export_scene.gltf(filepath=out + n + '.glb', export_format='GLB', export_image_format='JPEG', export_jpeg_quality=82, export_apply=True)
    print('DONE', n, 'tris', sum(len(p.vertices) - 2 for p in o.data.polygons), 'file', os.path.getsize(out + n + '.glb') // 1000, 'KB')

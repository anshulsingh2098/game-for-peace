import bpy, os, json, math, mathutils
base = os.path.dirname(os.path.abspath(__file__)); dl = base + '/dl/'; out = base + '/out/'
jobs = [('fir_sapling', True), ('pine_sapling_small', True), ('island_tree_02', False), ('shrub_03', False), ('fern_02', False), ('grass_medium_02', False)]
meta = {}
def bbox(objs):
    mn = [1e9] * 3; mx = [-1e9] * 3
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(c)
            for i in range(3): mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
    return mn, mx
for n, split in jobs:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    f = [x for x in os.listdir(dl + n) if x.endswith('.gltf')][0]
    bpy.ops.import_scene.gltf(filepath=dl + n + '/' + f)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    # the three conifer saplings share one file: objects sorted by size, each rendered alone
    groups = [[m] for m in sorted(meshes, key=lambda o: -bbox([o])[1][2])] if split else [meshes]
    scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'; scn.cycles.samples = 48; scn.cycles.use_denoising = True
    scn.render.film_transparent = True; scn.view_settings.view_transform = 'Standard'
    wd = bpy.data.worlds.new('w'); wd.use_nodes = True; bg = wd.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.62, 0.72, 0.9, 1); bg.inputs[1].default_value = 0.9; scn.world = wd
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.2; sun.angle = math.radians(18); so = bpy.data.objects.new('sun', sun); scn.collection.objects.link(so); so.rotation_euler = (math.radians(50), 0, math.radians(-35))
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; co = bpy.data.objects.new('c', cam); scn.collection.objects.link(co); scn.camera = co
    scn.render.resolution_x = 512; scn.render.resolution_y = 512; scn.render.image_settings.file_format = 'PNG'; scn.render.image_settings.color_mode = 'RGBA'
    for gi, grp in enumerate(groups):
        for m in meshes: m.hide_render = m not in grp
        mn, mx = bbox(grp); cx, cy, cz = [(mn[i] + mx[i]) / 2 for i in range(3)]; W = max(mx[0] - mn[0], mx[1] - mn[1]); H = mx[2] - mn[2]
        size = max(W, H) * 1.08; cam.ortho_scale = size; co.location = (cx, cy - max(W, H) * 4, cz); co.rotation_euler = (math.radians(90), 0, 0)
        name = f'{n}_{gi}' if split else n; scn.render.filepath = out + name + '.png'; bpy.ops.render.render(write_still=True)
        meta[name] = {'width': round(W, 3), 'height': round(H, 3), 'frame': round(size, 3), 'cz': round(cz, 3), 'zmin': round(mn[2], 3)}; print('DONE', name, meta[name])
json.dump(meta, open(out + 'cards.json', 'w'), indent=1)

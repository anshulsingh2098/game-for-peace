"""Converts one owner-supplied car (FBX or GLB) into a game-ready GLB (docs/NEW_CARS_PLAN.md, phase C0).
Run (headless Blender):  blender -b -P tools/make_car_glb.py -- <car id> <source file> <texture folder> <out.glb>
The result follows the game's model contract (src/vehicle/defs.js): front +Z, up +Y, +X the car's left, metres; four empty nodes Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR at the wheel centres carry the wheel meshes; the body paint is one material named Paint_Body with a plain colour (no picture) so src/vehicle/paint.js can recolour it; other pictures are cut to 512 px and stored as WebP.
One recipe per car is in RECIPES: what to delete, which meshes are wheels, which material is the paint, how far to decimate. Source files are the owner's and are not in the repo."""
import bpy, sys, os, math, mathutils

RECIPES = {
  # sx4: Z up, front +Y, already metres (4.2 m); the wheels are parented to one pivot but sit at their real places; the body paint is the red picture "Untitled design" in material chassis.0
  # everest: same rig style as the sx4 (front +Y, metres, 4.8 m body); the paint is the flat-colour material "primary"; the engine and suspension are hidden under the body and are deleted
  'everest': dict(delete=['motor', 'suspens'], wheels=['roda', 'roda.001', 'roda.002', 'roda.003'], paint=['primary'], rotate_z=180, scale=1.0, decimate=0.7, wheel_decimate=0.3, decimate_by={'interior': 0.2, 'bancos': 0.2, 'volante': 0.3, 'boot_ok': 0.45, 'bump_rear_ok': 0.45, 'bump_front_ok': 0.5, 'estribo': 0.5}, glass=['glass', 'glass.001'], front_axis='+Y'),
  # gtr50: a GLB, front already -Y in Blender (so +Z in the file), metres, 4.7 m; parts split by material (OEMPaint is the body colour, Coloured an accent colour); the seats, dashboard parts, pedals and engine-less interior are deleted (the game draws its own cockpit), the ground-shadow sphere too
  'gtr50': dict(delete=['Icosphere'], delete_re=r'Interior$|Seat|Pedal|Shifter|SteeringWheel|GlassInside|Carbon1MDetails|InteriorTilling|SeatBelt', wheels=['Wheel1A_LF', 'Wheel1A_RF', 'Wheel1A_LR', 'Wheel1A_RR'], paint=['OEMPaint'], accent=['Coloured'], rotate_z=0, scale=1.0, decimate=0.5, wheel_decimate=0.4, glass=['GlassMtl', 'GlassRed'], front_axis='-Y'),
  # r35: an FBX in centimetres that imports 100 times too small (4.7 cm long), front -Y; one material per part: PaintA is the body colour (shared by the Paint and Carbon1 meshes), Coloured the accent; the interior, engine, belts, the 43-triangle wheel stickers and the Textured part (it carries the supplied tiger livery) are deleted; everything is flattened (no pivots) and scaled up in the mesh data so no node carries a scale
  'r35': dict(delete=[], delete_re=r'Interior|Engine_Geo|SeatBelt|WindowInside|^w:Wheel01|Textured_Geo', wheels=['gtr:gtr:polySurface1', 'gtr:gtr:polySurface151', 'gtr:gtr:polySurface301', 'gtr:gtr:polySurface451'], paint=['gtr:Nissan_LBGTRType2_2017PaintA_Material1'], accent=['gtr:Nissan_LBGTRType2_2017Coloured_Material1'], flatten=True, rotate_z=0, scale=100.0, decimate=0.5, wheel_decimate=0.4, glass=['Black', 'Light_glass', 'red_galass', 'gtr:Nissan_LBGTRType2_2017WindowA_Material1'], front_axis='-Y'),
  'sx4': dict(delete=['Plane'], wheels=['wheel', 'wheel.001', 'wheel.002', 'wheel.003'], paint=['chassis.0'], rotate_z=180, scale=1.0, decimate=0.9, glass=['glass'], front_axis='+Y'),
}

def relink_images(texdir):
    have = {os.path.splitext(f)[0].lower(): f for f in os.listdir(texdir)}
    for im in bpy.data.images:
        if im.size[0] == 0 or im.size[1] == 0:
            stem = os.path.splitext(os.path.basename(im.filepath or im.name))[0].lower()
            stem = stem.split('.00')[0]
            if stem in have: im.filepath = os.path.join(texdir, have[stem]); im.reload()
            elif os.path.splitext(im.name)[0].lower() in have: im.filepath = os.path.join(texdir, have[os.path.splitext(im.name)[0].lower()]); im.reload()

def main():
    argv = sys.argv[sys.argv.index('--') + 1:]; cid, src, texdir, out = argv[:4]; R = RECIPES[cid]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if src.lower().endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=src)
    else: bpy.ops.import_scene.gltf(filepath=src)
    relink_images(texdir)
    sc = bpy.context.scene
    import re
    for o in list(sc.objects):                                       # free every mesh from armatures and pivots first, keeping its place
        if o.type == 'MESH' and o.parent is not None and o.parent.type == 'ARMATURE': mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    for o in list(sc.objects):
        if o.type == 'ARMATURE': bpy.data.objects.remove(o, do_unlink=True)
    for n in R['delete']:
        o = sc.objects.get(n)
        if o: bpy.data.objects.remove(o, do_unlink=True)
    if R.get('delete_re'):
        for o in list(sc.objects):
            if o.type == 'MESH' and re.search(R['delete_re'], o.name): bpy.data.objects.remove(o, do_unlink=True)
    if R.get('flatten'):                                                     # no pivots: every mesh stands alone at the top level with its transform baked into its points
        for o in list(sc.objects):
            if o.type == 'MESH': mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
        for o in list(sc.objects):
            if o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
        k = R['scale']
        for o in sc.objects:
            bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True); o.data.transform(mathutils.Matrix.Scale(k, 4)); o.location = o.location * k
        R['scale'] = 1.0
    # wheel centres in world space, then free the wheels from their parents
    wheels = []
    for n in R['wheels']:
        o = sc.objects[n]; mw = o.matrix_world.copy(); cs = [mw @ mathutils.Vector(c) for c in o.bound_box]
        ctr = sum(cs, mathutils.Vector()) / 8; wheels.append((o, ctr, max(c.z for c in cs) - min(c.z for c in cs)))
    for o, ctr, d in wheels:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)           # mirrored wheels carry a negative scale: bake it so the export keeps the normals
        if o.scale[0] < 0 or o.data.polygons and False: pass
    # the root: everything hangs from one empty that we rotate and scale
    root = bpy.data.objects.new('Car', None); sc.collection.objects.link(root)
    for o in list(sc.objects):
        if o is root or o.parent is not None: continue
        if o.type in ('MESH', 'EMPTY'): o.parent = root
    root.rotation_euler[2] = math.radians(R['rotate_z']); root.scale = (R['scale'],) * 3
    bpy.context.view_layer.update()
    # wheel nodes
    for o, ctr, d in wheels:
        wc = root.matrix_world @ ctr                       # world, front now -Y (after the 180 degree turn) so glTF front is +Z
        xg, zg = wc.x, -wc.y; side = 'L' if xg > 0 else 'R'; fr = 'F' if zg > 0 else 'R'
        e = bpy.data.objects.new('Wheel_' + fr + side, None); sc.collection.objects.link(e); e.parent = root; e.matrix_world = mathutils.Matrix.Translation(wc)
        mw = o.matrix_world.copy(); o.parent = e; o.matrix_world = mw
    # paint material: a plain colour
    for mn in R['paint']:
        m = bpy.data.materials.get(mn)
        if not m: continue
        m.name = 'Paint_Body'; m.use_nodes = True; nt = m.node_tree
        for n in list(nt.nodes):
            if n.type == 'TEX_IMAGE': nt.nodes.remove(n)
        b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
        for l in list(b.inputs['Base Color'].links): nt.links.remove(l)
        b.inputs['Base Color'].default_value = (0.9, 0.9, 0.92, 1); b.inputs['Metallic'].default_value = 0.35; b.inputs['Roughness'].default_value = 0.28
    for mn in R.get('accent', []):
        m = bpy.data.materials.get(mn)
        if m:
            m.name = 'Paint_Accent'; m.use_nodes = True; nt = m.node_tree
            for n in list(nt.nodes):
                if n.type == 'TEX_IMAGE': nt.nodes.remove(n)
            b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
            for l in list(b.inputs['Base Color'].links): nt.links.remove(l)
            b.inputs['Base Color'].default_value = (0.78, 0.6, 0.15, 1); b.inputs['Metallic'].default_value = 0.6; b.inputs['Roughness'].default_value = 0.3
    # FBX import leaves most materials in alpha-blend mode (the picture's alpha is wired to the shader): that makes wheels and body panels see-through and mottled. Everything but the glass becomes opaque.
    glass = set(R.get('glass', []))
    for m in bpy.data.materials:
        if m.name in glass or not m.use_nodes: continue
        m.blend_method = 'OPAQUE'
        for b in [n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED']:
            for l in list(b.inputs['Alpha'].links): m.node_tree.links.remove(l)
            b.inputs['Alpha'].default_value = 1.0
    for gn in R.get('glass', []):
        m = bpy.data.materials.get(gn)
        if m:
            m.blend_method = 'BLEND'; m.use_nodes = True; b = [n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0]
            for k in ('Alpha', 'Base Color'):
                for l in list(b.inputs[k].links): m.node_tree.links.remove(l)
            b.inputs['Alpha'].default_value = 0.35; b.inputs['Base Color'].default_value = (0.02, 0.03, 0.04, 1)
    # pictures: 512 px at most
    for im in bpy.data.images:
        if im.size[0] > 512 or im.size[1] > 512:
            k = 512 / max(im.size); im.scale(max(1, int(im.size[0] * k)), max(1, int(im.size[1] * k)))
    # decimate the big body meshes a little
    # slim the meshes: one UV set, no colour layers, no custom split normals, welded points: the supplied models carry several of each and weigh 100+ bytes a triangle
    import bmesh
    for o in sc.objects:
        if o.type != 'MESH': continue
        me = o.data
        while len(me.uv_layers) > 1: me.uv_layers.remove(me.uv_layers[-1])
        for ca in list(me.color_attributes): me.color_attributes.remove(ca)
        if me.has_custom_normals:
            bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o; bpy.ops.mesh.customdata_custom_splitnormals_clear()
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(me); bm.free()
    for o in sc.objects:
        if o.type != 'MESH' or len(o.data.polygons) < 4000: continue
        is_wheel = bool(o.parent and o.parent.name.startswith('Wheel_')); k = R.get('wheel_decimate', 1) if is_wheel else R.get('decimate_by', {}).get(o.name.split('.')[0], R.get('decimate', 1))
        if k < 1: md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = k; md.use_collapse_triangulate = True
    tri = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for o in sc.objects:
        if o.type == 'MESH': tri += sum(len(p.vertices) - 2 for p in o.evaluated_get(dg).data.polygons)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=True, export_materials='EXPORT', export_image_format='WEBP', export_image_quality=82, export_cameras=False, export_lights=False)
    print('RESULT', cid, 'tris', tri, 'bytes', os.path.getsize(out))
main()

# ---------- livery: painted texture (smooth edges, tiny mesh) ----------
import numpy as np
DEC = float(os.environ.get('DEC', 0.5))
if DEC < 1.0:                                   # simplify the smooth body; the texture carries the livery
    dm = body.modifiers.new('dec', 'DECIMATE'); dm.ratio = DEC
    apply_mod(body, dm)

W, H = 2048, 1024
BLUE = np.array([0.02, 0.06, 0.38]); SILVER = np.array([0.62, 0.65, 0.70])

def side_field(Y, Z):                           # livery on the car's flanks, in (y, z) metres
    s_front = np.minimum(Z - 0.50, (-0.95 + (Z - 0.5) * 1.1) - Y)      # front fender, raked edge
    s_rear = np.minimum(Y - 1.15, Z - 0.52)                           # rear quarter
    d = np.array([1.50, 0.77]); L = np.hypot(*d)                      # diagonal stripe, low at the front
    qy, qz = Y + 0.55, Z - 0.25
    t = (qy * d[0] + qz * d[1]) / L ** 2
    dist = np.abs(qy * d[1] - qz * d[0]) / L
    s_str = np.minimum.reduce([0.17 - dist, (t + 0.10) * L, (1.30 - t) * L])
    return np.minimum(np.maximum.reduce([s_front, s_rear, s_str]), 1.00 - Z)

def top_field(X, Y):                            # hood centre and fender tops, in (x, y)
    hood = np.minimum.reduce([0.40 - np.abs(X), Y + 2.15, -0.55 - Y])
    fend = np.minimum.reduce([np.abs(X) - 0.74, Y + 2.20, -0.55 - Y])
    return np.maximum(hood, fend)

def fb_field(X, Z):                             # front and rear faces, in (x, z)
    return np.minimum(np.abs(X) - 0.78, Z - 0.50)

alpha = np.zeros((H, W))                        # row 0 = bottom of the image
r = np.arange(512)[:, None]; c = np.arange(W)[None, :]
alpha[512:, :] = side_field(-2.4 + 4.8 * (c + 0.5) / W + 0 * r, 1.6 * (r + 0.5) / 512 + 0 * c)
r2 = np.arange(512)[:, None]; c2 = np.arange(1024)[None, :]
alpha[:512, :1024] = top_field(-1.1 + 2.2 * (r2 + 0.5) / 512 + 0 * c2, -2.4 + 4.8 * (c2 + 0.5) / 1024 + 0 * r2)
alpha[:512, 1024:] = fb_field(-1.1 + 2.2 * (c2 + 0.5) / 1024 + 0 * r2, 1.6 * (r2 + 0.5) / 512 + 0 * c2)
alpha = np.clip(0.5 + alpha / 0.006, 0, 1)      # anti-aliased edge

def to_srgb(v): return np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)
rgb = SILVER[None, None, :] * (1 - alpha[..., None]) + BLUE[None, None, :] * alpha[..., None]
rgba = np.concatenate([to_srgb(rgb), np.ones((H, W, 1))], axis=2)
def make_image(name, arr, path):
    img = bpy.data.images.new(name, W, H, alpha=False)
    img.pixels.foreach_set(arr.astype(np.float32).ravel())
    img.filepath_raw = path; img.file_format = 'PNG'; img.save()
    return img
livery_img = make_image('Livery', rgba, os.path.join(OUT, 'car_01_livery.png'))
mask = np.concatenate([np.repeat(alpha[..., None], 3, axis=2), np.ones((H, W, 1))], axis=2)
make_image('LiveryMask', mask, os.path.join(OUT, 'car_01_livery_mask.png'))   # white = blue panels, for in-game recolouring

LIV = bpy.data.materials.new('Paint_Livery'); LIV.use_nodes = True
_b = LIV.node_tree.nodes['Principled BSDF']
_t = LIV.node_tree.nodes.new('ShaderNodeTexImage'); _t.image = livery_img
LIV.node_tree.links.new(_t.outputs['Color'], _b.inputs['Base Color'])
_b.inputs['Metallic'].default_value = 0.75; _b.inputs['Roughness'].default_value = 0.25
_b.inputs['Coat Weight'].default_value = 1.0

def project_uvs(obj):                           # box projection into the atlas
    me = obj.data; uv = me.uv_layers.new(name='UV0')
    for p in me.polygons:
        n = p.normal; ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for li in p.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            if ax >= ay and ax >= az: u, w = (v.y + 2.4) / 4.8, 0.5 + 0.5 * (v.z / 1.6)
            elif az >= ay:            u, w = 0.5 * (v.y + 2.4) / 4.8, 0.5 * ((v.x + 1.1) / 2.2)
            else:                     u, w = 0.5 + 0.5 * (v.x + 1.1) / 2.2, 0.5 * (v.z / 1.6)
            uv.data[li].uv = (min(max(u, 0.002), 0.998), min(max(w, 0.002), 0.998))

body.data.materials.clear(); body.data.materials.append(LIV)
for p in body.data.polygons: p.material_index = 0; p.use_smooth = True
gl = [p.material_index == 2 for p in green.data.polygons]
green.data.materials.clear(); green.data.materials.append(LIV); green.data.materials.append(M['glass'])
for p, g in zip(green.data.polygons, gl): p.material_index = 1 if g else 0; p.use_smooth = True
project_uvs(body); project_uvs(green)

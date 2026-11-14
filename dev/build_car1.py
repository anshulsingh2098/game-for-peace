"""Car 1 - Dusk GT, a production-style grand-touring coupe (blue/silver livery).
Run: blender -b -P build_car1.py -- <out_dir> <render_dir>
Front of the car points to -Y, up is +Z. Units are metres. Uses carkit.py (same folder). Keep the wheel positions (physics) and
the Paint_Livery material + livery mask (the game recolours the stripes through them)."""
import bpy, math, sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import carkit as ck
from carkit import M, add, prim

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else 'assets'); REN = os.path.abspath(argv[1] if len(argv) > 1 else OUT)
os.makedirs(OUT, exist_ok=True); os.makedirs(REN, exist_ok=True)
root = ck.setup('Car_01_GT'); scene = ck.scene
M['silver'] = ck.mat('Paint_Silver', (0.62, 0.65, 0.70), 0.85, 0.28, coat=1.0)

# ---------- the body: knots along the car (y from the nose, -2.275, to the tail, +2.275) ----------
K = ck.smooth_fn
S = {
 'zb':    K([-2.275, -2.20, -1.9, 1.6, 2.15, 2.275], [0.30, 0.19, 0.16, 0.16, 0.22, 0.40]),
 'zbelt': K([-2.275, -2.15, -1.6, -0.9, -0.55, 0.0, 1.0, 1.7, 2.1, 2.275], [0.64, 0.71, 0.82, 0.93, 0.97, 0.99, 1.00, 1.00, 0.96, 0.86]),
 'zroof': K([-2.275, -2.15, -1.6, -0.9, -0.66, -0.55, -0.30, 0.0, 0.30, 0.90, 1.30, 1.70, 1.98, 2.15, 2.275],
            [0.69, 0.76, 0.87, 0.98, 1.00, 1.03, 1.17, 1.29, 1.335, 1.325, 1.24, 1.10, 1.03, 1.00, 0.93]),
 'wsill': K([-2.275, -2.1, -1.7, -1.0, 0.2, 1.0, 1.5, 2.1, 2.275], [0.78, 0.89, 0.97, 0.95, 0.93, 0.94, 1.00, 0.96, 0.84]),
 'wmax':  K([-2.275, -2.1, -1.62, -1.0, -0.6, 0.2, 1.0, 1.34, 1.8, 2.1, 2.275], [0.82, 0.95, 1.025, 0.99, 0.96, 0.95, 0.97, 1.035, 1.02, 0.99, 0.87]),
 'wbelt': K([-2.275, -2.1, -1.62, -0.9, -0.55, 0.2, 1.0, 1.4, 1.9, 2.15, 2.275], [0.76, 0.87, 0.97, 0.93, 0.90, 0.89, 0.92, 0.99, 0.98, 0.94, 0.83]),
 'wroof': K([-2.275, -0.7, -0.55, -0.3, 0.0, 0.5, 1.0, 1.5, 1.98, 2.275], [0.60, 0.80, 0.77, 0.72, 0.69, 0.67, 0.66, 0.62, 0.58, 0.55]),
}
ys = [-2.275 + 4.55 * (0.5 - 0.5 * math.cos(math.pi * t / 59)) for t in range(60)]
CAB = (-0.66, 1.98)
WIN = [(-0.66, 0.0, 'ws'), (0.0, 0.92, 'side'), (0.92, 1.05, 'pil'), (1.05, 1.34, 'side'), (1.34, 1.98, 'rw')]

# ---------- livery texture (blue stripes on silver), kept from the original so the game can still recolour the stripes ----------
W, H = 2048, 1024
BLUE = np.array([0.02, 0.06, 0.38]); SILVER = np.array([0.62, 0.65, 0.70])
def side_field(Y, Z):
    s_front = np.minimum(Z - 0.50, (-0.95 + (Z - 0.5) * 1.1) - Y)
    s_rear = np.minimum(Y - 1.15, Z - 0.52)
    d = np.array([1.50, 0.77]); L = np.hypot(*d)
    qy, qz = Y + 0.55, Z - 0.25
    t = (qy * d[0] + qz * d[1]) / L ** 2
    dist = np.abs(qy * d[1] - qz * d[0]) / L
    s_str = np.minimum.reduce([0.17 - dist, (t + 0.10) * L, (1.30 - t) * L])
    return np.minimum(np.maximum.reduce([s_front, s_rear, s_str]), 1.00 - Z)
def top_field(X, Y):
    hood = np.minimum.reduce([0.40 - np.abs(X), Y + 2.15, -0.55 - Y])
    fend = np.minimum.reduce([np.abs(X) - 0.74, Y + 2.20, -0.55 - Y])
    return np.maximum(hood, fend)
def fb_field(X, Z): return np.minimum(np.abs(X) - 0.78, Z - 0.50)
alpha = np.zeros((H, W))
r = np.arange(512)[:, None]; c = np.arange(W)[None, :]
alpha[512:, :] = side_field(-2.4 + 4.8 * (c + 0.5) / W + 0 * r, 1.6 * (r + 0.5) / 512 + 0 * c)
r2 = np.arange(512)[:, None]; c2 = np.arange(1024)[None, :]
alpha[:512, :1024] = top_field(-1.1 + 2.2 * (r2 + 0.5) / 512 + 0 * c2, -2.4 + 4.8 * (c2 + 0.5) / 1024 + 0 * r2)
alpha[:512, 1024:] = fb_field(-1.1 + 2.2 * (c2 + 0.5) / 1024 + 0 * r2, 1.6 * (r2 + 0.5) / 512 + 0 * c2)
alpha = np.clip(0.5 + alpha / 0.006, 0, 1)
def to_srgb(v): return np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)
rgb = SILVER[None, None, :] * (1 - alpha[..., None]) + BLUE[None, None, :] * alpha[..., None]
rgba = np.concatenate([to_srgb(rgb), np.ones((H, W, 1))], axis=2)
def make_image(name, arr, path):
    img = bpy.data.images.new(name, W, H, alpha=False)
    img.pixels.foreach_set(arr.astype(np.float32).ravel()); img.filepath_raw = path; img.file_format = 'PNG'; img.save(); return img
livery_img = make_image('Livery', rgba, os.path.join(OUT, 'car_01_livery.png'))
mask = np.concatenate([np.repeat(alpha[..., None], 3, axis=2), np.ones((H, W, 1))], axis=2)
make_image('LiveryMask', mask, os.path.join(OUT, 'car_01_livery_mask.png'))
LIV = bpy.data.materials.new('Paint_Livery'); LIV.use_nodes = True
_b = LIV.node_tree.nodes['Principled BSDF']; _t = LIV.node_tree.nodes.new('ShaderNodeTexImage'); _t.image = livery_img
LIV.node_tree.links.new(_t.outputs['Color'], _b.inputs['Base Color'])
_b.inputs['Metallic'].default_value = 0.75; _b.inputs['Roughness'].default_value = 0.25; _b.inputs['Coat Weight'].default_value = 1.0
M['livery'] = LIV

def project_uvs(obj):
    me = obj.data
    while len(me.uv_layers) > 1: me.uv_layers.remove(me.uv_layers[-1])
    uv = me.uv_layers[0] if len(me.uv_layers) else me.uv_layers.new(name='UVMap')
    uv.name = 'UVMap'; me.uv_layers.active = uv
    for p in me.polygons:
        n = p.normal; ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for li in p.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            if ax >= ay and ax >= az: u, w = (v.y + 2.4) / 4.8, 0.5 + 0.5 * (v.z / 1.6)
            elif az >= ay:            u, w = 0.5 * (v.y + 2.4) / 4.8, 0.5 * ((v.x + 1.1) / 2.2)
            else:                     u, w = 0.5 + 0.5 * (v.x + 1.1) / 2.2, 0.5 * (v.z / 1.6)
            uv.data[li].uv = (min(max(u, 0.002), 0.998), min(max(w, 0.002), 0.998))

# ---------- build ----------
WX, WYF, WYR, WZ, WR = 0.82, -1.62, 1.34, 0.35, 0.35
body, cabin = ck.build_loft('Body', S, ys, CAB, WIN, [LIV])
ck.subdivide(body, 1); ck.subdivide(cabin, 1)
ck.arches(body, [(sx * 0.0 + sx * 0.82, wy, WZ) for sx in (-1, 1) for wy in (WYF, WYR)], 0.41, 0.58)
ck.smooth_shade(body); ck.smooth_shade(cabin)
for o in (body, cabin): project_uvs(o)
surf = ck.Surf(body, cabin)

# ---------- front: headlights, grille, intakes, splitter ----------
for sx in (-1, 1):
    ck.headlight(sx, 0.66, 0.74, surf, w=0.36, h=0.11, tilt=0.20)
    iy = surf.y(sx * 0.62, 0.40)
    add('box', f'Intake_{sx}', (sx * 0.64, iy - 0.006, 0.40), (0.34, 0.05, 0.14), 'trim', bevel=0.02)
    for k in range(4): add('box', f'IntakeSlat_{sx}_{k}', (sx * 0.64, iy - 0.034, 0.355 + k * 0.03), (0.30, 0.012, 0.008), 'carbon')
    vy0, vy1 = -1.55, -1.10
    vz0, vz1 = surf.z(sx * 0.46, vy0), surf.z(sx * 0.46, vy1)
    add('box', f'HoodVent_{sx}', (sx * 0.46, (vy0 + vy1) / 2, (vz0 + vz1) / 2 + 0.004), (0.26, 0.46, 0.022), 'trim', rot=(math.atan2(vz1 - vz0, vy1 - vy0), 0, 0), bevel=0.01)
    for k in range(5):
        yy = vy0 + 0.07 + k * 0.08; zz = surf.z(sx * 0.46, yy)
        add('box', f'HoodSlat_{sx}_{k}', (sx * 0.46, yy, zz + 0.012), (0.22, 0.02, 0.012), 'carbon', rot=(math.atan2(vz1 - vz0, vy1 - vy0), 0, 0))
    fy = surf.x(sx, -1.05, 0.64)
    add('box', f'FenderGill_{sx}', (fy + sx * 0.004, -1.0, 0.66), (0.02, 0.32, 0.10), 'trim', bevel=0.01)
    for k in range(3): add('box', f'GillFin_{sx}_{k}', (fy + sx * 0.012, -1.0, 0.63 + k * 0.035), (0.016, 0.30, 0.01), 'chrome')
gy = surf.y(0, 0.46)
add('box', 'GrilleFrame', (0, gy - 0.008, 0.46), (1.02, 0.05, 0.22), 'chrome', bevel=0.02)
add('box', 'Grille', (0, gy - 0.020, 0.46), (0.96, 0.05, 0.18), 'trim', bevel=0.015)
for k in range(9): add('box', f'GrilleBar_{k}', (0, gy - 0.047, 0.385 + k * 0.019), (0.92, 0.012, 0.007), 'chrome')
add('cyl', 'Badge', (0, surf.y(0, 0.62) - 0.012, 0.62), (0.07, 0.07, 0.012), 'chrome', rot=(math.pi / 2, 0, 0), verts=20)
add('box', 'Splitter', (0, -2.265, 0.19), (1.70, 0.24, 0.03), 'carbon', bevel=0.01)
ply = surf.y(0, 0.25)
ck.plate('PlateF', 0, ply - 0.018, 0.27)

# ---------- sides: skirts, mirrors, handles, shut lines, fuel cap ----------
for sx in (-1, 1):
    add('box', f'SideSkirt_{sx}', (sx * 0.915, 0.0, 0.225), (0.05, 2.30, 0.07), 'silver', bevel=0.02)
    ck.mirror(sx, 0.86, -0.50, 1.05, 'silver')
    xh = surf.x(sx, 0.55, 0.92); add('box', f'Handle_{sx}', (xh + sx * 0.012, 0.55, 0.93), (0.025, 0.17, 0.03), 'chrome', bevel=0.006)
    xh2 = surf.x(sx, 1.06, 0.92)
    for dy in (-0.30, 0.95):                                            # door shut lines
        xx = surf.x(sx, dy, 0.65); add('box', f'DoorLine_{sx}_{dy}', (xx + sx * 0.003, dy, 0.64), (0.012, 0.012, 0.62), 'trim')
    xx = surf.x(sx, 0.3, 0.34); add('box', f'DoorSill_{sx}', (xx + sx * 0.003, 0.33, 0.34), (0.012, 1.30, 0.012), 'trim')
    xr = surf.x(sx, 1.62, 0.80); add('cyl', f'FuelCap_{sx}', (xr + sx * 0.004, 1.62, 0.80), (0.13, 0.13, 0.012), 'chrome', rot=(0, math.pi / 2, 0), verts=18)
    xi = surf.x(sx, 1.0, 0.98); add('box', f'BeltTrim_{sx}', (xi + sx * 0.002, 0.65, 0.985), (0.012, 1.95, 0.014), 'chrome')
    xf = surf.x(sx, -1.95, 0.70); add('box', f'Indicator_{sx}', (xf + sx * 0.004, -1.95, 0.70), (0.012, 0.09, 0.03), 'amber')
zd = surf.z(0, -1.2); add('box', 'HoodLine', (0, -0.62, surf.z(0, -0.62) + 0.003), (1.40, 0.012, 0.010), 'trim')
add('box', 'BootLine', (0, 1.98, surf.z(0, 1.98) + 0.003), (1.30, 0.012, 0.010), 'trim')

# ---------- rear: lamps, plate, exhausts, diffuser, spoiler ----------
for sx in (-1, 1):
    ty = surf.y(sx * 0.66, 0.84, rear=True)
    add('box', f'Taillight_{sx}', (sx * 0.66, ty - 0.004, 0.84), (0.40, 0.05, 0.12), 'tail', rot=(0, 0, sx * -0.10), bevel=0.02)
    add('box', f'TailInner_{sx}', (sx * 0.66, ty - 0.012, 0.84), (0.30, 0.02, 0.05), 'trim', bevel=0.01)
    add('box', f'Reverse_{sx}', (sx * 0.34, ty - 0.004, 0.62), (0.07, 0.03, 0.04), 'head', bevel=0.008)
    ck.exhaust(sx * 0.44, 2.285, 0.31)
by = surf.y(0, 0.86, rear=True)
add('box', 'TailBar', (0, by - 0.006, 0.88), (0.74, 0.04, 0.035), 'tail', bevel=0.012)
ck.plate('PlateR', 0, surf.y(0, 0.62, rear=True) + 0.01, 0.62, rear=True)
add('box', 'Diffuser', (0, 2.255, 0.27), (1.10, 0.08, 0.13), 'trim', bevel=0.01)
for k in range(6): add('box', f'DiffuserFin_{k}', (-0.44 + k * 0.176, 2.275, 0.25), (0.016, 0.12, 0.12), 'carbon')
WZW = 1.12                                                               # a modest spoiler on short stands, not a racing wing
add('box', 'Spoiler', (0, 2.00, WZW), (1.46, 0.26, 0.03), 'carbon', rot=(0.06, 0, 0), bevel=0.01)
for sx in (-1, 1):
    add('box', f'SpoilerEnd_{sx}', (sx * 0.73, 2.00, WZW - 0.02), (0.022, 0.30, 0.10), 'carbon', bevel=0.006)
    tz = surf.z(sx * 0.40, 1.98); add('box', f'SpoilerStand_{sx}', (sx * 0.40, 1.98, (tz + WZW) / 2), (0.03, 0.08, WZW - tz), 'carbon', bevel=0.006)

# ---------- interior (behind the glass; hidden in the driver's view by the game) ----------
ck.interior(-0.52, 1.45, 0.90, 1.4, 0.50, (-0.32, -0.50, 0.98))

# ---------- wheels: pivoted at the hub so the game can spin and steer them ----------
ck.wheel('Wheel_FL', -WX, WYF, WZ, WR, 0.27, spokes=5, twin=True)
ck.wheel('Wheel_FR', WX, WYF, WZ, WR, 0.27, spokes=5, twin=True)
ck.wheel('Wheel_RL', -WX, WYR, WZ, WR, 0.29, spokes=5, twin=True)
ck.wheel('Wheel_RR', WX, WYR, WZ, WR, 0.29, spokes=5, twin=True)

# materials on the body objects: the glass slot stays glass; the paint slot is the livery
ck.finish(OUT, REN, 'car_01_gt.blend', 'car_01_gt.glb', 'car1', 'Car_01_GT')
print('DONE')

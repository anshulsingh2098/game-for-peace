"""Car 3 - Dust Runner, a compact rally hatchback (white with teal accents): raised ride height, bonnet light pod, roof scoop,
arch flares, mud flaps, skid plate. Run: blender -b -P build_car3_rally.py -- <out_dir> <render_dir>
Front of the car points to -Y, up is +Z. Units are metres. Uses carkit.py (same folder). Keep the wheel positions (physics), the 'Cabin'
object, Paint_Body, Paint_Accent, Skid_Plate and Mudflap materials."""
import bpy, math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import carkit as ck
from carkit import M, add

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else 'assets'); REN = os.path.abspath(argv[1] if len(argv) > 1 else OUT)
os.makedirs(OUT, exist_ok=True); os.makedirs(REN, exist_ok=True)
root = ck.setup('Car_03_Rally'); scene = ck.scene
M['paint'] = ck.mat('Paint_Body', (0.86, 0.87, 0.89), 0.25, 0.30, coat=1.0)
M['accent'] = ck.mat('Paint_Accent', (0.00, 0.36, 0.44), 0.35, 0.28, coat=1.0)
M['flap'] = ck.mat('Mudflap', (0.70, 0.04, 0.03), 0.0, 0.6)
M['skid'] = ck.mat('Skid_Plate', (0.55, 0.56, 0.58), 1.0, 0.45)

K = ck.smooth_fn
Y = [-1.975, -1.88, -1.5, -1.0, -0.5, 0.3, 1.0, 1.5, 1.85, 1.965]
def k(v): return K(Y, v)
S = {
 'zb':    k([0.42, 0.32, 0.27, 0.27, 0.27, 0.27, 0.27, 0.28, 0.34, 0.42]),
 'zbelt': k([0.78, 0.84, 0.90, 0.96, 1.00, 1.01, 1.01, 1.01, 1.00, 0.98]),
 'zroof': K([-1.975, -1.88, -1.5, -1.0, -0.84, -0.30, 0.05, 0.42, 1.05, 1.48, 1.89, 1.965],
            [0.78, 0.86, 0.93, 0.99, 1.05, 1.44, 1.48, 1.485, 1.48, 1.455, 1.06, 1.0]),
 'wsill': k([0.64, 0.74, 0.82, 0.84, 0.82, 0.81, 0.83, 0.86, 0.84, 0.76]),
 'wmax':  k([0.70, 0.80, 0.88, 0.90, 0.87, 0.86, 0.88, 0.91, 0.89, 0.80]),
 'wbelt': k([0.64, 0.74, 0.82, 0.84, 0.82, 0.82, 0.83, 0.85, 0.83, 0.74]),
 'wroof': K([-1.975, -0.84, -0.30, 0.3, 1.0, 1.48, 1.965], [0.60, 0.70, 0.64, 0.62, 0.62, 0.60, 0.56]),
}
ys = [-1.975 + 3.94 * (0.5 - 0.5 * math.cos(math.pi * t / 59)) for t in range(60)]
CAB = (-0.84, 1.89)
WIN = [(-0.84, 0.0, 'ws'), (0.0, 0.50, 'side'), (0.50, 0.62, 'pil'), (0.62, 1.30, 'side'), (1.30, 1.89, 'rw')]

WX, WYF, WYR, WZ, WR = 0.77, -1.22, 1.30, 0.34, 0.34
body, cabin = ck.build_loft('Body', S, ys, CAB, WIN, [M['paint']])
ck.subdivide(body, 1); ck.subdivide(cabin, 1)
ck.arches(body, [(sx * WX, wy, WZ) for sx in (-1, 1) for wy in (WYF, WYR)], 0.43, 0.58)
ck.smooth_shade(body); ck.smooth_shade(cabin)
surf = ck.Surf(body, cabin)

# front: headlights, grille, bonnet light pod, bumper intake, skid plate
for sx in (-1, 1):
    ck.headlight(sx, 0.56, 0.70, surf, w=0.30, h=0.12, tilt=0.12)
    add('box', f'FogLamp_{sx}', (sx * 0.58, surf.y(sx * 0.58, 0.36) - 0.012, 0.36), (0.16, 0.04, 0.09), 'head', bevel=0.02)
    xh = surf.x(sx, 0.05, 1.00); add('box', f'Handle_{sx}', (xh + sx * 0.012, -0.05, 1.02), (0.025, 0.15, 0.03), 'chrome', bevel=0.006)
    ck.mirror(sx, 0.86, -0.78, 1.14, 'accent')
    xi = surf.x(sx, -1.80, 0.76); add('box', f'Indicator_{sx}', (xi + sx * 0.004, -1.80, 0.76), (0.012, 0.09, 0.03), 'amber')
    xk = surf.x(sx, 0.0, 0.34); add('box', f'SideSkirt_{sx}', (xk - sx * 0.012, 0.0, 0.33), (0.06, 1.7, 0.10), 'skid', bevel=0.02)
    for dy in (-0.05, 0.62):
        xx = surf.x(sx, dy, 0.70); add('box', f'DoorLine_{sx}_{dy}', (xx + sx * 0.003, dy, 0.68), (0.012, 0.012, 0.72), 'trim')
    xs2 = surf.x(sx, 0.3, 0.52); add('box', f'DoorStripe_{sx}', (xs2 + sx * 0.003, 0.06, 0.52), (0.010, 1.30, 0.06), 'accent')
    for wy, tag in ((WYF, 'F'), (WYR, 'R')):                                   # arch flares and mud flaps
        xa = surf.x(sx, wy, 0.72)
        add('box', f'Mudflap_{tag}_{sx}', (sx * 0.80, wy + WR + 0.115, 0.235), (0.27, 0.022, 0.31), 'flap', rot=(-0.10, 0, 0), bevel=0.006)
gy = surf.y(0, 0.66)
add('box', 'GrilleFrame', (0, gy - 0.008, 0.66), (0.84, 0.05, 0.19), 'trim', bevel=0.02)
for q in range(6): add('box', f'GrilleBar_{q}', (0, gy - 0.033, 0.60 + q * 0.024), (0.78, 0.012, 0.008), 'chrome')
add('box', 'BumperIntake', (0, surf.y(0, 0.40) - 0.01, 0.40), (0.70, 0.05, 0.12), 'trim', bevel=0.02)
add('box', 'SkidPlate', (0, -1.78, 0.285), (1.14, 0.46, 0.025), 'skid', bevel=0.008)
add('cyl', 'Badge', (0, gy - 0.01, 0.78), (0.06, 0.06, 0.012), 'chrome', rot=(math.pi / 2, 0, 0), verts=18)
ck.plate('PlateF', 0, surf.y(0, 0.30) - 0.018, 0.30)
add('box', 'HoodStripe', (0, -1.45, surf.z(0, -1.45) + 0.003), (0.46, 1.15, 0.008), 'accent')
pz = surf.z(0, -1.10) + 0.05                                                # light pod on the bonnet
add('box', 'LightPod', (0, -1.12, pz), (0.82, 0.14, 0.11), 'trim', bevel=0.03)
for sx in (-0.30, -0.10, 0.10, 0.30): add('cyl', f'PodLamp_{sx}', (sx, -1.20, pz), (0.12, 0.12, 0.02), 'head', rot=(math.pi / 2, 0, 0), verts=20)

# roof scoop and rack, rear spoiler, tailgate details
rz = surf.z(0, 0.30)
add('box', 'RoofScoop', (0, -0.05, rz + 0.04), (0.32, 0.40, 0.08), 'accent', bevel=0.03)
add('box', 'ScoopMouth', (0, -0.245, rz + 0.04), (0.24, 0.02, 0.05), 'trim', bevel=0.008)
sz = surf.z(0, 1.88)
add('box', 'RoofSpoiler', (0, 1.93, sz + 0.05), (1.22, 0.24, 0.04), 'accent', rot=(0.20, 0, 0), bevel=0.01)
for sx in (-1, 1):
    ty = surf.y(sx * 0.56, 0.84, rear=True)
    add('box', f'Taillight_{sx}', (sx * 0.56, ty - 0.004, 0.84), (0.20, 0.05, 0.34), 'tail', rot=(0, 0, 0), bevel=0.02)
    add('box', f'TailInner_{sx}', (sx * 0.56, ty - 0.012, 0.84), (0.10, 0.02, 0.22), 'trim', bevel=0.01)
    add('box', f'Reverse_{sx}', (sx * 0.30, ty - 0.004, 0.38), (0.07, 0.03, 0.04), 'head', bevel=0.008)
ty0 = surf.y(0, 0.72, rear=True)
ck.plate('PlateR', 0, ty0 + 0.01, 0.72, rear=True, yellow=True)
add('box', 'RearBumper', (0, 1.945, 0.40), (1.40, 0.10, 0.10), 'trim', bevel=0.02)
add('box', 'TowEye', (0.50, 1.99, 0.40), (0.06, 0.08, 0.05), 'caliper', bevel=0.01)
ck.exhaust(0.42, 1.96, 0.30, r=0.045, key='carbon')
add('box', 'BootLine', (0, 1.89, sz + 0.003), (1.10, 0.012, 0.010), 'trim')

ck.interior(-0.62, 1.30, 0.98, 1.3, 0.58, (-0.34, -0.40, 1.08))

ck.wheel('Wheel_FL', -WX, WYF, WZ, WR, 0.24, spokes=6, rim_key='rim')
ck.wheel('Wheel_FR', WX, WYF, WZ, WR, 0.24, spokes=6, rim_key='rim')
ck.wheel('Wheel_RL', -WX, WYR, WZ, WR, 0.24, spokes=6, rim_key='rim')
ck.wheel('Wheel_RR', WX, WYR, WZ, WR, 0.24, spokes=6, rim_key='rim')

ck.finish(OUT, REN, 'car_03_rally.blend', 'car_03_rally.glb', 'car3', 'Car_03_Rally')
print('DONE')

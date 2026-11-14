"""Car 2 - Ember RS, a low mid-engined sports car (orange).
Run: blender -b -P build_car2_sport.py -- <out_dir> <render_dir>
Front of the car points to -Y, up is +Z. Units are metres. Uses carkit.py (same folder). Keep the wheel positions (physics), the 'Cabin'
object, and the Paint_Body material (the game recolours it)."""
import bpy, math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import carkit as ck
from carkit import M, add

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else 'assets'); REN = os.path.abspath(argv[1] if len(argv) > 1 else OUT)
os.makedirs(OUT, exist_ok=True); os.makedirs(REN, exist_ok=True)
root = ck.setup('Car_02_Sport'); scene = ck.scene
M['paint'] = ck.mat('Paint_Body', (0.80, 0.16, 0.02), 0.55, 0.24, coat=1.0)

K = ck.smooth_fn
Y = [-2.17, -2.05, -1.5, -0.95, -0.42, 0.30, 1.00, 1.50, 2.00, 2.15]
def k(v): return K(Y, v)
S = {
 'zb':    k([0.30, 0.20, 0.16, 0.16, 0.16, 0.16, 0.16, 0.20, 0.26, 0.36]),
 'zbelt': k([0.50, 0.56, 0.68, 0.76, 0.80, 0.85, 0.90, 0.94, 0.92, 0.88]),
 'zroof': K([-2.17, -2.05, -1.5, -0.95, -0.42, -0.05, 0.30, 0.80, 1.25, 1.74, 2.0, 2.15],
            [0.50, 0.57, 0.70, 0.82, 1.10, 1.16, 1.16, 1.10, 1.02, 0.955, 0.93, 0.89]),
 'wsill': k([0.74, 0.84, 0.93, 0.92, 0.91, 0.92, 0.97, 0.99, 0.97, 0.85]),
 'wmax':  k([0.78, 0.88, 0.98, 0.96, 0.95, 0.96, 1.01, 1.04, 1.02, 0.90]),
 'wbelt': k([0.72, 0.82, 0.91, 0.88, 0.86, 0.87, 0.91, 0.94, 0.92, 0.82]),
 'wroof': K([-2.17, -0.95, -0.42, 0.3, 1.0, 1.74, 2.15], [0.60, 0.62, 0.55, 0.54, 0.53, 0.48, 0.44]),
}
ys = [-2.17 + 4.32 * (0.5 - 0.5 * math.cos(math.pi * t / 59)) for t in range(60)]
CAB = (-0.95, 1.74)
WIN = [(-0.95, -0.05, 'ws'), (-0.05, 0.42, 'side'), (0.42, 0.62, 'pil'), (0.62, 1.74, 'rw')]

WX, WYF, WYR, WZ, WR = 0.83, -1.30, 1.36, 0.345, 0.345
body, cabin = ck.build_loft('Body', S, ys, CAB, WIN, [M['paint']])
ck.subdivide(body, 1); ck.subdivide(cabin, 1)
ck.arches(body, [(sx * WX, wy, WZ) for sx in (-1, 1) for wy in (WYF, WYR)], 0.41, 0.58)
ck.smooth_shade(body); ck.smooth_shade(cabin)
surf = ck.Surf(body, cabin)

# front: slim headlights, intakes, splitter, plate
for sx in (-1, 1):
    ck.headlight(sx, 0.66, 0.58, surf, w=0.34, h=0.085, tilt=0.30)
    iy = surf.y(sx * 0.55, 0.31)
    add('box', f'Intake_{sx}', (sx * 0.56, iy - 0.006, 0.31), (0.46, 0.05, 0.14), 'trim', bevel=0.02)
    for q in range(4): add('box', f'IntakeSlat_{sx}_{q}', (sx * 0.56, iy - 0.034, 0.27 + q * 0.03), (0.42, 0.012, 0.008), 'carbon')
    xs = surf.x(sx, -0.20, 0.55)                                           # side intake ahead of the rear wheel
    add('box', f'SideIntake_{sx}', (xs + sx * 0.004, 0.72, 0.52), (0.02, 0.62, 0.20), 'trim', bevel=0.01)
    for q in range(4): add('box', f'SideFin_{sx}_{q}', (xs + sx * 0.012, 0.72, 0.45 + q * 0.045), (0.016, 0.56, 0.012), 'carbon')
    ck.mirror(sx, 0.92, -0.78, 0.88, 'paint')
    xh = surf.x(sx, -0.10, 0.62); add('box', f'Handle_{sx}', (xh + sx * 0.012, -0.12, 0.64), (0.025, 0.16, 0.03), 'chrome', bevel=0.006)
    xi = surf.x(sx, -2.0, 0.50); add('box', f'Indicator_{sx}', (xi + sx * 0.004, -1.98, 0.50), (0.012, 0.09, 0.03), 'amber')
    xk = surf.x(sx, -0.3, 0.22); add('box', f'SideSkirt_{sx}', (xk - sx * 0.012, -0.3, 0.21), (0.06, 2.0, 0.09), 'carbon', bevel=0.02)
    for dy in (-0.62, 0.42):                                                # door shut lines and a shoulder crease
        xx = surf.x(sx, dy, 0.50); add('box', f'DoorLine_{sx}_{dy}', (xx + sx * 0.003, dy, 0.50), (0.012, 0.012, 0.52), 'trim')
    xx = surf.x(sx, -0.1, 0.30); add('box', f'DoorSill_{sx}', (xx + sx * 0.003, -0.1, 0.30), (0.012, 1.04, 0.012), 'trim')
    xc = surf.x(sx, 0.0, 0.76); add('box', f'Crease_{sx}', (xc + sx * 0.002, 0.2, 0.76), (0.010, 2.3, 0.010), 'chrome')
add('box', 'Splitter', (0, -2.15, 0.17), (1.76, 0.24, 0.025), 'carbon', bevel=0.008)
ck.plate('PlateF', 0, surf.y(0, 0.27) - 0.018, 0.27)
add('box', 'FrontLip', (0, surf.y(0, 0.36) - 0.01, 0.36), (0.70, 0.05, 0.05), 'trim', bevel=0.015)
add('box', 'HoodLine', (0, -1.30, surf.z(0, -1.30) + 0.003), (1.10, 0.012, 0.010), 'trim')
add('cyl', 'Badge', (0, surf.y(0, 0.46) - 0.012, 0.46), (0.07, 0.07, 0.012), 'chrome', rot=(math.pi / 2, 0, 0), verts=20)

# engine cover: louvres on the deck behind the glass, cooling slots on the haunches
for q in range(7):
    yy = 1.55 + q * 0.08; zz = surf.z(0, yy)
    add('box', f'Louvre_{q}', (0, yy, zz + 0.006), (0.80, 0.03, 0.012), 'carbon')

# rear: lamps, plate, exhausts, diffuser, ducktail wing
for sx in (-1, 1):
    ty = surf.y(sx * 0.62, 0.74, rear=True)
    add('box', f'Taillight_{sx}', (sx * 0.62, ty - 0.004, 0.74), (0.40, 0.05, 0.085), 'tail', rot=(0, 0, sx * -0.18), bevel=0.02)
    add('box', f'TailInner_{sx}', (sx * 0.62, ty - 0.010, 0.74), (0.30, 0.02, 0.03), 'trim', bevel=0.01)
    ck.exhaust(sx * 0.22, 2.16, 0.36, r=0.05)
add('box', 'TailBar', (0, surf.y(0, 0.80, rear=True) - 0.006, 0.80), (0.74, 0.04, 0.03), 'tail', bevel=0.012)
ck.plate('PlateR', 0, surf.y(0, 0.55, rear=True) + 0.01, 0.55, rear=True)
add('box', 'Diffuser', (0, 2.12, 0.27), (1.20, 0.10, 0.12), 'trim', bevel=0.01)
for q in range(7): add('box', f'DiffuserFin_{q}', (-0.60 + q * 0.20, 2.14, 0.25), (0.016, 0.12, 0.12), 'carbon')
WZW = 1.08
add('box', 'Wing', (0, 2.00, WZW), (1.55, 0.30, 0.03), 'carbon', rot=(0.07, 0, 0), bevel=0.01)
for sx in (-1, 1):
    add('box', f'WingEnd_{sx}', (sx * 0.775, 2.00, WZW - 0.025), (0.022, 0.34, 0.12), 'carbon', bevel=0.006)
    tz = surf.z(sx * 0.45, 1.98); add('box', f'WingStand_{sx}', (sx * 0.45, 1.98, (tz + WZW) / 2), (0.03, 0.08, WZW - tz), 'carbon', bevel=0.006)

ck.interior(-0.82, 0.30, 0.78, 1.3, 0.42, (-0.36, -0.60, 0.82))

ck.wheel('Wheel_FL', -WX, WYF, WZ, WR, 0.26, spokes=6)
ck.wheel('Wheel_FR', WX, WYF, WZ, WR, 0.26, spokes=6)
ck.wheel('Wheel_RL', -WX, WYR, WZ, WR, 0.30, spokes=6)
ck.wheel('Wheel_RR', WX, WYR, WZ, WR, 0.30, spokes=6)

ck.finish(OUT, REN, 'car_02_sport.blend', 'car_02_sport.glb', 'car2', 'Car_02_Sport')
print('DONE')

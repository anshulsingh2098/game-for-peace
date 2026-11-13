import re
# ================= BIKE: add a rider =================
s = open('build_bike1.py', encoding='utf-8').read()
a = "# ---------- running gear ----------"
assert a in s
rider = '''# ---------- rider (separate parts so the game can hide them) ----------
from mathutils import Vector as V
def limb(name, p1, p2, r, key):
    p1, p2 = V(p1), V(p2); d = p2 - p1; mid = (p1 + p2) / 2
    return prim('cyl', name, tuple(mid), (r, r, d.length), key, rot=tuple(d.to_track_quat('Z', 'Y').to_euler()), verts=8)
hull('Rider_Torso', [(0.17, 0.34, 0.99), (0.17, 0.30, 1.15), (0.21, -0.12, 1.39), (0.16, -0.17, 1.21), (0.12, 0.22, 0.97), (0.12, -0.05, 1.05)], 'dark')
hull('Rider_Hips', [(0.16, 0.36, 0.96), (0.16, 0.12, 0.99), (0.14, 0.40, 0.88), (0.13, 0.10, 0.90)], 'dark')
prim('sph', 'Rider_Helmet', (0, -0.31, 1.54), (0.25, 0.30, 0.27), 'panel', verts=12)
prim('box', 'Rider_Visor', (0, -0.455, 1.545), (0.20, 0.03, 0.075), 'trim')
for sx in (-1, 1):
    limb(f'Rider_UpperArm_{sx}', (sx * 0.21, -0.12, 1.34), (sx * 0.34, -0.33, 1.17), 0.052, 'dark')
    limb(f'Rider_ForeArm_{sx}', (sx * 0.34, -0.33, 1.17), (sx * 0.41, -0.50, 1.07), 0.046, 'dark')
    prim('box', f'Rider_Glove_{sx}', (sx * 0.42, -0.51, 1.065), (0.085, 0.10, 0.075), 'trim')
    limb(f'Rider_Thigh_{sx}', (sx * 0.15, 0.32, 0.95), (sx * 0.22, -0.10, 0.80), 0.075, 'dark')
    limb(f'Rider_Shin_{sx}', (sx * 0.22, -0.10, 0.80), (sx * 0.23, 0.26, 0.42), 0.058, 'dark')
    prim('box', f'Rider_Boot_{sx}', (sx * 0.23, 0.22, 0.37), (0.10, 0.24, 0.09), 'trim')

'''
s = s.replace(a, rider + a, 1)
# keep rider parts in the merged "Details" but name-able: make rider its own merged object
a2 = "keep = ('Fairing', 'FlankPlate', 'Belly', 'Battery', 'Tail', 'Seat')"
assert a2 in s
s = s.replace(a2, "join([o for o in root.children if o.name.startswith('Rider_')], 'Rider')\n" + a2, 1)
open('build_bike1.py', 'w', encoding='utf-8').write(s)

# ================= TRUCK: roof markers, wipers, handrails, plate =================
t = open('build_truck1.py', encoding='utf-8').read()
a = "# ---------- trailer ----------"
assert a in t
extra = '''# cab roof marker lights, wipers, grab handles, front plate
M['amber'] = mat('Light_Marker', (0.9, 0.45, 0.05), 0.0, 0.3, emit=(1, 0.55, 0.08), emit_s=1.5)
for k in range(5): add('box', f'RoofMarker_{k}', (-0.7 + k * 0.35, -4.02, 3.60), (0.14, 0.07, 0.07), 'amber', bevel=0.012)
for sx in (-1, 1):
    add('box', f'Wiper_{sx}', (sx * 0.5, -4.20, 2.80), (0.62, 0.015, 0.03), 'trim', rot=(math.radians(-18), 0, math.radians(sx * 8)))
    add('cyl', f'GrabHandle_{sx}', (sx * 1.27, -4.28, 2.1), (0.035, 0.035, 0.9), 'chrome', verts=8)
    add('box', f'MarkerSide_{sx}', (sx * 1.255, -2.2, 3.2), (0.02, 0.12, 0.06), 'amber')
    add('box', f'MarkerSide2_{sx}', (sx * 1.255, -0.3, 3.0), (0.02, 0.12, 0.06), 'amber')
    add('box', f'SleeperStripe_{sx}', (sx * 1.262, -1.0, 1.9), (0.015, 2.6, 0.10), 'silver')
add('box', 'FrontPlate', (0, -6.04, 0.84), (0.46, 0.015, 0.2), 'silver')
add('box', 'BumperStep', (0, -6.07, 0.55), (1.6, 0.14, 0.06), 'chrome', bevel=0.015)

'''
t = t.replace(a, extra + a, 1)
open('build_truck1.py', 'w', encoding='utf-8').write(t)
print('bike + truck patched')

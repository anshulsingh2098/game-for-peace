#            y      zb    zt    half-width
loft('Hood', [(-5.93, 0.95, 2.00, 0.95), (-5.87, 0.92, 2.08, 1.10), (-5.00, 0.95, 2.22, 1.16),
              (-4.40, 1.00, 2.36, 1.20)], 'orange', n=24)
loft('Cab', [(-4.42, 1.00, 2.36, 1.21), (-4.37, 1.00, 2.46, 1.22), (-4.02, 1.00, 3.50, 1.23),
             (-3.95, 1.00, 3.56, 1.24), (-3.00, 1.00, 3.60, 1.25), (-2.30, 1.00, 3.64, 1.25),
             (-1.40, 1.00, 3.96, 1.26), (0.10, 1.00, 3.98, 1.26), (0.22, 1.00, 3.90, 1.25),
             (0.27, 1.00, 3.40, 1.20)], 'orange', n=24)

# ---------- tractor details ----------
add('box', 'Frame', (0, -1.65, 0.90), (1.1, 7.1, 0.26), 'trim')
add('box', 'Bumper', (0, -5.96, 0.80), (2.38, 0.50, 0.55), 'trim', bevel=0.06)
add('box', 'BumperTop', (0, -5.98, 1.12), (2.30, 0.36, 0.10), 'silver', bevel=0.03)
add('box', 'GrilleSurround', (0, -5.97, 1.62), (1.62, 0.07, 1.05), 'trim', bevel=0.03)
add('box', 'Grille', (0, -6.00, 1.62), (1.46, 0.05, 0.92), 'chrome', bevel=0.02)
for k in range(7): add('box', f'GrilleBar{k}', (0, -6.04, 1.24 + k * 0.125), (1.40, 0.03, 0.045), 'trim')
for sx in (-1, 1):
    add('box', f'Headlight_{sx}', (sx * 0.98, -5.94, 1.72), (0.30, 0.10, 0.42), 'head', bevel=0.04)
    add('box', f'FogLight_{sx}', (sx * 0.85, -6.02, 0.88), (0.16, 0.05, 0.12), 'head', bevel=0.02)
    add('box', f'FrontFender_{sx}', (sx * 1.0, -4.6, 1.18), (0.62, 1.30, 0.07), 'trim', bevel=0.03)
    add('box', f'CabSkirt_{sx}', (sx * 1.22, -3.0, 1.10), (0.06, 3.2, 0.34), 'trim', bevel=0.02)
    add('box', f'Window_{sx}', (sx * 1.245, -3.55, 3.02), (0.04, 1.30, 0.80), 'glass', bevel=0.01)
    add('box', f'DoorSeamF_{sx}', (sx * 1.25, -4.18, 2.20), (0.03, 0.03, 2.2), 'trim')
    add('box', f'DoorSeamR_{sx}', (sx * 1.25, -2.85, 2.20), (0.03, 0.03, 2.2), 'trim')
    add('box', f'DoorHandle_{sx}', (sx * 1.26, -3.0, 2.45), (0.04, 0.22, 0.05), 'chrome')
    add('box', f'SleeperVent_{sx}', (sx * 1.27, -1.1, 3.05), (0.03, 0.9, 0.34), 'trim')
    add('box', f'MirrorArm_{sx}', (sx * 1.40, -4.20, 3.15), (0.30, 0.05, 0.05), 'trim')
    add('box', f'MirrorFrame_{sx}', (sx * 1.56, -4.20, 2.85), (0.07, 0.26, 0.80), 'trim', bevel=0.02)
    add('box', f'MirrorGlass_{sx}', (sx * 1.60, -4.20, 2.85), (0.03, 0.22, 0.72), 'silver')
    add('cyl', f'FuelTank_{sx}', (sx * 1.12, -2.55, 0.74), (0.62, 0.62, 2.0), 'chrome', rot=(math.pi / 2, 0, 0), verts=16)
    add('box', f'TankStrap_{sx}', (sx * 1.12, -2.55, 0.74), (0.66, 0.08, 0.66), 'trim')
    add('box', f'Step_{sx}', (sx * 1.32, -3.55, 1.02), (0.36, 0.7, 0.06), 'trim')
    add('cyl', f'ExhaustStack_{sx}', (sx * 1.14, 0.42, 2.55), (0.10, 0.10, 2.9), 'chrome', verts=12)
    add('box', f'DriveFender_{sx}', (sx * 1.0, 0.9, 1.22), (0.66, 2.0, 0.07), 'trim', bevel=0.03)
    add('box', f'MudFlap_{sx}', (sx * 1.0, 2.15, 0.62), (0.55, 0.04, 0.6), 'trim')
add('box', 'Windshield', (0, -4.19, 2.99), (2.20, 0.04, 1.08), 'glass', rot=(math.radians(-18), 0, 0), bevel=0.01)
add('box', 'Visor', (0, -4.10, 3.55), (2.30, 0.30, 0.05), 'trim', rot=(math.radians(-10), 0, 0), bevel=0.02)
add('box', 'FifthWheel', (0, 0.95, 1.12), (1.5, 1.25, 0.18), 'trim')
for y in (-4.6, 0.3, 1.5): add('box', f'Axle_{y}', (0, y, 0.55), (2.0, 0.14, 0.14), 'trim')

# ---------- trailer ----------
TY0, TY1 = 0.70, 7.40; TZ0, TZ1 = 1.35, 4.10; TH = TZ1 - TZ0; TC = (TZ0 + TZ1) / 2; TYC = (TY0 + TY1) / 2
M['rib'] = mat('Trailer_Rib', (0.55, 0.14, 0.02), 0.1, 0.5)
M['white'] = mat('Tape_White', (0.9, 0.9, 0.9), 0.0, 0.5)
add('box', 'Trailer', (0, TYC, TC), (2.6, TY1 - TY0, TH), 'trailer', bevel=0.04)
add('box', 'TrailerSkirt', (0, TYC + 0.2, TZ0 + 0.2), (2.64, TY1 - TY0 - 0.5, 0.38), 'silver', bevel=0.02)
add('box', 'TrailerFrame', (0, TYC, 1.22), (2.0, TY1 - TY0, 0.2), 'trim')
add('box', 'TrailerNose', (0, TY0 - 0.01, TC), (2.62, 0.05, TH), 'silver')
add('box', 'RearBumper', (0, TY1 - 0.05, 1.0), (2.1, 0.18, 0.28), 'trim', bevel=0.02)
for dx in (-0.65, 0.0, 0.65): add('box', f'RearDoorLine{dx}', (dx, TY1 + 0.02, TC), (0.04, 0.02, TH - 0.1), 'trim')
for sx in (-1, 1):
    add('box', f'Taillight_{sx}', (sx * 1.1, TY1 + 0.02, 1.7), (0.16, 0.05, 0.40), 'tail', bevel=0.02)
    add('box', f'DoorBar_{sx}', (sx * 0.3, TY1 + 0.04, TC), (0.04, 0.04, TH - 0.4), 'chrome')
    add('box', f'LandingGear_{sx}', (sx * 1.0, 2.6, 0.72), (0.14, 0.14, 1.1), 'trim')
    add('box', f'TrailerRoofEdge_{sx}', (sx * 1.3, TYC, TZ1), (0.04, TY1 - TY0, 0.05), 'silver')
    add('box', f'TrailerMudFlap_{sx}', (sx * 1.0, 7.0, 0.65), (0.55, 0.04, 0.6), 'trim')
    for k in range(8): add('box', f'Rib_{sx}_{k}', (sx * 1.305, 1.1 + k * 0.82, TC + 0.15), (0.02, 0.04, TH - 0.5), 'rib')
    for k in range(13):
        add('box', f'Tape_{sx}_{k}', (sx * 1.322, 1.0 + k * 0.5, TZ0 + 0.46), (0.02, 0.25, 0.07), 'tail' if k % 2 else 'white')
for y in (5.60, 6.80): add('box', f'TAxle_{y}', (0, y, 0.55), (2.0, 0.14, 0.14), 'trim')

# ---------- wheels (hub pivot, so the game can spin / steer) ----------
R = 0.55
def wheel(name, x, y, width, dual=False):
    hub = bpy.data.objects.new(name, None); hub.location = (x, y, R); scene.collection.objects.link(hub); hub.parent = root
    out = 1 if x > 0 else -1; rot = (0, math.pi / 2, 0); kids = []
    w = 0.34 if dual else width
    for k, o in enumerate((-0.19, 0.19) if dual else (0.0,)):
        kids.append(prim('cyl', f'{name}_Tyre{k}', (x + o, y, R), (R * 2, R * 2, w), 'tyre', rot=rot, parent=hub, verts=28, bevel=0.03))
    xo = x + (0.19 * out if dual else 0.0) + out * (w / 2)
    kids.append(prim('cyl', name + '_Rim', (xo - out * 0.01, y, R), (0.66, 0.66, 0.04), 'rim', rot=rot, parent=hub, verts=20))
    kids.append(prim('cyl', name + '_Hub', (xo + out * 0.01, y, R), (0.30, 0.30, 0.07), 'chrome', rot=rot, parent=hub, verts=12))
    kids.append(prim('cyl', name + '_Cap', (xo + out * 0.03, y, R), (0.12, 0.12, 0.05), 'trim', rot=rot, parent=hub, verts=10))
    for o in kids: o.matrix_parent_inverse = hub.matrix_world.inverted()
for sx in (-1, 1):
    s = 'L' if sx < 0 else 'R'
    wheel(f'Wheel_F{s}', sx * 1.0, -4.6, 0.36)
    for i, y in enumerate((0.30, 1.50)): wheel(f'Wheel_D{i}{s}', sx * 0.98, y, 0.0, dual=True)
    for i, y in enumerate((5.60, 6.80)): wheel(f'Wheel_T{i}{s}', sx * 0.98, y, 0.0, dual=True)


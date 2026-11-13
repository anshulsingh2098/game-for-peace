s = open('build_car1.py', encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)

# ---- sleeker proportions: lower nose, lower roof, longer fastback glass ----
a = s.index('ST = ['); b = s.index('N = 24')
s = s[:a] + '''ST = [(-2.265, 0.32, 0.74, 0.82), (-2.235, 0.26, 0.77, 0.91), (-2.05, 0.20, 0.80, 0.96),
      (-1.62, 0.20, 0.87, 1.03), (-1.00, 0.20, 0.91, 0.96), (-0.60, 0.20, 0.94, 0.91),
      (0.20, 0.20, 0.94, 0.90), (1.00, 0.20, 0.95, 0.91), (1.40, 0.20, 0.99, 1.01),
      (1.90, 0.20, 1.01, 1.00), (2.20, 0.22, 1.00, 0.96), (2.245, 0.26, 0.98, 0.93), (2.275, 0.32, 0.94, 0.88)]
''' + s[b:]
a = s.index('G = ['); b = s.index('gv, gf, gm = [], [], []')
s = s[:a] + '''G = [(-0.74, 0.98, 0.99), (-0.40, 1.33, 1.0), (-0.05, 1.36, 1.0), (0.20, 1.36, 1.0), (0.28, 1.36, 1.0),
     (0.55, 1.35, 1.0), (0.95, 1.29, 0.99), (1.38, 1.13, 0.96), (1.82, 0.99, 0.90)]
''' + s[b:]

# ---- palette additions ----
rep(" 'chrome': mat('Chrome',", " 'disc':   mat('Disc',         (0.36, 0.37, 0.40), 1.0, 0.35),\n 'caliper': mat('Caliper',      (0.75, 0.05, 0.04), 0.2, 0.4),\n 'chrome': mat('Chrome',")

# ---- helper to sit parts flush on the flanks ----
rep("def surf_y(x, z, rear=False):", "def surf_x(sx, y, z):\n    hit = _bvh.ray_cast(Vector((sx * 3.0, y, z)), Vector((-sx, 0, 0)))\n    return hit[0].x if hit[0] else sx * 0.9\ndef surf_y(x, z, rear=False):")

# ---- extra body detail ----
rep("# wheels (pivot at hub so the game can spin and steer them)", '''# door shut lines, fender vents, canards, diffuser fins, tail-light bar, fuel cap
for sx in (-1, 1):
    for dy in (-0.52, 0.98):
        xx = surf_x(sx, dy, 0.62)
        add('box', f'DoorLine_{sx}_{dy}', (xx + sx * 0.004, dy, 0.64), (0.014, 0.014, 0.52), 'trim')
    xx = surf_x(sx, 0.2, 0.34); add('box', f'DoorSill_{sx}', (xx + sx * 0.004, 0.23, 0.34), (0.014, 1.5, 0.014), 'trim')
    xv = surf_x(sx, -1.05, 0.62)
    add('box', f'FenderVent_{sx}', (xv + sx * 0.006, -1.05, 0.62), (0.022, 0.34, 0.11), 'trim', bevel=0.01)
    for k in range(3): add('box', f'VentSlat_{sx}_{k}', (xv + sx * 0.012, -1.05, 0.58 + k * 0.04), (0.018, 0.32, 0.012), 'chrome')
    add('box', f'Canard_{sx}', (sx * 0.78, -2.17, 0.30), (0.20, 0.16, 0.025), 'carbon', rot=(0, 0, sx * -0.35), bevel=0.006)
    xr = surf_x(sx, 1.55, 0.78); add('cyl', f'FuelCap_{sx}', (xr + sx * 0.004, 1.55, 0.78), (0.14, 0.14, 0.014), 'chrome', rot=(0, math.pi / 2, 0), verts=16)
for k in range(5): add('box', f'DiffuserFin_{k}', (-0.40 + k * 0.2, 2.30, 0.24), (0.018, 0.10, 0.14), 'trim')
add('box', 'TailBar', (0, surf_y(0, 0.86, rear=True) - 0.004, 0.86), (0.7, 0.04, 0.05), 'tail', bevel=0.012)

# wheels (pivot at hub so the game can spin and steer them)''')

# ---- nicer wheels: rotor, red caliper, lip ----
rep("    prim('cyl', name + '_Disc', (x + out * 0.115, y, WZ), (0.42, 0.42, 0.02), 'trim', rot=rot, parent=hub, verts=32)",
    "    prim('cyl', name + '_Disc', (x + out * 0.105, y, WZ), (0.40, 0.40, 0.018), 'disc', rot=rot, parent=hub, verts=40)\n"
    "    prim('cyl', name + '_Hat', (x + out * 0.112, y, WZ), (0.16, 0.16, 0.02), 'trim', rot=rot, parent=hub, verts=24)\n"
    "    prim('box', name + '_Caliper', (x + out * 0.095, y + (0.06 if x < 0 else -0.06), WZ + 0.16), (0.07, 0.17, 0.09), 'caliper', parent=hub, bevel=0.012)\n"
    "    prim('cyl', name + '_Lip', (x + out * 0.134, y, WZ), (0.50, 0.50, 0.012), 'chrome', rot=rot, parent=hub, verts=40)")
rep("(0.025, 0.065, 0.21), 'rim', rot=(a - math.pi / 2, 0, 0), parent=hub)", "(0.025, 0.05, 0.19), 'rim', rot=(a - math.pi / 2, 0, 0), parent=hub)")
open('build_car1.py', 'w', encoding='utf-8').write(s)
print('car patched')

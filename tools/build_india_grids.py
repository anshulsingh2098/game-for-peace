#!/usr/bin/env python3
"""Builds the India terrain grids the game loads (assets/india/terrain.bin + terrain.json) from the raw downloads of tools/fetch_india_terrain.py (data/raw, not in git).
   Grid: game space (docs/INDIA_MAP_PLAN.md section 9: 1:100, equirectangular about 22.5N 80E, x east, z south), cells of CELL game metres (50 = 5 real km).
   Per cell, 8 planes of one byte each except the first (int16): elevation (real metres, mean of 5x5 samples), relief (standard deviation of those samples in real metres / 8, capped 255),
   then land cover fractions (0 to 255): tree, crop, grass (rangeland, flooded vegetation, unknown), bare (bare ground and snow), built.
   Corridor floor: every cell within 1 cell of a skeleton road or city is raised to at least FLOOR real metres, so a real highway is never routed through the sea or a lake of one cell.
   Run: python3 tools/build_india_grids.py          (about 5 to 10 minutes in pure Python) """
import json, math, os, struct, sys, time
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, '..', 'data', 'raw'); OUT = os.path.join(HERE, '..', 'assets', 'india')
CELL = 50.0; X0, Z0, NX, NZ = -12500.0, -15000.0, 620, 670; FLOOR = 6; Z = 8; SCALE = 100.0
KM_LAT = 110.57; KM_LON = 111.32 * math.cos(22.5 * math.pi / 180)
def from_game(x, z): return 22.5 - z * SCALE / 1000 / KM_LAT, 80.0 + x * SCALE / 1000 / KM_LON
# ---- elevation tiles
tiles = {}
def tile_data(tx, ty):
    k = (tx, ty)
    if k not in tiles:
        p = os.path.join(RAW, 'terrarium', f'{Z}_{tx}_{ty}.png'); tiles[k] = Image.open(p).convert('RGB').tobytes() if os.path.exists(p) else None
    return tiles[k]
def elev(lat, lon):
    n = 2 ** Z; fx = (lon + 180) / 360 * n; fy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    d = tile_data(int(fx), int(fy))
    if d is None: return None
    c = int((fx - int(fx)) * 256); r = int((fy - int(fy)) * 256); i = (min(r, 255) * 256 + min(c, 255)) * 3
    return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768
# ---- land cover blocks
blocks = {}
def lc(lat, lon):
    lo = 68 + int((lon - 68) // 4) * 4; la = 6 + int((lat - 6) // 4) * 4; k = (lo, la)
    if k not in blocks:
        p = os.path.join(RAW, 'landcover', f'lc_{lo}_{la}.tif'); blocks[k] = Image.open(p).tobytes() if os.path.exists(p) else None
    d = blocks[k]
    if d is None: return 0
    c = int((lon - lo) / 4 * 1024); r = int((la + 4 - lat) / 4 * 1024); return d[min(max(r, 0), 1023) * 1024 + min(max(c, 0), 1023)]
# ---- skeleton corridor
sk = json.load(open(os.path.join(OUT, 'skeleton.json')))
corridor = set()
def mark(x, z):
    i = int((x - X0) / CELL); j = int((z - Z0) / CELL)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            if 0 <= i + di < NX and 0 <= j + dj < NZ: corridor.add((i + di, j + dj))
for r in sk['roads']:
    pts = r['pts']
    for a in range(0, len(pts) - 2, 2):
        x1, z1, x2, z2 = pts[a], pts[a + 1], pts[a + 2], pts[a + 3]; steps = max(1, int(math.hypot(x2 - x1, z2 - z1) / (CELL / 2)))
        for s in range(steps + 1): mark(x1 + (x2 - x1) * s / steps, z1 + (z2 - z1) * s / steps)
for n in sk['nodes']: mark(n['x'], n['z'])
print('corridor cells', len(corridor), flush=True)
elev_b = bytearray(NX * NZ * 2); relief = bytearray(NX * NZ); cov = [bytearray(NX * NZ) for _ in range(5)]
ES = [(a + 0.5) / 5 for a in range(5)]; LS = [(a + 0.5) / 8 for a in range(8)]; t0 = time.time(); missing = 0
for j in range(NZ):
    for i in range(NX):
        hs = []
        for a in ES:
            for b in ES:
                lat, lon = from_game(X0 + (i + a) * CELL, Z0 + (j + b) * CELL)
                if lat < 6 or lat > 36 or lon < 68 or lon > 98: continue
                h = elev(lat, lon)
                if h is not None: hs.append(h)
        if not hs: missing += 1; mean = -100.0; sd = 0.0
        else: mean = sum(hs) / len(hs); sd = math.sqrt(sum((h - mean) ** 2 for h in hs) / len(hs))
        if (i, j) in corridor and mean < FLOOR: mean = FLOOR
        k = j * NX + i; struct.pack_into('<h', elev_b, k * 2, int(max(-32000, min(32000, round(mean))))); relief[k] = min(255, int(sd / 8))
        if mean > 0:
            cnt = [0] * 12; tot = 0
            for a in LS:
                for b in LS:
                    lat, lon = from_game(X0 + (i + a) * CELL, Z0 + (j + b) * CELL)
                    if lat < 6 or lat > 36 or lon < 68 or lon > 98: continue
                    c = lc(lat, lon)
                    if c in (0, 1): continue
                    cnt[c] += 1; tot += 1
            if tot:
                f = lambda v: min(255, int(v * 255 / tot + 0.5))
                cov[0][k] = f(cnt[2]); cov[1][k] = f(cnt[5]); cov[2][k] = f(cnt[11] + cnt[4] + cnt[10] + cnt[3] + cnt[6]); cov[3][k] = f(cnt[8] + cnt[9]); cov[4][k] = f(cnt[7])
    if j % 20 == 0: print(f'row {j}/{NZ}  {time.time() - t0:.0f}s', flush=True)
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, 'terrain.bin'), 'wb') as f:
    f.write(bytes(elev_b)); f.write(bytes(relief))
    for p in cov: f.write(bytes(p))
meta = {'version': 1, 'scale': SCALE, 'cell': CELL, 'x0': X0, 'z0': Z0, 'nx': NX, 'nz': NZ, 'planes': ['elevation int16 (real metres)', 'relief u8 (real metres / 8)', 'tree u8', 'crop u8', 'grass u8', 'bare u8', 'built u8'], 'corridorFloorM': FLOOR,
        'sources': {'elevation': 'AWS Terrain Tiles (Mapzen/Tilezen terrarium, zoom 8): SRTM, GMTED2010, ETOPO1 and others (USGS, NOAA), https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
                    'landcover': 'Esri / Impact Observatory / Microsoft 10 m Land Cover (Sentinel-2), CC BY 4.0, Esri public ImageServer Sentinel2_10m_LandCover'}, 'built': time.strftime('%Y-%m-%d')}
json.dump(meta, open(os.path.join(OUT, 'terrain.json'), 'w'), indent=1)
print('done', os.path.getsize(os.path.join(OUT, 'terrain.bin')) // 1024, 'KB; cells without data', missing, flush=True)

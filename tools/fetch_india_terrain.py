#!/usr/bin/env python3
"""Downloads the raw elevation and land cover for India into data/raw/ (git-ignored), for tools/build_india_grids.py.
   Elevation: AWS Terrain Tiles (Mapzen/Tilezen "terrarium" PNG tiles, zoom 8, about 600 m per pixel), built from SRTM, GMTED2010, ETOPO1 and others (USGS, NOAA): attribution in docs/OPEN_DATA.md.
   Land cover: Esri / Impact Observatory / Microsoft 10 m Land Cover (Sentinel-2), CC BY 4.0, from Esri's public ImageServer, exported in 4 x 4 degree blocks at about 430 m per pixel.
   Run: python3 tools/fetch_india_terrain.py      (about 530 elevation tiles of 40 KB and 64 land cover blocks of 1 MB; resumable: files already there are skipped; polite delays) """
import math, os, subprocess, sys, time
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'raw'); os.makedirs(os.path.join(ROOT, 'terrarium'), exist_ok=True); os.makedirs(os.path.join(ROOT, 'landcover'), exist_ok=True)
LAT0, LAT1, LON0, LON1, Z = 6, 36, 68, 98, 8
UA = 'game-for-peace-build-tool/1.0'
def curl(url, out):
    for attempt in range(4):
        r = subprocess.run(['curl', '-sS', '--http1.1', '-m', '150', '-A', UA, '-o', out + '.part', '-w', '%{http_code}', url], capture_output=True, text=True)
        if r.stdout.strip() == '200' and os.path.getsize(out + '.part') > 100: os.replace(out + '.part', out); return True
        time.sleep(2 + attempt * 3)
    if os.path.exists(out + '.part'): os.remove(out + '.part')
    return False
def tile(lat, lon, z):
    n = 2 ** z; return int((lon + 180) / 360 * n), int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
x0, y1 = tile(LAT0, LON0, Z); x1, y0 = tile(LAT1, LON1, Z); todo = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
if os.environ.get('LC_ONLY'): todo = []
if os.environ.get('REVERSE'): todo.reverse()      # a second copy can work from the other end
print(f'elevation: {len(todo)} tiles (x {x0}..{x1}, y {y0}..{y1})', flush=True); miss = 0
for i, (x, y) in enumerate(todo):
    out = os.path.join(ROOT, 'terrarium', f'{Z}_{x}_{y}.png')
    if os.path.exists(out): continue
    if not curl(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png', out): miss += 1; print('missing', x, y, flush=True)
    time.sleep(0.05)
    if i % 100 == 0: print(f'  {i}/{len(todo)}', flush=True)
print(f'elevation done, {miss} missing', flush=True)
blocks = [(lo, la) for la in range(LAT0, LAT1, 4) for lo in range(LON0, LON1, 4)]
if os.environ.get('REVERSE'): blocks.reverse()
if os.environ.get('ELEV_ONLY'): blocks = []
print(f'land cover: {len(blocks)} blocks', flush=True); miss = 0
for i, (lo, la) in enumerate(blocks):
    out = os.path.join(ROOT, 'landcover', f'lc_{lo}_{la}.tif')
    if os.path.exists(out): continue
    url = f'https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer/exportImage?bbox={lo},{la},{lo + 4},{la + 4}&bboxSR=4326&imageSR=4326&size=1024,1024&format=tiff&pixelType=U8&interpolation=RSP_NearestNeighbor&noData=0&f=image'
    if not curl(url, out): miss += 1; print('missing block', lo, la, flush=True)
    time.sleep(0.7)
    if i % 10 == 0: print(f'  {i}/{len(blocks)}', flush=True)
print(f'land cover done, {miss} missing', flush=True)

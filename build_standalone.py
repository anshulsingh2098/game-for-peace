"""Bundles the game into one HTML file (models and textures embedded) so it runs without a local server.
Needs internet only for three.js and the font."""
import re, base64

u = open('index.html', encoding='utf-8').read()
game = open('game.js', encoding='utf-8').read()
audio = open('audio.js', encoding='utf-8').read()
def b64(path, mime): return f'data:{mime};base64,' + base64.b64encode(open(path, 'rb').read()).decode()

# ---- split the page ----
head = u[u.index('<head>') + 6:u.index('</head>')]
body_start = u.index('<body>') + 6
imap_start = u.index('<script type="importmap">')
markup = u[body_start:imap_start]
importmap = re.search(r'<script type="importmap">.*?</script>', u, re.S).group(0)
main = re.search(r'<script type="module">(.*?)</script>', u, re.S).group(1)

# ---- modules -> plain blocks sharing one scope ----
main = re.sub(r"import \{ Sound, Radio \} from '\./audio\.js[^']*';\n?", '', main)
main = re.sub(r"import \{ Game \} from '\./game\.js[^']*';\n?", '', main)
game_body = re.sub(r"^import .*?;\n", '', game, flags=re.M).replace('export class Game', 'class Game').replace('export const CLIM_NAME', 'const CLIM_NAME').replace('export const WX_NAME', 'const WX_NAME')
audio_body = audio.replace('export class Sound', 'class Sound').replace('export class Radio', 'class Radio')
assert 'export ' not in game_body and 'export ' not in audio_body, 'leftover export'

# ---- embedded assets ----
glb = {k: b64(p, 'model/gltf-binary') for k, p in (('assets/car_01_gt.glb?v=2', 'assets/car_01_gt.glb'), ('assets/truck_01.glb?v=2', 'assets/truck_01.glb'), ('assets/bike_01.glb?v=2', 'assets/bike_01.glb'))}
for k, v in glb.items():
    assert f"file:'{k}'" in main, k
    main = main.replace(f"file:'{k}'", f"file:'{v}'")
old = "fetch(v.file).then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer()})"
assert old in main
main = main.replace(old, "Promise.resolve(dataBuf(v.file))")
assert "'assets/car_01_livery_mask.png'" in main
main = main.replace("'assets/car_01_livery_mask.png'", "'" + b64('assets/car_01_livery_mask.png', 'image/png') + "'")
helper = "function dataBuf(u){const s=atob(u.split(',')[1]),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a.buffer}\n"

script = ("import * as THREE from 'three';\n"
          "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';\n"
          "import { OrbitControls } from 'three/addons/controls/OrbitControls.js';\n"
          "import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';\n"
          "import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';\n" + helper +
          "const { Sound, Radio } = (() => {\n" + audio_body + "\nreturn { Sound, Radio };\n})();\n"
          "const { Game } = (() => {\n" + game_body + "\nreturn { Game };\n})();\n" +
          re.sub(r"^import .*?;\n", '', main, flags=re.M))

# full document (double-click it) and an artifact fragment (no doctype / html / head / body tags)
full = '<!doctype html>\n<html lang="en">\n<head>' + head + '</head>\n<body>' + markup + importmap + '\n<script type="module">\n' + script + '\n</script>\n</body>\n</html>\n'
open('game_standalone.html', 'w', encoding='utf-8').write(full)
frag = head.replace('<meta charset="utf-8">', '').replace(re.search(r'<meta name="viewport"[^>]*>', head).group(0), '') + markup + importmap + '\n<script type="module">\n' + script + '\n</script>\n'
open('game_artifact.html', 'w', encoding='utf-8').write(frag)
print(len(full) // 1024, 'KB')

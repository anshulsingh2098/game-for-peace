"""Adds MP3 songs to the radio.
Usage: python add_songs.py <folder | list.json> [station name]
  - a folder: every .mp3 / .m4a inside it
  - a .json file: a list of file paths
Copies each song into music/, skips exact duplicates, builds music/playlist.json from the file names ("Artist - Title.mp3")
and removes the placeholder tones."""
import sys, os, re, json, shutil, glob, hashlib

def lp(p):                       # long-path safe on Windows (this folder's path is very long)
    p = os.path.abspath(p)
    pre = '\\\\?\\'
    return pre + p if os.name == 'nt' and not p.startswith(pre) else p

src = sys.argv[1]; station = sys.argv[2] if len(sys.argv) > 2 else 'Game for Peace Radio'
if src.lower().endswith('.json'): files = json.load(open(src, encoding='utf-8'))
else: files = glob.glob(os.path.join(src, '*.mp3')) + glob.glob(os.path.join(src, '*.m4a'))
os.makedirs('music', exist_ok=True)
for old in glob.glob('music/test-*.wav'): os.remove(old)               # placeholder tones
for old in glob.glob('music/*.mp3') + glob.glob('music/*.m4a'): os.remove(lp(old))   # start clean so the folder matches the playlist

def clean(name):
    name = re.sub(r'\.(mp3|m4a)$', '', name, flags=re.I)
    name = re.sub(r'^AudioTranscriberAI_', '', name)
    name = name.replace('✧', ' ')
    name = re.sub(r'[\s_]+', ' ', name).strip()
    name = re.sub(r'^\d{1,3}[\s.\-_)]+', '', name)                       # leading track number
    name = re.sub(r'\s*[\(\[](official|lyrics?|audio|video|hd|hq|music video)[^\)\]]*[\)\]]', '', name, flags=re.I)
    return re.sub(r'\s+', ' ', name).strip(' -')

tracks, seen = [], set()
for path in sorted(files, key=lambda p: os.path.basename(p).lower()):
    base = os.path.basename(path); h = hashlib.md5(open(lp(path), 'rb').read()).hexdigest()
    if h in seen: print('skipped duplicate:', base); continue
    seen.add(h)
    safe = re.sub(r'[^A-Za-z0-9._-]+', '_', base)
    shutil.copy2(lp(path), lp(os.path.join('music', safe)))
    label = clean(base)
    artist, title = label.split(' - ', 1) if ' - ' in label else ('', label)
    tracks.append({'title': title.strip(), 'artist': artist.strip(), 'file': 'music/' + safe})
    print(f'{os.path.getsize(lp(path)) / 1e6:5.1f} MB  {artist.strip() or "(no artist)"}  -  {title.strip()}')
json.dump({'stations': [{'name': station, 'tracks': tracks}]}, open('music/playlist.json', 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
print(len(tracks), 'songs ->', 'music/playlist.json', '|', round(sum(os.path.getsize(lp('music/' + os.path.basename(t['file']))) for t in tracks) / 1e6, 1), 'MB total')

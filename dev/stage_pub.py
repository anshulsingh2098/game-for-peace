import json, os, shutil
def lp(p):
    p = os.path.abspath(p); pre = '\\\\?\\'
    return pre + p if os.name == 'nt' and not p.startswith(pre) else p
PUB = r"C:\Users\ANSHUL~1\AppData\Local\Temp\claude\d8d950da29d310cd\4d180b84-127e-423e-85b8-1e0eb01c3ea9\scratchpad\pub"
os.makedirs(os.path.join(PUB, 'music'), exist_ok=True)
pl = json.load(open('music/playlist.json', encoding='utf-8'))
tr = pl['stations'][0]['tracks']; tot = 0; a = []; b = []
for i, t in enumerate(tr, 1):
    src = t['file']; ext = os.path.splitext(src)[1]; new = f'music/{i:02d}{ext}'
    shutil.copy2(lp(src), os.path.join(PUB, new)); sz = os.path.getsize(os.path.join(PUB, new))
    t['file'] = new; (a if tot < 31e6 else b).append(new); tot += sz
json.dump(pl, open(os.path.join(PUB, 'music', 'playlist.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
shutil.copy2('game_artifact.html', os.path.join(PUB, 'game.html'))
tt = lambda L: round(sum(os.path.getsize(os.path.join(PUB, x)) for x in L) / 1e6, 1)
print(PUB); print('A', json.dumps(a)); print('B', json.dumps(b)); print(tt(a), tt(b), 'MB')

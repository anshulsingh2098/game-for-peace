"""Builds the Cloudflare deploy folder from the project, replacing hand copying.
Usage: python tools/stage_cloudflare.py [--out <folder>] [--dry-run]
Default output is cloudflare/public. Copies the pages, scripts, three.js, models, textures and the radio
playlist and songs; leaves out Blender sources, dev files and backups. Files in the output that are no
longer part of the site are removed, so the folder always mirrors the project."""
import os, sys, shutil, filecmp

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ['index.html', 'next.html', 'game.js', 'audio.js']                      # single files, if present
TREES = {                                                                      # folder -> allowed extensions
    'src': {'.js'}, 'vendor': {'.js', '.mjs', '.txt', ''}, 'assets': {'.glb', '.png', '.jpg', '.webp'},
    'music': {'.json', '.mp3', '.m4a', '.ogg'},
}

def lp(p):                                                                     # long-path safe on Windows
    p = os.path.abspath(p); pre = '\\\\?\\'
    return pre + p if os.name == 'nt' and not p.startswith(pre) else p

def wanted():
    out = [f for f in FILES if os.path.isfile(os.path.join(ROOT, f))]
    for tree, exts in TREES.items():
        for d, _, names in os.walk(os.path.join(ROOT, tree)):
            for n in names:
                if os.path.splitext(n)[1].lower() in exts:
                    out.append(os.path.relpath(os.path.join(d, n), ROOT).replace('\\', '/'))
    return sorted(out)

def main():
    args = sys.argv[1:]; dry = '--dry-run' in args
    out = os.path.abspath(args[args.index('--out') + 1]) if '--out' in args else os.path.join(ROOT, 'cloudflare', 'public')
    files = wanted(); keep = set(files); copied = same = removed = 0
    for rel in files:
        src, dst = os.path.join(ROOT, rel), os.path.join(out, rel)
        if os.path.isfile(lp(dst)) and filecmp.cmp(lp(src), lp(dst), shallow=False): same += 1; continue
        copied += 1
        if not dry: os.makedirs(lp(os.path.dirname(dst)), exist_ok=True); shutil.copy2(lp(src), lp(dst))
    for d, _, names in os.walk(out):
        for n in names:
            rel = os.path.relpath(os.path.join(d, n), out).replace('\\', '/')
            if rel not in keep:
                removed += 1; print('  remove', rel)
                if not dry: os.remove(lp(os.path.join(d, n)))
    size = sum(os.path.getsize(lp(os.path.join(ROOT, f))) for f in files) / 1e6
    print(f'{"would stage" if dry else "staged"} {len(files)} files ({size:.1f} MB) to {out}: {copied} copied, {same} unchanged, {removed} removed')

if __name__ == '__main__':
    main()

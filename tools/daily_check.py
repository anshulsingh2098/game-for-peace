"""Start-of-day check: runs every automatic check in CHECKLIST.md and prints PASS / WARN / FAIL for each.
Usage: python tools/daily_check.py          (from anywhere; needs git, node and python on the path)
It changes no project file and makes no commits or deploys; the one thing it updates is git's own record of the remote branches (`git fetch`), so it can say whether you are behind. The manual checks (looking at the game, a phone) are in CHECKLIST.md."""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = []

def run(*cmd, timeout=300):
    try:
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout + r.stderr).strip()
    except Exception as e:
        return 1, str(e)

def note(level, name, detail=''):
    rows.append((level, name, detail)); print(f'{level:5} {name}' + (f'  ({detail})' if detail else ''), flush=True)

# 1. git
code, branch = run('git', 'branch', '--show-current'); note('PASS' if code == 0 else 'FAIL', 'git works', branch or 'detached')
run('git', 'fetch', '--all', '--prune', '-q')
code, out = run('git', 'rev-list', '--left-right', '--count', 'HEAD...@{upstream}')
if code == 0:
    ahead, behind = (int(x) for x in out.split())
    note('PASS' if behind == 0 else 'WARN', 'branch is up to date with its remote', f'{behind} behind, {ahead} ahead' + ('' if behind == 0 else ': run git pull or /sync'))
else:
    note('WARN', 'branch has no remote to compare with', 'push it, or switch to main')
code, out = run('git', 'status', '--short'); changed = [l for l in out.splitlines() if l.strip()]
note('PASS' if not changed else 'WARN', 'nothing uncommitted', f'{len(changed)} changed files' if changed else '')
code, out = run('git', 'log', '-1', '--format=%h %s', 'origin/main'); note('PASS' if code == 0 else 'WARN', 'main on GitHub', out[:70])

# 1b. the release file list must hold what the game fetches at run time (audit R01)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
try:
    import stage_cloudflare
    staged = set(stage_cloudflare.wanted()); need = [f for f in ('assets/india/terrain.bin', 'assets/india/terrain.json', 'assets/cities/delhi/ATTRIBUTION.txt', 'licenses.html') if os.path.isfile(os.path.join(ROOT, f))]
    missing = [f for f in need if f not in staged]
    note('PASS' if not missing else 'FAIL', 'stage script includes terrain, data and attribution files', ', '.join(missing) if missing else f'{len(staged)} files')
except Exception as e:
    note('WARN', 'stage script check', str(e)[:80])

# 2. self-test
code, out = run('node', 'tools/selftest.mjs')
m = re.search(r'(\d+) checks passed', out)
note('PASS' if code == 0 and m else 'FAIL', 'self-test', (m.group(1) + ' checks passed') if m else out.splitlines()[-1][:120] if out else 'no output')

# 2b. vehicle acceptance numbers (acceleration, braking, cornering, handbrake, surfaces, hill, repeatability, telemetry) for car, truck and bike
code, out = run('node', 'tools/vehicle_acceptance.mjs', '--check', timeout=900)
note('PASS' if code == 0 and 'no problems found' in out else 'FAIL', 'vehicle acceptance (car, truck, bike)', 'no problems found' if 'no problems found' in out else ' | '.join(l.strip() for l in out.splitlines() if l.strip() and not l.startswith('{'))[:140])

# 3. every location still builds a road (and report bridge and tunnel share)
code, out = run('node', 'tools/locations_check.mjs', timeout=600)
bad = [l for l in out.splitlines() if 'ROAD FAILED' in l]
radii = [float(x) for l in out.splitlines() if not l.startswith('himalayas') for x in re.findall(r'min radius (\d+) m', l)]
note('FAIL' if bad or code else 'PASS', 'every location builds a road', f'{len(bad)} failed' if bad else f'{len(out.splitlines())} location/seed pairs')
if radii:
    tight = [r for r in radii if r < 60]
    note('PASS' if not tight else 'WARN', 'no bend tighter than 60 m (Himalayas excluded: they set their own limit)', f'tightest {min(radii):.0f} m')

# 4. deploy folder matches the project
code, out = run(sys.executable, 'tools/stage_cloudflare.py', '--dry-run'); m = re.search(r'(\d+) copied.*?(\d+) removed', out)
if m and m.group(1) == '0' and m.group(2) == '0': note('PASS', 'cloudflare/public matches the project (deploy folder is current)')
elif m: note('WARN', 'cloudflare/public is out of date', f'{m.group(1)} would be copied, {m.group(2)} removed: run python tools/stage_cloudflare.py before a deploy')
else: note('FAIL', 'stage_cloudflare.py dry run', out[-120:])

# 5. size budget
def size(d):
    return sum(os.path.getsize(os.path.join(a, f)) for a, _, fs in os.walk(os.path.join(ROOT, d)) for f in fs) / 1e6 if os.path.isdir(os.path.join(ROOT, d)) else 0
assets, vendor = size('assets') - size('assets/cities'), size('vendor')                         # city packs stream per 1 km tile, never downloaded whole (docs/CITY_PACK.md section 4)
note('PASS' if assets < 30 else 'WARN', 'assets folder under 30 MB (phones download this; city packs excluded)', f'{assets:.1f} MB')
note('PASS' if vendor < 15 else 'WARN', 'vendor folder under 15 MB', f'{vendor:.1f} MB')

# 6. every asset folder is credited in assets/ASSETS.md
try:
    credits = open(os.path.join(ROOT, 'assets', 'ASSETS.md'), encoding='utf-8').read()
    folders = [d for d in sorted(os.listdir(os.path.join(ROOT, 'assets'))) if os.path.isdir(os.path.join(ROOT, 'assets', d))]
    missing = [d for d in folders if d + '/' not in credits]
    note('PASS' if not missing else 'FAIL', 'every assets/ folder has a source and licence line in ASSETS.md', ('missing: ' + ', '.join(missing)) if missing else f'{len(folders)} folders')
except OSError:
    note('FAIL', 'assets/ASSETS.md exists')

# 7. team logs: entries still open
for who in ('a', 'b'):
    p = os.path.join(ROOT, 'team', f'stream-{who}.md')
    if os.path.exists(p):
        t = open(p, encoding='utf-8').read(); open_n = len(re.findall(r'^Status: open', t, flags=re.M))
        note('PASS' if open_n == 0 else 'WARN', f'team/stream-{who}.md has no open entries', f'{open_n} open' if open_n else '')

fails = sum(1 for r in rows if r[0] == 'FAIL'); warns = sum(1 for r in rows if r[0] == 'WARN')
print(f'\n{len(rows) - fails - warns} passed, {warns} warnings, {fails} failed.' + ('  Now do the manual checks in CHECKLIST.md.' if not fails else '  Fix the failures first.'))
sys.exit(1 if fails else 0)

# Sampled GitHub Repository Audit — read only

**Repository:** ans hulsingh2098/game-for-peace (remove space in owner); public, default branch `main`; GitHub connector reports read and push permissions. No repository mutation was performed.

## Inspected files (GitHub connector, current default branch)
- `PARALLEL_PLAN.md`: explicitly says `docs/STATUS.md` is authoritative, `docs/DECISIONS.md` records owner decisions, Stream A owns roads/terrain/scenery/landmarks/world tools, Stream B owns vehicles/traffic/sound/menus/game. Earlier N0–N6 status is documented but is historical, not a current completion assessment.
- `tools/selftest.mjs`: imports core RNG/noise/config, terrain/tiledata, routing, India network, highways, traffic, Rapier vehicle, sector manager, regions, navgraph, district planning, keepouts and others. Existing systems must be reused instead of duplicated.
- `tools/daily_check.py`: checks Git state, deployment asset staging, tracker, self-tests, vehicle acceptance and other checks. It calls `git fetch`; treat as non-source mutation but network-affecting.
- `team/stream-a.md`: describes Connaught Place facade work, arcade lighting, streetlife and performance comparisons. Entries are dated 20–21 Nov 2026, **in the future relative to this report date**; verify commit metadata. Mentions PR 103, `src/world/city/cpfacade.js`, `tilemesh.js`, `streetlife.js`, `cityworld.js`, `docs/CP_MATCH_LOG.md`; these are claims from the log, not independently verified code changes.
- `team/stream-b.md`: describes vehicle physics, player exit animation, NPCs, audio and combined release work dated 17–18 Nov. Mentions `src/main.js`, `src/player/exitseq.js`, `src/pedestrians/pedestrians.js`, `assets/npc/*.glb`. This is a log, not an independently verified running build.
- `index.html`: existing game shell, canvas, mobile viewport handling and UI. Do not replace.
- `README.md` and root `package.json`: not found at those paths; this is not evidence the project has no documentation or dependencies.

## Verified findings
1. Existing game has named modules for world streaming/regions, traffic, roads and procedural environments; **do not introduce a parallel replacement engine**.
2. There is a documented ownership protocol. Integration should begin with a read-only status/PR review and a proposal assigned to Stream A for world/visual work.
3. CP appears to be an active development focus; parallel CP facade work would create merge collisions.
4. Existing selftest and daily-check are the correct baseline regression entry points. **Tests were not run in this audit** because a full checkout was unavailable.
5. No live Cloudflare visual comparison, FPS benchmark or device test was performed here.

## Unverified questions requiring full checkout
- Exact current branch/commit, open PRs, whether CP facade PR 103 is merged, code ownership for shared files.
- Actual accuracy of Delhi roads/buildings, source dataset quality and coordinate transforms.
- Asset attribution and licence compliance in deployed bundle.
- Terrain and tile streaming boundary behaviour, persistent world state and long-session memory.
- Test pass/fail status and browser/device performance.

## Non-interference protocol
1. Read `docs/STATUS.md`, `docs/DECISIONS.md`, `CLAUDE.md`, `HANDOFF.md`, `PARALLEL_PLAN.md`, `team/stream-a.md`, `team/stream-b.md`.
2. Record main SHA and open PR list; identify overlapping file ownership.
3. Work in an isolated branch/worktree, starting with documentation and data manifests only.
4. Prefer adding `research/delhi/*`, `assets/manifest/delhi/*` and standalone import scripts; do not edit `src/main.js`, `tilemesh.js`, `cityworld.js`, `cpfacade.js` without Stream A coordination.
5. Require deterministic tests and comparison screenshots; no direct deploy or merge.

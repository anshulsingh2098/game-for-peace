# Delhi Production Pack — 19 November 2026

This is a **research and integration handoff**, not a claim that licensed photographs or finished 3D meshes have been downloaded. The location register contains geospatial *targets*, not surveyed camera positions. The audit is a sampled read-only inspection, not a full repository build/test.

## Deliverables
- `visual_atlas.csv`: 45 location targets with approximate coordinates, intended views, modelling notes, verification state.
- `asset_registry.csv`: 70 asset specifications with production method, licensing and quality gates.
- `REPOSITORY_AUDIT.md`: evidence-based audit of sampled live GitHub files, integration boundaries and risks.
- `AGENT_IMPLEMENTATION.md`: isolated workflow, asset/data pipeline, tests and acceptance criteria.

## Immediate instructions
1. Read `docs/STATUS.md`, `docs/DECISIONS.md`, `CLAUDE.md`, `PARALLEL_PLAN.md` and current PRs before touching code. Files inspected here contain entries dated **20–21 Nov 2026**, later than the report date, so confirm Git timestamps and branch heads rather than assuming chronology.
2. Do not modify upstream `main`, deploy, or interfere with either stream. Prepare a separate branch/worktree only after reviewing ownership and obtaining approval.
3. Verify imagery rights individually. Reference-only URLs are not game texture licences.
4. Start with CP → India Gate reference viewpoints and asset prototypes, then expand to Old Delhi and residential archetypes.

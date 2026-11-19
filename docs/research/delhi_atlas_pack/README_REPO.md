# Delhi atlas and asset pack (research, not game code)

Received from the owner on 19 Nov 2026 (a research and integration handoff made outside the repo). It is stored here unchanged so every session can read it; nothing in it is wired into the game and no licence has been cleared for any image or asset it names.

- `visual_atlas.csv`: 50 places (the pack's README says 45) with approximate coordinates, the views to capture, modelling notes. Headings and image sources are blank (`UNSURVEYED`, `TO_SOURCE`): a blank heading is not a known heading.
- `asset_registry.csv`: 78 assets (the pack's README says 70) to build or source (`SPECIFIED_NOT_DOWNLOADED`), licence to be checked per asset.
- `REPOSITORY_AUDIT.md`: a sampled read-only audit written without a checkout. Its notes on ownership and non-interference match `CLAUDE.md`; its claims about our files are unverified (it also notes it ran no tests).
- `AGENT_IMPLEMENTATION.md`: the proposed workflow (reference viewpoints, geospatial importer, asset pipeline, acceptance gates).

How it fits: Stream A owns the Delhi world; ten matched viewpoints with permitted photos, per-asset provenance and a phone benchmark are the gates it proposes, and they agree with `docs/STATUS.md` (nothing is accepted until a person has looked at it on a device). The atlas coordinates are in lat/lon: convert with the pack origin (`assets/cities/delhi/manifest.json`) before using them with `window.__where` or `window.__cam`.

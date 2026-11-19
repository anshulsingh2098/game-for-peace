# Shared simulation interfaces: plan (audit R08, with R14, R15, R09, R10)

Decision (owner, 17 Nov 2026): **plan now, design in this order, build a step only when the next city needs it.** Nothing here replaces a working renderer. The India world and Delhi keep their own geometry code; what is shared is the contract each one satisfies, so a fix lands once.

## The problem
Delhi has its own streaming (`CityWorld` tiles), traffic (`CityTraffic`), pedestrians (`CityPeds`) and routing (`CityRouter`) beside the procedural world's `SectorManager`, `TrafficSim`, `PedSim` and `RoadNav`. Behaviour, failure handling and fixes drift apart, and every new city would multiply it.

## Order of design (each step: a short contract in `docs/`, then one pilot, then parity tests; stop after any step if nothing needs the next)
1. **Resource and streaming contract (first, it carries R04 and R10).** One shape for "a unit of the world loads, may fail, may be cancelled, releases everything": `load(unit, signal)` all-or-nothing (the pattern now in the sector loader), `unload(unit)`, retry with back-off, a byte count not only an entry count, an `AbortSignal` all the way to the fetch. `CityWorld` tile fetches adopt it; test: fail after each acquired part, refs return to zero.
2. **Navigation contract (R09, R14).** Same questions on both graphs: `route(from, to, agent)`, `nearest(x, z, layer)`, lane and layer semantics, turn restrictions, a per-call time budget so a long route is cooperative or runs in a worker. Measure first: cold-load parse of the 14.6 MB graph and the longest `plan` call, both on a real phone, before moving anything.
3. **Vehicle agent contract (R14, R12).** One description of an AI vehicle (shape, lane position, intent, leader gap, occupants) that both `TrafficSim` and `CityTraffic` fill in; decide on the record whether flyover and underpass traffic is wanted, then test ramps and layer changes.
4. **Pedestrian and actor contract (R13, R12).** Ambient walkers versus named, persistent characters (needed for N21 onward) are different things; define the second kind's identity, schedule and save state before any story work.
5. **Random streams (R15).** Every simulation owns a seeded random stream created from the world seed, never a module-level generator, so a replay does not depend on tile load order. Small and safe: can be done any time.

## Rules
- Each step is a Stream A and Stream B pair, in `team/` log entries, with the shared file reserved first (`CLAUDE.md`).
- A step is done when a headless test proves parity on both implementations, not when the contract is written.
- No step changes the driving fixed timestep without acceptance evidence.

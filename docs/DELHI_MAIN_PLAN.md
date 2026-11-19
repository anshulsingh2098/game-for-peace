# Delhi main region: phased plan (owner, 21 Nov 2026)

Owner's order: finish the **Delhi main region** first (a complete, accepted area), and only then apply the same kit to other parts of Delhi. Markings and look follow **real Delhi**, not GTA. Work in phases; each phase ends at a gate and nothing starts before its gate is passed.

**The main region** = the central tiles the game loads at the Connaught Place start (about 14 tiles, 5 by 3 km): Connaught Place with its two circles, the radial roads, Janpath and Barakhamba Road, Kartavya Path (Rajpath) and India Gate, the Lutyens' Delhi streets and roundabouts, Jantar Mantar and Palika Bazaar. Old Delhi (Chandni Chowk), Karol Bagh, Lajpat Nagar and the rest are the "other parts" and wait.

**Gate for every phase** (the same each time): (1) self-test green, from a clean `git archive`; (2) the change seen in the game at the six CP camera spots of `tools/cp_views.json` and written up in `docs/CP_MATCH_LOG.md` with an honest verdict; (3) frame times with a visible window at `q=med` and `q=high` against `main` (no phone yet, see phase 8); (4) one PR from a branch off `main`; (5) the owner's yes before it is merged.

## Decisions taken
- 21 Nov 2026: markings like real Delhi: white broken centre line on two-way roads (a double continuous yellow only for no-overtaking stretches, which the map does not give, so off), white solid edge lines on main roads, black and white painted kerbs on main roads and medians, white zebra and stop lines, painted arrows at junctions. (The GTA double yellow and red kerb are dropped.)
- Real place names as lettering only; no copied logos or trade dress (19 Nov).
- Overhead wires: real Delhi's NDMC area (Connaught Place, Lutyens' Delhi) has its cables underground and a clean look; overhead wires and tangles belong to the markets, Old Delhi and villages. The code already follows this (no wires where there are lamp posts).

## Phases
1. **Markings and kerbs like Delhi** (done in this branch): switch the double yellow off, black and white kerbs. Gate: the six spots.
2. **Facade completion** (CP blocks): a CP facade texture kit with arched window heads, green or brown shutters, window surrounds and balcony rails, aligned to the real storey height (the string courses are every 4.0 m, the texture storeys are 3.2 m: align them); balustrade posts under the drum windows; paired columns at the drum corners; a deeper entablature under the roof edge. Gate: the facade matches photos R1 to R4 at spots 1 to 4 (owner scores).
3. **Light**: warm light on the column shafts and walls near each soffit panel at night; the street lamp pools checked on a road; the dusk grade tuned (dusk looks nearly like day now). Gate: night and dusk at spots 2 and 4.
4. **Wet reflections on the paving** (night): coloured reflections of the boards on the plaza (a glow tinted by the board above, fading with distance), a lower roughness at night. Gate: spot 4.
5. **Pavements and surroundings**: wider pavements on the circles and Janpath, planting strips with clipped hedges and palms (needs the palm, phase 7), median kerbs, bus shelters; keep wires out of NDMC. Gate: spots 3 and 5.
6. **Region by area rules**: apply the same kits to the Lutyens' Delhi streets (cream bungalows, hedges, roundabouts) and the Kartavya Path and India Gate avenue by `identity.js` area, so the whole main region is one consistent place. Gate: six new camera spots for those areas, written like `cp_views.json`.
7. **Licensed assets**: cars, people, trees (neem, peepal, jamun, gulmohar, palms), hedges, kiosks and stalls to replace the placeholders; each source and licence recorded in `assets/ASSETS.md`; own models made in Blender where no free one fits. Needs the owner's yes for each download (file name, source, size stated first). Gate: a table of what replaced what and the cost in triangles and megabytes.
8. **Performance and acceptance**: a phone benchmark (`q=low` and `q=med`), a second desktop, repeated runs; the owner scores the main region at the twelve spots; deploy to the owner's account only on the owner's yes.
9. **Only then**: the same kit for Old Delhi, Karol Bagh, Lajpat Nagar and the rest.

## What is already done and merged (PRs 101, 102, 103)
Smooth circles, wider lanes, markings and arrows, worn asphalt by area, signs and live signal heads, round columns, brand boards, drum corners, blade signs, soffit lights, light pools; frame times equal to `main` on a desktop. Not done: everything in phases 2 to 9 above, plus a phone measurement and the owner's acceptance.

## Asset research for phase 7 (21 Nov 2026, web search only; nothing downloaded)
Sources checked and what they say (verify the licence on each download page before use):
- **Auto-rickshaw (the most Delhi-specific vehicle):** no CC0 model found. The tuk-tuk models that turned up are paid royalty-free listings (CGTrader, RenderHub, Superhive) or free with an unstated or Sketchfab Standard licence (not CC0). Decision needed: build our own in Blender (own work, no licence issue) rather than buy.
- **Palms:** Poly Haven (whole library CC0) had no palm in the search; OpenGameArt "Exotic palms, lowpoly style" is CC0 (a .blend with parts for LODs, plus .fbx), a low-poly look; paid date palms (RenderHub, CGTrader) are commercial licences, not CC0. Own palm in Blender is the cleaner route.
- **Cars:** Quaternius' low-poly cars (itch.io and OpenGameArt) are CC0, pay-what-you-want, from 2018, style: low-poly; Kenney's Car Kit v2 is CC0 (3.4 MB zip, OBJ, FBX, glTF), toy-like style. Neither looks like a photoreal Delhi taxi or Maruti; they are placeholders of a different kind, not replacements for the current traffic pack.
- **People:** Quaternius' Universal Base Characters are CC0 (6 models, male and female), stylised proportions.
- **Honest limit:** free CC0 libraries are low-poly or toy-style; the "photoreal, GTA-like" target needs our own models (Blender is connected) or paid assets; paid assets need the owner's decision. Plan: make in Blender the auto-rickshaw, a Delhi palm, the chai and juice kiosk, the street bench and the stone stool of photo R1; keep the current cars and people until a better set exists.

# Weather and time visual matrix (Master Plan N2)

Checked on 15 November 2026 on a desktop (1280 x 720, California coast, seed `peace`, medium tier), by screenshot, with the weather and time set directly. This is a record of what was looked at, not a sign-off: nobody has judged it on a phone or on other screens.

| | Dawn | Day | Dusk | Night |
|---|---|---|---|---|
| Clear | not captured | good | warm purple sky, readable | dark but readable, headlight pool ahead, stars |
| Overcast | not captured | good (grey, soft) | not captured | not captured |
| Fog | not captured | distance fades, hills pale out | not captured | not captured |
| Rain | not captured | muted colour, darker, wet road, light streaks | not captured | very dark, road still readable, rain visible in the headlights |
| Storm | not captured | dark grey, heavy fog (284 m), hills fade, rain streaks | not captured | not captured |
| Snow | not captured | white ground, flakes | not captured | blue-lit, readable, flakes |

**What was fixed in this pass (`src/env/environment.js`, `src/fx/grade.js`):** before, rain and storm at midday looked almost like clear weather (the sky reflection light stayed at full strength, the ground barely darkened, the fog was thin, and the colour grade made the picture more vivid, not less). Now bad weather lowers the sky reflection light (`scene.environmentIntensity = 1 - 0.55 * dark`), lowers the sky hemisphere light more, darkens the wet ground to 66%, has denser fog (overcast 0.75, rain 0.42, storm 0.28, snow 0.32 of the clear-day distance) and the grade fades colour and brightness with the weather (`applyLook(canvas, on, dark)`).

**White paint** (`Paint_Body` set to white, clear midday sun): only 1.1% of the bright pixels on the car are fully clipped; the body shows its shape. The "white paint glares to a white blob" defect is not reproduced after the lighting and clearcoat changes. Check it on a phone screen.

**Not yet covered:** dawn in any weather, overcast/fog/storm at dusk and night, tunnel and bridge interiors at night and in rain, every location (only California was captured), the low and high tiers. Tunnel precipitation and sound are tested separately (`HANDOFF.md`, tunnel signal).

## Location smoke test (Master Plan N3 gate, 16 November 2026)

Each location was regenerated on seed `peace` (medium tier, desktop), the car placed on the road, and the autodrive left on for 12 seconds with traffic Light. A smoke test only: about 210 m of road each, not a full drive.

| Location | Autodrive stayed on | End speed | Surface | Traffic keeps | Cars | Landmarks | Errors |
|---|---|---|---|---|---|---|---|
| Green Valley | yes | 69 km/h | asphalt | right | 6 | none | 0 |
| The Alps | yes | 69 km/h | asphalt | right | 6 | none | 0 |
| The Himalayas | yes | 75 km/h | asphalt | right | 6 | none | 0 |
| California Coast | yes | 69 km/h | asphalt | right | 5 | none | 0 |
| Southern Coast | yes | 69 km/h | asphalt | right | 6 | none | 0 |
| Mumbai | yes | 70 km/h | asphalt | left | 6 | Marine Drive, Gateway of India, Taj Hotel | 0 |
| Delhi | yes | 70 km/h | asphalt | left | 6 | India Gate | 0 |
| Agra | yes | 70 km/h | asphalt | left | 6 | Taj Mahal | 0 |

This test found a real conflict between two features: the autodrive followed the road's centre line and had no idea traffic existed, so it drove into the back of slower cars and stopped. It now keeps to a lane and follows the car in front at a safe gap (`Autodrive.lane`, `Autodrive.leader`, tested headless with a slow truck for 90 s on both driving sides: no hits, lane kept, gap 14 to 16 m).

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

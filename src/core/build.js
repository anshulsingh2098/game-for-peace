/* Which game this is (docs/LITE_AND_FULL_PLAN.md): 'lite' = the browser game, Delhi only; 'full' = every map, the downloadable game.
   Lite is the default. `?build=full` opens the full game from a source tree that has all the files (development; the Lite deploy leaves the India files out, tools/stage_cloudflare.py).
   Nothing is deleted for Lite: the India map, the other cities and their menus are simply never started or listed. */
export const BUILD = (typeof location !== 'undefined' && /[?&]build=full(&|$)/.test(location.search || '')) ? 'full' : 'lite';
export const LITE = BUILD === 'lite';

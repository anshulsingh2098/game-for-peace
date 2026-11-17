/* Colour grade: a cheap "cinematic" look laid over the game canvas without a post-processing pass of our own.
   A CSS filter (contrast, saturation, brightness) on the canvas and a soft vignette overlay. Numbers live in LOOK so the tuner can change them (root "look").
   Off on the low quality tier (phones): the filter costs a little GPU time on every frame. */
export const LOOK = { contrast: 1.1, saturate: 1.14, brightness: 0.98, vignette: 0.32 };

let veil = null;
export function applyLook(canvas, on = true, dark = 0) {          // dark: 0 fair weather .. 1 storm; the grade fades colour and brightness in bad weather, so storms look grey, not vivid
  if (!canvas) return;
  if (!veil) { veil = document.createElement('div'); veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1'; canvas.parentNode.insertBefore(veil, canvas.nextSibling); }
  if (!on) { canvas.style.filter = ''; veil.style.background = ''; return; }
  const f = `contrast(${LOOK.contrast}) saturate(${(LOOK.saturate * (1 - 0.45 * dark)).toFixed(3)}) brightness(${(LOOK.brightness * (1 - 0.1 * dark)).toFixed(3)})`; if (canvas.style.filter !== f) canvas.style.filter = f;
  veil.style.background = LOOK.vignette > 0 ? `radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 55%, rgba(8,10,16,${LOOK.vignette}) 100%)` : '';
}

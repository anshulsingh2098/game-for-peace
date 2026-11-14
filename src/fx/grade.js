/* Colour grade: a cheap "cinematic" look laid over the game canvas without a post-processing pass of our own.
   A CSS filter (contrast, saturation, brightness) on the canvas and a soft vignette overlay. Numbers live in LOOK so the tuner can change them (root "look").
   Off on the low quality tier (phones): the filter costs a little GPU time on every frame. */
export const LOOK = { contrast: 1.1, saturate: 1.14, brightness: 0.98, vignette: 0.32 };

let veil = null;
export function applyLook(canvas, on = true) {
  if (!canvas) return;
  if (!veil) { veil = document.createElement('div'); veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1'; canvas.parentNode.insertBefore(veil, canvas.nextSibling); }
  if (!on) { canvas.style.filter = ''; veil.style.background = ''; return; }
  canvas.style.filter = `contrast(${LOOK.contrast}) saturate(${LOOK.saturate}) brightness(${LOOK.brightness})`;
  veil.style.background = LOOK.vignette > 0 ? `radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 55%, rgba(8,10,16,${LOOK.vignette}) 100%)` : '';
}

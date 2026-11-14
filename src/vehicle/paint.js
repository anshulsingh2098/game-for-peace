/* Paint: recolours a vehicle model. The car has a livery (stripes) drawn through a mask image; the truck and
   bike simply have named paint materials. Carried over from the current game's garage.
   Clones of a model share its materials, so painting the loaded model repaints every copy of it. */
import * as THREE from 'three';

let mask = null, liveryTex = null;
const SILVER = [206, 211, 218];                                 // the car body colour under the stripes

async function paintLivery(def, model, hex) {
  if (!mask) {
    const img = new Image(); img.src = def.paint.mask; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    mask = { w: img.width, h: img.height, d: cx.getImageData(0, 0, img.width, img.height).data, out: document.createElement('canvas') }; mask.out.width = mask.w; mask.out.height = mask.h;
  }
  const col = new THREE.Color(hex), B = [col.r, col.g, col.b].map(l => Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055)));
  const cx = mask.out.getContext('2d'), im = cx.createImageData(mask.w, mask.h), m = mask.d, o = im.data;
  for (let i = 0; i < m.length; i += 4) { const a = m[i] / 255; o[i] = SILVER[0] + (B[0] - SILVER[0]) * a; o[i + 1] = SILVER[1] + (B[1] - SILVER[1]) * a; o[i + 2] = SILVER[2] + (B[2] - SILVER[2]) * a; o[i + 3] = 255; }
  cx.putImageData(im, 0, 0);
  if (!liveryTex) {
    liveryTex = new THREE.CanvasTexture(mask.out); liveryTex.flipY = false; liveryTex.colorSpace = THREE.SRGBColorSpace; liveryTex.anisotropy = 4;
    model.traverse(n => { if (n.isMesh) [].concat(n.material).forEach(mt => { if (mt.name === 'Paint_Livery') { mt.map = liveryTex; mt.needsUpdate = true; } }); });
  } else liveryTex.needsUpdate = true;
}

/* def: a vehicle from defs.js; model: the scene returned by loadModel(def); hex: '#rrggbb' */
export async function applyPaint(def, model, hex) {
  if (def.paint.mask) return paintLivery(def, model, hex);
  if (!model.userData.paintMats) { const list = model.userData.paintMats = []; model.traverse(n => { if (n.isMesh) [].concat(n.material).forEach(m => { if (def.paint.names.includes(m.name) && !list.includes(m)) list.push(m); }); }); }
  for (const m of model.userData.paintMats) m.color.set(hex);
}

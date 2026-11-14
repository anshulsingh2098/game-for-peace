/* Realism pipeline (R0 of team/photoreal-plan.md): the scene is drawn into a multisampled half-float target, then ambient occlusion darkens the
   creases and contact shadows the sun map cannot, a light bloom lets bright sky and lamps glow, and OutputPass applies tone mapping and colour space.
   Off by default; switch on with ?fx=1. Quality tiers: fx=1 (all), fx=lite (no ambient occlusion). The plain renderer path stays for phones. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

/* a real photographed sky, as image-based light and reflections (resolves to a PMREM texture, or null if it cannot load) */
export function loadSkyLight(renderer, url) {
  return new Promise(res => new HDRLoader().load(url, tex => { tex.mapping = THREE.EquirectangularReflectionMapping; const rt = new THREE.PMREMGenerator(renderer).fromEquirectangular(tex); tex.dispose(); res(rt.texture); }, undefined, () => res(null)));
}

export function createFx(renderer, scene, camera, mode = '1') {
  const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio(), w = Math.max(2, size.x * pr), h = Math.max(2, size.y * pr);
  const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target); composer.setPixelRatio(pr); composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));
  let ao = null;
  if (mode !== 'lite') {
    ao = new GTAOPass(scene, camera, size.x, size.y); ao.output = GTAOPass.OUTPUT.Default;
    ao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.6, thickness: 1, scale: 0.8, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    ao.blendIntensity = 0.5; composer.addPass(ao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.05, 0.4, 2.5); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    composer, ao, bloom,
    render() { composer.render(); },
    setSize(wd, ht) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(wd, ht); },
    dispose() { composer.dispose(); target.dispose(); }
  };
}

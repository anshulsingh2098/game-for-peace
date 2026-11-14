/* Realism pipeline (R0 of team/photoreal-plan.md): the scene is drawn into a multisampled half-float target, then ambient occlusion darkens the
   creases and contact shadows the sun map cannot, a light bloom lets bright sky and lamps glow, and OutputPass applies tone mapping and colour space.
   Off by default; switch on with ?fx=1. Quality tiers: fx=1 (all), fx=lite (no ambient occlusion). The plain renderer path stays for phones. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createFx(renderer, scene, camera, mode = '1') {
  const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio(), w = Math.max(2, size.x * pr), h = Math.max(2, size.y * pr);
  const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target); composer.setPixelRatio(pr); composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));
  let ao = null;
  if (mode !== 'lite') {
    ao = new GTAOPass(scene, camera, size.x, size.y); ao.output = GTAOPass.OUTPUT.Default;
    ao.updateGtaoMaterial({ radius: 4, distanceExponent: 1.4, thickness: 2, scale: 1.1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    ao.blendIntensity = 0.9; composer.addPass(ao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.14, 0.5, 1.4); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    composer, ao, bloom,
    render() { composer.render(); },
    setSize(wd, ht) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(wd, ht); },
    dispose() { composer.dispose(); target.dispose(); }
  };
}

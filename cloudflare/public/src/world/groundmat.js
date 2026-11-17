/* The ground material (R1 of team/photoreal-plan.md): real photographic grass, rock, snow and sand (ambientCG, CC0, assets/ground) blended per pixel.
   The terrain's own vertex colour still says what kind of ground a place is (green, dry, snowy: set by the palette), so every location keeps its
   character; the photos supply the detail. Weights: rock on steep slopes, sand near the sea, snow where the palette says snow, grass elsewhere.
   Textures are sampled by position with periods that divide the 128 m tile, so they stay seamless when the render origin moves. A second, much
   larger sample of the grass breaks up the repetition. */
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
function tex(name, srgb = true) {
  const t = loader.load(`assets/ground/${name}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* level 'full': two grass scales plus a macro sample, triplanar cliffs (about a dozen texture reads per pixel).
   level 'lite': one grass read, one rock read, one sand and one snow read: about 40% of the cost, for medium devices. */
export function makeGroundMaterial(level = 'full') {
  const lite = level === 'lite';
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.35 });
  const uniforms = {
    tGrass: { value: tex('grass_color') }, tRock: { value: tex('rock_color') }, tSnow: { value: tex('snow_color') }, tSand: { value: tex('sand_color') },
    tGrassN: { value: tex('grass_normal', false) }, tRockN: { value: tex('rock_normal', false) },
    uSea: { value: 0 }
  };
  const photo = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D tGrass; uniform sampler2D tRock; uniform sampler2D tSnow; uniform sampler2D tSand; uniform float uSea; varying vec3 vWP; varying vec3 vWN;
vec3 triRock(vec3 p, vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z); return texture2D(tRock, p.zy / 8.0).rgb * w.x + texture2D(tRock, p.xz / 8.0).rgb * w.y + texture2D(tRock, p.xy / 8.0).rgb * w.z; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 vc = vColor.rgb; float lum = dot(vc, vec3(0.3, 0.59, 0.11)); vec3 n = normalize(vWN);
  float slope = 1.0 - n.y, rockW = smoothstep(0.30, 0.52, slope), sandW = 1.0 - smoothstep(uSea + 1.6, uSea + 4.5, vWP.y), snowW = smoothstep(1.08, 1.4, lum) * (1.0 - rockW * 0.6);
  ${lite ? 'vec3 grass = texture2D(tGrass, vWP.xz / 2.0).rgb * 0.8; float macro = 1.0;' : `vec3 grass = texture2D(tGrass, vWP.xz / 2.0).rgb * 0.5 + texture2D(tGrass, vWP.xz / 8.0).rgb * 0.5; float gl = dot(grass, vec3(0.3, 0.59, 0.11)); grass *= pow(clamp(gl / 0.27, 0.25, 2.2), 0.9);       // finer grain, more contrast
  float macro = dot(texture2D(tGrass, vWP.xz / 64.0).rgb, vec3(0.33)) / 0.27;`}
  vec3 tint = clamp(vc / 0.62, 0.35, 1.6);
  vec3 g = grass * mix(vec3(1.0), tint, 0.75) * mix(1.0, macro, 0.45) * 2.5;
  vec3 sand = texture2D(tSand, vWP.xz / 8.0).rgb * mix(vec3(1.0), tint, 0.4) * 1.15;
  vec3 rock = ${lite ? 'texture2D(tRock, vec2(vWP.x + vWP.z * 0.7, vWP.y) / 8.0).rgb' : 'triRock(vWP, n)'} * mix(vec3(1.0), tint, 0.3) * 1.7;
  vec3 snow = texture2D(tSnow, vWP.xz / 8.0).rgb * 0.95;
  vec3 a = mix(g, sand, sandW); a = mix(a, rock, rockW); a = mix(a, snow, snowW);
  diffuseColor.rgb = a;
}`);
  };
  let installed = false;
  return {
    material, uniforms,
    /* call after env.attach: that also hooks onBeforeCompile (snow cover), so ours chains after it */
    install() { if (installed) return; installed = true; const prev = material.onBeforeCompile; material.onBeforeCompile = (sh, r) => { if (prev) prev.call(material, sh, r); photo(sh); }; material.needsUpdate = true; },
    setSea(y) { uniforms.uSea.value = y; }
  };
}

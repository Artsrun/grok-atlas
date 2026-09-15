export const EARTH_VERT = /* glsl */ `
attribute vec4 tangent;
uniform sampler2D uSpec;
uniform vec3 uMoon;
uniform vec3 uSun;
uniform float uTideAmp;
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;
varying float vTide;

void main() {
  vUv = uv;
  float ocean = texture2D(uSpec, uv).r;
  vec3 n = normalize(position);
  vec3 M = normalize(uMoon);
  vec3 S = normalize(uSun);
  float mu = dot(n, M);
  float su = dot(n, S);
  float lunar = 0.5 * (3.0 * mu * mu - 1.0);
  float solar = 0.5 * (3.0 * su * su - 1.0);
  float tide = (lunar + 0.46 * solar) * ocean;
  vTide = tide;
  vec3 displaced = position + n * tide * uTideAmp * 0.018;
  vec4 wp = modelMatrix * vec4(displaced, 1.0);
  vPos = wp.xyz;
  mat3 nm = mat3(modelMatrix);
  vNormal = normalize(nm * normal);
  vTangent = normalize(nm * tangent.xyz);
  vBitangent = normalize(cross(vNormal, vTangent) * tangent.w);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const EARTH_FRAG = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uSpec;
uniform sampler2D uNormal;
uniform sampler2D uAtlas;
uniform vec3 uSun;
/** Shared with the vertex stage, which uses it for the tide bulge. */
uniform vec3 uMoon;
/** Illuminated fraction of the disc, 0 new to 1 full. */
uniform float uMoonLit;
uniform vec3 uCamPos;
uniform float uAtlasMix;
uniform float uNightGain;
uniform float uBump;
uniform float uTideAmp;
uniform float uGrainLights;
uniform float uGrainRelief;

varying vec2 vUv;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;
varying float vTide;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/**
 * GRAIN_OCTAVES is a compile-time budget, not a branch: the mid tier links a
 * one-hash grain and never pays for octaves it cannot afford at 60.
 */
float grain2(vec2 uv) {
  float a = hash21(uv);
#if GRAIN_OCTAVES > 2
  float b = hash21(uv * 2.13 + 17.1);
  float c = hash21(uv * 4.71 + 9.2);
  return a * 0.55 + b * 0.30 + c * 0.15;
#elif GRAIN_OCTAVES > 1
  float b = hash21(uv * 2.13 + 17.1);
  return a * 0.66 + b * 0.34;
#else
  return a;
#endif
}

void main() {
  vec3 nMap = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
  nMap.xy *= uBump;
  vec3 nTex = nMap;
  if (uGrainRelief > 0.001) {
    float rx = grain2(vUv * 420.0);
    float ry = grain2(vUv.yx * 310.0 + 8.1);
    nTex.xy += vec2(rx - 0.5, ry - 0.5) * uGrainRelief * 0.72;
  }
  mat3 tbn = mat3(normalize(vTangent), normalize(vBitangent), normalize(vNormal));
  vec3 N = normalize(tbn * nTex);
  /**
   * The sun glint reads off the relief alone. Grain belongs in the diffuse,
   * where it is film; in a 48-power highlight it is a field of white static
   * scattered across half an ocean.
   */
  vec3 Nspec = normalize(tbn * nMap);
  vec3 V = normalize(uCamPos - vPos);
  vec3 L = normalize(uSun);
  vec3 H = normalize(L + V);

  float ndl = dot(N, L);
  /**
   * The terminator rides the geometric normal, never the bumped one. Relief —
   * and the heavy grain injected into it — was chewing the day/night line into
   * speckle and making the city lights flicker on ridges that are a normal map,
   * not a horizon.
   */
  vec3 gN = normalize(vNormal);
  float geo = dot(gN, L);
  // Wide enough to read as twilight, tighter than the old ramp, which had to
  // double as the lamp timer and so smeared the line to cover for it.
  float dayStrength = smoothstep(-0.20, 0.42, geo);
  /** Solar elevation, degrees. Close enough at this scale for a lamp timer. */
  float sunEl = degrees(asin(clamp(geo, -1.0, 1.0)));
  /**
   * Lamps come up through civil twilight and are full by nautical dark, rather
   * than cross-fading against daylight — a city is not half-lit at noon.
   */
  float lampOn = 1.0 - smoothstep(-8.0, 2.0, sunEl);

  vec3 dayC = texture2D(uDay, vUv).rgb;
  vec3 nightC = texture2D(uNight, vUv).rgb;
  float lum = max(nightC.r, max(nightC.g, nightC.b));
  /** Sodium on the outskirts, arclight and LED in the cores. */
  vec3 sodium = vec3(1.00, 0.72, 0.36);
  vec3 arclight = vec3(0.86, 0.91, 1.00);
  /**
   * The night map carries a dim blue-grey base across all land — sensor floor
   * and albedo, not lamps — and multiplying it by the gain washed the Sahara
   * violet. Lamps start where that floor ends.
   */
  float lamps = smoothstep(0.03, 0.14, lum);
  vec3 lights = nightC * mix(sodium, arclight, smoothstep(0.30, 0.90, lum));
  lights *= mix(1.6, 4.8, lum) * uNightGain * lamps;
#if NIGHT_BLOOM > 0
  // Four taps of the lights themselves, spread a couple of texels: the haze a
  // city throws into its own air. Cheaper than a bloom pass and it only ever
  // glows where there is something to glow.
  vec2 halo = vec2(2.5 / 2048.0, 2.5 / 1024.0);
  float ring =
    texture2D(uNight, vUv + vec2(halo.x, 0.0)).g +
    texture2D(uNight, vUv - vec2(halo.x, 0.0)).g +
    texture2D(uNight, vUv + vec2(0.0, halo.y)).g +
    texture2D(uNight, vUv - vec2(0.0, halo.y)).g;
  lights += sodium * ring * 0.16 * uNightGain * lamps;
#endif
  if (uGrainLights > 0.001) {
    float glt = grain2(vUv * 780.0);
    lights *= 1.0 + (glt - 0.42) * uGrainLights * 1.65;
    float spark = smoothstep(0.74, 1.0, glt) * lum * lamps;
    lights += vec3(1.0, 0.78, 0.42) * spark * uGrainLights * 0.62;
  }
  lights *= lampOn;

  float specMask = texture2D(uSpec, vUv).r;
  vec3 lit = dayC * (0.12 + 0.88 * max(ndl, 0.0));
  if (uGrainRelief > 0.001) {
    float land = 1.0 - specMask;
    float rg = grain2(vUv * 190.0);
    lit *= 1.0 + (rg - 0.5) * uGrainRelief * 0.18 * land;
  }
  // Additive, not a cross-fade: at dusk the ground is still lit and the lamps
  // are already on, which is the half hour the old mix could not show.
  vec3 color = lit * dayStrength + lights;
  /**
   * Moonlight. A full moon puts a quarter-lux on the night side and the ISS
   * photographs it — cloud tops and deserts come back as blue-grey. The moon
   * vector is already here for the tide, so this costs one dot.
   */
  float moonEl = max(dot(gN, normalize(uMoon)), 0.0);
  color += dayC * vec3(0.72, 0.80, 1.00) * moonEl * moonEl * uMoonLit * 0.022 * lampOn;

  float spec = pow(max(dot(Nspec, H), 0.0), 48.0) * specMask * dayStrength;
  color += vec3(0.78, 0.88, 1.0) * spec * 0.65;

  vec3 atmoDay = vec3(0.302, 0.698, 1.0);
  vec3 atmoTwilight = vec3(0.737, 0.286, 0.043);
  vec3 atmo = mix(atmoTwilight, atmoDay, smoothstep(-0.25, 0.75, ndl));
  float fres = pow(1.0 - max(dot(normalize(vNormal), V), 0.0), 2.0);
  float atmoMix = smoothstep(-0.5, 1.0, ndl) * fres;
  color = mix(color, atmo, clamp(atmoMix, 0.0, 1.0) * 0.38);

  float k = clamp(uTideAmp, 0.0, 2.4);
  color += vec3(0.10, 0.40, 0.66) * specMask * max(vTide, 0.0) * 0.45 * k;

  vec4 a = texture2D(uAtlas, vUv);
  color = mix(color, mix(color, a.rgb, 0.88), a.a * uAtlasMix);

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const ATMO_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPos;
void main() {
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const ATMO_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uCamPos;
uniform float uInner;
varying vec3 vNormal;
varying vec3 vPos;

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(uCamPos - vPos);
  float fres = pow(1.0 - abs(dot(n, v)), 2.6);
  float sun = dot(n, normalize(uSun));
  float day = smoothstep(-0.5, 1.0, sun);
  vec3 atmoDay = vec3(0.302, 0.698, 1.0);
  vec3 atmoTwilight = vec3(0.737, 0.286, 0.043);
  vec3 col = mix(atmoTwilight, atmoDay, smoothstep(-0.25, 0.75, sun));
  float alpha = pow(clamp((fres - 0.27) / 0.27, 0.0, 1.0), 3.0) * day;
  if (uInner > 0.5) alpha *= 0.45;
  // From orbit the shell is a limb; from inside it, it is a wall across the
  // sky with a black gap under it. Ride altitude fades it back to haze.
  alpha *= mix(0.16, 1.0, smoothstep(1.02, 1.34, length(uCamPos)));
  gl_FragColor = vec4(col, alpha * 0.72);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const CLOUD_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uClouds;
uniform vec3 uSun;
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vec2 uv = vUv + vec2(uTime * 0.0012, 0.0);
  float c = texture2D(uClouds, uv).r;
  float strength = smoothstep(0.2, 1.0, c);
  float ndl = dot(normalize(vNormal), normalize(uSun));
  float day = smoothstep(-0.15, 0.35, ndl);
  float a = strength * uOpacity * mix(0.06, 0.72, day);
  vec3 col = mix(vec3(0.45, 0.48, 0.58), vec3(1.0), day);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const MOON_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldN;
void main() {
  vUv = uv;
  vWorldN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const MOON_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uSun;
varying vec2 vUv;
varying vec3 vWorldN;
void main() {
  vec3 albedo = texture2D(uMap, vUv).rgb;
  float ndl = dot(normalize(vWorldN), normalize(uSun));
  float day = smoothstep(-0.08, 0.22, ndl);
  vec3 color = albedo * mix(0.04, 1.12, day);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * Cage coordinates. Every degree reading in the scene is one quad in one
 * buffer, billboarded here rather than by a Sprite each — thirty-odd draw
 * calls collapse to one, and the labels cost the frame nothing to turn.
 */
export const COORD_VERT = /* glsl */ `
attribute vec2 aCorner;
uniform vec3 uCamPos;
uniform float uSize;
varying vec2 vUv;
varying float vFace;

void main() {
  vUv = uv;
  vec3 anchor = (modelMatrix * vec4(position, 1.0)).xyz;
  vFace = dot(normalize(anchor), normalize(uCamPos - anchor));
  vec4 mv = viewMatrix * vec4(anchor, 1.0);
  // Offset in view space: the quad faces the lens whatever the globe does.
  mv.xy += aCorner * uSize;
  gl_Position = projectionMatrix * mv;
}
`;

export const COORD_FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uTint;
uniform float uOpacity;
varying vec2 vUv;
varying float vFace;

void main() {
  float a = texture2D(uAtlas, vUv).a;
  // Readings on the limb fade out before they can smear along it.
  float face = smoothstep(0.08, 0.42, vFace);
  float alpha = a * face * uOpacity;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(uTint, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

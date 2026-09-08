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

float grain2(vec2 uv) {
  float a = hash21(uv);
  float b = hash21(uv * 2.13 + 17.1);
  float c = hash21(uv * 4.71 + 9.2);
  return a * 0.55 + b * 0.30 + c * 0.15;
}

void main() {
  vec3 nTex = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
  nTex.xy *= uBump;
  if (uGrainRelief > 0.001) {
    float rx = grain2(vUv * 420.0);
    float ry = grain2(vUv.yx * 310.0 + 8.1);
    nTex.xy += vec2(rx - 0.5, ry - 0.5) * uGrainRelief * 0.72;
  }
  mat3 tbn = mat3(normalize(vTangent), normalize(vBitangent), normalize(vNormal));
  vec3 N = normalize(tbn * nTex);
  vec3 V = normalize(uCamPos - vPos);
  vec3 L = normalize(uSun);
  vec3 H = normalize(L + V);

  float ndl = dot(N, L);
  float dayStrength = smoothstep(-0.25, 0.50, ndl);

  vec3 dayC = texture2D(uDay, vUv).rgb;
  vec3 nightC = texture2D(uNight, vUv).rgb;
  float lum = max(nightC.r, max(nightC.g, nightC.b));
  vec3 lights = nightC * mix(1.6, 4.8, lum) * uNightGain;
  if (uGrainLights > 0.001) {
    float glt = grain2(vUv * 780.0);
    lights *= 1.0 + (glt - 0.42) * uGrainLights * 1.65;
    float spark = smoothstep(0.74, 1.0, glt) * lum;
    lights += vec3(1.0, 0.78, 0.42) * spark * uGrainLights * 0.62;
  }

  float specMask = texture2D(uSpec, vUv).r;
  vec3 lit = dayC * (0.12 + 0.88 * max(ndl, 0.0));
  if (uGrainRelief > 0.001) {
    float land = 1.0 - specMask;
    float rg = grain2(vUv * 190.0);
    lit *= 1.0 + (rg - 0.5) * uGrainRelief * 0.18 * land;
  }
  vec3 color = mix(lights, lit, dayStrength);

  float spec = pow(max(dot(N, H), 0.0), 48.0) * specMask * dayStrength;
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

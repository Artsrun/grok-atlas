export const EARTH_VERT = /* glsl */ `
attribute vec4 tangent;
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;

void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
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

varying vec2 vUv;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;

void main() {
  vec3 nTex = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
  nTex.xy *= uBump;
  mat3 tbn = mat3(normalize(vTangent), normalize(vBitangent), normalize(vNormal));
  vec3 N = normalize(tbn * nTex);
  vec3 V = normalize(uCamPos - vPos);
  vec3 L = normalize(uSun);
  vec3 H = normalize(L + V);

  float ndl = dot(N, L);
  float day = smoothstep(-0.10, 0.26, ndl);
  float twilight = 1.0 - smoothstep(0.0, 0.38, abs(ndl));

  vec3 dayC = texture2D(uDay, vUv).rgb;
  vec3 nightC = texture2D(uNight, vUv).rgb;
  float lum = max(nightC.r, max(nightC.g, nightC.b));
  vec3 lights = nightC * mix(2.4, 8.2, lum) * uNightGain;
  lights *= vec3(1.35, 0.88, 0.42);

  float specMask = texture2D(uSpec, vUv).r;
  vec3 albedo = dayC;
  albedo *= mix(0.055, 1.0, day);

  vec3 color = albedo * (0.07 + 0.93 * max(ndl, 0.0));
  float nightAmt = 1.0 - smoothstep(-0.02, 0.38, ndl);
  color += vec3(0.012, 0.02, 0.045) * specMask * nightAmt;
  color += lights * nightAmt * mix(1.0, 0.18, specMask);
  color += lights * lights * 0.45 * nightAmt;

  float spec = pow(max(dot(N, H), 0.0), 52.0) * specMask * day;
  color += vec3(0.82, 0.91, 1.0) * spec * 0.72;
  color += vec3(1.0, 0.36, 0.10) * twilight * specMask * 0.16;

  vec4 a = texture2D(uAtlas, vUv);
  color = mix(color, mix(color, a.rgb, 0.88), a.a * uAtlasMix);

  float fres = pow(1.0 - max(dot(normalize(vNormal), V), 0.0), 2.8);
  vec3 rimDay = vec3(0.32, 0.58, 1.0);
  vec3 rimNight = vec3(0.55, 0.92, 0.32);
  vec3 rimTerm = vec3(1.0, 0.48, 0.14);
  vec3 rim = mix(rimNight, rimDay, day);
  rim = mix(rim, rimTerm, twilight);
  color += rim * fres * 0.42;

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const ATMO_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPos;
void main() {
  vNormal = normalize(normalMatrix * normal);
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
  float ndv = abs(dot(n, v));
  float fres = pow(1.0 - ndv, mix(2.2, 3.6, uInner));
  float sun = dot(n, normalize(uSun));
  float night = smoothstep(0.25, -0.15, sun);
  float term = pow(1.0 - abs(sun), 3.0);

  vec3 dayCol = vec3(0.28, 0.52, 1.0);
  vec3 sunset = vec3(1.0, 0.48, 0.12);
  vec3 airglow = vec3(0.78, 0.86, 0.28);
  vec3 col = mix(dayCol, airglow, night);
  col = mix(col, sunset, term * 0.9);

  float alpha = fres * mix(1.0, 0.52, night);
  if (uInner > 0.5) alpha *= 0.55;
  gl_FragColor = vec4(col * 1.15, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const CLOUD_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPos;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uClouds;
uniform vec3 uSun;
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPos;

void main() {
  vec2 uv = vUv + vec2(uTime * 0.0018, 0.0);
  float c = texture2D(uClouds, uv).r;
  float ndl = dot(normalize(vNormal), normalize(uSun));
  float day = smoothstep(-0.1, 0.3, ndl);
  float a = c * uOpacity * mix(0.08, 0.78, day);
  vec3 col = mix(vec3(0.55, 0.58, 0.7), vec3(1.0), day);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

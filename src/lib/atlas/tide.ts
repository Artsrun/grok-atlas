import { DR, ll2xyz } from "./geo.ts";
import { subsolarLat } from "./sun.ts";

/** Lunar orbital inclination. MEASURED. */
export const MOON_INC = 5.145;

/**
 * Visual orbit radius in Earth radii.
 * Real mean is ~60.2 — compressed so the disc is in-frame. DECLARED.
 */
export const MOON_DIST = 2.72;

/** Moon / Earth radius. MEASURED. */
export const MOON_RADIUS = 0.255;

export function moonXYZ(lonDeg: number, r = MOON_DIST): [number, number, number] {
  const u = lonDeg * DR;
  const inc = MOON_INC * DR;
  return [r * Math.cos(u), r * Math.sin(u) * Math.sin(inc), r * Math.sin(u) * Math.cos(inc)];
}

/** Smallest angle between moon and sun longitudes, 0–180. */
export function elongation(moonLon: number, sunLon: number): number {
  let d = Math.abs(moonLon - sunLon) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/** 1 at syzygy (spring), 0 at quadrature (neap). */
export function springFactor(moonLon: number, sunLon: number): number {
  return Math.abs(Math.cos((elongation(moonLon, sunLon) * Math.PI) / 180));
}

export function springLabel(moonLon: number, sunLon: number): string {
  const e = elongation(moonLon, sunLon);
  if (e < 18 || e > 162) return "spring";
  if (e > 72 && e < 108) return "neap";
  return "mid";
}

/**
 * Equilibrium tide at a WGS84 point: lunar P2 + 0.46 solar P2.
 * Range roughly −1.5…+1.5. Land is not masked here.
 */
export function tideAt(lat: number, lon: number, moonLon: number, sunLon: number): number {
  const n = ll2xyz(lat, lon, 1);
  const m = moonXYZ(moonLon, 1);
  const s = ll2xyz(subsolarLat(sunLon), sunLon, 1);
  const nm = n[0] * m[0] + n[1] * m[1] + n[2] * m[2];
  const ns = n[0] * s[0] + n[1] * s[1] + n[2] * s[2];
  const lunar = 0.5 * (3 * nm * nm - 1);
  const solar = 0.5 * (3 * ns * ns - 1);
  return lunar + 0.46 * solar;
}

/** Display metres — exaggerated, not a hydrographic forecast. DECLARED. */
export function tideMeters(v: number, gain = 1): number {
  return v * 1.35 * gain;
}

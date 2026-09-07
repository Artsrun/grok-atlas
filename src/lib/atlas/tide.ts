import { DR, ll2xyz } from "./geo.ts";

/** Lunar orbital inclination. MEASURED. */
export const MOON_INC = 5.145;

/**
 * Visual orbit in Earth radii.
 * Real mean ~60.2 — pulled in so the disc reads at globe scale. Phase is real.
 */
export const MOON_DIST = 5.8;

/** Moon / Earth radius. MEASURED. */
export const MOON_RADIUS = 0.273;

export function moonXYZ(lonDeg: number, r = MOON_DIST, latDeg = 0): [number, number, number] {
  const lat = latDeg || MOON_INC * Math.sin(lonDeg * DR);
  return ll2xyz(lat, lonDeg, r);
}

export function elongation(moonLon: number, sunLon: number): number {
  let d = Math.abs(moonLon - sunLon) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

export function springFactor(moonLon: number, sunLon: number): number {
  return Math.abs(Math.cos((elongation(moonLon, sunLon) * Math.PI) / 180));
}

export function springLabel(moonLon: number, sunLon: number): string {
  const e = elongation(moonLon, sunLon);
  if (e < 18 || e > 162) return "spring";
  if (e > 72 && e < 108) return "neap";
  return "mid";
}

export function tideAt(
  lat: number,
  lon: number,
  moonLon: number,
  sunLon: number,
  sunLat = 0,
): number {
  const n = ll2xyz(lat, lon, 1);
  const m = moonXYZ(moonLon, 1);
  const s = ll2xyz(sunLat, sunLon, 1);
  const nm = n[0] * m[0] + n[1] * m[1] + n[2] * m[2];
  const ns = n[0] * s[0] + n[1] * s[1] + n[2] * s[2];
  const lunar = 0.5 * (3 * nm * nm - 1);
  const solar = 0.5 * (3 * ns * ns - 1);
  return lunar + 0.46 * solar;
}

export function tideMeters(v: number, gain = 1): number {
  return v * 1.35 * gain;
}

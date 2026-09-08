/** Lat/lon cage — the graticule the old icosahedron shell only implied. */

import { DR } from "./geo.ts";

/** Degrees between parallels and meridians. */
export const GRAT_STEP = 30;
/** Cage sits just off the surface so the far side hides behind the globe. */
export const CAGE_R = 1.02;
/** Labels float a touch higher again, clear of their own line. */
export const LABEL_R = 1.055;
/** No parallels inside this of a pole — meridians converge, lines pile up. */
const POLE_CAP = 80;

export type Spot = { lat: number; lon: number; text: string };

const round = (v: number) => Math.abs(Math.round(v));

/** `30°N`, `0°` — hemisphere letter only where it means something. */
export const formatLat = (lat: number): string => {
  const d = round(lat);
  if (d === 0) return "0°";
  return `${d}°${lat > 0 ? "N" : "S"}`;
};

/** `60°E`, `180°`, `0°` — antimeridian and prime meridian stay unlettered. */
export const formatLon = (lon: number): string => {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  const d = round(wrapped);
  if (d === 0 || d === 180) return `${d}°`;
  return `${d}°${wrapped > 0 ? "E" : "W"}`;
};

/** Every parallel the cage draws — built outward from the equator, so it has one. */
export const parallels = (step = GRAT_STEP): number[] => {
  const out = [0];
  for (let lat = step; lat <= POLE_CAP; lat += step) out.push(lat, -lat);
  return out.sort((a, b) => a - b);
};

/** Every meridian, from -180 up to but not repeating +180. */
export const meridians = (step = GRAT_STEP): number[] => {
  const out: number[] = [];
  for (let lon = -180; lon < 180; lon += step) out.push(lon);
  return out;
};

/**
 * Cage as one lineSegments buffer — pairs of endpoints, one draw call.
 * `seg` is the chord step in degrees: smaller reads rounder, costs vertices.
 */
export const cageSegments = (step = GRAT_STEP, r = CAGE_R, seg = 4): Float32Array => {
  const pts: number[] = [];
  const push = (lat: number, lon: number) => {
    const phi = (90 - lat) * DR;
    const th = (lon + 180) * DR;
    pts.push(
      -r * Math.sin(phi) * Math.cos(th),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(th),
    );
  };
  const span = (from: number, to: number, at: (v: number) => [number, number]) => {
    for (let v = from; v < to; v += seg) {
      push(...at(v));
      push(...at(Math.min(v + seg, to)));
    }
  };
  for (const lat of parallels(step)) span(-180, 180, (lon) => [lat, lon]);
  for (const lon of meridians(step)) span(-POLE_CAP, POLE_CAP, (lat) => [lat, lon]);
  return new Float32Array(pts);
};

/** Where a degree reading gets written, and what it reads. */
export const labelSpots = (step = GRAT_STEP): Spot[] => {
  const out: Spot[] = [];
  const rails = [0, 90, 180, -90];
  for (const lat of parallels(step)) {
    if (lat === 0) continue;
    for (const lon of rails) out.push({ lat, lon, text: formatLat(lat) });
  }
  // Longitudes ride just above the equator so they never sit on a parallel.
  for (const lon of meridians(step)) out.push({ lat: 6, lon, text: formatLon(lon) });
  return out;
};

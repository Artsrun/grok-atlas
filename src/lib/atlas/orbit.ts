/** ISS ground track — circular orbit, rotating earth. Enough for a pin and a line. */

import { DR } from "./geo.ts";
import type { LL } from "./geo.ts";

/** ZARYA inclination, degrees. */
export const ISS_INC = 51.64;
/** Orbital period, seconds. ~15.5 revolutions a day. */
export const ISS_PERIOD = 5574;
/** Sidereal day, seconds — the ground track's westward drift. */
export const SIDEREAL_DAY = 86164;
/** Mean altitude in earth radii, when a fix has not landed yet. */
export const ISS_ALT_R = 420 / 6371;

const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
const clamp1 = (v: number) => Math.min(1, Math.max(-1, v));

export type TrackFix = LL & { ascending: boolean };

/**
 * Argument of latitude for a subpoint: sin(lat) = sin(i)·sin(u). Ascending
 * takes the northbound branch, descending its mirror. Degrees.
 */
export const argOfLat = ({ lat, ascending }: { lat: number; ascending: boolean }): number => {
  const u = Math.asin(clamp1(Math.sin(lat * DR) / Math.sin(ISS_INC * DR))) / DR;
  return wrap(ascending ? u : 180 - u);
};

/** Longitude of the ascending node implied by one subpoint. Degrees. */
export const nodeLon = (fix: TrackFix): number => {
  const u = argOfLat(fix) * DR;
  const off = Math.atan2(Math.cos(ISS_INC * DR) * Math.sin(u), Math.cos(u)) / DR;
  return wrap(fix.lon - off);
};

/**
 * Where the station's subpoint sits `seconds` from a fix. Positive is ahead;
 * negative walks the track back. Earth rotation is folded into the longitude.
 */
export const advanceTrack = (fix: TrackFix, seconds: number): TrackFix => {
  const node = nodeLon(fix);
  const u = (argOfLat(fix) + (360 * seconds) / ISS_PERIOD) * DR;
  const lat = Math.asin(clamp1(Math.sin(ISS_INC * DR) * Math.sin(u))) / DR;
  const off = Math.atan2(Math.cos(ISS_INC * DR) * Math.sin(u), Math.cos(u)) / DR;
  const lon = wrap(node + off - (360 * seconds) / SIDEREAL_DAY);
  return { lat, lon, ascending: Math.cos(u) > 0 };
};

/** Samples along the track, `back` seconds behind through `ahead` in front. */
export const groundTrack = (fix: TrackFix, back = 900, ahead = 3600, step = 45): LL[] => {
  const out: LL[] = [];
  for (let t = -back; t <= ahead; t += step) {
    const { lat, lon } = advanceTrack(fix, t);
    out.push({ lat, lon });
  }
  return out;
};

/** Ground heading in degrees clockwise from north — where the nose points. */
export const trackHeading = (fix: TrackFix): number => {
  const a = advanceTrack(fix, 1);
  const dLon = wrap(a.lon - fix.lon) * DR * Math.cos(fix.lat * DR);
  const dLat = (a.lat - fix.lat) * DR;
  return (Math.atan2(dLon, dLat) / DR + 360) % 360;
};

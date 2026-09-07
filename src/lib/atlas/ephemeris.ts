import { OBLIQUITY } from "./sun.ts";

export const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

const J2000 = Date.UTC(2000, 0, 1, 12);
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC = 29.53058867;
const DRACONIC = 27.212220;

const daysSince = (t: number, epoch: number) => (t - epoch) / 86400000;

/** Subsolar point and sub-lunar point for a civil instant. Mean-orbit, not JPL. */
export function skyAt(date: Date = new Date()) {
  const t = date.getTime();
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const doy = (t - start) / 86400000;
  const sunLat = OBLIQUITY * Math.sin((2 * Math.PI * (doy - 81)) / 365);
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const sunLon = wrapLon(-((utcH - 12) * 15));

  const age = ((daysSince(t, NEW_MOON) % SYNODIC) + SYNODIC) % SYNODIC;
  const elong = (age / SYNODIC) * 360;
  const moonLon = wrapLon(sunLon + elong);
  const moonLat = 5.145 * Math.sin((2 * Math.PI * daysSince(t, J2000)) / DRACONIC);

  return { sunLat, sunLon, moonLat, moonLon, age, elong };
}

/** Local solar time in hours at a longitude. */
export function solarHours(lon: number, date: Date = new Date()) {
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return (utcH + lon / 15 + 24) % 24;
}

export function formatSolar(hours: number) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function phaseName(elong: number) {
  const e = ((elong % 360) + 360) % 360;
  if (e < 18 || e > 342) return "new";
  if (e < 72) return "waxing crescent";
  if (e < 108) return "first quarter";
  if (e < 162) return "waxing gibbous";
  if (e < 198) return "full";
  if (e < 252) return "waning gibbous";
  if (e < 288) return "last quarter";
  return "waning crescent";
}

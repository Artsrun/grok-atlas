/** ISS S-band via TDRS + a cheap cosmic-ray field. No Three, no fetch. */

import type { DeviceTier } from "./device.ts";

const DR = Math.PI / 180;

/** Conventional TDRS GEO slots — Atlantic / Pacific / Indian. DECLARED. */
export const TDRS = [
  { id: "E", lon: -41 },
  { id: "W", lon: -174 },
  { id: "Z", lon: 85 },
] as const;

export type TdrsSlot = (typeof TDRS)[number];

/** GEO radius in Earth radii. */
export const TDRS_R = 6.61;

/** South Atlantic Anomaly — ISS dose spike, not the inner belt. */
export const SAA = { lat: -30, lon: -40 };

export const wrapLon = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

export const lonDelta = (a: number, b: number) => Math.abs(wrapLon(a - b));

export const nearestTdrs = (issLon: number): TdrsSlot =>
  TDRS.reduce((best, slot) => (lonDelta(issLon, slot.lon) < lonDelta(issLon, best.lon) ? slot : best));

/** Earth-central angle to the radio horizon from altitude km. */
export const footprintHalfAngle = (altKm: number) => {
  const r = 6371 + Math.max(altKm, 350);
  return Math.acos(Math.min(1, 6371 / r));
};

export const inFootprint = (
  iss: { lat: number; lon: number; alt: number },
  here: { lat: number; lon: number },
) => angularDistance(iss, here) <= footprintHalfAngle(iss.alt);

export const angularDistance = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const p1 = a.lat * DR;
  const p2 = b.lat * DR;
  const dL = wrapLon(b.lon - a.lon) * DR;
  return Math.acos(Math.min(1, Math.max(-1, Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dL))));
};

/** Ring on the unit sphere around a subpoint, radius = half-angle rad. */
export const footprintRing = (
  lat: number,
  lon: number,
  halfAngle: number,
  n = 64,
): { lat: number; lon: number }[] => {
  const out: { lat: number; lon: number }[] = [];
  const lat0 = lat * DR;
  const lon0 = lon * DR;
  const ca = Math.cos(halfAngle);
  const sa = Math.sin(halfAngle);
  for (let i = 0; i <= n; i++) {
    const az = (i / n) * Math.PI * 2;
    const slat = Math.sin(lat0) * ca + Math.cos(lat0) * sa * Math.cos(az);
    const dlon = Math.atan2(sa * Math.sin(az) * Math.cos(lat0), ca - Math.sin(lat0) * slat);
    out.push({ lat: Math.asin(Math.min(1, Math.max(-1, slat))) / DR, lon: wrapLon((lon0 + dlon) / DR) });
  }
  return out;
};

export const radioRings = (tier: DeviceTier) => (tier === "high" ? 3 : tier === "mid" ? 2 : 1);

export const cosmicCount = (tier: DeviceTier) => (tier === "high" ? 220 : tier === "mid" ? 80 : 40);

/** Last Kp from SWPC `planetary_k_index_1m.json`. Fail-open at 2. */
export const kpFromRows = (rows: unknown): number => {
  if (!Array.isArray(rows) || rows.length === 0) return 2;
  const last = rows[rows.length - 1] as Record<string, unknown>;
  const v = last.kp_index ?? last.kp ?? last.Kp;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(9, Math.max(0, n)) : 2;
};

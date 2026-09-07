import { ARARAT, NILE, OBS } from "./geo.ts";

export type View = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  dist: number;
  note: string;
};

const at = (p: { lat: number; lon: number; label: string }) => ({
  label: p.label,
  lat: p.lat,
  lon: p.lon,
});

/** Observational camera views — not conflict scenarios. */
export const VIEWS: View[] = [
  { id: "nile", ...at(NILE), dist: 2.58, note: "ISS cupola home" },
  { id: "yerevan", ...at(OBS), dist: 2.7, note: "observer · 895 m" },
  { id: "ararat", ...at(ARARAT), dist: 2.55, note: "Masis · 5,137 m" },
  { id: "europe", label: "Europe", lat: 47.5, lon: 10.2, dist: 2.9, note: "central mass" },
  { id: "americas", label: "Americas", lat: 18, lon: -78, dist: 3.1, note: "Caribbean approach" },
  { id: "pacific", label: "West Pacific", lat: 12, lon: 148, dist: 3.2, note: "limb / terminator" },
  { id: "moon", label: "Lunar stand", lat: 8, lon: 90, dist: 6.5, note: "Earth + moon + tides" },
];

/** Cupola home — the camera's start and the fallback fly distance. */
export const HOME: View = VIEWS[0];

/** A named view as a camera focus — keeps `site` so the URL can round-trip it. */
export const focusOf = (v: View) => ({
  lat: v.lat,
  lon: v.lon,
  label: v.label,
  dist: v.dist,
  site: v.id,
});

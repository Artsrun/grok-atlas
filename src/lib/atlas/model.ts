import { OBS } from "./geo.ts";

export type View = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  dist: number;
  note: string;
};

/** Camera presets. No Nile — home is the device pin. */
export const VIEWS: View[] = [
  { id: "yerevan", label: OBS.label, lat: OBS.lat, lon: OBS.lon, dist: 2.55, note: "observer" },
  { id: "europe", label: "Europe", lat: 47.5, lon: 10.2, dist: 2.9, note: "central mass" },
  { id: "americas", label: "Americas", lat: 18, lon: -78, dist: 3.1, note: "Caribbean" },
  { id: "pacific", label: "West Pacific", lat: 12, lon: 148, dist: 3.2, note: "terminator" },
  { id: "moon", label: "Moon stand", lat: 8, lon: 90, dist: 7.2, note: "phase" },
];

/** Neutral start before geolocation resolves. */
export const HOME: View = {
  id: "here",
  label: "Here",
  lat: 0,
  lon: 0,
  dist: 2.65,
  note: "your position",
};

export const focusOf = (v: View) => ({
  lat: v.lat,
  lon: v.lon,
  label: v.label,
  dist: v.dist,
  site: v.id,
});

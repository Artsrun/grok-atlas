/** Observational camera views — not conflict scenarios. */
export const VIEWS: {
  id: string;
  label: string;
  lat: number;
  lon: number;
  dist?: number;
  note: string;
}[] = [
  { id: "nile", label: "Nile Delta", lat: 30.2, lon: 31.1, dist: 2.58, note: "ISS cupola home" },
  { id: "yerevan", label: "Lake Yerevan", lat: 40.177, lon: 44.487, dist: 2.7, note: "observer · 895 m" },
  { id: "ararat", label: "Ararat", lat: 39.702, lon: 44.396, dist: 2.55, note: "Masis · 5,137 m" },
  { id: "europe", label: "Europe", lat: 47.5, lon: 10.2, dist: 2.9, note: "central mass" },
  { id: "americas", label: "Americas", lat: 18, lon: -78, dist: 3.1, note: "Caribbean approach" },
  { id: "pacific", label: "West Pacific", lat: 12, lon: 148, dist: 3.2, note: "limb / terminator" },
  { id: "moon", label: "Lunar stand", lat: 8, lon: 90, dist: 6.5, note: "Earth + moon + tides" },
];

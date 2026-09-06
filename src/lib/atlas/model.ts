/** Observational camera views — not conflict scenarios. */
export const VIEWS: {
  id: string;
  label: string;
  lat: number;
  lon: number;
  note: string;
}[] = [
  { id: "nile", label: "Nile Delta", lat: 30.2, lon: 31.1, note: "ISS cupola home" },
  { id: "yerevan", label: "Lake Yerevan", lat: 40.177, lon: 44.487, note: "observer · 895 m" },
  { id: "ararat", label: "Ararat", lat: 39.702, lon: 44.396, note: "Masis · 5,137 m" },
  { id: "europe", label: "Europe", lat: 47.5, lon: 10.2, note: "central mass" },
  { id: "americas", label: "Americas", lat: 18, lon: -78, note: "Caribbean approach" },
  { id: "pacific", label: "West Pacific", lat: 12, lon: 148, note: "limb / terminator" },
];

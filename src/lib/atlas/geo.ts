import { geoCentroid, geoContains, geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Role } from "./model";
import { COMMIT, THRESHOLD } from "./model";

export const DR = Math.PI / 180;

export type LL = { lat: number; lon: number };

/** WGS84 observer — field report §01 (Lake Yerevan). CONSTANT. */
export const OBS: LL & { h: number; label: string } = {
  lat: 40.177,
  lon: 44.487,
  h: 895,
  label: "Lake Yerevan",
};

/** Masis summit. CONSTANT. */
export const ARARAT: LL & { h: number; label: string } = {
  lat: 39.702,
  lon: 44.396,
  h: 5137,
  label: "Ararat",
};

/** ISS frame home — Nile Delta / Eastern Mediterranean. DECLARED. */
export const NILE: LL & { label: string } = {
  lat: 30.2,
  lon: 31.1,
  label: "Nile Delta",
};

export const SITES: { id: string; label: string; lat: number; lon: number; note: string }[] = [
  { id: "nile", label: "Nile Delta", lat: NILE.lat, lon: NILE.lon, note: "ISS cupola home" },
  { id: "yerevan", label: "Lake Yerevan", lat: OBS.lat, lon: OBS.lon, note: "observer · 895 m" },
  { id: "ararat", label: "Ararat", lat: ARARAT.lat, lon: ARARAT.lon, note: "Masis · 5,137 m" },
];

export type CountryFeat = {
  name: string;
  feature: GeoJSON.Feature<GeoJSON.Geometry, { name: string }>;
};

export function ll2xyz(lat: number, lon: number, r = 1): [number, number, number] {
  const phi = (90 - lat) * DR;
  const th = (lon + 180) * DR;
  return [
    -r * Math.sin(phi) * Math.cos(th),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(th),
  ];
}

export function xyz2ll(x: number, y: number, z: number): LL {
  const r = Math.hypot(x, y, z) || 1;
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, y / r))) / DR;
  const lon = Math.atan2(z, -x) / DR - 180;
  const wrap = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat, lon: wrap };
}

export async function loadCountries(): Promise<CountryFeat[]> {
  const res = await fetch("/geo/countries-110m.json");
  if (!res.ok) throw new Error("countries topology unreachable");
  const topo = await res.json();
  const fc = feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection<
    GeoJSON.Geometry,
    { name: string }
  >;
  return fc.features
    .filter((f) => f.properties?.name && f.properties.name !== "Antarctica")
    .map((f) => ({ name: f.properties.name, feature: f }));
}

export function pickCountry(countries: CountryFeat[], lat: number, lon: number): string | null {
  for (const c of countries) {
    if (geoContains(c.feature, [lon, lat])) return c.name;
  }
  return null;
}

export function centroidOf(c: CountryFeat): LL {
  const [lon, lat] = geoCentroid(c.feature);
  return { lat, lon };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const ATK = hexToRgb("#ff4d5e");
const DEF = hexToRgb("#4c8dff");
const NEU = hexToRgb("#22263b");

function ramp(score: number): [number, number, number] {
  const t = Math.max(-1, Math.min(1, score / THRESHOLD));
  if (t >= 0) {
    const k = t;
    return [
      lerp(NEU[0], DEF[0], k),
      lerp(NEU[1], DEF[1], k),
      lerp(NEU[2], DEF[2], k),
    ];
  }
  const k = -t;
  return [
    lerp(NEU[0], ATK[0], k),
    lerp(NEU[1], ATK[1], k),
    lerp(NEU[2], ATK[2], k),
  ];
}

export const OVERLAY_W = 2048;
export const OVERLAY_H = 1024;

export function paintAtlas(
  ctx: CanvasRenderingContext2D,
  countries: CountryFeat[],
  scores: Record<string, number>,
  roles: Record<string, Role>,
  selected: string | null,
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const projection = geoEquirectangular()
    .scale(w / (2 * Math.PI))
    .translate([w / 2, h / 2])
    .precision(0.3);
  const path = geoPath(projection, ctx);

  for (const c of countries) {
    const role = roles[c.name];
    const s = scores[c.name] ?? 0;
    let rgb: [number, number, number] | null = null;
    let a = 0;
    if (role === "neutral") {
      rgb = [28, 32, 48];
      a = 0.55;
    } else if (role === "defender") {
      rgb = DEF;
      a = 0.72;
    } else if (role === "attacker") {
      rgb = ATK;
      a = 0.72;
    } else if (Math.abs(s) > 0.6) {
      rgb = ramp(s);
      a = 0.18 + 0.5 * Math.min(1, Math.abs(s) / COMMIT);
    }
    if (!rgb) continue;
    ctx.beginPath();
    path(c.feature);
    ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
    ctx.fill();
  }

  if (selected) {
    const c = countries.find((x) => x.name === selected);
    if (c) {
      ctx.beginPath();
      path(c.feature);
      ctx.strokeStyle = "rgba(200,144,80,0.95)";
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }
}

export function ringsOf(geom: GeoJSON.Geometry): number[][][] {
  if (geom.type === "Polygon") return geom.coordinates as number[][][];
  if (geom.type === "MultiPolygon") return (geom.coordinates as number[][][][]).flat();
  return [];
}

import { geoBounds, geoCentroid, geoContains, geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";

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

export type CountryFeat = {
  name: string;
  feature: GeoJSON.Feature<GeoJSON.Geometry, { name: string }>;
  /** [[west, south], [east, north]] — precomputed tap prefilter. */
  bounds: [[number, number], [number, number]];
  centroid: LL;
};

export function ll2xyz(lat: number, lon: number, r = 1): [number, number, number] {
  const phi = (90 - lat) * DR;
  const th = (lon + 180) * DR;
  return [-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)];
}

/** Anything with x/y/z — a THREE.Vector3 without importing three into geo. */
export type Vec3Like = { x: number; y: number; z: number };

/**
 * `ll2xyz` for the hot path. The array version allocates, and the per-frame
 * callers (sun, moon, station, ride seat) run it two or three times a frame —
 * on a phone that is a few hundred short-lived arrays a second, for nothing.
 */
export function ll2xyzInto<T extends Vec3Like>(out: T, lat: number, lon: number, r = 1): T {
  const phi = (90 - lat) * DR;
  const th = (lon + 180) * DR;
  const s = Math.sin(phi);
  out.x = -r * s * Math.cos(th);
  out.y = r * Math.cos(phi);
  out.z = r * s * Math.sin(th);
  return out;
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
    .map((f) => {
      const [lon, lat] = geoCentroid(f);
      return {
        name: f.properties.name,
        feature: f,
        bounds: geoBounds(f) as [[number, number], [number, number]],
        centroid: { lat, lon },
      };
    });
}

/** True when lon sits inside [w, e], honouring rings that cross the antimeridian. */
function lonInside(lon: number, w: number, e: number): boolean {
  return w <= e ? lon >= w && lon <= e : lon >= w || lon <= e;
}

export function pickCountry(countries: CountryFeat[], lat: number, lon: number): string | null {
  for (const c of countries) {
    const [[w, s], [e, n]] = c.bounds;
    if (lat < s || lat > n || !lonInside(lon, w, e)) continue;
    if (geoContains(c.feature, [lon, lat])) return c.name;
  }
  return null;
}

export const centroidOf = (c: CountryFeat): LL => c.centroid;

export const OVERLAY_W = 2048;
export const OVERLAY_H = 1024;

/**
 * Selection wash resolution. Every country tap repaints this canvas and
 * re-uploads all of it: at 2048×1024 that is an 8 MB texture upload on the
 * frame of the tap, which a phone feels. The wash is a soft fill under a 1.8px
 * outline, so half the axis costs it almost nothing.
 */
export const overlaySize = (tier: "low" | "mid" | "high"): [number, number] =>
  tier === "high" ? [OVERLAY_W, OVERLAY_H] : [OVERLAY_W / 2, OVERLAY_H / 2];

/** Gold selection wash only — no cascade / role fill. */
export function paintAtlas(
  ctx: CanvasRenderingContext2D,
  countries: CountryFeat[],
  selected: string | null,
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!selected) return;
  const c = countries.find((x) => x.name === selected);
  if (!c) return;
  const projection = geoEquirectangular()
    .scale(w / (2 * Math.PI))
    .translate([w / 2, h / 2])
    .precision(0.3);
  const path = geoPath(projection, ctx);
  ctx.beginPath();
  path(c.feature);
  ctx.fillStyle = "rgba(200,144,80,0.28)";
  ctx.fill();
  ctx.strokeStyle = "rgba(200,144,80,0.95)";
  ctx.lineWidth = Math.max(1, (1.8 * w) / OVERLAY_W);
  ctx.stroke();
}

export function ringsOf(geom: GeoJSON.Geometry): number[][][] {
  if (geom.type === "Polygon") return geom.coordinates as number[][][];
  if (geom.type === "MultiPolygon") return (geom.coordinates as number[][][][]).flat();
  return [];
}

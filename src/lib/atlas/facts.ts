/**
 * What a country is, beyond an outline: its capital, where that capital sits,
 * and the handful of measured numbers worth putting on screen. Built from
 * Natural Earth and `world-countries` by `scripts/build-atlas-data.mjs`.
 */

export type CountryFact = {
  capital?: string;
  /** Capital coordinates, WGS84. */
  lat?: number;
  lon?: number;
  capitalPop?: number | null;
  iso?: string;
  region?: string | null;
  subregion?: string | null;
  /** km². */
  area?: number | null;
  landlocked?: boolean;
  /** Land neighbours. Zero means an island, or a country on one border. */
  neighbours?: number | null;
};

export type FactBook = Record<string, CountryFact>;

export async function loadFacts(): Promise<FactBook> {
  const res = await fetch("/geo/country-facts.json");
  if (!res.ok) throw new Error("country facts unreachable");
  return (await res.json()) as FactBook;
}

const fmt = new Intl.NumberFormat("en-US");

/** `1.0 M km²` — area at a glance, not to the hectare. */
export const formatArea = (km2: number): string =>
  km2 >= 1_000_000
    ? `${(km2 / 1_000_000).toFixed(1)} M km²`
    : km2 >= 1000
      ? `${Math.round(km2 / 1000)} k km²`
      : `${fmt.format(Math.round(km2))} km²`;

/** `11.9 M` — capital population, which is a metro estimate, so no decimals of a person. */
export const formatPop = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} M` : `${Math.round(n / 1000)} k`;

/**
 * The measured line, for every country. Only what the data says — a country
 * with no story attached still gets something true rather than something made
 * up to fill the space.
 */
export const factLine = (f: CountryFact | undefined): string | null => {
  if (!f) return null;
  const bits: string[] = [];
  if (f.subregion) bits.push(f.subregion.toLowerCase());
  else if (f.region) bits.push(f.region.toLowerCase());
  if (f.area) bits.push(formatArea(f.area));
  if (f.landlocked) bits.push("landlocked");
  else if (f.neighbours === 0) bits.push("no land border");
  else if (f.neighbours) bits.push(`${f.neighbours} land neighbours`);
  return bits.length ? bits.join(" · ") : null;
};

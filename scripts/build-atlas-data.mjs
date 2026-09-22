/**
 * Builds the two static data files the atlas reads at runtime, from Natural
 * Earth (same source family as `countries-110m.json`, so the country names
 * join without guesswork) and `world-countries` for region and area.
 *
 *   node scripts/build-atlas-data.mjs
 *
 * Needs network. Outputs are committed — this is a tool, not a build step.
 */
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";

const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

const round = (v, p = 3) => Number(v.toFixed(p));

/** Natural Earth's own country spelling, as used by the topology we render. */
const topoNames = async () => {
  const topo = JSON.parse(await readFile("public/geo/countries-110m.json", "utf8"));
  return topo.objects.countries.geometries.map((g) => g.properties?.name).filter(Boolean);
};

/** NE spellings that differ between the places layer and the country layer. */
const ADM0_ALIAS = {
  "United States of America": "United States",
  "Dem. Rep. Congo": "Congo (Kinshasa)",
  Congo: "Congo (Brazzaville)",
  Bahamas: "The Bahamas",
  Gambia: "The Gambia",
  Macedonia: "North Macedonia",
  "N. Cyprus": "Cyprus",
  "Central African Rep.": "Central African Republic",
  "Dominican Rep.": "Dominican Republic",
  "Eq. Guinea": "Equatorial Guinea",
  "S. Sudan": "South Sudan",
  "Bosnia and Herz.": "Bosnia and Herzegovina",
  "Solomon Is.": "Solomon Islands",
  Czechia: "Czech Republic",
  eSwatini: "eSwatini",
  Myanmar: "Myanmar",
  "Timor-Leste": "East Timor",
  Somaliland: "Somaliland",
  "W. Sahara": "Western Sahara",
  "Falkland Is.": "Falkland Islands",
  "Fr. S. Antarctic Lands": "French Southern and Antarctic Lands",
  "Côte d'Ivoire": "Ivory Coast",
};

/** `world-countries` spellings, for the ones NE writes differently. */
const WC_ALIAS = {
  "United States of America": "United States",
  "Dem. Rep. Congo": "DR Congo",
  Congo: "Republic of the Congo",
  "Central African Rep.": "Central African Republic",
  "Dominican Rep.": "Dominican Republic",
  "Eq. Guinea": "Equatorial Guinea",
  "S. Sudan": "South Sudan",
  "Bosnia and Herz.": "Bosnia and Herzegovina",
  "Solomon Is.": "Solomon Islands",
  Czechia: "Czechia",
  Macedonia: "North Macedonia",
  eSwatini: "Eswatini",
  "Timor-Leste": "Timor-Leste",
  "N. Cyprus": null,
  Somaliland: null,
  "W. Sahara": "Western Sahara",
  "Falkland Is.": "Falkland Islands",
  "Fr. S. Antarctic Lands": "French Southern and Antarctic Lands",
  "Côte d'Ivoire": "Ivory Coast",
  Kosovo: "Kosovo",
  "Br. Indian Ocean Ter.": "British Indian Ocean Territory",
  "Fr. Polynesia": "French Polynesia",
  "N. Mariana Is.": "Northern Mariana Islands",
  "Turks and Caicos Is.": "Turks and Caicos Islands",
  "U.S. Virgin Is.": "United States Virgin Islands",
  "British Virgin Is.": "British Virgin Islands",
  "Cayman Is.": "Cayman Islands",
  "Faeroe Is.": "Faroe Islands",
  Åland: "Åland Islands",
  "Saint Helena": "Saint Helena, Ascension and Tristan da Cunha",
  "St. Pierre and Miquelon": "Saint Pierre and Miquelon",
  "St. Vin. and Gren.": "Saint Vincent and the Grenadines",
  "St. Kitts and Nevis": "Saint Kitts and Nevis",
  "Antigua and Barb.": "Antigua and Barbuda",
  Bahamas: "Bahamas",
  "Cabo Verde": "Cape Verde",
  "São Tomé and Principe": "São Tomé and Príncipe",
  "Marshall Is.": "Marshall Islands",
  Micronesia: "Micronesia",
  Vatican: "Vatican City",
  Palestine: "Palestine",
  Brunei: "Brunei",
  Laos: "Laos",
  Syria: "Syria",
  Iran: "Iran",
  Russia: "Russia",
  Vietnam: "Vietnam",
  "South Korea": "South Korea",
  "North Korea": "North Korea",
  Moldova: "Moldova",
  Tanzania: "Tanzania",
  Venezuela: "Venezuela",
  Bolivia: "Bolivia",
  "United Kingdom": "United Kingdom",
  Turkey: "Türkiye",
};

const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

async function capitals() {
  const fc = await get(`${NE}/ne_110m_populated_places_simple.geojson`);
  const byCountry = new Map();
  for (const f of fc.features) {
    const p = f.properties;
    if (!String(p.featurecla || "").startsWith("Admin-0 capital")) continue;
    const [lon, lat] = f.geometry.coordinates;
    const entry = {
      capital: p.name,
      lat: round(lat),
      lon: round(lon),
      capitalPop: p.pop_max ?? null,
      iso2: p.iso_a2 && p.iso_a2 !== "-99" ? p.iso_a2 : null,
    };
    // A country with two seats keeps the bigger one; NE marks the rest "alt".
    const key = norm(p.adm0name ?? "");
    const held = byCountry.get(key);
    if (!held || (entry.capitalPop ?? 0) > (held.capitalPop ?? 0)) byCountry.set(key, entry);
  }
  return byCountry;
}

async function main() {
  const names = await topoNames();
  const caps = await capitals();
  const wc = require("world-countries");
  const wcByName = new Map(wc.map((c) => [norm(c.name.common), c]));

  const out = {};
  const missing = { capital: [], facts: [] };

  for (const name of names) {
    const capKey = norm(ADM0_ALIAS[name] ?? name);
    const cap = caps.get(capKey) ?? caps.get(norm(name));
    const wcName = name in WC_ALIAS ? WC_ALIAS[name] : name;
    const c = wcName ? (wcByName.get(norm(wcName)) ?? wcByName.get(norm(name))) : null;
    if (!cap) missing.capital.push(name);
    if (!c) missing.facts.push(name);
    if (!cap && !c) continue;
    out[name] = {
      ...(cap
        ? { capital: cap.capital, lat: cap.lat, lon: cap.lon, capitalPop: cap.capitalPop }
        : null),
      ...(c
        ? {
            iso: c.cca3,
            region: c.region || null,
            subregion: c.subregion || null,
            area: c.area ?? null,
            landlocked: Boolean(c.landlocked),
            neighbours: Array.isArray(c.borders) ? c.borders.length : null,
          }
        : null),
    };
  }

  await writeFile("public/geo/country-facts.json", JSON.stringify(out) + "\n");

  const rivers = await get(`${NE}/ne_110m_rivers_lake_centerlines.geojson`);
  const LABEL = { Chang: "Yangtze", Donau: "Danube", Amazonas: "Amazon", Peace: "Peace–Mackenzie" };
  const features = [];
  for (const f of rivers.features) {
    const name = f.properties?.name;
    if (!name || f.geometry?.type !== "LineString") continue;
    // NE ships a 2-vertex "Yangtze" stub next to the real "Chang" course.
    if (name === "Yangtze") continue;
    // Vertex order is source → mouth at 110m. That is a longest-system line,
    // not the culturally named stem (Mississippi = Missouri–Mississippi, etc).
    const coords = f.geometry.coordinates.map(([lon, lat]) => [round(lon), round(lat)]);
    if (coords.length < 4) continue;
    features.push({ name: LABEL[name] ?? name, coords });
  }
  features.sort((a, b) => a.name.localeCompare(b.name));
  await writeFile("public/geo/rivers.json", JSON.stringify({ rivers: features }) + "\n");

  console.log(`countries ${Object.keys(out).length}/${names.length}`);
  console.log(`no capital (${missing.capital.length}):`, missing.capital.join(", ") || "none");
  console.log(`no facts   (${missing.facts.length}):`, missing.facts.join(", ") || "none");
  console.log(`rivers ${features.length}:`, features.map((f) => f.name).join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

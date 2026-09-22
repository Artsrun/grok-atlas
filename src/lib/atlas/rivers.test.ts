import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

type River = { name: string; coords: [number, number][] };

const rivers: River[] = JSON.parse(
  readFileSync(new URL("../../../public/geo/rivers.json", import.meta.url), "utf8"),
).rivers;

const by = new Map(rivers.map((r) => [r.name, r.coords]));
const ends = (name: string) => {
  const c = by.get(name);
  assert.ok(c && c.length > 3, `${name} missing`);
  return { first: c[0], last: c[c.length - 1] };
};

const near = (got: number, want: number, tol: number, label: string) => {
  assert.ok(Math.abs(got - want) < tol, `${label}: ${got} !~= ${want} ±${tol}`);
};

test("twelve named courses, no stubs", () => {
  assert.equal(rivers.length, 12);
  assert.deepEqual(
    rivers.map((r) => r.name),
    [
      "Amazon",
      "Brahmaputra",
      "Congo",
      "Danube",
      "Lena",
      "Mekong",
      "Mississippi",
      "Nile",
      "Ob",
      "Paraná",
      "Peace–Mackenzie",
      "Yangtze",
    ],
  );
  for (const r of rivers) assert.ok(r.coords.length >= 4, r.name);
});

/**
 * Natural Earth 110m draws the *longest system*, not the culturally named
 * stem. Endpoints are locked to that contract so a rebuild cannot silently
 * flip a pulse. Names stay popular; the comment is the honesty.
 *
 *   Mississippi = Missouri–Mississippi (Brower / Jefferson headwaters, not Itasca)
 *   Ob          = Ob–Irtysh (Black Irtysh, Xinjiang)
 *   Paraná      = Paraguay–Paraná to the Río de la Plata
 *   Nile        = Victoria / Jinja convention at this scale, not Kagera vs Blue Nile
 */
test("every mouth sits in the sea it actually reaches", () => {
  const nile = ends("Nile");
  near(nile.first[1], 0.26, 1, "Nile src lat ~ Victoria");
  near(nile.last[1], 31.5, 1.5, "Nile mouth lat ~ Mediterranean");
  assert.ok(nile.last[1] > nile.first[1] + 20, "Nile runs north");

  const congo = ends("Congo");
  near(congo.last[0], 12.3, 1.5, "Congo mouth lon ~ Atlantic");
  assert.ok(congo.last[0] < congo.first[0] - 8, "Congo runs west");

  const miss = ends("Mississippi");
  near(miss.first[1], 44.7, 1.5, "Missouri–Mississippi src ~ Jefferson headwaters");
  near(miss.last[1], 29.2, 1.5, "mouth ~ Gulf");
  assert.ok(miss.last[1] < miss.first[1] - 8, "runs south");
  assert.ok(miss.first[0] < -108, "source is Montana, not Itasca");

  const danube = ends("Danube");
  near(danube.first[0], 8.2, 1, "Black Forest");
  near(danube.last[0], 29.6, 1, "Black Sea");

  const amazon = ends("Amazon");
  near(amazon.first[1], -15.3, 1.5, "Apurímac highlands");
  near(amazon.last[0], -50.6, 1.5, "Atlantic mouth");

  const yangtze = ends("Yangtze");
  near(yangtze.first[1], 34.3, 1.5, "Sanjiangyuan");
  near(yangtze.last[0], 121.9, 1.5, "East China Sea");

  const ob = ends("Ob");
  near(ob.first[1], 47.7, 1.5, "Black Irtysh / Altai");
  near(ob.last[1], 66.7, 1.5, "Ob Gulf");
  assert.ok(ob.first[0] > 88, "source is Irtysh, not Biya/Katun");

  const parana = ends("Paraná");
  near(parana.first[1], -14.3, 1.5, "Paraguay headwaters");
  near(parana.last[1], -34.0, 1.5, "Río de la Plata");

  const lena = ends("Lena");
  near(lena.first[1], 54.0, 1.5, "Baikal hinterland");
  near(lena.last[1], 72.9, 1.5, "Laptev");

  const mekong = ends("Mekong");
  near(mekong.first[1], 33.2, 1.5, "Tibetan plateau");
  near(mekong.last[1], 9.4, 1.5, "Mekong delta");

  const brah = ends("Brahmaputra");
  near(brah.first[1], 30.4, 1.5, "Yarlung Tsangpo source");
  near(brah.last[0], 90.5, 1.5, "Bengal mouth");

  const peace = ends("Peace–Mackenzie");
  near(peace.first[1], 56.8, 1.5, "Peace headwaters");
  near(peace.last[1], 69.4, 1.5, "Beaufort");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  attachVitals,
  factLine,
  flagSrc,
  formatPhones,
  formatTld,
  type FactBook,
} from "./facts.ts";

const facts = attachVitals(
  JSON.parse(readFileSync("public/geo/country-facts.json", "utf8")) as FactBook,
  JSON.parse(readFileSync("public/geo/country-vitals.json", "utf8")),
);

test("vital fields ride the fact sheet", () => {
  const am = facts["Armenia"];
  assert.equal(am.iso2, "AM");
  assert.equal(am.flag, "🇦🇲");
  assert.deepEqual(am.tld, [".am"]);
  assert.deepEqual(am.phones, ["+374"]);
  assert.equal(am.currency, "AMD");
  assert.equal(facts["United States of America"].phones?.[0], "+1");
  assert.equal(facts["United Kingdom"].phones?.[0], "+44");
});

test("TLD and phone lists stay short enough to print", () => {
  assert.equal(formatTld([".am"]), ".am");
  assert.equal(formatTld([".uk", ".co.uk", ".gov.uk", ".ac.uk"]), ".uk · .co.uk · .gov.uk");
  assert.equal(formatTld(undefined), null);
  assert.equal(formatPhones(["+374"]), "+374");
  assert.equal(
    formatPhones(["+1", "+1-868", "+1-246", "+1-268", "+1-284"]),
    "+1 · +1-868 · +1-246 · +1-268",
  );
  assert.equal(flagSrc("AM"), "https://flagcdn.com/h24/am.png");
  assert.equal(flagSrc(undefined), null);
});

test("measured line still holds after vitals land", () => {
  assert.match(factLine(facts["Armenia"]) ?? "", /landlocked/);
});

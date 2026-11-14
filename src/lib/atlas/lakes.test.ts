import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

type Lake = { name: string; rings: [number, number][][] };

const lakes: Lake[] = JSON.parse(
  readFileSync(new URL("../../../public/geo/lakes.json", import.meta.url), "utf8"),
).lakes;

const names = new Set(lakes.map((l) => l.name));

test("twenty-four 110m lakes, seas stay out", () => {
  assert.equal(lakes.length, 24);
  for (const need of ["Lake Baikal", "Lake Victoria", "Lake Superior", "Lake Tanganyika", "Lago Titicaca"]) {
    assert.ok(names.has(need), need);
  }
  assert.equal(names.has("Caspian Sea"), false, "Caspian is a marine polygon, not a lake");
  assert.equal(names.has("Lake Sevan"), false, "Sevan is below 110m");
  for (const lake of lakes) {
    assert.ok(lake.rings.length > 0, lake.name);
    for (const ring of lake.rings) assert.ok(ring.length >= 4, lake.name);
  }
});

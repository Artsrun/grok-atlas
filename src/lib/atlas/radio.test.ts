import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SAA,
  TDRS,
  cosmicCount,
  footprintHalfAngle,
  footprintRing,
  inFootprint,
  kpFromRows,
  lonDelta,
  nearestTdrs,
  radioRings,
  wrapLon,
} from "./radio.ts";

const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

test("nearest TDRS is the smallest wrapped longitude gap", () => {
  assert.equal(nearestTdrs(-40).id, "E");
  assert.equal(nearestTdrs(-170).id, "W");
  assert.equal(nearestTdrs(80).id, "Z");
  assert.equal(nearestTdrs(179).id, "W");
  assert.ok(lonDelta(-179, 179) < 3);
  assert.equal(wrapLon(190), -170);
  assert.equal(TDRS.length, 3);
});

test("footprint half-angle at ISS altitude is about 20°", () => {
  const a = footprintHalfAngle(420);
  near(a, Math.acos(6371 / 6791), 1e-9);
  assert.ok(a > 0.3 && a < 0.4);
  const ring = footprintRing(0, 0, a, 32);
  assert.equal(ring.length, 33);
  assert.ok(ring.every((p) => Math.abs(p.lat) < 30 && Math.abs(p.lon) < 30));
  assert.ok(inFootprint({ lat: 0, lon: 0, alt: 420 }, { lat: 5, lon: 5 }));
  assert.ok(!inFootprint({ lat: 0, lon: 0, alt: 420 }, { lat: 50, lon: 0 }));
});

test("kp parser fails open and clamps", () => {
  assert.equal(kpFromRows([]), 2);
  assert.equal(kpFromRows(null), 2);
  assert.equal(kpFromRows([{ kp_index: 4 }]), 4);
  assert.equal(kpFromRows([{ kp: 7 }, { kp_index: 1 }]), 1);
  assert.equal(kpFromRows([{ kp_index: 99 }]), 9);
  assert.equal(radioRings("low"), 1);
  assert.equal(radioRings("high"), 3);
  assert.equal(cosmicCount("mid"), 80);
  assert.ok(SAA.lat < 0 && SAA.lon < 0);
});

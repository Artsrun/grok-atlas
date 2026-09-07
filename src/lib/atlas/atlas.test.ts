import assert from "node:assert/strict";
import { test } from "node:test";
import { ll2xyz, xyz2ll } from "./geo.ts";
import { HOME, VIEWS } from "./model.ts";
import { skyAt, wrapLon } from "./ephemeris.ts";
import { subsolarLat, OBLIQUITY } from "./sun.ts";
import { elongation, springFactor, springLabel, tideAt } from "./tide.ts";

const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

test("ll2xyz / xyz2ll round-trip", () => {
  for (const [lat, lon] of [
    [0, 0],
    [40.177, 44.487],
    [-33.9, 151.2],
    [-54, -68],
    [12, 179.9],
    [12, -179.9],
  ]) {
    const [x, y, z] = ll2xyz(lat, lon);
    const back = xyz2ll(x, y, z);
    near(back.lat, lat, 1e-9);
    near(back.lon, lon, 1e-9);
  }
});

test("xyz2ll wraps longitude into (-180, 180]", () => {
  for (let lon = -540; lon <= 540; lon += 37) {
    const { lon: got } = xyz2ll(...ll2xyz(10, lon));
    assert.ok(got > -180.0001 && got <= 180.0001, `${lon} -> ${got}`);
  }
});

test("subsolar latitude stays inside the obliquity band", () => {
  for (let lon = 0; lon < 360; lon += 1) {
    assert.ok(Math.abs(subsolarLat(lon)) <= OBLIQUITY + 1e-9);
  }
});

test("skyAt terminator sits on the current UTC afternoon", () => {
  const noon = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
  const sky = skyAt(noon);
  near(wrapLon(sky.sunLon), 0, 0.6);
  assert.ok(Math.abs(sky.sunLat - OBLIQUITY) < 1.2, "June solstice declination");
});

test("new moon sits with the sun", () => {
  const known = new Date(Date.UTC(2000, 0, 6, 18, 14));
  const sky = skyAt(known);
  assert.ok(sky.age < 0.6 || sky.age > 29, `age ${sky.age}`);
  near(elongation(sky.moonLon, sky.sunLon), 0, 8);
});

test("elongation is symmetric and capped at 180", () => {
  near(elongation(10, 350), 20, 1e-9);
  near(elongation(0, 180), 180, 1e-9);
});

test("spring / neap classification tracks the syzygy factor", () => {
  assert.equal(springLabel(0, 0), "spring");
  assert.equal(springLabel(90, 0), "neap");
  near(springFactor(0, 0), 1, 1e-9);
});

test("tide is a P2 field: sub-lunar and antipodal bulges match", () => {
  const sub = tideAt(0, 0, 0, 90);
  const anti = tideAt(0, 180, 0, 90);
  near(sub, anti, 1e-9);
  assert.ok(sub > 0);
});

test("views have no Nile home and sit inside the orbit clamp", () => {
  assert.equal(HOME.id, "here");
  assert.ok(!VIEWS.some((v) => v.id === "nile"));
  const ids = VIEWS.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const v of VIEWS) {
    assert.ok(Math.abs(v.lat) <= 90 && Math.abs(v.lon) <= 180, v.id);
    assert.ok(v.dist > 1.42 && v.dist < 14, v.id);
  }
});

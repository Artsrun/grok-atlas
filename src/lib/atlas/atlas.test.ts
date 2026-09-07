import assert from "node:assert/strict";
import { test } from "node:test";
import { DR, ll2xyz, xyz2ll } from "./geo.ts";
import type { CountryFeat } from "./geo.ts";
import {
  boundsSpan,
  CLOSEST_FRAME,
  distAt,
  distForBounds,
  flyDuration,
  flyPath,
  FOV,
  MAX_DIST,
  MIN_DIST,
  spanAt,
} from "./fly.ts";
import { HOME, VIEWS } from "./model.ts";
import { skyAt, wrapLon } from "./ephemeris.ts";
import { subsolarLat, OBLIQUITY } from "./sun.ts";
import { elongation, springFactor, springLabel, tideAt } from "./tide.ts";

type Bounds = CountryFeat["bounds"];

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

test("flyPath endpoints are exact in w and u", () => {
  for (const [w0, w1, u1] of [
    [0.4, 0.4, 1.2],
    [0.4, 1.8, 0.3],
    [1.8, 0.2, 2.9],
    [0.9, 0.35, 0.001],
  ]) {
    const p = flyPath(w0, w1, u1);
    near(p.at(0).w, w0, 1e-9);
    near(p.at(0).u, 0, 1e-9);
    near(p.at(p.S).w, w1, 1e-9);
    near(p.at(p.S).u, u1, 1e-9);
  }
});

test("flyPath dollies when there is no arc", () => {
  const p = flyPath(0.5, 2, 0);
  near(p.at(0).w, 0.5, 1e-12);
  near(p.at(p.S).w, 2, 1e-12);
  assert.equal(p.at(p.S / 2).u, 0);
});

test("flyPath arcs out before it arrives — the Mapbox zoom-out", () => {
  const p = flyPath(0.5, 0.5, 2.4);
  const mid = p.at(p.S / 2).w;
  assert.ok(mid > 0.5 * 1.5, `mid span ${mid} should overshoot both ends`);
});

test("flyPath u is monotone across the flight", () => {
  const p = flyPath(0.3, 1.1, 1.7);
  let prev = -1;
  for (let i = 0; i <= 40; i++) {
    const { u } = p.at((i / 40) * p.S);
    assert.ok(u > prev, `u regressed at ${i}`);
    prev = u;
  }
});

test("flyDuration scales with distance and stays clamped", () => {
  const near1 = flyPath(spanAt(2.5), spanAt(2.5), 0.05);
  const far = flyPath(spanAt(2.5), spanAt(2.5), 3.0);
  assert.ok(flyDuration(far.S) > flyDuration(near1.S));
  assert.ok(flyDuration(0) >= 0.3 && flyDuration(1e6) <= 3.2);
});

test("spanAt / distAt round-trip inside the orbit clamp", () => {
  for (const d of [MIN_DIST, 2.15, 2.55, 7.2, MAX_DIST]) near(distAt(spanAt(d)), d, 1e-9);
});

test("distForBounds frames big and small features differently", () => {
  const lux: Bounds = [
    [5.7, 49.4],
    [6.5, 50.2],
  ];
  const indonesia: Bounds = [
    [95.3, -10.4],
    [141, 5.5],
  ];
  const russia: Bounds = [
    [19.6, 41.2],
    [-169.6, 81.9],
  ];
  const dLux = distForBounds(lux);
  const dIndo = distForBounds(indonesia);
  const dRussia = distForBounds(russia);
  assert.ok(dLux < dIndo && dIndo < dRussia, `${dLux} ${dIndo} ${dRussia}`);
  for (const d of [dLux, dIndo, dRussia]) assert.ok(d >= CLOSEST_FRAME && d <= MAX_DIST);
  assert.equal(
    dLux,
    CLOSEST_FRAME,
    "a small country pins to the framing floor, not the orbit clamp",
  );
  assert.ok(CLOSEST_FRAME > MIN_DIST, "framing floor sits above the manual-orbit clamp");
});

test("distForBounds keeps the limb in frame at the floor", () => {
  // Sphere angular diameter must clear the vertical FOV, else no horizon.
  assert.ok(2 * Math.asin(1 / CLOSEST_FRAME) > (FOV * DR) / 2);
});

test("boundsSpan follows a box across the antimeridian", () => {
  const fiji: Bounds = [
    [177, -18.3],
    [-179.8, -16.1],
  ];
  assert.ok(boundsSpan(fiji) < 5 * DR, `${boundsSpan(fiji) / DR}° should not wrap to ~357°`);
});

test("boundsSpan narrows a lon span at high latitude", () => {
  const equator: Bounds = [
    [0, -1],
    [30, 1],
  ];
  const arctic: Bounds = [
    [0, 74],
    [30, 76],
  ];
  assert.ok(boundsSpan(arctic) < boundsSpan(equator));
});

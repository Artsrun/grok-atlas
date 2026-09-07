import assert from "node:assert/strict";
import { test } from "node:test";
import { ll2xyz, xyz2ll } from "./geo.ts";
import { HOME, VIEWS } from "./model.ts";
import { subsolarLat, OBLIQUITY } from "./sun.ts";
import { elongation, springFactor, springLabel, tideAt } from "./tide.ts";

const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

test("ll2xyz / xyz2ll round-trip", () => {
  for (const [lat, lon] of [
    [0, 0],
    [40.177, 44.487],
    [-33.9, 151.2],
    [30.2, 31.1],
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

test("xyz2ll survives a degenerate origin", () => {
  const { lat, lon } = xyz2ll(0, 0, 0);
  assert.ok(Number.isFinite(lat) && Number.isFinite(lon));
});

test("subsolar latitude stays inside the obliquity band", () => {
  for (let lon = 0; lon < 360; lon += 1) {
    assert.ok(Math.abs(subsolarLat(lon)) <= OBLIQUITY + 1e-9);
  }
  near(subsolarLat(0), 0, 1e-12);
  near(subsolarLat(90), OBLIQUITY, 1e-12);
  near(subsolarLat(270), -OBLIQUITY, 1e-12);
});

test("elongation is symmetric and capped at 180", () => {
  near(elongation(10, 350), 20, 1e-9);
  near(elongation(350, 10), 20, 1e-9);
  near(elongation(0, 180), 180, 1e-9);
  for (let a = 0; a < 360; a += 13) {
    for (let b = 0; b < 360; b += 17) {
      const e = elongation(a, b);
      assert.ok(e >= 0 && e <= 180);
      near(e, elongation(b, a), 1e-9);
    }
  }
});

test("spring / neap classification tracks the syzygy factor", () => {
  assert.equal(springLabel(0, 0), "spring");
  assert.equal(springLabel(180, 0), "spring");
  assert.equal(springLabel(90, 0), "neap");
  assert.equal(springLabel(45, 0), "mid");
  near(springFactor(0, 0), 1, 1e-9);
  near(springFactor(90, 0), 0, 1e-9);
});

test("tide is a P2 field: sub-lunar and antipodal bulges match", () => {
  const sub = tideAt(0, 0, 0, 90);
  const anti = tideAt(0, 180, 0, 90);
  near(sub, anti, 1e-9);
  assert.ok(sub > 0, "sub-lunar point should bulge");
  assert.ok(tideAt(0, 90, 0, 90) < 0, "quadrature should trough");
});

test("views carry a distance and HOME is the cupola frame", () => {
  assert.equal(HOME.id, "nile");
  assert.ok(HOME.dist > 1);
  const ids = VIEWS.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length, "view ids must be unique");
  for (const v of VIEWS) {
    assert.ok(Math.abs(v.lat) <= 90 && Math.abs(v.lon) <= 180, v.id);
    assert.ok(v.dist > 1.42 && v.dist < 11, `${v.id} must sit inside the orbit clamp`);
  }
});

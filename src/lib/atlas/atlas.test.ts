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
import { formatHash, parseHash } from "./hash.ts";
import { cameraListeners, emitCamera, onCamera, onFlyRequest, requestFly } from "./camera.ts";
import { subsolarLat, OBLIQUITY } from "./sun.ts";
import { elongation, springFactor, springLabel, tideAt } from "./tide.ts";
import { classifyDevice } from "./device.ts";
import { ORBIT, classifyPointer } from "./pointer.ts";

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

test("hash round-trips a camera at write precision", () => {
  for (const at of [
    { lat: 40.177, lon: 44.487, dist: 2.55 },
    { lat: -33.9, lon: 151.2, dist: 3.59 },
    { lat: 0, lon: -180, dist: 1.42 },
    { lat: 90, lon: 180, dist: 14 },
  ]) {
    const back = parseHash(formatHash(at));
    assert.ok(back, `no parse for ${formatHash(at)}`);
    near(back.lat, at.lat, 5e-4);
    near(back.lon, wrapLon(at.lon), 5e-4);
    near(back.dist, at.dist, 5e-3);
  }
});

test("parseHash rejects anything that is not lat/lon/dist", () => {
  for (const bad of [
    "",
    "#",
    "#v=2",
    "#40.1/44.4",
    "#40.1/44.4/2.5/0",
    "#a/b/c",
    "#40.1,44.4,2.5",
  ]) {
    assert.equal(parseHash(bad), null, bad);
  }
});

test("parseHash clamps range but keeps a hand-typed hash usable", () => {
  assert.deepEqual(parseHash("#40/44/1"), { lat: 40, lon: 44, dist: MIN_DIST });
  assert.deepEqual(parseHash("#40/44/99"), { lat: 40, lon: 44, dist: MAX_DIST });
  assert.equal(parseHash("#120/44/3")?.lat, 90);
  assert.equal(parseHash("#40/540/3")?.lon, wrapLon(540), "540° is the antimeridian, not 180");
});

test("formatHash normalises longitude so the same view writes one string", () => {
  assert.equal(
    formatHash({ lat: 10, lon: 190, dist: 3 }),
    formatHash({ lat: 10, lon: -170, dist: 3 }),
  );
});

test("hash accepts a leading marker or none", () => {
  assert.deepEqual(parseHash("#40/44/3"), parseHash("40/44/3"));
});

test("camera events fan out and unsubscribe cleanly", () => {
  const seen: string[] = [];
  const off = onCamera("moveend", (at) => seen.push(`a${at.lat}`));
  const off2 = onCamera("moveend", (at) => seen.push(`b${at.lat}`));
  assert.equal(cameraListeners("moveend"), 2);
  emitCamera("moveend", { lat: 1, lon: 0, dist: 2 });
  off();
  emitCamera("moveend", { lat: 2, lon: 0, dist: 2 });
  off2();
  emitCamera("moveend", { lat: 3, lon: 0, dist: 2 });
  assert.deepEqual(seen, ["a1", "b1", "b2"]);
  assert.equal(cameraListeners("moveend"), 0);
});

test("camera events do not cross channels", () => {
  const seen: string[] = [];
  const off = onCamera("move", () => seen.push("move"));
  emitCamera("moveend", { lat: 0, lon: 0, dist: 2 });
  emitCamera("movestart", { lat: 0, lon: 0, dist: 2 });
  assert.deepEqual(seen, []);
  off();
});

test("a flight requested before the rig mounts is replayed once", () => {
  requestFly({ lat: 10, lon: 20, label: "early" });
  const got: string[] = [];
  const off = onFlyRequest((f) => got.push(f.label ?? "?"));
  assert.deepEqual(got, ["early"], "the deep link still flies");
  const off2 = onFlyRequest((f) => got.push(`second:${f.label}`));
  assert.deepEqual(got, ["early"], "replay is consumed, not re-delivered");
  off();
  off2();
});

test("flights reach every live subscriber and stop at unsubscribe", () => {
  const got: string[] = [];
  const off = onFlyRequest((f) => got.push(`a${f.label}`));
  requestFly({ lat: 0, lon: 0, label: "x" });
  off();
  requestFly({ lat: 0, lon: 0, label: "y" });
  const off2 = onFlyRequest((f) => got.push(`b${f.label}`));
  assert.deepEqual(got, ["ax", "by"], "y was buffered while nobody listened");
  off2();
});

const probe = (over: Partial<Parameters<typeof classifyDevice>[0]>) =>
  classifyDevice({
    renderer: "Mali-G52",
    webgl2: true,
    maxTextureSize: 8192,
    cores: 6,
    memoryGb: 4,
    dpr: 2,
    mobile: true,
    saveData: false,
    ...over,
  });

test("SwiftShader and save-data stay on the compat path with no grain", () => {
  const soft = probe({ renderer: "Google SwiftShader", webgl2: true, cores: 8, memoryGb: 8 });
  assert.equal(soft.tier, "low");
  assert.equal(soft.grainLights, 0);
  assert.equal(soft.grainRelief, 0);
  assert.equal(soft.antialias, false);

  const data = probe({ saveData: true, renderer: "Apple M3" });
  assert.equal(data.tier, "low");
  assert.equal(data.grainLights, 0);
});

test("WebGL1 never gets heavy grain", () => {
  const cap = probe({ webgl2: false, renderer: "Apple GPU", cores: 8, dpr: 3 });
  assert.equal(cap.tier, "low");
  assert.equal(cap.grainLights, 0);
});

test("new Apple / Adreno / NVIDIA silicon get heavy light and relief grain", () => {
  const m4 = probe({
    renderer: "ANGLE (Apple, Apple M4, OpenGL 4.1)",
    mobile: false,
    cores: 10,
    memoryGb: 16,
    dpr: 2,
    maxTextureSize: 16384,
  });
  assert.equal(m4.tier, "high");
  assert.ok(m4.grainLights > 1, `lights ${m4.grainLights}`);
  assert.ok(m4.grainRelief > 1, `relief ${m4.grainRelief}`);
  assert.equal(m4.antialias, true);
  assert.ok(m4.dpr[1] >= 2);

  const adreno = probe({ renderer: "Adreno (TM) 740", cores: 8, memoryGb: 8, dpr: 3 });
  assert.equal(adreno.tier, "high");
  assert.ok(adreno.grainLights > 1);

  const rtx = probe({
    renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)",
    mobile: false,
    cores: 16,
    memoryGb: 32,
    dpr: 1.5,
  });
  assert.equal(rtx.tier, "high");
});

test("mid-tier mobile keeps a light grain and a cheaper sphere", () => {
  const cap = probe({ renderer: "Mali-G52", cores: 6, memoryGb: 4, dpr: 2, mobile: true });
  assert.equal(cap.tier, "mid");
  assert.ok(cap.grainLights > 0 && cap.grainLights < 0.6);
  assert.ok(cap.sphereSeg[0] < 96);
});

test("coarse orbit is heavier and ignores smaller taps than fine", () => {
  assert.ok(ORBIT.coarse.rotate > ORBIT.fine.rotate);
  assert.ok(ORBIT.coarse.zoom > ORBIT.fine.zoom);
  assert.ok(ORBIT.coarse.tap > ORBIT.fine.tap);
  assert.ok(ORBIT.coarse.damp > ORBIT.fine.damp);
});

test("pointer: hover-fine is desktop, coarse is toolbox, width is the fallback", () => {
  assert.equal(classifyPointer({ hoverFine: true, coarse: false, wide: true }), true);
  assert.equal(classifyPointer({ hoverFine: false, coarse: true, wide: true }), false, "iPad stays toolbox");
  assert.equal(classifyPointer({ hoverFine: false, coarse: false, wide: true }), true, "headless wide");
  assert.equal(classifyPointer({ hoverFine: false, coarse: false, wide: false }), false);
});

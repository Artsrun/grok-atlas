import { DR } from "./geo.ts";
import type { CountryFeat } from "./geo.ts";

/** Orbit clamp — single source for OrbitControls and every framing helper. */
export const MIN_DIST = 1.42;
export const MAX_DIST = 14;

/**
 * Closest a framing helper will pull in. Nearer than this the limb leaves the
 * frame and the globe reads as a wall, not a window — so small countries share
 * this one altitude rather than diving. Same idea as `maxZoom` on Mapbox
 * fitBounds. Manual orbit and explicit focus dists still reach MIN_DIST.
 */
export const CLOSEST_FRAME = 2.55;

/** Camera FOV in degrees. Mirrors <Canvas camera={{ fov }}>. */
export const FOV = 42;

/** van Wijk & Nuij zoom curve. Mapbox ships 1.42 as `curve`; so do we. */
export const RHO = 1.42;
const RHO2 = RHO * RHO;

/** Mapbox `speed` — screenfuls per second. */
export const FLY_SPEED = 1.2;
const MIN_SEC = 0.3;
const MAX_SEC = 3.2;

/** Floor on camera altitude so `spanAt` never collapses to zero at the clamp. */
const MIN_ALT = 0.02;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type FlyPath = {
  /** Path length in ρ-normalised units. Duration falls out of this. */
  S: number;
  /** u = arc travelled (earth radii), w = visible surface span at that instant. */
  at: (s: number) => { u: number; w: number };
};

/**
 * Smooth-and-efficient zooming and panning (van Wijk & Nuij 2003).
 * Zooms out, arcs, zooms back in — the shape Mapbox `flyTo` uses.
 *
 * @param w0 visible span at the start, @param w1 at the end, @param u1 arc between them.
 */
export const flyPath = (w0: number, w1: number, u1: number): FlyPath => {
  if (!(w0 > 0) || !(w1 > 0)) throw new RangeError("flyPath needs positive spans");
  // Pure dolly: no arc to cover, so ride the exponential in w alone.
  if (!(Math.abs(u1) > 1e-6)) {
    const k = Math.log(w1 / w0);
    const dir = Math.sign(k) || 1;
    return { S: Math.abs(k) / RHO, at: (s) => ({ u: 0, w: w0 * Math.exp(dir * RHO * s) }) };
  }
  const b = (i: 0 | 1) => {
    const w = i ? w1 : w0;
    return (w1 * w1 - w0 * w0 + (i ? -1 : 1) * RHO2 * RHO2 * u1 * u1) / (2 * w * RHO2 * u1);
  };
  const r = (i: 0 | 1) => Math.log(-b(i) + Math.sqrt(b(i) * b(i) + 1));
  const r0 = r(0);
  const S = (r(1) - r0) / RHO;
  const coshR0 = Math.cosh(r0);
  const sinhR0 = Math.sinh(r0);
  return {
    S,
    at: (s) => ({
      u: (w0 / RHO2) * (coshR0 * Math.tanh(RHO * s + r0) - sinhR0),
      w: (w0 * coshR0) / Math.cosh(RHO * s + r0),
    }),
  };
};

/** Seconds for a path. Distance sets the clock, not a constant. */
export const flyDuration = (S: number, speed = FLY_SPEED) => clamp(S / speed, MIN_SEC, MAX_SEC);

/** Span of sphere surface inside the frustum, in earth radii. */
export const spanAt = (dist: number, fovDeg = FOV) =>
  2 * Math.max(dist - 1, MIN_ALT) * Math.tan((fovDeg * DR) / 2);

/** Inverse of `spanAt` — back to an orbit radius. */
export const distAt = (span: number, fovDeg = FOV) => 1 + span / (2 * Math.tan((fovDeg * DR) / 2));

/** Angular extent of a lon/lat box on the sphere, in radians. */
export const boundsSpan = ([[w, s], [e, n]]: CountryFeat["bounds"]): number => {
  const midLat = (n + s) / 2;
  const rawLon = e - w;
  const lonDeg = (rawLon < 0 ? rawLon + 360 : rawLon) * Math.cos(midLat * DR);
  return Math.max(n - s, lonDeg) * DR;
};

/**
 * Mapbox `cameraForBounds`, one axis shorter: the orbit radius that frames a
 * feature at `fill` of the vertical FOV. Russia and Luxembourg stop tying.
 */
export const distForBounds = (bounds: CountryFeat["bounds"], fill = 0.62, fovDeg = FOV) => {
  const alpha = clamp(boundsSpan(bounds) / 2, 0.004, 1.35);
  const theta = ((fovDeg * DR) / 2) * fill;
  return clamp(Math.cos(alpha) + Math.sin(alpha) / Math.tan(theta), CLOSEST_FRAME, MAX_DIST);
};

/** Focus for a country, framed to its own bounds. */
export const focusForCountry = (c: CountryFeat) => ({
  ...c.centroid,
  label: c.name,
  dist: distForBounds(c.bounds),
});

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * Mapbox `respectPrefersReducedMotion`, as a subscription.
 * Fires immediately, then on change. Returns an unsubscribe.
 */
export const watchReducedMotion = (cb: (on: boolean) => void) => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    cb(false);
    return () => {};
  }
  const mq = window.matchMedia(REDUCED);
  const sync = () => cb(mq.matches);
  sync();
  mq.addEventListener("change", sync);
  return () => mq.removeEventListener("change", sync);
};

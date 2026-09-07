import { DR } from "./geo.ts";

/** Earth's obliquity, degrees. MEASURED. */
export const OBLIQUITY = 23.44;

/**
 * Subsolar latitude for a given subsolar longitude.
 * One synthetic year per full sweep of `sunLon` — DECLARED, not an ephemeris.
 * Single source of truth: shader terminator, sun marker and tide model all read this.
 */
export const subsolarLat = (sunLon: number): number => OBLIQUITY * Math.sin(sunLon * DR);

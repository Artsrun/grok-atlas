import { DR } from "./geo.ts";

/** Earth's obliquity, degrees. MEASURED. */
export const OBLIQUITY = 23.44;

/**
 * Declination stand-in when the user parks the sun slider.
 * Live clock path uses `skyAt()` in ephemeris.ts instead.
 */
export const subsolarLat = (sunLon: number): number => OBLIQUITY * Math.sin(sunLon * DR);

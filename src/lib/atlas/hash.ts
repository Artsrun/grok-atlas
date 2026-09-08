import type { CameraAt } from "./camera.ts";
import { onCamera } from "./camera.ts";
import { wrapLon } from "./ephemeris.ts";
import { MAX_DIST, MIN_DIST } from "./fly.ts";
import { useAtlas } from "./store.ts";

/** `#lat/lon/dist` — Mapbox's `hash`, minus the bearing and pitch we don't have. */
const HASH = /^#?(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const formatHash = ({ lat, lon, dist }: CameraAt) =>
  `#${lat.toFixed(3)}/${wrapLon(lon).toFixed(3)}/${dist.toFixed(2)}`;

/** Forgiving on range, strict on shape: a hand-typed dist clamps, garbage is null. */
export const parseHash = (hash: string): CameraAt | null => {
  const m = HASH.exec(hash.trim());
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  const dist = Number(m[3]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(dist)) return null;
  return { lat: clamp(lat, -90, 90), lon: wrapLon(lon), dist: clamp(dist, MIN_DIST, MAX_DIST) };
};

/** The camera the URL asks for on boot, if it asks for one. */
export const hashAt = () =>
  typeof window === "undefined" ? null : parseHash(window.location.hash);

/**
 * Two-way `hash`: moveend writes the URL, an edited URL flies the camera.
 * replaceState, so orbiting never fills the back stack. Returns an uninstall.
 */
export const installHashSync = () => {
  if (typeof window === "undefined") return () => {};
  // Whatever we last wrote or consumed — the loop breaker for both directions.
  let mine = window.location.hash;

  const write = (at: CameraAt) => {
    const next = formatHash(at);
    if (next === mine) return;
    mine = next;
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, "", `${pathname}${search}${next}`);
  };

  const read = () => {
    if (window.location.hash === mine) return;
    const at = parseHash(window.location.hash);
    if (!at) return;
    mine = window.location.hash;
    useAtlas.getState().flyTo({ ...at, label: undefined });
  };

  const off = onCamera("moveend", write);
  window.addEventListener("hashchange", read);
  return () => {
    off();
    window.removeEventListener("hashchange", read);
  };
};

import type { Focus } from "./store.ts";

/** Where the rig is, in the same terms a share link speaks. */
export type CameraAt = { lat: number; lon: number; dist: number };

/** Mapbox's move lifecycle, minus the ones a globe has no analogue for. */
export type CameraEvent = "movestart" | "move" | "moveend";

type Listener = (at: CameraAt) => void;

const moves: Record<CameraEvent, Set<Listener>> = {
  movestart: new Set(),
  move: new Set(),
  moveend: new Set(),
};

/** `map.on('moveend', …)`. Returns an unsubscribe. */
export const onCamera = (evt: CameraEvent, cb: Listener) => {
  moves[evt].add(cb);
  return () => void moves[evt].delete(cb);
};

export const emitCamera = (evt: CameraEvent, at: CameraAt) => {
  for (const cb of moves[evt]) cb(at);
};

/** Lets the rig skip building a CameraAt nobody reads — `move` runs per frame. */
export const cameraListeners = (evt: CameraEvent) => moves[evt].size;

const flights = new Set<(focus: Focus) => void>();

/** A flyTo issued before the rig mounted. Deep links land here first. */
let pending: Focus | null = null;

/**
 * Flights are a command stream, not rendered state: the rig subscribes once and
 * never re-renders on a flyTo, and repeating the same focus still re-fires — which
 * is what the old flySeq counter was working around. A request made while nobody
 * is listening waits for the first subscriber, so a `?c=` deep link still flies.
 */
export const onFlyRequest = (cb: (focus: Focus) => void) => {
  flights.add(cb);
  if (pending) {
    const focus = pending;
    pending = null;
    cb(focus);
  }
  return () => void flights.delete(cb);
};

export const requestFly = (focus: Focus) => {
  if (!flights.size) {
    pending = focus;
    return;
  }
  for (const cb of flights) cb(focus);
};

/** Frame governor — hold 60, and give the pixels back when it can. */

/** Render scale rungs. Index 0 is full quality; the rig never goes below the last. */
export const RUNGS = [1, 0.82, 0.66, 0.5] as const;

export type GovernorOpts = {
  /** Frames per second to hold. */
  target?: number;
  /** Drop a rung under this fraction of target. */
  floor?: number;
  /** Climb a rung over this fraction of target. */
  ceil?: number;
  /** Seconds of evidence before dropping — one stutter is not a verdict. */
  down?: number;
  /** Seconds of headroom before climbing. Slower than the drop, on purpose. */
  up?: number;
  /** EMA weight for a single frame. */
  alpha?: number;
};

export type FrameStats = { fps: number; scale: number; rung: number };

export type Governor = {
  /** Feed one frame's delta in seconds. Returns the render scale to use. */
  frame: (dt: number) => number;
  stats: () => FrameStats;
  reset: () => void;
};

/** A frame this long is a tab wake or a GC pause, not a frame rate. */
const STALL = 0.25;

export const createGovernor = (opts: GovernorOpts = {}): Governor => {
  const target = opts.target ?? 60;
  const floor = opts.floor ?? 0.82;
  const ceil = opts.ceil ?? 0.97;
  const downFor = opts.down ?? 0.9;
  const upFor = opts.up ?? 3.5;
  const alpha = opts.alpha ?? 0.08;

  let fps = target;
  let rung = 0;
  let bad = 0;
  let good = 0;

  return {
    frame(dt) {
      if (dt > 0 && dt < STALL) fps += (1 / dt - fps) * alpha;
      else {
        bad = 0;
        good = 0;
        return RUNGS[rung];
      }
      if (fps < target * floor) {
        bad += dt;
        good = 0;
      } else if (fps > target * ceil) {
        good += dt;
        bad = 0;
      } else {
        bad = 0;
        good = 0;
      }
      if (bad >= downFor && rung < RUNGS.length - 1) {
        rung += 1;
        bad = 0;
        // A rung change moves the goalposts: re-earn the next one.
        fps = target * floor;
      } else if (good >= upFor && rung > 0) {
        rung -= 1;
        good = 0;
        fps = target * ceil;
      }
      return RUNGS[rung];
    },
    stats: () => ({ fps, scale: RUNGS[rung], rung }),
    reset() {
      fps = target;
      rung = 0;
      bad = 0;
      good = 0;
    },
  };
};

/**
 * The rig writes here every frame and the HUD polls it. Frame rate through
 * zustand would re-render the panel sixty times a second to print one number.
 */
let live: FrameStats = { fps: 60, scale: 1, rung: 0 };

export const publishFrame = (s: FrameStats) => {
  live = s;
};

export const frameStats = (): FrameStats => live;

/** Shader-side quality, read per frame by materials that can shed detail. */
export const frameScale = () => live.scale;

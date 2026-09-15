/**
 * The virtual clock. Everything in the sky — terminator, phase, station — is a
 * function of one instant, so there is one instant to move, not a slider per
 * body. `offset` is the gap from the real clock in ms; `rate` is how fast the
 * gap opens. rate 1 tracks reality, 0 holds, 60 runs a minute a second, and
 * negatives run it backwards.
 */

export type Clock = { offset: number; rate: number };

export const LIVE: Clock = { offset: 0, rate: 1 };

/** Rates the tool offers, slowest first. Negatives mirror these. */
export const RATES = [0, 1, 60, 3600, 43200] as const;

/** Far enough for a year of seasons and a year of phases, no further. */
export const MAX_OFFSET = 366 * 86400_000;

/** Within this of the real clock, the tool calls itself live. */
export const LIVE_SLOP = 2000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const clockMs = (c: Clock, realMs: number) => realMs + c.offset;

export const isLive = (c: Clock) => c.rate === 1 && Math.abs(c.offset) < LIVE_SLOP;

/** Paused is a rate, not a mode: the offset stops moving with the real clock. */
export const isHeld = (c: Clock) => c.rate === 0;

/**
 * One real second of `dt` opens the gap by `rate - 1` seconds: at rate 1 the
 * gap is constant and the virtual clock rides the real one, at 0 it falls back
 * exactly as fast as time passes, which is how a pause looks from here.
 */
export const advance = (c: Clock, dt: number): Clock => {
  if (c.rate === 1) return c;
  return { ...c, offset: clamp(c.offset + dt * 1000 * (c.rate - 1), -MAX_OFFSET, MAX_OFFSET) };
};

/** Scrub by hand. Rate is untouched — dragging does not stop the clock. */
export const nudge = (c: Clock, ms: number): Clock => ({
  ...c,
  offset: clamp(c.offset + ms, -MAX_OFFSET, MAX_OFFSET),
});

export const setRate = (c: Clock, rate: number): Clock => ({ ...c, rate });

/** Play/pause without losing where you were: hold at 0, resume at `resume`. */
export const toggleHold = (c: Clock, resume = 1): Clock => ({
  ...c,
  rate: c.rate === 0 ? resume : 0,
});

/**
 * The ephemeris is only worth re-reading four times a second while the clock
 * tracks reality. Once it is running, every frame is a frame of animation and
 * a stale sun steps visibly across the terminator.
 */
export const skyTick = (rate: number, still = 0.25) => (Math.abs(rate) > 1 ? 0 : still);

/** `1 h/s`, `live`, `hold` — what the rate does, not what it multiplies. */
export const formatRate = (rate: number): string => {
  if (rate === 0) return "hold";
  if (rate === 1) return "live";
  const back = rate < 0;
  const r = Math.abs(rate);
  const body =
    r >= 86400
      ? `${round1(r / 86400)} d/s`
      : r >= 3600
        ? `${round1(r / 3600)} h/s`
        : r >= 60
          ? `${round1(r / 60)} min/s`
          : `×${round1(r)}`;
  return back ? `−${body}` : body;
};

const round1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/** `+3h 20m`, `−2d 04h`, `now`. Signed, because the sign is the whole point. */
export const formatOffset = (ms: number): string => {
  if (Math.abs(ms) < LIVE_SLOP) return "now";
  const sign = ms < 0 ? "−" : "+";
  const total = Math.round(Math.abs(ms) / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return `${sign}${d}d ${pad(h)}h`;
  if (h > 0) return `${sign}${h}h ${pad(m)}m`;
  return `${sign}${m}m`;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** `2026.09.15 08:20 UTC` — the instant the globe is actually showing. */
export const formatStamp = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

/** ISO minute, for a share link. Seconds would be noise in a URL. */
export const stampParam = (ms: number) => new Date(ms).toISOString().slice(0, 16) + "Z";

/** Back from a share link. Returns the offset from `realMs`, or null. */
export const offsetFromParam = (value: string, realMs: number): number | null => {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return null;
  return clamp(t - realMs, -MAX_OFFSET, MAX_OFFSET);
};

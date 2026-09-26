export const BOOT_STAGES = ["gl", "day", "night", "maps", "clouds", "atlas"] as const;
export type BootStage = (typeof BOOT_STAGES)[number];

const LABELS: Record<BootStage, string> = {
  gl: "canvas",
  day: "day map",
  night: "city lights",
  maps: "relief",
  clouds: "cloud deck",
  atlas: "countries",
};

/** Navigation-start offsets we care about for the freeze measure. */
const MARK = {
  gl: "atlas:gl",
  day: "atlas:lit",
  night: "atlas:ready",
} as const;

type Snap = {
  done: ReadonlySet<BootStage>;
  /** First photoreal frame is on the sphere. */
  lit: boolean;
  /** Night lights are on — overlay can leave. */
  ready: boolean;
  progress: number;
  label: string;
  /** What quietly did not arrive, in the user's terms. Null when all is well. */
  note: string | null;
};

export type BootMarks = {
  /** First GL clear. */
  gl: number | null;
  /** Day map on the sphere — the freeze number. */
  lit: number | null;
  /** Day + night. */
  ready: number | null;
};

const done = new Set<BootStage>();
let note: string | null = null;
const listeners = new Set<() => void>();
let snap: Snap = makeSnap();

function makeSnap(): Snap {
  const lit = done.has("day");
  const ready = done.has("day") && done.has("night");
  let label = "acquiring earth";
  for (const s of BOOT_STAGES) {
    if (done.has(s)) label = LABELS[s];
  }
  return {
    // A copy: the live Set is mutated in place, so handing it out would give
    // every snapshot the same identity and quietly break anything memoising
    // on it. Six emits a session — the allocation is free.
    done: new Set(done),
    lit,
    ready,
    progress: done.size / BOOT_STAGES.length,
    label,
    note,
  };
}

function markAt(name: string): number | null {
  if (typeof performance === "undefined") return null;
  const e = performance.getEntriesByName(name)[0];
  return e ? Math.round(e.startTime) : null;
}

export function bootMarks(): BootMarks {
  return {
    gl: markAt(MARK.gl),
    lit: markAt(MARK.day),
    ready: markAt(MARK.night),
  };
}

function stamp(stage: BootStage) {
  const name = MARK[stage as keyof typeof MARK];
  if (!name || typeof performance === "undefined") return;
  try {
    if (performance.getEntriesByName(name).length) return;
    performance.mark(name);
  } catch {
    /* jsdom / older webviews */
  }
  if (typeof window !== "undefined") {
    (window as Window & { __atlasMarks?: BootMarks }).__atlasMarks = bootMarks();
  }
}

function clearStamps() {
  if (typeof performance === "undefined") return;
  for (const name of Object.values(MARK)) {
    try {
      performance.clearMarks(name);
    } catch {
      /* */
    }
  }
  if (typeof window !== "undefined") {
    (window as Window & { __atlasMarks?: BootMarks }).__atlasMarks = bootMarks();
  }
}

function emit() {
  snap = makeSnap();
  for (const fn of listeners) fn();
}

export function resetBoot() {
  done.clear();
  note = null;
  clearStamps();
  emit();
}

export function markBoot(stage: BootStage) {
  if (done.has(stage)) return;
  done.add(stage);
  stamp(stage);
  emit();
}

/**
 * A stage that will not arrive. It still counts as done — the strip must never
 * hang on it — but it leaves a line saying what the globe is now missing,
 * which is the part the old full-screen error page got right.
 */
export function failBoot(stage: BootStage, why: string) {
  note = why;
  done.add(stage);
  stamp(stage);
  emit();
}

export function bootSnap(): Snap {
  return snap;
}

export function subscribeBoot(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const DAY = "/earth/day.jpg";
const NIGHT = "/earth/night.png";

/** HTTP-cache the day map first. Night follows so it does not steal the pipe. */
export function warmEarth() {
  if (typeof Image === "undefined") return;
  const day = new Image();
  day.decoding = "async";
  day.fetchPriority = "high";
  day.onload = () => {
    const night = new Image();
    night.decoding = "async";
    night.fetchPriority = "low";
    night.src = NIGHT;
  };
  day.src = DAY;
}

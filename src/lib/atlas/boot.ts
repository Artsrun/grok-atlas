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

type Snap = {
  done: ReadonlySet<BootStage>;
  /** First photoreal frame is on the sphere. */
  lit: boolean;
  /** Night lights are on — overlay can leave. */
  ready: boolean;
  progress: number;
  label: string;
};

const done = new Set<BootStage>();
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
    done,
    lit,
    ready,
    progress: done.size / BOOT_STAGES.length,
    label,
  };
}

function emit() {
  snap = makeSnap();
  for (const fn of listeners) fn();
}

export function resetBoot() {
  done.clear();
  emit();
}

export function markBoot(stage: BootStage) {
  if (done.has(stage)) return;
  done.add(stage);
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

/** HTTP-cache the two maps the first frame actually needs. */
export function warmEarth() {
  if (typeof Image === "undefined") return;
  for (const src of ["/earth/day.jpg", "/earth/night.png"]) {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }
}

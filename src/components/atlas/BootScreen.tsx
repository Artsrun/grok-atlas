import { useEffect, useState, useSyncExternalStore } from "react";
import { bootSnap, subscribeBoot } from "@/lib/atlas/boot";

export function useBoot() {
  return useSyncExternalStore(subscribeBoot, bootSnap, bootSnap);
}

export function BootScreen({
  label = "Acquiring earth textures",
  detail,
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-wafer px-6 text-center text-silk"
    >
      <div className="font-display text-sm font-bold tracking-[0.28em] text-silk">
        GROK<span className="text-ochre">.ATLAS</span>
      </div>
      <div className="font-mono text-micro uppercase tracking-[0.28em] text-dim">{label}</div>
      <div className="h-px w-48 overflow-hidden bg-etch">
        <i className="block h-full w-1/2 animate-pulse bg-ochre" />
      </div>
      <p className="max-w-xs font-mono text-2xs leading-relaxed tracking-wide text-dimmer">
        {detail ?? "City lights · airglow limb · ISS cupola · v2.0"}
      </p>
    </div>
  );
}

/** Seconds of no progress before the strip admits the link is the problem. */
const STALL_AFTER = 7000;

/** Strip over a live canvas — the globe is already spinning underneath. */
export function BootStrip() {
  const boot = useBoot();
  const [stalled, setStalled] = useState(false);

  // A texture that never resolves used to leave a bar sitting at 30% with
  // nothing to say. Say it.
  useEffect(() => {
    if (boot.ready) return;
    const id = setTimeout(() => setStalled(true), STALL_AFTER);
    return () => clearTimeout(id);
  }, [boot.ready, boot.label]);

  if (boot.ready) return null;
  const pct = Math.max(8, Math.round(boot.progress * 100));
  return (
    <div
      role="status"
      aria-live="polite"
      className="boot-strip pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-3 px-6 text-center"
      style={{ top: "max(5.5rem, calc(env(safe-area-inset-top) + 4rem))" }}
    >
      <div className="font-mono text-micro uppercase tracking-[0.28em] text-dim">{boot.label}</div>
      <div className="h-px w-40 overflow-hidden bg-etch">
        <i className="block h-full bg-ochre" style={{ width: `${pct}%` }} />
      </div>
      {stalled && (
        <div className="font-mono text-2xs uppercase tracking-[0.18em] text-dimmer">
          slow link · the globe turns without the rest
        </div>
      )}
    </div>
  );
}

/** Seconds a missing-layer note stays up before the window is quiet again. */
const NOTE_FOR = 7000;

/**
 * One dim line for the layer that did not arrive. The full-screen error page
 * this replaces was louder than the failure: a globe with no borders is still
 * a globe, it just should not pretend nothing happened.
 */
export function BootNote() {
  const boot = useBoot();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!boot.note) return;
    setShow(true);
    const id = setTimeout(() => setShow(false), NOTE_FOR);
    return () => clearTimeout(id);
  }, [boot.note]);

  if (!boot.note || !show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 z-30 px-6 text-center font-mono text-2xs uppercase tracking-[0.18em] text-rust"
      style={{ top: "max(5.5rem, calc(env(safe-area-inset-top) + 4rem))" }}
    >
      {boot.note}
    </div>
  );
}

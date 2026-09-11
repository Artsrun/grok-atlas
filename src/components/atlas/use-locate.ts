import { useCallback, useEffect, useRef, useState } from "react";
import { pinHere } from "@/lib/atlas/locate";
import { useAtlas } from "@/lib/atlas/store";

export type LocateState = "idle" | "busy" | "pinned" | "denied";

/** How long a refusal stays on the button before it offers itself again. */
const DENIED_FOR = 2600;

/**
 * One locate button, two places (the dock and the desktop rail). The refusal
 * matters as much as the fix: on a phone the permission sheet is dismissed
 * often, and the old handler swallowed that into a button that just went quiet.
 */
export function useLocate() {
  const here = useAtlas((s) => s.here);
  const [state, setState] = useState<LocateState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const run = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    setState("busy");
    try {
      await pinHere(true);
      setState("pinned");
    } catch {
      setState("denied");
      timer.current = setTimeout(() => setState("idle"), DENIED_FOR);
    }
  }, []);

  const label = state === "busy" ? "…" : state === "denied" ? "denied" : here ? "here" : "locate";
  return { state, label, busy: state === "busy", run };
}

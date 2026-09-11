import { useEffect, useRef } from "react";

export type KeyMap = Record<string, () => void>;

const TYPING = /^(input|textarea|select)$/i;

/**
 * Single-key shortcuts for the desktop instrument — the keyboard is the mouse
 * user's thumb dock. Nothing fires while a field has focus or a modifier is
 * down, so browser and OS bindings keep working and `find country` still
 * takes an `i`.
 */
export function useKeys(map: KeyMap, on = true) {
  const live = useRef(map);
  live.current = map;

  useEffect(() => {
    if (!on || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (TYPING.test(el.tagName) || el.isContentEditable)) return;
      const run = live.current[e.key] ?? live.current[e.key.toLowerCase()];
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on]);
}

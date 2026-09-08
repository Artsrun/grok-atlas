import { useEffect, useState } from "react";

/** Mouse + hover: desktop instrument. Coarse: phone / tablet toolbox. */
export const FINE_MQ = "(hover: hover) and (pointer: fine)";
export const COARSE_MQ = "(pointer: coarse)";
export const WIDE_MQ = "(min-width: 768px)";

export const ORBIT = {
  fine: { rotate: 0.52, zoom: 0.75, damp: 0.058, tap: 6 },
  coarse: { rotate: 0.82, zoom: 1.1, damp: 0.09, tap: 16 },
} as const;

/** Hover-fine wins, then coarse (iPad), then width for headless / unknown. */
export function classifyPointer(p: { hoverFine: boolean; coarse: boolean; wide: boolean }) {
  if (p.hoverFine) return true;
  if (p.coarse) return false;
  return p.wide;
}

export function isFinePointer() {
  if (typeof window === "undefined") return true;
  return classifyPointer({
    hoverFine: window.matchMedia(FINE_MQ).matches,
    coarse: window.matchMedia(COARSE_MQ).matches,
    wide: window.matchMedia(WIDE_MQ).matches,
  });
}

export function useFinePointer() {
  const [fine, setFine] = useState(isFinePointer);
  useEffect(() => {
    const mqs = [FINE_MQ, COARSE_MQ, WIDE_MQ].map((q) => window.matchMedia(q));
    const sync = () => setFine(isFinePointer());
    sync();
    for (const mq of mqs) mq.addEventListener("change", sync);
    return () => {
      for (const mq of mqs) mq.removeEventListener("change", sync);
    };
  }, []);
  return fine;
}

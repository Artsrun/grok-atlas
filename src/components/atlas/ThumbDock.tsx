import { useLocate } from "./use-locate";

/**
 * Two thumb-zone actions. The station used to hold the middle slot, which put
 * a ride nobody takes twice next to the two things a phone opens the app for —
 * it lives in Views with the rest of the places you can go.
 */
export function ThumbDock({
  third,
}: {
  third: { label: string; pressed?: boolean; onClick: () => void; hint: string };
}) {
  const locate = useLocate();

  return (
    <div
      className="dock-mobile pointer-events-auto absolute inset-x-2 z-30 grid grid-cols-2 gap-1"
      style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        className={`press min-h-12 border bg-substrate font-mono text-2xs uppercase tracking-[0.14em] ${
          locate.state === "denied" ? "border-rust text-rust" : "border-etch text-silk"
        }`}
        disabled={locate.busy}
        aria-label={
          locate.state === "denied" ? "Location permission refused" : "Pin this device and fly here"
        }
        onClick={locate.run}
      >
        {locate.label}
      </button>
      <button
        type="button"
        aria-pressed={third.pressed}
        aria-label={third.hint}
        className={`press min-h-12 border font-mono text-2xs uppercase tracking-[0.14em] ${
          third.pressed
            ? "border-ochre bg-substrate-2 text-ochre"
            : "border-ochre bg-substrate text-ochre"
        }`}
        onClick={third.onClick}
      >
        {third.label}
      </button>
    </div>
  );
}

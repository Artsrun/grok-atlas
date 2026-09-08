import { useState } from "react";
import { pinHere } from "@/lib/atlas/locate";
import { useAtlas } from "@/lib/atlas/store";

/**
 * Three equal thumb-zone actions. Quiet edition and the instrument share this
 * so locate / ride / toolbox sit in the same place on a phone.
 */
export function ThumbDock({
  third,
}: {
  third: { label: string; pressed?: boolean; onClick: () => void; hint: string };
}) {
  const here = useAtlas((s) => s.here);
  const iss = useAtlas((s) => s.iss);
  const ride = useAtlas((s) => s.issRide);
  const [busy, setBusy] = useState(false);

  return (
    <div
      className="dock-mobile pointer-events-auto absolute inset-x-2 z-30 grid grid-cols-3 gap-1"
      style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        className="press min-h-12 border border-etch bg-substrate font-mono text-2xs uppercase tracking-[0.14em] text-silk"
        disabled={busy}
        aria-label="Pin this device and fly here"
        onClick={async () => {
          setBusy(true);
          try {
            await pinHere(true);
          } catch {
            /* denied */
          }
          setBusy(false);
        }}
      >
        {here ? "Here" : busy ? "…" : "Locate"}
      </button>
      <button
        type="button"
        className={`press min-h-12 border font-mono text-2xs uppercase tracking-[0.14em] ${
          ride
            ? "border-ochre bg-substrate-2 text-ochre"
            : "border-etch bg-substrate text-silk"
        }`}
        disabled={!iss}
        aria-label={ride ? "Leave the station" : "Ride the station"}
        onClick={() => iss && useAtlas.getState().rideIss(!ride)}
      >
        {ride ? "Leave" : iss ? "ISS" : "ISS …"}
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

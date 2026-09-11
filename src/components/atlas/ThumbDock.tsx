import { useAtlas } from "@/lib/atlas/store";
import { useLocate } from "./use-locate";

/**
 * Three equal thumb-zone actions. Quiet edition and the instrument share this
 * so locate / ride / toolbox sit in the same place on a phone.
 */
export function ThumbDock({
  third,
}: {
  third: { label: string; pressed?: boolean; onClick: () => void; hint: string };
}) {
  const iss = useAtlas((s) => s.iss);
  const ride = useAtlas((s) => s.issRide);
  const locate = useLocate();

  return (
    <div
      className="dock-mobile pointer-events-auto absolute inset-x-2 z-30 grid grid-cols-3 gap-1"
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
        // A toggle, so it reports as one — the label alone flips between two
        // words and tells a screen reader nothing about which state it is in.
        aria-pressed={ride}
        // Enabled before the first fix would ride to a station with no
        // coordinates, so it waits, and says that rather than going grey.
        disabled={!iss}
        aria-label={
          ride ? "Leave the station" : iss ? "Ride the station" : "Waiting for the station feed"
        }
        className={`press min-h-12 border font-mono text-2xs uppercase tracking-[0.14em] ${
          ride
            ? "border-ochre bg-substrate-2 text-ochre"
            : iss
              ? "border-etch bg-substrate text-silk"
              : "border-etch bg-substrate text-dimmer"
        }`}
        onClick={() => iss && useAtlas.getState().rideIss(!ride)}
      >
        {ride ? "leave" : "iss"}
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

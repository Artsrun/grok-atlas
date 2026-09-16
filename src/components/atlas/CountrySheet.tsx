import { CountryCard } from "./CountryCard";
import { useFinePointer } from "@/lib/atlas/pointer";
import { useAtlas } from "@/lib/atlas/store";

/**
 * One country sheet for both editions and both pointers. Selection used to be
 * a caption in the quiet window and a panel section in the instrument, which
 * meant two places to keep in step and neither of them had room for a story.
 */
export function CountrySheet() {
  const selected = useAtlas((s) => s.selected);
  const ride = useAtlas((s) => s.issRide);
  const panelOpen = useAtlas((s) => s.panelOpen);
  const fine = useFinePointer();

  // On the ride the caption is the station, and on a phone the open tray owns
  // the bottom of the screen. Neither is a moment for a card.
  if (!selected || ride || (!fine && panelOpen)) return null;

  return (
    <div
      // Centred by auto margins, not by a half-width transform: a transform
      // here promotes the sheet to its own compositing layer, and a software
      // renderer will paint that layer a second time in the wrong place.
      className="country-sheet pointer-events-auto absolute inset-x-2 z-30 mx-auto max-w-[34rem] border border-etch bg-substrate/95 p-3"
      style={{
        bottom: fine
          ? "max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))"
          : "calc(max(0.5rem, env(safe-area-inset-bottom)) + 4.25rem)",
      }}
    >
      <CountryCard name={selected} />
      <button
        type="button"
        aria-label="Clear the selection"
        onClick={() => useAtlas.getState().select(null)}
        className="press absolute right-1 top-1 flex size-9 items-center justify-center font-mono text-xs text-dimmer hover:text-silk"
      >
        ✕
      </button>
    </div>
  );
}

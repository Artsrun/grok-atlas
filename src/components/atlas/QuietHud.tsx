import { useEffect, useState } from "react";
import { formatSolar, solarHours } from "@/lib/atlas/ephemeris";
import { pinHere } from "@/lib/atlas/locate";
import { useAtlas } from "@/lib/atlas/store";

function Clock() {
  const [t, setT] = useState("—");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setT(`${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-xs tabular-nums text-dimmer">{t} UTC</span>;
}

export function QuietHud({ onInstrument }: { onInstrument: () => void }) {
  const selected = useAtlas((s) => s.selected);
  const focus = useAtlas((s) => s.focus);
  const here = useAtlas((s) => s.here);
  const iss = useAtlas((s) => s.iss);
  const caption = selected ?? focus?.label ?? "";
  const [hint, setHint] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setHint(false), 4000);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (caption) setHint(false);
  }, [caption]);

  const solar =
    focus && Number.isFinite(focus.lon) ? formatSolar(solarHours(focus.lon)) : null;

  return (
    <>
      <button
        type="button"
        onClick={onInstrument}
        className="pointer-events-auto absolute left-5 top-5 z-20 font-display text-sm font-medium tracking-[0.22em] text-silk/70"
        title="open instrument"
      >
        GROK<span className="text-ochre">.ATLAS</span>
      </button>
      <div className="absolute right-5 top-5 z-20 flex items-center gap-3">
        <button
          type="button"
          className="pointer-events-auto font-mono text-2xs uppercase tracking-[0.16em] text-ochre"
          disabled={busy}
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
          {here ? "HERE" : busy ? "…" : "LOCATE"}
        </button>
        {iss ? (
          <button
            type="button"
            className="pointer-events-auto font-mono text-2xs uppercase tracking-[0.16em] text-dimmer"
            onClick={() =>
              useAtlas.getState().flyTo({
                lat: iss.lat,
                lon: iss.lon,
                label: "ISS",
                dist: 2.05,
              })
            }
          >
            ISS
          </button>
        ) : null}
        <Clock />
      </div>
      {caption ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 text-center">
          <div className="font-display text-lg tracking-wide text-silk">{caption}</div>
          {solar ? (
            <div className="mt-1 font-mono text-2xs uppercase tracking-[0.16em] text-dimmer">
              solar {solar}
            </div>
          ) : null}
        </div>
      ) : hint ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 text-center font-mono text-2xs uppercase tracking-[0.18em] text-dimmer">
          locate · tap a country · track ISS
        </div>
      ) : null}
    </>
  );
}

import { useEffect, useState } from "react";
import { formatSolar, solarHours } from "@/lib/atlas/ephemeris";
import { pinHere } from "@/lib/atlas/locate";
import { useFinePointer } from "@/lib/atlas/pointer";
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
  const ride = useAtlas((s) => s.issRide);
  const caption = ride ? "ISS" : (selected ?? focus?.label ?? "");
  const [hint, setHint] = useState(true);
  const [busy, setBusy] = useState(false);
  const fine = useFinePointer();

  useEffect(() => {
    const id = setTimeout(() => setHint(false), 4000);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (caption) setHint(false);
  }, [caption]);

  const solar = focus && Number.isFinite(focus.lon) ? formatSolar(solarHours(focus.lon)) : null;
  // On the ride the sub-line reads the station, not the sun over a country.
  const sub =
    ride && iss
      ? `${iss.lat.toFixed(1)}° ${iss.lon.toFixed(1)}° · ${Math.round(iss.alt)} km · ${iss.vel.toFixed(2)} km/s`
      : solar
        ? `solar ${solar}`
        : null;

  return (
    <>
      <button
        type="button"
        onClick={onInstrument}
        className="tip press pointer-events-auto absolute left-5 z-20 font-display text-sm font-medium tracking-[0.22em] text-silk/70"
        style={{ top: "max(1.25rem, env(safe-area-inset-top))" }}
        data-tip="Open the instrument toolbox"
      >
        GROK<span className="text-ochre">.ATLAS</span>
      </button>
      <div
        className="absolute right-5 z-20 flex items-center gap-3"
        style={{ top: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          className="tip press pointer-events-auto min-h-11 px-1 font-mono text-2xs uppercase tracking-[0.16em] text-ochre"
          data-tip="Pin this device and fly here"
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
            className={`tip press pointer-events-auto min-h-11 px-1 font-mono text-2xs uppercase tracking-[0.16em] ${
              ride ? "text-ochre" : "text-dimmer"
            }`}
            data-tip={ride ? "Leave the station" : "Ride the station"}
            onClick={() => useAtlas.getState().rideIss(!ride)}
          >
            {ride ? "LEAVE" : "ISS"}
          </button>
        ) : null}
        <Clock />
      </div>
      {caption ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 text-center"
          style={{ bottom: "max(2.5rem, calc(env(safe-area-inset-bottom) + 1.5rem))" }}
        >
          <div className="font-display text-lg tracking-wide text-silk">{caption}</div>
          {sub ? (
            <div className="mt-1 font-mono text-2xs uppercase tracking-[0.16em] text-dimmer">
              {sub}
            </div>
          ) : null}
        </div>
      ) : hint ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 text-center font-mono text-2xs uppercase tracking-[0.18em] text-dimmer"
          style={{ bottom: "max(2.5rem, calc(env(safe-area-inset-bottom) + 1.5rem))" }}
        >
          {fine
            ? "drag · click a country · GROK.ATLAS for toolbox"
            : "pinch · tap a country · toolbox in the name"}
        </div>
      ) : null}
    </>
  );
}

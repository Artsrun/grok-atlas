import { useEffect, useState } from "react";
import { formatSolar, solarHours } from "@/lib/atlas/ephemeris";
import { useFinePointer } from "@/lib/atlas/pointer";
import { useAtlas } from "@/lib/atlas/store";
import { ThumbDock } from "./ThumbDock";
import { useKeys } from "./use-keys";
import { useLocate } from "./use-locate";

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
  const iss = useAtlas((s) => s.iss);
  const ride = useAtlas((s) => s.issRide);
  const caption = ride ? "ISS" : (selected ?? focus?.label ?? "");
  const [hint, setHint] = useState(true);
  const fine = useFinePointer();
  const locate = useLocate();

  // Same three actions the dock gives a thumb. The quiet edition has no rail
  // to open, so `t` is the way through to the instrument.
  useKeys(
    {
      l: () => void locate.run(),
      i: () => {
        const st = useAtlas.getState();
        if (st.iss) st.rideIss(!st.issRide);
      },
      t: onInstrument,
      Escape: () => {
        const st = useAtlas.getState();
        if (st.issRide) st.rideIss(false);
        else if (st.selected) st.select(null);
      },
    },
    fine,
  );

  useEffect(() => {
    const id = setTimeout(() => setHint(false), 4000);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (caption) setHint(false);
  }, [caption]);

  const solar = focus && Number.isFinite(focus.lon) ? formatSolar(solarHours(focus.lon)) : null;
  const sub =
    ride && iss
      ? `${iss.lat.toFixed(1)}° ${iss.lon.toFixed(1)}° · ${Math.round(iss.alt)} km · ${iss.vel.toFixed(2)} km/s`
      : solar
        ? `solar ${solar}`
        : null;

  const captionBottom = fine
    ? "max(2.5rem, calc(env(safe-area-inset-bottom) + 1.5rem))"
    : "calc(max(0.5rem, env(safe-area-inset-bottom)) + 4.25rem)";

  return (
    <>
      <button
        type="button"
        onClick={onInstrument}
        className="tip press pointer-events-auto absolute left-4 z-20 font-display text-sm font-medium tracking-[0.22em] text-silk/70"
        style={{ top: "max(1.25rem, env(safe-area-inset-top))" }}
        data-tip="Open the instrument toolbox"
      >
        GROK<span className="text-ochre">.ATLAS</span>
      </button>
      <div
        className="absolute right-4 z-20 flex items-center gap-3"
        style={{ top: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        {fine ? (
          <>
            <button
              type="button"
              className={`tip press pointer-events-auto min-h-11 px-1 font-mono text-2xs uppercase tracking-[0.16em] ${
                locate.state === "denied" ? "text-rust" : "text-ochre"
              }`}
              data-tip={
                locate.state === "denied"
                  ? "Location permission refused"
                  : "Pin this device and fly here"
              }
              disabled={locate.busy}
              onClick={locate.run}
            >
              {locate.label}
            </button>
            {iss ? (
              <button
                type="button"
                aria-pressed={ride}
                className={`tip press pointer-events-auto min-h-11 px-1 font-mono text-2xs uppercase tracking-[0.16em] ${
                  ride ? "text-ochre" : "text-dimmer"
                }`}
                data-tip={ride ? "Leave the station" : "Ride the station"}
                onClick={() => useAtlas.getState().rideIss(!ride)}
              >
                {ride ? "LEAVE" : "ISS"}
              </button>
            ) : null}
          </>
        ) : null}
        <Clock />
      </div>
      {caption ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 text-center"
          style={{ bottom: captionBottom }}
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
          style={{ bottom: captionBottom }}
        >
          {fine
            ? "drag · click a country · GROK.ATLAS for toolbox"
            : "pinch · tap a country · toolbox below"}
        </div>
      ) : null}
      {!fine && (
        <ThumbDock
          third={{
            label: "Toolbox",
            hint: "Open the instrument toolbox",
            onClick: onInstrument,
          }}
        />
      )}
    </>
  );
}

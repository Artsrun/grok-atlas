import { useEffect, useState } from "react";
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
  const caption = selected ?? focus?.label ?? "";
  const [hint, setHint] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setHint(false), 4000);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (caption) setHint(false);
  }, [caption]);

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
      <div className="absolute right-5 top-5 z-20">
        <Clock />
      </div>
      {caption ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 text-center">
          <div className="font-display text-lg tracking-wide text-silk">{caption}</div>
        </div>
      ) : hint ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 text-center font-mono text-2xs uppercase tracking-[0.18em] text-dimmer">
          tap a country
        </div>
      ) : null}
    </>
  );
}

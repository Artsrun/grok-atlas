import { memo, useEffect, useMemo, useState } from "react";
import { centroidOf, type CountryFeat } from "@/lib/atlas/geo";
import { focusForCountry } from "@/lib/atlas/fly";
import { focusOf, HOME, VIEWS } from "@/lib/atlas/model";
import { useAtlas } from "@/lib/atlas/store";
import { springLabel, tideAt, tideMeters } from "@/lib/atlas/tide";
import { deviceCaps } from "@/lib/atlas/device";

/**
 * `tickOrbits` writes sunLon/moonLon every frame, so anything that subscribes
 * to them re-renders at 60 fps. The readouts only ever show whole degrees —
 * subscribe rounded, and keep those subscriptions in leaf components so the
 * HUD shell (and its 170-option datalist) never reconciles on drift.
 */
const useSunDeg = () => useAtlas((s) => Math.round(s.sunLon));
const useMoonDeg = () => useAtlas((s) => Math.round(s.moonLon) % 360);

function Tag({ kind, children }: { kind: "m" | "d" | "c" | "x"; children: string }) {
  const cls =
    kind === "m"
      ? "text-ochre border-ochre"
      : kind === "d"
        ? "text-lichen border-lichen"
        : kind === "c"
          ? "text-dim border-dim"
          : "text-rust border-rust";
  return (
    <span
      className={`inline-block border px-1 py-px font-mono text-[8px] uppercase leading-none tracking-[0.16em] ${cls}`}
    >
      {children}
    </span>
  );
}

type ToggleId =
  | "showAtmosphere"
  | "showClouds"
  | "showBorders"
  | "showCage"
  | "showIss"
  | "showMoon"
  | "showTides"
  | "cupola"
  | "autoSun"
  | "autoMoon"
  | "autoRotate";

function LayerToggle({ id, label }: { id: ToggleId; label: string }) {
  const on = useAtlas((s) => s[id]);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => useAtlas.getState().toggle(id)}
      className={`min-h-11 border border-etch px-2 font-mono text-2xs uppercase tracking-[0.12em] ${
        on ? "bg-substrate-2 text-silk" : "text-dimmer"
      }`}
    >
      {label}
    </button>
  );
}

function Clock() {
  const [t, setT] = useState("—");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setT(
        `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-xs font-medium tabular-nums text-ochre">
      <time dateTime={t}>{t}</time>
    </span>
  );
}

function Ticker({ count }: { count: number }) {
  const selected = useAtlas((s) => s.selected);
  const sun = useSunDeg();
  const moon = useMoonDeg();
  return (
    <div className="pointer-events-none absolute inset-x-2 top-[52px] z-20 flex overflow-x-auto border border-etch bg-substrate font-mono text-2xs uppercase tracking-[0.14em] text-dim">
      <span className="shrink-0 border-r border-etch px-3 py-1.5">{count} states</span>
      <span className="shrink-0 border-r border-etch px-3 py-1.5 text-ochre">
        {selected ?? "idle"}
      </span>
      <span className="shrink-0 border-r border-etch px-3 py-1.5">sun {sun}°</span>
      <span className="shrink-0 border-r border-etch px-3 py-1.5">moon {moon}°</span>
      <span className="min-w-0 flex-1 px-3 py-1.5 text-right text-dimmer">
        drag to orbit · scroll zoom · tap a country
      </span>
    </div>
  );
}

function TideGauge({ countries }: { countries: CountryFeat[] }) {
  const selected = useAtlas((s) => s.selected);
  const tideGain = useAtlas((s) => s.tideGain);
  const showTides = useAtlas((s) => s.showTides);
  const sun = useSunDeg();
  const moon = useMoonDeg();

  const hit = selected ? countries.find((x) => x.name === selected) : undefined;
  const at = hit ? centroidOf(hit) : HOME;
  const where = hit ? selected : HOME.label;
  const raw = tideAt(at.lat, at.lon, moon, sun);
  const m = tideMeters(raw, showTides ? tideGain : 0);
  const width = Math.min(50, (Math.abs(raw) / 1.5) * 50);

  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-20 max-w-[min(280px,46vw)]">
      <div className="mb-1 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.16em] text-dimmer">
        <span>Tide · {where}</span>
        <b className="font-medium text-ochre">{springLabel(moon, sun)}</b>
      </div>
      <div className={`font-mono text-xl tabular-nums ${m >= 0 ? "text-defender" : "text-rust"}`}>
        {m >= 0 ? "+" : ""}
        {m.toFixed(2)}
        <span className="ml-1 text-2xs text-dimmer">m</span>
      </div>
      <div className="relative mt-1 h-1 bg-etch">
        <i
          className={`absolute top-0 bottom-0 ${m >= 0 ? "bg-defender" : "bg-rust"}`}
          style={{ width: `${width}%`, left: raw >= 0 ? "50%" : `${50 - width}%` }}
        />
        <i className="absolute left-1/2 top-[-3px] h-2.5 w-px bg-silk" />
      </div>
      <div className="mt-1 font-mono text-2xs uppercase tracking-wide text-dimmer">
        lunar P2 + 0.46 solar · <Tag kind="x">declared</Tag>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const id = `inst-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <>
      <label
        htmlFor={id}
        className="mt-2 block font-mono text-2xs uppercase tracking-[0.14em] text-dimmer"
      >
        {label} <b className="float-right font-medium text-ochre">{format(value)}</b>
      </label>
      <input
        id={id}
        className="inst"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
    </>
  );
}

function ShellSection() {
  const nightGain = useAtlas((s) => s.nightGain);
  const bump = useAtlas((s) => s.bump);
  const tideGain = useAtlas((s) => s.tideGain);
  const grainMix = useAtlas((s) => s.grainMix);
  const sun = useSunDeg();
  const moon = useMoonDeg();
  const st = useAtlas.getState;
  const cap = deviceCaps();

  return (
    <section className="border-b border-etch p-3">
      <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
        <span className="text-ochre">§03</span>
        <span className="font-semibold tracking-[0.2em]">Shell</span>
        <span className="text-dimmer">FIG.4</span>
      </div>
      <Slider
        label="Night gain"
        min={40}
        max={300}
        value={Math.round(nightGain * 100)}
        onChange={(v) => st().setNightGain(v / 100)}
        format={(v) => `×${(v / 100).toFixed(2)}`}
      />
      <Slider
        label="Relief / bump"
        min={0}
        max={250}
        value={Math.round(bump * 100)}
        onChange={(v) => st().setBump(v / 100)}
        format={(v) => `×${(v / 100).toFixed(2)}`}
      />
      <Slider
        label="Subsolar longitude"
        min={0}
        max={359}
        value={sun % 360}
        onChange={(v) => {
          st().setAutoSun(false);
          st().setSunLon(v);
        }}
        format={(v) => `${v}°`}
      />
      <Slider
        label="Moon longitude"
        min={0}
        max={359}
        value={(moon + 360) % 360}
        onChange={(v) => {
          st().setAutoMoon(false);
          st().setMoonLon(v);
        }}
        format={(v) => `${v}°`}
      />
      <Slider
        label="Tide gain"
        min={0}
        max={220}
        value={Math.round(tideGain * 100)}
        onChange={(v) => st().setTideGain(v / 100)}
        format={(v) => `×${(v / 100).toFixed(2)}`}
      />
      <Slider
        label="Grain · lights / relief"
        min={0}
        max={150}
        value={Math.round(grainMix * 100)}
        onChange={(v) => st().setGrainMix(v / 100)}
        format={(v) =>
          cap.tier === "low" ? "compat 0" : `${cap.tier} ×${(v / 100).toFixed(2)}`
        }
      />
      <p className="mt-2 font-mono text-2xs uppercase tracking-wide text-dimmer">
        gpu {cap.label} · {cap.webgl2 ? "webgl2" : "webgl1"} · dpr {cap.dpr[1]}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-1">
        <LayerToggle id="showAtmosphere" label="atmosphere" />
        <LayerToggle id="showClouds" label="clouds" />
        <LayerToggle id="showBorders" label="borders" />
        <LayerToggle id="showIss" label="ISS" />
        <LayerToggle id="showMoon" label="moon" />
        <LayerToggle id="showTides" label="tides" />
        <LayerToggle id="showCage" label="cage" />
        <LayerToggle id="cupola" label="cupola" />
        <LayerToggle id="autoSun" label="sun drift" />
        <LayerToggle id="autoMoon" label="moon drift" />
        <LayerToggle id="autoRotate" label="orbit" />
      </div>
    </section>
  );
}

const CountryList = memo(function CountryList({ names }: { names: string[] }) {
  return (
    <datalist id="atlas-countries">
      {names.map((n) => (
        <option key={n} value={n} />
      ))}
    </datalist>
  );
});

function TiltSection() {
  const tiltOn = useAtlas((s) => s.tiltOn);
  const [gyro, setGyro] = useState({ a: "—", b: "—", g: "—" });

  useEffect(() => {
    // Only listen while tilt is live — the handler fires ~60 Hz per device.
    if (!tiltOn) {
      setGyro({ a: "—", b: "—", g: "—" });
      return;
    }
    const on = (e: DeviceOrientationEvent) => {
      if (e.alpha == null) return;
      setGyro({
        a: `${e.alpha.toFixed(0)}°`,
        b: `${(e.beta ?? 0).toFixed(0)}°`,
        g: `${(e.gamma ?? 0).toFixed(0)}°`,
      });
    };
    window.addEventListener("deviceorientation", on);
    return () => window.removeEventListener("deviceorientation", on);
  }, [tiltOn]);

  return (
    <section className="p-3">
      <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
        <span className="text-ochre">§04</span>
        <span className="font-semibold tracking-[0.2em]">Device tilt</span>
        <span className="text-dimmer">FIG.5</span>
      </div>
      <button
        type="button"
        aria-pressed={tiltOn}
        className={`flex min-h-11 w-full items-center justify-between border px-3 font-mono text-xs uppercase tracking-[0.16em] ${
          tiltOn ? "border-rust text-rust" : "border-ochre text-ochre"
        }`}
        onClick={async () => {
          const st = useAtlas.getState();
          if (st.tiltOn) {
            st.toggle("tiltOn");
            return;
          }
          const DOE = DeviceOrientationEvent as unknown as {
            requestPermission?: () => Promise<string>;
          };
          if (typeof DOE.requestPermission === "function") {
            try {
              if ((await DOE.requestPermission()) !== "granted") return;
            } catch {
              return;
            }
          }
          st.toggle("tiltOn");
        }}
      >
        {tiltOn ? "Stop · recalibrate" : "Use device tilt"}
        <span aria-hidden>{tiltOn ? "▮▮" : "◉"}</span>
      </button>
      <div className="mt-2 grid grid-cols-3 gap-px bg-etch">
        {[
          ["α", gyro.a],
          ["β", gyro.b],
          ["γ", gyro.g],
        ].map(([k, v]) => (
          <div key={k} className="bg-substrate-2 px-2 py-2 text-center">
            <div className="font-mono text-[8px] tracking-[0.16em] text-dimmer">{k}</div>
            <div className="font-mono text-sm tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 font-mono text-2xs uppercase tracking-wide text-dimmer">
        {tiltOn ? "Live — current pose is home" : "Tilt off — drag to rotate"}
      </p>
      <div className="mt-3 font-mono text-2xs uppercase tracking-wide text-dimmer">
        overlay <Tag kind="x">declared</Tag> · textures <Tag kind="m">measured</Tag>
      </div>
    </section>
  );
}

export function Hud({ countries, onQuiet }: { countries: CountryFeat[]; onQuiet: () => void }) {
  const selected = useAtlas((s) => s.selected);
  const panelOpen = useAtlas((s) => s.panelOpen);
  const site = useAtlas((s) => s.focus?.site);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");

  const names = useMemo(() => countries.map((c) => c.name).sort(), [countries]);

  const goCountry = (n: string) => {
    const c = countries.find((x) => x.name === n);
    if (!c) return;
    useAtlas.getState().select(n);
    useAtlas.getState().flyTo(focusForCountry(c));
  };

  return (
    <>
      <header className="pointer-events-auto absolute inset-x-2 top-2 z-20 grid grid-cols-[1fr_auto] border border-etch bg-substrate md:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex items-center gap-2 border-r border-etch px-3 py-2">
          <button
            type="button"
            onClick={onQuiet}
            title="back to the quiet edition"
            className="font-display text-sm font-bold tracking-[0.18em]"
          >
            GROK<span className="text-ochre">.ATLAS</span>
          </button>
          <span className="hidden font-mono text-2xs uppercase tracking-[0.16em] text-dimmer sm:inline">
            / cupola / v2.0
          </span>
        </div>
        <div className="hidden items-center gap-2 border-r border-etch px-3 py-2 md:flex">
          <span className="font-mono text-2xs uppercase tracking-[0.16em] text-dimmer">
            Section
          </span>
          <span className="font-mono text-xs font-medium text-ochre">§G.002</span>
        </div>
        <div className="hidden items-center gap-2 border-r border-etch px-3 py-2 md:flex">
          <span className="font-mono text-2xs uppercase tracking-[0.16em] text-dimmer">Datum</span>
          <span className="font-mono text-xs font-medium text-ochre">WGS84 · J2000</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="hidden font-mono text-2xs uppercase tracking-[0.16em] text-dimmer sm:inline">
            UTC
          </span>
          <Clock />
        </div>
      </header>

      <Ticker count={countries.length} />

      <div className="pointer-events-none absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 font-mono text-2xs leading-6 tracking-wide text-dim md:block">
        {[
          ["bg-ochre", "city lights"],
          ["bg-lichen", "airglow limb"],
          ["bg-bone", "moon"],
          ["bg-defender", "high tide"],
          ["bg-silk", "Yerevan"],
          ["bg-rust", "Ararat"],
        ].map(([dot, label]) => (
          <div key={label}>
            <i className={`mr-2 inline-block h-1.5 w-1.5 ${dot}`} />
            {label}
          </div>
        ))}
      </div>

      <TideGauge countries={countries} />

      <div className="pointer-events-none absolute bottom-2 right-2 z-20 hidden text-right font-mono text-2xs leading-5 tracking-wide text-dimmer sm:block">
        textures <span className="text-lichen">MEASURED</span>
        <br />
        moon range <span className="text-rust">DECLARED</span> · 2.72 R⊕ (real ~60)
        <br />
        ISS inclination 51.6° · Nile cupola home
      </div>

      <button
        type="button"
        aria-expanded={panelOpen}
        aria-controls="atlas-panel"
        className="pointer-events-auto absolute right-2 top-[88px] z-30 min-h-11 border border-ochre bg-substrate px-3 font-mono text-2xs uppercase tracking-[0.16em] text-ochre md:hidden"
        onClick={() => useAtlas.getState().toggle("panelOpen")}
      >
        {panelOpen ? "Close data" : "Open data"}
      </button>

      <aside
        id="atlas-panel"
        className={`hud-scroll pointer-events-auto absolute right-2 top-[88px] z-20 w-[min(320px,calc(100%-1rem))] overflow-y-auto border border-etch bg-substrate md:bottom-[52px] md:top-[88px] ${
          panelOpen ? "block max-h-[min(70dvh,640px)] md:max-h-none" : "hidden md:block"
        }`}
      >
        {selected && (
          <section className="border-b border-etch p-3">
            <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
              <span className="text-ochre">§01</span>
              <span className="font-semibold tracking-[0.2em]">Selected</span>
              <span className="text-dimmer">FIG.2</span>
            </div>
            <div className="font-display text-lg tracking-wide text-silk">{selected}</div>
            <button
              type="button"
              className="mt-2 min-h-11 w-full border border-etch font-mono text-2xs uppercase tracking-[0.12em] text-dim hover:text-silk"
              onClick={() => useAtlas.getState().select(null)}
            >
              Clear
            </button>
          </section>
        )}

        <section className="border-b border-etch p-3">
          <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
            <span className="text-ochre">§02</span>
            <span className="font-semibold tracking-[0.2em]">Views</span>
            <span className="text-dimmer">FIG.3</span>
          </div>
          <div className="grid gap-1">
            {VIEWS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="flex min-h-11 items-center justify-between border border-etch px-2 text-left"
                onClick={() => {
                  useAtlas.getState().select(null);
                  useAtlas.getState().flyTo(focusOf(s));
                }}
              >
                <span className="font-mono text-xs text-silk">{s.label}</span>
                <span className="font-mono text-2xs text-dimmer">{s.note}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1">
            <input
              className="min-h-11 min-w-0 flex-1 border border-etch bg-transparent px-2 font-mono text-xs"
              list="atlas-countries"
              aria-label="Find country"
              placeholder="find country…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const n = names.find((x) => x.toLowerCase() === search.trim().toLowerCase());
                if (n) {
                  goCountry(n);
                  setSearch("");
                }
              }}
            />
            <CountryList names={names} />
          </div>
          <button
            type="button"
            className="mt-2 min-h-11 w-full border border-etch font-mono text-2xs uppercase tracking-[0.12em] text-dim hover:text-silk"
            onClick={async () => {
              const p = new URLSearchParams();
              if (selected) p.set("c", selected);
              else if (site) p.set("site", site);
              const url = `${location.origin}${location.pathname}${p.toString() ? `?${p}` : ""}`;
              try {
                await navigator.clipboard?.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              } catch {
                // clipboard blocked (insecure origin / denied) — leave the label alone
              }
            }}
          >
            {copied ? "Copied" : "Copy view"}
          </button>
        </section>

        <ShellSection />
        <TiltSection />
      </aside>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { centroidOf, NILE, type CountryFeat } from "@/lib/atlas/geo";
import { VIEWS } from "@/lib/atlas/model";
import { useAtlas } from "@/lib/atlas/store";
import { springLabel, tideAt, tideMeters } from "@/lib/atlas/tide";

function Tag({
  kind,
  children,
}: {
  kind: "m" | "d" | "c" | "x";
  children: string;
}) {
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

function LayerToggle({
  id,
  label,
  on,
}: {
  id:
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
  label: string;
  on: boolean;
}) {
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
  return <span className="font-mono text-xs font-medium tabular-nums text-ochre">{t}</span>;
}

export function Hud({ countries }: { countries: CountryFeat[] }) {
  const selected = useAtlas((s) => s.selected);
  const nightGain = useAtlas((s) => s.nightGain);
  const bump = useAtlas((s) => s.bump);
  const sunLon = useAtlas((s) => s.sunLon);
  const moonLon = useAtlas((s) => s.moonLon);
  const tideGain = useAtlas((s) => s.tideGain);
  const panelOpen = useAtlas((s) => s.panelOpen);
  const cupola = useAtlas((s) => s.cupola);
  const autoSun = useAtlas((s) => s.autoSun);
  const autoMoon = useAtlas((s) => s.autoMoon);
  const autoRotate = useAtlas((s) => s.autoRotate);
  const showAtmosphere = useAtlas((s) => s.showAtmosphere);
  const showClouds = useAtlas((s) => s.showClouds);
  const showBorders = useAtlas((s) => s.showBorders);
  const showCage = useAtlas((s) => s.showCage);
  const showIss = useAtlas((s) => s.showIss);
  const showMoon = useAtlas((s) => s.showMoon);
  const showTides = useAtlas((s) => s.showTides);
  const tiltOn = useAtlas((s) => s.tiltOn);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [gyro, setGyro] = useState({ a: "—", b: "—", g: "—" });

  useEffect(() => {
    const on = (e: DeviceOrientationEvent) => {
      if (e.alpha == null) return;
      setGyro({
        a: e.alpha.toFixed(0) + "°",
        b: (e.beta ?? 0).toFixed(0) + "°",
        g: (e.gamma ?? 0).toFixed(0) + "°",
      });
    };
    window.addEventListener("deviceorientation", on);
    return () => window.removeEventListener("deviceorientation", on);
  }, []);

  const names = useMemo(() => countries.map((c) => c.name).sort(), [countries]);

  const goCountry = (n: string) => {
    const c = countries.find((x) => x.name === n);
    if (!c) return;
    const ll = centroidOf(c);
    useAtlas.getState().select(n);
    useAtlas.getState().flyTo({ ...ll, label: n });
  };

  const gauge = (() => {
    let lat = NILE.lat;
    let lon = NILE.lon;
    let where = "Nile";
    if (selected) {
      const c = countries.find((x) => x.name === selected);
      if (c) {
        const ll = centroidOf(c);
        lat = ll.lat;
        lon = ll.lon;
        where = selected;
      }
    }
    const raw = tideAt(lat, lon, moonLon, sunLon);
    const m = tideMeters(raw, showTides ? tideGain : 0);
    const kind = springLabel(moonLon, sunLon);
    return { m, kind, where, raw };
  })();

  return (
    <>
      <header className="pointer-events-auto absolute inset-x-2 top-2 z-20 grid grid-cols-[1fr_auto] border border-etch bg-substrate md:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex items-center gap-2 border-r border-etch px-3 py-2">
          <span className="font-display text-sm font-bold tracking-[0.18em]">
            GROK<span className="text-ochre">.ATLAS</span>
          </span>
          <span className="hidden font-mono text-2xs uppercase tracking-[0.16em] text-dimmer sm:inline">
            / cupola / v2.0
          </span>
        </div>
        <div className="hidden items-center gap-2 border-r border-etch px-3 py-2 md:flex">
          <span className="font-mono text-2xs uppercase tracking-[0.16em] text-dimmer">Section</span>
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

      <div className="pointer-events-none absolute inset-x-2 top-[52px] z-20 flex overflow-x-auto border border-etch bg-substrate font-mono text-2xs uppercase tracking-[0.14em] text-dim">
        <span className="shrink-0 border-r border-etch px-3 py-1.5">{countries.length} states</span>
        <span className="shrink-0 border-r border-etch px-3 py-1.5 text-ochre">
          {selected ?? "idle"}
        </span>
        <span className="shrink-0 border-r border-etch px-3 py-1.5">sun {sunLon.toFixed(0)}°</span>
        <span className="shrink-0 border-r border-etch px-3 py-1.5">moon {moonLon.toFixed(0)}°</span>
        <span className="min-w-0 flex-1 px-3 py-1.5 text-right text-dimmer">
          drag to orbit · scroll zoom · tap a country
        </span>
      </div>

      <div className="pointer-events-none absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 font-mono text-2xs leading-6 tracking-wide text-dim md:block">
        <div>
          <i className="mr-2 inline-block h-1.5 w-1.5 bg-ochre" />
          city lights
        </div>
        <div>
          <i className="mr-2 inline-block h-1.5 w-1.5 bg-lichen" />
          airglow limb
        </div>
        <div>
          <i className="mr-2 inline-block h-1.5 w-1.5 bg-bone" />
          moon
        </div>
        <div>
          <i className="mr-2 inline-block h-1.5 w-1.5 bg-defender" />
          high tide
        </div>
        <div>
          <i className="mr-2 inline-block h-1.5 w-1.5 bg-silk" />
          Yerevan
        </div>
        <div>
          <i className="mr-2 inline-block h-1.5 w-1.5 bg-rust" />
          Ararat
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 z-20 max-w-[min(280px,46vw)]">
        <div className="mb-1 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.16em] text-dimmer">
          <span>Tide · {gauge.where}</span>
          <b className="font-medium text-ochre">{gauge.kind}</b>
        </div>
        <div
          className={`font-mono text-xl tabular-nums ${gauge.m >= 0 ? "text-defender" : "text-rust"}`}
        >
          {gauge.m >= 0 ? "+" : ""}
          {gauge.m.toFixed(2)}
          <span className="ml-1 text-2xs text-dimmer">m</span>
        </div>
        <div className="relative mt-1 h-1 bg-etch">
          <i
            className={`absolute top-0 bottom-0 ${gauge.m >= 0 ? "bg-defender" : "bg-rust"}`}
            style={{
              width: `${Math.min(50, (Math.abs(gauge.raw) / 1.5) * 50)}%`,
              left: gauge.raw >= 0 ? "50%" : `${50 - Math.min(50, (Math.abs(gauge.raw) / 1.5) * 50)}%`,
            }}
          />
          <i className="absolute left-1/2 top-[-3px] h-2.5 w-px bg-silk" />
        </div>
        <div className="mt-1 font-mono text-2xs uppercase tracking-wide text-dimmer">
          lunar P2 + 0.46 solar · <Tag kind="x">declared</Tag>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-2 right-2 z-20 hidden text-right font-mono text-2xs leading-5 tracking-wide text-dimmer sm:block">
        textures <span className="text-lichen">MEASURED</span>
        <br />
        moon range <span className="text-rust">DECLARED</span> · 2.72 R⊕ (real ~60)
        <br />
        ISS inclination 51.6° · Nile cupola home
      </div>

      <button
        type="button"
        className="pointer-events-auto absolute right-2 top-[88px] z-30 min-h-11 border border-ochre bg-substrate px-3 font-mono text-2xs uppercase tracking-[0.16em] text-ochre md:hidden"
        onClick={() => useAtlas.getState().toggle("panelOpen")}
      >
        {panelOpen ? "Close data" : "Open data"}
      </button>

      <aside
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
                  useAtlas.getState().flyTo({
                    lat: s.lat,
                    lon: s.lon,
                    label: s.label,
                    dist: s.dist,
                  });
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
              placeholder="find country…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const n = names.find((x) => x.toLowerCase() === search.toLowerCase());
                if (n) {
                  goCountry(n);
                  setSearch("");
                }
              }}
            />
            <datalist id="atlas-countries">
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <button
            type="button"
            className="mt-2 min-h-11 w-full border border-etch font-mono text-2xs uppercase tracking-[0.12em] text-dim hover:text-silk"
            onClick={async () => {
              const p = new URLSearchParams();
              if (selected) p.set("c", selected);
              const url = `${location.origin}${location.pathname}${p.toString() ? `?${p}` : ""}`;
              await navigator.clipboard?.writeText(url).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? "Copied" : "Copy view"}
          </button>
        </section>

        <section className="border-b border-etch p-3">
          <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
            <span className="text-ochre">§03</span>
            <span className="font-semibold tracking-[0.2em]">Shell</span>
            <span className="text-dimmer">FIG.4</span>
          </div>
          <label className="mt-1 block font-mono text-2xs uppercase tracking-[0.14em] text-dimmer">
            Night gain{" "}
            <b className="float-right font-medium text-ochre">×{nightGain.toFixed(2)}</b>
          </label>
          <input
            className="inst"
            type="range"
            min={40}
            max={300}
            value={Math.round(nightGain * 100)}
            onChange={(e) => useAtlas.getState().setNightGain(+e.target.value / 100)}
          />
          <label className="mt-2 block font-mono text-2xs uppercase tracking-[0.14em] text-dimmer">
            Relief / bump <b className="float-right font-medium text-ochre">×{bump.toFixed(2)}</b>
          </label>
          <input
            className="inst"
            type="range"
            min={0}
            max={250}
            value={Math.round(bump * 100)}
            onChange={(e) => useAtlas.getState().setBump(+e.target.value / 100)}
          />
          <label className="mt-2 block font-mono text-2xs uppercase tracking-[0.14em] text-dimmer">
            Subsolar longitude{" "}
            <b className="float-right font-medium text-ochre">{sunLon.toFixed(0)}°</b>
          </label>
          <input
            className="inst"
            type="range"
            min={0}
            max={359}
            value={Math.round(sunLon)}
            onChange={(e) => {
              useAtlas.getState().setAutoSun(false);
              useAtlas.getState().setSunLon(+e.target.value);
            }}
          />
          <label className="mt-2 block font-mono text-2xs uppercase tracking-[0.14em] text-dimmer">
            Moon longitude{" "}
            <b className="float-right font-medium text-ochre">{moonLon.toFixed(0)}°</b>
          </label>
          <input
            className="inst"
            type="range"
            min={0}
            max={359}
            value={Math.round((moonLon + 360) % 360)}
            onChange={(e) => {
              useAtlas.getState().setAutoMoon(false);
              useAtlas.getState().setMoonLon(+e.target.value);
            }}
          />
          <label className="mt-2 block font-mono text-2xs uppercase tracking-[0.14em] text-dimmer">
            Tide gain <b className="float-right font-medium text-ochre">×{tideGain.toFixed(2)}</b>
          </label>
          <input
            className="inst"
            type="range"
            min={0}
            max={220}
            value={Math.round(tideGain * 100)}
            onChange={(e) => useAtlas.getState().setTideGain(+e.target.value / 100)}
          />
          <div className="mt-3 grid grid-cols-2 gap-1">
            <LayerToggle id="showAtmosphere" label="atmosphere" on={showAtmosphere} />
            <LayerToggle id="showClouds" label="clouds" on={showClouds} />
            <LayerToggle id="showBorders" label="borders" on={showBorders} />
            <LayerToggle id="showIss" label="ISS" on={showIss} />
            <LayerToggle id="showMoon" label="moon" on={showMoon} />
            <LayerToggle id="showTides" label="tides" on={showTides} />
            <LayerToggle id="showCage" label="cage" on={showCage} />
            <LayerToggle id="cupola" label="cupola" on={cupola} />
            <LayerToggle id="autoSun" label="sun drift" on={autoSun} />
            <LayerToggle id="autoMoon" label="moon drift" on={autoMoon} />
            <LayerToggle id="autoRotate" label="orbit" on={autoRotate} />
          </div>
        </section>

        <section className="p-3">
          <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
            <span className="text-ochre">§04</span>
            <span className="font-semibold tracking-[0.2em]">Device tilt</span>
            <span className="text-dimmer">FIG.5</span>
          </div>
          <button
            type="button"
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
                  const g = await DOE.requestPermission();
                  if (g !== "granted") return;
                } catch {
                  return;
                }
              }
              st.toggle("tiltOn");
            }}
          >
            {tiltOn ? "Stop · recalibrate" : "Use device tilt"}
            <span>{tiltOn ? "▮▮" : "◉"}</span>
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
      </aside>
    </>
  );
}

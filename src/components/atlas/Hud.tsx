import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { centroidOf, type CountryFeat } from "@/lib/atlas/geo";
import { focusForCountry } from "@/lib/atlas/fly";
import {
  formatOffset,
  formatRate,
  formatStamp,
  isLive,
  RATES,
  stampParam,
} from "@/lib/atlas/clock";
import { focusOf, HOME, RIDE_ID, VIEWS } from "@/lib/atlas/model";
import type { View } from "@/lib/atlas/model";
import { useFinePointer } from "@/lib/atlas/pointer";
import { useAtlas } from "@/lib/atlas/store";
import { springLabel, tideAt, tideMeters } from "@/lib/atlas/tide";
import { deviceCaps } from "@/lib/atlas/device";
import { frameStats } from "@/lib/atlas/perf";
import { ThumbDock } from "./ThumbDock";
import { useKeys } from "./use-keys";
import { useLocate } from "./use-locate";

/**
 * `tickOrbits` writes sunLon/moonLon every frame, so anything that subscribes
 * to them re-renders at 60 fps. The readouts only ever show whole degrees —
 * subscribe rounded, and keep those subscriptions in leaf components so the
 * HUD shell (and its 170-option datalist) never reconciles on drift.
 */
const useSunDeg = () => useAtlas((s) => Math.round(s.sunLon));
const useMoonDeg = () => useAtlas((s) => Math.round(s.moonLon) % 360);

/** A view is a camera, except the one that is a seat. */
const goView = (v: View) => {
  const st = useAtlas.getState();
  st.select(null);
  if (v.id === RIDE_ID) st.rideIss(true);
  else st.flyTo(focusOf(v));
};

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
      className={`inline-block border px-1 py-px font-mono text-micro uppercase leading-none tracking-[0.16em] ${cls}`}
    >
      {children}
    </span>
  );
}

function Tip({ text, end, children }: { text: string; end?: boolean; children: ReactNode }) {
  return (
    <span className={`tip block ${end ? "tip-end" : ""}`} data-tip={text}>
      {children}
    </span>
  );
}

type ToggleId =
  | "showAtmosphere"
  | "showClouds"
  | "showBorders"
  | "showCage"
  | "showGrid"
  | "showIss"
  | "showRivers"
  | "showMoon"
  | "showTides"
  | "cupola"
  | "autoRotate";

const LAYER_TIPS: Record<ToggleId, string> = {
  showAtmosphere: "Limb airglow. Cheap pass.",
  showClouds: "Drifting cloud deck.",
  showBorders: "Natural Earth 110m outlines.",
  showCage: "Geodesic shell. Chrome, no scale.",
  showGrid: "30° graticule with degree readings.",
  showIss: "Live ZARYA pin, 5 s poll.",
  showRivers: "Twelve great rivers, running downstream.",
  showMoon: "Phase disc, declared range.",
  showTides: "P2 lunar + 0.46 solar bulge.",
  cupola: "Window vignette. ISS frame.",
  autoRotate: "Idle orbit. Stops on drag.",
};

function LayerToggle({ id, label }: { id: ToggleId; label: string }) {
  const on = useAtlas((s) => s[id]);
  return (
    <Tip text={LAYER_TIPS[id]} end>
      <button
        type="button"
        aria-pressed={on}
        aria-label={`${label}. ${LAYER_TIPS[id]}`}
        onClick={() => useAtlas.getState().toggle(id)}
        className={`press min-h-11 w-full border border-etch px-2 font-mono text-2xs uppercase tracking-[0.12em] transition-colors duration-150 ${
          on ? "bg-substrate-2 text-silk" : "text-dimmer hover:text-silk"
        }`}
      >
        {label}
      </button>
    </Tip>
  );
}

/**
 * The header clock reads the instant on the globe, not the one on the wall —
 * a header that says 12:00 over a midnight Earth is a bug with a nice font.
 */
function Clock({ compact }: { compact?: boolean }) {
  const [t, setT] = useState("—");
  const at = useAtlas((s) => s.clockAt);
  const seconds = useAtlas((s) => isLive(s.clock));
  useEffect(() => {
    const tick = () => {
      const d = new Date(seconds ? Date.now() : useAtlas.getState().clockAt);
      const p = (n: number) => String(n).padStart(2, "0");
      setT(
        compact
          ? `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`
          : `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [compact, seconds, at]);
  return (
    <span className="font-mono text-xs font-medium tabular-nums text-ochre">
      <time dateTime={t}>{t}</time>
    </span>
  );
}

function Ticker({ count, fine }: { count: number; fine: boolean }) {
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
        {fine ? "drag orbit · wheel zoom · click country" : "drag · pinch · tap country"}
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
    <div className="pointer-events-none max-w-[min(280px,46vw)]">
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
  tip,
  value,
  min,
  max,
  onChange,
  format,
}: {
  label: string;
  tip: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const id = `inst-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <>
      <Tip text={tip}>
        <label
          htmlFor={id}
          className="mt-2 block font-mono text-2xs uppercase tracking-[0.14em] text-dimmer"
        >
          {label} <b className="float-right font-medium text-ochre">{format(value)}</b>
        </label>
      </Tip>
      <input
        id={id}
        className="inst"
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={`${label}. ${tip}`}
        onChange={(e) => onChange(+e.target.value)}
      />
    </>
  );
}

/**
 * Frame rate is a per-frame number and this is a HUD: poll it twice a second
 * rather than let sixty frames re-render the panel to print one integer.
 */
function FrameReadout() {
  const [s, setS] = useState(frameStats);
  useEffect(() => {
    const id = setInterval(() => setS(frameStats()), 500);
    return () => clearInterval(id);
  }, []);
  const held = s.fps >= 55;
  return (
    <span className={held ? "text-lichen" : "text-rust"}>
      {Math.round(s.fps)} fps{s.scale < 1 ? ` · ×${s.scale.toFixed(2)}` : ""}
    </span>
  );
}

/** Not a layer — a seat. It takes the camera, so it gets its own button. */
function RideToggle() {
  const on = useAtlas((s) => s.issRide);
  return (
    <Tip text="Camera on the station, looking down the track." end>
      <button
        type="button"
        aria-pressed={on}
        aria-label="ISS ride. Camera on the station, looking down the track."
        onClick={() => useAtlas.getState().rideIss(!on)}
        className={`press min-h-11 w-full border px-2 font-mono text-2xs uppercase tracking-[0.12em] transition-colors duration-150 ${
          on ? "border-ochre bg-substrate-2 text-ochre" : "border-etch text-dimmer hover:text-silk"
        }`}
      >
        {on ? "leave ride" : "iss ride"}
      </button>
    </Tip>
  );
}

/** Scrub range on the slider: half a day either side of wherever you are. */
const SCRUB_SPAN = 12 * 3600_000;

/** Thumb-sized jumps, for a tray with no room for eight rates. */
const JUMPS = [
  { ms: -86400_000, label: "−1 d", hint: "Jump back one day" },
  { ms: -3600_000, label: "−1 h", hint: "Jump back one hour" },
  { ms: 3600_000, label: "+1 h", hint: "Jump forward one hour" },
  { ms: 86400_000, label: "+1 d", hint: "Jump forward one day" },
] as const;

function RateButton({ rate, active }: { rate: number; active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`Run time at ${formatRate(rate)}`}
      onClick={() => useAtlas.getState().setRate(rate)}
      className={`press min-h-9 border px-1 font-mono text-2xs uppercase tracking-[0.08em] transition-colors duration-150 ${
        active
          ? "border-ochre bg-substrate-2 text-ochre"
          : "border-etch text-dimmer hover:text-silk"
      }`}
    >
      {formatRate(rate)}
    </button>
  );
}

/**
 * The time machine. Everything in the sky is a function of one instant, so
 * this is the only control that should be moving it — the two longitude
 * sliders this replaces dragged the sun and the moon apart from each other and
 * from the clock, and called the result a view.
 */
function TimeSection({ compact }: { compact: boolean }) {
  const clock = useAtlas((s) => s.clock);
  // Whole minutes: the stamp only ever shows minutes, and this subscribes to a
  // value the rig rewrites every frame while the clock is running.
  const at = useAtlas((s) => Math.floor(s.clockAt / 60000) * 60000);
  const live = isLive(clock);
  const st = useAtlas.getState;
  const scrubRef = useRef<HTMLInputElement>(null);
  const lastScrub = useRef(0);
  const endScrub = () => {
    lastScrub.current = 0;
    if (scrubRef.current) scrubRef.current.value = "0";
  };

  return (
    <section className="border-b border-etch p-3">
      {!compact && (
        <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
          <span className="text-ochre">§01</span>
          <span className="font-semibold tracking-[0.2em]">Time</span>
          <span className="text-dimmer">FIG.1</span>
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <span className={`font-mono text-sm tabular-nums ${live ? "text-dim" : "text-ochre"}`}>
          {formatStamp(at)}
        </span>
        <span className="font-mono text-2xs uppercase tracking-[0.14em] text-dimmer">
          {formatOffset(clock.offset)}
        </span>
      </div>

      <label
        htmlFor="atlas-scrub"
        className="mt-3 block font-mono text-2xs uppercase tracking-[0.14em] text-dimmer"
      >
        Scrub ±12 h
      </label>
      <input
        id="atlas-scrub"
        ref={scrubRef}
        className="inst"
        type="range"
        min={-SCRUB_SPAN}
        max={SCRUB_SPAN}
        step={60_000}
        /**
         * A jog wheel, not a position: it reports the distance since the last
         * event and recentres on release, so one drag to +6 h moves the clock
         * six hours however far out it already is. Pinned at zero it would
         * re-apply its whole excursion on every event of the same drag.
         */
        defaultValue={0}
        aria-label="Scrub time, twelve hours either way"
        onChange={(e) => {
          const v = +e.target.value;
          st().scrub(v - lastScrub.current);
          lastScrub.current = v;
        }}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onKeyUp={endScrub}
        onBlur={endScrub}
      />

      <div className="mt-2 grid grid-cols-2 gap-1">
        <Tip text="Hold the sky where it is · Space">
          <button
            type="button"
            aria-pressed={clock.rate === 0}
            aria-label={clock.rate === 0 ? "Resume time" : "Hold time"}
            onClick={() => st().holdClock()}
            className={`press min-h-11 w-full border font-mono text-2xs uppercase tracking-[0.12em] ${
              clock.rate === 0
                ? "border-ochre bg-substrate-2 text-ochre"
                : "border-etch text-silk hover:text-silk"
            }`}
          >
            {clock.rate === 0 ? "resume" : "hold"}
          </button>
        </Tip>
        <Tip text="Back to the real sky · N" end>
          <button
            type="button"
            disabled={live}
            aria-label="Return to the real sky"
            onClick={() => st().goLive()}
            className={`press min-h-11 w-full border font-mono text-2xs uppercase tracking-[0.12em] ${
              live ? "border-etch text-dimmer" : "border-ochre text-ochre"
            }`}
          >
            now
          </button>
        </Tip>
      </div>

      <div className="mt-1 grid grid-cols-4 gap-1">
        {RATES.filter((r) => r > 0).map((r) => (
          <RateButton key={r} rate={r} active={clock.rate === r} />
        ))}
      </div>
      {/* A phone gets jumps, which a thumb can aim; reverse rates stay on the
          rail, where there is room for eight buttons and a mouse to pick one. */}
      <div className="mt-1 grid grid-cols-4 gap-1">
        {compact
          ? JUMPS.map((j) => (
              <button
                key={j.ms}
                type="button"
                aria-label={j.hint}
                onClick={() => st().scrub(j.ms)}
                className="press min-h-9 w-full border border-etch font-mono text-2xs uppercase tracking-[0.08em] text-dimmer"
              >
                {j.label}
              </button>
            ))
          : RATES.filter((r) => r > 1).map((r) => (
              <RateButton key={-r} rate={-r} active={clock.rate === -r} />
            ))}
        {!compact && (
          <Tip text="Jump back a day" end>
            <button
              type="button"
              aria-label="Jump back one day"
              onClick={() => st().scrub(-86400_000)}
              className="press min-h-9 w-full border border-etch font-mono text-2xs uppercase tracking-[0.08em] text-dimmer hover:text-silk"
            >
              −1 d
            </button>
          </Tip>
        )}
      </div>

      {!compact && (
        <p className="mt-1 font-mono text-2xs uppercase leading-5 tracking-wide text-dimmer">
          one clock · terminator, phase, station
        </p>
      )}
    </section>
  );
}

function ShellSection({ compact }: { compact: boolean }) {
  const nightGain = useAtlas((s) => s.nightGain);
  const bump = useAtlas((s) => s.bump);
  const tideGain = useAtlas((s) => s.tideGain);
  const grainMix = useAtlas((s) => s.grainMix);
  const st = useAtlas.getState;
  const cap = deviceCaps();

  const sliders = (
    <>
      <Slider
        label="Night gain"
        tip="Night-side city lights. ISS cupola look."
        min={40}
        max={300}
        value={Math.round(nightGain * 100)}
        onChange={(v) => st().setNightGain(v / 100)}
        format={(v) => `×${(v / 100).toFixed(2)}`}
      />
      <Slider
        label="Relief / bump"
        tip="Normal-map bump on land."
        min={0}
        max={250}
        value={Math.round(bump * 100)}
        onChange={(v) => st().setBump(v / 100)}
        format={(v) => `×${(v / 100).toFixed(2)}`}
      />
      <Slider
        label="Tide gain"
        tip="Ocean bulge scale. Needs tides on."
        min={0}
        max={220}
        value={Math.round(tideGain * 100)}
        onChange={(v) => st().setTideGain(v / 100)}
        format={(v) => `×${(v / 100).toFixed(2)}`}
      />
      <Slider
        label="Grain · lights / relief"
        tip="ISS grain on lights and land. Off on compat GPUs."
        min={0}
        max={150}
        value={Math.round(grainMix * 100)}
        onChange={(v) => st().setGrainMix(v / 100)}
        format={(v) => (cap.tier === "low" ? "compat 0" : `${cap.tier} ×${(v / 100).toFixed(2)}`)}
      />
      <p className="mt-2 font-mono text-2xs uppercase tracking-wide text-dimmer">
        gpu {cap.label} · {cap.webgl2 ? "webgl2" : "webgl1"} · dpr {cap.dpr[1]} · <FrameReadout />
      </p>
    </>
  );

  return (
    <section className="border-b border-etch p-3">
      {!compact && (
        <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
          <span className="text-ochre">§05</span>
          <span className="font-semibold tracking-[0.2em]">Shell</span>
          <span className="text-dimmer">FIG.5</span>
        </div>
      )}
      {sliders}
    </section>
  );
}

/** A group of switches with one word saying what they have in common. */
function LayerGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <p className="mt-2 font-mono text-2xs uppercase tracking-[0.18em] text-dimmer">{title}</p>
      <div className="mt-1 grid grid-cols-2 gap-1">{children}</div>
    </>
  );
}

/**
 * Everything that can be on or off, in three groups that answer three
 * questions: what is drawn on the earth, what is drawn around it, and what the
 * window itself does. As one flat grid of twelve it was a wall of switches
 * buried under four sliders in a section called Shell.
 */
function LayersSection({ compact }: { compact: boolean }) {
  return (
    <section className="border-b border-etch p-3">
      {!compact && (
        <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
          <span className="text-ochre">§04</span>
          <span className="font-semibold tracking-[0.2em]">Layers</span>
          <span className="text-dimmer">FIG.4</span>
        </div>
      )}
      <LayerGroup title="on the earth">
        <LayerToggle id="showBorders" label="borders" />
        <LayerToggle id="showRivers" label="rivers" />
        <LayerToggle id="showClouds" label="clouds" />
        <LayerToggle id="showTides" label="tides" />
      </LayerGroup>
      <LayerGroup title="around it">
        <LayerToggle id="showAtmosphere" label="atmosphere" />
        <LayerToggle id="showMoon" label="moon" />
        <LayerToggle id="showIss" label="ISS" />
        <RideToggle />
      </LayerGroup>
      <LayerGroup title="grid and frame">
        {/* Two switches, because they answer two questions: where am I, and
            how much chrome do I want. */}
        <LayerToggle id="showGrid" label="geo net" />
        <LayerToggle id="showCage" label="cage" />
        <LayerToggle id="cupola" label="cupola" />
        <LayerToggle id="autoRotate" label="orbit" />
      </LayerGroup>
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
        <span className="text-ochre">§05</span>
        <span className="font-semibold tracking-[0.2em]">Device tilt</span>
        <span className="text-dimmer">FIG.5</span>
      </div>
      <Tip text="iOS asks once. Current pose becomes home.">
        <button
          type="button"
          aria-pressed={tiltOn}
          className={`press flex min-h-11 w-full items-center justify-between border px-3 font-mono text-xs uppercase tracking-[0.16em] ${
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
      </Tip>
      <div className="mt-2 grid grid-cols-3 gap-px bg-etch">
        {[
          ["α", gyro.a],
          ["β", gyro.b],
          ["γ", gyro.g],
        ].map(([k, v]) => (
          <div key={k} className="bg-substrate-2 px-2 py-2 text-center">
            <div className="font-mono text-micro tracking-[0.16em] text-dimmer">{k}</div>
            <div className="font-mono text-sm tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 font-mono text-2xs uppercase tracking-wide text-dimmer">
        {tiltOn ? "Live — current pose is home" : "Tilt off — drag to rotate"}
      </p>
    </section>
  );
}

function PointerSection() {
  return (
    <section className="p-3">
      <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
        <span className="text-ochre">§05</span>
        <span className="font-semibold tracking-[0.2em]">Pointer</span>
        <span className="text-dimmer">FIG.5</span>
      </div>
      <ul className="space-y-1 font-mono text-2xs uppercase leading-5 tracking-wide text-dim">
        <li>drag — orbit</li>
        <li>wheel — zoom</li>
        <li>click — pick country</li>
        <li>idle orbit — layer toggle</li>
      </ul>
      <ul className="mt-2 space-y-1 border-t border-etch pt-2 font-mono text-2xs uppercase leading-5 tracking-wide text-dim">
        <li>
          <b className="text-ochre">t</b> — toolbox
        </li>
        <li>
          <b className="text-ochre">l</b> — locate
        </li>
        <li>
          <b className="text-ochre">i</b> — iss ride
        </li>
        <li>
          <b className="text-ochre">space</b> — hold time
        </li>
        <li>
          <b className="text-ochre">, .</b> — scrub ∓1 h
        </li>
        <li>
          <b className="text-ochre">n</b> — back to now
        </li>
        <li>
          <b className="text-ochre">esc</b> — leave ride · close
        </li>
      </ul>
      <div className="mt-3 font-mono text-2xs uppercase tracking-wide text-dimmer">
        overlay <Tag kind="x">declared</Tag> · textures <Tag kind="m">measured</Tag>
      </div>
    </section>
  );
}

function ViewsSection({
  countries,
  names,
  compact,
}: {
  countries: CountryFeat[];
  names: string[];
  compact: boolean;
}) {
  const selected = useAtlas((s) => s.selected);
  const ride = useAtlas((s) => s.issRide);
  const site = useAtlas((s) => (s.issRide ? RIDE_ID : s.focus?.site));
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");

  const goCountry = (n: string) => {
    const c = countries.find((x) => x.name === n);
    if (!c) return;
    useAtlas.getState().select(n);
    useAtlas.getState().flyTo(focusForCountry(c));
  };

  return (
    <section className="border-b border-etch p-3">
      {!compact && (
        <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
          <span className="text-ochre">§03</span>
          <span className="font-semibold tracking-[0.2em]">Views</span>
          <span className="text-dimmer">FIG.3</span>
        </div>
      )}
      {!compact && (
        <div className="grid gap-1">
          {VIEWS.map((s) => (
            <Tip key={s.id} text={s.note} end>
              <button
                type="button"
                className="press flex min-h-11 w-full items-center justify-between border border-etch px-2 text-left"
                onClick={() => goView(s)}
              >
                <span className="font-mono text-xs text-silk">{s.label}</span>
                <span className="font-mono text-2xs text-dimmer">{s.note}</span>
              </button>
            </Tip>
          ))}
        </div>
      )}
      {compact && (
        // A horizontal scroller put West Pacific under the right edge and the
        // ISS ride past it entirely, with nothing to say more existed. Six
        // views fit two columns without asking a thumb to discover a swipe.
        <div className="mb-2 grid grid-cols-2 gap-1">
          {VIEWS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="press min-h-11 border border-etch px-2 font-mono text-2xs uppercase tracking-[0.1em] text-silk"
              onClick={() => goView(s)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className={`${compact ? "" : "mt-2"} flex gap-1`}>
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
        className="press mt-2 min-h-11 w-full border border-etch font-mono text-2xs uppercase tracking-[0.12em] text-dim hover:text-silk"
        onClick={async () => {
          const p = new URLSearchParams();
          // The ride is the view: a country under it is not what you'd share.
          if (selected && !ride) p.set("c", selected);
          else if (site) p.set("site", site);
          // A view is a place and an instant. Sharing the place without the
          // sky that made it worth sharing loses half of it.
          const clock = useAtlas.getState();
          if (!isLive(clock.clock)) p.set("t", stampParam(clock.clockAt));
          const url = `${location.origin}${location.pathname}${p.toString() ? `?${p}` : ""}`;
          try {
            await navigator.clipboard?.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch {
            /* clipboard blocked */
          }
        }}
      >
        {copied ? "Copied" : "Copy view"}
      </button>
    </section>
  );
}

function MobileDock() {
  const panelOpen = useAtlas((s) => s.panelOpen);
  return (
    <ThumbDock
      third={{
        label: panelOpen ? "Close" : "Toolbox",
        pressed: panelOpen,
        hint: panelOpen ? "Close the toolbox" : "Open the toolbox",
        onClick: () => useAtlas.getState().toggle("panelOpen"),
      }}
    />
  );
}

/**
 * The phone tray is 317 px tall and held 1,258 px of controls — four screens
 * of scrolling, the first of which was entirely the time machine. Same
 * sections, one tap apart, each pane sized to the screen it actually gets.
 */
const TABS = [
  { id: "go", label: "Go" },
  { id: "show", label: "Show" },
  { id: "time", label: "Time" },
  { id: "look", label: "Look" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function TrayTabs({ active, onPick }: { active: TabId; onPick: (id: TabId) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Toolbox"
      className="sticky top-11 z-10 grid grid-cols-4 gap-1 border-b border-etch bg-substrate px-3 pb-2"
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          aria-controls={`tray-${t.id}`}
          onClick={() => onPick(t.id)}
          className={`press min-h-11 border font-mono text-2xs uppercase tracking-[0.14em] ${
            active === t.id ? "border-ochre bg-substrate-2 text-ochre" : "border-etch text-dimmer"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Hud({ countries, onQuiet }: { countries: CountryFeat[]; onQuiet: () => void }) {
  const selected = useAtlas((s) => s.selected);
  const panelOpen = useAtlas((s) => s.panelOpen);
  const railOpen = useAtlas((s) => s.railOpen);
  const fine = useFinePointer();
  const names = useMemo(() => countries.map((c) => c.name).sort(), [countries]);
  const swipeY = useRef<number | null>(null);
  const locate = useLocate();
  const [tab, setTab] = useState<TabId>("go");
  const open = fine ? railOpen : panelOpen;

  /**
   * The panel is a scroller — 1228px of instrument in a 580px rail — and it
   * gave no sign of it: the shell sliders were cut mid-row with nothing to say
   * more existed. `data-more` fades the bottom edge only while there is more,
   * so it stops lying once you reach the end.
   */
  const panelRef = useRef<HTMLElement>(null);
  const cueScroll = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    const more = el.scrollHeight - el.scrollTop - el.clientHeight > 4;
    el.dataset.more = more ? "true" : "false";
  }, []);
  useEffect(cueScroll, [cueScroll, open, selected, fine]);

  const closeTray = () => {
    if (useAtlas.getState().panelOpen) useAtlas.getState().toggle("panelOpen");
  };

  // The rail is the desktop's tray: the same three actions the thumb dock puts
  // under a thumb, put under the fingers already on the keys.
  useKeys(
    {
      t: () => useAtlas.getState().toggle("railOpen"),
      " ": () => useAtlas.getState().holdClock(),
      n: () => useAtlas.getState().goLive(),
      ",": () => useAtlas.getState().scrub(-3600_000),
      ".": () => useAtlas.getState().scrub(3600_000),
      l: () => void locate.run(),
      i: () => {
        const st = useAtlas.getState();
        if (st.iss) st.rideIss(!st.issRide);
      },
      Escape: () => {
        const st = useAtlas.getState();
        if (st.issRide) st.rideIss(false);
        else if (st.railOpen) st.toggle("railOpen");
      },
    },
    fine,
  );

  /**
   * Tap closes, and so does a real pull down. The previous handler ran both an
   * `onClick` and a 48px swipe test, so every release closed the tray and the
   * swipe branch decided nothing — including a pull *up*, which should hold.
   */
  const endDrag = (e: { clientY: number }) => {
    const y0 = swipeY.current;
    swipeY.current = null;
    if (y0 == null) return;
    const dy = e.clientY - y0;
    if (dy > 44 || Math.abs(dy) < 6) closeTray();
  };

  return (
    <>
      <header className="pointer-events-auto absolute inset-x-2 top-2 z-20 grid grid-cols-[1fr_auto] border border-etch bg-substrate md:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex items-center gap-2 border-r border-etch px-3 py-2">
          <Tip text="Quiet edition. Same globe.">
            <button
              type="button"
              onClick={onQuiet}
              className="press font-display text-sm font-bold tracking-[0.18em]"
            >
              GROK<span className="text-ochre">.ATLAS</span>
            </button>
          </Tip>
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
          <Clock compact={!fine} />
        </div>
      </header>

      {fine ? <Ticker count={countries.length} fine={fine} /> : null}

      {fine && (
        <div className="pointer-events-none absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 font-mono text-2xs leading-6 tracking-wide text-dim md:block">
          {[
            ["bg-ochre", "city lights"],
            ["bg-lichen", "airglow limb"],
            ["bg-bone", "moon"],
            ["bg-defender", "high tide"],
          ].map(([dot, label]) => (
            <div key={label}>
              <i className={`mr-2 inline-block h-1.5 w-1.5 ${dot}`} />
              {label}
            </div>
          ))}
        </div>
      )}

      {fine && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-20">
          <TideGauge countries={countries} />
        </div>
      )}

      {fine && (
        <div className="pointer-events-none absolute bottom-2 right-2 z-20 hidden text-right font-mono text-2xs leading-5 tracking-wide text-dimmer sm:block">
          textures <span className="text-lichen">MEASURED</span>
          <br />
          moon range <span className="text-rust">DECLARED</span> · 2.72 R⊕ (real ~60)
          <br />
          ISS inclination 51.6° · drag to orbit
        </div>
      )}

      {!fine && <MobileDock />}

      {fine && (
        // The slot owns the position: `Tip` sets `position: relative`, so an
        // absolutely placed button inside one anchors to the tip, not the HUD.
        <div
          className="rail-slot pointer-events-none absolute top-1/2 z-30 -translate-y-1/2"
          style={{ right: railOpen ? "calc(0.5rem + min(320px, 100% - 1rem))" : "0.5rem" }}
        >
          <Tip text={railOpen ? "Collapse the toolbox · T" : "Open the toolbox · T"} end>
            <button
              type="button"
              aria-expanded={railOpen}
              aria-controls="atlas-panel"
              aria-label={railOpen ? "Collapse the toolbox" : "Open the toolbox"}
              // The tray got a handle so a thumb could dismiss it; the rail is
              // 320px of opaque panel over a third of the globe with no way at
              // all to put it away. Same affordance, turned on its side.
              className="rail-grab press pointer-events-auto flex h-16 w-6 items-center justify-center border border-etch bg-substrate"
              onClick={() => useAtlas.getState().toggle("railOpen")}
            >
              <span className="block h-8 w-1 bg-etch" />
            </button>
          </Tip>
        </div>
      )}

      <aside
        id="atlas-panel"
        ref={panelRef}
        data-open={open ? "true" : "false"}
        aria-hidden={!open}
        onScroll={cueScroll}
        className={`hud-scroll tray pointer-events-auto z-20 overflow-y-auto border border-etch bg-substrate ${
          open ? "" : "invisible"
        } ${
          fine
            ? "rail absolute right-2 top-[88px] bottom-[52px] w-[min(320px,calc(100%-1rem))]"
            : "absolute inset-x-2 max-h-[min(48dvh,460px)]"
        }`}
        style={
          fine ? undefined : { bottom: "calc(max(0.5rem, env(safe-area-inset-bottom)) + 4.25rem)" }
        }
      >
        {!fine && (
          <button
            type="button"
            aria-label="Close toolbox"
            aria-controls="atlas-panel"
            // 20px of grab bar was under every touch-target floor going; the
            // row is the target now, the bar is just what you can see of it.
            className="tray-handle sticky top-0 z-10 flex min-h-11 w-full items-center justify-center bg-substrate"
            onPointerDown={(e) => {
              swipeY.current = e.clientY;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerUp={endDrag}
            onPointerCancel={() => {
              swipeY.current = null;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") closeTray();
            }}
          >
            <span className="block h-1 w-10 bg-etch" />
          </button>
        )}
        {fine ? (
          <>
            <TimeSection compact={false} />
            <ViewsSection countries={countries} names={names} compact={false} />
            <LayersSection compact={false} />
            <ShellSection compact={false} />
            <PointerSection />
          </>
        ) : (
          <>
            <TrayTabs active={tab} onPick={setTab} />
            <div id={`tray-${tab}`} role="tabpanel">
              {tab === "go" && <ViewsSection countries={countries} names={names} compact />}
              {tab === "show" && <LayersSection compact />}
              {tab === "time" && <TimeSection compact />}
              {tab === "look" && (
                <>
                  <ShellSection compact />
                  <div className="border-b border-etch p-3">
                    <TideGauge countries={countries} />
                  </div>
                  <TiltSection />
                </>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

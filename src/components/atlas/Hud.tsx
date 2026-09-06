import { useEffect, useMemo, useState } from "react";
import { POLES, affOf, NUKES } from "@/lib/atlas/affinities";
import { centroidOf, SITES, type CountryFeat } from "@/lib/atlas/geo";
import { CEIL, COMMIT, PRESETS, THRESHOLD, type Role } from "@/lib/atlas/model";
import { useAtlas } from "@/lib/atlas/store";

function Tag({
  kind,
  children,
}: {
  kind: "m" | "d" | "c" | "x" | "a";
  children: string;
}) {
  const cls =
    kind === "m"
      ? "text-ochre border-ochre"
      : kind === "d"
        ? "text-lichen border-lichen"
        : kind === "c"
          ? "text-dim border-dim"
          : kind === "x"
            ? "text-rust border-rust"
            : "text-attacker border-attacker";
  return (
    <span
      className={`inline-block border px-1 py-px font-mono text-[8px] uppercase leading-none tracking-[0.16em] ${cls}`}
    >
      {children}
    </span>
  );
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mt-1 grid grid-flow-col gap-px bg-etch" role="group">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-11 px-1 font-mono text-2xs uppercase tracking-[0.12em] ${
            value === o.id ? "bg-rust text-silk" : "bg-substrate-2 text-dim hover:text-silk"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
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
    | "cupola"
    | "autoSun"
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
  const roles = useAtlas((s) => s.roles);
  const scores = useAtlas((s) => s.scores);
  const selected = useAtlas((s) => s.selected);
  const atlasMix = useAtlas((s) => s.atlasMix);
  const nightGain = useAtlas((s) => s.nightGain);
  const bump = useAtlas((s) => s.bump);
  const sunLon = useAtlas((s) => s.sunLon);
  const panelOpen = useAtlas((s) => s.panelOpen);
  const cupola = useAtlas((s) => s.cupola);
  const autoSun = useAtlas((s) => s.autoSun);
  const autoRotate = useAtlas((s) => s.autoRotate);
  const showAtmosphere = useAtlas((s) => s.showAtmosphere);
  const showClouds = useAtlas((s) => s.showClouds);
  const showBorders = useAtlas((s) => s.showBorders);
  const showCage = useAtlas((s) => s.showCage);
  const showIss = useAtlas((s) => s.showIss);
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

  const defenders = Object.entries(roles)
    .filter(([, r]) => r === "defender")
    .map(([n]) => n);
  const attackers = Object.entries(roles)
    .filter(([, r]) => r === "attacker")
    .map(([n]) => n);

  let peak = 0;
  let peakWho: string | null = null;
  for (const name of Object.keys(NUKES)) {
    const s = scores[name] ?? 0;
    if (Math.abs(s) > Math.abs(peak)) {
      peak = s;
      peakWho = name;
    }
  }
  const hot = Math.abs(peak) >= THRESHOLD;

  const vals = Object.entries(scores).filter(([n]) => roles[n] !== "neutral");
  const dN = vals.filter(([, s]) => s > COMMIT).length;
  const aN = vals.filter(([, s]) => s < -COMMIT).length;
  const uN = Math.max(0, vals.length - dN - aN);

  const sorted = Object.entries(scores)
    .filter(([n]) => !roles[n])
    .sort((x, y) => y[1] - x[1]);

  const selScore = selected ? (scores[selected] ?? 0) : 0;
  const selRole: Role = selected ? (roles[selected] ?? "undecided") : "undecided";
  const selAff = selected ? affOf(selected) : null;

  const bar = (v: number) => {
    const w = Math.min(50, (Math.abs(v) / CEIL) * 50);
    return {
      width: `${w}%`,
      left: v >= 0 ? "50%" : `${50 - w}%`,
      background: v >= 0 ? "var(--color-defender)" : "var(--color-attacker)",
    };
  };

  return (
    <>
      <header className="pointer-events-auto absolute inset-x-2 top-2 z-20 grid grid-cols-[1fr_auto] border border-etch bg-substrate md:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex items-center gap-2 border-r border-etch px-3 py-2">
          <span className="font-display text-sm font-bold tracking-[0.18em]">
            GROK<span className="text-ochre">.ATLAS</span>
          </span>
          <span className="hidden font-mono text-2xs uppercase tracking-[0.16em] text-dimmer sm:inline">
            / cupola / v1.0
          </span>
        </div>
        <div className="hidden items-center gap-2 border-r border-etch px-3 py-2 md:flex">
          <span className="font-mono text-2xs uppercase tracking-[0.16em] text-dimmer">Section</span>
          <span className="font-mono text-xs font-medium text-ochre">§G.001</span>
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
        <span className="shrink-0 border-r border-etch px-3 py-1.5">
          {countries.length} states
        </span>
        <span className="shrink-0 border-r border-etch px-3 py-1.5">
          cascade {defenders.length || attackers.length ? "LIVE" : "idle"}
        </span>
        <span className="shrink-0 border-r border-etch px-3 py-1.5">
          sun {sunLon.toFixed(0)}°
        </span>
        <span className="min-w-0 flex-1 px-3 py-1.5 text-right text-dimmer">
          drag to orbit · scroll zoom · click a country
        </span>
      </div>

      <div className="pointer-events-none absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 font-mono text-2xs leading-6 tracking-wide text-dim md:block">
        <div>
          <i className="mr-2 inline-block h-1.5 w-1.5 bg-defender" />
          defender
        </div>
        <div>
          <i className="mr-2 inline-block h-1.5 w-1.5 bg-attacker" />
          attacker
        </div>
        <div>
          <i className="mr-2 inline-block h-1.5 w-1.5 bg-ochre" />
          city lights
        </div>
        <div>
          <i className="mr-2 inline-block h-1.5 w-1.5 bg-lichen" />
          airglow limb
        </div>
        <div>
          <i className="mr-2 inline-block h-1.5 w-1.5 bg-silk" />
          Yerevan
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-2 left-2 z-20 max-w-[min(300px,46vw)]">
        <label className="mb-1 block font-mono text-2xs uppercase tracking-[0.16em] text-dimmer">
          Cascade mix <b className="float-right font-medium text-ochre">{Math.round(atlasMix * 100)}%</b>
        </label>
        <input
          className="inst"
          type="range"
          min={0}
          max={100}
          value={Math.round(atlasMix * 100)}
          onChange={(e) => useAtlas.getState().setAtlasMix(+e.target.value / 100)}
        />
        <div className="mt-1 font-mono text-2xs uppercase tracking-wide text-dimmer">
          overlay <Tag kind="x">declared</Tag>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-2 right-2 z-20 hidden text-right font-mono text-2xs leading-5 tracking-wide text-dimmer sm:block">
        textures <span className="text-lichen">MEASURED</span> · cascade{" "}
        <span className="text-dim">DERIVED</span>
        <br />
        night gain <span className="text-rust">DECLARED</span> · relief not to scale
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
        className={`hud-scroll pointer-events-auto absolute right-2 top-[88px] z-20 w-[min(340px,calc(100%-1rem))] overflow-y-auto border border-etch bg-substrate md:bottom-[52px] md:top-[88px] ${
          panelOpen ? "block max-h-[min(70dvh,640px)] md:max-h-none" : "hidden md:block"
        }`}
      >
        <section className="border-b border-etch p-3">
          <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
            <span className="text-ochre">§01</span>
            <span className="font-semibold tracking-[0.2em]">Escalation</span>
            <span className="text-dimmer">FIG.2</span>
          </div>
          <div className={`font-mono text-3xl tabular-nums ${hot ? "text-attacker" : "text-silk"}`}>
            {peak > 0 ? "+" : ""}
            {peak.toFixed(1)}
          </div>
          <div className="mt-1 font-mono text-2xs text-dim">
            {peakWho
              ? hot
                ? `${peakWho} past the threshold`
                : `${peakWho} most committed`
              : "no nuclear state committed"}
          </div>
          <div className="relative mt-2 h-1 bg-etch">
            <i
              className={`block h-full ${hot ? "bg-attacker" : "bg-warn"}`}
              style={{ width: `${Math.min(100, (Math.abs(peak) / THRESHOLD) * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex h-5 bg-etch font-mono text-2xs">
            <span
              className="grid place-items-center bg-defender/70"
              style={{ flexGrow: Math.max(dN, 0.0001) }}
            >
              {dN > 3 ? dN : ""}
            </span>
            <span
              className="grid place-items-center text-dim"
              style={{ flexGrow: Math.max(uN, 0.0001) }}
            >
              {uN > 6 ? uN : ""}
            </span>
            <span
              className="grid place-items-center bg-attacker/70"
              style={{ flexGrow: Math.max(aN, 0.0001) }}
            >
              {aN > 3 ? aN : ""}
            </span>
          </div>
          <div className="mt-1 flex justify-between font-mono text-2xs text-dim">
            <span>defender {dN}</span>
            <span>undecided</span>
            <span>attacker {aN}</span>
          </div>
        </section>

        <section className="border-b border-etch p-3">
          <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
            <span className="text-ochre">§02</span>
            <span className="font-semibold tracking-[0.2em]">Nuclear tracker</span>
            <span className="text-dimmer">FIG.3</span>
          </div>
          <div className="grid grid-cols-3 gap-px bg-etch">
            {Object.entries(NUKES).map(([name, m]) => {
              const s = scores[name] ?? 0;
              const crossed = Math.abs(s) >= THRESHOLD;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    const c = countries.find((x) => x.name === name);
                    if (c) {
                      const ll = centroidOf(c);
                      useAtlas.getState().select(name);
                      useAtlas.getState().flyTo({ ...ll, label: name });
                    }
                  }}
                  className={`px-2 py-2 text-left ${
                    crossed
                      ? s > 0
                        ? "bg-defender/20"
                        : "bg-attacker/20"
                      : "bg-substrate"
                  }`}
                >
                  <div className="font-mono text-2xs uppercase tracking-wide text-dim">
                    {m.short}
                  </div>
                  <div
                    className={`font-mono text-sm tabular-nums ${
                      crossed ? (s > 0 ? "text-defender" : "text-attacker") : "text-silk"
                    }`}
                  >
                    {s > 0 ? "+" : ""}
                    {s.toFixed(1)}
                  </div>
                  <div className="relative mt-1 h-0.5 bg-etch">
                    <i className="absolute top-0 bottom-0" style={bar(s)} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="border-b border-etch p-3">
          <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
            <span className="text-ochre">§03</span>
            <span className="font-semibold tracking-[0.2em]">Scenario</span>
            <span className="text-dimmer">FIG.4</span>
          </div>
          <p className="mb-2 font-mono text-2xs leading-5 text-dim">
            {defenders.length || attackers.length ? (
              <>
                <span className="text-defender">{defenders.join(", ") || "—"}</span> defending
                against <span className="text-attacker">{attackers.join(", ") || "—"}</span>
              </>
            ) : (
              "pick a defender, then an attacker"
            )}
          </p>
          <select
            className="min-h-11 w-full border border-etch bg-substrate-2 px-2 font-mono text-xs text-silk"
            defaultValue="1"
            aria-label="Scenario presets"
            onChange={(e) => useAtlas.getState().applyPreset(+e.target.value)}
          >
            {PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-1">
            <input
              className="min-h-11 min-w-0 flex-1 border border-etch bg-transparent px-2 font-mono text-xs"
              list="atlas-countries"
              placeholder="search country…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const n = names.find((x) => x.toLowerCase() === search.toLowerCase());
                if (n) {
                  useAtlas.getState().cycle(n);
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
          <div className="mt-2 grid grid-cols-3 gap-1">
            <button
              type="button"
              className="min-h-11 border border-etch font-mono text-2xs uppercase tracking-[0.12em] text-dim hover:text-silk"
              onClick={() => useAtlas.getState().swap()}
            >
              Swap
            </button>
            <button
              type="button"
              className="min-h-11 border border-etch font-mono text-2xs uppercase tracking-[0.12em] text-dim hover:text-silk"
              onClick={() => useAtlas.getState().clear()}
            >
              Clear
            </button>
            <button
              type="button"
              className="min-h-11 border border-etch font-mono text-2xs uppercase tracking-[0.12em] text-dim hover:text-silk"
              onClick={async () => {
                const p = new URLSearchParams();
                const pick = (r: Role) =>
                  Object.entries(roles)
                    .filter(([, x]) => x === r)
                    .map(([n]) => n);
                const d = pick("defender");
                const a = pick("attacker");
                if (d.length) p.set("d", d.join("|"));
                if (a.length) p.set("a", a.join("|"));
                const url = `${location.origin}${location.pathname}${p.toString() ? `?${p}` : ""}`;
                await navigator.clipboard?.writeText(url).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </section>

        {selected && (
          <section className="border-b border-etch p-3">
            <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
              <span className="text-ochre">§04</span>
              <span className="font-semibold tracking-[0.2em]">{selected}</span>
              <span className="text-dimmer">FIG.5</span>
            </div>
            <div
              className="font-mono text-2xl tabular-nums"
              style={{
                color:
                  selScore > 0
                    ? "var(--color-defender)"
                    : selScore < 0
                      ? "var(--color-attacker)"
                      : "var(--color-dim)",
              }}
            >
              {selScore > 0 ? "+" : ""}
              {selScore.toFixed(1)}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {(
                [
                  ["defender", "var(--color-defender)"],
                  ["attacker", "var(--color-attacker)"],
                  ["neutral", "var(--color-dim)"],
                  ["undecided", "var(--color-dimmer)"],
                ] as const
              ).map(([r, c]) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => useAtlas.getState().setRole(selected, r)}
                  className="min-h-11 border border-etch font-mono text-[9px] uppercase tracking-wide"
                  style={{
                    color: selRole === r ? c : "var(--color-dim)",
                    borderColor: selRole === r ? c : undefined,
                  }}
                >
                  {r === "undecided" ? "clear" : r}
                </button>
              ))}
            </div>
            {selAff && (
              <div className="mt-2 grid gap-1">
                {selAff.map((v, i) => (
                  <div key={POLES[i]} className="grid grid-cols-[28px_1fr] items-center gap-2">
                    <span className="font-mono text-2xs text-dim">{POLES[i]}</span>
                    <span className="relative h-1 bg-etch">
                      <i
                        className="absolute top-0 bottom-0"
                        style={{
                          width: `${Math.abs(v) * 50}%`,
                          left: v >= 0 ? "50%" : `${50 - Math.abs(v) * 50}%`,
                          background:
                            v >= 0 ? "var(--color-defender)" : "var(--color-attacker)",
                        }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="border-b border-etch p-3">
          <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
            <span className="text-ochre">§05</span>
            <span className="font-semibold tracking-[0.2em]">Sites</span>
            <span className="text-dimmer">FIG.6</span>
          </div>
          <div className="grid gap-1">
            {SITES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="flex min-h-11 items-center justify-between border border-etch px-2 text-left"
                onClick={() => useAtlas.getState().flyTo({ lat: s.lat, lon: s.lon, label: s.label })}
              >
                <span className="font-mono text-xs text-silk">{s.label}</span>
                <span className="font-mono text-2xs text-dimmer">{s.note}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="border-b border-etch p-3">
          <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
            <span className="text-ochre">§06</span>
            <span className="font-semibold tracking-[0.2em]">Shell</span>
            <span className="text-dimmer">FIG.7</span>
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
          <div className="mt-3 grid grid-cols-2 gap-1">
            <LayerToggle id="showAtmosphere" label="atmosphere" on={showAtmosphere} />
            <LayerToggle id="showClouds" label="clouds" on={showClouds} />
            <LayerToggle id="showBorders" label="borders" on={showBorders} />
            <LayerToggle id="showIss" label="ISS" on={showIss} />
            <LayerToggle id="showCage" label="cage" on={showCage} />
            <LayerToggle id="cupola" label="cupola" on={cupola} />
            <LayerToggle id="autoSun" label="sun drift" on={autoSun} />
            <LayerToggle id="autoRotate" label="orbit" on={autoRotate} />
          </div>
        </section>

        <section className="p-3">
          <div className="mb-2 flex items-baseline justify-between font-mono text-2xs uppercase tracking-[0.18em]">
            <span className="text-ochre">§07</span>
            <span className="font-semibold tracking-[0.2em]">Device tilt</span>
            <span className="text-dimmer">FIG.8</span>
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
        </section>

        <section className="border-t border-etch p-3">
          <div className="mb-2 font-mono text-2xs uppercase tracking-[0.18em] text-dimmer">
            Strongest alignment
          </div>
          <div className="grid gap-1">
            {sorted.slice(0, 5).map(([n, v]) => (
              <button
                key={n}
                type="button"
                className="grid grid-cols-[1fr_72px_36px] items-center gap-2"
                onClick={() => useAtlas.getState().select(n)}
              >
                <span className="truncate text-left font-sans text-xs text-dim">{n}</span>
                <span className="relative h-1.5 bg-etch">
                  <i className="absolute top-0 bottom-0" style={bar(v)} />
                </span>
                <span
                  className="text-right font-mono text-2xs tabular-nums"
                  style={{ color: v >= 0 ? "var(--color-defender)" : "var(--color-attacker)" }}
                >
                  {v > 0 ? "+" : ""}
                  {v.toFixed(1)}
                </span>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </>
  );
}

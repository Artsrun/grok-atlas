import { useEffect, useState } from "react";
import type { CountryFeat } from "@/lib/atlas/geo";
import { loadCountries } from "@/lib/atlas/geo";
import type { Role } from "@/lib/atlas/model";
import { useAtlas } from "@/lib/atlas/store";
import { GlobeCanvas } from "@/components/globe/GlobeCanvas";
import { BootScreen } from "./BootScreen";
import { Hud } from "./Hud";

export function AtlasApp() {
  const [countries, setCountries] = useState<CountryFeat[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cupola = useAtlas((s) => s.cupola);

  useEffect(() => {
    let live = true;
    loadCountries()
      .then((c) => {
        if (!live) return;
        setCountries(c);
        useAtlas.getState().setNames(c.map((x) => x.name));
        const p = new URLSearchParams(location.search);
        const set = (k: string, r: Role) => {
          const names = new Set(c.map((x) => x.name));
          (p.get(k) || "")
            .split("|")
            .filter(Boolean)
            .forEach((n) => {
              if (names.has(n)) useAtlas.getState().setRole(n, r);
            });
        };
        if (p.has("d") || p.has("a")) {
          useAtlas.getState().clear();
          set("d", "defender");
          set("a", "attacker");
          set("n", "neutral");
        }
      })
      .catch((e: unknown) => {
        if (live) setErr(e instanceof Error ? e.message : "failed to load atlas");
      });
    return () => {
      live = false;
    };
  }, []);

  if (err) {
    return (
      <BootScreen
        label="Topology unreachable"
        detail={`${err} — globe will still run if textures load; cascade overlay is ABSENT.`}
      />
    );
  }
  if (!countries) {
    return (
      <BootScreen
        label="Acquiring world topology"
        detail="Natural Earth 110m · NASA city lights · ISS cupola night limb"
      />
    );
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-wafer text-silk">
      <div className="absolute inset-0 z-0">
        <GlobeCanvas countries={countries} />
      </div>
      {cupola && <div className="cupola-vignette pointer-events-none absolute inset-0 z-10" />}
      <div className="grain absolute inset-0 z-10" />
      <div className="crop crop-tl z-20" />
      <div className="crop crop-tr z-20" />
      <div className="crop crop-bl z-20" />
      <div className="crop crop-br z-20" />
      <div className="pointer-events-none absolute inset-0 z-20">
        <Hud countries={countries} />
      </div>
    </main>
  );
}

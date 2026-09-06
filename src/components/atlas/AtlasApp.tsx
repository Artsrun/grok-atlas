import { useEffect, useState } from "react";
import type { CountryFeat } from "@/lib/atlas/geo";
import { centroidOf, loadCountries } from "@/lib/atlas/geo";
import { VIEWS } from "@/lib/atlas/model";
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
        const site = p.get("site");
        const country = p.get("c");
        if (site) {
          const v = VIEWS.find((x) => x.id === site);
          if (v) useAtlas.getState().flyTo({ lat: v.lat, lon: v.lon, label: v.label });
        } else if (country) {
          const hit = c.find((x) => x.name.toLowerCase() === country.toLowerCase());
          if (hit) {
            const ll = centroidOf(hit);
            useAtlas.getState().select(hit.name);
            useAtlas.getState().flyTo({ ...ll, label: hit.name });
          }
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
        detail={`${err} — globe still runs if textures load; country pick is ABSENT.`}
      />
    );
  }
  if (!countries) {
    return (
      <BootScreen
        label="Acquiring earth"
        detail="NASA city lights · Natural Earth 110m · ISS cupola night limb"
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

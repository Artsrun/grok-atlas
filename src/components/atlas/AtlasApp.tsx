import { useEffect, useState } from "react";
import type { CountryFeat } from "@/lib/atlas/geo";
import { loadCountries } from "@/lib/atlas/geo";
import { focusForCountry } from "@/lib/atlas/fly";
import { pinHere, pollIss } from "@/lib/atlas/locate";
import { focusOf, VIEWS } from "@/lib/atlas/model";
import { useAtlas } from "@/lib/atlas/store";
import { GlobeCanvas } from "@/components/globe/GlobeCanvas";
import { BootScreen } from "./BootScreen";
import { Hud } from "./Hud";
import { QuietHud } from "./QuietHud";

type Edition = "2" | "3";

const editionFromUrl = (): Edition =>
  new URLSearchParams(location.search).get("v") === "2" ? "2" : "3";

export function AtlasApp() {
  const [countries, setCountries] = useState<CountryFeat[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edition, setEdition] = useState<Edition>(editionFromUrl);
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
        if (site === "here") {
          pinHere(true).catch(() => {});
        } else if (site) {
          const v = VIEWS.find((x) => x.id === site);
          if (v) useAtlas.getState().flyTo(focusOf(v));
        } else if (country) {
          const hit = c.find((x) => x.name.toLowerCase() === country.toLowerCase());
          if (hit) {
            useAtlas.getState().select(hit.name);
            useAtlas.getState().flyTo(focusForCountry(hit));
          }
        } else {
          pinHere(true).catch(() => {});
        }
      })
      .catch((e: unknown) => {
        if (live) setErr(e instanceof Error ? e.message : "failed to load atlas");
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    pollIss().catch(() => {});
    const id = setInterval(() => pollIss().catch(() => {}), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (editionFromUrl() === edition) return;
    const url = new URL(location.href);
    if (edition === "2") url.searchParams.set("v", "2");
    else url.searchParams.delete("v");
    history.pushState(null, "", url);
  }, [edition]);

  useEffect(() => {
    const onPop = () => setEdition(editionFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (mq.matches) useAtlas.getState().calmMotion();
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
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
    return <BootScreen label="Acquiring earth" detail="day · night · clouds" />;
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-wafer text-silk">
      <div className="absolute inset-0 z-0">
        <GlobeCanvas countries={countries} />
      </div>
      {cupola && <div className="cupola-vignette pointer-events-none absolute inset-0 z-10" />}
      <div className="grain absolute inset-0 z-10" />
      {edition === "2" ? (
        <>
          <div className="crop crop-tl z-20" />
          <div className="crop crop-tr z-20" />
          <div className="crop crop-bl z-20" />
          <div className="crop crop-br z-20" />
        </>
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-20">
        {edition === "2" ? (
          <Hud countries={countries} onQuiet={() => setEdition("3")} />
        ) : (
          <QuietHud onInstrument={() => setEdition("2")} />
        )}
      </div>
    </main>
  );
}

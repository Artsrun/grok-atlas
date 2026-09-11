import { useEffect, useRef, useState } from "react";
import type { CountryFeat } from "@/lib/atlas/geo";
import { loadCountries } from "@/lib/atlas/geo";
import { failBoot, markBoot } from "@/lib/atlas/boot";
import { focusForCountry } from "@/lib/atlas/fly";
import { hashAt, installHashSync } from "@/lib/atlas/hash";
import { deviceCaps } from "@/lib/atlas/device";
import { pinHere, pollIss, pollSpaceWx } from "@/lib/atlas/locate";
import { focusOf, RIDE_ID, VIEWS } from "@/lib/atlas/model";
import { useAtlas } from "@/lib/atlas/store";
import { GlobeCanvas } from "@/components/globe/GlobeCanvas";
import { BootNote, BootStrip } from "./BootScreen";
import { Hud } from "./Hud";
import { QuietHud } from "./QuietHud";

type Edition = "2" | "3";

const editionFromUrl = (): Edition =>
  new URLSearchParams(location.search).get("v") === "2" ? "2" : "3";

export function AtlasApp() {
  const [countries, setCountries] = useState<CountryFeat[]>([]);
  const [edition, setEdition] = useState<Edition>(editionFromUrl);
  const cupola = useAtlas((s) => s.cupola);
  // Read during render, before the rig can write one of its own.
  const bootHash = useRef(hashAt());

  useEffect(() => {
    let live = true;
    loadCountries()
      .then((c) => {
        if (!live) return;
        setCountries(c);
        useAtlas.getState().setNames(c.map((x) => x.name));
        markBoot("atlas");
        const p = new URLSearchParams(location.search);
        const site = p.get("site");
        const country = p.get("c");
        // A query view is deliberate and outranks the hash; the hash outranks
        // auto-locate, and the canvas already opened on it — so don't fly away.
        if (site === "here") {
          pinHere(true).catch(() => {});
        } else if (site === RIDE_ID) {
          useAtlas.getState().rideIss(true);
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
          pinHere(!bootHash.current).catch(() => {});
        }
      })
      .catch(() => {
        // The globe is not gated on the topology, so this is a missing layer,
        // not a dead app: say which capabilities went with it and carry on.
        if (live) failBoot("atlas", "countries offline · no borders, no country tap");
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    // The hash names a camera, not a place — so clear the caption rather than
    // leave HOME's label sitting over wherever the URL actually points.
    const at = bootHash.current;
    if (at) useAtlas.setState({ focus: { ...at } });
    return installHashSync();
  }, []);

  useEffect(() => {
    const cap = deviceCaps();
    useAtlas.setState({
      showRadio: cap.tier !== "low",
      showCosmic: cap.tier === "high",
    });
    pollIss().catch(() => {});
    pollSpaceWx().catch(() => {});
    const id = setInterval(() => pollIss().catch(() => {}), 5000);
    const wx = setInterval(() => pollSpaceWx().catch(() => {}), 60_000);
    return () => {
      clearInterval(id);
      clearInterval(wx);
    };
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
      <BootStrip />
      <BootNote />
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

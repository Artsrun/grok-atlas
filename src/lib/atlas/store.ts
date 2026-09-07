import { create } from "zustand";
import { requestFly } from "./camera.ts";
import { skyAt } from "./ephemeris.ts";
import { focusOf, HOME } from "./model.ts";

export type Focus = {
  lat: number;
  lon: number;
  label?: string;
  dist?: number;
  site?: string;
};

export type IssFix = { lat: number; lon: number; alt: number; vel: number };

type LayerKey =
  | "showAtmosphere"
  | "showClouds"
  | "showBorders"
  | "showCage"
  | "showIss"
  | "showMoon"
  | "showTides"
  | "cupola"
  | "panelOpen"
  | "tiltOn"
  | "autoSun"
  | "autoMoon"
  | "autoRotate";

type AtlasState = {
  names: string[];
  selected: string | null;
  sunLon: number;
  sunLat: number;
  moonLon: number;
  moonLat: number;
  autoSun: boolean;
  autoMoon: boolean;
  autoRotate: boolean;
  nightGain: number;
  bump: number;
  cloudOpacity: number;
  tideGain: number;
  showAtmosphere: boolean;
  showClouds: boolean;
  showBorders: boolean;
  showCage: boolean;
  showIss: boolean;
  showMoon: boolean;
  showTides: boolean;
  cupola: boolean;
  panelOpen: boolean;
  tiltOn: boolean;
  focus: Focus | null;
  here: { lat: number; lon: number } | null;
  iss: IssFix | null;
  setNames: (n: string[]) => void;
  select: (name: string | null) => void;
  setSunLon: (v: number) => void;
  setMoonLon: (v: number) => void;
  setAutoSun: (v: boolean) => void;
  setAutoMoon: (v: boolean) => void;
  setNightGain: (v: number) => void;
  setBump: (v: number) => void;
  setCloudOpacity: (v: number) => void;
  setTideGain: (v: number) => void;
  toggle: (k: LayerKey) => void;
  flyTo: (f: Focus) => void;
  setHere: (here: { lat: number; lon: number } | null) => void;
  setIss: (iss: IssFix | null) => void;
  calmMotion: () => void;
  tickOrbits: () => void;
};

const boot = skyAt();

export const useAtlas = create<AtlasState>((set, get) => ({
  names: [],
  selected: null,
  sunLon: boot.sunLon,
  sunLat: boot.sunLat,
  moonLon: boot.moonLon,
  moonLat: boot.moonLat,
  autoSun: true,
  autoMoon: true,
  autoRotate: false,
  nightGain: 1.65,
  bump: 1.05,
  cloudOpacity: 0.42,
  tideGain: 1,
  showAtmosphere: true,
  showClouds: true,
  showBorders: true,
  showCage: false,
  showIss: true,
  showMoon: true,
  showTides: false,
  cupola: false,
  panelOpen: false,
  tiltOn: false,
  focus: focusOf(HOME),
  here: null,
  iss: null,
  setNames: (names) => set({ names }),
  select: (selected) => set({ selected }),
  setSunLon: (sunLon) => set({ sunLon }),
  setMoonLon: (moonLon) => set({ moonLon }),
  setAutoSun: (autoSun) => set({ autoSun }),
  setAutoMoon: (autoMoon) => set({ autoMoon }),
  setNightGain: (nightGain) => set({ nightGain }),
  setBump: (bump) => set({ bump }),
  setCloudOpacity: (cloudOpacity) => set({ cloudOpacity }),
  setTideGain: (tideGain) => set({ tideGain }),
  toggle: (k) => set({ [k]: !get()[k] } as Partial<AtlasState>),
  /** State for the HUD, command for the rig. */
  flyTo: (focus) => {
    set({ focus });
    requestFly(focus);
  },
  setHere: (here) => set({ here }),
  setIss: (iss) => set({ iss }),
  calmMotion: () => set({ autoSun: true, autoMoon: true, autoRotate: false }),
  tickOrbits: () => {
    const s = get();
    if (!s.autoSun && !s.autoMoon) return;
    const e = skyAt();
    const patch: Partial<AtlasState> = {};
    if (
      s.autoSun &&
      (Math.abs(s.sunLon - e.sunLon) > 0.04 || Math.abs(s.sunLat - e.sunLat) > 0.04)
    ) {
      patch.sunLon = e.sunLon;
      patch.sunLat = e.sunLat;
    }
    if (
      s.autoMoon &&
      (Math.abs(s.moonLon - e.moonLon) > 0.04 || Math.abs(s.moonLat - e.moonLat) > 0.04)
    ) {
      patch.moonLon = e.moonLon;
      patch.moonLat = e.moonLat;
    }
    if (Object.keys(patch).length) set(patch);
  },
}));

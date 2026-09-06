import { create } from "zustand";
import { NILE } from "./geo";

export type Focus = { lat: number; lon: number; label?: string; dist?: number };

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
  moonLon: number;
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
  tickOrbits: (dt: number) => void;
};

export const useAtlas = create<AtlasState>((set, get) => ({
  names: [],
  selected: null,
  sunLon: NILE.lon + 182,
  moonLon: 0,
  autoSun: true,
  autoMoon: true,
  autoRotate: true,
  nightGain: 2.35,
  bump: 1.15,
  cloudOpacity: 0.55,
  tideGain: 1,
  showAtmosphere: true,
  showClouds: true,
  showBorders: true,
  showCage: false,
  showIss: true,
  showMoon: true,
  showTides: true,
  cupola: true,
  panelOpen: false,
  tiltOn: false,
  focus: { lat: NILE.lat, lon: NILE.lon, label: NILE.label, dist: 2.58 },
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
  flyTo: (focus) => set({ focus }),
  tickOrbits: (dt) => {
    const s = get();
    const patch: Partial<AtlasState> = {};
    if (s.autoSun) patch.sunLon = (s.sunLon + dt * 1.65 + 360) % 360;
    if (s.autoMoon) patch.moonLon = (s.moonLon + dt * 3.2 + 360) % 360;
    if (Object.keys(patch).length) set(patch);
  },
}));

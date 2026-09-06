import { create } from "zustand";
import { NILE } from "./geo";

export type Focus = { lat: number; lon: number; label?: string };

type LayerKey =
  | "showAtmosphere"
  | "showClouds"
  | "showBorders"
  | "showCage"
  | "showIss"
  | "cupola"
  | "panelOpen"
  | "tiltOn"
  | "autoSun"
  | "autoRotate";

type AtlasState = {
  names: string[];
  selected: string | null;
  sunLon: number;
  autoSun: boolean;
  autoRotate: boolean;
  nightGain: number;
  bump: number;
  cloudOpacity: number;
  showAtmosphere: boolean;
  showClouds: boolean;
  showBorders: boolean;
  showCage: boolean;
  showIss: boolean;
  cupola: boolean;
  panelOpen: boolean;
  tiltOn: boolean;
  focus: Focus | null;
  setNames: (n: string[]) => void;
  select: (name: string | null) => void;
  setSunLon: (v: number) => void;
  setAutoSun: (v: boolean) => void;
  setNightGain: (v: number) => void;
  setBump: (v: number) => void;
  setCloudOpacity: (v: number) => void;
  toggle: (k: LayerKey) => void;
  flyTo: (f: Focus) => void;
  tickSun: (dt: number) => void;
};

export const useAtlas = create<AtlasState>((set, get) => ({
  names: [],
  selected: null,
  sunLon: NILE.lon + 182,
  autoSun: true,
  autoRotate: true,
  nightGain: 2.35,
  bump: 1.15,
  cloudOpacity: 0.55,
  showAtmosphere: true,
  showClouds: true,
  showBorders: true,
  showCage: false,
  showIss: true,
  cupola: true,
  panelOpen: false,
  tiltOn: false,
  focus: { lat: NILE.lat, lon: NILE.lon, label: NILE.label },
  setNames: (names) => set({ names }),
  select: (selected) => set({ selected }),
  setSunLon: (sunLon) => set({ sunLon }),
  setAutoSun: (autoSun) => set({ autoSun }),
  setNightGain: (nightGain) => set({ nightGain }),
  setBump: (bump) => set({ bump }),
  setCloudOpacity: (cloudOpacity) => set({ cloudOpacity }),
  toggle: (k) => set({ [k]: !get()[k] } as Partial<AtlasState>),
  flyTo: (focus) => set({ focus }),
  tickSun: (dt) => {
    if (!get().autoSun) return;
    set({ sunLon: (get().sunLon + dt * 1.65 + 360) % 360 });
  },
}));

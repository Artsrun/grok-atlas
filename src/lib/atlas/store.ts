import { create } from "zustand";
import { focusOf, HOME } from "./model.ts";

export type Focus = {
  lat: number;
  lon: number;
  label?: string;
  dist?: number;
  /** VIEWS id when this focus came from a named view — drives ?site= sharing. */
  site?: string;
};

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
  /** Bumped on every flyTo so the rig re-flies even to an identical target. */
  flySeq: number;
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
  /** Honour prefers-reduced-motion: park the sun, moon and auto-orbit. */
  calmMotion: () => void;
  tickOrbits: (dt: number) => void;
};

export const useAtlas = create<AtlasState>((set, get) => ({
  names: [],
  selected: null,
  sunLon: HOME.lon + 182,
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
  focus: focusOf(HOME),
  flySeq: 0,
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
  flyTo: (focus) => set((s) => ({ focus, flySeq: s.flySeq + 1 })),
  calmMotion: () => set({ autoSun: false, autoMoon: false, autoRotate: false }),
  tickOrbits: (dt) => {
    const s = get();
    const patch: Partial<AtlasState> = {};
    if (s.autoSun) patch.sunLon = (s.sunLon + dt * 1.65 + 360) % 360;
    if (s.autoMoon) patch.moonLon = (s.moonLon + dt * 3.2 + 360) % 360;
    if (Object.keys(patch).length) set(patch);
  },
}));

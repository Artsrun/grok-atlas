import { create } from "zustand";
import type { Role } from "./model";
import { nextRole, PRESETS, solve } from "./model";
import { NILE } from "./geo";

export type Focus = { lat: number; lon: number; label?: string };

type AtlasState = {
  names: string[];
  roles: Record<string, Role>;
  scores: Record<string, number>;
  poles: number[];
  selected: string | null;
  sunLon: number;
  autoSun: boolean;
  autoRotate: boolean;
  atlasMix: number;
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
  setRole: (name: string, role: Role) => void;
  cycle: (name: string) => void;
  select: (name: string | null) => void;
  applyPreset: (i: number) => void;
  swap: () => void;
  clear: () => void;
  setSunLon: (v: number) => void;
  setAutoSun: (v: boolean) => void;
  setAutoRotate: (v: boolean) => void;
  setAtlasMix: (v: number) => void;
  setNightGain: (v: number) => void;
  setBump: (v: number) => void;
  setCloudOpacity: (v: number) => void;
  toggle: (k: keyof Pick<
    AtlasState,
    | "showAtmosphere"
    | "showClouds"
    | "showBorders"
    | "showCage"
    | "showIss"
    | "cupola"
    | "panelOpen"
    | "tiltOn"
    | "autoSun"
    | "autoRotate"
  >) => void;
  flyTo: (f: Focus) => void;
  clearFocus: () => void;
  tickSun: (dt: number) => void;
};

function rescore(roles: Record<string, Role>, names: string[]) {
  return solve(roles, names);
}

const defaultRoles: Record<string, Role> = {
  "South Korea": "defender",
  "North Korea": "attacker",
};

export const useAtlas = create<AtlasState>((set, get) => ({
  names: [],
  roles: { ...defaultRoles },
  scores: {},
  poles: [0, 0, 0, 0, 0, 0],
  selected: "South Korea",
  sunLon: NILE.lon + 182,
  autoSun: true,
  autoRotate: true,
  atlasMix: 0.28,
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
  setNames: (names) => {
    const { scores, poles } = rescore(get().roles, names);
    set({ names, scores, poles });
  },
  setRole: (name, role) => {
    const roles = { ...get().roles };
    if (role === "undecided") delete roles[name];
    else roles[name] = role;
    const { scores, poles } = rescore(roles, get().names);
    set({ roles, scores, poles, selected: name });
  },
  cycle: (name) => {
    const cur = get().roles[name] ?? "undecided";
    get().setRole(name, nextRole(cur));
  },
  select: (name) => set({ selected: name }),
  applyPreset: (i) => {
    const p = PRESETS[i];
    const roles: Record<string, Role> = {};
    if (p?.defender) roles[p.defender] = "defender";
    if (p?.attacker) roles[p.attacker] = "attacker";
    const { scores, poles } = rescore(roles, get().names);
    set({
      roles,
      scores,
      poles,
      selected: p?.defender ?? p?.attacker ?? null,
    });
  },
  swap: () => {
    const roles: Record<string, Role> = {};
    for (const [n, r] of Object.entries(get().roles)) {
      if (r === "defender") roles[n] = "attacker";
      else if (r === "attacker") roles[n] = "defender";
      else roles[n] = r;
    }
    const { scores, poles } = rescore(roles, get().names);
    set({ roles, scores, poles });
  },
  clear: () => {
    const roles = {};
    const { scores, poles } = rescore(roles, get().names);
    set({ roles, scores, poles, selected: null });
  },
  setSunLon: (sunLon) => set({ sunLon }),
  setAutoSun: (autoSun) => set({ autoSun }),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setAtlasMix: (atlasMix) => set({ atlasMix }),
  setNightGain: (nightGain) => set({ nightGain }),
  setBump: (bump) => set({ bump }),
  setCloudOpacity: (cloudOpacity) => set({ cloudOpacity }),
  toggle: (k) => set({ [k]: !get()[k] } as Partial<AtlasState>),
  flyTo: (focus) => set({ focus }),
  clearFocus: () => set({ focus: null }),
  tickSun: (dt) => {
    if (!get().autoSun) return;
    set({ sunLon: (get().sunLon + dt * 4.2 + 360) % 360 });
  },
}));

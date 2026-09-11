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
  | "showRadio"
  | "showCosmic"
  | "showMoon"
  | "showTides"
  | "cupola"
  | "panelOpen"
  | "railOpen"
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
  grainMix: number;
  showAtmosphere: boolean;
  showClouds: boolean;
  showBorders: boolean;
  showCage: boolean;
  showIss: boolean;
  showRadio: boolean;
  showCosmic: boolean;
  /** Planetary Kp 0–9. Drives cosmic rate. Fail-open 2. */
  kp: number;
  /** Camera parked on the station, not orbiting the globe. */
  issRide: boolean;
  showMoon: boolean;
  showTides: boolean;
  cupola: boolean;
  /** Phone tray. Closed until a thumb asks for it. */
  panelOpen: boolean;
  /** Desktop rail. Open by default — it is the instrument — but it covers a
   * third of the window, so it has to be dismissible like the tray is. */
  railOpen: boolean;
  tiltOn: boolean;
  focus: Focus | null;
  here: { lat: number; lon: number } | null;
  iss: IssFix | null;
  /** Northbound leg of the orbit — the ground track needs the branch. */
  issAsc: boolean;
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
  setGrainMix: (v: number) => void;
  toggle: (k: LayerKey) => void;
  flyTo: (f: Focus) => void;
  setHere: (here: { lat: number; lon: number } | null) => void;
  setIss: (iss: IssFix | null) => void;
  setKp: (kp: number) => void;
  rideIss: (on: boolean) => void;
  calmMotion: () => void;
  /** `dt` in seconds; no argument means tick now. */
  tickOrbits: (dt?: number) => void;
};

const boot = skyAt();

/** The cupola glass the ride borrows, handed back when the ride ends. */
let cupolaBeforeRide = false;

/** Seconds between ephemeris reads. 0.24° of sun travel — under the 0.04° set
 * threshold's own noise once damping and the terminator's softness are in. */
const SKY_TICK = 0.25;
let sinceSky = SKY_TICK;

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
  grainMix: 1,
  showAtmosphere: true,
  showClouds: true,
  showBorders: true,
  showCage: false,
  showIss: true,
  showRadio: false,
  showCosmic: false,
  kp: 2,
  issRide: false,
  showMoon: true,
  showTides: false,
  cupola: false,
  panelOpen: false,
  railOpen: true,
  tiltOn: false,
  focus: focusOf(HOME),
  here: null,
  iss: null,
  issAsc: true,
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
  setGrainMix: (grainMix) => set({ grainMix }),
  toggle: (k) => set({ [k]: !get()[k] } as Partial<AtlasState>),
  /** State for the HUD, command for the rig. */
  flyTo: (focus) => {
    // Any destination is an exit from the ride: the rig owns the camera again.
    set({ focus, issRide: false });
    requestFly(focus);
  },
  setHere: (here) => set({ here }),
  setIss: (iss) => {
    const prev = get().iss;
    const issAsc = iss && prev && iss.lat !== prev.lat ? iss.lat > prev.lat : get().issAsc;
    set({ iss, issAsc });
  },
  setKp: (kp) => set({ kp }),
  /** The ride is a frame, not a place — cupola glass comes with it. */
  rideIss: (on) => {
    if (on) {
      // Re-entering an active ride must not record the glass the ride itself
      // turned on — otherwise leaving never gives the window back.
      if (!get().issRide) cupolaBeforeRide = get().cupola;
      set({ issRide: true, showIss: true, cupola: true, autoRotate: false });
      return;
    }
    const iss = get().iss;
    set({ cupola: cupolaBeforeRide });
    // flyTo clears issRide and gives the rig somewhere to put the camera back.
    get().flyTo(
      iss ? { lat: iss.lat, lon: iss.lon, label: "ISS", dist: 2.6, site: "iss" } : focusOf(HOME),
    );
  },
  calmMotion: () => set({ autoSun: true, autoMoon: true, autoRotate: false }),
  tickOrbits: (dt = SKY_TICK) => {
    const s = get();
    if (!s.autoSun && !s.autoMoon) return;
    // The sun moves 0.004° per frame. Reading the clock and running the
    // ephemeris sixty times a second to find that out is the cost, not the set.
    sinceSky += dt;
    if (sinceSky < SKY_TICK) return;
    sinceSky = 0;
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

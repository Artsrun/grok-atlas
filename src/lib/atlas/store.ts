import { create } from "zustand";
import { requestFly } from "./camera.ts";
import type { Clock } from "./clock.ts";
import type { FactBook } from "./facts.ts";
import { advance, clockMs, LIVE, nudge, skyTick, toggleHold } from "./clock.ts";
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
  | "showGrid"
  | "showIss"
  | "showRivers"
  | "showRadio"
  | "showCosmic"
  | "showMoon"
  | "showTides"
  | "cupola"
  | "panelOpen"
  | "railOpen"
  | "tiltOn"
  | "autoRotate";

type AtlasState = {
  names: string[];
  /** Capital, region and measurements per country name. Empty until loaded. */
  facts: FactBook;
  selected: string | null;
  /** Under the pointer, on a mouse. Null on touch, which has no hover. */
  hovered: string | null;
  /** Sky positions are derived from `clock` — read them, never set them. */
  sunLon: number;
  sunLat: number;
  moonLon: number;
  moonLat: number;
  /** The instant the globe is showing, as a gap from the real clock. */
  clock: Clock;
  /** Virtual epoch ms, republished each tick so the HUD can read it cheaply. */
  clockAt: number;
  /** The rate a pause came from, so play resumes where it left off. */
  resumeRate: number;
  autoRotate: boolean;
  nightGain: number;
  bump: number;
  cloudOpacity: number;
  tideGain: number;
  grainMix: number;
  showAtmosphere: boolean;
  showClouds: boolean;
  showBorders: boolean;
  /** The geodesic shell. Chrome, and honest about it. */
  showCage: boolean;
  /** The 30° graticule and its degree readings. Navigation, not chrome. */
  showGrid: boolean;
  showIss: boolean;
  /** The twelve great rivers, running downstream. */
  showRivers: boolean;
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
  setFacts: (f: FactBook) => void;
  select: (name: string | null) => void;
  hover: (name: string | null) => void;
  setRate: (rate: number) => void;
  /** Play/pause. Resumes at whatever rate it was holding from. */
  holdClock: () => void;
  /** Scrub by hand, in ms. The rate keeps running underneath. */
  scrub: (ms: number) => void;
  /** Back to the real sky. */
  goLive: () => void;
  /** Jump to an instant, for a share link. */
  setClockAt: (offset: number) => void;
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

const bootAt = Date.now();
const boot = skyAt(new Date(bootAt));

/** The cupola glass the ride borrows, handed back when the ride ends. */
let cupolaBeforeRide = false;

/** Seconds between ephemeris reads. 0.24° of sun travel — under the 0.04° set
 * threshold's own noise once damping and the terminator's softness are in. */
const SKY_TICK = 0.25;
let sinceSky = SKY_TICK;

export const useAtlas = create<AtlasState>((set, get) => ({
  names: [],
  facts: {},
  selected: null,
  hovered: null,
  sunLon: boot.sunLon,
  sunLat: boot.sunLat,
  moonLon: boot.moonLon,
  moonLat: boot.moonLat,
  clock: LIVE,
  clockAt: bootAt,
  resumeRate: 1,
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
  showGrid: false,
  showIss: true,
  showRivers: true,
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
  setFacts: (facts) => set({ facts }),
  select: (selected) => set({ selected }),
  hover: (hovered) => {
    if (get().hovered !== hovered) set({ hovered });
  },
  setRate: (rate) => {
    set({ clock: { ...get().clock, rate }, resumeRate: rate === 0 ? get().resumeRate : rate });
    get().tickOrbits();
  },
  holdClock: () => {
    set({ clock: toggleHold(get().clock, get().resumeRate) });
    get().tickOrbits();
  },
  scrub: (ms) => {
    set({ clock: nudge(get().clock, ms) });
    get().tickOrbits();
  },
  goLive: () => {
    set({ clock: LIVE, resumeRate: 1 });
    get().tickOrbits();
  },
  setClockAt: (offset) => {
    set({ clock: { offset, rate: 0 } });
    get().tickOrbits();
  },
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
  calmMotion: () => set({ clock: LIVE, autoRotate: false }),
  tickOrbits: (dt = SKY_TICK) => {
    const s = get();
    const moved = s.clock.rate !== 1;
    const clock = moved ? advance(s.clock, dt) : s.clock;
    // Live, the sun moves 0.004° per frame and reading the clock to find that
    // out costs more than the set does. Running, every frame is animation and
    // a stale sun steps visibly across the terminator.
    sinceSky += dt;
    if (sinceSky < skyTick(clock.rate, SKY_TICK)) {
      if (moved) set({ clock });
      return;
    }
    sinceSky = 0;
    const at = clockMs(clock, Date.now());
    const e = skyAt(new Date(at));
    const patch: Partial<AtlasState> = { clockAt: at };
    if (moved) patch.clock = clock;
    if (Math.abs(s.sunLon - e.sunLon) > 0.04 || Math.abs(s.sunLat - e.sunLat) > 0.04) {
      patch.sunLon = e.sunLon;
      patch.sunLat = e.sunLat;
    }
    if (Math.abs(s.moonLon - e.moonLon) > 0.04 || Math.abs(s.moonLat - e.moonLat) > 0.04) {
      patch.moonLon = e.moonLon;
      patch.moonLat = e.moonLat;
    }
    set(patch);
  },
}));

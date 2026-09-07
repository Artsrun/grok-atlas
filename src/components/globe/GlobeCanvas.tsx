import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CountryFeat } from "@/lib/atlas/geo";
import { ll2xyz, OVERLAY_H, OVERLAY_W, paintAtlas, pickCountry, xyz2ll } from "@/lib/atlas/geo";
import type { CameraAt } from "@/lib/atlas/camera";
import { cameraListeners, emitCamera, onFlyRequest } from "@/lib/atlas/camera";
import { hashAt } from "@/lib/atlas/hash";
import type { Focus } from "@/lib/atlas/store";
import type { FlyPath } from "@/lib/atlas/fly";
import {
  distAt,
  flyDuration,
  flyPath,
  focusForCountry,
  FOV,
  MAX_DIST,
  MIN_DIST,
  spanAt,
  watchReducedMotion,
} from "@/lib/atlas/fly";
import { HOME } from "@/lib/atlas/model";
import { useAtlas } from "@/lib/atlas/store";
import { Earth } from "./Earth";
import { Borders } from "./Borders";
import { Cage, HerePin, Luna, Starfield, Station, SunLight } from "./Extras";

const HOME_POS = ll2xyz(HOME.lat, HOME.lon, HOME.dist);
const ARRIVED_ANGLE = 0.014;
const ARRIVED_RADIUS = 0.04;
const TAP_SLOP = 6;
/**
 * Parked below this speed, in earth radii per second — a rate, not a per-frame
 * step, so a 120 Hz phone and a 30 fps laptop agree on when the rig stopped.
 * ~1° of arc per second at orbit distance: drift you cannot see.
 */
const MOVE_RATE = 0.02;
/** Seconds under that rate before moveend. Outlasts the tail of orbit damping. */
const SETTLE = 0.18;

/** Mapbox's `hash` sets the opening view outright — no flight from home. */
const bootPos = () => {
  const at = hashAt();
  return at ? ll2xyz(at.lat, at.lon, at.dist) : HOME_POS;
};

function OverlayTexture({
  countries,
  texture,
}: {
  countries: CountryFeat[];
  texture: THREE.CanvasTexture;
}) {
  const selected = useAtlas((s) => s.selected);

  useEffect(() => {
    const ctx = texture.image.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return;
    paintAtlas(ctx, countries, selected);
    texture.needsUpdate = true;
  }, [countries, selected, texture]);
  return null;
}

/** Unit direction along the great circle from a to b. */
function slerpDir(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) {
  const omega = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
  if (omega < 1e-4) {
    out.copy(a).lerp(b, t).normalize();
    return;
  }
  const so = Math.sin(omega);
  out
    .copy(a)
    .multiplyScalar(Math.sin((1 - t) * omega) / so)
    .addScaledVector(b, Math.sin(t * omega) / so)
    .normalize();
}

function Rig() {
  const controls = useRef<{
    target: THREE.Vector3;
    autoRotate: boolean;
    enabled: boolean;
    update: () => void;
  } | null>(null);
  const { camera } = useThree();
  const autoRotate = useAtlas((s) => s.autoRotate);
  const tiltOn = useAtlas((s) => s.tiltOn);

  const fromDir = useRef(new THREE.Vector3());
  const toDir = useRef(new THREE.Vector3());
  const tmp = useRef(new THREE.Vector3());
  const path = useRef<FlyPath | null>(null);
  const arc = useRef(0);
  const dur = useRef(0);
  const elapsed = useRef(0);
  const reduced = useRef(false);

  const seen = useRef(new THREE.Vector3(NaN, NaN, NaN));
  const moving = useRef(false);
  const still = useRef(0);

  useEffect(() => watchReducedMotion((on) => (reduced.current = on)), []);

  const startFlight = useCallback(
    (focus: Focus) => {
      toDir.current.set(...ll2xyz(focus.lat, focus.lon, 1)).normalize();
      const here = camera.position;
      const r0 = here.length();
      const r1 = THREE.MathUtils.clamp(focus.dist ?? r0, MIN_DIST, MAX_DIST);
      fromDir.current.copy(here).normalize();
      const angle = fromDir.current.angleTo(toDir.current);
      if (angle < ARRIVED_ANGLE && Math.abs(r0 - r1) < ARRIVED_RADIUS) {
        path.current = null;
        return;
      }
      // Mapbox `respectPrefersReducedMotion`: arrive, don't fly.
      if (reduced.current) {
        camera.position.copy(toDir.current).setLength(r1);
        path.current = null;
        return;
      }
      const p = flyPath(spanAt(r0, FOV), spanAt(r1, FOV), angle);
      path.current = p;
      arc.current = angle;
      dur.current = flyDuration(p.S);
      elapsed.current = 0;
    },
    [camera],
  );

  useEffect(() => onFlyRequest(startFlight), [startFlight]);

  const atOf = (p: THREE.Vector3): CameraAt => ({ ...xyz2ll(p.x, p.y, p.z), dist: p.length() });

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    useAtlas.getState().tickOrbits();
    const st = useAtlas.getState();
    const c = controls.current;
    const p = path.current;
    if (p) {
      elapsed.current = Math.min(dur.current, elapsed.current + d);
      const t = dur.current > 0 ? elapsed.current / dur.current : 1;
      const { u, w } = p.at(t * p.S);
      const k = arc.current > 1e-6 ? THREE.MathUtils.clamp(u / arc.current, 0, 1) : 1;
      slerpDir(fromDir.current, toDir.current, k, tmp.current);
      camera.position.copy(tmp.current).setLength(distAt(w, FOV));
      if (c) c.target.set(0, 0, 0);
      if (t >= 1) path.current = null;
    }
    if (c) {
      c.autoRotate = st.autoRotate && !st.tiltOn && !p && !reduced.current;
      c.enabled = !st.tiltOn;
    }

    // Move lifecycle. Nothing settles while autoRotate runs, so it never writes a URL.
    const pos = camera.position;
    if (Number.isNaN(seen.current.x)) {
      // Appearing is not moving: seed the baseline so a camera nobody touches
      // stays silent, and never writes a URL for a view the user never chose.
      seen.current.copy(pos);
    } else if (pos.distanceTo(seen.current) > MOVE_RATE * d) {
      seen.current.copy(pos);
      still.current = 0;
      if (!moving.current) {
        moving.current = true;
        if (cameraListeners("movestart")) emitCamera("movestart", atOf(pos));
      }
      if (cameraListeners("move")) emitCamera("move", atOf(pos));
    } else if (moving.current) {
      still.current += d;
      if (still.current >= SETTLE) {
        moving.current = false;
        if (cameraListeners("moveend")) emitCamera("moveend", atOf(pos));
      }
    }
  });

  return (
    <OrbitControls
      ref={controls as never}
      enablePan={false}
      enableDamping
      dampingFactor={0.065}
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      autoRotate={autoRotate && !tiltOn}
      autoRotateSpeed={0.07}
      rotateSpeed={0.48}
      zoomSpeed={0.7}
      onStart={() => {
        path.current = null;
      }}
    />
  );
}

function Picker({ countries }: { countries: CountryFeat[] }) {
  const { camera, scene, gl } = useThree();
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const ptr = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => {
    const el = gl.domElement;
    let start: { id: number; x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      start = e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
    };
    const cancel = () => {
      start = null;
    };
    const up = (e: PointerEvent) => {
      const from = start;
      start = null;
      if (!from || from.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > TAP_SLOP) return;
      const earth = scene.getObjectByName("earth");
      if (!earth) return;
      const rect = el.getBoundingClientRect();
      ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObject(earth, false)[0];
      if (!hit?.point) return;
      const { lat, lon } = xyz2ll(hit.point.x, hit.point.y, hit.point.z);
      const name = pickCountry(countries, lat, lon);
      const st = useAtlas.getState();
      if (!name) {
        st.select(null);
        return;
      }
      st.select(name);
      const c = countries.find((x) => x.name === name);
      if (c) st.flyTo(focusForCountry(c));
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }, [camera, scene, gl, countries, ray, ptr]);
  return null;
}

function TiltBridge() {
  const tiltOn = useAtlas((s) => s.tiltOn);
  const { camera } = useThree();
  const home = useRef(new THREE.Quaternion());
  const target = useRef(new THREE.Quaternion());
  const refQ = useRef<THREE.Quaternion | null>(null);

  useEffect(() => {
    if (!tiltOn) {
      refQ.current = null;
      return;
    }
    home.current.copy(camera.quaternion);
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null || e.gamma == null) return;
      const eul = new THREE.Euler(
        (e.beta * Math.PI) / 180,
        (e.alpha * Math.PI) / 180,
        (-e.gamma * Math.PI) / 180,
        "YXZ",
      );
      const q = new THREE.Quaternion().setFromEuler(eul);
      if (!refQ.current) refQ.current = q.clone();
      target.current.copy(refQ.current).invert().multiply(q).invert().premultiply(home.current);
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [tiltOn, camera]);

  useFrame(() => {
    if (!tiltOn) return;
    camera.quaternion.slerp(target.current, 0.12);
  });
  return null;
}

function Scene({
  countries,
  atlasTex,
}: {
  countries: CountryFeat[];
  atlasTex: THREE.CanvasTexture;
}) {
  return (
    <>
      <color attach="background" args={["#05070c"]} />
      <ambientLight intensity={0.16} />
      <Starfield />
      <SunLight />
      <Luna />
      <Earth atlasTex={atlasTex} />
      <Borders countries={countries} />
      <HerePin />
      <Station />
      <Cage />
      <OverlayTexture countries={countries} texture={atlasTex} />
      <Rig />
      <Picker countries={countries} />
      <TiltBridge />
    </>
  );
}

export function GlobeCanvas({ countries }: { countries: CountryFeat[] }) {
  const atlasTex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = OVERLAY_W;
    cv.height = OVERLAY_H;
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, []);

  useEffect(() => () => atlasTex.dispose(), [atlasTex]);

  return (
    <Canvas
      className="h-full w-full touch-none"
      camera={{ fov: FOV, near: 0.08, far: 220, position: bootPos() }}
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.setClearColor("#05070c");
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Suspense fallback={null}>
        <Scene countries={countries} atlasTex={atlasTex} />
      </Suspense>
    </Canvas>
  );
}

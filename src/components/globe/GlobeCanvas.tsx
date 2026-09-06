import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CountryFeat } from "@/lib/atlas/geo";
import {
  centroidOf,
  ll2xyz,
  NILE,
  OVERLAY_H,
  OVERLAY_W,
  paintAtlas,
  pickCountry,
  xyz2ll,
} from "@/lib/atlas/geo";
import { useAtlas } from "@/lib/atlas/store";
import { Earth } from "./Earth";
import { Borders } from "./Borders";
import { Cage, Luna, SitePins, Starfield, Station, SunMarker } from "./Extras";

const HOME_DIST = 2.58;
const HOME_POS = ll2xyz(NILE.lat, NILE.lon, HOME_DIST);
const FLY_SEC = 1.45;

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

function slerpDir(
  a: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
  out: THREE.Vector3,
  ra: number,
  rb: number,
) {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const omega = Math.acos(dot);
  const r = THREE.MathUtils.lerp(ra, rb, t);
  if (omega < 1e-4) {
    out.copy(a).lerp(b, t).setLength(r);
    return;
  }
  const so = Math.sin(omega);
  out
    .copy(a)
    .multiplyScalar(Math.sin((1 - t) * omega) / so)
    .addScaledVector(b, Math.sin(t * omega) / so)
    .setLength(r);
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
  const focus = useAtlas((s) => s.focus);

  const fromDir = useRef(new THREE.Vector3());
  const toDir = useRef(new THREE.Vector3());
  const tmp = useRef(new THREE.Vector3());
  const fromR = useRef(HOME_DIST);
  const toR = useRef(HOME_DIST);
  const flyT = useRef(1);

  useEffect(() => {
    if (!focus) return;
    toDir.current.set(...ll2xyz(focus.lat, focus.lon, 1)).normalize();
    const here = camera.position;
    const wantR = focus.dist ?? here.length();
    const already =
      Math.abs(here.x / here.length() - toDir.current.x) < 0.012 &&
      Math.abs(here.z / here.length() - toDir.current.z) < 0.012 &&
      Math.abs(here.length() - wantR) < 0.04;
    if (already) {
      flyT.current = 1;
      return;
    }
    fromDir.current.copy(here).normalize();
    fromR.current = here.length();
    toR.current = wantR;
    flyT.current = 0;
  }, [focus?.lat, focus?.lon, focus?.dist, camera]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    useAtlas.getState().tickOrbits(d);
    const st = useAtlas.getState();
    const c = controls.current;
    const flying = flyT.current < 1;
    if (flying) {
      flyT.current = Math.min(1, flyT.current + d / FLY_SEC);
      const ease = 1 - Math.pow(1 - flyT.current, 3);
      slerpDir(fromDir.current, toDir.current, ease, tmp.current, fromR.current, toR.current);
      camera.position.copy(tmp.current);
      if (c) c.target.set(0, 0, 0);
    }
    if (c) {
      c.autoRotate = st.autoRotate && !st.tiltOn && !flying;
      c.enabled = !st.tiltOn;
    }
  });

  return (
    <OrbitControls
      ref={controls as never}
      enablePan={false}
      enableDamping
      dampingFactor={0.065}
      minDistance={1.42}
      maxDistance={11}
      autoRotate={autoRotate && !tiltOn}
      autoRotateSpeed={0.07}
      rotateSpeed={0.48}
      zoomSpeed={0.7}
      onStart={() => {
        flyT.current = 1;
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
    let sx = 0;
    let sy = 0;
    const down = (e: PointerEvent) => {
      sx = e.clientX;
      sy = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - sx, e.clientY - sy) > 6) return;
      const rect = el.getBoundingClientRect();
      ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      const hits = ray.intersectObjects(scene.children, true);
      const hit = hits.find((h) => h.object.name === "earth");
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
      if (c) st.flyTo({ ...centroidOf(c), label: name });
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
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
      <ambientLight intensity={0.22} />
      <Starfield />
      <SunMarker />
      <Luna />
      <Earth atlasTex={atlasTex} />
      <Borders countries={countries} />
      <SitePins />
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
      camera={{ fov: 52, near: 0.08, far: 220, position: HOME_POS }}
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.setClearColor("#05070c");
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
      }}
    >
      <Suspense fallback={null}>
        <Scene countries={countries} atlasTex={atlasTex} />
      </Suspense>
    </Canvas>
  );
}

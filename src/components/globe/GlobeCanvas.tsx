import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CountryFeat } from "@/lib/atlas/geo";
import {
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
import { Cage, SitePins, Starfield, Station, SunMarker } from "./Extras";

const HOME_DIST = 2.48;
const HOME_POS = ll2xyz(NILE.lat, NILE.lon, HOME_DIST);

function OverlayTexture({
  countries,
  texture,
}: {
  countries: CountryFeat[];
  texture: THREE.CanvasTexture;
}) {
  const scores = useAtlas((s) => s.scores);
  const roles = useAtlas((s) => s.roles);
  const selected = useAtlas((s) => s.selected);

  useEffect(() => {
    const ctx = texture.image.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return;
    paintAtlas(ctx, countries, scores, roles, selected);
    texture.needsUpdate = true;
  }, [countries, scores, roles, selected, texture]);
  return null;
}

function Rig() {
  const controls = useRef<THREE.EventDispatcher & {
    target: THREE.Vector3;
    autoRotate: boolean;
    enabled: boolean;
    update: () => void;
  }>(null);
  const { camera } = useThree();
  const autoRotate = useAtlas((s) => s.autoRotate);
  const tiltOn = useAtlas((s) => s.tiltOn);
  const focus = useAtlas((s) => s.focus);
  const flying = useRef(true);
  const dist = useRef(HOME_DIST);

  useEffect(() => {
    flying.current = true;
  }, [focus?.lat, focus?.lon]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1);
    useAtlas.getState().tickSun(d);
    const st = useAtlas.getState();
    const c = controls.current;
    if (st.focus && flying.current && c) {
      const target = new THREE.Vector3(...ll2xyz(st.focus.lat, st.focus.lon, dist.current));
      camera.position.lerp(target, 1 - Math.pow(0.08, d * 60));
      c.target.set(0, 0, 0);
      if (camera.position.distanceTo(target) < 0.05) flying.current = false;
    }
    if (c) {
      c.autoRotate = st.autoRotate && !st.tiltOn && !flying.current;
      c.enabled = !st.tiltOn;
    }
  });

  return (
    <OrbitControls
      ref={controls as never}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={1.42}
      maxDistance={7.5}
      autoRotate={autoRotate && !tiltOn}
      autoRotateSpeed={0.12}
      rotateSpeed={0.55}
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
      if (name) useAtlas.getState().cycle(name);
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
    camera.quaternion.slerp(target.current, 0.14);
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
      camera={{ fov: 42, near: 0.08, far: 220, position: HOME_POS }}
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

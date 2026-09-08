import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ll2xyz } from "@/lib/atlas/geo";
import { LABEL_R, cageSegments, labelSpots } from "@/lib/atlas/graticule";
import { groundTrack, trackHeading } from "@/lib/atlas/orbit";
import { MOON_DIST, MOON_RADIUS, moonXYZ } from "@/lib/atlas/tide";
import { useAtlas } from "@/lib/atlas/store";
import { COORD_FRAG, COORD_VERT, MOON_FRAG, MOON_VERT } from "./shaders";
import { coordGeometry, labelAtlas } from "./labels";

export function Starfield({ count = 2200 }: { count?: number }) {
  const geo = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const R = 50 + Math.random() * 70;
      p[i * 3] = R * Math.sin(ph) * Math.cos(t);
      p[i * 3 + 1] = R * Math.sin(ph) * Math.sin(t);
      p[i * 3 + 2] = R * Math.cos(ph);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [count]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#6a7084" size={0.11} sizeAttenuation />
    </points>
  );
}

/** Geodesic shell, lat/lon graticule, and the degree readings on it. */
export function Cage() {
  const show = useAtlas((s) => s.showCage);
  const spots = useMemo(() => labelSpots(), []);

  const shell = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.32, 1)), []);
  const grid = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(cageSegments(), 3));
    return g;
  }, []);
  const quads = useMemo(() => coordGeometry(spots, LABEL_R), [spots]);
  const atlas = useMemo(() => labelAtlas(spots.map((s) => s.text)), [spots]);

  const uniforms = useMemo(
    () => ({
      uAtlas: { value: atlas },
      uTint: { value: new THREE.Color("#d8a866") },
      uOpacity: { value: 0.92 },
      uCamPos: { value: new THREE.Vector3() },
      // View-space half-height of a reading, in earth radii.
      uSize: { value: 0.058 },
    }),
    [atlas],
  );
  const mat = useRef<THREE.ShaderMaterial>(null);

  useEffect(
    () => () => {
      shell.dispose();
      grid.dispose();
      quads.dispose();
      atlas.dispose();
    },
    [shell, grid, quads, atlas],
  );

  useFrame(({ camera }) => {
    if (mat.current) mat.current.uniforms.uCamPos.value.copy(camera.position);
  });

  if (!show) return null;
  return (
    <group>
      <lineSegments geometry={shell}>
        <lineBasicMaterial color="#c89050" transparent opacity={0.1} />
      </lineSegments>
      <lineSegments geometry={grid}>
        <lineBasicMaterial color="#c89050" transparent opacity={0.26} depthWrite={false} />
      </lineSegments>
      <mesh geometry={quads} renderOrder={4} frustumCulled={false}>
        <shaderMaterial
          ref={mat}
          vertexShader={COORD_VERT}
          fragmentShader={COORD_FRAG}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** Equator of the cage radius, so the ring reads even with the cage off. */
export function HerePin() {
  const here = useAtlas((s) => s.here);
  if (!here) return null;
  const pos = ll2xyz(here.lat, here.lon, 1.02);
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[0.012, 16, 16]} />
        <meshBasicMaterial color="#e8e6e1" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.026, 16, 16]} />
        <meshBasicMaterial color="#c4a35a" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Orbit ahead and behind the current fix — one line, rebuilt per poll. */
export function IssTrack() {
  const show = useAtlas((s) => s.showIss);
  const iss = useAtlas((s) => s.iss);
  const asc = useAtlas((s) => s.issAsc);

  const geo = useMemo(() => {
    if (!iss) return null;
    const r = 1 + Math.max(0.04, iss.alt / 6371);
    const pts = groundTrack({ lat: iss.lat, lon: iss.lon, ascending: asc });
    const p = new Float32Array(pts.length * 3);
    pts.forEach((s, i) => {
      const v = ll2xyz(s.lat, s.lon, r);
      p[i * 3] = v[0];
      p[i * 3 + 1] = v[1];
      p[i * 3 + 2] = v[2];
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [iss, asc]);

  useEffect(() => () => geo?.dispose(), [geo]);

  if (!show || !geo) return null;
  return (
    <line>
      <primitive object={geo} attach="geometry" />
      <lineBasicMaterial color="#4c8dff" transparent opacity={0.34} depthWrite={false} />
    </line>
  );
}

const UP = new THREE.Vector3();
const FWD = new THREE.Vector3();
const SIDE = new THREE.Vector3();
const AHEAD = new THREE.Vector3();
const BASIS = new THREE.Matrix4();

export function Station() {
  const show = useAtlas((s) => s.showIss);
  // On the ride the camera is inside it — the pin would be a wall.
  const ride = useAtlas((s) => s.issRide);
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    const s = useAtlas.getState();
    const iss = s.iss;
    if (!ref.current || !iss) return;
    const r = 1 + Math.max(0.04, iss.alt / 6371);
    const p = ll2xyz(iss.lat, iss.lon, r);
    ref.current.position.set(p[0], p[1], p[2]);
    // Nose along the track, panels across it — not a box pointed at the core.
    const head =
      (trackHeading({ lat: iss.lat, lon: iss.lon, ascending: s.issAsc }) * Math.PI) / 180;
    const a = ll2xyz(iss.lat + Math.cos(head) * 0.6, iss.lon + Math.sin(head) * 0.6, r);
    AHEAD.set(a[0], a[1], a[2]);
    UP.copy(ref.current.position).normalize();
    FWD.copy(AHEAD).sub(ref.current.position).normalize();
    SIDE.crossVectors(UP, FWD).normalize();
    FWD.crossVectors(SIDE, UP).normalize();
    BASIS.makeBasis(SIDE, UP, FWD);
    ref.current.quaternion.setFromRotationMatrix(BASIS);
  });

  if (!show || ride) return null;
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={[0.018, 0.009, 0.028]} />
        <meshBasicMaterial color="#d4c5a3" />
      </mesh>
      <mesh position={[0.026, 0, 0]}>
        <boxGeometry args={[0.03, 0.0014, 0.01]} />
        <meshBasicMaterial color="#4c8dff" />
      </mesh>
      <mesh position={[-0.026, 0, 0]}>
        <boxGeometry args={[0.03, 0.0014, 0.01]} />
        <meshBasicMaterial color="#4c8dff" />
      </mesh>
    </group>
  );
}

export function Luna() {
  const show = useAtlas((s) => s.showMoon);
  const map = useTexture("/earth/moon.jpg");
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const sunVec = useMemo(() => new THREE.Vector3(), []);

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uSun: { value: new THREE.Vector3(1, 0.2, 0) },
    }),
    [map],
  );

  useFrame(() => {
    if (!show) return;
    const s = useAtlas.getState();
    const p = moonXYZ(s.moonLon, MOON_DIST, s.moonLat);
    if (group.current) group.current.position.set(p[0], p[1], p[2]);
    const sun = ll2xyz(s.sunLat, s.sunLon, 1);
    sunVec.set(sun[0], sun[1], sun[2]);
    if (mat.current) mat.current.uniforms.uSun.value.copy(sunVec);
  });

  if (!show) return null;
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[MOON_RADIUS, 48, 32]} />
        <shaderMaterial
          ref={mat}
          vertexShader={MOON_VERT}
          fragmentShader={MOON_FRAG}
          uniforms={uniforms}
        />
      </mesh>
    </group>
  );
}

export function SunLight() {
  const light = useRef<THREE.DirectionalLight>(null);
  const disc = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = useAtlas.getState();
    const v = ll2xyz(s.sunLat, s.sunLon, 40);
    if (light.current) {
      light.current.position.set(v[0], v[1], v[2]);
      light.current.target.position.set(0, 0, 0);
    }
    if (disc.current) disc.current.position.set(v[0], v[1], v[2]);
  });
  return (
    <>
      <directionalLight ref={light} color="#fff4e0" intensity={2} />
      <mesh ref={disc}>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshBasicMaterial color="#fff1c2" />
      </mesh>
    </>
  );
}

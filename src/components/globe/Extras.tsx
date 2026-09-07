import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ll2xyz } from "@/lib/atlas/geo";
import { MOON_DIST, MOON_RADIUS, moonXYZ } from "@/lib/atlas/tide";
import { useAtlas } from "@/lib/atlas/store";
import { MOON_FRAG, MOON_VERT } from "./shaders";

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

export function Cage() {
  const show = useAtlas((s) => s.showCage);
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.32, 1)), []);
  useEffect(() => () => geo.dispose(), [geo]);
  if (!show) return null;
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#c89050" transparent opacity={0.18} />
    </lineSegments>
  );
}

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

export function Station() {
  const show = useAtlas((s) => s.showIss);
  const iss = useAtlas((s) => s.iss);
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current || !iss) return;
    const p = ll2xyz(iss.lat, iss.lon, 1 + Math.max(0.04, iss.alt / 6371));
    ref.current.position.set(...p);
    ref.current.lookAt(0, 0, 0);
  });

  if (!show) return null;
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
        <shaderMaterial ref={mat} vertexShader={MOON_VERT} fragmentShader={MOON_FRAG} uniforms={uniforms} />
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

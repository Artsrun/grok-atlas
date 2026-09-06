import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ARARAT, ll2xyz, NILE, OBS } from "@/lib/atlas/geo";
import { useAtlas } from "@/lib/atlas/store";

export function Starfield({ count = 2600 }: { count?: number }) {
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
  return (
    <points geometry={geo}>
      <pointsMaterial color="#7c86a8" size={0.14} sizeAttenuation />
    </points>
  );
}

export function Cage() {
  const show = useAtlas((s) => s.showCage);
  if (!show) return null;
  return (
    <lineSegments>
      <edgesGeometry args={[new THREE.IcosahedronGeometry(1.32, 1)]} />
      <lineBasicMaterial color="#c89050" transparent opacity={0.18} />
    </lineSegments>
  );
}

export function SitePins() {
  const pins = useMemo(
    () => [
      { ...NILE, color: "#c89050", r: 0.011 },
      { ...OBS, color: "#e6e8f4", r: 0.01 },
      { ...ARARAT, color: "#ff4d5e", r: 0.01 },
    ],
    [],
  );
  const baseline = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const lat = OBS.lat + (ARARAT.lat - OBS.lat) * t;
      const lon = OBS.lon + (ARARAT.lon - OBS.lon) * t;
      pts.push(new THREE.Vector3(...ll2xyz(lat, lon, 1.012)));
    }
    return pts;
  }, []);
  return (
    <group>
      {pins.map((p) => {
        const pos = ll2xyz(p.lat, p.lon, 1.018);
        return (
          <group key={p.label} position={pos}>
            <mesh>
              <sphereGeometry args={[p.r, 14, 14]} />
              <meshBasicMaterial color={p.color} />
            </mesh>
          </group>
        );
      })}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(baseline.flatMap((v) => [v.x, v.y, v.z])), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#b05a32" transparent opacity={0.7} />
      </line>
    </group>
  );
}

export function Station() {
  const show = useAtlas((s) => s.showIss);
  const ref = useRef<THREE.Group>(null);
  const t = useRef(0.4);
  const orbit = useMemo(() => {
    const n = 180;
    const arr = new Float32Array(n * 3);
    const inc = (51.6 * Math.PI) / 180;
    const r = 1.22;
    for (let i = 0; i < n; i++) {
      const u = (i / n) * Math.PI * 2;
      arr[i * 3] = r * Math.cos(u);
      arr[i * 3 + 1] = r * Math.sin(u) * Math.sin(inc);
      arr[i * 3 + 2] = r * Math.sin(u) * Math.cos(inc);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  useFrame((_, dt) => {
    if (!ref.current || !show) return;
    const d = Math.min(dt, 0.1);
    t.current += d * 0.22;
    const inc = (51.6 * Math.PI) / 180;
    const r = 1.22;
    const u = t.current;
    const x = r * Math.cos(u);
    const y = r * Math.sin(u) * Math.sin(inc);
    const z = r * Math.sin(u) * Math.cos(inc);
    ref.current.position.set(x, y, z);
    ref.current.lookAt(0, 0, 0);
  });

  if (!show) return null;
  return (
    <group>
      <lineLoop geometry={orbit}>
        <lineBasicMaterial color="#c89050" transparent opacity={0.28} />
      </lineLoop>
      <group ref={ref}>
        <mesh>
          <boxGeometry args={[0.02, 0.01, 0.032]} />
          <meshStandardMaterial
            color="#d4c5a3"
            emissive="#c89050"
            emissiveIntensity={0.45}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0.03, 0, 0]}>
          <boxGeometry args={[0.034, 0.0016, 0.012]} />
          <meshStandardMaterial
            color="#4c8dff"
            emissive="#4c8dff"
            emissiveIntensity={0.35}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[-0.03, 0, 0]}>
          <boxGeometry args={[0.034, 0.0016, 0.012]} />
          <meshStandardMaterial
            color="#4c8dff"
            emissive="#4c8dff"
            emissiveIntensity={0.35}
            roughness={0.3}
          />
        </mesh>
      </group>
    </group>
  );
}

export function SunMarker() {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!mesh.current) return;
    const lon = useAtlas.getState().sunLon;
    const v = ll2xyz(8, lon, 18);
    mesh.current.position.set(v[0], v[1], v[2]);
  });
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.28, 16, 16]} />
      <meshBasicMaterial color="#fff1c2" />
    </mesh>
  );
}

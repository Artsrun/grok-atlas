import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { deviceCaps } from "@/lib/atlas/device";
import { ll2xyz } from "@/lib/atlas/geo";
import {
  SAA,
  TDRS,
  TDRS_R,
  cosmicCount,
  footprintHalfAngle,
  footprintRing,
  inFootprint,
  nearestTdrs,
  radioRings,
} from "@/lib/atlas/radio";
import { useAtlas } from "@/lib/atlas/store";

const BEAM = new Float32Array(6);

export function RadioWake() {
  const show = useAtlas((s) => s.showRadio);
  const iss = useAtlas((s) => s.iss);
  const here = useAtlas((s) => s.here);
  const ringsN = radioRings(deviceCaps().tier);
  const group = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);

  const footGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(65 * 3), 3));
    return g;
  }, []);
  const beamGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(BEAM, 3));
    return g;
  }, []);

  useEffect(
    () => () => {
      footGeo.dispose();
      beamGeo.dispose();
    },
    [footGeo, beamGeo],
  );

  useFrame(() => {
    if (!show) return;
    const fix = useAtlas.getState().iss;
    if (!fix || !group.current) return;
    const r = 1 + Math.max(0.04, fix.alt / 6371);
    const p = ll2xyz(fix.lat, fix.lon, r);
    group.current.position.set(p[0], p[1], p[2]);
    group.current.lookAt(0, 0, 0);

    const slot = nearestTdrs(fix.lon);
    const t = ll2xyz(0, slot.lon, TDRS_R);
    BEAM[0] = p[0];
    BEAM[1] = p[1];
    BEAM[2] = p[2];
    BEAM[3] = t[0];
    BEAM[4] = t[1];
    BEAM[5] = t[2];
    (beamGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;

    const ring = footprintRing(fix.lat, fix.lon, footprintHalfAngle(fix.alt), 64);
    const arr = footGeo.getAttribute("position") as THREE.BufferAttribute;
    ring.forEach((s, i) => {
      const v = ll2xyz(s.lat, s.lon, 1.012);
      arr.setXYZ(i, v[0], v[1], v[2]);
    });
    arr.needsUpdate = true;

    const now = performance.now() * 0.00018;
    group.current.children.forEach((c, i) => {
      if (!(c instanceof THREE.Mesh)) return;
      const t0 = (now + i / Math.max(1, ringsN)) % 1;
      c.scale.setScalar(0.04 + t0 * 0.22);
      (c.material as THREE.MeshBasicMaterial).opacity = (1 - t0) * 0.32;
    });

    if (pulse.current) {
      const on = here ? inFootprint(fix, here) : false;
      pulse.current.visible = on;
      if (on && here) {
        const h = ll2xyz(here.lat, here.lon, 1.03);
        pulse.current.position.set(h[0], h[1], h[2]);
        const s = 0.012 + Math.sin(performance.now() * 0.004) * 0.006;
        pulse.current.scale.setScalar(s / 0.02);
      }
    }
  });

  if (!show) return null;
  return (
    <group>
      {TDRS.map((s) => {
        const p = ll2xyz(0, s.lon, TDRS_R);
        return (
          <mesh key={s.id} position={p}>
            <boxGeometry args={[0.06, 0.02, 0.08]} />
            <meshBasicMaterial color="#8eb6ff" />
          </mesh>
        );
      })}
      <group ref={group}>
        {Array.from({ length: ringsN }, (_, i) => (
          <mesh key={i}>
            <ringGeometry args={[0.9, 1, 40]} />
            <meshBasicMaterial color="#4c8dff" transparent depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <line>
        <primitive object={beamGeo} attach="geometry" />
        <lineBasicMaterial color="#4c8dff" transparent opacity={0.28} depthWrite={false} />
      </line>
      <line>
        <primitive object={footGeo} attach="geometry" />
        <lineBasicMaterial color="#4c8dff" transparent opacity={0.22} depthWrite={false} />
      </line>
      {iss ? (
        <mesh ref={pulse} visible={false}>
          <sphereGeometry args={[0.02, 12, 12]} />
          <meshBasicMaterial color="#e8e6e1" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

export function CosmicDust() {
  const show = useAtlas((s) => s.showCosmic);
  const n = cosmicCount(deviceCaps().tier);
  const pts = useRef<THREE.Points>(null);

  const { geo, vel } = useMemo(() => {
    const pos = new Float32Array(n * 3);
    const v = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const R = 2.2 + Math.random() * 7;
      pos[i * 3] = R * Math.sin(ph) * Math.cos(t);
      pos[i * 3 + 1] = R * Math.sin(ph) * Math.sin(t);
      pos[i * 3 + 2] = R * Math.cos(ph);
      v[i] = 0.18 + Math.random() * 0.55;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geo: g, vel: v };
  }, [n]);

  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((_, dt) => {
    if (!show || !pts.current) return;
    const kp = useAtlas.getState().kp;
    const speed = (0.55 + kp * 0.08) * Math.min(dt, 0.05);
    const attr = geo.getAttribute("position") as THREE.BufferAttribute;
    const a = attr.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const x = a[i3];
      const y = a[i3 + 1];
      const z = a[i3 + 2];
      const r = Math.hypot(x, y, z) || 1;
      const step = vel[i] * speed;
      if (r - step < 1.05) {
        const t = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        const R = 6 + Math.random() * 4;
        a[i3] = R * Math.sin(ph) * Math.cos(t);
        a[i3 + 1] = R * Math.sin(ph) * Math.sin(t);
        a[i3 + 2] = R * Math.cos(ph);
      } else {
        const k = 1 - step / r;
        a[i3] = x * k;
        a[i3 + 1] = y * k;
        a[i3 + 2] = z * k;
      }
    }
    attr.needsUpdate = true;
  });

  if (!show) return null;
  const saa = ll2xyz(SAA.lat, SAA.lon, 1.06);
  return (
    <group>
      <points ref={pts} geometry={geo}>
        <pointsMaterial color="#d9a8c4" size={0.035} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
      </points>
      <mesh position={saa}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshBasicMaterial color="#c46a8a" transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>
  );
}

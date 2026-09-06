import { useMemo } from "react";
import * as THREE from "three";
import type { CountryFeat } from "@/lib/atlas/geo";
import { ll2xyz, ringsOf } from "@/lib/atlas/geo";
import { useAtlas } from "@/lib/atlas/store";

export function Borders({ countries }: { countries: CountryFeat[] }) {
  const show = useAtlas((s) => s.showBorders);
  const selected = useAtlas((s) => s.selected);
  const roles = useAtlas((s) => s.roles);

  const { all, hot } = useMemo(() => {
    const pushRing = (arr: number[], ring: number[][], r: number) => {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ll2xyz(ring[i][1], ring[i][0], r);
        const b = ll2xyz(ring[i + 1][1], ring[i + 1][0], r);
        arr.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    };
    const allArr: number[] = [];
    for (const c of countries) {
      for (const ring of ringsOf(c.feature.geometry)) pushRing(allArr, ring, 1.003);
    }
    const gAll = new THREE.BufferGeometry();
    gAll.setAttribute("position", new THREE.Float32BufferAttribute(allArr, 3));
    return { all: gAll, hot: countries };
  }, [countries]);

  const selectedGeo = useMemo(() => {
    const c = hot.find((x) => x.name === selected);
    if (!c) return null;
    const arr: number[] = [];
    for (const ring of ringsOf(c.feature.geometry)) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ll2xyz(ring[i][1], ring[i][0], 1.006);
        const b = ll2xyz(ring[i + 1][1], ring[i + 1][0], 1.006);
        arr.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }, [hot, selected]);

  const pinGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (const [name, role] of Object.entries(roles)) {
      if (role !== "defender" && role !== "attacker") continue;
      const c = countries.find((x) => x.name === name);
      if (!c) continue;
      // centroid via average of first ring — good enough for a pin
      const rings = ringsOf(c.feature.geometry);
      if (!rings[0]?.length) continue;
      let lat = 0,
        lon = 0;
      for (const p of rings[0]) {
        lon += p[0];
        lat += p[1];
      }
      lat /= rings[0].length;
      lon /= rings[0].length;
      const v = ll2xyz(lat, lon, 1.02);
      pts.push(new THREE.Vector3(...v));
    }
    return pts.map((p, i) => ({ p, i }));
  }, [roles, countries]);

  if (!show && !selected) return null;

  return (
    <group>
      {show && (
        <lineSegments geometry={all} frustumCulled={false}>
          <lineBasicMaterial
            color="#9aa3c2"
            transparent
            opacity={0.28}
            depthWrite={false}
          />
        </lineSegments>
      )}
      {selectedGeo && (
        <lineSegments geometry={selectedGeo} frustumCulled={false}>
          <lineBasicMaterial color="#c89050" transparent opacity={0.95} />
        </lineSegments>
      )}
      {pinGeo.map(({ p, i }) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.012, 12, 12]} />
          <meshBasicMaterial color="#e6e8f4" />
        </mesh>
      ))}
    </group>
  );
}

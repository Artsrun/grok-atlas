import { useMemo } from "react";
import * as THREE from "three";
import type { CountryFeat } from "@/lib/atlas/geo";
import { ll2xyz, ringsOf } from "@/lib/atlas/geo";
import { useAtlas } from "@/lib/atlas/store";

export function Borders({ countries }: { countries: CountryFeat[] }) {
  const show = useAtlas((s) => s.showBorders);
  const selected = useAtlas((s) => s.selected);

  const all = useMemo(() => {
    const arr: number[] = [];
    for (const c of countries) {
      for (const ring of ringsOf(c.feature.geometry)) {
        for (let i = 0; i < ring.length - 1; i++) {
          const a = ll2xyz(ring[i][1], ring[i][0], 1.003);
          const b = ll2xyz(ring[i + 1][1], ring[i + 1][0], 1.003);
          arr.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }, [countries]);

  const selectedGeo = useMemo(() => {
    const c = countries.find((x) => x.name === selected);
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
  }, [countries, selected]);

  if (!show && !selected) return null;

  return (
    <group>
      {show && (
        <lineSegments geometry={all} frustumCulled={false}>
          <lineBasicMaterial color="#9aa3c2" transparent opacity={0.22} depthWrite={false} />
        </lineSegments>
      )}
      {selectedGeo && (
        <lineSegments geometry={selectedGeo} frustumCulled={false}>
          <lineBasicMaterial color="#c89050" transparent opacity={0.95} />
        </lineSegments>
      )}
    </group>
  );
}

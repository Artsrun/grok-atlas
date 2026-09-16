import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { CountryFeat } from "@/lib/atlas/geo";
import { ll2xyz, ringsOf } from "@/lib/atlas/geo";
import { useAtlas } from "@/lib/atlas/store";

/** Every ring of every feature as a flat lineSegments buffer at radius `r`. */
function outlineGeometry(countries: CountryFeat[], r: number): THREE.BufferGeometry {
  const arr: number[] = [];
  for (const c of countries) {
    for (const ring of ringsOf(c.feature.geometry)) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ll2xyz(ring[i][1], ring[i][0], r);
        const b = ll2xyz(ring[i + 1][1], ring[i + 1][0], r);
        arr.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
  return g;
}

export function Borders({ countries }: { countries: CountryFeat[] }) {
  const show = useAtlas((s) => s.showBorders);
  const selected = useAtlas((s) => s.selected);
  const hovered = useAtlas((s) => s.hovered);

  const all = useMemo(() => outlineGeometry(countries, 1.003), [countries]);

  const selectedGeo = useMemo(() => {
    const c = countries.find((x) => x.name === selected);
    return c ? outlineGeometry([c], 1.006) : null;
  }, [countries, selected]);

  /**
   * One country's rings, rebuilt when the cursor crosses a border. It is a few
   * hundred segments and it only happens on a change, not on a move — the
   * picker already collapses a stream of pointermoves into one pick a frame.
   */
  const hoverGeo = useMemo(() => {
    if (!hovered || hovered === selected) return null;
    const c = countries.find((x) => x.name === hovered);
    return c ? outlineGeometry([c], 1.005) : null;
  }, [countries, hovered, selected]);

  useEffect(() => () => all.dispose(), [all]);
  useEffect(() => () => selectedGeo?.dispose(), [selectedGeo]);
  useEffect(() => () => hoverGeo?.dispose(), [hoverGeo]);

  if (!show && !selected && !hoverGeo) return null;

  return (
    <group>
      {show && (
        <lineSegments geometry={all} frustumCulled={false}>
          <lineBasicMaterial color="#9aa3c2" transparent opacity={0.22} depthWrite={false} />
        </lineSegments>
      )}
      {hoverGeo && (
        <lineSegments geometry={hoverGeo} frustumCulled={false}>
          <lineBasicMaterial color="#e8e6e1" transparent opacity={0.55} depthWrite={false} />
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

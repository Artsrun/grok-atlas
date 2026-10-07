import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { ll2xyzInto } from "@/lib/atlas/geo";
import { useAtlas } from "@/lib/atlas/store";

export type Lake = { name: string; rings: [number, number][][] };

/** Under the river ribbons (1.0035), over the relief. */
const LAKE_R = 1.0032;

const buildGeometry = (lakes: Lake[]): THREE.BufferGeometry | null => {
  const pos: number[] = [];
  const index: number[] = [];
  const P = new THREE.Vector3();
  const C = new THREE.Vector3();

  for (const lake of lakes) {
    for (const ring of lake.rings) {
      const closed =
        ring.length > 3 &&
        ring[0][0] === ring[ring.length - 1][0] &&
        ring[0][1] === ring[ring.length - 1][1];
      const pts = closed ? ring.slice(0, -1) : ring;
      if (pts.length < 3) continue;
      const base = pos.length / 3;
      C.set(0, 0, 0);
      for (const [lon, lat] of pts) {
        ll2xyzInto(P, lat, lon, LAKE_R);
        C.add(P);
        pos.push(P.x, P.y, P.z);
      }
      C.normalize().multiplyScalar(LAKE_R);
      pos.push(C.x, C.y, C.z);
      const c = base + pts.length;
      for (let i = 0; i < pts.length; i++) {
        index.push(c, base + i, base + ((i + 1) % pts.length));
      }
    }
  }
  if (!index.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(index);
  g.computeVertexNormals();
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), LAKE_R * 1.05);
  return g;
};

export function Lakes() {
  const show = useAtlas((s) => s.showRivers);
  const [lakes, setLakes] = useState<Lake[] | null>(null);

  useEffect(() => {
    if (!show || lakes) return;
    let live = true;
    fetch("/geo/lakes.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("lakes"))))
      .then((d: { lakes: Lake[] }) => {
        if (live) setLakes(d.lakes);
      })
      .catch(() => {
        if (live) setLakes([]);
      });
    return () => {
      live = false;
    };
  }, [show, lakes]);

  const geo = useMemo(() => (lakes?.length ? buildGeometry(lakes) : null), [lakes]);
  useEffect(() => () => geo?.dispose(), [geo]);

  if (!show || !geo) return null;
  return (
    <mesh geometry={geo} frustumCulled={false} renderOrder={1}>
      <meshBasicMaterial color="#1a4d73" transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

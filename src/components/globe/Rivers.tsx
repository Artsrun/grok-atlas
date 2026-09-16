import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ll2xyzInto } from "@/lib/atlas/geo";
import { useAtlas } from "@/lib/atlas/store";
import { RIVER_FRAG, RIVER_VERT } from "./shaders";

export type River = { name: string; coords: [number, number][] };

/** Just clear of the surface: under the borders, over the relief. */
const RIVER_R = 1.0035;

/**
 * All twelve rivers in one buffer. Each vertex carries how far down its own
 * river it sits, so the shader can run a pulse from source to mouth without
 * the CPU touching anything per frame.
 */
const buildGeometry = (rivers: River[]): THREE.BufferGeometry => {
  const pos: number[] = [];
  const other: number[] = [];
  const side: number[] = [];
  const flow: number[] = [];
  const seed: number[] = [];
  const index: number[] = [];

  const push = (p: THREE.Vector3, q: THREE.Vector3, s: number, f: number, sd: number) => {
    pos.push(p.x, p.y, p.z);
    other.push(q.x, q.y, q.z);
    side.push(s);
    flow.push(f);
    seed.push(sd);
  };

  const A = new THREE.Vector3();
  const B = new THREE.Vector3();

  rivers.forEach((river, i) => {
    const pts = river.coords;
    if (pts.length < 2) return;
    // Distance along the course, by arc, so a pulse crosses a straightened
    // reach and a meander at the same speed.
    const run: number[] = [0];
    for (let k = 1; k < pts.length; k++) {
      const [aLon, aLat] = pts[k - 1];
      const [bLon, bLat] = pts[k];
      run.push(run[k - 1] + Math.hypot(bLon - aLon, bLat - aLat));
    }
    const total = run[run.length - 1] || 1;
    const sd = (i * 0.618) % 1;

    for (let k = 0; k < pts.length - 1; k++) {
      ll2xyzInto(A, pts[k][1], pts[k][0], RIVER_R);
      ll2xyzInto(B, pts[k + 1][1], pts[k + 1][0], RIVER_R);
      const base = pos.length / 3;
      // Four corners of one segment's ribbon: two at each end, either side.
      push(A, B, -1, run[k] / total, sd);
      push(A, B, 1, run[k] / total, sd);
      push(B, A, 1, run[k + 1] / total, sd);
      push(B, A, -1, run[k + 1] / total, sd);
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aOther", new THREE.BufferAttribute(new Float32Array(other), 3));
  g.setAttribute("aSide", new THREE.BufferAttribute(new Float32Array(side), 1));
  g.setAttribute("aFlow", new THREE.BufferAttribute(new Float32Array(flow), 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(seed), 1));
  g.setIndex(index);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), RIVER_R * 1.05);
  return g;
};

export function Rivers() {
  const show = useAtlas((s) => s.showRivers);
  const [rivers, setRivers] = useState<River[] | null>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);

  // Nineteen kilobytes, and only when someone asks to see them.
  useEffect(() => {
    if (!show || rivers) return;
    let live = true;
    fetch("/geo/rivers.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("rivers"))))
      .then((d: { rivers: River[] }) => {
        if (live) setRivers(d.rivers);
      })
      .catch(() => {
        if (live) setRivers([]);
      });
    return () => {
      live = false;
    };
  }, [show, rivers]);

  const geo = useMemo(() => (rivers?.length ? buildGeometry(rivers) : null), [rivers]);
  useEffect(() => () => geo?.dispose(), [geo]);

  const uniforms = useMemo(
    () => ({
      uCourse: { value: new THREE.Color("#2b86c8") },
      uPulse: { value: new THREE.Color("#dff4ff") },
      uTime: { value: 0 },
      uOpacity: { value: 0.95 },
      uCamPos: { value: new THREE.Vector3() },
      uResolution: { value: new THREE.Vector2(1, 1) },
      /** Ribbon width in device pixels. */
      uWidth: { value: 2.6 },
    }),
    [],
  );

  useFrame(({ camera, clock, size, viewport }) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    u.uCamPos.value.copy(camera.position);
    u.uTime.value = clock.elapsedTime;
    // Widening happens in NDC, so the ribbon needs to know how many pixels
    // that is — and the governor moves the pixel ratio underneath it.
    u.uResolution.value.set(size.width * viewport.dpr, size.height * viewport.dpr);
  });

  if (!show || !geo) return null;
  return (
    <mesh geometry={geo} frustumCulled={false} renderOrder={1}>
      <shaderMaterial
        ref={mat}
        vertexShader={RIVER_VERT}
        fragmentShader={RIVER_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ll2xyz } from "@/lib/atlas/geo";
import { useAtlas } from "@/lib/atlas/store";
import { COORD_FRAG, COORD_VERT } from "./shaders";
import { coordGeometry, labelAtlas } from "./labels";

/** Pin at the surface, label just above it. */
const PIN_R = 1.006;
const LABEL_R = 1.045;

/**
 * The capital of whatever country is selected: a white star on the map and its
 * name in white beside it. White because everything else on this globe is gold
 * or dim — the capital is the one thing the eye should go to first.
 */
export function Capital() {
  const selected = useAtlas((s) => s.selected);
  const fact = useAtlas((s) => (s.selected ? s.facts[s.selected] : undefined));
  const mat = useRef<THREE.ShaderMaterial>(null);

  const at = fact?.capital && fact.lat != null && fact.lon != null ? fact : null;

  const label = useMemo(() => {
    if (!at?.capital) return null;
    const atlas = labelAtlas([at.capital.toUpperCase()]);
    const quad = coordGeometry([{ lat: at.lat!, lon: at.lon!, text: at.capital }], LABEL_R);
    return { atlas, quad };
  }, [at]);

  useEffect(
    () => () => {
      label?.atlas.dispose();
      label?.quad.dispose();
    },
    [label],
  );

  const uniforms = useMemo(
    () =>
      label
        ? {
            uAtlas: { value: label.atlas },
            uTint: { value: new THREE.Color("#ffffff") },
            uOpacity: { value: 1 },
            uCamPos: { value: new THREE.Vector3() },
            uSize: { value: 0.07 },
          }
        : null,
    [label],
  );

  useFrame(({ camera }) => {
    if (mat.current) mat.current.uniforms.uCamPos.value.copy(camera.position);
  });

  if (!selected || !at || !label || !uniforms) return null;
  const pos = ll2xyz(at.lat!, at.lon!, PIN_R);

  return (
    <group>
      <mesh position={pos}>
        <sphereGeometry args={[0.009, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={pos}>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh geometry={label.quad} renderOrder={5} frustumCulled={false}>
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

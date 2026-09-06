import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useAtlas } from "@/lib/atlas/store";
import { ll2xyz } from "@/lib/atlas/geo";
import { ATMO_FRAG, ATMO_VERT, CLOUD_FRAG, CLOUD_VERT, EARTH_FRAG, EARTH_VERT } from "./shaders";

export function Earth({
  atlasTex,
}: {
  atlasTex: THREE.CanvasTexture;
}) {
  const [dayMap, nightMap, specMap, normalMap, cloudMap] = useTexture([
    "/earth/day.jpg",
    "/earth/night.png",
    "/earth/specular.jpg",
    "/earth/normal.jpg",
    "/earth/clouds.png",
  ]);

  useEffect(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.colorSpace = THREE.SRGBColorSpace;
    atlasTex.colorSpace = THREE.SRGBColorSpace;
    dayMap.anisotropy = 8;
    nightMap.anisotropy = 8;
    cloudMap.wrapS = THREE.RepeatWrapping;
    dayMap.needsUpdate = true;
  }, [dayMap, nightMap, cloudMap, atlasTex]);

  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 96, 64);
    g.computeTangents();
    return g;
  }, []);

  const earthMat = useRef<THREE.ShaderMaterial>(null);
  const atmoMat = useRef<THREE.ShaderMaterial>(null);
  const atmoIn = useRef<THREE.ShaderMaterial>(null);
  const cloudMat = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uDay: { value: dayMap },
      uNight: { value: nightMap },
      uSpec: { value: specMap },
      uNormal: { value: normalMap },
      uAtlas: { value: atlasTex },
      uSun: { value: new THREE.Vector3(1, 0.2, 0) },
      uCamPos: { value: new THREE.Vector3(0, 0, 3) },
      uAtlasMix: { value: 0.42 },
      uNightGain: { value: 1.85 },
      uBump: { value: 1.15 },
    }),
    [dayMap, nightMap, specMap, normalMap, atlasTex],
  );

  const atmoU = useMemo(
    () => ({
      uSun: { value: new THREE.Vector3(1, 0.2, 0) },
      uCamPos: { value: new THREE.Vector3() },
      uInner: { value: 0 },
    }),
    [],
  );
  const atmoUIn = useMemo(
    () => ({
      uSun: { value: new THREE.Vector3(1, 0.2, 0) },
      uCamPos: { value: new THREE.Vector3() },
      uInner: { value: 1 },
    }),
    [],
  );
  const cloudU = useMemo(
    () => ({
      uClouds: { value: cloudMap },
      uSun: { value: new THREE.Vector3(1, 0.2, 0) },
      uOpacity: { value: 0.55 },
      uTime: { value: 0 },
    }),
    [cloudMap],
  );

  const sunVec = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, clock }) => {
    const s = useAtlas.getState();
    const decl = 23.4 * Math.sin((s.sunLon * Math.PI) / 180) * 0.15;
    const xyz = ll2xyz(decl, s.sunLon, 1);
    sunVec.set(xyz[0], xyz[1], xyz[2]);
    const bump = s.bump;
    const mix = s.atlasMix;
    const ng = s.nightGain;
    const op = s.cloudOpacity;

    const apply = (u: { uSun: { value: THREE.Vector3 }; uCamPos: { value: THREE.Vector3 } }) => {
      u.uSun.value.copy(sunVec);
      u.uCamPos.value.copy(camera.position);
    };
    if (earthMat.current) {
      apply(earthMat.current.uniforms as never);
      earthMat.current.uniforms.uAtlasMix.value = mix;
      earthMat.current.uniforms.uNightGain.value = ng;
      earthMat.current.uniforms.uBump.value = bump;
    }
    if (atmoMat.current) apply(atmoMat.current.uniforms as never);
    if (atmoIn.current) apply(atmoIn.current.uniforms as never);
    if (cloudMat.current) {
      cloudMat.current.uniforms.uSun.value.copy(sunVec);
      cloudMat.current.uniforms.uOpacity.value = op;
      cloudMat.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  const showAtmo = useAtlas((s) => s.showAtmosphere);
  const showClouds = useAtlas((s) => s.showClouds);

  return (
    <group>
      <mesh geometry={geo} name="earth" castShadow={false}>
        <shaderMaterial
          ref={earthMat}
          vertexShader={EARTH_VERT}
          fragmentShader={EARTH_FRAG}
          uniforms={uniforms}
        />
      </mesh>

      {showClouds && (
        <mesh geometry={geo} scale={1.008} renderOrder={2}>
          <shaderMaterial
            ref={cloudMat}
            vertexShader={CLOUD_VERT}
            fragmentShader={CLOUD_FRAG}
            uniforms={cloudU}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}

      {showAtmo && (
        <>
          <mesh scale={1.045} renderOrder={3}>
            <sphereGeometry args={[1, 64, 48]} />
            <shaderMaterial
              ref={atmoIn}
              vertexShader={ATMO_VERT}
              fragmentShader={ATMO_FRAG}
              uniforms={atmoUIn}
              transparent
              depthWrite={false}
              side={THREE.FrontSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh scale={1.18} renderOrder={0}>
            <sphereGeometry args={[1, 64, 48]} />
            <shaderMaterial
              ref={atmoMat}
              vertexShader={ATMO_VERT}
              fragmentShader={ATMO_FRAG}
              uniforms={atmoU}
              transparent
              depthWrite={false}
              side={THREE.BackSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </>
      )}
    </group>
  );
}

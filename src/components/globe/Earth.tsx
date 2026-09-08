import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { markBoot } from "@/lib/atlas/boot";
import { useAtlas } from "@/lib/atlas/store";
import { ll2xyz } from "@/lib/atlas/geo";
import { moonXYZ } from "@/lib/atlas/tide";
import { deviceCaps } from "@/lib/atlas/device";
import { frameScale } from "@/lib/atlas/perf";
import { ATMO_FRAG, ATMO_VERT, CLOUD_FRAG, CLOUD_VERT, EARTH_FRAG, EARTH_VERT } from "./shaders";

function pixel(r: number, g: number, b: number) {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

export function Earth({ atlasTex }: { atlasTex: THREE.CanvasTexture }) {
  const cap = deviceCaps();
  const dayMap = useTexture("/earth/day.jpg");
  const [cloudMap, setCloudMap] = useState<THREE.Texture | null>(null);

  const placeholders = useMemo(
    () => ({
      night: pixel(0, 0, 0),
      spec: pixel(8, 8, 8),
      normal: pixel(128, 128, 255),
    }),
    [],
  );

  useEffect(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    atlasTex.colorSpace = THREE.SRGBColorSpace;
    dayMap.anisotropy = cap.anisotropy;
    dayMap.needsUpdate = true;
    markBoot("day");
  }, [dayMap, atlasTex, cap.anisotropy]);

  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, cap.sphereSeg[0], cap.sphereSeg[1]);
    g.computeTangents();
    return g;
  }, [cap.sphereSeg]);

  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(
    () => () => {
      placeholders.night.dispose();
      placeholders.spec.dispose();
      placeholders.normal.dispose();
    },
    [placeholders],
  );

  const earthMat = useRef<THREE.ShaderMaterial>(null);
  const atmoMat = useRef<THREE.ShaderMaterial>(null);
  const atmoIn = useRef<THREE.ShaderMaterial>(null);
  const cloudMat = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uDay: { value: dayMap },
      uNight: { value: placeholders.night },
      uSpec: { value: placeholders.spec },
      uNormal: { value: placeholders.normal },
      uAtlas: { value: atlasTex },
      uSun: { value: new THREE.Vector3(1, 0.2, 0) },
      uCamPos: { value: new THREE.Vector3(0, 0, 3) },
      uMoon: { value: new THREE.Vector3(-1, 0.1, 0) },
      uAtlasMix: { value: 1 },
      uNightGain: { value: 1.65 },
      uBump: { value: 1.05 },
      uTideAmp: { value: 0 },
      uGrainLights: { value: cap.grainLights },
      uGrainRelief: { value: cap.grainRelief },
    }),
    [dayMap, placeholders, atlasTex, cap.grainLights, cap.grainRelief],
  );

  useEffect(() => {
    let dead = false;
    const loader = new THREE.TextureLoader();
    const held: THREE.Texture[] = [];

    const take = async (url: string, srgb: boolean) => {
      const t = await loader.loadAsync(url);
      if (dead) {
        t.dispose();
        return null;
      }
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = cap.anisotropy;
      t.needsUpdate = true;
      held.push(t);
      return t;
    };

    (async () => {
      const night = await take("/earth/night.png", true);
      if (dead) return;
      if (night && earthMat.current) earthMat.current.uniforms.uNight.value = night;
      markBoot("night");

      if (cap.tier === "low") {
        markBoot("maps");
        markBoot("clouds");
        return;
      }

      const spec = await take("/earth/specular.jpg", false);
      const normal = await take("/earth/normal.jpg", false);
      if (dead) return;
      if (earthMat.current) {
        if (spec) earthMat.current.uniforms.uSpec.value = spec;
        if (normal) earthMat.current.uniforms.uNormal.value = normal;
      }
      markBoot("maps");

      const clouds = await take("/earth/clouds.png", true);
      if (dead) return;
      if (clouds) {
        clouds.wrapS = THREE.RepeatWrapping;
        setCloudMap(clouds);
      }
      markBoot("clouds");
    })().catch(() => {
      markBoot("night");
      markBoot("maps");
      markBoot("clouds");
    });

    return () => {
      dead = true;
      for (const t of held) t.dispose();
    };
  }, [cap.anisotropy, cap.tier]);

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
    () =>
      cloudMap
        ? {
            uClouds: { value: cloudMap },
            uSun: { value: new THREE.Vector3(1, 0.2, 0) },
            uOpacity: { value: 0.42 },
            uTime: { value: 0 },
          }
        : null,
    [cloudMap],
  );

  const sunVec = useMemo(() => new THREE.Vector3(), []);
  const moonVec = useMemo(() => new THREE.Vector3(), []);

  /** Octaves are linked, not branched — the tier picks the shader it can run. */
  const defines = useMemo(
    () => ({ GRAIN_OCTAVES: cap.tier === "high" ? 3 : cap.tier === "mid" ? 2 : 1 }),
    [cap.tier],
  );

  useFrame(({ camera, clock }) => {
    const s = useAtlas.getState();
    const xyz = ll2xyz(s.sunLat, s.sunLon, 1);
    sunVec.set(xyz[0], xyz[1], xyz[2]);
    const m = moonXYZ(s.moonLon, 1, s.moonLat);
    moonVec.set(m[0], m[1], m[2]);
    const apply = (u: { uSun: { value: THREE.Vector3 }; uCamPos: { value: THREE.Vector3 } }) => {
      u.uSun.value.copy(sunVec);
      u.uCamPos.value.copy(camera.position);
    };
    if (earthMat.current) {
      apply(earthMat.current.uniforms as never);
      earthMat.current.uniforms.uAtlasMix.value = 1;
      earthMat.current.uniforms.uNightGain.value = s.nightGain;
      earthMat.current.uniforms.uBump.value = s.bump;
      earthMat.current.uniforms.uTideAmp.value = s.showTides ? s.tideGain : 0;
      earthMat.current.uniforms.uMoon.value.copy(moonVec);
      const mix = s.grainMix * frameScale();
      earthMat.current.uniforms.uGrainLights.value = cap.grainLights * mix;
      earthMat.current.uniforms.uGrainRelief.value = cap.grainRelief * mix;
    }
    if (atmoMat.current) apply(atmoMat.current.uniforms as never);
    if (atmoIn.current) apply(atmoIn.current.uniforms as never);
    if (cloudMat.current) {
      cloudMat.current.uniforms.uSun.value.copy(sunVec);
      cloudMat.current.uniforms.uOpacity.value = s.cloudOpacity;
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
          defines={defines}
        />
      </mesh>
      {showClouds && cloudU && (
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
          <mesh scale={1.04} renderOrder={3}>
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
          <mesh scale={1.08} renderOrder={0}>
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

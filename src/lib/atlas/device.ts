/** GPU / display probe — pick a globe budget, then grain on new silicon. */

export type DeviceTier = "low" | "mid" | "high";

export type DeviceCaps = {
  tier: DeviceTier;
  label: string;
  renderer: string;
  webgl2: boolean;
  dpr: [number, number];
  antialias: boolean;
  anisotropy: number;
  sphereSeg: [number, number];
  /** 0 = off, ~1.2 = heavy ISS-style grain on city lights. */
  grainLights: number;
  /** 0 = smooth normal, ~1 = heavy relief grain. */
  grainRelief: number;
  powerPreference: "low-power" | "high-performance";
};

export type DeviceProbe = {
  renderer: string;
  webgl2: boolean;
  maxTextureSize: number;
  cores: number;
  memoryGb: number;
  dpr: number;
  mobile: boolean;
  saveData: boolean;
};

const HIGH_GPU =
  /Apple M\d|Apple GPU|A1[5-9]|A2\d|Adreno \(TM\) ([6-9]\d{2}|1\d{3})|Mali-G[7-9]|Mali-G1\d|Immortalis|NVIDIA|GeForce|RTX|Radeon|RDNA|Intel\(R\) Arc|ANGLE \(Apple/i;

const LOW_GPU =
  /SwiftShader|llvmpipe|softpipe|Microsoft Basic Render|Mali-4|Mali-T|Adreno \(TM\) [1-4]\d{2}\b|PowerVR SGX|Intel\(R\) HD Graphics [2-4]\d{3}|Intel HD Graphics/i;

export function classifyDevice(p: DeviceProbe): DeviceCaps {
  const renderer = p.renderer || "unknown";
  const software = LOW_GPU.test(renderer);
  const namedHigh = HIGH_GPU.test(renderer);

  let tier: DeviceTier = "mid";
  if (
    software ||
    p.saveData ||
    !p.webgl2 ||
    p.maxTextureSize < 4096 ||
    p.memoryGb <= 2 ||
    p.cores <= 2
  ) {
    tier = "low";
  } else if (
    namedHigh ||
    (!p.mobile && p.cores >= 8 && p.maxTextureSize >= 8192) ||
    (p.mobile && /Apple GPU/i.test(renderer) && p.dpr >= 2 && p.cores >= 6)
  ) {
    tier = "high";
  }

  if (tier === "low") {
    return {
      tier,
      label: "compat",
      renderer,
      webgl2: p.webgl2,
      dpr: [1, 1],
      antialias: false,
      anisotropy: 1,
      sphereSeg: [64, 40],
      grainLights: 0,
      grainRelief: 0,
      powerPreference: "low-power",
    };
  }

  if (tier === "mid") {
    return {
      tier,
      label: "standard",
      renderer,
      webgl2: p.webgl2,
      dpr: [1, p.mobile ? 1.5 : 1.75],
      antialias: !p.mobile,
      anisotropy: 4,
      sphereSeg: [80, 56],
      grainLights: 0.38,
      grainRelief: 0.32,
      powerPreference: "high-performance",
    };
  }

  return {
    tier,
    label: "grain",
    renderer,
    webgl2: p.webgl2,
    dpr: [1, Math.min(2, Math.max(1.5, p.dpr))],
    antialias: true,
    anisotropy: 16,
    sphereSeg: [96, 64],
    grainLights: 1.22,
    grainRelief: 1.08,
    powerPreference: "high-performance",
  };
}

function readGl(): Pick<DeviceProbe, "renderer" | "webgl2" | "maxTextureSize"> {
  if (typeof document === "undefined") {
    return { renderer: "ssr", webgl2: true, maxTextureSize: 8192 };
  }
  const c = document.createElement("canvas");
  const gl2 = c.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
  const gl = gl2 ?? c.getContext("webgl", { failIfMajorPerformanceCaveat: false });
  if (!gl) return { renderer: "none", webgl2: false, maxTextureSize: 0 };
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = info
    ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? "")
    : String(gl.getParameter(gl.RENDERER) ?? "");
  const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE) ?? 0);
  const lose = gl.getExtension("WEBGL_lose_context");
  lose?.loseContext();
  return { renderer, webgl2: Boolean(gl2), maxTextureSize };
}

export function probeDevice(): DeviceProbe {
  if (typeof navigator === "undefined") {
    return {
      renderer: "ssr",
      webgl2: true,
      maxTextureSize: 8192,
      cores: 8,
      memoryGb: 8,
      dpr: 1,
      mobile: false,
      saveData: false,
    };
  }
  const gl = readGl();
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const override = new URLSearchParams(location.search).get("tier") as DeviceTier | null;
  const base: DeviceProbe = {
    ...gl,
    cores: navigator.hardwareConcurrency || 4,
    memoryGb: nav.deviceMemory ?? 4,
    dpr: window.devicePixelRatio || 1,
    mobile: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent),
    saveData: Boolean(nav.connection?.saveData),
  };
  if (override === "low" || override === "mid" || override === "high") {
    return {
      ...base,
      renderer:
        override === "high"
          ? "Apple M4 (forced)"
          : override === "low"
            ? "SwiftShader (forced)"
            : "Mali-G52 (forced)",
      webgl2: override !== "low",
      maxTextureSize: override === "low" ? 2048 : 8192,
      cores: override === "low" ? 2 : 8,
      memoryGb: override === "low" ? 2 : 8,
      saveData: override === "low",
    };
  }
  return base;
}

let cached: DeviceCaps | null = null;

export function deviceCaps(): DeviceCaps {
  if (!cached) cached = classifyDevice(probeDevice());
  return cached;
}

export function resetDeviceCaps() {
  cached = null;
}

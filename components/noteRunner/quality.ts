// Picks Note Runner's graphics quality for this device before the scene is
// built. "high": cartoon (toon) shading, more scenery, beveled 3D clefs,
// soft shadows, sharper rendering. "low": the same game and the same
// readable staff with fewer decorations and fewer pixels, for old school
// tablets. The engine can still drop from high to low while playing if
// frames are slow (RunnerEngine.trackFrameTime).
//
// ?quality=high or ?quality=low in the page URL forces one (for testing).

export type RunnerQuality = "high" | "low";

export function detectQuality(): RunnerQuality {
  if (typeof window === "undefined") return "low";
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "high" || forced === "low") return forced;

  const nav = navigator as Navigator & { deviceMemory?: number };
  // Chrome/Android only; Safari doesn't report it.
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 3) return "low";
  const cores = nav.hardwareConcurrency || 4;
  const touch = navigator.maxTouchPoints > 0;
  if (touch && cores <= 4) return "low";

  const gpu = gpuName();
  if (gpu && WEAK_GPU.test(gpu)) return "low";
  return "high";
}

// GPUs found in old school tablets and budget laptops, plus software
// renderers.
const WEAK_GPU =
  /(mali-[4t]\d{2}|mali-g(31|51|52|57)|adreno \(tm\) (3|4|50|51|60)\d|adreno (3|4|50|51|60)\d|powervr sgx|powervr ge8|apple a(8|9|10)\b|intel\(r\) hd graphics (2|3|4)\d{3}|swiftshader|llvmpipe|software)/i;

function gpuName(): string | null {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return typeof name === "string" ? name : null;
  } catch {
    return null;
  }
}

import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { glyphPaths, GLYPH_UNITS_PER_SPACE } from "@/lib/noteGlyphs";
import type { RunnerQuality } from "./quality";

// Shared look for Note Runner: cartoon materials, the paper texture, the
// sky, and music symbols (clefs, note heads) as real 3D shapes cut from the
// same Bravura outlines the rest of the site uses. Everything is generated
// in code, so there are no texture or model files to download.

export const PALETTE = {
  skyTop: "#6EC3EE",
  skyHorizon: "#D9F1FB",
  grass: 0x7cc96e,
  grassDark: 0x5fb35a,
  hillNear: 0x8fd47e,
  hillFar: 0xa9dfa0,
  paper: "#FFFBF2",
  paperEdge: 0xead9b8,
  wood: 0xb07a45,
  leaf: 0x55b860,
  leafLight: 0x79cf6f,
  pine: 0x3f9e5a,
  cloud: 0xffffff,
  ink: 0x262626,
  gate: 0x3b5cc4,
  correct: 0x2fa85c,
  wrong: 0xd24848,
  marker: 0x3b5cc4,
};

// Cartoon shading: "high" uses three-step toon shading, "low" plain
// Lambert (cheaper on old GPUs, still flat-coloured and friendly).
export class Materials {
  private gradient: THREE.DataTexture | null = null;
  private cache = new Map<string, THREE.Material>();

  constructor(private quality: RunnerQuality) {
    if (quality === "high") {
      this.gradient = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
      this.gradient.minFilter = THREE.NearestFilter;
      this.gradient.magFilter = THREE.NearestFilter;
      this.gradient.needsUpdate = true;
    }
  }

  // One shared material per colour.
  get(color: number): THREE.Material {
    const key = color.toString(16);
    let m = this.cache.get(key);
    if (!m) {
      m = this.gradient
        ? new THREE.MeshToonMaterial({ color, gradientMap: this.gradient })
        : new THREE.MeshLambertMaterial({ color });
      this.cache.set(key, m);
    }
    return m;
  }

  // A material of its own (for things that change colour, like a flash).
  fresh(color: number): THREE.MeshToonMaterial | THREE.MeshLambertMaterial {
    return this.gradient
      ? new THREE.MeshToonMaterial({ color, gradientMap: this.gradient })
      : new THREE.MeshLambertMaterial({ color });
  }
}

// Cream paper with faint fibres and specks; tiles across the page.
export function paperTexture(quality: RunnerQuality): THREE.Texture {
  const size = quality === "high" ? 512 : 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, size, size);
  // Seeded, so every device gets the same paper.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * 6; i++) {
    ctx.fillStyle = `rgba(150,120,80,${0.02 + rand() * 0.04})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < size / 6; i++) {
    ctx.strokeStyle = `rgba(160,130,90,${0.03 + rand() * 0.03})`;
    const x = rand() * size;
    const y = rand() * size;
    const len = 8 + rand() * 30;
    const a = rand() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + rand() * 4, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Vertical sky gradient used as the scene background.
export function skyTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.75, PALETTE.skyHorizon);
  g.addColorStop(1, PALETTE.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A soft round shadow (radial gradient), for under/behind objects.
export function softShadowTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, "rgba(40,30,20,0.55)");
  g.addColorStop(1, "rgba(40,30,20,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// --- music symbols ---------------------------------------------------------

type GlyphName = "gClef" | "fClef" | "noteheadBlack";

// A Bravura glyph as a 3D shape, 1 unit per staff space, origin at the
// glyph's own anchor (G line for the treble clef, F line for the bass
// clef, the centre line of a note head), facing +z. `depth` in staff
// spaces; high quality gets a rounded bevel.
export function glyphGeometry(name: GlyphName, depth: number, quality: RunnerQuality): THREE.BufferGeometry {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${glyphPaths[name]}" transform="scale(1,-1)"/></svg>`;
  const data = new SVGLoader().parse(svg);
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
  const u = GLYPH_UNITS_PER_SPACE;
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: depth * u,
    curveSegments: quality === "high" ? 8 : 4,
    bevelEnabled: quality === "high",
    bevelThickness: 0.05 * u,
    bevelSize: 0.03 * u,
    bevelSegments: 2,
  });
  geo.scale(1 / u, 1 / u, 1 / u);
  geo.computeVertexNormals();
  return geo;
}

// A note head centred on its own middle.
export function noteHeadGeometry(depth: number, quality: RunnerQuality): THREE.BufferGeometry {
  const geo = glyphGeometry("noteheadBlack", depth, quality);
  geo.computeBoundingBox();
  const b = geo.boundingBox as THREE.Box3;
  geo.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
  return geo;
}

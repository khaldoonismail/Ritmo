import * as THREE from "three";
import { EXPRESSIONS, INK, ROLES_BACK_TO_FRONT, VIEW, puppetArt, type Expression, type PuppetArt, type Role } from "./art";
import type { CharacterChoice } from "./choice";
import { STATE_LENGTH, pose, type State } from "./pose";

// A Ritmo character in the 3D games, as a flat 2D cut-out facing the
// camera (2.5D). The SVG parts from ./art.ts are drawn once into textures;
// each part is a flat quad that ./pose.ts moves (the same animation as the
// selection screen). Unlit, so it keeps its flat bright colours. Cheap:
// about a dozen textured quads, no per-frame drawing of SVG.
//
// Same interface as the old 3D kid: feet at y = 0, ~1.5 units tall,
// facing right (+x); update(dt, speed) runs or idles; react() plays hop,
// happy, sad or bump.

export type SpriteReaction = "jump" | "happy" | "sad" | "bump";

const HEIGHT = 1.5; // world units for the 240-unit character
const S = HEIGHT / 240;
const BASE_ORDER = 20; // drawn after the scene's opaque objects

export class SpriteCharacter {
  readonly object = new THREE.Group();
  private hips = new THREE.Group();
  private pivots: Partial<Record<Role, THREE.Group>> = {};
  private face: THREE.Mesh;
  private faceTex: Partial<Record<Expression, THREE.Texture>> = {};
  private fxStars: THREE.Mesh[] = [];
  private tear!: THREE.Mesh;
  private art: PuppetArt;
  private textures: THREE.Texture[] = [];
  private materials: THREE.Material[] = [];
  private geometry: THREE.PlaneGeometry;
  private clock = 0;
  private reaction: { state: State; t: number } | null = null;
  private expr: Expression | null = null;

  constructor(choice: CharacterChoice, resolution = 1.2) {
    this.art = puppetArt(choice);
    const art = this.art;
    const [hx, hy] = art.pivots.hips;
    this.hips.position.set(0, 0, 0);
    this.object.add(this.hips);
    // One quad size for every layer: the whole view box.
    this.geometry = new THREE.PlaneGeometry(VIEW.w * S, VIEW.h * S);
    const viewCenter = [VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2];
    // Character coords (x right, y down, feet at 240) → local world coords
    // relative to a point (px, py).
    const local = (x: number, y: number, px: number, py: number) => new THREE.Vector3((x - px) * S, -(y - py) * S, 0);

    let order = 0;
    const layer = (svg: string, parent: THREE.Object3D, px: number, py: number) => {
      const tex = svgTexture(svg, resolution);
      this.textures.push(tex);
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      this.materials.push(m);
      const mesh = new THREE.Mesh(this.geometry, m);
      mesh.position.copy(local(viewCenter[0], viewCenter[1], px, py));
      mesh.position.z = order * 0.002;
      mesh.renderOrder = BASE_ORDER + order++;
      parent.add(mesh);
      return mesh;
    };

    // hips group sits at the hip pivot (scaled / leaned there).
    this.hips.position.copy(local(hx, hy, 100, 240));
    let face: THREE.Mesh | null = null;
    for (const role of ROLES_BACK_TO_FRONT) {
      const svg = art.parts[role];
      if (!svg) continue;
      const [px, py] = art.pivots[role];
      const g = new THREE.Group();
      g.position.copy(local(px, py, hx, hy));
      this.hips.add(g);
      this.pivots[role] = g;
      layer(svg, g, px, py);
      if (role === "head") {
        face = layer(art.face("idle"), g, px, py);
        // Effects (sparkles, stars, a tear) ride on the head.
        for (let i = 0; i < 3; i++) {
          const star = this.fxQuad(starSvg(i === 1 ? "#7FE7FF" : "#FFD23F"), 28, order++);
          g.add(star);
          this.fxStars.push(star);
        }
        this.tear = this.fxQuad(tearSvg(), 26, order++);
        g.add(this.tear);
      }
    }
    this.face = face!;
    for (const e of EXPRESSIONS) {
      const t = svgTexture(art.face(e), resolution);
      this.faceTex[e] = t;
      this.textures.push(t);
    }
    this.setExpr("idle");
  }

  react(kind: SpriteReaction) {
    const r = this.reaction;
    if (r && r.state === "bump") return;
    const state: State = kind === "jump" ? "hop" : kind;
    if (state === "hop" && r && r.state !== "hop") return;
    this.reaction = { state, t: 0 };
  }

  reset() {
    this.reaction = null;
    this.object.position.y = 0;
  }

  update(dt: number, speed: number) {
    this.clock += dt;
    let state: State = speed > 0.1 ? "run" : "idle";
    let t = this.clock;
    const r = this.reaction;
    if (r) {
      r.t += dt;
      if (r.t < STATE_LENGTH[r.state]) {
        state = r.state;
        t = r.t;
      } else this.reaction = null;
    }
    const p = pose(state, t, this.clock, speed / 6);
    const deg = THREE.MathUtils.degToRad;
    const [hx, hy] = this.art.pivots.hips;
    this.hips.position.set((hx - 100 + p.x) * S, -(hy - 240 + p.y) * S, 0);
    this.hips.rotation.z = -deg(p.lean);
    this.hips.scale.set(p.sx, p.sy, 1);
    const rot = (role: Role, a: number, stretch = 1) => {
      const g = this.pivots[role];
      if (!g) return;
      g.rotation.z = -deg(a);
      g.scale.y = stretch;
    };
    rot("legF", p.legF);
    rot("legB", p.legB);
    rot("armF", p.armF, p.armStretch);
    rot("armB", p.armB, p.armStretch);
    rot("tail", p.tail);
    rot("head", p.head);
    const head = this.pivots.head;
    if (head) {
      const [, py] = this.art.pivots.head;
      head.position.y = -(py - hy + p.headY) * S;
    }
    this.setExpr(p.expr);
    this.placeFx(p.fx, t);
  }

  dispose() {
    this.textures.forEach((t) => t.dispose());
    this.materials.forEach((m) => m.dispose());
    this.geometry.dispose();
    this.fxStars.forEach((s) => s.geometry.dispose());
    this.tear.geometry?.dispose();
  }

  private setExpr(e: Expression) {
    if (e === this.expr) return;
    this.expr = e;
    const m = this.face.material as THREE.MeshBasicMaterial;
    m.map = this.faceTex[e] ?? null;
    m.needsUpdate = true;
  }

  // Positions follow ./art.ts makeFx (head-top anchor, in head-pivot coords).
  private placeFx(fx: string, t: number) {
    const head = this.art.pivots.head;
    const hide = () => {
      this.fxStars.forEach((s) => (s.visible = false));
      this.tear.visible = false;
    };
    hide();
    const top = this.art.anchors.top;
    const at = (m: THREE.Mesh, x: number, y: number, scale = 1) => {
      m.visible = true;
      m.position.set((x - head[0]) * S, -(y - head[1]) * S, 0.03);
      m.scale.setScalar(scale);
    };
    if (fx === "sparkle") {
      const k = 0.8 + Math.sin(t * 10) * 0.2;
      at(this.fxStars[0], top[0] - 70, top[1] + 34, k * 1.1);
      at(this.fxStars[1], top[0] + 74, top[1] + 18, k * 1.25);
      at(this.fxStars[2], top[0] + 44, top[1] - 26, k * 0.8);
    } else if (fx === "stars") {
      this.fxStars.forEach((s, i) => {
        const a = t * 4 + (i * Math.PI * 2) / 3;
        at(s, top[0] + Math.cos(a) * 52, top[1] - 4 + Math.sin(a) * 13, 0.9);
      });
    } else if (fx === "tear") {
      const d = (t * 30) % 26;
      at(this.tear, this.art.anchors.tear[0], this.art.anchors.tear[1] + d + 10, 1);
      (this.tear.material as THREE.MeshBasicMaterial).opacity = 1 - d / 30;
    }
  }

  private fxQuad(svg: string, size: number, order: number) {
    const tex = svgTexture(svg, 1, size, size);
    this.textures.push(tex);
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    this.materials.push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * S, size * S), m);
    mesh.renderOrder = BASE_ORDER + order;
    mesh.visible = false;
    return mesh;
  }
}

const starSvg = (c: string) =>
  `<path d="M14 2 Q16.6 11.4 26 14 Q16.6 16.6 14 26 Q11.4 16.6 2 14 Q11.4 11.4 14 2 z" fill="${c}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
const tearSvg = () => `<path d="M13 3 q-9 13 0 19 q9 -6 0 -19 z" fill="#7FD3FF" stroke="${INK}" stroke-width="2.5"/>`;

// Draws SVG markup into a texture (async: the texture fills in a moment
// after creation). `w`/`h` default to the character's view box.
function svgTexture(markup: string, scale: number, w = VIEW.w, h = VIEW.h): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 1;
  const vb = w === VIEW.w ? `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}` : `0 0 ${w} ${h}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${canvas.width}" height="${canvas.height}">${markup}</svg>`;
  const img = new Image();
  img.onload = () => {
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    tex.needsUpdate = true;
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return tex;
}

import * as THREE from "three";
import type { Accidental, Clef } from "@/lib/noteReading";
import { SpriteCharacter } from "@/components/characters/SpriteCharacter";
import { DEFAULT_CHARACTER, type CharacterChoice } from "@/components/characters/choice";
import { COLUMN_GAP, HALF, NOTE_HEAD_WIDTH, createHead, layoutHeads, type HeadParts } from "./noteHeads";
import {
  Materials,
  PALETTE,
  glyphGeometry,
  hollowNoteHeadGeometry,
  noteHeadGeometry,
  paperTexture,
  skyTexture,
  softShadowTexture,
} from "./look";
import type { RunnerQuality } from "./quality";
import { buildScenery } from "./scenery";

// The 3D part of Note Runner, in plain Three.js: a side view, like a page
// of a music book. The staff is an upright sheet of paper with five
// horizontal lines and the clef at its left edge; the runner runs left to
// right in front of it. Every line and space of the level's range is a
// lane (top of the screen = higher note), and the lane the runner is on is
// highlighted across the page. Each gate brings four hollow note heads,
// drawn on their exact lines/spaces with proper ledger lines; the runner
// must be on the right one when it arrives. The camera looks straight at
// the page (only a slight downward tilt, never a turn), so staff lines
// always stay horizontal on screen.
//
// Readability first: paper, staff lines, clef and note heads are drawn in
// solid ink and unlit paper, so lighting never dims them; decoration sits
// behind the page or below it.
//
// Two quality levels (./quality.ts): "high" adds toon shading, more
// scenery, beveled symbols and soft shadows; "low" keeps the same game with
// fewer extras and fewer pixels. If frames get slow on "high", the extras
// are hidden; if still slow, fewer pixels are drawn.
//
// The React component owns the rules (score, lives, which note is next);
// this class only draws, moves the gates and reports when a gate arrives.

// World units: one staff space = 1. Staff position p (half-spaces from the
// bottom line, as in lib/noteReading.ts) sits at y = baseY + p / 2.
const RUNNER_X = 0;
const RUNNER_Z = 0.45;
// The gate stops with its note heads just ahead of the runner, so the
// answer shows right next to it.
const HEADS_AHEAD = 1.35;
const PAGE_WIDTH = 400;
const RUNNER_SCREEN_X = 0.2; // runner's place across the screen (0 = left edge)
const MAX_HEADS = 4;

export interface RunnerLayout {
  // Staff position of each lane, top to bottom.
  lanes: number[];
  // Lowest and highest staff positions the page shows.
  range: [number, number];
}

type GateHead = HeadParts;

interface Gate {
  group: THREE.Group;
  heads: GateHead[];
  positions: number[];
  active: boolean; // coming toward the runner, not yet arrived
  visible: boolean;
  stopped: boolean; // arrived: stays by the runner until the next gate
  stopX: number; // where it stops (further right when it has ♯/♭ signs)
}

export interface RunnerEngineEvents {
  // A gate arrived; `position` is the staff position the runner was on (or
  // moving to).
  onGateReached: (position: number) => void;
  // The pause after a gate is over; time for the next one.
  onNeedGate: () => void;
}

export class RunnerEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  private clock = new THREE.Clock(false);
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private materials: Materials;

  private layout: RunnerLayout;
  private quality: RunnerQuality;
  private baseY: number;
  private movers: THREE.Object3D[] = []; // scenery that scrolls and wraps
  private decor: THREE.Object3D[] = []; // extras hidden when frames are slow
  private moverSpan = 60;
  private gates: Gate[] = [];
  private character: SpriteCharacter;
  private lineHighlight!: THREE.Mesh;
  private spaceHighlight!: THREE.Mesh;
  private shadow: THREE.Mesh | null = null;
  private clefs: Partial<Record<Clef, THREE.Mesh>> = {};

  private inkMat = new THREE.MeshBasicMaterial({ color: PALETTE.ink });
  private headMat: THREE.Material;
  private correctMat: THREE.Material;
  private wrongMat: THREE.Material;
  private flash: { head: GateHead; t: number } | null = null;

  private speed = 6;
  private lane = 0;
  private runnerY = 0;
  private running = false;
  private gapLeft: number | null = null;
  private shake = 0;
  private gateStartX = 20;
  private viewLeft = -6;
  private topReserved = 0;
  private cameraBase = new THREE.Vector3();
  private lastReached: Gate | null = null;

  private pixelRatio: number;
  private frameAccum = 0;
  private frameCount = 0;

  constructor(
    container: HTMLElement,
    layout: RunnerLayout,
    private events: RunnerEngineEvents,
    quality: RunnerQuality = "high",
    // The runner the child picked (a flat 2D Ritmo character, 2.5D).
    character: CharacterChoice = DEFAULT_CHARACTER
  ) {
    this.container = container;
    this.layout = layout;
    this.quality = quality;
    this.materials = new Materials(quality);
    this.headMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    this.correctMat = new THREE.MeshLambertMaterial({ color: PALETTE.correct, emissive: 0x0d3d1e });
    this.wrongMat = new THREE.MeshLambertMaterial({ color: PALETTE.wrong, emissive: 0x3d0d0d });
    // Lowest shown position sits a little above the ground.
    this.baseY = 1.3 - layout.range[0] * HALF;
    this.lane = this.middleLane();
    this.runnerY = this.laneY(this.lane);

    const dpr = window.devicePixelRatio || 1;
    this.pixelRatio = quality === "high" ? Math.min(dpr, 1.5) : Math.min(dpr, 1);
    this.renderer = new THREE.WebGLRenderer({
      antialias: quality === "high" && dpr < 1.5,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    container.appendChild(canvas);

    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(new THREE.Color(PALETTE.skyHorizon), 45, 120);
    // Soft daylight: sky/grass bounce plus a warm sun from the upper left.
    this.scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x86c97a, quality === "high" ? 1.25 : 1.6));
    const sun = new THREE.DirectionalLight(0xfff1d6, quality === "high" ? 1.9 : 1.3);
    sun.position.set(-5, 9, 7);
    this.scene.add(sun);

    this.buildWorld();
    this.character = new SpriteCharacter(character, quality === "high" ? 1.2 : 0.8);
    this.scene.add(this.character.object);
    for (let i = 0; i < 2; i++) this.gates.push(this.buildGate());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.renderOnce();
  }

  // --- public API -------------------------------------------------------

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    this.clock.stop();
    this.renderer.setAnimationLoop(null);
    this.render();
  }

  get currentQuality(): RunnerQuality {
    return this.quality;
  }

  // Sends a new gate in from the right with hollow note heads at these
  // staff positions (each with `accidental` in front, if any); it arrives
  // in `seconds`.
  spawnGate(positions: number[], accidental: Accidental, seconds: number) {
    // The answered gate scrolls away with the page instead of vanishing.
    for (const g of this.gates) g.stopped = false;
    const gate = this.gates.find((g) => !g.visible) ?? this.gates[0];
    gate.positions = positions;
    const reach = layoutHeads(gate.heads, positions, accidental, (p) => this.posY(p), this.headMat);
    // Stop with the whole drawing (signs too) clear of the runner.
    gate.stopX = RUNNER_X + Math.max(HEADS_AHEAD, reach + 0.75);
    this.speed = (this.gateStartX - gate.stopX) / seconds;
    gate.group.position.x = this.gateStartX;
    gate.group.visible = true;
    gate.visible = true;
    gate.active = true;
    gate.stopped = false;
  }

  // Shows the answer on the gate that just arrived and starts the pause
  // before the next gate. Right: that note head fills in. Wrong: the right
  // one flashes green (and the one the runner chose, if any, turns red).
  showResult(answer: number, picked: number, gapSeconds: number) {
    const gate = this.lastReached;
    if (gate) {
      const right = gate.heads[gate.positions.indexOf(answer)];
      if (answer === picked) {
        if (right) this.fill(right, this.headMat);
      } else {
        if (right) {
          this.fill(right, this.correctMat);
          this.flash = { head: right, t: 0 };
        }
        const chosen = gate.heads[gate.positions.indexOf(picked)];
        if (chosen) this.fill(chosen, this.wrongMat);
      }
    }
    if (answer === picked) {
      this.character.react("happy");
    } else {
      this.character.react("sad");
      this.shake = 0.35;
    }
    this.gapLeft = gapSeconds;
  }

  // dir -1 = one lane up (higher), +1 = one lane down.
  moveLane(dir: -1 | 1) {
    this.setLane(this.lane + dir);
  }

  setLane(lane: number) {
    const next = Math.max(0, Math.min(this.layout.lanes.length - 1, lane));
    if (next !== this.lane && this.running) this.character.react("jump");
    this.lane = next;
    if (!this.running) {
      this.runnerY = this.laneY(this.lane);
      this.renderOnce();
    }
  }

  // Moves to a staff position (e.g. a tapped note head).
  setPosition(position: number) {
    const i = this.layout.lanes.indexOf(position);
    if (i >= 0) this.setLane(i);
  }

  get position(): number {
    return this.layout.lanes[this.lane];
  }

  // The lane nearest a tap at this screen y (client coordinates). Taps on
  // a note head pick that head's line/space.
  laneAtClientY(clientY: number): number {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    let best = this.lane;
    let bestDist = Infinity;
    for (let i = 0; i < this.layout.lanes.length; i++) {
      const p = new THREE.Vector3(RUNNER_X, this.laneY(i), RUNNER_Z).project(this.camera);
      const d = Math.abs(p.y - ndcY);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  // Which clef the page shows (mixed games switch per gate).
  setClef(clef: Clef) {
    for (const [c, mesh] of Object.entries(this.clefs)) if (mesh) mesh.visible = c === clef;
    if (!this.running) this.render();
  }

  // Pixels at the top covered by the name card: the lanes are fitted
  // below it.
  setTopReserved(px: number) {
    if (Math.abs(px - this.topReserved) < 2) return;
    this.topReserved = px;
    this.resize();
  }

  // Back to the start: middle line, no gates.
  reset() {
    this.lane = this.middleLane();
    this.runnerY = this.laneY(this.lane);
    this.gates.forEach((g) => this.hideGate(g));
    this.gapLeft = null;
    this.shake = 0;
    this.flash = null;
    this.lastReached = null;
    this.character.reset();
    this.renderOnce();
  }

  // Draws one frame without running.
  renderOnce() {
    this.placeRunner(0);
    this.render();
  }

  // For tests: each visible note head's intended staff position, where it
  // is actually drawn (computed back from its world y), and where its
  // ledger lines are drawn, also as staff positions.
  debugHeads(): { position: number; drawnAt: number; ledgers: number[] }[] {
    const out: { position: number; drawnAt: number; ledgers: number[] }[] = [];
    const toPos = (y: number) => Math.round(((y - this.baseY) / HALF) * 1000) / 1000;
    for (const g of this.gates) {
      if (!g.visible) continue;
      g.heads.forEach((h, i) => {
        if (!h.group.visible) return;
        const world = new THREE.Vector3();
        h.hollow.getWorldPosition(world);
        out.push({
          position: g.positions[i],
          drawnAt: toPos(world.y),
          ledgers: h.ledgers
            .filter((l) => l.visible)
            .map((l) => toPos(l.getWorldPosition(new THREE.Vector3()).y)),
        });
      });
    }
    return out;
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.character.dispose();
    const textures = new Set<THREE.Texture>();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      const list = Array.isArray(m) ? m : m ? [m] : [];
      for (const x of list) {
        const map = (x as THREE.MeshBasicMaterial).map;
        if (map) textures.add(map);
        x.dispose();
      }
    });
    textures.forEach((t) => t.dispose());
    (this.scene.background as THREE.Texture | null)?.dispose?.();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // --- loop -------------------------------------------------------------

  private tick() {
    const rawDt = this.clock.getDelta();
    this.trackFrameTime(rawDt);
    const dt = Math.min(rawDt, 0.05); // a hiccup never teleports a gate past the runner
    const travel = this.speed * dt;

    for (const m of this.movers) {
      m.position.x -= travel * (m.userData.parallax ?? 1);
      const span = m.userData.span ?? this.moverSpan;
      if (m.position.x < this.viewLeft - (m.userData.margin ?? 6)) m.position.x += span;
    }

    for (const g of this.gates) {
      if (!g.visible || g.stopped) continue;
      g.group.position.x -= travel;
      if (g.active && g.group.position.x <= g.stopX) {
        g.group.position.x = g.stopX;
        g.active = false;
        g.stopped = true;
        this.lastReached = g;
        this.events.onGateReached(this.position);
      }
      // An answered gate slides off briefly, then vanishes before its heads
      // and signs reach the runner and the clef.
      if (!g.active && !g.stopped && g.group.position.x < g.stopX - 1.1) this.hideGate(g);
    }

    if (this.flash) {
      this.flash.t += dt;
      const on = Math.floor(this.flash.t * 6) % 2 === 0;
      this.flash.head.filled.visible = on;
      this.flash.head.hollow.visible = !on;
      if (this.flash.t > 1.5) {
        this.flash.head.filled.visible = true;
        this.flash.head.hollow.visible = false;
        this.flash = null;
      }
    }

    if (this.gapLeft !== null) {
      this.gapLeft -= dt;
      if (this.gapLeft <= 0) {
        this.gapLeft = null;
        this.events.onNeedGate();
      }
    }

    this.placeRunner(dt);
    this.render();
  }

  private placeRunner(dt: number) {
    const targetY = this.laneY(this.lane);
    this.runnerY = dt > 0 ? this.runnerY + (targetY - this.runnerY) * Math.min(1, dt * 16) : targetY;
    this.character.update(dt, this.speed);
    // Body centred on the lane (feet ~0.7 spaces below it).
    this.character.object.position.set(RUNNER_X, this.runnerY - 0.7, RUNNER_Z);
    if (this.shadow) this.shadow.position.set(RUNNER_X + 0.35, this.runnerY - 0.55, 0.01);

    // Highlight the runner's line (a coloured stripe over it) or space (a
    // soft band between its lines), across the whole page.
    const onLine = this.position % 2 === 0;
    this.lineHighlight.visible = onLine;
    this.spaceHighlight.visible = !onLine;
    this.lineHighlight.position.y = targetY;
    this.spaceHighlight.position.y = targetY;

    this.shake = Math.max(0, this.shake - dt);
    const s = this.shake * 0.12;
    this.camera.position.set(
      this.cameraBase.x + (s ? (Math.random() - 0.5) * s : 0),
      this.cameraBase.y + (s ? (Math.random() - 0.5) * s : 0),
      this.cameraBase.z
    );
  }

  private trackFrameTime(dt: number) {
    if (dt <= 0 || dt > 0.5) return;
    this.frameAccum += dt;
    this.frameCount++;
    if (this.frameAccum < 2) return;
    const avg = this.frameAccum / this.frameCount;
    this.frameAccum = 0;
    this.frameCount = 0;
    if (avg <= 1 / 40) return; // 40 fps or better: fine
    if (this.quality === "high") {
      // First step down: hide the extras, draw at most 1 pixel per CSS pixel.
      this.quality = "low";
      this.decor.forEach((o) => (o.visible = false));
      this.pixelRatio = Math.min(this.pixelRatio, 1);
    } else if (this.pixelRatio > 0.75) {
      this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25);
    } else {
      return;
    }
    this.renderer.setPixelRatio(this.pixelRatio);
    this.resize();
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }

  // --- layout -----------------------------------------------------------

  private posY(position: number) {
    return this.baseY + position * HALF;
  }

  private laneY(i: number) {
    return this.posY(this.layout.lanes[i]);
  }

  private middleLane() {
    // Start on the middle line of the staff.
    const i = this.layout.lanes.indexOf(4);
    return i >= 0 ? i : Math.floor((this.layout.lanes.length - 1) / 2);
  }

  // Fits the page's lanes between the name card and the bottom of the
  // screen, with the runner a fifth of the way across (clear of the clef).
  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    const [lo, hi] = this.layout.range;
    const spanLo = this.posY(lo) - 0.9; // room for the runner's body below and above
    const spanHi = this.posY(hi) + 1.1;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const top = Math.min(this.topReserved, h * 0.45);
    const usable = Math.max(80, h - top - 12);
    // World height visible at the page = span × (screen height / usable).
    const visibleH = ((spanHi - spanLo) * h) / usable;
    const dist = Math.max(8, visibleH / 2 / tan);
    const halfH = dist * tan;
    const halfW = halfH * aspect;
    // Put the span's middle at the middle of the usable area.
    const unitsPerPx = (2 * halfH) / h;
    const centerY = (spanLo + spanHi) / 2 + (top / 2 - 6) * unitsPerPx;
    const runnerFromLeft = Math.max(2 * halfW * RUNNER_SCREEN_X, 4.5);
    const centerX = RUNNER_X - runnerFromLeft + halfW;

    // A little above, looking slightly down (no turn or tilt sideways, so
    // the staff lines stay horizontal): shows the page's thickness and the
    // ground in front, for depth.
    this.cameraBase.set(centerX, centerY + dist * 0.16, dist + RUNNER_Z);
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(centerX, centerY, 0);
    this.camera.updateMatrixWorld();

    this.viewLeft = centerX - halfW;
    this.gateStartX = centerX + halfW + 1.5 - RUNNER_X;
    this.moverSpan = Math.max(60, 2 * halfW + 16);
    for (const c of Object.values(this.clefs)) if (c) c.position.x = this.viewLeft + 0.75;
    if (!this.running) this.render();
  }

  // --- building ---------------------------------------------------------

  private buildWorld() {
    const high = this.quality === "high";
    const mat = this.materials;
    const [lo, hi] = this.layout.range;
    const pageBottom = this.posY(lo) - 0.9;
    const pageTop = this.posY(hi) + 1.1;
    const pageH = pageTop - pageBottom;

    // Ground: grass with a darker strip along the front.
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_WIDTH, 90), mat.get(PALETTE.grass));
    grass.rotation.x = -Math.PI / 2;
    grass.position.z = -20;
    this.scene.add(grass);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_WIDTH, 0.8), mat.get(PALETTE.grassDark));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.005, 0.5);
    this.scene.add(strip);

    // The page: a thick sheet of paper on wooden posts. The face is unlit
    // (paper texture only), so the staff is equally clear everywhere.
    const paper = paperTexture(this.quality);
    paper.repeat.set(PAGE_WIDTH / 7, pageH / 7);
    const face = new THREE.MeshBasicMaterial({ map: paper });
    const edge = mat.get(PALETTE.paperEdge);
    const page = new THREE.Mesh(new THREE.BoxGeometry(PAGE_WIDTH, pageH, 0.14), [edge, edge, edge, edge, face, face]);
    page.position.set(0, (pageTop + pageBottom) / 2, -0.07);
    this.scene.add(page);
    const postGeo = new THREE.CylinderGeometry(0.13, 0.15, pageBottom + 0.3, 8);
    for (let x = -12; x < 60; x += 8) {
      const post = new THREE.Mesh(postGeo, mat.get(PALETTE.wood));
      post.position.set(x, (pageBottom + 0.3) / 2, -0.25);
      this.scene.add(post);
      this.movers.push(post);
    }

    // Five staff lines in solid ink, and very faint guides where ledger
    // lines would go, so each lane above/below the staff can be seen.
    const guide = new THREE.MeshBasicMaterial({ color: 0xe2d8c4 });
    const lineGeo = new THREE.PlaneGeometry(PAGE_WIDTH, 0.075);
    const guideGeo = new THREE.PlaneGeometry(PAGE_WIDTH, 0.035);
    for (let p = lo; p <= hi; p++) {
      if (p % 2 !== 0) continue;
      const onStaff = p >= 0 && p <= 8;
      const line = new THREE.Mesh(onStaff ? lineGeo : guideGeo, onStaff ? this.inkMat : guide);
      line.position.set(0, this.posY(p), 0.005);
      this.scene.add(line);
    }

    // The runner's line/space highlight (see placeRunner).
    this.lineHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(PAGE_WIDTH, 0.24),
      new THREE.MeshBasicMaterial({ color: PALETTE.marker, transparent: true, opacity: 0.45, depthWrite: false })
    );
    this.lineHighlight.position.z = 0.007;
    this.spaceHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(PAGE_WIDTH, 0.86),
      new THREE.MeshBasicMaterial({ color: PALETTE.marker, transparent: true, opacity: 0.14, depthWrite: false })
    );
    this.spaceHighlight.position.z = 0.003;
    this.scene.add(this.lineHighlight, this.spaceHighlight);

    // Bar lines across the staff scroll by to show the speed.
    const barGeo = new THREE.PlaneGeometry(0.06, 4);
    const barMat = new THREE.MeshBasicMaterial({ color: 0xa69a82 });
    for (let x = -10; x < 60; x += 7.5) {
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(x, this.posY(4), 0.004);
      this.scene.add(bar);
      this.movers.push(bar);
    }

    this.buildScenery(pageTop, pageBottom);

    // The clef stays at the left edge of the page, as a solid 3D symbol.
    // Both are built so mixed games just switch.
    const clefMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    for (const clef of ["treble", "bass"] as Clef[]) {
      const geo = glyphGeometry(clef === "treble" ? "gClef" : "fClef", 0.14, this.quality);
      const mesh = new THREE.Mesh(geo, clefMat);
      mesh.position.set(0, this.posY(clef === "treble" ? 2 : 6), 0.02);
      mesh.visible = clef === "treble";
      this.scene.add(mesh);
      this.clefs[clef] = mesh;
    }

    // High quality: a soft shadow on the page behind the runner.
    if (high) {
      this.shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.55),
        new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false, opacity: 0.55 })
      );
      this.scene.add(this.shadow);
      this.decor.push(this.shadow);
    }
  }

  // Hills, clouds, trees and bushes (shared with Up or Down: ./scenery.ts).
  private buildScenery(pageTop: number, pageBottom: number) {
    buildScenery(this.materials, this.quality, pageTop, pageBottom, (o, parallax, decor, span, margin) => {
      o.userData.parallax = parallax;
      if (span) o.userData.span = span;
      if (margin) o.userData.margin = margin;
      this.scene.add(o);
      this.movers.push(o);
      if (decor) this.decor.push(o);
    });
  }

  // A gate: a column of up to four note heads, each with its own ledger
  // lines and ♯/♭, plus a faint bar line behind them.
  private buildGate(): Gate {
    const group = new THREE.Group();
    const [lo, hi] = this.layout.range;
    const bar = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.07, this.posY(hi) - this.posY(lo) + 0.6, 3, 8),
      this.materials.get(PALETTE.gate)
    );
    bar.position.set(COLUMN_GAP + 1.0, (this.posY(hi) + this.posY(lo)) / 2, 0.05);
    group.add(bar);

    const hollowGeo = hollowNoteHeadGeometry(0.2, this.quality);
    const filledGeo = noteHeadGeometry(0.2, this.quality);
    const ledgerGeo = new THREE.PlaneGeometry(NOTE_HEAD_WIDTH + 0.6, 0.075);
    const sharpGeo = glyphGeometry("accidentalSharp", 0.12, this.quality);
    const flatGeo = glyphGeometry("accidentalFlat", 0.12, this.quality);
    const geos = { hollow: hollowGeo, filled: filledGeo, ledger: ledgerGeo, sharp: sharpGeo, flat: flatGeo };
    const heads: GateHead[] = [];
    for (let i = 0; i < MAX_HEADS; i++) {
      const head = createHead(geos, this.headMat, this.inkMat);
      group.add(head.group);
      heads.push(head);
    }
    group.visible = false;
    this.scene.add(group);
    return { group, heads, positions: [], active: false, visible: false, stopped: false, stopX: HEADS_AHEAD };
  }

  private fill(h: GateHead, material: THREE.Material) {
    h.filled.material = material;
    h.filled.visible = true;
    h.hollow.visible = false;
  }

  private hideGate(g: Gate) {
    g.group.visible = false;
    g.visible = false;
    g.active = false;
    g.stopped = false;
    if (this.flash && g.heads.includes(this.flash.head)) this.flash = null;
  }
}

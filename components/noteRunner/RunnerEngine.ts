import * as THREE from "three";
import type { Clef } from "@/lib/noteReading";
import { CartoonRunner, type RunnerCharacter } from "./character";
import {
  Materials,
  PALETTE,
  glyphGeometry,
  noteHeadGeometry,
  paperTexture,
  skyTexture,
  softShadowTexture,
} from "./look";
import type { RunnerQuality } from "./quality";

// The 3D part of Note Runner, in plain Three.js: a side view, like a page
// of a music book. The staff is an upright sheet of paper with five
// horizontal lines; the runner runs left to right in front of it, and each
// lane is a line or a space of the staff (top of the screen = higher
// note). Gates come from the right. The camera looks straight at the page
// (only a slight downward tilt, never a turn), so staff lines always stay
// horizontal on screen; depth comes from the 3D runner, gates, trees,
// hills and clouds.
//
// Readability first: the paper, staff lines, clef and gate signs are drawn
// unlit or in solid ink so lighting never dims them; decoration sits behind
// the page or below it.
//
// Two quality levels (./quality.ts): "high" adds toon shading, more
// scenery, beveled symbols and soft shadows; "low" keeps the same game with
// fewer extras and fewer pixels. If frames get slow on "high", the extras
// are hidden; if still slow, fewer pixels are drawn.
//
// The React component owns the rules (score, lives, which note is next);
// this class only draws, moves the gates and reports when a gate reaches
// the runner.

// World units: one staff space = 1. Staff position p (half-spaces from the
// bottom line, as in lib/noteReading.ts) sits at y = baseY + p / 2.
const HALF = 0.5;
const RUNNER_X = 0;
const RUNNER_Z = 0.45;
const PANEL_Z = 0.14;
const PAGE_WIDTH = 400;
const RUNNER_SCREEN_X = 0.2; // runner's place across the screen (0 = left edge)

export interface RunnerLayout {
  // Staff position of each lane, top to bottom.
  lanes: number[];
  // Lowest and highest staff positions the page shows.
  range: [number, number];
  // Find-the-note mode draws the clef on the page and uses bar-line gates
  // with no signs; Name-the-note mode uses signed gates and no clef.
  mode: "name" | "find";
}

interface Gate {
  group: THREE.Group;
  panels: { mesh: THREE.Mesh; canvas: HTMLCanvasElement; texture: THREE.CanvasTexture }[];
  labels: string[];
  active: boolean;
  visible: boolean;
}

export interface RunnerEngineEvents {
  // A gate reached the runner; `lane` is the lane the runner was in (or
  // moving into).
  onGateReached: (lane: number) => void;
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
  private character: RunnerCharacter;
  private marker!: THREE.Mesh;
  private shadow: THREE.Mesh | null = null;
  private clefs: Partial<Record<Clef, THREE.Mesh>> = {};
  private clef: Clef = "treble";
  private resultMarks: THREE.Mesh[] = [];
  private resultMarksLeft = 0;

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
    quality: RunnerQuality = "high"
  ) {
    this.container = container;
    this.layout = layout;
    this.quality = quality;
    this.materials = new Materials(quality);
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
    this.character = new CartoonRunner(this.materials);
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

  // Sends a new gate in from the right; it reaches the runner in
  // `seconds`. `labels` are the lane signs (name mode) or null (find mode).
  spawnGate(labels: string[] | null, seconds: number) {
    this.speed = this.gateStartX / seconds;
    const gate = this.gates.find((g) => !g.visible) ?? this.gates[0];
    gate.labels = labels ?? [];
    gate.panels.forEach((p, i) => this.drawPanel(p, labels?.[i] ?? "", "normal"));
    gate.group.position.x = this.gateStartX;
    gate.group.visible = true;
    gate.visible = true;
    gate.active = true;
  }

  // Shows the answer and starts the pause before the next gate.
  showResult(correctLane: number, pickedLane: number, gapSeconds: number) {
    const gate = this.lastReached;
    if (gate && this.layout.mode === "name") {
      gate.panels.forEach((p, i) => {
        if (i === correctLane) this.drawPanel(p, gate.labels[i], "correct");
        else if (i === pickedLane) this.drawPanel(p, gate.labels[i], "wrong");
      });
    }
    if (this.layout.mode === "find") {
      // Green note head on the right line/space (red on the wrong one),
      // just ahead of the runner, where the student is looking.
      const [ok, bad] = this.resultMarks;
      ok.position.y = this.laneY(correctLane);
      ok.visible = true;
      bad.visible = pickedLane !== correctLane;
      bad.position.y = this.laneY(pickedLane);
      this.resultMarksLeft = 1.6;
    }
    if (correctLane === pickedLane) {
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

  // The lane nearest a tap at this screen y (client coordinates).
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

  // Find mode: which clef the page shows (mixed games switch per gate).
  setClef(clef: Clef) {
    this.clef = clef;
    for (const [c, mesh] of Object.entries(this.clefs)) if (mesh) mesh.visible = c === clef;
    if (!this.running) this.render();
  }

  // Pixels at the top covered by the note card: the lanes are fitted
  // below it.
  setTopReserved(px: number) {
    if (Math.abs(px - this.topReserved) < 2) return;
    this.topReserved = px;
    this.resize();
  }

  // Back to the start: middle lane, no gates.
  reset() {
    this.lane = this.middleLane();
    this.runnerY = this.laneY(this.lane);
    for (const g of this.gates) {
      g.group.visible = false;
      g.visible = false;
      g.active = false;
    }
    this.gapLeft = null;
    this.shake = 0;
    this.lastReached = null;
    this.resultMarks.forEach((m) => (m.visible = false));
    this.resultMarksLeft = 0;
    this.character.reset();
    this.renderOnce();
  }

  // Draws one frame without running.
  renderOnce() {
    this.placeRunner(0);
    this.render();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
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
      if (!g.visible) continue;
      g.group.position.x -= travel;
      if (g.active && g.group.position.x <= RUNNER_X) {
        g.active = false;
        this.lastReached = g;
        this.events.onGateReached(this.lane);
      }
      if (g.group.position.x < this.viewLeft - 3) {
        g.group.visible = false;
        g.visible = false;
      }
    }

    if (this.resultMarksLeft > 0) {
      this.resultMarksLeft -= dt;
      if (this.resultMarksLeft <= 0) this.resultMarks.forEach((m) => (m.visible = false));
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
    this.marker.position.set(RUNNER_X + 0.05, this.runnerY, 0.012);
    if (this.shadow) this.shadow.position.set(RUNNER_X + 0.35, this.runnerY - 0.55, 0.01);

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
    return Math.floor((this.layout.lanes.length - 1) / 2);
  }

  // Fits the page's lanes between the note card and the bottom of the
  // screen, with the runner a fifth of the way across.
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
    // Runner a fifth of the way across; in find mode at least clear of the
    // clef at the left edge, even on narrow screens.
    const runnerFromLeft = Math.max(2 * halfW * RUNNER_SCREEN_X, this.layout.mode === "find" ? 4.5 : 0);
    const centerX = RUNNER_X - runnerFromLeft + halfW;

    // A little above, looking slightly down (no turn or tilt sideways, so
    // the staff lines stay horizontal): shows the page's thickness and the
    // ground in front, for depth.
    this.cameraBase.set(centerX, centerY + dist * 0.16, dist + RUNNER_Z);
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(centerX, centerY, 0);
    this.camera.updateMatrixWorld();

    this.viewLeft = centerX - halfW;
    this.gateStartX = centerX + halfW + 1.2 - RUNNER_X;
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

    // Five staff lines in solid ink, and faint guides where ledger lines
    // would go (find mode only, so each lane above/below the staff shows).
    const ink = new THREE.MeshBasicMaterial({ color: PALETTE.ink });
    const guide = new THREE.MeshBasicMaterial({ color: 0xcdbfa6 });
    const lineGeo = new THREE.PlaneGeometry(PAGE_WIDTH, 0.075);
    const guideGeo = new THREE.PlaneGeometry(PAGE_WIDTH, 0.045);
    for (let p = lo; p <= hi; p++) {
      if (p % 2 !== 0) continue;
      const onStaff = p >= 0 && p <= 8;
      if (!onStaff && this.layout.mode !== "find") continue;
      const line = new THREE.Mesh(onStaff ? lineGeo : guideGeo, onStaff ? ink : guide);
      line.position.set(0, this.posY(p), 0.005);
      this.scene.add(line);
    }

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

    // Find mode: the clef stays at the left edge of the page, as a solid
    // 3D symbol. Both clefs are built so mixed games just switch.
    if (this.layout.mode === "find") {
      const clefMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
      for (const clef of ["treble", "bass"] as Clef[]) {
        const geo = glyphGeometry(clef === "treble" ? "gClef" : "fClef", 0.14, this.quality);
        const mesh = new THREE.Mesh(geo, clefMat);
        mesh.position.set(0, this.posY(clef === "treble" ? 2 : 6), 0.02);
        mesh.visible = clef === this.clef;
        this.scene.add(mesh);
        this.clefs[clef] = mesh;
      }

      // Note heads that show the answer next to the runner.
      const headGeo = noteHeadGeometry(0.22, this.quality);
      for (const color of [PALETTE.correct, PALETTE.wrong]) {
        const m = new THREE.Mesh(headGeo, mat.fresh(color));
        m.position.set(RUNNER_X + 1.15, 0, 0.3);
        m.visible = false;
        this.scene.add(m);
        this.resultMarks.push(m);
      }
    }

    // The runner's place on the staff: a soft blue note head behind it.
    this.marker = new THREE.Mesh(
      noteHeadGeometry(0.01, "low"),
      new THREE.MeshBasicMaterial({ color: PALETTE.marker, transparent: true, opacity: 0.22, depthWrite: false })
    );
    this.marker.scale.setScalar(1.15);
    this.scene.add(this.marker);

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

  // Hills and clouds far behind, cartoon trees behind the page (peeking
  // over it) and bushes in front. "low" keeps a few trees and clouds.
  private buildScenery(pageTop: number, pageBottom: number) {
    const high = this.quality === "high";
    const mat = this.materials;
    const add = (o: THREE.Object3D, parallax: number, decor: boolean, span?: number, margin?: number) => {
      o.userData.parallax = parallax;
      if (span) o.userData.span = span;
      if (margin) o.userData.margin = margin;
      this.scene.add(o);
      this.movers.push(o);
      if (decor) this.decor.push(o);
    };

    // Rolling hills (high only).
    if (high) {
      const hillGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      for (let i = 0; i < 8; i++) {
        const far = i % 2 === 0;
        const hill = new THREE.Mesh(hillGeo, mat.get(far ? PALETTE.hillFar : PALETTE.hillNear));
        const r = far ? 16 + (i % 3) * 4 : 11 + (i % 3) * 3;
        hill.scale.set(r, (pageTop + 3) * (far ? 0.55 : 0.4) + (i % 3), r * 0.5);
        hill.position.set(-30 + i * 14, 0, far ? -38 : -26);
        add(hill, far ? 0.15 : 0.25, true, 112, 22);
      }
    }

    // Clouds: a few overlapping puffs each.
    const puff = new THREE.SphereGeometry(1, high ? 12 : 8, high ? 8 : 6);
    const cloudCount = high ? 6 : 3;
    for (let i = 0; i < cloudCount; i++) {
      const cloud = new THREE.Group();
      const n = 3 + (i % 3);
      for (let j = 0; j < n; j++) {
        const p = new THREE.Mesh(puff, mat.get(PALETTE.cloud));
        const s = 1.1 + ((i + j) % 3) * 0.4;
        p.scale.set(s * 1.2, s * 0.8, s * 0.7);
        p.position.set(j * 1.4 - n * 0.7, ((j * 7) % 3) * 0.3, 0);
        cloud.add(p);
      }
      cloud.position.set(-20 + i * (90 / cloudCount), pageTop + 4.5 + (i % 3) * 1.6, -30);
      add(cloud, 0.1, i >= 3, 96, 14);
    }

    // Trees: round leafy ones and pines, behind the page.
    const blob = new THREE.IcosahedronGeometry(1, high ? 1 : 0);
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1, 7);
    const cone = new THREE.ConeGeometry(1, 1.6, high ? 8 : 6);
    let k = 0;
    const step = high ? 3.2 : 5;
    for (let x = -10; x < 60; x += step) {
      const tree = new THREE.Group();
      const height = pageTop + 0.3 + ((k * 7) % 5) * 0.4;
      const trunk = new THREE.Mesh(trunkGeo, mat.get(PALETTE.wood));
      trunk.scale.y = height;
      trunk.position.y = height / 2;
      tree.add(trunk);
      if (k % 3 === 2) {
        for (let t = 0; t < 3; t++) {
          const c = new THREE.Mesh(cone, mat.get(PALETTE.pine));
          const s = 1.5 - t * 0.35;
          c.scale.set(s, s, s);
          c.position.y = height + 0.4 + t * 0.85;
          tree.add(c);
        }
      } else {
        const crowns: [number, number, number, number][] = [
          [0, 1.0, 0, 1.35],
          [-0.75, 0.55, 0.2, 0.95],
          [0.8, 0.6, -0.1, 1.0],
        ];
        crowns.forEach(([cx, cy, cz, s], j) => {
          const c = new THREE.Mesh(blob, mat.get(j === 0 ? PALETTE.leaf : PALETTE.leafLight));
          c.scale.setScalar(s);
          c.position.set(cx, height + cy, cz);
          tree.add(c);
        });
      }
      tree.position.set(x + ((k * 13) % 3) * 0.6, 0, -2.6 - ((k * 5) % 4));
      add(tree, 0.8, false);

      // Bushes in front of the page, below the staff (high only).
      if (high && k % 2 === 0) {
        const bush = new THREE.Group();
        for (let b = 0; b < 3; b++) {
          const p = new THREE.Mesh(blob, mat.get(b === 1 ? PALETTE.leafLight : PALETTE.leaf));
          const s = 0.35 + (b === 1 ? 0.12 : 0);
          p.scale.setScalar(s);
          p.position.set((b - 1) * 0.42, s * 0.6, 0);
          bush.add(p);
        }
        bush.scale.y = Math.min(1, (pageBottom * 0.9) / 0.6);
        bush.position.set(x + 1.6, 0, 1.4);
        add(bush, 1.15, true);
      }
      k++;
    }
  }

  private buildGate(): Gate {
    const group = new THREE.Group();
    const { lanes, mode, range } = this.layout;
    const mat = this.materials.get(PALETTE.gate);
    const panels: Gate["panels"] = [];

    if (mode === "name") {
      // A post spanning the lanes with one sign per lane.
      const top = this.posY(lanes[0]) + 0.55;
      const bottom = this.posY(lanes[lanes.length - 1]) - 0.55;
      const post = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, top - bottom, 3, 8), mat);
      post.position.set(0.95, (top + bottom) / 2, PANEL_Z - 0.05);
      group.add(post);
      const panelGeo = new THREE.PlaneGeometry(1.75, 0.88);
      lanes.forEach((_, i) => {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 128;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        const mesh = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
        mesh.position.set(0, this.laneY(i), PANEL_Z);
        group.add(mesh);
        panels.push({ mesh, canvas, texture });
      });
    } else {
      // A bar line to run through: a rounded blue pillar over the range.
      const top = this.posY(range[1]) + 0.4;
      const bottom = this.posY(range[0]) - 0.4;
      const pillar = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, top - bottom, 3, 8), mat);
      pillar.position.set(0, (top + bottom) / 2, PANEL_Z);
      group.add(pillar);
    }
    group.visible = false;
    this.scene.add(group);
    return { group, panels, labels: [], active: false, visible: false };
  }

  private drawPanel(panel: Gate["panels"][number], label: string, state: "normal" | "correct" | "wrong") {
    const ctx = panel.canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = panel.canvas;
    const [top, bottom] =
      state === "correct" ? ["#45C474", "#259150"] : state === "wrong" ? ["#E86262", "#B53A3A"] : ["#5B7BE0", "#3550B0"];
    ctx.clearRect(0, 0, width, height);
    // Darker base for a pressed-button look, then the face on top.
    ctx.fillStyle = "rgba(20,30,70,0.35)";
    ctx.beginPath();
    ctx.roundRect(4, 10, width - 8, height - 12, 26);
    ctx.fill();
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(4, 2, width - 8, height - 14, 24);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(9, 7, width - 18, height - 24, 19);
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    const size = label.length > 3 ? 60 : 72;
    ctx.font = `900 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowOffsetY = 3;
    ctx.fillText(label, width / 2, height / 2 - 3);
    ctx.shadowColor = "transparent";
    panel.texture.needsUpdate = true;
  }
}

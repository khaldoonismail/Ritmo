import * as THREE from "three";
import { GATE_DISTANCE } from "@/lib/noteRunner";

// The 3D part of Note Runner, in plain Three.js. Everything is built from a
// few low-poly shapes in code (no model files). The runner stays at z = 0
// and the world moves toward the camera. The React component owns the
// rules (score, lives, which note is next); this class only draws, moves
// the gates and reports when a gate reaches the runner.
//
// Kept light for phones and old laptops: no shadows, Lambert materials,
// ~60 meshes, pixel ratio capped at 1.5 and lowered further if frames are
// slow.

const LANE_WIDTH = 1.6;
const PANEL_Y = 2.75;
const ROAD_LENGTH = 140;
const ROAD_FAR = -110;
const DESPAWN_Z = 9;
const GATE_HIDE_Z = 2.5;

const COLORS = {
  sky: 0xbfe3f5,
  grass: 0x8fd18a,
  road: 0xfff8ec,
  staffLine: 0x2b2b2b,
  barLine: 0x2b2b2b,
  gate: 0x3b5cc4,
  panel: "#3B5CC4",
  panelCorrect: "#2E9E57",
  panelWrong: "#C24444",
  runnerBody: 0xffb94d,
  runnerSkin: 0xf2c9a0,
  runnerLegs: 0x3b5cc4,
  tree: 0x4caf6d,
  trunk: 0x9a6b3f,
  note: 0x2b2b2b,
};

interface Gate {
  group: THREE.Group;
  panels: { mesh: THREE.Mesh; canvas: HTMLCanvasElement; texture: THREE.CanvasTexture }[];
  labels: string[];
  active: boolean; // moving toward the runner and not yet scored
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
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 160);
  private clock = new THREE.Clock(false);
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;

  private lanes: number;
  private road!: THREE.Group;
  private movers: THREE.Object3D[] = []; // scenery that scrolls and wraps
  private gates: Gate[] = [];
  private runner!: THREE.Group;
  private legs: THREE.Object3D[] = [];
  private arms: THREE.Object3D[] = [];
  private bodyMaterial!: THREE.MeshLambertMaterial;

  private speed = 6;
  private lane = 0;
  private runnerX = 0;
  private running = false;
  private time = 0;
  private gapLeft: number | null = null;
  private hopTime = -1;
  private stumbleTime = -1;
  private shake = 0;

  // Adaptive resolution: average frame time over ~2 s windows.
  private pixelRatio: number;
  private frameAccum = 0;
  private frameCount = 0;

  constructor(
    container: HTMLElement,
    lanes: number,
    private events: RunnerEngineEvents
  ) {
    this.container = container;
    this.lanes = lanes;
    this.lane = Math.floor((lanes - 1) / 2);
    this.runnerX = this.laneX(this.lane);

    const dpr = window.devicePixelRatio || 1;
    this.pixelRatio = Math.min(dpr, 1.5);
    this.renderer = new THREE.WebGLRenderer({
      antialias: dpr < 1.5, // high-DPR screens are already smooth enough
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.sky, 38, 95);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7fae7a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(4, 10, 6);
    this.scene.add(sun);

    this.buildWorld();
    this.buildRunner();
    for (let i = 0; i < 2; i++) this.gates.push(this.buildGate());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.render();
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

  get isRunning() {
    return this.running;
  }

  // Sends a new gate down the road with these lane labels, at this speed.
  spawnGate(labels: string[], speed: number) {
    this.speed = speed;
    const gate = this.gates.find((g) => !g.visible) ?? this.gates[0];
    gate.labels = labels;
    gate.panels.forEach((p, i) => this.drawPanel(p, labels[i] ?? "", COLORS.panel));
    gate.group.position.z = -GATE_DISTANCE;
    gate.group.visible = true;
    gate.visible = true;
    gate.active = true;
  }

  // Colours the panels of the gate that was just reached and starts the
  // pause before the next gate.
  showResult(correctLane: number, pickedLane: number, gapSeconds: number) {
    const gate = this.lastReached;
    if (gate) {
      gate.panels.forEach((p, i) => {
        if (i === correctLane) this.drawPanel(p, gate.labels[i], COLORS.panelCorrect);
        else if (i === pickedLane) this.drawPanel(p, gate.labels[i], COLORS.panelWrong);
      });
    }
    if (correctLane === pickedLane) {
      this.hopTime = 0;
    } else {
      this.stumbleTime = 0;
      this.shake = 0.35;
    }
    this.gapLeft = gapSeconds;
  }

  moveLane(dir: -1 | 1) {
    this.setLane(this.lane + dir);
  }

  setLane(lane: number) {
    this.lane = Math.max(0, Math.min(this.lanes - 1, lane));
    if (!this.running) this.render();
  }

  // Which lane a tap at this screen x (client coordinates) points at: the
  // nearest lane centre at the runner's depth.
  laneAtClientX(clientX: number): number {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    let best = this.lane;
    let bestDist = Infinity;
    for (let i = 0; i < this.lanes; i++) {
      const p = new THREE.Vector3(this.laneX(i), 0, 0).project(this.camera);
      const d = Math.abs(p.x - ndcX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  // Back to the start: middle lane, no gates on the road.
  reset() {
    this.lane = Math.floor((this.lanes - 1) / 2);
    this.runnerX = this.laneX(this.lane);
    for (const g of this.gates) {
      g.group.visible = false;
      g.visible = false;
      g.active = false;
    }
    this.gapLeft = null;
    this.hopTime = -1;
    this.stumbleTime = -1;
    this.shake = 0;
    this.lastReached = null;
    this.render();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else if (m) {
        const map = (m as THREE.MeshBasicMaterial).map;
        if (map) map.dispose();
        m.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // --- loop -------------------------------------------------------------

  private lastReached: Gate | null = null;

  private tick() {
    const rawDt = this.clock.getDelta();
    this.trackFrameTime(rawDt);
    const dt = Math.min(rawDt, 0.05); // a hiccup never teleports a gate past the runner
    this.time += dt;
    const travel = this.speed * dt;

    // Scenery scrolls and wraps around.
    for (const m of this.movers) {
      m.position.z += travel;
      if (m.position.z > DESPAWN_Z) m.position.z -= ROAD_LENGTH - 20;
    }

    for (const g of this.gates) {
      if (!g.visible) continue;
      g.group.position.z += travel;
      if (g.active && g.group.position.z >= 0) {
        g.active = false;
        this.lastReached = g;
        this.events.onGateReached(this.lane);
      }
      // Gates vanish just after the runner goes through, instead of
      // sweeping across the whole screen past the camera.
      if (g.group.position.z > GATE_HIDE_Z) {
        g.group.visible = false;
        g.visible = false;
      }
    }

    if (this.gapLeft !== null) {
      this.gapLeft -= dt;
      if (this.gapLeft <= 0) {
        this.gapLeft = null;
        this.events.onNeedGate();
      }
    }

    this.animateRunner(dt);
    this.render();
  }

  private animateRunner(dt: number) {
    const targetX = this.laneX(this.lane);
    this.runnerX += (targetX - this.runnerX) * Math.min(1, dt * 14);
    const r = this.runner;
    r.position.x = this.runnerX;
    r.rotation.z = (this.runnerX - targetX) * 0.25;

    const stride = Math.sin(this.time * (6 + this.speed * 0.6));
    this.legs[0].rotation.x = stride * 0.8;
    this.legs[1].rotation.x = -stride * 0.8;
    this.arms[0].rotation.x = -stride * 0.7;
    this.arms[1].rotation.x = stride * 0.7;

    let y = Math.abs(stride) * 0.08;
    if (this.hopTime >= 0) {
      this.hopTime += dt;
      const t = this.hopTime / 0.45;
      if (t >= 1) this.hopTime = -1;
      else y += Math.sin(t * Math.PI) * 0.7;
    }
    r.position.y = y;

    if (this.stumbleTime >= 0) {
      this.stumbleTime += dt;
      const on = Math.floor(this.stumbleTime * 10) % 2 === 0;
      this.bodyMaterial.color.setHex(on ? 0xc24444 : COLORS.runnerBody);
      if (this.stumbleTime > 0.7) {
        this.stumbleTime = -1;
        this.bodyMaterial.color.setHex(COLORS.runnerBody);
      }
    }

    this.shake = Math.max(0, this.shake - dt);
    this.placeCamera();
  }

  private trackFrameTime(dt: number) {
    if (dt <= 0 || dt > 0.5) return; // tab switches etc.
    this.frameAccum += dt;
    this.frameCount++;
    if (this.frameAccum < 2) return;
    const avg = this.frameAccum / this.frameCount;
    this.frameAccum = 0;
    this.frameCount = 0;
    // Under ~40 fps → draw fewer pixels (down to 0.75 of CSS pixels).
    if (avg > 1 / 40 && this.pixelRatio > 0.75) {
      this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
    }
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }

  // --- layout -----------------------------------------------------------

  private laneX(i: number) {
    return (i - (this.lanes - 1) / 2) * LANE_WIDTH;
  }

  private cameraBase = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();
  private topReserved = 0;

  // Pixels at the top covered by the note card: the road's far end (where
  // gates appear) is kept below it.
  setTopReserved(px: number) {
    if (Math.abs(px - this.topReserved) < 2) return;
    this.topReserved = px;
    this.resize();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Portrait phones get a wider view so every lane fits at the runner.
    this.camera.fov = aspect < 0.8 ? 68 : 55;
    this.camera.updateProjectionMatrix();

    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hTan = Math.tan(halfFov) * aspect;
    const roadHalf = (this.lanes * LANE_WIDTH) / 2 + 0.5;
    let dist = Math.max(6.5, roadHalf / hTan);

    // Shift the picture down (a lens shift, so the perspective doesn't
    // change) until a freshly spawned gate's signs sit just under the
    // note card, then pull the camera back if that pushed the runner's
    // feet off the bottom.
    const runnerFeet = new THREE.Vector3(0, 0, 0.4);
    const farSignTop = new THREE.Vector3(0, PANEL_Y + 0.7, -GATE_DISTANCE);
    const toPx = (v: THREE.Vector3) => ((1 - v.clone().project(this.camera).y) / 2) * h;
    for (let attempt = 0; attempt < 12; attempt++) {
      this.cameraBase.set(0, 2.2 + dist * 0.42, dist);
      this.cameraTarget.set(0, 1.2, -12);
      this.camera.clearViewOffset();
      this.placeCamera(true);
      this.camera.updateMatrixWorld();
      const shift = Math.max(0, this.topReserved + 10 - toPx(farSignTop));
      if (shift > 0) this.camera.setViewOffset(w, h, 0, -shift, w, h);
      this.camera.updateMatrixWorld();
      if (toPx(runnerFeet) <= h - 6) break;
      dist *= 1.08;
    }
    this.placeCamera();
    if (!this.running) this.render();
  }

  private placeCamera(still = false) {
    const s = !still && this.shake > 0 ? this.shake * 0.25 : 0;
    this.camera.position.set(
      this.cameraBase.x + this.runnerX * 0.25 + (s ? (Math.random() - 0.5) * s : 0),
      this.cameraBase.y + (s ? (Math.random() - 0.5) * s : 0),
      this.cameraBase.z
    );
    this.camera.lookAt(this.cameraTarget.x + this.runnerX * 0.2, this.cameraTarget.y, this.cameraTarget.z);
  }

  // --- building ---------------------------------------------------------

  private buildWorld() {
    const roadWidth = this.lanes * LANE_WIDTH + 0.6;

    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(200, ROAD_LENGTH + 40),
      new THREE.MeshLambertMaterial({ color: COLORS.grass })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, -0.02, ROAD_FAR / 2);
    this.scene.add(grass);

    // The road is a sheet of manuscript paper with the five staff lines
    // running along it.
    this.road = new THREE.Group();
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(roadWidth, ROAD_LENGTH),
      new THREE.MeshLambertMaterial({ color: COLORS.road })
    );
    paper.rotation.x = -Math.PI / 2;
    this.road.add(paper);
    const lineMat = new THREE.MeshBasicMaterial({ color: COLORS.staffLine });
    // Lines on the lane edges: with 4 lanes that's exactly a staff (the
    // lanes are its four spaces); Easy's 3 lanes get 4 lines.
    const lineGeo = new THREE.PlaneGeometry(0.07, ROAD_LENGTH);
    for (let i = 0; i <= this.lanes; i++) {
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set((i - this.lanes / 2) * LANE_WIDTH, 0.005, 0);
      this.road.add(line);
    }
    this.road.position.z = ROAD_FAR / 2 + 10;
    this.scene.add(this.road);

    // Bar lines across the road make the motion visible.
    const barGeo = new THREE.PlaneGeometry(this.lanes * LANE_WIDTH, 0.12);
    const barMat = new THREE.MeshBasicMaterial({ color: COLORS.barLine });
    for (let z = DESPAWN_Z; z > DESPAWN_Z - (ROAD_LENGTH - 20); z -= 12) {
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(0, 0.006, z);
      this.scene.add(bar);
      this.movers.push(bar);
    }

    // Trees and giant notes along both sides.
    const treeTop = new THREE.ConeGeometry(0.9, 2.2, 6);
    const trunk = new THREE.CylinderGeometry(0.15, 0.2, 0.8, 5);
    const treeMat = new THREE.MeshLambertMaterial({ color: COLORS.tree, flatShading: true });
    const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.trunk, flatShading: true });
    const noteHead = new THREE.SphereGeometry(0.45, 8, 6);
    const noteStem = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 5);
    const noteMat = new THREE.MeshLambertMaterial({ color: COLORS.note, flatShading: true });

    let k = 0;
    for (let z = DESPAWN_Z; z > DESPAWN_Z - (ROAD_LENGTH - 20); z -= 7) {
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        if ((k + (side > 0 ? 1 : 0)) % 3 === 0) {
          const head = new THREE.Mesh(noteHead, noteMat);
          head.scale.set(1.3, 0.9, 0.9);
          head.rotation.z = 0.4;
          head.position.y = 0.45;
          const stem = new THREE.Mesh(noteStem, noteMat);
          stem.position.set(0.5, 1.5, 0);
          g.add(head, stem);
        } else {
          const top = new THREE.Mesh(treeTop, treeMat);
          top.position.y = 1.8;
          const t = new THREE.Mesh(trunk, trunkMat);
          t.position.y = 0.4;
          g.add(top, t);
          g.scale.setScalar(0.8 + ((k * 37) % 5) * 0.12);
        }
        g.position.set(side * (roadWidth / 2 + 2 + ((k * 13) % 4)), 0, z - ((k * 5) % 4));
        this.scene.add(g);
        this.movers.push(g);
        k++;
      }
    }
  }

  private buildRunner() {
    const r = new THREE.Group();
    this.bodyMaterial = new THREE.MeshLambertMaterial({ color: COLORS.runnerBody, flatShading: true });
    const skin = new THREE.MeshLambertMaterial({ color: COLORS.runnerSkin, flatShading: true });
    const legsMat = new THREE.MeshLambertMaterial({ color: COLORS.runnerLegs, flatShading: true });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.75, 7), this.bodyMaterial);
    body.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), skin);
    head.position.y = 1.65;
    r.add(body, head);

    const legGeo = new THREE.BoxGeometry(0.16, 0.65, 0.18);
    legGeo.translate(0, -0.32, 0); // pivot at the hip
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, legsMat);
      leg.position.set(side * 0.13, 0.7, 0);
      r.add(leg);
      this.legs.push(leg);
    }
    const armGeo = new THREE.BoxGeometry(0.12, 0.55, 0.12);
    armGeo.translate(0, -0.25, 0); // pivot at the shoulder
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, skin);
      arm.position.set(side * 0.38, 1.38, 0);
      r.add(arm);
      this.arms.push(arm);
    }
    r.rotation.y = Math.PI; // face away from the camera
    this.runner = r;
    this.scene.add(r);
  }

  private buildGate(): Gate {
    const group = new THREE.Group();
    const width = this.lanes * LANE_WIDTH;
    const mat = new THREE.MeshLambertMaterial({ color: COLORS.gate, flatShading: true });
    const postGeo = new THREE.BoxGeometry(0.22, PANEL_Y + 0.6, 0.22);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, mat);
      post.position.set(side * (width / 2 + 0.15), (PANEL_Y + 0.6) / 2, 0);
      group.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(width + 0.52, 0.18, 0.22), mat);
    beam.position.set(0, PANEL_Y + 0.55, 0);
    group.add(beam);

    const panels: Gate["panels"] = [];
    const panelGeo = new THREE.PlaneGeometry(LANE_WIDTH - 0.1, 1.15);
    for (let i = 0; i < this.lanes; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 184;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 2;
      const mesh = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ map: texture, fog: false }));
      mesh.position.set(this.laneX(i), PANEL_Y, 0.12);
      group.add(mesh);
      panels.push({ mesh, canvas, texture });
    }
    group.visible = false;
    this.scene.add(group);
    return { group, panels, labels: [], active: false, visible: false };
  }

  private drawPanel(panel: Gate["panels"][number], label: string, bg: string) {
    const ctx = panel.canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = panel.canvas;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, width - 8, height - 8);
    ctx.fillStyle = "#FFFFFF";
    const size = label.length > 3 ? 92 : 112;
    ctx.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, width / 2, height / 2 + 4);
    panel.texture.needsUpdate = true;
  }
}

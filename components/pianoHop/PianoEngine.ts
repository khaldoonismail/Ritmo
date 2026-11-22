import * as THREE from "three";
import { Materials, PALETTE, skyTexture, softShadowTexture } from "@/components/noteRunner/look";
import { buildScenery } from "@/components/noteRunner/scenery";
import type { RunnerQuality } from "@/components/noteRunner/quality";
import { SpriteCharacter } from "@/components/characters/SpriteCharacter";
import { DEFAULT_CHARACTER, type CharacterChoice } from "@/components/characters/choice";
import type { PianoKey } from "@/lib/pianoHop";
import {
  BACK_Z,
  BLACK_H,
  BLACK_LEN,
  FRONT_Z,
  KEY_COLORS,
  WHITE_H,
  WHITE_W,
  buildKeyboard,
  keyboardWidth,
  markerTexture,
  pickKey,
  type KeyMesh,
  type KeyState,
} from "./keyboard";

export type { KeyState } from "./keyboard";

// Piano Hop's 3D scene: the keyboard (./keyboard.ts) lying on the grass
// like stepping stones, seen from the front and above (so the 2-and-3
// groups of black keys are easy to see), with the same sky, hills, clouds
// and trees as Note Runner / Up or Down (../noteRunner/scenery.ts) and the
// child's flat 2D character (../characters/SpriteCharacter.ts) hopping
// from key to key. The game (./PianoHopGame.tsx) decides what happens;
// this only draws it.

// The narrowest keyboard the camera frames, in white keys: Easy's single
// octave is framed as if it were this wide, so its big keys don't fill the
// whole screen and the sky still shows.
const MIN_VIEW_KEYS = 11;

// Where the character stands on a key: white keys at the front (in front
// of the black keys), black keys on their own top.
const STAND_Z_WHITE = FRONT_Z - 0.75;
const STAND_Z_BLACK = BACK_Z + BLACK_LEN - 0.55;

// The camera sees the keyboard from this angle above (so the key tops are
// big enough to tap) but aims nearer the horizon, with the keyboard
// fitted to the bottom of the frame. The character is tilted to face it.
// Two octaves need a steeper view so their narrower keys are still deep
// enough to tap on a small phone (at least ~40 px each way on a 667 × 375
// iPhone SE, 44 px and up on larger phones); Easy's big keys can show more
// sky.
const ELEVATION_TWO_OCTAVES = THREE.MathUtils.degToRad(42);
const ELEVATION_ONE_OCTAVE = THREE.MathUtils.degToRad(30);

const HOP_SECONDS = 0.3;

export class PianoEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  private clock = new THREE.Clock(false);
  private materials: Materials;
  private keys: KeyMesh[];
  private character: SpriteCharacter;
  private shadow: THREE.Mesh;
  private pointer: THREE.Mesh;
  private resizeObserver: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private running = false;
  private topReserved = 0;
  private width: number;
  private elevation: number;
  private time = 0;

  // The character stands on key `at`; `hop` animates a jump to it.
  private at = 0;
  private hop: { from: THREE.Vector3; to: THREE.Vector3; t: number; onLand?: () => void } | null = null;
  private landTimer: number | null = null;
  // The keyboard cursor (← → on a computer); -1 = hidden.
  private cursor = -1;

  constructor(
    private container: HTMLElement,
    keys: PianoKey[],
    quality: RunnerQuality = "high",
    character: CharacterChoice = DEFAULT_CHARACTER,
    // Easy: a small "Do"/"C" tag on each C.
    markerLabel: string | null = null
  ) {
    this.materials = new Materials(quality);
    this.width = keyboardWidth(keys);
    this.elevation = this.width > MIN_VIEW_KEYS ? ELEVATION_TWO_OCTAVES : ELEVATION_ONE_OCTAVE;

    const dpr = window.devicePixelRatio || 1;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality === "high" && dpr < 1.5, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(quality === "high" ? Math.min(dpr, 1.5) : Math.min(dpr, 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    container.appendChild(canvas);

    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(new THREE.Color(PALETTE.skyHorizon), 45, 120);
    this.scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x86c97a, quality === "high" ? 1.25 : 1.6));
    const sun = new THREE.DirectionalLight(0xfff1d6, quality === "high" ? 1.9 : 1.3);
    sun.position.set(-5, 9, 7);
    this.scene.add(sun);

    const grass = new THREE.Mesh(new THREE.PlaneGeometry(200, 90), this.materials.get(PALETTE.grass));
    grass.rotation.x = -Math.PI / 2;
    grass.position.z = -20;
    this.scene.add(grass);
    // The shared scenery is laid out for the runner games' paper staff;
    // here it stands further back, behind the keyboard, so the trees frame
    // the sky instead of filling it.
    buildScenery(
      this.materials,
      quality,
      2.6,
      0,
      (o) => {
        o.position.z -= 7;
        o.position.x += 4;
        this.scene.add(o);
      },
      false
    );

    this.keys = buildKeyboard(keys, this.materials, (o) => this.scene.add(o), markerLabel ? markerTexture(markerLabel) : null);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.5),
      new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false, opacity: 0.5 })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);

    // The cursor: a bouncing triangle above the selected key.
    const tri = new THREE.ConeGeometry(0.22, 0.34, 3);
    tri.rotateZ(Math.PI);
    this.pointer = new THREE.Mesh(tri, new THREE.MeshBasicMaterial({ color: 0x3b5cc4 }));
    this.pointer.visible = false;
    this.scene.add(this.pointer);

    this.character = new SpriteCharacter(character, quality === "high" ? 1.2 : 0.8);
    this.scene.add(this.character.object);
    this.at = this.keys.findIndex((k) => !k.key.black);
    this.placeCharacter(0);

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

  // Pixels at the top covered by the card and HUD: the keyboard and the
  // character are fitted below.
  setTopReserved(px: number) {
    if (Math.abs(px - this.topReserved) < 2) return;
    this.topReserved = px;
    this.resize();
  }

  get keyCount() {
    return this.keys.length;
  }

  get standingOn() {
    return this.at;
  }

  // The key under a tap, or -1.
  keyAtClient(clientX: number, clientY: number): number {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return pickKey(this.raycaster, this.keys);
  }

  // The character hops onto key `index`; `onLand` runs as it lands.
  hopTo(index: number, onLand?: () => void) {
    if (index < 0 || index >= this.keys.length) return;
    this.finishHop(); // a hop still in the air lands first
    const from = this.characterPoint();
    this.at = index;
    this.hop = { from, to: this.standPoint(index), t: 0, onLand };
    this.character.react("jump");
    if (!this.running) {
      this.finishHop();
      this.placeCharacter(0);
      this.render();
      return;
    }
    // Backup: if frames stall (a busy device, a hidden tab), the hop still
    // lands — so the answer is always judged and the key always plays.
    this.landTimer = window.setTimeout(() => this.finishHop(), HOP_SECONDS * 1000 + 150);
  }

  // Ends the current hop: the character is on its key, the key sinks, and
  // the landing callback runs (exactly once).
  private finishHop() {
    if (this.landTimer !== null) {
      window.clearTimeout(this.landTimer);
      this.landTimer = null;
    }
    const hop = this.hop;
    if (!hop) return;
    this.hop = null;
    this.keys[this.at].press = 1;
    hop.onLand?.();
  }

  // Stands on key `index` straight away (no hop).
  placeOn(index: number) {
    this.at = index;
    this.hop = null;
    this.placeCharacter(0);
    if (!this.running) this.render();
  }

  react(kind: "happy" | "sad") {
    this.character.react(kind);
  }

  // A key sinks a little, as if pressed (the wrong key's right twin, etc.).
  press(index: number) {
    if (this.keys[index]) this.keys[index].press = 1;
  }

  setCursor(index: number) {
    this.cursor = index;
    if (!this.running) {
      this.placeCharacter(0);
      this.render();
    }
  }

  setKeyState(index: number, state: KeyState) {
    const k = this.keys[index];
    if (!k) return;
    k.state = state;
    const c =
      state === "correct"
        ? KEY_COLORS.correct
        : state === "wrong"
          ? KEY_COLORS.wrong
          : state === "cursor"
            ? KEY_COLORS.cursor
            : k.key.black
              ? KEY_COLORS.blackTop
              : KEY_COLORS.white;
    k.topMat.color.setHex(c);
    if (!this.running) this.render();
  }

  clearKeyStates() {
    this.keys.forEach((_, i) => this.setKeyState(i, "normal"));
  }

  // For tests (?debug): each key's centre on screen.
  debugKeys() {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return this.keys.map((k) => {
      const p = this.tapPoint(k).project(this.camera);
      return {
        midi: k.key.midi,
        black: k.key.black,
        clientX: rect.left + ((p.x + 1) / 2) * rect.width,
        clientY: rect.top + ((1 - p.y) / 2) * rect.height,
      };
    });
  }

  dispose() {
    if (this.landTimer !== null) window.clearTimeout(this.landTimer);
    this.hop = null;
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
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    for (const k of this.keys) {
      k.press = Math.max(0, k.press - dt * 3);
      k.mesh.position.y = k.baseY - k.press * 0.08;
      // The right key pulses gently while it's shown.
      const emissive = (k.topMat as THREE.MeshLambertMaterial).emissive;
      if (k.state === "correct") emissive?.setRGB(0.05, 0.3 + 0.12 * Math.sin(this.time * 9), 0.12);
      else emissive?.setRGB(0, 0, 0);
    }
    this.placeCharacter(dt);
    this.render();
  }

  private standPoint(index: number): THREE.Vector3 {
    const k = this.keys[index];
    const top = k.key.black ? WHITE_H + BLACK_H : WHITE_H;
    return new THREE.Vector3(k.key.x * WHITE_W, top + 0.06, k.key.black ? STAND_Z_BLACK : STAND_Z_WHITE);
  }

  private tapPoint(k: KeyMesh): THREE.Vector3 {
    return k.key.black
      ? new THREE.Vector3(k.key.x * WHITE_W, WHITE_H + BLACK_H + 0.1, BACK_Z + BLACK_LEN * 0.55)
      : new THREE.Vector3(k.key.x * WHITE_W, WHITE_H + 0.06, FRONT_Z - 0.55);
  }

  private characterPoint(): THREE.Vector3 {
    return this.character.object.position.clone();
  }

  private placeCharacter(dt: number) {
    let p = this.standPoint(this.at);
    if (this.hop) {
      this.hop.t = Math.min(1, this.hop.t + dt / HOP_SECONDS);
      const t = this.hop.t;
      p = this.hop.from.clone().lerp(this.hop.to, t);
      p.y += Math.sin(t * Math.PI) * (0.6 + 0.07 * Math.min(8, Math.abs(this.hop.to.x - this.hop.from.x)));
      if (t >= 1) this.finishHop();
    }
    this.character.update(dt, 0);
    this.character.object.scale.setScalar(0.9);
    // Face the camera (it looks down from this.elevation), so the flat
    // character stands upright on screen instead of looking squashed.
    this.character.object.rotation.x = -this.elevation;
    this.character.object.position.copy(p);
    const ground = this.standPoint(this.at);
    this.shadow.position.set(p.x, ground.y - 0.05, p.z);

    const c = this.keys[this.cursor];
    this.pointer.visible = !!c;
    if (c) {
      const tp = this.tapPoint(c);
      this.pointer.position.set(tp.x, tp.y + 2.3 + 0.12 * Math.sin(this.time * 6), tp.z - 0.4);
    }
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }

  // Fits the whole keyboard (and the character standing on it) across the
  // screen below the card: the camera is placed from `elevation` at the
  // closest distance where everything fits, then tilted so the keyboard's
  // front edge sits at the bottom of the screen. The rest of the screen
  // shows sky, hills and trees, like the other games.
  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    // Every key edge to edge (only the wooden frame's rim may go off
    // screen), so on small phones each key is as wide as it can be.
    const half = Math.max(this.width, MIN_VIEW_KEYS) / 2 + 0.04;
    const pts: THREE.Vector3[] = [];
    for (const x of [this.width / 2 - half, this.width / 2 + half]) {
      for (const z of [BACK_Z, FRONT_Z]) pts.push(new THREE.Vector3(x, WHITE_H, z));
      // Room above the keys for the character's head, hops and the cursor.
      pts.push(new THREE.Vector3(x, WHITE_H + BLACK_H + 2.1, BACK_Z + 0.6));
    }
    const top = Math.min(this.topReserved, h * 0.45);
    const yLo = -1 + (2 * 6) / h; // keyboard's front edge, just above the bottom
    const yHi = 1 - (2 * (top + 6)) / h; // character's head, just below the card
    const xMax = 1 - (2 * 3) / w;
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);

    const centre = new THREE.Vector3(this.width / 2, WHITE_H, (BACK_Z + FRONT_Z) / 2);
    const dir = new THREE.Vector3(0, Math.sin(this.elevation), Math.cos(this.elevation));
    const project = (d: number, tilt: number) => {
      this.camera.position.copy(centre).addScaledVector(dir, d);
      this.camera.rotation.set(-tilt, 0, 0);
      this.camera.updateMatrixWorld();
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const p of pts) {
        const q = p.clone().project(this.camera);
        x1 = Math.max(x1, Math.abs(q.x));
        y0 = Math.min(y0, q.y);
        y1 = Math.max(y1, q.y);
      }
      return { x1, y0, y1 };
    };
    // For a distance: the tilt that puts the keyboard's front edge exactly
    // at yLo (tilting further down moves everything up the screen, so a
    // bisection finds it).
    const tiltFor = (d: number) => {
      let down = this.elevation + halfFov; // front edge well above yLo
      let up = this.elevation - halfFov * 2; // front edge below the screen
      for (let i = 0; i < 30; i++) {
        const mid = (down + up) / 2;
        if (project(d, mid).y0 > yLo) down = mid;
        else up = mid;
      }
      return (down + up) / 2;
    };
    let lo = 4;
    let hi = 80;
    for (let i = 0; i < 28; i++) {
      const d = (lo + hi) / 2;
      const b = project(d, tiltFor(d));
      if (b.x1 <= xMax && b.y1 <= yHi) hi = d;
      else lo = d;
    }
    project(hi, tiltFor(hi));
    if (!this.running) this.render();
  }
}

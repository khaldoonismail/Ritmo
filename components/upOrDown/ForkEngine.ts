import * as THREE from "three";
import { CartoonRunner, type RunnerCharacter } from "@/components/noteRunner/character";
import { Materials, PALETTE, skyTexture, softShadowTexture } from "@/components/noteRunner/look";
import type { RunnerQuality } from "@/components/noteRunner/quality";
import { buildScenery } from "@/components/noteRunner/scenery";
import type { Direction } from "@/lib/upOrDown";

// The 3D part of Up or Down, built from Note Runner's pieces (the kid,
// materials, sky, scenery and quality levels). Side view: the kid runs left
// to right on a raised road. The road comes in repeating pieces: a straight
// stretch, then a fork into three heights that join again afterwards:
//   ⬆️ up    a wooden ramp to a bridge with a railing
//   ➡️ same  (Hard only) a flat plank path over the hill
//   ⬇️ down  a sandy slope into a tunnel through the hill
// While the kid is on the straight stretch the child picks a path (an arrow
// badge over the kid and a bigger sign show the pick); at the fork the kid
// takes it. With no pick, the kid bumps into a rock at the fork and waits
// there (skipFork moves it on), so no path ever looks like the answer.
//
// Timing is the React component's job, with one helper here: setArrival()
// says "reach the fork no sooner than N seconds from now", and the runner
// slows down if needed, so the two notes and thinking time always fit
// before the fork. This is ear training, not a reflex test.

const PLAT = 2.0; // main road height
const UP_Y = 4.1; // bridge deck
const DOWN_Y = 0.05; // tunnel floor
const RAMP = 3; // ramp length
const MID = 8; // bridge / tunnel length
const FORK_LEN = RAMP * 2 + MID;
const STRAIGHT = 22;
const CHUNK = STRAIGHT + FORK_LEN;
const ROAD_Z0 = -0.7;
const ROAD_Z1 = 1.0;
const RUNNER_Z = 0.45;
const RUNNER_SCREEN_X = 0.2;
const MIN_VIEW_WIDTH = 12; // world units across, so the fork shows in portrait
const MIN_SPEED = 1.1;

const SAND = 0xf0d49a;
const SAND_DARK = 0xd9b574;
const DIRT = 0xb98a5a;
const STONE = 0xbdb6a8;
const TUNNEL = 0x2b2320;
const WOOD_LIGHT = 0xd29a5e;

const SIGN_COLORS: Record<Direction, string> = { up: "#F28C28", down: "#7B5CD6", same: "#2F8FD8" };

export interface ForkEngineEvents {
  // The kid has left the last fork; the next one is STRAIGHT units ahead.
  onApproach: () => void;
  // The kid reached the fork with this pick (null: none made).
  onFork: (choice: Direction | null) => void;
}

interface Sign {
  board: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  front: boolean;
  x: number; // local x in the chunk
}

interface Chunk {
  group: THREE.Group;
  n: number;
  signs: Partial<Record<Direction, Sign>>;
}

// Height of the path's surface `lx` units into a fork.
export function pathY(path: Direction, lx: number): number {
  if (lx <= 0 || lx >= FORK_LEN || path === "same") return PLAT;
  const target = path === "up" ? UP_Y : DOWN_Y;
  if (lx < RAMP) return PLAT + ((target - PLAT) * lx) / RAMP;
  if (lx > RAMP + MID) return target + ((PLAT - target) * (lx - RAMP - MID)) / RAMP;
  return target;
}

export class ForkEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  private clock = new THREE.Clock(false);
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private materials: Materials;
  private quality: RunnerQuality;
  private pixelRatio: number;
  private frameAccum = 0;
  private frameCount = 0;

  private movers: THREE.Object3D[] = [];
  private decor: THREE.Object3D[] = [];
  private moverSpan = 60;
  private viewLeft = -6;
  private topReserved = 0;
  private chunks: Chunk[] = [];
  private character: RunnerCharacter;
  private shadow: THREE.Mesh | null = null;
  private badge: THREE.Mesh;
  private badgeMats: Record<Direction, THREE.MeshBasicMaterial>;
  private signTextures: Record<Direction, THREE.Texture>;

  private running = false;
  private distance = 0; // how far the kid has run
  private baseSpeed = 5;
  private speed = 5;
  private time = 0;
  private arrivalAt = 0; // engine time before which the fork must not be reached
  private approachedN = -1;
  private forkN = -1;
  private choice: Direction | null = null;
  private taken: Direction = "same";
  private pulse: { n: number; correct: Direction; wrong: Direction | null; t: number } | null = null;
  // No pick at the fork: the kid bumps into a rock and waits (see
  // skipFork) instead of taking a path, so it never looks like an answer.
  private bumped: { t: number } | null = null;
  private rock: THREE.Group;

  constructor(
    container: HTMLElement,
    private hasSame: boolean,
    private events: ForkEngineEvents,
    quality: RunnerQuality = "high"
  ) {
    this.container = container;
    this.quality = quality;
    this.materials = new Materials(quality);

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
    this.scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x86c97a, quality === "high" ? 1.25 : 1.6));
    const sun = new THREE.DirectionalLight(0xfff1d6, quality === "high" ? 1.9 : 1.3);
    sun.position.set(-5, 9, 7);
    this.scene.add(sun);

    this.signTextures = {
      up: arrowTexture("up", SIGN_COLORS.up),
      down: arrowTexture("down", SIGN_COLORS.down),
      same: arrowTexture("same", SIGN_COLORS.same),
    };

    this.buildGround();
    for (let i = 0; i < 3; i++) this.chunks.push(this.buildChunk());
    buildScenery(
      this.materials,
      quality,
      UP_Y + 1.2,
      PLAT,
      (o, parallax, decor, span, margin) => {
        o.userData.parallax = parallax;
        if (span) o.userData.span = span;
        if (margin) o.userData.margin = margin;
        // Trees sit behind the bridge railing.
        if (parallax === 0.8) o.position.z -= 1.4;
        this.scene.add(o);
        this.movers.push(o);
        if (decor) this.decor.push(o);
      },
      false
    );

    this.character = new CartoonRunner(this.materials);
    this.scene.add(this.character.object);
    if (quality === "high") {
      this.shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 0.6),
        new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false, opacity: 0.5 })
      );
      this.shadow.rotation.x = -Math.PI / 2;
      this.scene.add(this.shadow);
      this.decor.push(this.shadow);
    }

    // The pick, shown over the kid's head.
    const badgeGeo = new THREE.CircleGeometry(0.36, 28);
    this.badgeMats = {
      up: new THREE.MeshBasicMaterial({ map: this.signTextures.up, transparent: true }),
      down: new THREE.MeshBasicMaterial({ map: this.signTextures.down, transparent: true }),
      same: new THREE.MeshBasicMaterial({ map: this.signTextures.same, transparent: true }),
    };
    this.badge = new THREE.Mesh(badgeGeo, this.badgeMats.up);
    this.badge.visible = false;
    this.scene.add(this.badge);

    // The rock that blocks the fork when no path was picked.
    this.rock = new THREE.Group();
    const stone = new THREE.DodecahedronGeometry(1, 0);
    const big = new THREE.Mesh(stone, this.materials.get(0x9c968a));
    big.scale.set(0.42, 0.36, 0.38);
    big.position.y = 0.3;
    const small = new THREE.Mesh(stone, this.materials.get(0xb5afa2));
    small.scale.set(0.22, 0.2, 0.22);
    small.position.set(0.38, 0.16, 0.12);
    this.rock.add(big, small);
    this.rock.position.set(0.75, PLAT + 0.1, RUNNER_Z);
    this.rock.visible = false;
    this.scene.add(this.rock);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.reset();
    this.resize();
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

  reset() {
    this.distance = -4;
    this.time = 0;
    this.arrivalAt = 0;
    this.approachedN = -1;
    this.forkN = -1;
    this.choice = null;
    this.taken = "same";
    this.pulse = null;
    this.bumped = null;
    this.rock.visible = false;
    this.character.reset();
    this.layoutChunks(true);
    this.placeRunner(0);
    this.render();
  }

  // Running speed when not held back for listening.
  setSpeed(speed: number) {
    this.baseSpeed = speed;
  }

  // Reach the next fork no sooner than `seconds` from now (never brings it
  // closer than an earlier call did).
  setArrival(seconds: number) {
    this.arrivalAt = Math.max(this.arrivalAt, this.time + seconds);
  }

  // Before the fork: ⬆️ (-1) or ⬇️ (+1). From ⬆️, a ⬇️ press goes to ➡️
  // "same" first (Hard), and the other way round.
  moveChoice(dir: -1 | 1) {
    if (!this.canChoose()) return;
    const c = this.choice;
    let next: Direction;
    if (dir < 0) next = this.hasSame && c === "down" ? "same" : "up";
    else next = this.hasSame && c === "up" ? "same" : "down";
    this.setChoice(next);
  }

  setChoice(choice: Direction) {
    if (!this.canChoose()) return;
    if (choice === "same" && !this.hasSame) return;
    if (choice !== this.choice) this.character.react("jump");
    this.choice = choice;
    this.refreshSigns();
  }

  get currentChoice(): Direction | null {
    return this.choice;
  }

  // The path whose height is nearest a tap at this screen y.
  choiceAtClientY(clientY: number): Direction {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const screenY = (y: number) => {
      const v = new THREE.Vector3(2, y, RUNNER_Z).project(this.camera);
      return rect.top + ((1 - v.y) / 2) * rect.height;
    };
    const options: [Direction, number][] = [
      ["up", screenY(UP_Y + 0.6)],
      ["down", screenY(DOWN_Y + 0.6)],
    ];
    if (this.hasSame) options.push(["same", screenY(PLAT + 0.6)]);
    options.sort((a, b) => Math.abs(a[1] - clientY) - Math.abs(b[1] - clientY));
    return options[0][0];
  }

  // After a no-pick bump: move the kid on to the start of the next
  // straight stretch (the game hides the jump with a quick flash).
  skipFork() {
    if (!this.bumped) return;
    this.bumped = null;
    this.rock.visible = false;
    this.character.reset();
    this.character.object.rotation.z = 0;
    this.distance = (this.forkN + 1) * CHUNK + 0.2;
    this.speed = this.baseSpeed * 0.5;
    this.layoutChunks(true);
    this.placeRunner(0);
    if (!this.running) this.render();
  }

  get isBumped(): boolean {
    return this.bumped !== null;
  }

  // After a fork: ring the right path's sign green (and a wrong pick red).
  showResult(correct: Direction, picked: Direction | null) {
    const ok = picked === correct;
    this.pulse = { n: this.forkN, correct, wrong: ok ? null : picked, t: 0 };
    this.character.react(ok ? "happy" : "sad");
  }

  setTopReserved(px: number) {
    this.topReserved = px;
    this.resize();
  }

  get currentQuality(): RunnerQuality {
    return this.quality;
  }

  // For tests (?debug): how far to the next fork, and current speed.
  debugState() {
    const nextFork = (this.forkN + 1) * CHUNK + STRAIGHT;
    return {
      toFork: nextFork - this.distance,
      speed: this.speed,
      baseSpeed: this.baseSpeed,
      secondsToArrival: this.arrivalAt - this.time,
      choice: this.choice,
      taken: this.taken,
      bumped: this.bumped !== null,
      distance: this.distance,
      quality: this.quality,
      pixelRatio: this.pixelRatio,
    };
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    });
    Object.values(this.signTextures).forEach((t) => t.dispose());
    (this.scene.background as THREE.Texture | null)?.dispose?.();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // --- loop -------------------------------------------------------------

  private canChoose() {
    // Only on the straight stretch before the next fork.
    return this.approachedN > this.forkN;
  }

  private tick() {
    const rawDt = this.clock.getDelta();
    this.trackFrameTime(rawDt);
    const dt = Math.min(rawDt, 0.05);
    this.time += dt;

    // Speed: the base speed, unless that would reach the fork before the
    // listening time is over.
    const toFork = (this.forkN + 1) * CHUNK + STRAIGHT - this.distance;
    const left = this.arrivalAt - this.time;
    let target = this.bumped ? 0 : this.baseSpeed;
    if (this.canChoose() && left > 0.05) target = Math.max(MIN_SPEED, Math.min(this.baseSpeed, toFork / left));
    // Ease into speed changes (slowing is quicker than speeding up).
    const k = target < this.speed ? 6 : 1.5;
    this.speed += (target - this.speed) * Math.min(1, dt * k);
    if (this.canChoose() && left > 0 && toFork / Math.max(left, 0.01) < this.speed) {
      // Never late on the promise, even while easing.
      this.speed = Math.max(MIN_SPEED, Math.min(this.speed, toFork / Math.max(left, 0.01)));
    }

    if (this.bumped) {
      this.bumped.t += dt;
      this.speed = 0;
    }
    const travel = this.speed * dt;
    this.distance += travel;
    for (const m of this.movers) {
      m.position.x -= travel * (m.userData.parallax ?? 1);
      const span = m.userData.span ?? this.moverSpan;
      if (m.position.x < this.viewLeft - (m.userData.margin ?? 6)) m.position.x += span;
    }

    // Events: leaving a fork (next one announced), reaching a fork.
    const nextApproach = this.approachedN + 1;
    if (this.distance >= nextApproach * CHUNK && this.forkN >= nextApproach - 1) {
      this.approachedN = nextApproach;
      this.choice = null;
      this.pulse = null;
      this.events.onApproach();
    }
    const nextFork = this.forkN + 1;
    if (this.approachedN >= nextFork && this.distance >= nextFork * CHUNK + STRAIGHT) {
      this.forkN = nextFork;
      this.taken = this.choice ?? "same";
      if (this.choice === null) {
        // Too late: stop right at the fork, in front of the rock.
        this.distance = nextFork * CHUNK + STRAIGHT;
        this.speed = 0;
        this.bumped = { t: 0 };
        this.character.react("sad");
      }
      this.events.onFork(this.choice);
    }

    if (this.pulse) {
      this.pulse.t += dt;
      if (this.pulse.t > 2.2) this.pulse = null;
    }

    this.layoutChunks(false);
    this.placeRunner(dt);
    this.render();
  }

  private placeRunner(dt: number) {
    const lx = this.distance - (this.forkN * CHUNK + STRAIGHT);
    const onFork = this.forkN >= 0 && lx > 0 && lx < FORK_LEN;
    const y = onFork && !this.bumped ? pathY(this.taken, lx) : PLAT;
    const o = this.character.object;
    if (this.bumped) {
      // Bump: a little hop back off the rock, a lean back, then standing
      // still, frozen mid sad reaction (frown, head down) until moving on.
      const t = this.bumped.t;
      this.character.update(t < 0.5 ? Math.min(dt, 0.5 - t + 0.001) : 0, 0);
      const k = Math.min(1, t / 0.15);
      const hop = t < 0.35 ? Math.sin((Math.PI * t) / 0.35) * 0.22 : 0;
      o.position.set(-0.3 * k, y + 0.1 + hop, RUNNER_Z);
      o.rotation.z = 0.3 * k * (t < 0.6 ? 1 : Math.max(0.4, 1 - (t - 0.6)));
      this.rock.visible = true;
      // The rock pops up as the kid arrives.
      const pop = Math.min(1, t / 0.12);
      this.rock.scale.setScalar(pop < 1 ? pop * 1.15 : 1);
      if (this.shadow) this.shadow.position.set(-0.2, y + 0.13, RUNNER_Z);
      this.badge.visible = false;
      return;
    }
    this.character.update(dt, this.speed);
    o.position.set(0, y + 0.1, RUNNER_Z);
    // Lean into ramps.
    let slope = 0;
    if (onFork && this.taken !== "same") {
      const a = pathY(this.taken, lx + 0.2) - pathY(this.taken, lx - 0.2);
      slope = Math.atan2(a, 0.4);
    }
    o.rotation.z += (slope * 0.6 - o.rotation.z) * Math.min(1, dt * 10 || 1);
    if (this.shadow) this.shadow.position.set(0.1, y + 0.13, RUNNER_Z);

    const showBadge = this.choice !== null && this.canChoose();
    this.badge.visible = showBadge;
    if (showBadge) {
      this.badge.material = this.badgeMats[this.choice!];
      this.badge.position.set(0.1, y + 2.1 + Math.sin(this.time * 5) * 0.05, RUNNER_Z + 0.5);
    }
  }

  // Places the three chunk pieces around the kid; a piece that changes
  // number is reset (signs back to normal).
  private layoutChunks(force: boolean) {
    const cur = Math.floor(this.distance / CHUNK);
    for (let n = cur - 1; n <= cur + 1; n++) {
      const c = this.chunks[((n % 3) + 3) % 3];
      if (c.n !== n || force) {
        c.n = n;
        c.group.visible = true;
      }
      c.group.position.x = n * CHUNK - this.distance;
    }
    this.refreshSigns();
  }

  private refreshSigns() {
    const upcoming = this.approachedN > this.forkN ? this.forkN + 1 : -99;
    for (const c of this.chunks) {
      for (const dir of ["up", "down", "same"] as Direction[]) {
        const s = c.signs[dir];
        if (!s) continue;
        const picked = c.n === upcoming && this.choice === dir;
        const other = c.n === upcoming && this.choice !== null && !picked;
        const scale = picked ? 1.3 : other ? 0.85 : 1;
        s.board.scale.setScalar(scale);
        // Front signs fade while the kid runs past them.
        const kidX = this.distance - c.n * CHUNK;
        const near = s.front && Math.abs(kidX - s.x) < 1.5;
        s.mat.opacity = near ? 0.3 : other ? 0.7 : 1;
        // Result rings.
        const p = this.pulse;
        let ring: number | null = null;
        if (p && p.n === c.n) {
          if (p.correct === dir) ring = PALETTE.correct;
          else if (p.wrong === dir) ring = PALETTE.wrong;
        }
        s.ring.visible = ring !== null && Math.floor((p?.t ?? 0) * 5) % 2 === 0;
        if (ring !== null) s.ringMat.color.setHex(ring);
        s.ring.scale.setScalar(scale);
      }
    }
  }

  private trackFrameTime(dt: number) {
    if (dt <= 0 || dt > 0.5) return;
    this.frameAccum += dt;
    this.frameCount++;
    if (this.frameAccum < 2) return;
    const avg = this.frameAccum / this.frameCount;
    this.frameAccum = 0;
    this.frameCount = 0;
    if (avg <= 1 / 40) return;
    if (this.quality === "high") {
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

  // Fits tunnel floor to bridge signs under the top card, at least
  // MIN_VIEW_WIDTH across (portrait screens show extra sky and ground).
  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    const spanLo = -0.4;
    const spanHi = UP_Y + 2.0;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const top = Math.min(this.topReserved, h * 0.4);
    const usable = Math.max(80, h - top - 12);
    const visibleH = ((spanHi - spanLo) * h) / usable;
    let dist = visibleH / 2 / tan;
    dist = Math.max(dist, MIN_VIEW_WIDTH / 2 / aspect / tan);
    const halfH = dist * tan;
    const halfW = halfH * aspect;
    const unitsPerPx = (2 * halfH) / h;
    // The span's middle at the middle of the area under the card. On tall
    // (portrait) screens there is room to spare: keep the road near the
    // bottom so the extra room is sky and trees, not empty grass.
    const centered = (spanLo + spanHi) / 2 + (top / 2 - 6) * unitsPerPx;
    const nearBottom = spanLo + halfH - 0.1 * 2 * halfH;
    const centerY = Math.max(centered, nearBottom);
    const runnerFromLeft = Math.max(2 * halfW * RUNNER_SCREEN_X, 2.5);
    const centerX = -runnerFromLeft + halfW;

    this.camera.position.set(centerX, centerY + dist * 0.16, dist + RUNNER_Z);
    this.camera.lookAt(centerX, centerY, 0);
    this.camera.updateMatrixWorld();

    this.viewLeft = centerX - halfW;
    this.moverSpan = Math.max(60, 2 * halfW + 16);
    if (!this.running) this.render();
  }

  // --- building ---------------------------------------------------------

  private buildGround() {
    const mat = this.materials;
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 90), mat.get(PALETTE.grass));
    grass.rotation.x = -Math.PI / 2;
    grass.position.z = -20;
    this.scene.add(grass);
  }

  // One repeating piece of road: straight stretch, then the fork.
  private buildChunk(): Chunk {
    const mat = this.materials;
    const high = this.quality === "high";
    const g = new THREE.Group();
    const depth = ROAD_Z1 - ROAD_Z0;
    const midZ = (ROAD_Z0 + ROAD_Z1) / 2;
    const F = STRAIGHT; // fork start, local x
    const add = (m: THREE.Object3D) => (g.add(m), m);

    // Straight stretch: a grassy bank with a sandy road and edge stones.
    add(extrude(poly([[-0.05, 0], [F, 0], [F, PLAT], [-0.05, PLAT]]), ROAD_Z0 - 0.4, ROAD_Z1, mat.get(PALETTE.grassDark)));
    const road = add(new THREE.Mesh(new THREE.BoxGeometry(F + 0.1, 0.12, depth), mat.get(SAND)));
    road.position.set(F / 2, PLAT + 0.06, midZ);
    const stoneGeo = new THREE.BoxGeometry(0.7, 0.16, 0.12);
    for (let x = 0.5; x < F; x += high ? 1.1 : 2.2) {
      const s = add(new THREE.Mesh(stoneGeo, mat.get(SAND_DARK)));
      s.position.set(x, PLAT + 0.1, ROAD_Z1 + 0.02);
    }

    // ⬇️ Down: sandy slopes into and out of a tunnel through a hill.
    const slopeLen = Math.hypot(RAMP, PLAT - DOWN_Y);
    const slopeAngle = Math.atan2(PLAT - DOWN_Y, RAMP);
    add(extrude(poly([[F, 0], [F + RAMP, 0], [F + RAMP, DOWN_Y], [F, PLAT]]), ROAD_Z0, ROAD_Z1, mat.get(DIRT)));
    add(extrude(poly([[F + RAMP + MID, 0], [F + FORK_LEN + 0.05, 0], [F + FORK_LEN + 0.05, PLAT], [F + RAMP + MID, DOWN_Y]]), ROAD_Z0, ROAD_Z1, mat.get(DIRT)));
    const trackGeo = new THREE.BoxGeometry(slopeLen, 0.1, depth + 0.02);
    const t1 = add(new THREE.Mesh(trackGeo, mat.get(SAND)));
    t1.position.set(F + RAMP / 2, (PLAT + DOWN_Y) / 2 + 0.04, midZ);
    t1.rotation.z = -slopeAngle;
    const t2 = add(new THREE.Mesh(trackGeo, mat.get(SAND)));
    t2.position.set(F + RAMP + MID + RAMP / 2, (PLAT + DOWN_Y) / 2 + 0.04, midZ);
    t2.rotation.z = slopeAngle;
    const floor = add(new THREE.Mesh(new THREE.BoxGeometry(MID + 0.2, 0.1, depth), mat.get(SAND)));
    floor.position.set(F + RAMP + MID / 2, DOWN_Y, midZ);
    const h0 = F + RAMP + 0.3;
    const h1 = F + RAMP + MID - 0.3;
    add(
      extrude(
        poly([[h0, 0], [h1, 0], [h1, PLAT - 0.4], [h1 - 0.4, PLAT], [h0 + 0.4, PLAT], [h0, PLAT - 0.4]]),
        ROAD_Z0 - 0.6,
        ROAD_Z1 + 0.05,
        mat.get(PALETTE.hillNear)
      )
    );
    // Tunnel mouths at both ends.
    const ringGeo = new THREE.ShapeGeometry(archShape(0.97, 1.67));
    const holeGeo = new THREE.ShapeGeometry(archShape(0.75, 1.45));
    const holeMat = new THREE.MeshBasicMaterial({ color: TUNNEL });
    for (const x of [h0 + 1.1, h1 - 1.1]) {
      const ring = add(new THREE.Mesh(ringGeo, mat.get(STONE)));
      ring.position.set(x, 0, ROAD_Z1 + 0.07);
      const hole = add(new THREE.Mesh(holeGeo, holeMat));
      hole.position.set(x, 0, ROAD_Z1 + 0.08);
    }
    // Between the mouths the tunnel is dark inside (the kid disappears and
    // pops out the other end).

    // ➡️ Same (Hard): plank bridges over the slopes and a path on the hill
    // top. Otherwise the hill top has bushes and flowers.
    if (this.hasSame) {
      const plankGeo = new THREE.BoxGeometry(RAMP + 0.4, 0.14, depth);
      for (const x of [F + (RAMP + 0.4) / 2 - 0.05, F + FORK_LEN - (RAMP + 0.4) / 2 + 0.05]) {
        const p = add(new THREE.Mesh(plankGeo, mat.get(SAND)));
        p.position.set(x, PLAT + 0.07, midZ);
      }
      const top = add(new THREE.Mesh(new THREE.BoxGeometry(h1 - h0, 0.12, depth), mat.get(SAND)));
      top.position.set((h0 + h1) / 2, PLAT + 0.06, midZ);
      const legGeo = new THREE.CylinderGeometry(0.06, 0.06, PLAT, 6);
      for (const x0 of [F, F + RAMP + MID]) {
        for (let x = x0 + 0.5; x < x0 + RAMP + 0.3; x += 1.2) {
          const leg = add(new THREE.Mesh(legGeo, mat.get(PALETTE.wood)));
          leg.position.set(x, PLAT / 2, ROAD_Z1 - 0.1);
        }
      }
    } else {
      const blob = new THREE.IcosahedronGeometry(1, high ? 1 : 0);
      const flower = new THREE.SphereGeometry(0.1, 8, 6);
      for (let x = h0 + 0.8; x < h1 - 0.4; x += high ? 1.4 : 2.4) {
        const b = add(new THREE.Mesh(blob, mat.get(Math.round(x) % 2 ? PALETTE.leaf : PALETTE.leafLight)));
        b.scale.set(0.45, 0.32, 0.4);
        b.position.set(x, PLAT + 0.12, -0.2);
        if (high) {
          const f = add(new THREE.Mesh(flower, mat.get(Math.round(x) % 2 ? 0xff7fa8 : 0xffd84a)));
          f.position.set(x + 0.5, PLAT + 0.12, ROAD_Z1 - 0.15);
        }
      }
    }

    // ⬆️ Up: wooden ramps to a bridge with a railing (behind, so it never
    // hides the kid) and legs down to the ground or hill.
    const wood = mat.get(PALETTE.wood);
    const woodLight = mat.get(WOOD_LIGHT);
    const rampLen = Math.hypot(RAMP, UP_Y - PLAT);
    const rampAngle = Math.atan2(UP_Y - PLAT, RAMP);
    const rampGeo = new THREE.BoxGeometry(rampLen + 0.05, 0.14, depth);
    const r1 = add(new THREE.Mesh(rampGeo, woodLight));
    r1.position.set(F + RAMP / 2, (PLAT + UP_Y) / 2 + 0.03, midZ);
    r1.rotation.z = rampAngle;
    const r2 = add(new THREE.Mesh(rampGeo, woodLight));
    r2.position.set(F + RAMP + MID + RAMP / 2, (PLAT + UP_Y) / 2 + 0.03, midZ);
    r2.rotation.z = -rampAngle;
    const deck = add(new THREE.Mesh(new THREE.BoxGeometry(MID + 0.1, 0.18, depth), woodLight));
    deck.position.set(F + RAMP + MID / 2, UP_Y + 0.03, midZ);
    if (high) {
      const lineGeo = new THREE.BoxGeometry(0.03, 0.18, 0.02);
      for (let x = F + RAMP + 0.25; x < F + RAMP + MID; x += 0.5) {
        const l = add(new THREE.Mesh(lineGeo, wood));
        l.position.set(x, UP_Y + 0.03, ROAD_Z1 + 0.01);
      }
    }
    const railGeo = new THREE.BoxGeometry(MID, 0.08, 0.08);
    for (const y of [0.45, 0.8]) {
      const r = add(new THREE.Mesh(railGeo, wood));
      r.position.set(F + RAMP + MID / 2, UP_Y + y, ROAD_Z0 + 0.05);
    }
    const postGeo = new THREE.BoxGeometry(0.1, 0.9, 0.1);
    for (let x = F + RAMP; x <= F + RAMP + MID + 0.01; x += 1.6) {
      const p = add(new THREE.Mesh(postGeo, wood));
      p.position.set(x, UP_Y + 0.45, ROAD_Z0 + 0.05);
    }
    for (const x of [F + RAMP + 0.3, F + RAMP + MID / 2, F + RAMP + MID - 0.3]) {
      const ground = x > h0 && x < h1 ? PLAT : 0;
      const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, UP_Y - ground, 7), wood));
      leg.position.set(x, ground + (UP_Y - ground) / 2, ROAD_Z0 + 0.15);
    }

    // Signs at the start of each path.
    const signs: Chunk["signs"] = {};
    const stickGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6);
    const makeSign = (dir: Direction, x: number, y: number, post: number, front: boolean) => {
      const z = front ? ROAD_Z1 + 0.35 : ROAD_Z0 - 0.15;
      const r = front ? 0.45 : 0.55;
      const m = new THREE.MeshBasicMaterial({ map: this.signTextures[dir], transparent: true });
      const board = add(new THREE.Mesh(new THREE.CircleGeometry(r, 32), m)) as THREE.Mesh;
      board.position.set(x, y, z);
      const ringMat = new THREE.MeshBasicMaterial({ color: PALETTE.correct });
      const ring = add(new THREE.Mesh(new THREE.RingGeometry(r * 1.05, r * 1.35, 32), ringMat)) as THREE.Mesh;
      ring.position.set(x, y, z - 0.01);
      ring.visible = false;
      const stick = add(new THREE.Mesh(stickGeo, wood));
      stick.scale.y = post;
      stick.position.set(x, y - post / 2 - r * 0.8, z - 0.05);
      signs[dir] = { board, mat: m, ring, ringMat, front, x };
    };
    makeSign("up", F + RAMP + 0.8, UP_Y + 1.3, 0.9, false);
    makeSign("down", F + RAMP + 0.2, 0.85, 0.5, true);
    if (this.hasSame) makeSign("same", F + 1.3, PLAT + 0.85, 0.5, true);

    this.scene.add(g);
    return { group: g, n: -999, signs };
  }
}

function extrude(shape: THREE.Shape, z0: number, z1: number, mat: THREE.Material) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false });
  const m = new THREE.Mesh(geo, mat);
  m.position.z = z0;
  return m;
}

function poly(pts: [number, number][]) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
  s.closePath();
  return s;
}

function archShape(r: number, height: number) {
  const s = new THREE.Shape();
  s.moveTo(-r, 0);
  s.lineTo(-r, height - r);
  s.absarc(0, height - r, r, Math.PI, 0, true);
  s.lineTo(r, 0);
  s.closePath();
  return s;
}

// A round sign: white rim, coloured disc, white arrow.
function arrowTexture(dir: Direction, color: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.arc(64, 64, 54, 0, Math.PI * 2);
  g.fill();
  g.translate(64, 64);
  g.rotate(dir === "up" ? 0 : dir === "down" ? Math.PI : Math.PI / 2);
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.moveTo(0, -39);
  g.lineTo(31, -4);
  g.lineTo(12, -4);
  g.lineTo(12, 35);
  g.lineTo(-12, 35);
  g.lineTo(-12, -4);
  g.lineTo(-31, -4);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

import * as THREE from "three";
import { Materials, PALETTE, skyTexture, softShadowTexture } from "@/components/noteRunner/look";
import type { RunnerQuality } from "@/components/noteRunner/quality";
import { SpriteCharacter } from "@/components/characters/SpriteCharacter";
import { DEFAULT_CHARACTER, type CharacterChoice } from "@/components/characters/choice";

// Weather Village (Happy or Sad): a small cartoon village on a grassy
// island, in the same soft low-poly look as our other games. The child's
// character lives here. Each right answer builds one more thing (see
// GROWTH), with a little pop; the weather shows the answer: sunny (sun,
// flowers bloom, villagers dance) or rainy (grey sky, gentle rain,
// umbrellas, puddles). Weather is visual only: no sound here.
//
// Kept light for old tablets: a few hundred simple meshes, one shared
// material per colour, rain as a single line mesh, and "low" quality
// drops the extras.

export type Weather = "clear" | "sunny" | "rainy";

// What each right answer builds, in order (10 = one round).
export const GROWTH = [
  "tree",
  "house",
  "cat",
  "well",
  "pond",
  "sheep",
  "house2",
  "bridge",
  "windmill",
  "garden",
] as const;
export type GrowthItem = (typeof GROWTH)[number];

const ELEVATION = THREE.MathUtils.degToRad(19);
const ISLAND_RX = 7.4;
const ISLAND_RZ = 3.9;
const POP_SECONDS = 0.6;

const C = {
  island: 0x8fd67a,
  islandSide: 0xc69a68, // earthy edge
  lake: 0x8fd3f2,
  bush: 0x5fb35a,
  dirt: 0xe9cf9b,
  wall: [0xfff3dc, 0xffe1e8, 0xe3f1ff],
  roof: [0xe8665a, 0x6f8fe0, 0xf2a33a],
  door: 0x8a5a3c,
  window: 0xbfe3ff,
  trunk: 0x9c6a3c,
  leaf: 0x55b860,
  leafLight: 0x79cf6f,
  stone: 0xb9b2a6,
  stoneDark: 0x9a9388,
  water: 0x6cc3f0,
  wood: 0xb07a45,
  cat: 0xf2a33a,
  sheep: 0xffffff,
  sheepFace: 0x4a4a4a,
  duck: 0xffd23f,
  beak: 0xf28c28,
  petal: [0xff7ab6, 0xffd23f, 0xffffff, 0xb57bff],
  stem: 0x3f9e5a,
  umbrella: [0xff5a5f, 0x2ea8ff, 0xffd23f, 0x8b5cf6],
  cloud: 0xffffff,
  rainCloud: 0xc3ccd9, // soft, light grey: gentle rain, not a storm
  sun: 0xffc23d,
  puddle: 0x8fb7d9,
};

// Where everything stands on the island (x, z); +z is towards the camera.
const SPOTS: Record<GrowthItem | "home" | "child", [number, number]> = {
  home: [0, -2.3],
  child: [0.3, 1.2],
  tree: [-2.9, -2.1],
  house: [3.2, -2.0],
  cat: [-1.6, 0.9],
  well: [1.8, -0.5],
  pond: [4.4, 0.9],
  sheep: [-4.3, 0.3],
  house2: [-5.3, -1.4],
  bridge: [5.7, 2.4],
  windmill: [5.9, -1.7],
  garden: [-3.4, 2.3],
};
// Villagers who move in with the houses.
const VILLAGERS: { with: GrowthItem; at: [number, number]; choice: CharacterChoice }[] = [
  { with: "house", at: [2.6, -0.6], choice: { kind: "girl", skin: 3, outfit: 2 } },
  { with: "house2", at: [-2.8, -0.6], choice: { kind: "fox", skin: 0, outfit: 0 } },
];
// Little flowers dotted about: buds most of the time, open in the sun.
const FLOWER_SPOTS: [number, number][] = [
  [-1.0, 2.6], [1.4, 2.7], [2.8, 1.8], [-2.4, 1.7], [-0.4, -0.9], [3.6, -0.5], [-4.9, 1.8], [0.9, 0.2], [-3.9, -2.4], [4.8, -2.7],
];
const PUDDLE_SPOTS: [number, number, number][] = [
  [-0.9, 1.9, 0.55], [1.6, 1.5, 0.4], [-2.6, -0.2, 0.45], [3.1, 0.4, 0.5], [0.2, -1.2, 0.35],
];

interface Pop {
  obj: THREE.Object3D;
  t: number;
}

interface Person {
  sprite: SpriteCharacter;
  umbrella: THREE.Object3D;
  base: THREE.Vector3;
  danceT: number;
}

export class VillageEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(44, 1, 0.1, 200);
  private clock = new THREE.Clock(false);
  private mat: Materials;
  private high: boolean;
  private resizeObserver: ResizeObserver;
  private running = false;
  private time = 0;
  private reservedTop = 0;
  private reservedBottom = 0;

  private items = new Map<GrowthItem, THREE.Object3D>();
  private grown = 0;
  private pops: Pop[] = [];
  private people: Person[] = [];
  private child: Person;
  private flowers: THREE.Object3D[] = [];
  private puddles: THREE.Mesh[] = [];
  private blades: THREE.Object3D | null = null;
  private duck: THREE.Object3D | null = null;

  private weather: Weather = "clear";
  private weatherMix = { sun: 0, rain: 0 }; // eased 0..1
  private sun: THREE.Group;
  private rainClouds: THREE.Group;
  private rain: THREE.LineSegments;
  private rainPos: Float32Array;
  private hemi: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private clearSky: THREE.Texture;
  private greySky: THREE.Texture;

  constructor(
    private container: HTMLElement,
    quality: RunnerQuality = "high",
    character: CharacterChoice = DEFAULT_CHARACTER
  ) {
    this.high = quality === "high";
    this.mat = new Materials(quality);
    const dpr = window.devicePixelRatio || 1;
    this.renderer = new THREE.WebGLRenderer({ antialias: this.high && dpr < 1.5, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(this.high ? Math.min(dpr, 1.5) : Math.min(dpr, 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    container.appendChild(canvas);

    this.clearSky = skyTexture();
    this.greySky = greySkyTexture();
    this.scene.background = this.clearSky;
    this.hemi = new THREE.HemisphereLight(0xe6f6ff, 0x86c97a, this.high ? 1.25 : 1.6);
    this.sunLight = new THREE.DirectionalLight(0xfff1d6, this.high ? 1.9 : 1.3);
    this.sunLight.position.set(-5, 9, 7);
    this.scene.add(this.hemi, this.sunLight);

    this.buildBackdrop();
    this.buildIsland();
    this.sun = this.buildSun();
    this.rainClouds = this.buildRainClouds();
    const rain = this.buildRain();
    this.rain = rain.mesh;
    this.rainPos = rain.pos;

    this.child = this.addPerson(character, SPOTS.child);
    this.child.sprite.object.scale.setScalar(1.05);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.applyWeather(1);
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

  // Pixels covered at the top (card) and bottom (answer buttons): the
  // village is fitted between them.
  setReserved(top: number, bottom: number) {
    if (Math.abs(top - this.reservedTop) < 2 && Math.abs(bottom - this.reservedBottom) < 2) return;
    this.reservedTop = top;
    this.reservedBottom = bottom;
    this.resize();
  }

  get growth() {
    return this.grown;
  }

  // Shows the first `n` things of GROWTH; with `pop`, the newest one pops in.
  setGrowth(n: number, pop = false) {
    n = Math.max(0, Math.min(GROWTH.length, n));
    GROWTH.forEach((name, i) => {
      const visible = i < n;
      let obj = this.items.get(name);
      if (visible && !obj) obj = this.buildItem(name);
      if (!obj) return;
      obj.visible = visible;
      obj.scale.setScalar(1);
      if (visible && pop && i === n - 1) {
        obj.scale.setScalar(0.001);
        this.pops.push({ obj, t: 0 });
      }
    });
    for (const p of this.people) {
      if (p === this.child) continue;
      const v = VILLAGERS.find((x) => x.at[0] === p.base.x && x.at[1] === p.base.z);
      const visible = !!v && GROWTH.indexOf(v.with) < n;
      p.sprite.object.visible = visible;
      p.umbrella.visible = visible && this.weather === "rainy";
    }
    this.grown = n;
    if (!this.running) this.render();
  }

  setWeather(w: Weather, instant = false) {
    this.weather = w;
    if (instant) this.applyWeather(1);
    if (!this.running) {
      this.applyWeather(1);
      this.render();
    }
  }

  // The child's character: a cheer (right) or a little shrug (wrong).
  cheer() {
    this.child.sprite.react("happy");
  }

  shrug() {
    this.child.sprite.react("shrug");
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    for (const p of this.people) p.sprite.dispose();
    const textures = new Set<THREE.Texture>([this.clearSky, this.greySky]);
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
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // --- loop -------------------------------------------------------------

  private tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.applyWeather(dt * 2.2);

    // New things pop in: grow past full size, then settle.
    this.pops = this.pops.filter((p) => {
      p.t += dt / POP_SECONDS;
      const t = Math.min(1, p.t);
      const s = t < 0.6 ? (t / 0.6) * 1.18 : 1.18 - ((t - 0.6) / 0.4) * 0.18;
      p.obj.scale.setScalar(Math.max(0.001, s));
      return p.t < 1;
    });

    if (this.blades) this.blades.rotation.z -= dt * (0.6 + this.weatherMix.sun * 1.2);
    if (this.duck) this.duck.position.y = 0.13 + Math.sin(this.time * 2.4) * 0.03;
    this.sun.rotation.z += dt * 0.4;

    // People: dance in the sun (hops, staggered), stand still in the rain.
    for (const p of this.people) {
      const dancing = this.weather === "sunny" && p !== this.child && p.sprite.object.visible;
      if (dancing) {
        p.danceT -= dt;
        if (p.danceT <= 0) {
          p.sprite.react(Math.random() < 0.5 ? "happy" : "jump");
          p.danceT = 0.9 + Math.random() * 0.4;
        }
      }
      p.sprite.update(dt, 0);
      const u = p.umbrella;
      const target = this.weather === "rainy" && p.sprite.object.visible ? 1 : 0;
      const s = u.scale.x + (target - u.scale.x) * Math.min(1, dt * 5);
      u.scale.setScalar(Math.max(0.001, s));
      u.visible = s > 0.02;
    }

    // Rain falls (one line mesh, its points moved each frame).
    if (this.rain.visible) {
      const pos = this.rainPos;
      for (let i = 0; i < pos.length; i += 6) {
        pos[i + 1] -= dt * 9;
        pos[i + 4] -= dt * 9;
        pos[i] -= dt * 0.9;
        pos[i + 3] -= dt * 0.9;
        if (pos[i + 4] < 0.1) {
          const lift = 6.5;
          pos[i + 1] += lift;
          pos[i + 4] += lift;
          pos[i] += lift * 0.1;
          pos[i + 3] += lift * 0.1;
        }
      }
      (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    this.render();
  }

  // Eases the scene towards the current weather (`k` = how far, 0..1).
  private applyWeather(k: number) {
    const sunT = this.weather === "sunny" ? 1 : 0;
    const rainT = this.weather === "rainy" ? 1 : 0;
    const m = this.weatherMix;
    m.sun += (sunT - m.sun) * Math.min(1, k);
    m.rain += (rainT - m.rain) * Math.min(1, k);

    this.scene.background = m.rain > 0.5 ? this.greySky : this.clearSky;
    this.hemi.intensity = (this.high ? 1.25 : 1.6) * (1 - 0.35 * m.rain) + 0.15 * m.sun;
    this.sunLight.intensity = (this.high ? 1.9 : 1.3) * (1 - 0.6 * m.rain) + 0.3 * m.sun;
    this.sun.visible = m.sun > 0.02;
    this.sun.scale.setScalar(Math.max(0.001, m.sun));
    this.rainClouds.visible = m.rain > 0.02;
    // Drift in from above as the rain starts.
    this.rainClouds.position.y = 4.9 + (1 - m.rain) * 1.5;
    this.rain.visible = m.rain > 0.3;
    // Flowers: buds that open in the sun.
    const bloom = 0.35 + 0.65 * m.sun;
    for (const f of this.flowers) f.scale.setScalar(bloom);
    for (const p of this.puddles) p.scale.setScalar(Math.max(0.001, m.rain));
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }

  // Fits the island (and its tallest things) between the card and the
  // buttons, as big as it can be.
  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();

    const pts: THREE.Vector3[] = [];
    for (const [x, z] of [
      [-ISLAND_RX, 0],
      [ISLAND_RX, 0],
      [0, ISLAND_RZ],
      [-ISLAND_RX * 0.72, ISLAND_RZ * 0.72],
      [ISLAND_RX * 0.72, ISLAND_RZ * 0.72],
    ]) {
      pts.push(new THREE.Vector3(x, -0.7, z));
    }
    // Tall things at the back (windmill, roofs, the sun's corner).
    pts.push(new THREE.Vector3(-5.3, 3.2, -1.4), new THREE.Vector3(5.9, 4.8, -1.7), new THREE.Vector3(0, 3.0, -2.3));

    const top = Math.min(this.reservedTop, h * 0.4);
    const bottom = Math.min(this.reservedBottom, h * 0.45);
    const bandTop = 1 - (2 * (top + 4)) / h;
    const bandBottom = -1 + (2 * (bottom + 4)) / h;
    const xMax = 1 - (2 * 10) / w;
    const target = new THREE.Vector3(0, 0.6, 0);
    const dir = new THREE.Vector3(0, Math.sin(ELEVATION), Math.cos(ELEVATION));
    const bounds = (d: number) => {
      this.camera.position.copy(target).addScaledVector(dir, d);
      this.camera.lookAt(target);
      this.camera.updateMatrixWorld();
      let x1 = 0;
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
    let lo = 5;
    let hi = 120;
    for (let i = 0; i < 26; i++) {
      const d = (lo + hi) / 2;
      const b = bounds(d);
      if (b.x1 <= xMax && b.y1 - b.y0 <= bandTop - bandBottom) hi = d;
      else lo = d;
    }
    const b = bounds(hi);
    // Slide the picture (not the camera) so the village sits in the middle
    // of the space between the card and the buttons.
    const shiftNdc = (b.y0 + b.y1) / 2 - (bandTop + bandBottom) / 2;
    this.camera.setViewOffset(w, h, 0, (-shiftNdc * h) / 2, w, h);
    this.camera.updateProjectionMatrix();
    if (!this.running) this.render();
  }

  // --- building ---------------------------------------------------------

  private buildBackdrop() {
    // The village's island sits in a little lake, with meadows beyond.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 160), this.mat.get(PALETTE.grass));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.75, -40);
    this.scene.add(ground);
    const lake = new THREE.Mesh(new THREE.CircleGeometry(1, this.high ? 48 : 24), this.mat.get(C.lake));
    lake.rotation.x = -Math.PI / 2;
    lake.scale.set(ISLAND_RX + 3.2, ISLAND_RZ + 2.6, 1);
    lake.position.y = -0.5;
    this.scene.add(lake);
    // Low, far hills, so the sky shows above them.
    const hillGeo = new THREE.SphereGeometry(1, this.high ? 18 : 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    for (let i = 0; i < 7; i++) {
      const far = i % 2 === 0;
      const hill = new THREE.Mesh(hillGeo, this.mat.get(far ? PALETTE.hillFar : PALETTE.hillNear));
      const r = far ? 16 + (i % 3) * 4 : 11 + (i % 3) * 3;
      hill.scale.set(r, far ? 2.6 + (i % 3) * 0.6 : 1.8 + (i % 2) * 0.5, r * 0.4);
      hill.position.set(-42 + i * 14, -0.75, far ? -60 : -45);
      this.scene.add(hill);
    }
    const puff = new THREE.SphereGeometry(1, 10, 7);
    for (let i = 0; i < (this.high ? 5 : 3); i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const p = new THREE.Mesh(puff, this.mat.get(C.cloud));
        p.scale.set(1.6, 1, 0.9);
        p.position.set(j * 1.6 - 1.6, (j % 2) * 0.4, 0);
        cloud.add(p);
      }
      cloud.position.set(-22 + i * 11, 9 + (i % 3) * 1.4, -34);
      this.scene.add(cloud);
    }
  }

  private buildIsland() {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, ISLAND_RX, ISLAND_RZ, 0, Math.PI * 2, false, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.2, bevelSegments: 2, curveSegments: this.high ? 48 : 24 });
    const island = new THREE.Mesh(geo, [this.mat.get(C.island), this.mat.get(C.islandSide)]);
    island.rotation.x = Math.PI / 2; // shape's y → world z, extruded downwards
    // The bevel adds 0.2 above the shape: lower it so the top is at y = 0
    // (everything on the island stands on y = 0).
    island.position.y = -0.2;
    this.scene.add(island);
    // A dirt path from the home to the front.
    const path = new THREE.Mesh(new THREE.CircleGeometry(1, 20), this.mat.get(C.dirt));
    path.rotation.x = -Math.PI / 2;
    path.scale.set(1.4, 2.2, 1);
    path.position.set(0.15, 0.012, -0.2);
    this.scene.add(path);

    // The child's home is there from the start, with a few bushes and
    // stones around the edge.
    this.scene.add(house(this.mat, 0, 1.15, SPOTS.home));
    const bushGeo = new THREE.IcosahedronGeometry(0.42, 0);
    for (const [x, z, sc] of [
      [-6.2, -0.6, 1], [-5.5, 2.0, 0.8], [6.4, 0.2, 0.9], [-1.6, -3.0, 0.9], [2.0, -3.1, 0.8], [6.6, 1.6, 0.7],
    ] as const) {
      const b = new THREE.Mesh(bushGeo, this.mat.get(C.bush));
      b.scale.set(sc * 1.2, sc * 0.8, sc);
      b.position.set(x, 0.28 * sc, z);
      this.scene.add(b);
    }
    const stoneGeo = new THREE.DodecahedronGeometry(0.18, 0);
    for (const [x, z] of [[-1.2, 3.4], [1.9, 3.3], [4.0, 2.9], [-4.4, 3.0], [-6.8, 0.8]] as const) {
      const st = new THREE.Mesh(stoneGeo, this.mat.get(C.stone));
      st.scale.set(1.3, 0.7, 1);
      st.position.set(x, 0.08, z);
      this.scene.add(st);
    }

    for (const [x, z] of FLOWER_SPOTS) {
      const f = flower(this.mat, this.flowers.length);
      f.position.set(x, 0, z);
      this.scene.add(f);
      this.flowers.push(f.children[1]); // the head (petals) opens
    }
    const puddleMat = new THREE.MeshLambertMaterial({ color: C.puddle, transparent: true, opacity: 0.85 });
    for (const [x, z, r] of PUDDLE_SPOTS) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(r, 18), puddleMat);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, 0.015, z);
      p.scale.setScalar(0.001);
      this.scene.add(p);
      this.puddles.push(p);
    }
  }

  private buildSun(): THREE.Group {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CircleGeometry(1.1, 28), new THREE.MeshBasicMaterial({ color: C.sun }));
    g.add(core);
    const rayGeo = new THREE.PlaneGeometry(0.24, 0.6);
    const rayMat = new THREE.MeshBasicMaterial({ color: C.sun });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.position.set(Math.cos(a) * 1.6, Math.sin(a) * 1.6, -0.01);
      ray.rotation.z = a - Math.PI / 2;
      g.add(ray);
    }
    g.position.set(6.3, 6.6, -5);
    g.rotation.x = -ELEVATION * 0.5;
    this.scene.add(g);
    return g;
  }

  private buildRainClouds(): THREE.Group {
    const g = new THREE.Group();
    const puff = new THREE.SphereGeometry(1, 10, 7);
    for (const [x, z, s] of [
      [-3.8, -0.5, 0.95],
      [0.2, -1.0, 1.15],
      [4.0, -0.4, 0.95],
    ] as const) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const p = new THREE.Mesh(puff, this.mat.get(C.rainCloud));
        p.scale.set(1.3 * s, 0.75 * s, 0.9 * s);
        p.position.set((j - 1) * 1.4 * s, (j % 2) * 0.35 * s, 0);
        cloud.add(p);
      }
      cloud.position.set(x, 0, z - 1.6);
      g.add(cloud);
    }
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  private buildRain(): { mesh: THREE.LineSegments; pos: Float32Array } {
    const n = this.high ? 160 : 70;
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() * 2 - 1) * ISLAND_RX;
      const z = (Math.random() * 2 - 1) * ISLAND_RZ;
      const y = 0.2 + Math.random() * 6.5;
      pos.set([x, y + 0.35, z, x - 0.035, y, z], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x5b8fe6, transparent: true, opacity: 0.75 }));
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh, pos };
  }

  private addPerson(choice: CharacterChoice, [x, z]: [number, number]): Person {
    const sprite = new SpriteCharacter(choice, this.high ? 1.2 : 0.8);
    sprite.object.position.set(x, 0.02, z);
    sprite.object.rotation.x = -ELEVATION;
    sprite.object.scale.setScalar(0.85);
    this.scene.add(sprite.object);
    if (this.high) {
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.45),
        new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false, opacity: 0.45 })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(x, 0.02, z);
      this.scene.add(shadow);
    }
    const u = umbrella(this.mat, this.people.length);
    u.position.set(x, 0, z);
    u.scale.setScalar(0.001);
    u.visible = false;
    this.scene.add(u);
    const person = { sprite, umbrella: u, base: new THREE.Vector3(x, 0, z), danceT: Math.random() };
    this.people.push(person);
    return person;
  }

  private buildItem(name: GrowthItem): THREE.Object3D {
    const m = this.mat;
    const [x, z] = SPOTS[name];
    let obj: THREE.Object3D;
    switch (name) {
      case "tree":
        obj = tree(m, 1.2);
        break;
      case "house":
        obj = house(m, 1, 1.0, [0, 0]);
        break;
      case "house2":
        obj = house(m, 2, 1.05, [0, 0]);
        break;
      case "cat":
        obj = cat(m);
        break;
      case "well":
        obj = well(m);
        break;
      case "pond": {
        const g = new THREE.Group();
        const water = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), m.get(C.water));
        water.rotation.x = -Math.PI / 2;
        water.scale.set(1.35, 0.85, 1);
        water.position.y = 0.02;
        g.add(water);
        const d = duck(m);
        d.position.set(0.2, 0.13, 0);
        g.add(d);
        this.duck = d;
        obj = g;
        break;
      }
      case "sheep":
        obj = sheep(m);
        break;
      case "bridge":
        obj = bridge(m);
        break;
      case "windmill": {
        const w = windmill(m);
        obj = w.group;
        this.blades = w.blades;
        break;
      }
      case "garden":
        obj = garden(m);
        break;
    }
    obj.position.set(x, 0, z);
    this.scene.add(obj);
    this.items.set(name, obj);
    // Villagers move in with their house.
    for (const v of VILLAGERS) {
      if (v.with === name && !this.people.some((p) => p.base.x === v.at[0] && p.base.z === v.at[1])) this.addPerson(v.choice, v.at);
    }
    return obj;
  }
}

// --- little models (all low-poly, shared materials) ------------------------

function box(m: Materials, color: number, w: number, h: number, d: number) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m.get(color));
}

function house(m: Materials, style: number, size: number, [x, z]: [number, number]) {
  const g = new THREE.Group();
  const body = box(m, C.wall[style % 3], 1.5, 1.1, 1.2);
  body.position.y = 0.55;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.9, 4), m.get(C.roof[style % 3]));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.05, 1, 0.85);
  roof.position.y = 1.55;
  const door = box(m, C.door, 0.34, 0.55, 0.05);
  door.position.set(0, 0.28, 0.61);
  const win = box(m, C.window, 0.3, 0.28, 0.05);
  win.position.set(0.45, 0.72, 0.61);
  const win2 = win.clone();
  win2.position.x = -0.45;
  g.add(body, roof, door, win, win2);
  g.scale.setScalar(size);
  g.position.set(x, 0, z);
  return g;
}

function tree(m: Materials, size: number) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 1, 7), m.get(C.trunk));
  trunk.position.y = 0.5;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), m.get(C.leaf));
  crown.position.y = 1.35;
  const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), m.get(C.leafLight));
  crown2.position.set(0.45, 1.1, 0.2);
  g.add(trunk, crown, crown2);
  g.scale.setScalar(size);
  return g;
}

function cat(m: Materials) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), m.get(C.cat));
  body.scale.set(1.3, 0.85, 0.8);
  body.position.y = 0.26;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), m.get(C.cat));
  head.position.set(0.34, 0.47, 0);
  const earGeo = new THREE.ConeGeometry(0.07, 0.14, 4);
  for (const dz of [-0.09, 0.09]) {
    const ear = new THREE.Mesh(earGeo, m.get(C.cat));
    ear.position.set(0.36, 0.65, dz);
    g.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 6), m.get(C.cat));
  tail.position.set(-0.4, 0.42, 0);
  tail.rotation.z = 0.6;
  g.add(body, head, tail);
  return g;
}

function sheep(m: Materials) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), m.get(C.sheep));
  body.scale.set(1.25, 0.95, 0.9);
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), m.get(C.sheepFace));
  head.position.set(0.55, 0.62, 0);
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.32, 5);
  for (const [lx, lz] of [[0.25, 0.18], [0.25, -0.18], [-0.25, 0.18], [-0.25, -0.18]]) {
    const leg = new THREE.Mesh(legGeo, m.get(C.sheepFace));
    leg.position.set(lx, 0.16, lz);
    g.add(leg);
  }
  g.add(body, head);
  return g;
}

function duck(m: Materials) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m.get(C.duck));
  body.scale.set(1.3, 0.8, 0.9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), m.get(C.duck));
  head.position.set(0.22, 0.2, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), m.get(C.beak));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.38, 0.18, 0);
  g.add(body, head, beak);
  return g;
}

function well(m: Materials) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.55, 12, 1, true), m.get(C.stone));
  ring.position.y = 0.28;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), m.get(C.water));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.4;
  const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6);
  for (const dx of [-0.42, 0.42]) {
    const post = new THREE.Mesh(postGeo, m.get(C.wood));
    post.position.set(dx, 0.75, 0);
    g.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 4), m.get(C.roof[0]));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.42;
  g.add(ring, water, roof);
  return g;
}

function bridge(m: Materials) {
  const g = new THREE.Group();
  // A little stream from the pond to the island's edge, and a wooden arch.
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 2.6), m.get(C.water));
  stream.rotation.x = -Math.PI / 2;
  stream.rotation.z = 0.55;
  stream.position.set(-0.3, 0.018, -0.4);
  g.add(stream);
  const plankGeo = new THREE.BoxGeometry(0.22, 0.07, 0.75);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const plank = new THREE.Mesh(plankGeo, m.get(C.wood));
    plank.position.set(-0.6 + t * 1.2, 0.08 + Math.sin(t * Math.PI) * 0.28, 0);
    plank.rotation.z = Math.cos(t * Math.PI) * -0.45;
    g.add(plank);
  }
  g.rotation.y = 0.55;
  return g;
}

function windmill(m: Materials) {
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 2.4, 8), m.get(C.wall[0]));
  tower.position.y = 1.2;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.6, 8), m.get(C.roof[1]));
  cap.position.y = 2.7;
  const blades = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(0.22, 1.3, 0.04);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(bladeGeo, m.get(C.wood));
    b.position.y = 0.65;
    const arm = new THREE.Group();
    arm.add(b);
    arm.rotation.z = (i * Math.PI) / 2;
    blades.add(arm);
  }
  blades.position.set(0, 2.25, 0.5);
  g.add(tower, cap, blades);
  return { group: g, blades };
}

function flower(m: Materials, i: number) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), m.get(C.stem));
  stem.position.y = 0.15;
  const head = new THREE.Group();
  const petal = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), m.get(C.petal[i % C.petal.length]));
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2;
    const pm = petal.clone();
    pm.position.set(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
    head.add(pm);
  }
  const centre = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), m.get(C.duck));
  head.add(centre);
  head.position.y = 0.32;
  g.add(stem, head);
  return g;
}

function garden(m: Materials) {
  const g = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.9), m.get(C.dirt));
  bed.position.y = 0.06;
  g.add(bed);
  for (let i = 0; i < 8; i++) {
    const f = flower(m, i);
    f.position.set(-0.8 + (i % 4) * 0.53, 0.1, i < 4 ? -0.2 : 0.22);
    f.scale.setScalar(1.6);
    g.add(f);
  }
  const postGeo = new THREE.BoxGeometry(0.06, 0.4, 0.06);
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(postGeo, m.get(C.wood));
    p.position.set(-1.05 + i * 0.42, 0.2, 0.55);
    g.add(p);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.05), m.get(C.wood));
  rail.position.set(0, 0.3, 0.55);
  g.add(rail);
  return g;
}

function umbrella(m: Materials, i: number) {
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.34, 8, 1, true), m.get(C.umbrella[i % C.umbrella.length]));
  canopy.position.y = 1.9;
  (canopy.material as THREE.Material).side = THREE.DoubleSide;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 5), m.get(C.door));
  stick.position.set(0.18, 1.4, 0.05);
  g.add(canopy, stick);
  return g;
}

function greySkyTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#8E9DB4");
  g.addColorStop(0.75, "#C9D3E0");
  g.addColorStop(1, "#C9D3E0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

import * as THREE from "three";
import { Materials } from "./look";

// The runner. Anything with this shape can be the character: the built-in
// cartoon kid below, or (later) an animated glTF model.
export interface RunnerCharacter {
  // Feet at y = 0, about one staff space tall, facing right (+x).
  readonly object: THREE.Object3D;
  // Advance animations; `speed` is the run speed (world units / s).
  update(dt: number, speed: number): void;
  // Short reactions on top of the run cycle.
  react(kind: "jump" | "happy" | "sad"): void;
  // Back to plain running.
  reset(): void;
}

// Mostly facing right (+x), turned toward the camera so the face shows.
const FACING = Math.PI / 2 - 0.8;

type Reaction = { kind: "jump" | "happy" | "sad"; t: number; length: number } | null;

const SKIN = 0xf6c9a1;
const SHIRT = 0xffa63d;
const SHORTS = 0x3b5cc4;
const CAP = 0xe84a5f;
const SHOE = 0xffffff;
const EYE = 0x262626;

// A cute low-poly kid in a cap, built from a handful of rounded shapes so
// it costs almost nothing to draw. Turned three-quarters toward the camera
// so the face shows while running right.
export class CartoonRunner implements RunnerCharacter {
  readonly object = new THREE.Group();
  private rig = new THREE.Group(); // bobbing / leaning part
  private head = new THREE.Group();
  private legs: THREE.Object3D[] = [];
  private arms: THREE.Object3D[] = [];
  private eyes: THREE.Mesh[] = [];
  private mouth: THREE.Mesh;
  private shirt: THREE.MeshToonMaterial | THREE.MeshLambertMaterial;
  private time = 0;
  private reaction: Reaction = null;
  private blinkIn = 2;

  constructor(materials: Materials) {
    const skin = materials.get(SKIN);
    this.shirt = materials.fresh(SHIRT);
    const shorts = materials.get(SHORTS);
    const cap = materials.get(CAP);
    const shoe = materials.get(SHOE);
    const ink = new THREE.MeshBasicMaterial({ color: EYE });

    // Body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.22, 4, 10), this.shirt);
    body.position.y = 0.72;
    const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.04, 4, 10), shorts);
    hips.position.y = 0.5;
    this.rig.add(body, hips);

    // Head: big and round, with a cap, eyes, cheeks and a mouth.
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), skin);
    const capTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.375, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.1),
      cap
    );
    capTop.position.y = 0.04;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 12), cap);
    brim.scale.set(1.3, 1, 1);
    brim.position.set(0, 0.07, 0.3);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), skin);
    ear.position.set(-0.35, -0.02, 0);
    this.head.add(skull, capTop, brim, ear);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), ink);
      eye.scale.set(0.8, 1.15, 0.6);
      eye.position.set(side * 0.13, -0.02, 0.33);
      this.head.add(eye);
      this.eyes.push(eye);
      const cheek = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff9a9a, transparent: true, opacity: 0.6 })
      );
      cheek.scale.set(1.2, 0.7, 0.4);
      cheek.position.set(side * 0.22, -0.12, 0.29);
      this.head.add(cheek);
    }
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 12, Math.PI), ink);
    this.mouth.rotation.z = Math.PI; // smile
    this.mouth.position.set(0, -0.12, 0.34);
    this.head.add(this.mouth);
    this.head.position.y = 1.18;
    this.rig.add(this.head);

    // Arms and legs pivot at the shoulder / hip.
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 3, 8), this.shirt);
      sleeve.position.y = -0.14;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skin);
      hand.position.y = -0.32;
      arm.add(sleeve, hand);
      arm.position.set(side * 0.31, 0.88, 0);
      this.rig.add(arm);
      this.arms.push(arm);

      const leg = new THREE.Group();
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.2, 3, 8), skin);
      thigh.position.y = -0.17;
      const sneaker = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6), shoe);
      sneaker.scale.set(1, 0.65, 1.5);
      sneaker.position.set(0, -0.36, 0.05);
      leg.add(thigh, sneaker);
      leg.position.set(side * 0.12, 0.44, 0);
      this.rig.add(leg);
      this.legs.push(leg);
    }

    this.object.add(this.rig);
    // Facing +z by construction; turn mostly right, a bit toward the camera.
    this.rig.rotation.y = FACING;
    this.object.scale.setScalar(0.95);
  }

  react(kind: "jump" | "happy" | "sad") {
    // A lane-change jump never interrupts a happy/sad reaction.
    if (kind === "jump" && this.reaction && this.reaction.kind !== "jump") return;
    this.reaction = { kind, t: 0, length: kind === "jump" ? 0.22 : kind === "happy" ? 0.6 : 0.85 };
  }

  reset() {
    this.reaction = null;
    this.shirt.color.setHex(SHIRT);
    this.mouth.rotation.z = Math.PI;
    this.object.position.y = 0;
  }

  update(dt: number, speed: number) {
    this.time += dt;
    const stride = Math.sin(this.time * (8 + speed * 0.45));
    let legSwing = 0.9;
    let armSwing = 0.8;
    let lift = Math.abs(stride) * 0.05;
    let lean = 0.12;
    let headTilt = 0;
    let armsUp = 0;
    let spin = 0;

    const r = this.reaction;
    if (r) {
      r.t += dt;
      const p = Math.min(1, r.t / r.length);
      if (r.kind === "jump") {
        lift += Math.sin(p * Math.PI) * 0.35;
        legSwing = 0.3;
      } else if (r.kind === "happy") {
        lift += Math.sin(p * Math.PI) * 0.75;
        armsUp = Math.sin(p * Math.PI);
        spin = p * Math.PI * 2;
        legSwing = 0.2;
      } else {
        headTilt = Math.sin(p * Math.PI) * 0.5;
        armSwing = 0.2;
        legSwing = 0.4;
        lean = -0.05;
        const flash = Math.floor(r.t * 10) % 2 === 0;
        this.shirt.color.setHex(flash ? 0xd24848 : SHIRT);
        this.mouth.rotation.z = 0; // frown
      }
      if (p >= 1) {
        this.reaction = null;
        this.shirt.color.setHex(SHIRT);
        this.mouth.rotation.z = Math.PI;
      }
    }

    this.legs[0].rotation.x = stride * legSwing;
    this.legs[1].rotation.x = -stride * legSwing;
    this.arms[0].rotation.x = -stride * armSwing;
    this.arms[1].rotation.x = stride * armSwing;
    // Arms up in a V for "happy".
    this.arms[0].rotation.z = -armsUp * 2.4;
    this.arms[1].rotation.z = armsUp * 2.4;
    this.rig.rotation.x = lean;
    this.head.rotation.x = headTilt;
    this.rig.rotation.y = FACING + spin;
    this.rig.position.y = lift;

    // Blink now and then.
    this.blinkIn -= dt;
    const closed = this.blinkIn < 0.12;
    if (this.blinkIn < 0) this.blinkIn = 2 + ((this.time * 7.3) % 3);
    for (const e of this.eyes) e.scale.y = closed ? 0.15 : 1.15;
  }
}

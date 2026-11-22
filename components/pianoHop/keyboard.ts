import * as THREE from "three";
import type { Materials } from "@/components/noteRunner/look";
import type { PianoKey } from "@/lib/pianoHop";

// Piano Hop's keyboard as 3D objects: the keys the game draws, the
// invisible tap targets, and how a tap is turned into a key. Kept apart
// from the renderer (./PianoEngine.ts) so scripts/check-piano-hop.ts can
// build exactly these meshes in Node and check every key's place.
//
// World units: one white key is 1 wide (x); the keyboard runs from x = 0
// to the number of white keys, keys point towards the camera (+z), the
// ground is y = 0.

export const WHITE_W = 1;
export const WHITE_GAP = 0.06;
export const WHITE_LEN = 3.7;
export const WHITE_H = 0.32;
export const BLACK_W = 0.6;
export const BLACK_LEN = 2.2;
export const BLACK_H = 0.3; // above the white keys' tops
export const BACK_Z = -1.8; // the keyboard's back edge (towards the trees)
export const FRONT_Z = BACK_Z + WHITE_LEN;
// Taps a little either side of a black key still count as that key, so
// the narrow keys are easy for a child's finger (neighbouring black keys
// are at least 1.1 apart, so their targets never overlap: checked by
// scripts/check-piano-hop.ts).
export const BLACK_HIT_W = 1.0;

export const KEY_COLORS = {
  white: 0xfffdf7,
  whiteSide: 0xe7dfcf,
  black: 0x2b2745,
  blackTop: 0x3a3558,
  frame: 0x9c6a3c,
  cursor: 0xbfe3ff,
  correct: 0x3ccf6e,
  wrong: 0xff6b6b,
};

export type KeyState = "normal" | "cursor" | "correct" | "wrong";

export interface KeyMesh {
  key: PianoKey;
  mesh: THREE.Mesh;
  top: THREE.Mesh; // the coloured top face (changes with state)
  hit: THREE.Mesh; // invisible tap target
  baseY: number;
  press: number; // 0..1, the key sinking when hopped on
  state: KeyState;
  topMat: THREE.MeshLambertMaterial | THREE.MeshToonMaterial;
}

export function keyboardWidth(keys: PianoKey[]): number {
  return Math.max(...keys.filter((k) => !k.black).map((k) => k.x + 0.5)) * WHITE_W;
}

// Builds the frame and every key; `add` puts each object in the scene.
// `marker`: Easy's "Do"/"C" tag texture for each C, or null.
export function buildKeyboard(
  keys: PianoKey[],
  mat: Materials,
  add: (o: THREE.Object3D) => void,
  marker: THREE.Texture | null = null
): KeyMesh[] {
  const width = keyboardWidth(keys);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.24, 0.22, WHITE_LEN + 0.4), mat.get(KEY_COLORS.frame));
  frame.position.set(width / 2, 0.11, (BACK_Z + FRONT_Z) / 2 - 0.1);
  add(frame);

  const whiteGeo = new THREE.BoxGeometry(WHITE_W - WHITE_GAP, WHITE_H, WHITE_LEN);
  const blackGeo = new THREE.BoxGeometry(BLACK_W, BLACK_H + 0.1, BLACK_LEN);
  const topWhiteGeo = new THREE.PlaneGeometry(WHITE_W - WHITE_GAP - 0.04, WHITE_LEN - 0.04);
  const topBlackGeo = new THREE.PlaneGeometry(BLACK_W - 0.08, BLACK_LEN - 0.08);
  const hitWhite = new THREE.BoxGeometry(WHITE_W, 0.5, WHITE_LEN + 0.4);
  const hitBlack = new THREE.BoxGeometry(BLACK_HIT_W, 0.6, BLACK_LEN + 0.2);
  const invisible = new THREE.MeshBasicMaterial({ visible: false });

  const out: KeyMesh[] = [];
  for (const key of keys) {
    const black = key.black;
    const sideMat = mat.get(black ? KEY_COLORS.black : KEY_COLORS.whiteSide);
    const topMat = mat.fresh(black ? KEY_COLORS.blackTop : KEY_COLORS.white);
    const mesh = new THREE.Mesh(black ? blackGeo : whiteGeo, sideMat);
    const baseY = black ? WHITE_H + (BLACK_H - 0.1) / 2 + 0.05 : WHITE_H / 2 + 0.06;
    const z = black ? BACK_Z + BLACK_LEN / 2 : (BACK_Z + FRONT_Z) / 2;
    mesh.position.set(key.x * WHITE_W, baseY, z);
    mesh.userData.midi = key.midi;
    const top = new THREE.Mesh(black ? topBlackGeo : topWhiteGeo, topMat);
    top.rotation.x = -Math.PI / 2;
    top.position.y = (black ? BLACK_H + 0.1 : WHITE_H) / 2 + 0.002;
    mesh.add(top);
    if (marker && !black && key.step === "C") {
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), new THREE.MeshBasicMaterial({ map: marker, transparent: true }));
      label.rotation.x = -Math.PI / 2;
      label.position.set(0, WHITE_H / 2 + 0.006, WHITE_LEN / 2 - 0.4);
      label.name = "marker";
      mesh.add(label);
    }
    const hit = new THREE.Mesh(black ? hitBlack : hitWhite, invisible);
    hit.position.copy(mesh.position);
    hit.userData.midi = key.midi;
    add(mesh);
    add(hit);
    out.push({ key, mesh, top, hit, baseY, press: 0, state: "normal", topMat: topMat as KeyMesh["topMat"] });
  }
  return out;
}

// The key a ray hits (black keys first: they sit on top), or -1.
export function pickKey(raycaster: THREE.Raycaster, keys: KeyMesh[]): number {
  for (const black of [true, false]) {
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].key.black !== black) continue;
      if (raycaster.intersectObject(keys[i].hit, false).length > 0) return i;
    }
  }
  return -1;
}

// "Do" / "C" on an orange tag, for Easy's markers (browser only).
export function markerTexture(text: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 80;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = "#F28C28";
  ctx.beginPath();
  ctx.roundRect(6, 6, 116, 68, 18);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 46px Nunito, Arial Rounded MT Bold, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 43);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

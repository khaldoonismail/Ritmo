import * as THREE from "three";
import type { Accidental } from "@/lib/noteReading";

// How Note Runner draws a gate's note heads on the staff: each head on its
// exact line/space, with ledger lines for every line between it and the
// staff (as in printed music) and the ♯/♭ to its left. Kept free of the
// renderer and of font/texture code, so scripts/check-note-runner.ts can
// build real heads in Node and check where they end up.

// World units: one staff space = 1; a staff position (half-spaces above
// the bottom line, see lib/noteReading.ts) is half a unit.
export const HALF = 0.5;
export const NOTE_HEAD_WIDTH = 1.18;
// Heads one step apart would overlap in one column, so (as with seconds in
// printed music) the second one moves right by this much.
export const COLUMN_GAP = 1.25;
export const HEADS_Z = 0.16;
export const MAX_LEDGERS_PER_HEAD = 4;

export interface HeadParts {
  group: THREE.Group;
  hollow: THREE.Mesh;
  filled: THREE.Mesh;
  ledgers: THREE.Mesh[];
  signs: Record<"sharp" | "flat", THREE.Mesh>;
}

export interface HeadGeometries {
  hollow: THREE.BufferGeometry;
  filled: THREE.BufferGeometry;
  ledger: THREE.BufferGeometry;
  sharp: THREE.BufferGeometry;
  flat: THREE.BufferGeometry;
}

export function createHead(geo: HeadGeometries, head: THREE.Material, ink: THREE.Material): HeadParts {
  const group = new THREE.Group();
  const hollow = new THREE.Mesh(geo.hollow, head);
  const filled = new THREE.Mesh(geo.filled, head);
  hollow.position.z = HEADS_Z;
  filled.position.z = HEADS_Z;
  filled.visible = false;
  group.add(hollow, filled);
  const ledgers: THREE.Mesh[] = [];
  for (let l = 0; l < MAX_LEDGERS_PER_HEAD; l++) {
    const ledger = new THREE.Mesh(geo.ledger, ink);
    ledger.position.z = HEADS_Z - 0.12;
    ledger.visible = false;
    group.add(ledger);
    ledgers.push(ledger);
  }
  const sharp = new THREE.Mesh(geo.sharp, head);
  const flat = new THREE.Mesh(geo.flat, head);
  for (const s of [sharp, flat]) {
    s.position.z = HEADS_Z - 0.06;
    s.visible = false;
    group.add(s);
  }
  return { group, hollow, filled, ledgers, signs: { sharp, flat } };
}

// The ledger lines a note at this position needs: every line from the
// staff out to it (positions -2, -4, … below; 10, 12, … above).
export function ledgerPositionsFor(position: number): number[] {
  const out: number[] = [];
  for (let l = -2; l >= position; l -= 2) out.push(l);
  for (let l = 10; l <= position; l += 2) out.push(l);
  return out;
}

// Width of one column of ♯/♭ signs, and the vertical distance (in staff
// positions) within which two signs would touch: a sign is about 2.5
// spaces tall, so signs a sixth or closer go in separate columns, as in
// printed music.
export const SIGN_COLUMN_WIDTH = 1.15;
export const SIGN_CLASH_DISTANCE = 5;

// Puts a gate's heads on their positions (`positions` highest first),
// hollow, at y = posY(position). Every other head of a one-step pair moves
// right so they don't overlap. ♯/♭ signs line up left of all the heads
// (past any ledger lines); signs that would touch go in further columns.
// Heads beyond `positions` are hidden. Returns how far left of the gate's
// origin the drawing reaches (heads, ledger lines and signs), in units.
export function layoutHeads(
  heads: HeadParts[],
  positions: number[],
  accidental: Accidental,
  posY: (position: number) => number,
  material: THREE.Material
): number {
  let reach = NOTE_HEAD_WIDTH / 2 + (positions.some((p) => ledgerPositionsFor(p).length > 0) ? 0.3 : 0);
  const anyLedger = positions.some((p) => ledgerPositionsFor(p).length > 0);
  const signRight = -NOTE_HEAD_WIDTH / 2 - (anyLedger ? 0.45 : 0.18);
  const columns: number[][] = []; // positions already given a sign, per column
  let prevShifted = false;
  heads.forEach((h, i) => {
    const p = positions[i];
    h.group.visible = p !== undefined;
    if (p === undefined) return;
    const prev = positions[i - 1];
    const shifted = prev !== undefined && prev - p === 1 && !prevShifted;
    prevShifted = shifted;
    const x = shifted ? COLUMN_GAP : 0;
    let col = 0;
    if (accidental) {
      while (columns[col]?.some((q) => Math.abs(q - p) <= SIGN_CLASH_DISTANCE)) col++;
      (columns[col] ??= []).push(p);
    }
    // Signs are placed by their left edge; one column is a sign's width.
    const signX = signRight - (col + 1) * SIGN_COLUMN_WIDTH + 0.12 - x;
    placeHead(h, p, accidental, x, signX, posY, material);
    if (accidental) reach = Math.max(reach, -(signX + x));
  });
  return reach;
}

function placeHead(
  h: HeadParts,
  position: number,
  accidental: Accidental,
  x: number,
  signX: number,
  posY: (position: number) => number,
  material: THREE.Material
) {
  h.group.position.set(x, posY(position), 0);
  h.hollow.visible = true;
  h.hollow.material = material;
  h.filled.visible = false;
  h.filled.material = material;
  const ledgers = ledgerPositionsFor(position);
  h.ledgers.forEach((m, i) => {
    const lp = ledgers[i];
    m.visible = lp !== undefined;
    if (lp !== undefined) m.position.y = (lp - position) * HALF;
  });
  for (const kind of ["sharp", "flat"] as const) {
    const s = h.signs[kind];
    s.visible = accidental === kind;
    s.position.x = signX;
  }
}

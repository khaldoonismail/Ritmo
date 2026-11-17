// Automated check for Note Runner's note heads and options.
//
//   npm run check:note-runner
//
// For every level, clef (treble, bass, mixed), naming and sharps/flats
// setting it plays many gates through the game's own code (GateSupply →
// options → the same layoutHeads() the 3D engine uses), then checks each
// gate against facts worked out independently here:
//   * the asked note's staff position, from its letter/octave and the clef;
//   * every note head is drawn exactly on its line/space (read back from
//     the head's world position), with exactly the right ledger lines and
//     the right ♯/♭;
//   * one-step neighbours never overlap (they sit in separate columns);
//   * 4 options, the answer among them, all inside the level's range;
//   * no two options with the same letter name;
//   * spacing: neighbouring options 2–5 steps apart; one-step pairs only
//     on Hard (at most one per gate);
//   * ♯/♭ signs sit left of the heads and never overlap each other;
//   * the card's name matches the note.
// Exits with code 1 and lists failures if anything is wrong.

import * as THREE from "three";
import { LEVEL_RANGE, type ClefChoice, type NoteLevel, type NamingSystem } from "../lib/noteReading";
import { GateSupply, MAX_OPTION_GAP, MIN_OPTION_GAP, OPTIONS_PER_GATE, type NoteRunnerConfig } from "../lib/noteRunner";
import { HALF, SIGN_CLASH_DISTANCE, SIGN_COLUMN_WIDTH, createHead, layoutHeads } from "../components/noteRunner/noteHeads";

const GATES_PER_CONFIG = 600;

// Independent reference data (not imported from the game).
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const SOLFEGE: Record<string, string> = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" };
// Diatonic number of each clef's bottom line: E4 (treble), G2 (bass).
const BOTTOM_LINE = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 };

function expectedPosition(clef: "treble" | "bass", step: string, octave: number) {
  return octave * 7 + LETTERS.indexOf(step) - BOTTOM_LINE[clef];
}
function letterAt(clef: "treble" | "bass", position: number) {
  return LETTERS[(((BOTTOM_LINE[clef] + position) % 7) + 7) % 7];
}
function expectedLedgers(position: number): number[] {
  const out: number[] = [];
  if (position < 0) for (let l = -2; l >= position; l -= 2) out.push(l);
  if (position > 8) for (let l = 10; l <= position; l += 2) out.push(l);
  return out.sort((a, b) => a - b);
}

// Real heads with stand-in shapes (fonts/canvas aren't available in Node;
// only positions matter here).
const box = new THREE.BoxGeometry(1.18, 1, 0.1);
const mat = new THREE.MeshBasicMaterial();
const geos = { hollow: box, filled: box, ledger: box, sharp: box, flat: box };
const gateGroup = new THREE.Group();
gateGroup.position.set(7.3, 0, 0); // somewhere along the road
const heads = Array.from({ length: OPTIONS_PER_GATE }, () => {
  const h = createHead(geos, mat, mat);
  gateGroup.add(h.group);
  return h;
});
const BASE_Y = 3.85; // any page height works
const posY = (p: number) => BASE_Y + p * HALF;
const toPosition = (y: number) => Math.round(((y - BASE_Y) / HALF) * 1e6) / 1e6;

const failures: string[] = [];
let gatesChecked = 0;
let headsChecked = 0;
let hardAdjacent = 0;
let hardGates = 0;
let shiftedHeads = 0;

const levels: NoteLevel[] = ["easy", "medium", "hard"];
const clefs: ClefChoice[] = ["treble", "bass", "mixed"];
const namings: NamingSystem[] = ["solfege", "letters"];

for (const level of levels) {
  for (const clefChoice of clefs) {
    for (const naming of namings) {
      for (const accidentals of level === "hard" ? [false, true] : [false]) {
        const config: NoteRunnerConfig = { clef: clefChoice, level, naming, accidentals, count: 1 };
        const label = `${level}/${clefChoice}/${naming}${accidentals ? "/♯♭" : ""}`;
        const supply = new GateSupply(config);
        const [lo, hi] = LEVEL_RANGE[level];

        for (let n = 0; n < GATES_PER_CONFIG; n++) {
          const g = supply.next();
          const { note } = g.question;
          const fail = (msg: string) =>
            failures.length < 50 &&
            failures.push(`${label} gate ${n} (${note.step}${note.accidental ?? ""}${note.octave} ${note.clef}): ${msg}`);
          gatesChecked++;

          if (clefChoice !== "mixed" && note.clef !== clefChoice) fail(`clef ${note.clef}`);
          const answer = expectedPosition(note.clef, note.step, note.octave);
          if (g.answer !== answer) fail(`answer position ${g.answer}, expected ${answer}`);

          // Name on the card.
          const sign = note.accidental === "sharp" ? "♯" : note.accidental === "flat" ? "♭" : "";
          const name = (naming === "solfege" ? SOLFEGE[note.step] : note.step) + sign;
          if (g.name !== name) fail(`card says ${g.name}, expected ${name}`);

          // Options.
          const opts = g.options;
          if (opts.length !== OPTIONS_PER_GATE) fail(`${opts.length} options`);
          if (new Set(opts).size !== opts.length) fail(`repeated option ${opts}`);
          if (!opts.includes(answer)) fail(`answer ${answer} not among ${opts}`);
          if (opts.some((p, i) => i > 0 && opts[i - 1] <= p)) fail(`options not highest-first: ${opts}`);
          if (opts.some((p) => p < lo || p > hi)) fail(`option outside ${lo}..${hi}: ${opts}`);
          const letters = opts.map((p) => letterAt(note.clef, p));
          if (new Set(letters).size !== letters.length) fail(`same name twice: ${letters.join(",")}`);
          if (letterAt(note.clef, answer) !== note.step) fail(`answer drawn as ${letterAt(note.clef, answer)}`);
          if (letters.filter((l) => l === note.step).length !== 1) fail(`asked letter appears ${letters}`);
          if (note.accidental) {
            for (const l of letters) {
              if ((note.accidental === "sharp" && (l === "E" || l === "B")) || (note.accidental === "flat" && (l === "C" || l === "F")))
                fail(`option ${l}${sign} isn't used in Ritmo`);
            }
          }

          // Spacing.
          const gaps = opts.slice(1).map((p, i) => opts[i] - p);
          if (gaps.some((d) => d > MAX_OPTION_GAP)) fail(`gap over ${MAX_OPTION_GAP}: ${gaps}`);
          const ones = gaps.filter((d) => d === 1).length;
          if (level === "hard") {
            hardGates++;
            if (ones > 0) hardAdjacent++;
            if (ones > 1) fail(`more than one one-step pair: ${gaps}`);
          } else if (ones > 0) {
            fail(`one-step pair on ${level}: ${gaps}`);
          }
          if (gaps.some((d) => d !== 1 && d < MIN_OPTION_GAP)) fail(`gap under ${MIN_OPTION_GAP}: ${gaps}`);

          // Drawing: lay the heads out with the game's own code, read back.
          layoutHeads(heads, opts, note.accidental, posY, mat);
          gateGroup.updateMatrixWorld(true);
          const xs: number[] = [];
          opts.forEach((p, i) => {
            const h = heads[i];
            headsChecked++;
            if (!h.group.visible || !h.hollow.visible) fail(`head ${p} not visible`);
            const at = toPosition(h.hollow.getWorldPosition(new THREE.Vector3()).y);
            if (at !== p) fail(`head for ${p} drawn at ${at}`);
            const ledgers = h.ledgers
              .filter((l) => l.visible)
              .map((l) => toPosition(l.getWorldPosition(new THREE.Vector3()).y))
              .sort((a, b) => a - b);
            const want = expectedLedgers(p);
            if (JSON.stringify(ledgers) !== JSON.stringify(want))
              fail(`head ${p}: ledger lines at [${ledgers}], expected [${want}]`);
            if (h.signs.sharp.visible !== (note.accidental === "sharp")) fail(`head ${p}: ♯ shown wrongly`);
            if (h.signs.flat.visible !== (note.accidental === "flat")) fail(`head ${p}: ♭ shown wrongly`);
            const x = h.group.position.x;
            if (x !== 0) shiftedHeads++;
            xs.push(x);
          });
          // ♯/♭ signs: left of every head (and its ledger lines), and any
          // two that would touch (a sixth or closer) in different columns.
          if (note.accidental) {
            const signs = opts.map((p, i) => ({
              p,
              x: heads[i].signs[note.accidental as "sharp" | "flat"].getWorldPosition(new THREE.Vector3()).x,
            }));
            const headLeft = Math.min(...xs.map((x) => gateGroup.position.x + x)) - 0.59;
            for (const a of signs) {
              if (a.x + SIGN_COLUMN_WIDTH - 0.12 > headLeft + 1e-9) fail(`sign for ${a.p} overlaps the heads`);
              for (const b of signs) {
                if (b.p < a.p && a.p - b.p <= SIGN_CLASH_DISTANCE && Math.abs(a.x - b.x) < SIGN_COLUMN_WIDTH - 1e-9)
                  fail(`signs for ${a.p} and ${b.p} overlap`);
              }
            }
          }
          // One-step neighbours must not overlap: different columns.
          opts.forEach((p, i) => {
            if (i > 0 && opts[i - 1] - p === 1 && Math.abs(xs[i] - xs[i - 1]) < 1.0)
              fail(`heads ${opts[i - 1]} and ${p} overlap`);
          });
        }
      }
    }
  }
}

console.log(`Checked ${gatesChecked} gates, ${headsChecked} note heads.`);
console.log(
  `Hard: ${hardAdjacent}/${hardGates} gates (${Math.round((100 * hardAdjacent) / Math.max(1, hardGates))}%) had one one-step pair; ${shiftedHeads} heads moved to a second column.`
);
if (failures.length) {
  console.error(`\n${failures.length}${failures.length >= 50 ? "+" : ""} problem(s):`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("All note heads are on the right line/space, with the right ledger lines and options.");

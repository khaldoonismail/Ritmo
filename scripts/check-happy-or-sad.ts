// Automated check for Happy or Sad's music (lib/happyOrSad/pieces.ts).
//
//   npm run check:happy-or-sad
//
// For every Easy and Medium piece, and every Hard melody in both modes
// and every key it can be played in:
//   * every bar adds up to the time signature, and all voices are equally
//     long;
//   * the piece lasts 4–8 seconds;
//   * every note fits the stated key: major pieces use only the major
//     scale; minor pieces the natural minor plus its raised 6th and 7th
//     (harmonic / melodic minor), worked out here from the tonic;
//   * the key's 3rd (major or minor) is actually heard, so the mode can be
//     told apart at all;
//   * Medium: each pair (one major, one minor) has the same tempo and
//     loudness, and the major and minor tempo ranges overlap;
//   * Hard: the major and minor versions of a melody have the same tempo,
//     loudness and rhythm and differ only in the 3rd, 6th and 7th; major
//     and minor tempo ranges overlap;
//   * Easy: happy pieces are faster and louder than sad ones;
//   * every piece is listed in lib/happyOrSad/CREDITS.md;
//   * rounds (lib/happyOrSad/round.ts): 10 pieces, 4–6 of each mode,
//     never 4 of one mode in a row, Hard never the same melody twice in a
//     row, Easy/Medium never the same piece twice in a round.
// Exits with code 1 and lists failures if anything is wrong.

import { readFileSync } from "node:fs";
import {
  EVEN_VOLUME,
  HARD_KEYS,
  HARD_MELODIES,
  PIECES,
  hardPiece,
  parsePiece,
  parseVoice,
  type Piece,
} from "../lib/happyOrSad/pieces";
import { ROUND_LENGTH, buildRound, starsFor } from "../lib/happyOrSad/round";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 50) console.error("✗ " + msg);
};

// Independent reference: note-name → pitch class, and the scales.
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = (name: string) => (LETTER[name[0]] + (name.includes("#") ? 1 : name.includes("b") ? -1 : 0) + 12) % 12;
const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10, 9, 11] };
const THIRD = { major: 4, minor: 3 };

function checkPiece(p: Piece, label = p.id) {
  const voices = p.voices.map((v, i) => parseVoice(v, i, p.transpose ?? 0));
  for (const [i, v] of voices.entries()) {
    v.bars.forEach((b, n) => {
      if (Math.abs(b - p.beatsPerBar) > 1e-6) fail(`${label}: voice ${i + 1} bar ${n + 1} has ${b} beats, not ${p.beatsPerBar}`);
    });
  }
  const lengths = voices.map((v) => v.length);
  if (Math.max(...lengths) - Math.min(...lengths) > 1e-6) fail(`${label}: voices differ in length (${lengths.join(", ")})`);

  const parsed = parsePiece(p);
  if (parsed.seconds < 4 - 1e-6 || parsed.seconds > 8 + 1e-6) fail(`${label}: lasts ${parsed.seconds.toFixed(2)} s (must be 4–8 s)`);

  const tonic = pcOf(p.tonic);
  const allowed = new Set(SCALE[p.mode].map((s) => (tonic + s) % 12));
  const shift = ((p.transpose ?? 0) % 12 + 12) % 12;
  const heard = new Set<number>();
  for (const n of parsed.notes) {
    const pc = ((n.midi % 12) + 12) % 12;
    heard.add(pc);
    if (!allowed.has(pc)) fail(`${label}: note ${n.midi} (pitch class ${pc}) is outside ${p.tonic} ${p.mode}`);
  }
  if (!heard.has((tonic + THIRD[p.mode]) % 12)) fail(`${label}: never plays the ${p.mode} 3rd, so the mode can't be heard`);
  if (!heard.has(tonic)) fail(`${label}: never plays its tonic ${p.tonic}`);
  if (p.level !== "easy" && p.volume !== EVEN_VOLUME) fail(`${label}: volume ${p.volume}, Medium/Hard must all be ${EVEN_VOLUME}`);
  void shift;
  return parsed;
}

// --- Easy and Medium --------------------------------------------------------
for (const p of PIECES) checkPiece(p);

const easy = PIECES.filter((p) => p.level === "easy");
const easyHappy = easy.filter((p) => p.mode === "major");
const easySad = easy.filter((p) => p.mode === "minor");
if (easyHappy.length < 5 || easySad.length < 5) fail(`easy: ${easyHappy.length} happy, ${easySad.length} sad pieces (need 5+ each)`);
if (Math.min(...easyHappy.map((p) => p.bpm)) <= Math.max(...easySad.map((p) => p.bpm))) fail("easy: some sad piece is as fast as a happy one");
if (Math.min(...easyHappy.map((p) => p.volume)) <= Math.max(...easySad.map((p) => p.volume))) fail("easy: some sad piece is as loud as a happy one");

const medium = PIECES.filter((p) => p.level === "medium");
const pairs = new Map<string, Piece[]>();
for (const p of medium) pairs.set(p.pair ?? "?", [...(pairs.get(p.pair ?? "?") ?? []), p]);
for (const [id, ps] of pairs) {
  const modes = ps.map((p) => p.mode).sort().join(",");
  if (modes !== "major,minor") fail(`medium pair ${id}: modes ${modes}`);
  if (new Set(ps.map((p) => p.bpm)).size !== 1) fail(`medium pair ${id}: tempos differ (${ps.map((p) => p.bpm).join(", ")})`);
  if (new Set(ps.map((p) => p.volume)).size !== 1) fail(`medium pair ${id}: loudness differs`);
}
const overlap = (a: number[], b: number[]) => Math.max(Math.min(...a), Math.min(...b)) <= Math.min(Math.max(...a), Math.max(...b));
const medMajor = medium.filter((p) => p.mode === "major").map((p) => p.bpm);
const medMinor = medium.filter((p) => p.mode === "minor").map((p) => p.bpm);
if (!overlap(medMajor, medMinor)) fail(`medium: tempo ranges don't overlap (major ${medMajor}, minor ${medMinor})`);

// --- Hard ---------------------------------------------------------------------
const hardMajorBpm: number[] = [];
const hardMinorBpm: number[] = [];
for (const m of HARD_MELODIES) {
  for (const key of HARD_KEYS) {
    const maj = hardPiece(m, "major", key);
    const min = hardPiece(m, "minor", key);
    const a = checkPiece(maj, `${m.id} major in ${key.name}`);
    const b = checkPiece(min, `${m.id} minor in ${key.name}`);
    hardMajorBpm.push(maj.bpm);
    hardMinorBpm.push(min.bpm);
    if (maj.bpm !== min.bpm || maj.volume !== min.volume) fail(`${m.id} in ${key.name}: modes differ in tempo or loudness`);
    // Same rhythm, and the only changed notes are the 3rd, 6th and 7th
    // (each lowered by a semitone).
    const melodyA = a.notes.filter((n) => n.voice === 0);
    const melodyB = b.notes.filter((n) => n.voice === 0);
    if (melodyA.length !== melodyB.length) fail(`${m.id} in ${key.name}: modes have different numbers of notes`);
    const tonic = pcOf(key.name);
    melodyA.forEach((n, i) => {
      const o = melodyB[i];
      if (!o || o.start !== n.start || o.beats !== n.beats) fail(`${m.id} in ${key.name}: rhythm differs at note ${i + 1}`);
      else if (o.midi !== n.midi) {
        const degree = (((n.midi % 12) - tonic) + 12) % 12;
        if (n.midi - o.midi !== 1 || ![4, 9, 11].includes(degree)) fail(`${m.id} in ${key.name}: note ${i + 1} changed from ${n.midi} to ${o.midi}`);
      }
    });
  }
}
if (!overlap(hardMajorBpm, hardMinorBpm)) fail("hard: tempo ranges don't overlap");

// --- Credits ------------------------------------------------------------------
const credits = readFileSync(new URL("../lib/happyOrSad/CREDITS.md", import.meta.url), "utf8");
for (const t of [...PIECES.map((p) => p.title), ...HARD_MELODIES.map((m) => m.title)]) {
  if (!credits.includes(t)) fail(`credits: "${t}" isn't listed in CREDITS.md`);
}

// --- Rounds -------------------------------------------------------------------
for (const level of ["easy", "medium", "hard"] as const) {
  for (let r = 0; r < 2000; r++) {
    const round = buildRound(level);
    if (round.length !== ROUND_LENGTH) fail(`${level}: round of ${round.length}`);
    const majors = round.filter((p) => p.mode === "major").length;
    if (majors < 4 || majors > 6) fail(`${level}: round with ${majors} major pieces`);
    round.forEach((p, i) => {
      if (p.level !== level) fail(`${level}: round has a ${p.level} piece`);
      if (i >= 3 && [1, 2, 3].every((k) => round[i - k].mode === p.mode)) fail(`${level}: 4 ${p.mode} pieces in a row`);
      if (level === "hard" && i > 0 && round[i - 1].title === p.title) fail("hard: same melody twice in a row");
    });
    if (level !== "hard" && new Set(round.map((p) => p.id)).size !== round.length) fail(`${level}: a piece repeats in one round`);
  }
}
for (const [n, want] of [[10, 3], [9, 3], [8, 2], [6, 2], [5, 1], [0, 1]] as const) {
  if (starsFor(n) !== want) fail(`stars for ${n}/10: ${starsFor(n)}, expected ${want}`);
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
const range = (xs: number[]) => `${Math.min(...xs)}–${Math.max(...xs)}`;
console.log(
  `✓ ${easy.length} Easy pieces (${easyHappy.length} happy, ${easySad.length} sad), ${medium.length} Medium pieces in ${pairs.size} pairs ` +
    `(tempo major ${range(medMajor)}, minor ${range(medMinor)}), ${HARD_MELODIES.length} Hard melodies × 2 modes × ${HARD_KEYS.length} keys: ` +
    "every note fits its key, bars add up, 4–8 s each, all credited."
);

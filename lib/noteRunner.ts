import {
  LEVEL_RANGE,
  STEPS,
  diatonicIndex,
  generateFromConfig,
  noteName,
  staffPosition,
  type Accidental,
  type Clef,
  type NoteLevel,
  type NoteReadingConfig,
  type NoteReadingQuestion,
  type NoteSpec,
  type Step,
} from "@/lib/noteReading";

// Note Runner's rules, kept apart from the 3D code so the server can use
// the same numbers when it checks a submitted run (stage 2).
//
// The game: a horizontal staff seen from the side. The card shows a note's
// NAME ("Sol" / "G"). At each gate four hollow note heads stand on the
// staff at four different lines/spaces; exactly one has that name. Every
// line and space of the level's range is a lane, and the runner must be on
// the right note head when the gate arrives.

export type NoteRunnerConfig = NoteReadingConfig;

export const NOTE_RUNNER_LIVES = 3;
export const OPTIONS_PER_GATE = 4;

// Lanes, top to bottom, as staff positions (half-spaces above the bottom
// line, see lib/noteReading.ts), and the range the page shows.
export function runnerLanes(level: NoteLevel): { lanes: number[]; range: [number, number] } {
  const [lo, hi] = LEVEL_RANGE[level];
  const lanes: number[] = [];
  for (let p = hi; p >= lo; p--) lanes.push(p);
  return { lanes, range: [lo, hi] };
}

// Staff position ↔ note, per clef. Bottom line: E4 in treble, G2 in bass.
const BOTTOM_LINE: Record<Clef, number> = { treble: diatonicIndex("E", 4), bass: diatonicIndex("G", 2) };

export function noteAtPosition(clef: Clef, position: number, accidental: Accidental = null): NoteSpec {
  const d = BOTTOM_LINE[clef] + position;
  const octave = Math.floor(d / 7);
  return { clef, step: STEPS[d - octave * 7] as Step, octave, accidental };
}

// E♯/B♯/C♭/F♭ never appear (same rule as Note Reading).
function validSign(step: Step, accidental: Accidental): boolean {
  if (accidental === "sharp") return step !== "E" && step !== "B";
  if (accidental === "flat") return step !== "C" && step !== "F";
  return true;
}

// Seconds from a gate appearing to reaching the runner, at the start.
export const BASE_GATE_SECONDS: Record<NoteLevel, number> = { easy: 6, medium: 7, hard: 8 };

// Every SPEEDUP_EVERY correct answers the run gets SPEEDUP_FACTOR faster,
// up to MAX_SPEEDUP times the starting speed.
export const SPEEDUP_EVERY = 5;
export const SPEEDUP_FACTOR = 1.06;
export const MAX_SPEEDUP = 1.8;

// Pause after each gate before the next one appears (longer after a
// mistake, so the student can see the right note head).
export const GAP_SECONDS = 1;
export const WRONG_GAP_SECONDS = 1.6;

export function speedMultiplier(correctSoFar: number): number {
  return Math.min(MAX_SPEEDUP, Math.pow(SPEEDUP_FACTOR, Math.floor(correctSoFar / SPEEDUP_EVERY)));
}

export function gateSeconds(level: NoteLevel, correctSoFar: number): number {
  return BASE_GATE_SECONDS[level] / speedMultiplier(correctSoFar);
}

// The fastest a gate can ever go by (used by the stage-2 run check).
export function minSecondsPerGate(level: NoteLevel): number {
  return BASE_GATE_SECONDS[level] / MAX_SPEEDUP + GAP_SECONDS;
}

// 100 per correct note plus 10 for each note already in the streak, up to
// +100. `streakBefore` is the streak before this answer.
export const BASE_POINTS = 100;
export const STREAK_BONUS = 10;
export const MAX_STREAK_BONUS = 100;

export function pointsFor(streakBefore: number): number {
  return BASE_POINTS + Math.min(MAX_STREAK_BONUS, streakBefore * STREAK_BONUS);
}

export interface RunnerGate {
  question: NoteReadingQuestion;
  clef: Clef;
  // What the card shows, e.g. "Sol", "G", "Fa♯".
  name: string;
  // The sign drawn in front of every note head (the asked note's), or null.
  accidental: Accidental;
  // The four note heads' staff positions, highest first. Exactly one is
  // `answer`; no two share a letter name.
  options: number[];
  answer: number;
}

// The rules for one gate's four positions (also used by the automated
// check, scripts/check-note-runner.ts):
//  * all inside the level's range, the answer among them;
//  * no two with the same letter name (positions 7 or 14 apart);
//  * spread out: neighbouring options (sorted) are 2–5 steps apart, so the
//    heads mostly stand in one clear column;
//  * Hard only: sometimes one pair just one step apart (line next to
//    space), for extra challenge. Easy and Medium never have that.
export const MIN_OPTION_GAP = 2;
export const MAX_OPTION_GAP = 5;
// On Hard, how often a gate has one pair of options a step apart.
export const HARD_ADJACENT_CHANCE = 0.3;

export function optionGaps(options: number[]): number[] {
  const sorted = [...options].sort((a, b) => b - a);
  return sorted.slice(1).map((p, i) => sorted[i] - p);
}

export function sameNameClash(options: number[]): boolean {
  return options.some((a, i) => options.some((b, j) => j > i && (a - b) % 7 === 0));
}

// Picks the three wrong positions: every valid set is listed (at most a
// few thousand on Hard) and one is drawn at random, so the result always
// follows the rules above when any valid set exists.
export function pickOptionPositions(
  answer: number,
  level: NoteLevel,
  clef: Clef,
  accidental: Accidental,
  rand: () => number = Math.random
): number[] {
  const [lo, hi] = LEVEL_RANGE[level];
  const candidates: number[] = [];
  for (let p = lo; p <= hi; p++) {
    if (p !== answer && validSign(noteAtPosition(clef, p).step, accidental)) candidates.push(p);
  }

  const spread: number[][] = []; // all gaps 2–5
  const oneAdjacent: number[][] = []; // one gap of 1, the others 2–5 (Hard)
  const loose: number[][] = []; // fallback: any distinct names
  for (let a = 0; a < candidates.length; a++) {
    for (let b = a + 1; b < candidates.length; b++) {
      for (let c = b + 1; c < candidates.length; c++) {
        const set = [answer, candidates[a], candidates[b], candidates[c]];
        if (sameNameClash(set)) continue;
        const gaps = optionGaps(set);
        loose.push(set);
        if (gaps.some((g) => g > MAX_OPTION_GAP)) continue;
        const ones = gaps.filter((g) => g === 1).length;
        if (ones === 0) spread.push(set);
        else if (ones === 1 && gaps.every((g) => g === 1 || g >= MIN_OPTION_GAP)) oneAdjacent.push(set);
      }
    }
  }

  let pool = spread;
  if (level === "hard" && oneAdjacent.length > 0 && (spread.length === 0 || rand() < HARD_ADJACENT_CHANCE)) {
    pool = oneAdjacent;
  }
  if (pool.length === 0) pool = loose; // never happens with the current ranges
  return pool[Math.floor(rand() * pool.length)].sort((x, y) => y - x);
}

export function gateFromQuestion(
  question: NoteReadingQuestion,
  config: NoteRunnerConfig,
  rand: () => number = Math.random
): RunnerGate {
  const { note } = question;
  const answer = staffPosition(note);
  return {
    question,
    clef: note.clef,
    name: noteName(note.step, note.accidental, config.naming),
    accidental: note.accidental,
    options: pickOptionPositions(answer, config.level, note.clef, note.accidental, rand),
    answer,
  };
}

// An endless supply of gates: generates Note Reading questions in batches
// (the generator avoids repeats within a batch) and hands them out one by
// one.
export class GateSupply {
  private queue: NoteReadingQuestion[] = [];
  private lastKey = "";
  constructor(private config: NoteRunnerConfig) {}

  next(): RunnerGate {
    if (this.queue.length === 0) {
      let batch = generateFromConfig({ ...this.config, count: 40 });
      // Don't show the same note twice in a row across batches.
      if (this.lastKey && batch.length > 1 && keyOf(batch[0]) === this.lastKey) {
        batch = [...batch.slice(1), batch[0]];
      }
      this.queue = batch;
    }
    const q = this.queue.shift() as NoteReadingQuestion;
    this.lastKey = keyOf(q);
    return gateFromQuestion(q, this.config);
  }
}

function keyOf(q: NoteReadingQuestion): string {
  return `${q.note.clef}${q.note.step}${q.note.octave}${q.note.accidental ?? ""}`;
}

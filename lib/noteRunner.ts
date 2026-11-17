import {
  DEFAULT_NOTE_READING_CONFIG,
  LEVEL_RANGE,
  generateFromConfig,
  normalizeNoteReadingConfig,
  noteName,
  staffPosition,
  type Clef,
  type NoteLevel,
  type NoteReadingConfig,
  type NoteReadingQuestion,
} from "@/lib/noteReading";

// Note Runner's rules, kept apart from the 3D code so the server can use
// the same numbers when it checks a submitted run (stage 2): modes, lanes,
// gate timing, speed-up and scoring.
//
// Two modes, both on a horizontal staff seen from the side:
//  * "name" — Name the note: the note is shown in a card; the lanes are the
//    staff's four spaces, each with a name sign on the gate.
//  * "find" — Find the note: the note's name is shown; every line and space
//    of the level's range is a lane, and the runner must be on the right one.

export type NoteRunnerMode = "name" | "find";

export const NOTE_RUNNER_MODE_LABELS: Record<NoteRunnerMode, string> = {
  name: "Name the note",
  find: "Find the note",
};

export interface NoteRunnerConfig extends NoteReadingConfig {
  mode: NoteRunnerMode;
}

export const DEFAULT_NOTE_RUNNER_CONFIG: NoteRunnerConfig = {
  ...DEFAULT_NOTE_READING_CONFIG,
  mode: "name",
};

export function normalizeNoteRunnerConfig(value: unknown): NoteRunnerConfig {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return { ...normalizeNoteReadingConfig(value), mode: v.mode === "find" ? "find" : "name" };
}

export const NOTE_RUNNER_LIVES = 3;

// Lanes, top to bottom, as staff positions (half-spaces above the bottom
// line), and the range of positions the page shows.
export function runnerLanes(config: Pick<NoteRunnerConfig, "mode" | "level">): {
  lanes: number[];
  range: [number, number];
} {
  if (config.mode === "name") return { lanes: [7, 5, 3, 1], range: [0, 8] };
  const [lo, hi] = LEVEL_RANGE[config.level];
  const lanes: number[] = [];
  for (let p = hi; p >= lo; p--) lanes.push(p);
  return { lanes, range: [lo, hi] };
}

// Seconds from a gate appearing to reaching the runner, at the start. Find
// mode has more lanes to move through, so it gets longer.
export const BASE_GATE_SECONDS: Record<NoteRunnerMode, Record<NoteLevel, number>> = {
  name: { easy: 5, medium: 5.5, hard: 6 },
  find: { easy: 6, medium: 7, hard: 8 },
};

// Every SPEEDUP_EVERY correct answers the run gets SPEEDUP_FACTOR faster,
// up to MAX_SPEEDUP times the starting speed.
export const SPEEDUP_EVERY = 5;
export const SPEEDUP_FACTOR = 1.06;
export const MAX_SPEEDUP = 1.8;

// Short breather after each gate before the next one appears (longer
// after a mistake, so the student can see the right answer).
export const GAP_SECONDS = 0.6;
export const WRONG_GAP_SECONDS = 1.4;

export function speedMultiplier(correctSoFar: number): number {
  return Math.min(MAX_SPEEDUP, Math.pow(SPEEDUP_FACTOR, Math.floor(correctSoFar / SPEEDUP_EVERY)));
}

export function gateSeconds(config: Pick<NoteRunnerConfig, "mode" | "level">, correctSoFar: number): number {
  return BASE_GATE_SECONDS[config.mode][config.level] / speedMultiplier(correctSoFar);
}

// The fastest a gate can ever go by (used by the stage-2 run check).
export function minSecondsPerGate(config: Pick<NoteRunnerConfig, "mode" | "level">): number {
  return BASE_GATE_SECONDS[config.mode][config.level] / MAX_SPEEDUP + GAP_SECONDS;
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
  // The note's name as the student should read it (find mode's prompt).
  name: string;
  // Name mode: the sign on each lane, top to bottom. Find mode: null.
  signs: string[] | null;
  // The generated note's lane.
  correctLane: number;
  // Every lane that counts as right. Find mode: a name like "Fa" can be on
  // more than one line/space in the range (F4 and F5), and any of them
  // counts. Name mode: just correctLane.
  correctLanes: number[];
}

export function gateFromQuestion(
  question: NoteReadingQuestion,
  config: NoteRunnerConfig,
  rand: () => number = Math.random
): RunnerGate {
  const { note } = question;
  const name = noteName(note.step, note.accidental, config.naming);
  if (config.mode === "find") {
    const { lanes } = runnerLanes(config);
    const target = staffPosition(note);
    // Positions 7 apart are the same letter an octave away.
    const correctLanes = lanes
      .map((p, i) => ((((p - target) % 7) + 7) % 7 === 0 ? i : -1))
      .filter((i) => i >= 0);
    return { question, clef: note.clef, name, signs: null, correctLane: lanes.indexOf(target), correctLanes };
  }
  // The right name plus three close wrong ones, shuffled.
  const signs = [...question.options];
  for (let i = signs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [signs[i], signs[j]] = [signs[j], signs[i]];
  }
  const correct = question.options[question.correctIndex];
  const correctLane = signs.indexOf(correct);
  return { question, clef: note.clef, name, signs, correctLane, correctLanes: [correctLane] };
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

import {
  generateFromConfig,
  type NoteReadingConfig,
  type NoteReadingQuestion,
  type NoteLevel,
} from "@/lib/noteReading";

// Note Runner's rules, kept apart from the 3D code so the server can use
// the same numbers when it checks a submitted run (stage 2): lanes per
// level, gate timing, speed-up and scoring.

export const NOTE_RUNNER_LIVES = 3;

// Easy has 3 lanes, Medium and Hard 4.
export function laneCount(level: NoteLevel): number {
  return level === "easy" ? 3 : 4;
}

// Distance (world units) from where a gate appears to the runner.
export const GATE_DISTANCE = 30;

// Seconds from a gate appearing to reaching the runner, at the start.
export const BASE_GATE_SECONDS: Record<NoteLevel, number> = {
  easy: 5,
  medium: 5.5,
  hard: 6,
};

// Every SPEEDUP_EVERY correct answers the run gets SPEEDUP_FACTOR faster,
// up to MAX_SPEEDUP times the starting speed.
export const SPEEDUP_EVERY = 5;
export const SPEEDUP_FACTOR = 1.06;
export const MAX_SPEEDUP = 1.8;

// Short breather after each gate before the next one appears.
export const GAP_SECONDS = 0.6;

export function speedMultiplier(correctSoFar: number): number {
  return Math.min(MAX_SPEEDUP, Math.pow(SPEEDUP_FACTOR, Math.floor(correctSoFar / SPEEDUP_EVERY)));
}

// World units per second for the next gate.
export function runSpeed(level: NoteLevel, correctSoFar: number): number {
  return (GATE_DISTANCE / BASE_GATE_SECONDS[level]) * speedMultiplier(correctSoFar);
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
  // The lane labels, left to right, and which one is right.
  lanes: string[];
  correctLane: number;
}

// Turns a Note Reading question (4 options) into a gate with `lanes`
// lanes: the right answer plus the closest wrong ones, in shuffled order.
export function gateFromQuestion(
  question: NoteReadingQuestion,
  lanes: number,
  rand: () => number = Math.random
): RunnerGate {
  const correct = question.options[question.correctIndex];
  const wrong = question.options.filter((_, i) => i !== question.correctIndex).slice(0, lanes - 1);
  const labels = [correct, ...wrong];
  for (let i = labels.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [labels[i], labels[j]] = [labels[j], labels[i]];
  }
  return { question, lanes: labels, correctLane: labels.indexOf(correct) };
}

// An endless supply of gates: generates Note Reading questions in batches
// (the generator avoids repeats within a batch) and hands them out one by
// one.
export class GateSupply {
  private queue: NoteReadingQuestion[] = [];
  constructor(private config: NoteReadingConfig) {}

  next(): RunnerGate {
    if (this.queue.length === 0) {
      const last = this.lastKey;
      let batch = generateFromConfig({ ...this.config, count: 40 });
      // Don't show the same note twice in a row across batches.
      if (last && batch.length > 1 && keyOf(batch[0]) === last) batch = [...batch.slice(1), batch[0]];
      this.queue = batch;
    }
    const q = this.queue.shift() as NoteReadingQuestion;
    this.lastKey = keyOf(q);
    return gateFromQuestion(q, laneCount(this.config.level));
  }

  private lastKey = "";
}

function keyOf(q: NoteReadingQuestion): string {
  return `${q.note.clef}${q.note.step}${q.note.octave}${q.note.accidental ?? ""}`;
}

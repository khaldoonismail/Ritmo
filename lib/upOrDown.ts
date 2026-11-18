// Up or Down: an ear-training runner. Before each fork the game plays two
// notes; the child takes the upper path if the second note is higher, the
// lower path if it is lower and, on Hard, the middle "Same" path if both
// notes are identical. These are the game's rules, free of any drawing or
// sound code, so scripts/check-up-or-down.ts can check them.

export type UpOrDownLevel = "easy" | "medium" | "hard";
export type Direction = "up" | "down" | "same";

export const UP_OR_DOWN_LIVES = 3;

export const LEVELS: Record<UpOrDownLevel, { label: string; detail: string; min: number; max: number }> = {
  // Distances in semitones.
  easy: { label: "Easy", detail: "Big jumps: an octave or more", min: 12, max: 19 },
  medium: { label: "Medium", detail: "Middle jumps: a 3rd to a 6th", min: 3, max: 9 },
  hard: { label: "Hard", detail: "Small steps (2nds, even a half step), plus “Same”", min: 1, max: 2 },
};

// On Hard, about 1 question in 4 is "Same".
export const SAME_SHARE = 0.25;

// Notes stay in a comfortable middle range: G3 to A5.
export const LOW_MIDI = 55;
export const HIGH_MIDI = 81;

export interface UpOrDownQuestion {
  first: number; // MIDI note
  second: number;
  answer: Direction;
}

export function hasSamePath(level: UpOrDownLevel): boolean {
  return level === "hard";
}

// Makes the questions for one run. Directions are random but never more
// than three of the same in a row, so guessing one way never pays.
export class QuestionSupply {
  private last: Direction[] = [];
  private lastFirst = -1;

  constructor(
    private level: UpOrDownLevel,
    private random: () => number = Math.random
  ) {}

  next(): UpOrDownQuestion {
    const { min, max } = LEVELS[this.level];
    let answer: Direction;
    do {
      if (hasSamePath(this.level) && this.random() < SAME_SHARE) answer = "same";
      else answer = this.random() < 0.5 ? "up" : "down";
    } while (this.last.length >= 3 && this.last.slice(-3).every((d) => d === answer));
    this.last.push(answer);
    if (this.last.length > 3) this.last.shift();

    const distance = answer === "same" ? 0 : min + Math.floor(this.random() * (max - min + 1));
    const signed = answer === "down" ? -distance : distance;
    // First note: anywhere that keeps the second note in range, and not the
    // same first note as last time.
    const lo = Math.max(LOW_MIDI, LOW_MIDI - signed);
    const hi = Math.min(HIGH_MIDI, HIGH_MIDI - signed);
    let first: number;
    let tries = 0;
    do {
      first = lo + Math.floor(this.random() * (hi - lo + 1));
    } while (first === this.lastFirst && hi > lo && ++tries < 10);
    this.lastFirst = first;
    return { first, second: first + signed, answer };
  }
}

// Points: 10, plus 2 per answer already in the streak (up to +10).
export function pointsFor(streakBefore: number): number {
  return 10 + Math.min(10, streakBefore * 2);
}

// Running speed (world units per second): rises slowly with each right
// answer, up to a cap. The listening time before each fork never shrinks
// below what the notes need (see listenSeconds).
export function runSpeed(correctSoFar: number): number {
  return Math.min(9, 5 + correctSoFar * 0.12);
}

// Note timing: each note sounds for NOTE_SECONDS, with a short silence
// between them so the first note has stopped before the second starts.
export const NOTE_SECONDS = 0.85;
export const NOTE_GAP = 0.25;
export const LEAD_IN = 0.3; // music fades out first
export const PAIR_SECONDS = LEAD_IN + NOTE_SECONDS * 2 + NOTE_GAP;

// Time from the first note to the fork: both notes, then time to think.
// This is ear training, not a reflex test: thinking time shrinks only a
// little as the child gets better, and never below 2 s.
export function listenSeconds(level: UpOrDownLevel, correctSoFar: number): number {
  const think = Math.max(2, (level === "hard" ? 3 : 2.6) - correctSoFar * 0.03);
  return PAIR_SECONDS + think;
}

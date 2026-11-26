import { noteName, type NamingSystem, type Step } from "@/lib/noteReading";

// Piano Hop: a piano keyboard lies on the ground; the card names a note
// ("Fa"), the child hops onto a key with that name. These are the game's
// rules and the keyboard's layout, free of drawing and sound code, so
// scripts/check-piano-hop.ts can check them.

export type PianoLevel = "easy" | "medium" | "hard";

export const PIANO_HOP_LIVES = 3;

// Every level shows a real keyboard, black keys included: their groups of
// 2 and 3 are how children find the notes (C is just left of the 2-group,
// F just left of the 3-group). `blackQuestions`: whether the card also asks
// for black keys (♯/♭). On Easy and Medium it doesn't, but the black keys
// can still be tapped, and count as a wrong answer, like on a real piano.
export const PIANO_LEVELS: Record<
  PianoLevel,
  { label: string; detail: string; octaves: number; blackQuestions: boolean; markers: boolean }
> = {
  easy: { label: "Easy", detail: "One octave, white-key notes, with “Do” marked", octaves: 1, blackQuestions: false, markers: true },
  medium: { label: "Medium", detail: "Two octaves, white-key notes, no markers", octaves: 2, blackQuestions: false, markers: false },
  hard: { label: "Hard", detail: "Two octaves, black keys too (♯ and ♭)", octaves: 2, blackQuestions: true, markers: false },
};

// The lowest key is middle C (C4, MIDI 60).
export const LOWEST_MIDI = 60;

// Pitch classes 0–11 from C. White keys' letter names; black keys sit
// between two white keys and have two names (C♯ = D♭).
const WHITE_PC: Record<number, Step> = { 0: "C", 2: "D", 4: "E", 5: "F", 7: "G", 9: "A", 11: "B" };
const BLACK_NAMES: Record<number, { sharp: Step; flat: Step }> = {
  1: { sharp: "C", flat: "D" },
  3: { sharp: "D", flat: "E" },
  6: { sharp: "F", flat: "G" },
  8: { sharp: "G", flat: "A" },
  10: { sharp: "A", flat: "B" },
};

// Where a black key's centre sits relative to the line between its two
// white keys, in white-key widths: like a real piano, the two-group leans
// apart and the three-group spreads out, so the groups are easy to see.
const BLACK_OFFSET: Record<number, number> = { 1: -0.08, 3: 0.08, 6: -0.1, 8: 0, 10: 0.1 };

export function isBlack(midi: number): boolean {
  return ((midi % 12) + 12) % 12 in BLACK_NAMES;
}

export interface PianoKey {
  midi: number;
  black: boolean;
  // Centre along the keyboard, in white-key widths from the left edge of
  // the lowest key (white key i spans i … i+1, so its centre is i + 0.5).
  x: number;
  // White keys: their letter. Black keys: null (they're named by the
  // question, as a sharp or a flat).
  step: Step | null;
}

export function pianoKeys(level: PianoLevel): PianoKey[] {
  const { octaves } = PIANO_LEVELS[level];
  const top = LOWEST_MIDI + 12 * octaves; // ends on a C
  const keys: PianoKey[] = [];
  let white = 0;
  for (let midi = LOWEST_MIDI; midi <= top; midi++) {
    const pc = midi % 12;
    if (pc in WHITE_PC) {
      keys.push({ midi, black: false, x: white + 0.5, step: WHITE_PC[pc] });
      white++;
    } else {
      keys.push({ midi, black: true, x: white + BLACK_OFFSET[pc], step: null });
    }
  }
  return keys;
}

export function whiteKeyCount(level: PianoLevel): number {
  return 7 * PIANO_LEVELS[level].octaves + 1;
}

export interface PianoQuestion {
  // What the card shows ("Fa", "Do♯", "E♭"…).
  name: string;
  // The pitch class asked (0–11). Every key with this pitch class is right
  // (Medium/Hard have two of most notes), and for a black key both of its
  // names point here.
  pc: number;
}

export function questionName(pc: number, naming: NamingSystem, spelling: "sharp" | "flat" = "sharp"): string {
  if (pc in WHITE_PC) return noteName(WHITE_PC[pc], null, naming);
  const n = BLACK_NAMES[pc];
  return spelling === "sharp" ? noteName(n.sharp, "sharp", naming) : noteName(n.flat, "flat", naming);
}

export function isRight(key: PianoKey, q: PianoQuestion): boolean {
  return key.midi % 12 === q.pc;
}

// Questions for one run: every name on the level comes up, never the same
// note twice in a row. Hard asks about black keys about 1 time in 3, as a
// sharp or a flat at random; Easy and Medium ask white keys only.
export class PianoQuestionSupply {
  private last = -1;
  constructor(
    private level: PianoLevel,
    private naming: NamingSystem,
    private random: () => number = Math.random
  ) {}

  next(): PianoQuestion {
    const black = PIANO_LEVELS[this.level].blackQuestions && this.random() < 0.35;
    const pool = black ? [1, 3, 6, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    let pc: number;
    do pc = pool[Math.floor(this.random() * pool.length)];
    while (pc === this.last);
    this.last = pc;
    const spelling = this.random() < 0.5 ? "sharp" : "flat";
    return { pc, name: questionName(pc, this.naming, spelling) };
  }
}

// 100 per right key plus 10 for each answer already in the streak, up to
// +100 (same as Note Runner).
export function pointsFor(streakBefore: number): number {
  return 100 + Math.min(100, streakBefore * 10);
}

// Seconds to answer: starts relaxed and shrinks a little with each right
// answer, never below a floor a young child can still manage.
const START_SECONDS: Record<PianoLevel, number> = { easy: 8, medium: 9, hard: 10 };
const MIN_SECONDS: Record<PianoLevel, number> = { easy: 3.5, medium: 4, hard: 4.5 };

export function answerSeconds(level: PianoLevel, correctSoFar: number): number {
  return Math.max(MIN_SECONDS[level], START_SECONDS[level] - correctSoFar * 0.15);
}

// Pause after an answer before the next name (longer after a mistake, so
// the child can see and hear the right key), the first name's delay, and
// the shortest a hop can take (the hop, then landing).
export const RIGHT_GAP_MS = 900;
export const WRONG_GAP_MS = 2100;
export const FIRST_NAME_DELAY_MS = 500;
export const HOP_SECONDS = 0.3;
export const HOP_LAND_SECONDS = HOP_SECONDS + 0.15;

export function midiFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

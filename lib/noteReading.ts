// Note Reading games: the student sees one note on a staff (drawn as SVG by
// components/NoteStaff.tsx) and picks its name from 4 options.
//
// Questions are generated once, when the teacher creates the game, and are
// saved into public.games.questions in the same multiple-choice shape every
// other game uses — options are ready-made strings in the teacher's naming
// system and correctIndex points at the right one — plus a `note` object
// that tells the players what to draw. That keeps every grading path
// (Team Battle answer route, submit-game, Individual mode) and the class
// leaderboard unchanged, and gives every student the same questions.

import { sharedGameVariant, sharedSettingsOf, sharedVariantLabel } from "@/lib/sharedGames";

export type Clef = "treble" | "bass";
export type ClefChoice = Clef | "mixed";
export type NoteLevel = "easy" | "medium" | "hard";
export type NamingSystem = "letters" | "solfege";
export type Step = "C" | "D" | "E" | "F" | "G" | "A" | "B";
export type Accidental = "sharp" | "flat" | null;

export interface NoteSpec {
  clef: Clef;
  step: Step;
  octave: number;
  accidental: Accidental;
}

export interface NoteReadingQuestion {
  id: string;
  mediaType: "note";
  prompt: string;
  mediaContent: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
  note: NoteSpec;
}

export interface NoteReadingSettings {
  clef: ClefChoice;
  level: NoteLevel;
  naming: NamingSystem;
  count: number;
  // Only used on Hard.
  accidentals: boolean;
  timeLimit: number;
}

export const STEPS: Step[] = ["C", "D", "E", "F", "G", "A", "B"];
const SOLFEGE: Record<Step, string> = {
  C: "Do",
  D: "Re",
  E: "Mi",
  F: "Fa",
  G: "Sol",
  A: "La",
  B: "Si",
};
const STEP_SEMITONES: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const NOTE_LEVEL_LABELS: Record<NoteLevel, string> = {
  easy: "Easy — on the staff",
  medium: "Medium — up to 2 ledger lines",
  hard: "Hard — up to 3 ledger lines",
};
export const CLEF_LABELS: Record<ClefChoice, string> = {
  treble: "Treble (G)",
  bass: "Bass (F)",
  mixed: "Mixed",
};
export const NAMING_LABELS: Record<NamingSystem, string> = {
  solfege: "Do-Re-Mi",
  letters: "C-D-E",
};

export const NOTE_READING_PROMPT = "Name this note";

// A note's place as a count of diatonic steps from C0 (C4 = 28).
export function diatonicIndex(step: Step, octave: number): number {
  return octave * 7 + STEPS.indexOf(step);
}

function fromDiatonic(d: number): { step: Step; octave: number } {
  return { step: STEPS[((d % 7) + 7) % 7], octave: Math.floor(d / 7) };
}

// Diatonic index of the bottom staff line: E4 for treble, G2 for bass.
const BOTTOM_LINE: Record<Clef, number> = { treble: 30, bass: 18 };

// Staff position in half-spaces above the bottom line: 0 = bottom line,
// 8 = top line, odd = spaces, below 0 / above 8 need ledger lines.
export function staffPosition(note: Pick<NoteSpec, "clef" | "step" | "octave">): number {
  return diatonicIndex(note.step, note.octave) - BOTTOM_LINE[note.clef];
}

// Range of staff positions per level. Easy keeps to the staff (including
// the spaces just below and above it), Medium adds 2 ledger lines each
// side, Hard 3.
//   Treble: Easy D4–G5, Medium A3–C6, Hard F3–E6
//   Bass:   Easy F2–B3, Medium C2–E4, Hard A1–G4
export const LEVEL_RANGE: Record<NoteLevel, [number, number]> = {
  easy: [-1, 9],
  medium: [-4, 12],
  hard: [-6, 14],
};

export const MAX_QUESTIONS = 40;

function isValidAccidental(step: Step, accidental: Accidental): boolean {
  // E♯/B♯/C♭/F♭ are left out: each sounds like a plain white key, so they'd
  // only confuse beginners and could match another option's sound.
  if (accidental === "sharp") return step !== "E" && step !== "B";
  if (accidental === "flat") return step !== "C" && step !== "F";
  return true;
}

function pitchClass(step: Step, accidental: Accidental): number {
  const shift = accidental === "sharp" ? 1 : accidental === "flat" ? -1 : 0;
  return (STEP_SEMITONES[step] + shift + 12) % 12;
}

export function noteName(step: Step, accidental: Accidental, naming: NamingSystem): string {
  const base = naming === "solfege" ? SOLFEGE[step] : step;
  return base + (accidental === "sharp" ? "♯" : accidental === "flat" ? "♭" : "");
}

export function noteFrequency(note: Pick<NoteSpec, "step" | "octave" | "accidental">): number {
  const shift = note.accidental === "sharp" ? 1 : note.accidental === "flat" ? -1 : 0;
  const midi = 12 * (note.octave + 1) + STEP_SEMITONES[note.step] + shift;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Runtime check for notes read back from the database before drawing or
// playing them (the column is plain jsonb).
export function isNoteSpec(value: unknown): value is NoteSpec {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.clef === "treble" || v.clef === "bass") &&
    typeof v.step === "string" &&
    STEPS.includes(v.step as Step) &&
    typeof v.octave === "number" &&
    Number.isInteger(v.octave) &&
    v.octave >= 0 &&
    v.octave <= 8 &&
    (v.accidental === null || v.accidental === undefined || v.accidental === "sharp" || v.accidental === "flat")
  );
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Candidate {
  step: Step;
  accidental: Accidental;
}

// Three wrong answers that are close to the right one: the letters 1 and 2
// steps away on the staff (±2 is also exactly what a student gets by reading
// the note in the wrong clef), and on Hard with accidentals the same letter
// with a different sign. Options never repeat a sound, so F♯ and G♭ can't
// both appear.
export function pickDistractors(
  answer: Candidate,
  allowAccidentals: boolean,
  rand: () => number = Math.random
): Candidate[] {
  const i = STEPS.indexOf(answer.step);
  const at = (offset: number) => STEPS[(i + offset + 7) % 7];

  let primary: Candidate[];
  let backup: Candidate[];
  if (!allowAccidentals) {
    primary = [at(1), at(-1), at(2), at(-2)].map((step) => ({ step, accidental: null }));
    backup = [at(3), at(-3)].map((step) => ({ step, accidental: null }));
  } else if (answer.accidental === null) {
    // A natural note on a level with accidentals: one option with a sign, so
    // the sign itself isn't a giveaway.
    const signed = shuffle<Accidental>(["sharp", "flat"], rand).map((accidental) => ({
      step: answer.step,
      accidental,
    }));
    primary = [
      { step: at(1), accidental: null },
      { step: at(-1), accidental: null },
      signed[0],
    ];
    backup = [signed[1], { step: at(2), accidental: null }, { step: at(-2), accidental: null }];
  } else {
    const other: Accidental = answer.accidental === "sharp" ? "flat" : "sharp";
    primary = [
      { step: answer.step, accidental: null },
      { step: at(1), accidental: answer.accidental },
      { step: at(-1), accidental: answer.accidental },
      { step: answer.step, accidental: other },
    ];
    backup = [
      { step: at(1), accidental: null },
      { step: at(-1), accidental: null },
      { step: at(2), accidental: answer.accidental },
      { step: at(-2), accidental: answer.accidental },
    ];
  }

  const used = new Set([pitchClass(answer.step, answer.accidental)]);
  const picked: Candidate[] = [];
  for (const c of [...shuffle(primary, rand), ...shuffle(backup, rand)]) {
    if (picked.length === 3) break;
    if (!isValidAccidental(c.step, c.accidental)) continue;
    const pc = pitchClass(c.step, c.accidental);
    if (used.has(pc)) continue;
    used.add(pc);
    picked.push(c);
  }
  return picked;
}

function randomId(rand: () => number): string {
  return Math.floor(rand() * 36 ** 10)
    .toString(36)
    .padStart(10, "0");
}

export function generateNoteReadingQuestions(
  settings: NoteReadingSettings,
  rand: () => number = Math.random
): NoteReadingQuestion[] {
  const count = Math.max(1, Math.min(MAX_QUESTIONS, Math.floor(settings.count) || 1));
  const timeLimit = Math.max(5, Math.min(120, Math.floor(settings.timeLimit) || 20));
  const [lo, hi] = LEVEL_RANGE[settings.level];
  const [easyLo, easyHi] = LEVEL_RANGE.easy;
  const allowAccidentals = settings.level === "hard" && settings.accidentals;

  // Mixed games alternate clefs in a shuffled but balanced order.
  const clefs: Clef[] =
    settings.clef === "mixed"
      ? shuffle(
          Array.from({ length: count }, (_, i) => (i % 2 === 0 ? "treble" : "bass") as Clef),
          rand
        )
      : Array.from({ length: count }, () => settings.clef as Clef);

  // One pool of staff positions per clef, used up before any position
  // repeats, so a 10-question game doesn't show the same note three times.
  const pools: Record<Clef, number[]> = { treble: [], bass: [] };
  const allPositions = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const ledgerPositions = allPositions.filter((p) => p < easyLo || p > easyHi);

  const questions: NoteReadingQuestion[] = [];
  let previousKey = "";
  for (let q = 0; q < count; q++) {
    const clef = clefs[q];
    if (pools[clef].length === 0) {
      // Medium/Hard pools get the ledger-line notes twice so they come up
      // about half the time instead of being a small minority.
      const pool = settings.level === "easy" ? allPositions : [...allPositions, ...ledgerPositions];
      pools[clef] = shuffle(pool, rand);
    }
    let position = pools[clef].pop()!;
    if (`${clef}:${position}` === previousKey && pools[clef].length > 0) {
      const swap = pools[clef].pop()!;
      pools[clef].unshift(position);
      position = swap;
    }
    previousKey = `${clef}:${position}`;

    const { step, octave } = fromDiatonic(BOTTOM_LINE[clef] + position);
    let accidental: Accidental = null;
    if (allowAccidentals && rand() < 0.4) {
      const choices = (["sharp", "flat"] as Accidental[]).filter((a) => isValidAccidental(step, a));
      accidental = choices[Math.floor(rand() * choices.length)] ?? null;
    }

    const answer = { step, accidental };
    const all = shuffle([answer, ...pickDistractors(answer, allowAccidentals, rand)], rand);
    questions.push({
      id: randomId(rand),
      mediaType: "note",
      prompt: NOTE_READING_PROMPT,
      mediaContent: "",
      options: all.map((c) => noteName(c.step, c.accidental, settings.naming)),
      correctIndex: all.indexOf(answer),
      timeLimit,
      note: { clef, step, octave, accidental },
    });
  }
  return questions;
}

// ---------------------------------------------------------------------------
// The shared Note Reading game (supabase/migrations/0028_note_reading_single_game.sql)
// ---------------------------------------------------------------------------
// One public game marked games.generator = 'note_reading' with no saved
// questions. The teacher picks these settings each time it's played
// (Individual, Team Battle setup, Assign), and fresh questions are
// generated from them.

export const NOTE_READING_GENERATOR = "note_reading";

export interface NoteReadingConfig {
  clef: ClefChoice;
  level: NoteLevel;
  naming: NamingSystem;
  // Only used on Hard.
  accidentals: boolean;
  count: number;
}

export const DEFAULT_NOTE_READING_CONFIG: NoteReadingConfig = {
  clef: "treble",
  level: "easy",
  naming: "solfege",
  accidentals: false,
  count: 10,
};

// Reads settings back from jsonb (assignments.game_settings,
// game_sessions.settings.noteReading), filling in anything missing or
// invalid with the defaults.
export function normalizeNoteReadingConfig(value: unknown): NoteReadingConfig {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const d = DEFAULT_NOTE_READING_CONFIG;
  const count = Math.floor(Number(v.count));
  return {
    clef: v.clef === "treble" || v.clef === "bass" || v.clef === "mixed" ? v.clef : d.clef,
    level: v.level === "easy" || v.level === "medium" || v.level === "hard" ? v.level : d.level,
    naming: v.naming === "letters" || v.naming === "solfege" ? v.naming : d.naming,
    accidentals: v.accidentals === true,
    count: Number.isFinite(count) ? Math.max(1, Math.min(MAX_QUESTIONS, count)) : d.count,
  };
}

export function generateFromConfig(
  config: NoteReadingConfig,
  timeLimit = 20,
  rand: () => number = Math.random
): NoteReadingQuestion[] {
  return generateNoteReadingQuestions({ ...config, timeLimit }, rand);
}

// The part of the settings that changes difficulty, stored on each result
// (game_results.variant) so the leaderboard never ranks an Easy score
// against a Hard one. Naming and question count don't change difficulty
// (the board ranks by accuracy), so they're left out.
export function noteReadingVariant(config: NoteReadingConfig): string {
  const accidentals = config.level === "hard" && config.accidentals;
  return `${config.clef}-${config.level}${accidentals ? "-accidentals" : ""}`;
}

const CLEF_SHORT: Record<ClefChoice, string> = { treble: "Treble", bass: "Bass", mixed: "Mixed" };
const LEVEL_SHORT: Record<NoteLevel, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

// "treble-easy" → "Treble Easy", "mixed-hard-accidentals" → "Mixed Hard ♯♭".
// Null for anything that isn't a Note Reading variant.
export function variantLabel(variant: string | null | undefined): string | null {
  if (!variant) return null;
  // Piano Hop, Happy or Sad, Rhythm Jump, Music Train ("rhythm-jump:…").
  if (variant.includes(":")) return sharedVariantLabel(variant);
  // Up or Down's variant is its level alone: "hard" → "Hard".
  if (variant === "easy" || variant === "medium" || variant === "hard") return LEVEL_SHORT[variant];
  const [clef, level, extra] = variant.split("-");
  if (!(clef in CLEF_SHORT) || !(level in LEVEL_SHORT)) return null;
  return `${CLEF_SHORT[clef as ClefChoice]} ${LEVEL_SHORT[level as NoteLevel]}${extra === "accidentals" ? " ♯♭" : ""}`;
}

export function configLabel(config: NoteReadingConfig): string {
  return variantLabel(noteReadingVariant(config)) ?? "";
}

// The difficulty label of an assignment's saved settings
// (assignments.game_settings): Note Reading and Note Runner use clef +
// level ("treble-easy"); Up or Down ({ game: "up_or_down" }, see
// lib/runnerGames.ts) uses its level alone ("hard"). Null without settings.
export function settingsVariant(gameSettings: unknown): string | null {
  if (!gameSettings || typeof gameSettings !== "object") return null;
  const v = gameSettings as Record<string, unknown>;
  const shared = sharedSettingsOf(gameSettings);
  if (shared) return sharedGameVariant(shared);
  if (v.game === "up_or_down") {
    return v.level === "medium" || v.level === "hard" ? v.level : "easy";
  }
  return noteReadingVariant(normalizeNoteReadingConfig(gameSettings));
}

// "Treble Easy", "Hard"… for an assignment's settings ("" without any).
export function settingsLabel(gameSettings: unknown): string {
  return variantLabel(settingsVariant(gameSettings)) ?? "";
}

// An assignment's display title: "Note Reading – Treble Easy",
// "Up or Down – Hard"… when it carries settings, else the game's title.
// Used everywhere an assignment is listed (reports, analytics, parent page).
export function assignmentTitle(gameTitle: string, gameSettings: unknown): string {
  const label = settingsLabel(gameSettings);
  return label ? `${gameTitle} – ${label}` : gameTitle;
}

// A grouping key for "the same content": a game plus its settings' level,
// so Treble Easy and Mixed Hard assignments aren't merged.
export function assignmentContentKey(a: {
  lesson_id: string | null;
  game_id: string | null;
  game_settings?: unknown;
}): string {
  if (!a.game_id) return `lesson:${a.lesson_id}`;
  const label = settingsVariant(a.game_settings);
  return label ? `game:${a.game_id}|${label}` : `game:${a.game_id}`;
}

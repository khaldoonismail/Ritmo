import {
  normalizeNoteReadingConfig,
  noteReadingVariant,
  type ClefChoice,
  type NamingSystem,
  type NoteLevel,
  type NoteReadingConfig,
} from "@/lib/noteReading";
import type { UpOrDownLevel } from "@/lib/upOrDown";
import {
  HAPPY_OR_SAD_GENERATOR,
  MUSIC_TRAIN_GENERATOR,
  PIANO_HOP_GENERATOR,
  RHYTHM_JUMP_GENERATOR,
  normalizeHappyOrSadSettings,
  normalizeMusicTrainSettings,
  normalizePianoHopSettings,
  normalizeRhythmJumpSettings,
  sharedGameVariant,
  type SharedGameSettings,
} from "@/lib/sharedGames";

// The shared library games played on their own page with server-timed
// runs ("runner games"): Note Runner and Up or Down
// (supabase/migrations/0029_runner_games.sql), and Piano Hop, Happy or Sad,
// Rhythm Jump and Music Train (0030_stage2_games.sql, lib/sharedGames.ts).
// One public game row each, marked by games.generator, with no saved
// questions. The teacher's choice
// is saved on the assignment (assignments.game_settings), tagged with
// `game` so labels and the server know which game it belongs to.
// Safe for both browser and server code.

export const NOTE_RUNNER_GENERATOR = "note_runner";
export const UP_OR_DOWN_GENERATOR = "up_or_down";
export type RunnerGenerator =
  | typeof NOTE_RUNNER_GENERATOR
  | typeof UP_OR_DOWN_GENERATOR
  | typeof PIANO_HOP_GENERATOR
  | typeof HAPPY_OR_SAD_GENERATOR
  | typeof RHYTHM_JUMP_GENERATOR
  | typeof MUSIC_TRAIN_GENERATOR;

const RUNNER_GENERATORS: string[] = [
  NOTE_RUNNER_GENERATOR,
  UP_OR_DOWN_GENERATOR,
  PIANO_HOP_GENERATOR,
  HAPPY_OR_SAD_GENERATOR,
  RHYTHM_JUMP_GENERATOR,
  MUSIC_TRAIN_GENERATOR,
];

export function isRunnerGenerator(generator: string | null | undefined): generator is RunnerGenerator {
  return !!generator && RUNNER_GENERATORS.includes(generator);
}

// Where a teacher plays it from the library (the stage-1 pages).
export const RUNNER_PAGE: Record<RunnerGenerator, string> = {
  note_runner: "/games/note-runner",
  up_or_down: "/games/up-or-down",
  piano_hop: "/games/piano-hop",
  happy_or_sad: "/games/happy-or-sad",
  rhythm_jump: "/games/rhythm-jump",
  music_train: "/games/fast-or-slow",
};

// How the best result is picked and the leaderboard ranks:
//   * "points": endless runs that end at the last heart (Note Runner, Up
//     or Down, Piano Hop). Accuracy would reward stopping after one right
//     answer; points reward getting far.
//   * "accuracy": fixed rounds (Happy or Sad and Music Train: 10 pieces;
//     Rhythm Jump: 8 rhythms), where every round has the same length, so
//     the share right (Rhythm Jump: timing accuracy) is the fair measure,
//     and it is what the stars come from. Only finished rounds count.
export type RankBy = "points" | "accuracy";

export function rankByOf(generator: string | null | undefined): RankBy {
  return generator === HAPPY_OR_SAD_GENERATOR || generator === RHYTHM_JUMP_GENERATOR || generator === MUSIC_TRAIN_GENERATOR
    ? "accuracy"
    : "points";
}

// "endless run" / "rounds of 10"… for the library list.
export function runnerSizeLabel(generator: RunnerGenerator): string {
  if (generator === HAPPY_OR_SAD_GENERATOR || generator === MUSIC_TRAIN_GENERATOR) return "rounds of 10";
  if (generator === RHYTHM_JUMP_GENERATOR) return "rounds of 8 rhythms";
  return "endless run";
}

export interface NoteRunnerSettings {
  game: "note_runner";
  clef: ClefChoice;
  level: NoteLevel;
  naming: NamingSystem;
  accidentals: boolean;
}

export interface UpOrDownSettings {
  game: "up_or_down";
  level: UpOrDownLevel;
}

export type RunnerSettings = NoteRunnerSettings | UpOrDownSettings | SharedGameSettings;

export function normalizeNoteRunnerSettings(value: unknown): NoteRunnerSettings {
  const c = normalizeNoteReadingConfig(value);
  return {
    game: "note_runner",
    clef: c.clef,
    level: c.level,
    naming: c.naming,
    // Sharps and flats only exist on Hard.
    accidentals: c.level === "hard" && c.accidentals,
  };
}

export function normalizeUpOrDownSettings(value: unknown): UpOrDownSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const level: UpOrDownLevel = v.level === "medium" || v.level === "hard" ? v.level : "easy";
  return { game: "up_or_down", level };
}

export function normalizeRunnerSettings(generator: RunnerGenerator, value: unknown): RunnerSettings {
  switch (generator) {
    case NOTE_RUNNER_GENERATOR:
      return normalizeNoteRunnerSettings(value);
    case UP_OR_DOWN_GENERATOR:
      return normalizeUpOrDownSettings(value);
    case PIANO_HOP_GENERATOR:
      return normalizePianoHopSettings(value);
    case HAPPY_OR_SAD_GENERATOR:
      return normalizeHappyOrSadSettings(value);
    case RHYTHM_JUMP_GENERATOR:
      return normalizeRhythmJumpSettings(value);
    case MUSIC_TRAIN_GENERATOR:
      return normalizeMusicTrainSettings(value);
  }
}

// What the Note Runner game component takes.
export function noteRunnerConfig(s: NoteRunnerSettings): NoteReadingConfig {
  return { clef: s.clef, level: s.level, naming: s.naming, accidentals: s.accidentals, count: 1 };
}

// game_results.variant: one leaderboard per level ("treble-easy", "hard").
export function runnerVariant(s: RunnerSettings): string {
  if (s.game === "note_runner") return noteReadingVariant(noteRunnerConfig(s));
  if (s.game === "up_or_down") return s.level;
  return sharedGameVariant(s);
}

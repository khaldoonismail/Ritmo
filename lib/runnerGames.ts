import {
  normalizeNoteReadingConfig,
  noteReadingVariant,
  type ClefChoice,
  type NamingSystem,
  type NoteLevel,
  type NoteReadingConfig,
} from "@/lib/noteReading";
import type { UpOrDownLevel } from "@/lib/upOrDown";

// Note Runner and Up or Down as shared library games
// (supabase/migrations/0029_runner_games.sql): one public game row each,
// marked by games.generator, with no saved questions. The teacher's choice
// is saved on the assignment (assignments.game_settings), tagged with
// `game` so labels and the server know which game it belongs to.
// Safe for both browser and server code.

export const NOTE_RUNNER_GENERATOR = "note_runner";
export const UP_OR_DOWN_GENERATOR = "up_or_down";
export type RunnerGenerator = typeof NOTE_RUNNER_GENERATOR | typeof UP_OR_DOWN_GENERATOR;

export function isRunnerGenerator(generator: string | null | undefined): generator is RunnerGenerator {
  return generator === NOTE_RUNNER_GENERATOR || generator === UP_OR_DOWN_GENERATOR;
}

// Where a teacher plays it from the library (the stage-1 pages).
export const RUNNER_PAGE: Record<RunnerGenerator, string> = {
  note_runner: "/games/note-runner",
  up_or_down: "/games/up-or-down",
};

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

export type RunnerSettings = NoteRunnerSettings | UpOrDownSettings;

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
  return generator === NOTE_RUNNER_GENERATOR ? normalizeNoteRunnerSettings(value) : normalizeUpOrDownSettings(value);
}

// What the Note Runner game component takes.
export function noteRunnerConfig(s: NoteRunnerSettings): NoteReadingConfig {
  return { clef: s.clef, level: s.level, naming: s.naming, accidentals: s.accidentals, count: 1 };
}

// game_results.variant: one leaderboard per level ("treble-easy", "hard").
export function runnerVariant(s: RunnerSettings): string {
  return s.game === "note_runner" ? noteReadingVariant(noteRunnerConfig(s)) : s.level;
}

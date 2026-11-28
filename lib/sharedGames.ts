import {
  LEVELS as RHYTHM_LEVELS,
  MODE_LABELS,
  TEMPO_LABELS,
  choiceProblem,
  levelOfChoice,
  normalizeChoice,
  presetOf,
  type RhythmChoice,
  type RhythmLevel,
  type RhythmMode,
  type Tempo,
  type ValueKey,
} from "@/lib/rhythmJump";
import type { NamingSystem } from "@/lib/noteReading";
import type { PianoLevel } from "@/lib/pianoHop";
import type { HappyOrSadLevel } from "@/lib/happyOrSad/pieces";
import type { Labels } from "@/lib/happyOrSad/round";
import type { TrainLevel } from "@/lib/fastOrSlow/music";
import type { DynLevel } from "@/lib/loudOrSoft/music";

// Piano Hop, Happy or Sad, Rhythm Jump and Music Train
// (supabase/migrations/0030_stage2_games.sql) and Sleepy Town (Loud or
// Soft, 0031_sleepy_town.sql) as shared library games: the teacher's choice
// saved on an assignment (assignments.game_settings, tagged with `game`),
// its leaderboard variant (game_results.variant) and its label ("Hard",
// "Custom (quarter, quarter rest · 3/4)").
//
// Only lib/rhythmJump.ts is imported at run time (the rest are types), so
// lib/noteReading.ts can use the labels without an import cycle. Safe for
// both browser and server code.

export const PIANO_HOP_GENERATOR = "piano_hop";
export const HAPPY_OR_SAD_GENERATOR = "happy_or_sad";
export const RHYTHM_JUMP_GENERATOR = "rhythm_jump";
export const MUSIC_TRAIN_GENERATOR = "music_train";
export const LOUD_OR_SOFT_GENERATOR = "loud_or_soft";

export interface PianoHopSettings {
  game: "piano_hop";
  level: PianoLevel;
  naming: NamingSystem;
}

export interface HappyOrSadSettings {
  game: "happy_or_sad";
  level: HappyOrSadLevel;
  labels: Labels;
}

export interface RhythmJumpSettings {
  game: "rhythm_jump";
  // A preset level, or the teacher's own note values and time signatures.
  rhythms: RhythmLevel | "custom";
  // Only for "custom" (null for a preset).
  custom: RhythmChoice | null;
  mode: RhythmMode;
  tempo: Tempo;
  // Rhythm syllables under the notes (a reading aid; same board either way).
  syllables: boolean;
}

export interface MusicTrainSettings {
  game: "music_train";
  level: TrainLevel;
  // Italian tempo words (Largo, Allegro…) on the buttons.
  italian: boolean;
}

export interface LoudOrSoftSettings {
  game: "loud_or_soft";
  level: DynLevel;
  // The real markings (pp, p, mf, f, ff, cresc., dim.) next to the answers.
  markings: boolean;
}

export type SharedGameSettings = PianoHopSettings | HappyOrSadSettings | RhythmJumpSettings | MusicTrainSettings | LoudOrSoftSettings;

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => (value && typeof value === "object" ? (value as Obj) : {});
const level3 = (v: unknown): "easy" | "medium" | "hard" => (v === "medium" || v === "hard" ? v : "easy");

export function normalizePianoHopSettings(value: unknown): PianoHopSettings {
  const v = obj(value);
  return { game: "piano_hop", level: level3(v.level), naming: v.naming === "letters" ? "letters" : "solfege" };
}

export function normalizeHappyOrSadSettings(value: unknown): HappyOrSadSettings {
  const v = obj(value);
  return { game: "happy_or_sad", level: level3(v.level), labels: v.labels === "mode" ? "mode" : "mood" };
}

// A custom choice that is exactly a preset becomes that preset (it plays
// the preset's own patterns, as on the stage-1 page). One that can't be
// played falls back to Easy (the assign panel never saves one).
export function normalizeRhythmJumpSettings(value: unknown): RhythmJumpSettings {
  const v = obj(value);
  let rhythms: RhythmLevel | "custom" = v.rhythms === "custom" ? "custom" : level3(v.rhythms);
  let custom: RhythmChoice | null = null;
  if (rhythms === "custom") {
    const choice = normalizeChoice(obj(v.custom));
    const preset = presetOf(choice);
    if (preset) rhythms = preset;
    else if (choiceProblem(choice)) rhythms = "easy";
    else custom = choice;
  }
  return {
    game: "rhythm_jump",
    rhythms,
    custom,
    mode: v.mode === "echo" ? "echo" : "read",
    tempo: v.tempo === "slow" || v.tempo === "fast" ? v.tempo : "normal",
    syllables: v.syllables !== false,
  };
}

export function normalizeMusicTrainSettings(value: unknown): MusicTrainSettings {
  const v = obj(value);
  return { game: "music_train", level: level3(v.level), italian: v.italian === true };
}

export function normalizeLoudOrSoftSettings(value: unknown): LoudOrSoftSettings {
  const v = obj(value);
  return { game: "loud_or_soft", level: level3(v.level), markings: v.markings === true };
}

// How fast and forgiving a Rhythm Jump assignment plays.
export function rhythmPlayLevel(s: RhythmJumpSettings): RhythmLevel {
  return s.custom ? levelOfChoice(s.custom) : (s.rhythms as RhythmLevel);
}

// --- variants (game_results.variant) and labels -------------------------------
//
// Each variant starts with the game's prefix, so a label can be read from
// the variant alone (lib/gameLeaderboard.ts only has the variant):
//   piano-hop:easy · happy-sad:medium · music-train:hard · sleepy-town:hard
//   rhythm-jump:hard:echo:fast · rhythm-jump:custom-q.ee.qr-3.4:read:normal
// Note names, Happy/Sad vs Major/Minor, Italian words, dynamic markings
// and syllables don't
// change how hard a game is, so they're left out (same board).

const LEVEL_WORD: Record<"easy" | "medium" | "hard", string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export function sharedGameVariant(s: SharedGameSettings): string {
  switch (s.game) {
    case "piano_hop":
      return `piano-hop:${s.level}`;
    case "happy_or_sad":
      return `happy-sad:${s.level}`;
    case "music_train":
      return `music-train:${s.level}`;
    case "loud_or_soft":
      return `sleepy-town:${s.level}`;
    case "rhythm_jump": {
      const rhythms = s.custom ? `custom-${s.custom.values.join(".")}-${s.custom.meters.join(".")}` : s.rhythms;
      return `rhythm-jump:${rhythms}:${s.mode}:${s.tempo}`;
    }
  }
}

// Short names for a custom choice's label.
const VALUE_SHORT: Record<ValueKey, string> = {
  w: "whole",
  dh: "dotted half",
  h: "half",
  dqe: "dotted quarter + eighth",
  q: "quarter",
  ee: "eighth pair",
  e: "eighth",
  ssss: "4 sixteenths",
  ess: "eighth + 2 sixteenths",
  sse: "2 sixteenths + eighth",
  wr: "whole rest",
  hr: "half rest",
  qr: "quarter rest",
  er: "eighth rest",
};

export function customChoiceLabel(c: RhythmChoice): string {
  return `Custom (${c.values.map((k) => VALUE_SHORT[k]).join(", ")} · ${c.meters.map((m) => `${m}/4`).join(", ")})`;
}

// "Hard", "Hard · Listen & Echo · Fast", "Custom (quarter, quarter rest ·
// 4/4)"… Null for anything that isn't one of these games' variants.
export function sharedVariantLabel(variant: string): string | null {
  const [prefix, ...rest] = variant.split(":");
  if (prefix === "piano-hop" || prefix === "happy-sad" || prefix === "music-train" || prefix === "sleepy-town") {
    const l = rest[0];
    return l === "easy" || l === "medium" || l === "hard" ? LEVEL_WORD[l] : null;
  }
  if (prefix !== "rhythm-jump") return null;
  const [rhythms, mode, tempo] = rest;
  let base: string | null = null;
  if (rhythms === "easy" || rhythms === "medium" || rhythms === "hard") base = RHYTHM_LEVELS[rhythms].label;
  else if (rhythms?.startsWith("custom-")) {
    const [, values = "", meters = ""] = rhythms.split("-");
    const choice = normalizeChoice({ values: values.split("."), meters: meters.split(".").map(Number) });
    if (choice.values.length && choice.meters.length) base = customChoiceLabel(choice);
  }
  if (!base) return null;
  const parts = [base];
  if (mode === "echo") parts.push(MODE_LABELS.echo);
  if (tempo === "slow" || tempo === "fast") parts.push(TEMPO_LABELS[tempo]);
  return parts.join(" · ");
}

// The settings of an assignment for one of these games (by its `game`
// tag), or null for anything else.
export function sharedSettingsOf(gameSettings: unknown): SharedGameSettings | null {
  const g = obj(gameSettings).game;
  if (g === "piano_hop") return normalizePianoHopSettings(gameSettings);
  if (g === "happy_or_sad") return normalizeHappyOrSadSettings(gameSettings);
  if (g === "rhythm_jump") return normalizeRhythmJumpSettings(gameSettings);
  if (g === "music_train") return normalizeMusicTrainSettings(gameSettings);
  if (g === "loud_or_soft") return normalizeLoudOrSoftSettings(gameSettings);
  return null;
}

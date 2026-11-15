// Server-anchored Team Battle question clock (supabase/migrations/
// 0024_team_battle_hardening.sql). Shared by the answer route, which grades
// speed from it, and by the host and student screens, which only display
// it — so every device shows the same countdown the server will grade by.

export interface QuestionTiming {
  questionStartedAt: string | null;
  pausedAt: string | null;
  pausedSeconds: number;
  timeLimitSeconds: number;
  extensionSeconds: number;
}

// Grace period for answers that arrive just after the clock hits zero, so a
// student who tapped at 0.2s left isn't rejected for network latency.
export const LATE_ANSWER_GRACE_SECONDS = 2;

// Unrounded seconds left on the current question at `nowMs` (server time).
// Can go negative once time is up. A paused question is measured up to the
// moment it was paused, so the clock stays frozen until resume.
export function secondsLeft(timing: QuestionTiming, nowMs: number): number {
  const total = timing.timeLimitSeconds + timing.extensionSeconds;
  if (!timing.questionStartedAt) return total;
  const measuredTo = timing.pausedAt ? Date.parse(timing.pausedAt) : nowMs;
  const elapsed = (measuredTo - Date.parse(timing.questionStartedAt)) / 1000 - timing.pausedSeconds;
  return total - elapsed;
}

// Whole seconds for display, never below zero and never above the limit
// (a stale nowMs would otherwise show more time than the question has).
export function displaySecondsLeft(timing: QuestionTiming, nowMs: number): number {
  const total = timing.timeLimitSeconds + timing.extensionSeconds;
  return Math.min(total, Math.max(0, Math.ceil(secondsLeft(timing, nowMs))));
}

// Maps a game_sessions row (snake_case, as read from Supabase) plus its
// settings onto QuestionTiming.
export function timingFromSessionRow(
  row: {
    question_started_at?: string | null;
    paused_at?: string | null;
    paused_seconds?: number | string | null;
    time_extension_seconds?: number | null;
  },
  timeLimitSeconds: number
): QuestionTiming {
  return {
    questionStartedAt: row.question_started_at ?? null,
    pausedAt: row.paused_at ?? null,
    pausedSeconds: Number(row.paused_seconds ?? 0),
    timeLimitSeconds,
    extensionSeconds: row.time_extension_seconds ?? 0,
  };
}

// Reveal countdown for auto-advance (supabase/migrations/
// 0026_auto_advance.sql). While status = 'reveal', paused_at marks a paused
// countdown and reveal_paused_seconds holds earlier paused stretches.
export interface RevealTiming {
  revealStartedAt: string | null;
  pausedAt: string | null;
  pausedSeconds: number;
  revealSeconds: number;
}

// Matches the database default when settings.revealSeconds is missing.
export const DEFAULT_REVEAL_SECONDS = 5;
export const REVEAL_SECONDS_CHOICES = [3, 5, 10] as const;

// Unrounded seconds left before the auto-advance, at `nowMs` (server time).
// Frozen while paused; negative once the countdown is over.
export function revealSecondsLeft(timing: RevealTiming, nowMs: number): number {
  if (!timing.revealStartedAt) return timing.revealSeconds;
  const measuredTo = timing.pausedAt ? Date.parse(timing.pausedAt) : nowMs;
  const elapsed = (measuredTo - Date.parse(timing.revealStartedAt)) / 1000 - timing.pausedSeconds;
  return timing.revealSeconds - elapsed;
}

export function revealTimingFromSessionRow(
  row: {
    status?: string;
    reveal_started_at?: string | null;
    paused_at?: string | null;
    reveal_paused_seconds?: number | string | null;
  },
  revealSeconds: number
): RevealTiming {
  return {
    revealStartedAt: row.reveal_started_at ?? null,
    pausedAt: row.status === "reveal" ? row.paused_at ?? null : null,
    pausedSeconds: Number(row.reveal_paused_seconds ?? 0),
    revealSeconds,
  };
}

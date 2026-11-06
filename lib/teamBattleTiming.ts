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

// Whole seconds for display, never below zero.
export function displaySecondsLeft(timing: QuestionTiming, nowMs: number): number {
  return Math.max(0, Math.ceil(secondsLeft(timing, nowMs)));
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

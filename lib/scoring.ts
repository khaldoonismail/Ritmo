// Team Battle's server-side point formula. A fresh copy of the exact
// Kahoot-style formula already used by the single-device "Play Demo"
// (app/games/play/[id]/page.tsx's finishQuestion) rather than a shared
// import, so that file — and Individual mode's behavior — stays untouched.

export function computeAnswerPoints(params: {
  correct: boolean;
  timerEnabled: boolean;
  timeLimitSeconds: number;
  timeLeftSeconds: number;
}): number {
  const { correct, timerEnabled, timeLimitSeconds, timeLeftSeconds } = params;
  if (!correct) return 0;
  if (!timerEnabled) return 1000;
  const clampedTimeLeft = Math.max(0, Math.min(timeLeftSeconds, timeLimitSeconds));
  return Math.round(500 + 500 * (clampedTimeLeft / timeLimitSeconds));
}

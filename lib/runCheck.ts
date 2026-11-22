import { LEVEL_RANGE, STEPS, staffPosition, type Accidental, type Clef, type NoteSpec, type Step } from "@/lib/noteReading";
import {
  GAP_SECONDS,
  NOTE_RUNNER_LIVES,
  gateSeconds,
  pointsFor as noteRunnerPoints,
} from "@/lib/noteRunner";
import {
  HIGH_MIDI,
  LEVELS,
  LOW_MIDI,
  UP_OR_DOWN_LIVES,
  hasSamePath,
  listenSeconds,
  pointsFor as upOrDownPoints,
  type Direction,
} from "@/lib/upOrDown";
import type { NoteRunnerSettings, RunnerSettings, UpOrDownSettings } from "@/lib/runnerGames";

// Checks a finished Note Runner / Up or Down run and scores it on the
// server (app/api/student/runs/finish). The browser makes the notes and
// sends back every answer; the client's own score is never trusted:
//   * every note / pair of notes must be one the chosen level can make
//     (clef, range, sharps and flats; interval size, "Same" only on Hard);
//   * the run ends at the last heart: no answers after it;
//   * there can't be more answers than the game could have asked in the
//     time since the server started the run (each gate / fork takes at
//     least its travel time at the speed reached by then);
//   * points are recalculated here with the game's own rules.

export const MAX_RUN_ANSWERS = 3000;

// Slack for network delay and timer rounding: the run may be this much
// faster than the game's fastest possible pace, and no more.
const TIME_FACTOR = 0.9;
const TIME_SLACK_SECONDS = 3;

export interface RunScore {
  points: number;
  correct: number;
  total: number;
  bestStreak: number;
  // 0–100, for student_progress.score and the reports.
  accuracy: number;
}

export type RunCheck = { ok: true; score: RunScore } | { ok: false; reason: string };

const fail = (reason: string): RunCheck => ({ ok: false, reason });

export function checkRun(settings: RunnerSettings, answers: unknown, elapsedSeconds: number): RunCheck {
  if (!Array.isArray(answers)) return fail("answers missing");
  if (answers.length > MAX_RUN_ANSWERS) return fail("too many answers");
  return settings.game === "note_runner"
    ? checkNoteRunner(settings, answers, elapsedSeconds)
    : checkUpOrDown(settings, answers, elapsedSeconds);
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

// E♯/B♯/C♭/F♭ never appear (lib/noteReading.ts makes none).
function validSign(step: Step, accidental: Accidental): boolean {
  if (accidental === "sharp") return step !== "E" && step !== "B";
  if (accidental === "flat") return step !== "C" && step !== "F";
  return true;
}

function timeCheck(elapsedSeconds: number, minimumSeconds: number): string | null {
  if (elapsedSeconds < minimumSeconds * TIME_FACTOR - TIME_SLACK_SECONDS) {
    return `too fast: ${elapsedSeconds.toFixed(1)}s for a run that needs at least ${minimumSeconds.toFixed(1)}s`;
  }
  return null;
}

function finish(points: number, correct: number, total: number, bestStreak: number): RunScore {
  return {
    points,
    correct,
    total,
    bestStreak,
    accuracy: total > 0 ? Math.round((10000 * correct) / total) / 100 : 0,
  };
}

function checkNoteRunner(s: NoteRunnerSettings, answers: unknown[], elapsed: number): RunCheck {
  const [lo, hi] = LEVEL_RANGE[s.level];
  const clefs: Clef[] = s.clef === "mixed" ? ["treble", "bass"] : [s.clef];
  let lives = NOTE_RUNNER_LIVES;
  let streak = 0;
  let bestStreak = 0;
  let correct = 0;
  let points = 0;
  let minimum = 0;

  for (let i = 0; i < answers.length; i++) {
    if (lives <= 0) return fail("answers after the last heart");
    const a = answers[i] as { note?: Partial<NoteSpec>; picked?: unknown } | null;
    const n = a?.note;
    if (!n || typeof n !== "object") return fail(`answer ${i}: no note`);
    const accidental = n.accidental ?? null;
    if (
      !clefs.includes(n.clef as Clef) ||
      !STEPS.includes(n.step as Step) ||
      !isInt(n.octave) ||
      (accidental !== null && accidental !== "sharp" && accidental !== "flat")
    ) {
      return fail(`answer ${i}: not a note`);
    }
    if (accidental !== null && !s.accidentals) return fail(`answer ${i}: sharp/flat not in this level`);
    if (!validSign(n.step as Step, accidental)) return fail(`answer ${i}: impossible sharp/flat`);
    const position = staffPosition({ clef: n.clef as Clef, step: n.step as Step, octave: n.octave });
    if (position < lo || position > hi) return fail(`answer ${i}: note outside the level's range`);
    if (!isInt(a!.picked) || a!.picked < lo || a!.picked > hi) return fail(`answer ${i}: picked lane outside the staff`);

    // The gate travels for gateSeconds at the speed reached so far, with
    // a pause between gates.
    minimum += gateSeconds(s.level, correct) + (i > 0 ? GAP_SECONDS : 0);
    if (a!.picked === position) {
      points += noteRunnerPoints(streak);
      correct++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      lives--;
      streak = 0;
    }
  }

  const slow = timeCheck(elapsed, minimum);
  if (slow) return fail(slow);
  return { ok: true, score: finish(points, correct, answers.length, bestStreak) };
}

function checkUpOrDown(s: UpOrDownSettings, answers: unknown[], elapsed: number): RunCheck {
  const { min, max } = LEVELS[s.level];
  const same = hasSamePath(s.level);
  let lives = UP_OR_DOWN_LIVES;
  let streak = 0;
  let bestStreak = 0;
  let correct = 0;
  let points = 0;
  let minimum = 0;

  for (let i = 0; i < answers.length; i++) {
    if (lives <= 0) return fail("answers after the last heart");
    const a = answers[i] as { first?: unknown; second?: unknown; picked?: unknown } | null;
    const { first, second, picked } = a ?? {};
    if (!isInt(first) || !isInt(second)) return fail(`answer ${i}: no notes`);
    if (first < LOW_MIDI || first > HIGH_MIDI || second < LOW_MIDI || second > HIGH_MIDI) {
      return fail(`answer ${i}: note outside the range`);
    }
    const distance = Math.abs(second - first);
    if (distance === 0 ? !same : distance < min || distance > max) {
      return fail(`answer ${i}: interval not in this level`);
    }
    if (picked !== null && picked !== "up" && picked !== "down" && !(same && picked === "same")) {
      return fail(`answer ${i}: not a path`);
    }

    // From the first note to the fork takes at least listenSeconds.
    minimum += listenSeconds(s.level, correct);
    const answer: Direction = second > first ? "up" : second < first ? "down" : "same";
    if (picked === answer) {
      points += upOrDownPoints(streak);
      correct++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      lives--;
      streak = 0;
    }
  }

  const slow = timeCheck(elapsed, minimum);
  if (slow) return fail(slow);
  return { ok: true, score: finish(points, correct, answers.length, bestStreak) };
}

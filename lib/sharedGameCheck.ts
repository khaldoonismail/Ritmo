import {
  FIRST_NAME_DELAY_MS,
  HOP_LAND_SECONDS,
  LOWEST_MIDI,
  PIANO_HOP_LIVES,
  PIANO_LEVELS,
  RIGHT_GAP_MS,
  WRONG_GAP_MS,
  answerSeconds,
  pointsFor as pianoHopPoints,
} from "@/lib/pianoHop";
import { HARD_KEYS, HARD_MELODIES, hardPiece, parsePiece, piecesFor, type Mode, type Piece } from "@/lib/happyOrSad/pieces";
import { FINISH_DELAY_MS, FIRST_PIECE_DELAY_MS, GAP_MS, ROUND_LENGTH as HAPPY_ROUND } from "@/lib/happyOrSad/round";
import {
  ARRIVE_SECONDS,
  CHANGE_FROM_TO,
  MELODIES,
  RIDE_LEAD_SECONDS,
  RIDE_TAIL_SECONDS,
  ROUND_LENGTH as TRAIN_ROUND,
  TEMPO_RANGES,
  TRANSPOSES,
  TRAPS,
  answersFor,
  render,
  repeatsFor,
  type Answer as TrainAnswer,
  type Melody,
  type Question as TrainQuestion,
  type Speed,
} from "@/lib/fastOrSlow/music";
import {
  BETWEEN_SECONDS,
  END_TAIL_SECONDS,
  LEVELS as RHYTHM_LEVELS,
  PATTERNS_PER_ROUND,
  RATING_POINTS,
  SPLASH_PENALTY,
  START_LEAD_SECONDS,
  TOKEN_BEATS,
  accuracy as rhythmAccuracy,
  barMatchesChoice,
  bpmFor,
  isRest,
  judgeTap,
  layoutPattern,
  padsFor,
  usesLevelFeature,
  windowsFor,
  type Pattern,
  type Rating,
  type Token,
} from "@/lib/rhythmJump";
import {
  rhythmPlayLevel,
  type HappyOrSadSettings,
  type MusicTrainSettings,
  type PianoHopSettings,
  type RhythmJumpSettings,
} from "@/lib/sharedGames";

// Server checks for Piano Hop, Happy or Sad, Rhythm Jump and Music Train
// runs (called by lib/runCheck.ts, from app/api/student/runs/finish). The
// browser makes the questions and sends back each one with the child's
// answer; the server never trusts the browser's score:
//   * every question must be one the teacher's settings can make (and a
//     round must be put together the way the game builds rounds);
//   * the score is worked out again here with the game's own rules;
//   * the run can't have been faster than the game can go: each question
//     takes at least its music / countdown / pause, so the time since the
//     server started the run must cover them all;
//   * Piano Hop ends at the last heart; the other three only count whole
//     rounds (they're ranked by accuracy, and a quit half-round would be an
//     unfair 100 %).
// Rhythm Jump's timing is judged again from the taps themselves: see
// checkRhythmJump.

export interface RunScore {
  points: number;
  correct: number;
  total: number;
  bestStreak: number;
  // 0–100, for student_progress.score, the reports and accuracy boards.
  accuracy: number;
}

export type RunCheck = { ok: true; score: RunScore } | { ok: false; reason: string };

export const fail = (reason: string): RunCheck => ({ ok: false, reason });

// Slack for network delay and timer rounding: the run may be this much
// faster than the game's fastest possible pace, and no more.
const TIME_FACTOR = 0.9;
const TIME_SLACK_SECONDS = 3;

export function timeCheck(elapsedSeconds: number, minimumSeconds: number): string | null {
  if (elapsedSeconds < minimumSeconds * TIME_FACTOR - TIME_SLACK_SECONDS) {
    return `too fast: ${elapsedSeconds.toFixed(1)}s for a run that needs at least ${minimumSeconds.toFixed(1)}s`;
  }
  return null;
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const pct = (correct: number, total: number) => (total > 0 ? Math.round((10000 * correct) / total) / 100 : 0);

function longestStreak(right: boolean[]): number {
  let best = 0;
  let run = 0;
  for (const r of right) {
    run = r ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

// --- Piano Hop ------------------------------------------------------------------
// answers: [{ pc: 0–11 (the note asked), picked: MIDI of the key landed on,
// or null for "Too late!" }]

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_PCS = [1, 3, 6, 8, 10];

export function checkPianoHop(s: PianoHopSettings, answers: unknown[], elapsed: number): RunCheck {
  const { octaves, blackQuestions } = PIANO_LEVELS[s.level];
  const top = LOWEST_MIDI + 12 * octaves;
  let lives = PIANO_HOP_LIVES;
  let streak = 0;
  let bestStreak = 0;
  let correct = 0;
  let points = 0;
  let minimum = FIRST_NAME_DELAY_MS / 1000;
  let lastPc = -1;

  for (let i = 0; i < answers.length; i++) {
    if (lives <= 0) return fail("answers after the last heart");
    const a = answers[i] as { pc?: unknown; picked?: unknown } | null;
    const pc = a?.pc;
    const picked = a?.picked ?? null;
    if (!isInt(pc) || !(WHITE_PCS.includes(pc) || (blackQuestions && BLACK_PCS.includes(pc)))) {
      return fail(`answer ${i}: note not in this level`);
    }
    // The game never asks the same note twice in a row.
    if (pc === lastPc) return fail(`answer ${i}: same note twice in a row`);
    lastPc = pc;
    if (picked !== null && (!isInt(picked) || picked < LOWEST_MIDI || picked > top)) {
      return fail(`answer ${i}: key not on the keyboard`);
    }

    const right = picked !== null && picked % 12 === pc;
    // A tap takes the hop to land; "Too late!" takes the whole countdown.
    // Then the pause before the next name (not after the last answer: the
    // run may end right there).
    minimum += picked === null ? answerSeconds(s.level, correct) : HOP_LAND_SECONDS;
    if (i < answers.length - 1) minimum += (right ? RIGHT_GAP_MS : WRONG_GAP_MS) / 1000;
    if (right) {
      points += pianoHopPoints(streak);
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
  return { ok: true, score: { points, correct, total: answers.length, bestStreak, accuracy: pct(correct, answers.length) } };
}

// --- Happy or Sad ----------------------------------------------------------------
// answers: [{ piece: the piece id ("eine-kleine"; Hard: "twinkle-minor-Eb"),
// picked: "major" | "minor" }] — exactly one round.

const HAPPY_PIECES = new Map<string, Piece>(
  (["easy", "medium"] as const).flatMap((l) => piecesFor(l).map((p) => [p.id, p] as [string, Piece]))
);
const HARD_PIECES = new Map<string, { piece: Piece; melody: string }>(
  HARD_MELODIES.flatMap((m) =>
    (["major", "minor"] as Mode[]).flatMap((mode) =>
      HARD_KEYS.map((k) => {
        const piece = hardPiece(m, mode, k);
        return [piece.id, { piece, melody: m.id }] as [string, { piece: Piece; melody: string }];
      })
    )
  )
);

export function checkHappyOrSad(s: HappyOrSadSettings, answers: unknown[], elapsed: number): RunCheck {
  if (answers.length !== HAPPY_ROUND) return fail(`a round has ${HAPPY_ROUND} pieces, got ${answers.length}`);
  const pieces: Piece[] = [];
  const right: boolean[] = [];
  const melodies: string[] = [];
  for (let i = 0; i < answers.length; i++) {
    const a = answers[i] as { piece?: unknown; picked?: unknown } | null;
    const id = a?.piece;
    if (typeof id !== "string") return fail(`answer ${i}: no piece`);
    let piece: Piece | undefined;
    if (s.level === "hard") {
      const hard = HARD_PIECES.get(id);
      if (hard) {
        // A melody never comes twice in a row (and at most twice a round).
        if (melodies[melodies.length - 1] === hard.melody) return fail(`answer ${i}: same melody twice in a row`);
        melodies.push(hard.melody);
        piece = hard.piece;
      }
    } else {
      const p = HAPPY_PIECES.get(id);
      if (p && p.level === s.level) piece = p;
      if (piece && pieces.some((x) => x.id === id)) return fail(`answer ${i}: a piece came twice`);
    }
    if (!piece) return fail(`answer ${i}: piece not in this level`);
    if (a!.picked !== "major" && a!.picked !== "minor") return fail(`answer ${i}: not an answer`);
    pieces.push(piece);
    right.push(a!.picked === piece.mode);
  }
  if (s.level === "hard" && melodies.some((m) => melodies.filter((x) => x === m).length > 2)) {
    return fail("a melody came more than twice");
  }
  // 5 happy and 5 sad, never 4 of one in a row.
  const modes = pieces.map((p) => p.mode);
  if (modes.filter((m) => m === "major").length !== HAPPY_ROUND / 2) return fail("not 5 happy and 5 sad");
  if (modes.some((m, i) => i >= 3 && modes[i - 1] === m && modes[i - 2] === m && modes[i - 3] === m)) {
    return fail("4 of one mood in a row");
  }

  // Every piece plays to its end before the next one (an early answer
  // doesn't skip it), with a pause between pieces.
  const minimum =
    FIRST_PIECE_DELAY_MS / 1000 +
    pieces.reduce((t, p) => t + parsePiece(p).seconds, 0) +
    ((HAPPY_ROUND - 1) * GAP_MS) / 1000 +
    FINISH_DELAY_MS / 1000;
  const slow = timeCheck(elapsed, minimum);
  if (slow) return fail(slow);
  const correct = right.filter(Boolean).length;
  return {
    ok: true,
    score: { points: correct * 100, correct, total: HAPPY_ROUND, bestStreak: longestStreak(right), accuracy: pct(correct, HAPPY_ROUND) },
  };
}

// --- Music Train ---------------------------------------------------------------------
// answers: [{ melody, bpm, bpmTo (getting faster/slower; else null),
// transpose, repeats, picked }] — exactly one round. The right answer is
// worked out here from the tempo (the browser's isn't sent).

const TRAIN_MELODIES = new Map<string, Melody>([...MELODIES, ...TRAPS].map((m) => [m.id, m]));

function speedOf(level: MusicTrainSettings["level"], bpm: number): Speed | null {
  for (const [speed, range] of Object.entries(TEMPO_RANGES[level]) as [Speed, [number, number]][]) {
    if (bpm >= range[0] && bpm <= range[1]) return speed;
  }
  return null;
}

export function checkMusicTrain(s: MusicTrainSettings, answers: unknown[], elapsed: number): RunCheck {
  if (answers.length !== TRAIN_ROUND) return fail(`a round has ${TRAIN_ROUND} pieces, got ${answers.length}`);
  const questions: TrainQuestion[] = [];
  const right: boolean[] = [];
  for (let i = 0; i < answers.length; i++) {
    const a = answers[i] as { melody?: unknown; bpm?: unknown; bpmTo?: unknown; transpose?: unknown; repeats?: unknown; picked?: unknown } | null;
    const melody = typeof a?.melody === "string" ? TRAIN_MELODIES.get(a.melody) : undefined;
    if (!melody) return fail(`answer ${i}: unknown melody`);
    if (!isInt(a!.bpm) || !isInt(a!.transpose) || !TRANSPOSES.includes(a!.transpose)) return fail(`answer ${i}: bad tempo or key`);
    const bpmTo = a!.bpmTo ?? null;
    let answer: TrainAnswer;
    if (bpmTo !== null) {
      // Getting faster / slower: Hard only, ordinary melodies, fixed tempos.
      if (s.level !== "hard" || melody.trap || !isInt(bpmTo)) return fail(`answer ${i}: changing tempo not in this level`);
      const change = (["faster", "slower"] as const).find(
        (c) => CHANGE_FROM_TO[c][0] === a!.bpm && CHANGE_FROM_TO[c][1] === bpmTo
      );
      if (!change || a!.repeats !== 1) return fail(`answer ${i}: not a changing tempo`);
      answer = change;
    } else {
      const speed = speedOf(s.level, a!.bpm);
      if (!speed) return fail(`answer ${i}: tempo not in this level`);
      if (a!.repeats !== repeatsFor(melody, a!.bpm)) return fail(`answer ${i}: wrong number of repeats`);
      // Traps are Hard only: busy ones slow, calm ones fast.
      if (melody.trap && (s.level !== "hard" || (melody.trap === "busy" ? speed !== "slow" : speed !== "fast"))) {
        return fail(`answer ${i}: trap piece not in this level`);
      }
      answer = speed;
    }
    const choices: TrainAnswer[] = bpmTo !== null ? ["faster", "slower"] : answersFor(s.level);
    if (!choices.includes(a!.picked as TrainAnswer)) return fail(`answer ${i}: not an answer`);
    questions.push({
      level: s.level,
      melody,
      answer,
      bpm: a!.bpm,
      bpmTo: bpmTo ?? undefined,
      transpose: a!.transpose,
      repeats: a!.repeats as number,
    });
    right.push(a!.picked === answer);
  }

  const round = roundShapeProblem(s.level, questions);
  if (round) return fail(round);

  // Each piece plays once before the child can answer, again for the ride,
  // and then the train pulls into the next station.
  const minimum = questions.reduce((t, q) => {
    const secs = render(q).seconds;
    return t + 0.12 + secs + RIDE_LEAD_SECONDS + secs + RIDE_TAIL_SECONDS + ARRIVE_SECONDS;
  }, 0);
  const slow = timeCheck(elapsed, minimum);
  if (slow) return fail(slow);
  const correct = right.filter(Boolean).length;
  return {
    ok: true,
    score: { points: correct * 100, correct, total: TRAIN_ROUND, bestStreak: longestStreak(right), accuracy: pct(correct, TRAIN_ROUND) },
  };
}

// The round must be built the way buildRound builds it (lib/fastOrSlow/music.ts).
function roundShapeProblem(level: MusicTrainSettings["level"], qs: TrainQuestion[]): string | null {
  const byMelody = new Map<string, Speed[]>();
  for (const q of qs) byMelody.set(q.melody.id, [...(byMelody.get(q.melody.id) ?? []), q.answer as Speed]);
  const sorted = (xs: string[]) => [...xs].sort().join(",");
  if (level === "easy") {
    // 5 melodies, each once slow and once fast.
    if (byMelody.size !== 5 || [...byMelody.values()].some((v) => sorted(v) !== "fast,slow")) return "not an Easy round";
    return null;
  }
  if (level === "medium") {
    // 3 melodies at all three tempos, plus one more melody once.
    const shapes = [...byMelody.values()].map((v) => sorted(v));
    const full = shapes.filter((x) => x === "fast,medium,slow").length;
    const single = shapes.filter((x) => x === "fast" || x === "medium" || x === "slow").length;
    if (byMelody.size !== 4 || full !== 3 || single !== 1) return "not a Medium round";
    return null;
  }
  // Hard: 2 faster + 2 slower, 2 busy (slow) + 2 calm (fast) traps, one
  // ordinary slow and one ordinary fast; every melody once.
  if (byMelody.size !== TRAIN_ROUND) return "not a Hard round (a melody came twice)";
  const count = (f: (q: TrainQuestion) => boolean) => qs.filter(f).length;
  const ok =
    count((q) => q.answer === "faster") === 2 &&
    count((q) => q.answer === "slower") === 2 &&
    count((q) => q.melody.trap === "busy") === 2 &&
    count((q) => q.melody.trap === "calm") === 2 &&
    count((q) => !q.melody.trap && q.bpmTo === undefined && q.answer === "slow") === 1 &&
    count((q) => !q.melody.trap && q.bpmTo === undefined && q.answer === "fast") === 1;
  return ok ? null : "not a Hard round";
}

// --- Rhythm Jump -------------------------------------------------------------------------
// answers: [{ meter, bars: Token[][], taps: seconds from the pattern's first
// beat, device delay already taken off, in the order they were made }] —
// one per pattern, exactly one round.
//
// Judging the timing on the server: the browser can't be asked for the
// ratings (it could send all "Perfect!"), so it sends the raw tap times and
// the server rates them again with the game's own windows (judgeTap). The
// tap times themselves can't be proven, so they must also look human:
//   * at most MAX_TAPS a pattern (spamming taps only makes splashes,
//     which cost points, but this keeps the payload small);
//   * when there are enough hits, their offsets from the notes must spread
//     at least MIN_SPREAD_SECONDS (standard deviation). Real taps on a
//     screen or a key wander by 15–40 ms even for very good players; a
//     script that sends the note times exactly (or one fixed offset from
//     them) has almost none. A wrong calibration shifts every tap the same
//     way, which doesn't change the spread, so it never trips this;
//   * the round can't take less time than its count-ins and patterns.

const MAX_TAPS = 64;
const MIN_HITS_FOR_SPREAD = 12;
const MIN_SPREAD_SECONDS = 0.006;

const TOKENS = new Set(Object.keys(TOKEN_BEATS));

export function checkRhythmJump(s: RhythmJumpSettings, answers: unknown[], elapsed: number): RunCheck {
  if (answers.length !== PATTERNS_PER_ROUND) {
    return fail(`a round has ${PATTERNS_PER_ROUND} rhythms, got ${answers.length}`);
  }
  const level = rhythmPlayLevel(s);
  const echo = s.mode === "echo";
  const barCount = echo ? 1 : 2;
  const bpm = bpmFor(level, s.tempo);
  const spb = 60 / bpm;
  const meters = s.custom ? s.custom.meters : RHYTHM_LEVELS[level].meters;

  const ratings: Rating[] = [];
  const offsets: number[] = [];
  let splashes = 0;
  let minimum = 0;
  let previous = "";

  for (let i = 0; i < answers.length; i++) {
    const a = answers[i] as { meter?: unknown; bars?: unknown; taps?: unknown } | null;
    const meter = a?.meter;
    if (!isInt(meter) || !meters.includes(meter)) return fail(`rhythm ${i}: time signature not in these settings`);
    if (!Array.isArray(a!.bars) || a!.bars.length !== barCount) return fail(`rhythm ${i}: wrong number of bars`);
    const bars: Token[][] = [];
    for (const bar of a!.bars as unknown[]) {
      if (!Array.isArray(bar) || bar.length === 0 || bar.length > 16 || !bar.every((t) => typeof t === "string" && TOKENS.has(t))) {
        return fail(`rhythm ${i}: not a bar`);
      }
      const tokens = bar as Token[];
      if (Math.abs(tokens.reduce((t, x) => t + TOKEN_BEATS[x], 0) - meter) > 1e-9) return fail(`rhythm ${i}: bar doesn't add up`);
      bars.push(tokens);
    }
    const pattern: Pattern = { meter, bars };
    const problem = patternProblem(s, level, pattern, previous);
    if (problem) return fail(`rhythm ${i}: ${problem}`);
    previous = JSON.stringify(pattern);

    const taps = a!.taps;
    if (!Array.isArray(taps) || taps.length > MAX_TAPS || !taps.every((t) => isNum(t) && Math.abs(t) < 120)) {
      return fail(`rhythm ${i}: bad taps`);
    }
    const layout = layoutPattern(pattern);
    const pads = padsFor(layout, bpm);
    const wins = windowsFor(pads, level);
    const results: (Rating | null)[] = pads.map(() => null);
    for (const t of taps as number[]) {
      const res = judgeTap(t, layout, pads, wins, results, spb);
      if (res.kind === "note") {
        results[res.pad] = res.rating;
        offsets.push(res.offset);
      } else if (res.kind === "splash") splashes++;
    }
    ratings.push(...results.map((r) => r ?? "miss"));

    const patternSeconds = layout.totalBeats * spb;
    const barSeconds = meter * spb;
    minimum +=
      START_LEAD_SECONDS +
      (echo ? barSeconds + patternSeconds : 0) +
      barSeconds +
      patternSeconds +
      END_TAIL_SECONDS +
      BETWEEN_SECONDS[s.mode];
  }

  if (offsets.length >= MIN_HITS_FOR_SPREAD) {
    const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;
    const sd = Math.sqrt(offsets.reduce((a, b) => a + (b - mean) ** 2, 0) / offsets.length);
    if (sd < MIN_SPREAD_SECONDS) {
      return fail(`taps too exact to be human: ${(sd * 1000).toFixed(1)} ms spread over ${offsets.length} notes`);
    }
  }
  const slow = timeCheck(elapsed, minimum);
  if (slow) return fail(slow);

  const hits = ratings.map((r) => r !== "miss");
  const correct = hits.filter(Boolean).length;
  const points = Math.max(0, Math.round(ratings.reduce((t, r) => t + RATING_POINTS[r] * 100, 0) - splashes * SPLASH_PENALTY * 100));
  return {
    ok: true,
    score: {
      points,
      correct,
      total: ratings.length,
      bestStreak: longestStreak(hits),
      accuracy: Math.round(rhythmAccuracy(ratings, splashes) * 10000) / 100,
    },
  };
}

// Could the game have made this pattern with these settings? (makeRound /
// makeCustomRound in lib/rhythmJump.ts.)
function patternProblem(s: RhythmJumpSettings, level: ReturnType<typeof rhythmPlayLevel>, p: Pattern, previous: string): string | null {
  const first = p.bars[0][0];
  if (isRest(first)) return "starts with a rest";
  if (s.custom) {
    const values = s.custom.values;
    if (!p.bars.every((bar) => barMatchesChoice(bar, values, p.meter))) return "uses values not in these settings";
    return null;
  }
  const pool = RHYTHM_LEVELS[level].bars[p.meter] ?? [];
  if (!p.bars.every((bar) => pool.includes(bar.join(" ")))) return "bar not in this level";
  if (!p.bars[p.bars.length - 1].some((t) => !isRest(t))) return "last bar has no note";
  const notes = p.bars.flat().filter((t) => !isRest(t)).length;
  if (notes < (p.bars.length === 1 ? 2 : 3)) return "too few notes";
  if (!usesLevelFeature(level, p)) return "doesn't use this level's rhythms";
  if (JSON.stringify(p) === previous) return "same rhythm twice in a row";
  return null;
}

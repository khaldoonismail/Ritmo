// Checks the server's checks and scoring for Piano Hop, Happy or Sad,
// Rhythm Jump and Music Train (lib/sharedGameCheck.ts, via lib/runCheck.ts)
// with rounds made by the games' own round makers: hundreds of honest
// rounds at a real pace must all pass and score like the game does;
// too-fast runs, questions outside the settings, half rounds, answers
// after the last heart and machine-exact rhythm taps must be rejected.
// Also checks the settings labels and leaderboard variants.
// Run: npm run check:shared-games
import { checkRun } from "../lib/runCheck";
import { PianoQuestionSupply, answerSeconds, pointsFor, HOP_LAND_SECONDS, RIGHT_GAP_MS, WRONG_GAP_MS, FIRST_NAME_DELAY_MS, LOWEST_MIDI } from "../lib/pianoHop";
import { buildRound as buildHappyRound } from "../lib/happyOrSad/round";
import { parsePiece } from "../lib/happyOrSad/pieces";
import { buildRound as buildTrainRound, render, answersFor, type Answer } from "../lib/fastOrSlow/music";
import {
  PRESET_CHOICES,
  accuracy,
  bpmFor,
  judgeTap,
  layoutPattern,
  makeCustomRound,
  makeRound,
  padsFor,
  windowsFor,
  type Pattern,
  type Rating,
  type RhythmChoice,
} from "../lib/rhythmJump";
import {
  normalizeHappyOrSadSettings,
  normalizeMusicTrainSettings,
  normalizePianoHopSettings,
  normalizeRhythmJumpSettings,
  rhythmPlayLevel,
  sharedGameVariant,
} from "../lib/sharedGames";
import { assignmentTitle, variantLabel } from "../lib/noteReading";

let failures = 0;
const expect = (ok: boolean, msg: string) => {
  if (!ok) {
    failures++;
    console.error("✗ " + msg);
  }
};
const LEVELS = ["easy", "medium", "hard"] as const;
const HOURS = 3600;

// --- Piano Hop -----------------------------------------------------------------
function pianoRun(level: (typeof LEVELS)[number], pattern: ("right" | "wrong" | "late")[]) {
  const settings = normalizePianoHopSettings({ level, naming: "letters" });
  const supply = new PianoQuestionSupply(level, "letters");
  let correct = 0;
  let streak = 0;
  let points = 0;
  let seconds = FIRST_NAME_DELAY_MS / 1000;
  const answers = pattern.map((kind, i) => {
    const q = supply.next();
    const rightKey = LOWEST_MIDI + q.pc + (level === "easy" ? 0 : 12);
    seconds += kind === "late" ? answerSeconds(level, correct) : HOP_LAND_SECONDS;
    if (i < pattern.length - 1) seconds += (kind === "right" ? RIGHT_GAP_MS : WRONG_GAP_MS) / 1000;
    if (kind === "right") {
      points += pointsFor(streak);
      correct++;
      streak++;
    } else streak = 0;
    const picked = kind === "late" ? null : kind === "right" ? rightKey : rightKey === LOWEST_MIDI ? LOWEST_MIDI + 1 : rightKey - 1;
    return { pc: q.pc, picked };
  });
  return { settings, answers, seconds, points };
}

for (const level of LEVELS) {
  for (let n = 0; n < 200; n++) {
    const pattern = [...Array(5 + (n % 30)).fill("right"), "wrong", "right", "late", "wrong"] as ("right" | "wrong" | "late")[];
    const r = pianoRun(level, pattern);
    const c = checkRun(r.settings, r.answers, r.seconds);
    expect(c.ok && c.score.points === r.points, `Piano Hop ${level}: honest run rejected or mis-scored (${!c.ok && c.reason})`);
    if (n === 0) {
      expect(!checkRun(r.settings, r.answers, r.seconds * 0.5 - 5).ok, `Piano Hop ${level}: too fast accepted`);
      expect(!checkRun(r.settings, [...r.answers, r.answers[0]], r.seconds + 10).ok, `Piano Hop ${level}: answer after last heart accepted`);
    }
  }
}
{
  const r = pianoRun("easy", ["right", "right"]);
  expect(!checkRun(r.settings, [{ pc: 1, picked: 61 }], 60).ok, "Piano Hop: black key question on Easy accepted");
  expect(!checkRun(r.settings, [{ pc: 0, picked: 96 }], 60).ok, "Piano Hop: key off the keyboard accepted");
  expect(!checkRun(r.settings, [{ pc: 0, picked: 60 }, { pc: 0, picked: 60 }], 60).ok, "Piano Hop: same note twice in a row accepted");
  expect(checkRun(normalizePianoHopSettings({ level: "hard" }), [{ pc: 1, picked: 61 }], 60).ok, "Piano Hop: black key on Hard rejected");
}

// --- Happy or Sad ----------------------------------------------------------------
for (const level of LEVELS) {
  const settings = normalizeHappyOrSadSettings({ level });
  for (let n = 0; n < 300; n++) {
    const round = buildHappyRound(level);
    const seconds = 0.6 + round.reduce((t, p) => t + parsePiece(p).seconds, 0) + 9 * 0.9 + 0.5 + 10;
    const answers = round.map((p, i) => ({ piece: p.id, picked: i % 3 === 0 ? (p.mode === "major" ? "minor" : "major") : p.mode }));
    const c = checkRun(settings, answers, seconds);
    expect(c.ok && c.score.correct === 6 && c.score.accuracy === 60, `Happy or Sad ${level}: honest round rejected or mis-scored (${!c.ok && c.reason})`);
    if (n === 0) {
      expect(!checkRun(settings, answers, 10).ok, `Happy or Sad ${level}: too fast accepted`);
      expect(!checkRun(settings, answers.slice(0, 9), seconds).ok, `Happy or Sad ${level}: half round accepted`);
    }
  }
  const other = buildHappyRound(level === "easy" ? "medium" : "easy");
  expect(!checkRun(settings, other.map((p) => ({ piece: p.id, picked: p.mode })), 600).ok, `Happy or Sad ${level}: other level's pieces accepted`);
}

// --- Music Train ---------------------------------------------------------------------
for (const level of LEVELS) {
  const settings = normalizeMusicTrainSettings({ level });
  for (let n = 0; n < 300; n++) {
    const round = buildTrainRound(level);
    const seconds = round.reduce((t, q) => t + 2 * render(q).seconds + 2.4, 0) + 5;
    const answers = round.map((q, i) => {
      const options: Answer[] = q.bpmTo !== undefined ? ["faster", "slower"] : answersFor(level);
      const picked = i < 7 ? q.answer : options.find((o) => o !== q.answer)!;
      return { melody: q.melody.id, bpm: q.bpm, bpmTo: q.bpmTo ?? null, transpose: q.transpose, repeats: q.repeats, picked };
    });
    const c = checkRun(settings, answers, seconds);
    expect(c.ok && c.score.correct === 7, `Music Train ${level}: honest round rejected or mis-scored (${!c.ok && c.reason})`);
    if (n === 0) {
      expect(!checkRun(settings, answers, 20).ok, `Music Train ${level}: too fast accepted`);
      const tampered = answers.map((a, i) => (i === 0 && a.bpmTo === null ? { ...a, bpm: 120 } : a));
      if (tampered[0] !== answers[0]) expect(!checkRun(settings, tampered, seconds).ok, `Music Train ${level}: tempo outside the level accepted`);
    }
  }
}

// --- Rhythm Jump ---------------------------------------------------------------------------
// Taps for a pattern: each note hit with human-like wobble (± ~25 ms), or
// skipped; `splash` adds a tap on nothing.
function rhythmRun(settings: ReturnType<typeof normalizeRhythmJumpSettings>, round: Pattern[], jitter: () => number, skip = 0) {
  const level = rhythmPlayLevel(settings);
  const bpm = bpmFor(level, settings.tempo);
  const spb = 60 / bpm;
  const ratings: Rating[] = [];
  let splashes = 0;
  let seconds = 5;
  const answers = round.map((p, i) => {
    const layout = layoutPattern(p);
    const pads = padsFor(layout, bpm);
    const wins = windowsFor(pads, level);
    const results: (Rating | null)[] = pads.map(() => null);
    const taps: number[] = [];
    pads.forEach((pad, k) => {
      if (k < skip) return;
      taps.push(pad.time + jitter());
    });
    if (i === 0) taps.push(layout.totalBeats * spb + 0.1); // a late extra tap
    for (const t of taps) {
      const res = judgeTap(t, layout, pads, wins, results, spb);
      if (res.kind === "note") results[res.pad] = res.rating;
      else if (res.kind === "splash") splashes++;
    }
    ratings.push(...results.map((r) => r ?? "miss"));
    const bar = p.meter * spb;
    seconds += 0.35 + (settings.mode === "echo" ? bar + layout.totalBeats * spb : 0) + bar + layout.totalBeats * spb + 0.2 + (settings.mode === "echo" ? 1.7 : 0.9);
    return { meter: p.meter, bars: p.bars, taps };
  });
  return { answers, seconds, accuracy: Math.round(accuracy(ratings, splashes) * 10000) / 100 };
}

let seed = 1;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const human = () => (rand() + rand() + rand() - 1.5) * 0.05; // ~±25 ms

const customChoices: RhythmChoice[] = [
  { values: ["q", "ee", "qr"], meters: [3] },
  { values: ["h", "q", "e", "er", "hr"], meters: [2, 4] },
  { values: ["w", "dh", "q", "ssss", "ess", "sse", "wr"], meters: [3, 4] },
];
const configs = [
  ...LEVELS.flatMap((l) => (["read", "echo"] as const).flatMap((mode) => (["slow", "normal", "fast"] as const).map((tempo) => ({ rhythms: l, mode, tempo })))),
  ...customChoices.flatMap((c) => (["read", "echo"] as const).map((mode) => ({ rhythms: "custom", custom: c, mode, tempo: "normal" }))),
];
for (const cfg of configs) {
  const settings = normalizeRhythmJumpSettings(cfg);
  const barCount = settings.mode === "echo" ? 1 : 2;
  for (let n = 0; n < 60; n++) {
    const round = settings.custom ? makeCustomRound(settings.custom, Math.random, barCount) : makeRound(settings.rhythms as "easy", Math.random, barCount);
    const r = rhythmRun(settings, round, human, n % 2);
    const c = checkRun(settings, r.answers, r.seconds);
    expect(c.ok && c.score.accuracy === r.accuracy, `Rhythm Jump ${sharedGameVariant(settings)}: honest round rejected or mis-scored (${!c.ok && c.reason})`);
    if (n === 0) {
      expect(!checkRun(settings, r.answers, 15).ok, `Rhythm Jump ${sharedGameVariant(settings)}: too fast accepted`);
      const exact = rhythmRun(settings, round, () => 0.003);
      expect(!checkRun(settings, exact.answers, exact.seconds).ok, `Rhythm Jump ${sharedGameVariant(settings)}: machine-exact taps accepted`);
      expect(!checkRun(settings, r.answers.slice(0, 7), r.seconds).ok, `Rhythm Jump ${sharedGameVariant(settings)}: half round accepted`);
    }
  }
}
{
  // A custom assignment can't be sent another level's rhythms.
  const settings = normalizeRhythmJumpSettings({ rhythms: "custom", custom: customChoices[0], mode: "read" });
  const r = rhythmRun(settings, makeRound("hard"), human);
  expect(!checkRun(settings, r.answers, HOURS).ok, "Rhythm Jump custom: Hard patterns accepted");
  const easy = normalizeRhythmJumpSettings({ rhythms: "easy" });
  const e = rhythmRun(easy, makeRound("medium"), human);
  expect(!checkRun(easy, e.answers, HOURS).ok, "Rhythm Jump easy: Medium patterns accepted");
}

// --- labels and variants -------------------------------------------------------------------
const label = (s: object) => variantLabel(sharedGameVariant(s as never));
expect(assignmentTitle("Piano Hop", { game: "piano_hop", level: "medium", naming: "letters" }) === "Piano Hop – Medium", "Piano Hop title");
expect(assignmentTitle("Music Train", { game: "music_train", level: "hard" }) === "Music Train – Hard", "Music Train title");
expect(assignmentTitle("Happy or Sad", { game: "happy_or_sad", level: "easy", labels: "mode" }) === "Happy or Sad – Easy", "Happy or Sad title");
expect(label(normalizeRhythmJumpSettings({ rhythms: "hard", mode: "echo", tempo: "fast" })) === "Hard · Listen & Echo · Fast", "Rhythm Jump preset label");
expect(
  assignmentTitle("Rhythm Jump", { game: "rhythm_jump", rhythms: "custom", custom: customChoices[0] }) ===
    "Rhythm Jump – Custom (quarter, eighth pair, quarter rest · 3/4)",
  "Rhythm Jump custom title: " + assignmentTitle("Rhythm Jump", { game: "rhythm_jump", rhythms: "custom", custom: customChoices[0] })
);
expect(
  normalizeRhythmJumpSettings({ rhythms: "custom", custom: PRESET_CHOICES.medium }).rhythms === "medium",
  "a custom choice equal to a preset becomes the preset"
);
expect(variantLabel("hard") === "Hard" && variantLabel("treble-easy") === "Treble Easy", "older variants still label");

if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("✓ shared games: honest rounds pass with the game's own score; cheats are rejected; labels read right");

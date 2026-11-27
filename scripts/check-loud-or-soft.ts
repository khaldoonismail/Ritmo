// Automated check for Loud or Soft / Sleepy Town (lib/loudOrSoft/music.ts).
//
//   npm run check:loud-or-soft
//
//   * every tune: bars add up, both voices equally long, and the
//     accompaniment plays on every beat;
//   * loudness: the markings are in order (pp < p < mp < mf < f < ff); the
//     answers on screen at each level are clearly apart in dB (Easy's soft
//     and loud at least 15 dB, every other pair at least 6 dB), and every
//     rendered piece's notes really are struck at its answer's level; the
//     reference phrase is always at mf;
//   * the cap: no note is ever louder than CAP_GAIN, ff stays under it,
//     notes struck together never add up past full scale, and the limiter
//     after the mix is a real limiter (threshold below 0 dB, ratio ≥ 10);
//   * louder = brighter: the filter cutoff rises with the level;
//   * Hard: crescendo pieces really rise and diminuendo pieces really fall
//     (note by note, and at least 12 dB from start to end); subito pieces
//     jump at least 12 dB at once, on a bar line, with at least 1.5 s
//     steady on each side;
//   * tempo, key and register never give the answer away: over 3000
//     rounds per level each answer uses the same tempos, keys and register
//     as the others, and the same melody plays at several levels;
//   * every piece lasts 4–8 s, the reference phrase 1.5–4 s;
//   * rounds of 10 with the right mix, no melody twice in a row;
//   * every tune is in lib/loudOrSoft/CREDITS.md, nothing Hebrew/Israeli.

import { readFileSync } from "node:fs";
import {
  ACCOMPANIMENT_GAIN,
  CAP_GAIN,
  LEVEL_DB,
  LIMITER,
  MELODIES,
  MELODY_GAIN,
  MF_GAIN,
  ROUND_LENGTH,
  TEMPO_RANGE,
  TRANSPOSES,
  answersFor,
  brightnessHz,
  buildRound,
  dbAt,
  question,
  render,
  repeatsFor,
  starsFor,
  wakeAt,
  type Answer,
  type DynLevel,
  type Kind,
  type Mark,
  type Part,
  type Question,
} from "../lib/loudOrSoft/music";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 50) console.error("✗ " + msg);
};
const LEVELS: DynLevel[] = ["easy", "medium", "hard"];
const dB = (g: number) => 20 * Math.log10(g);
// A note's level in dB relative to mf, from its gain.
const noteDb = (n: { gain: number; voice: number }) => dB(n.gain / (n.voice === 0 ? MELODY_GAIN : ACCOMPANIMENT_GAIN) / MF_GAIN);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// Deterministic random numbers, so a failure can be reproduced.
let seed = 12345;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

// --- the tunes (read with our own little parser) -----------------------------------
const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function readVoice(v: string) {
  const bars: number[] = [];
  const starts: number[] = [];
  let t = 0;
  let bar = 0;
  for (const tok of v.trim().split(/\s+/)) {
    if (tok === "|") {
      bars.push(bar);
      bar = 0;
      continue;
    }
    const [p, d] = tok.split(":");
    const beats = Number(d);
    if (!(beats > 0)) fail(`bad length "${tok}"`);
    if (p !== "r") {
      if (!/^[A-G][#b]?\d$/.test(p)) fail(`bad pitch "${tok}"`);
      void STEP[p[0]];
      starts.push(t);
    }
    t += beats;
    bar += beats;
  }
  bars.push(bar);
  return { bars, starts, length: t };
}
for (const m of MELODIES) {
  const [mel, acc] = m.voices.map(readVoice);
  for (const v of [mel, acc]) if (v.bars.some((b) => Math.abs(b - m.beatsPerBar) > 1e-9)) fail(`${m.id}: bars ${v.bars.join(",")} not ${m.beatsPerBar}`);
  if (mel.length !== acc.length) fail(`${m.id}: voices ${mel.length} vs ${acc.length} beats`);
  for (let b = 0; b < acc.length; b++) if (!acc.starts.some((s) => Math.abs(s - b) < 1e-9)) fail(`${m.id}: no accompaniment on beat ${b + 1}`);
}

// --- loudness levels ------------------------------------------------------------------
const ORDER: Mark[] = ["pp", "p", "mp", "mf", "f", "ff"];
for (let i = 1; i < ORDER.length; i++) if (!(LEVEL_DB[ORDER[i]] > LEVEL_DB[ORDER[i - 1]])) fail(`${ORDER[i]} is not louder than ${ORDER[i - 1]}`);
if (LEVEL_DB.mf !== 0) fail("mf must be the 0 dB reference");
const steadyDb = (a: Answer) => LEVEL_DB[a as Mark];
for (const level of LEVELS) {
  const as = answersFor(level, "steady");
  for (let i = 1; i < as.length; i++) {
    const gap = steadyDb(as[i]) - steadyDb(as[i - 1]);
    const need = level === "easy" ? 15 : 6;
    if (!(gap >= need)) fail(`${level}: ${as[i - 1]} → ${as[i]} only ${gap} dB apart (need ${need})`);
  }
}

// The cap and the limiter.
if (!(MF_GAIN * Math.pow(10, LEVEL_DB.ff / 20) <= CAP_GAIN)) fail("ff is above the cap");
if (!(CAP_GAIN <= 0.85)) fail(`cap ${CAP_GAIN} too high`);
if (!(LIMITER.thresholdDb < 0 && LIMITER.ratio >= 10 && LIMITER.attack <= 0.005)) fail("the limiter is not a limiter");

// Louder = brighter; the town wakes with the music.
for (let d = LEVEL_DB.pp; d < LEVEL_DB.ff; d += 0.5) {
  if (!(brightnessHz(d + 0.5) > brightnessHz(d))) fail(`brightness doesn't rise at ${d} dB`);
  if (wakeAt(d + 0.5) < wakeAt(d)) fail(`wake falls at ${d} dB`);
}
if (!(brightnessHz(LEVEL_DB.pp) < 1500 && brightnessHz(LEVEL_DB.ff) > 10000)) fail("brightness range too small");
if (wakeAt(LEVEL_DB.p) !== 0 || wakeAt(LEVEL_DB.f) !== 1 || !(wakeAt(LEVEL_DB.mf) > 0.3 && wakeAt(LEVEL_DB.mf) < 0.8)) fail("wake levels");

// --- every piece -------------------------------------------------------------------------
let pieces = 0;
let loudest = 0;
function checkPart(p: Part, label: string) {
  for (const n of p.notes) {
    loudest = Math.max(loudest, n.gain);
    if (n.gain > CAP_GAIN + 1e-9) fail(`${label}: a note at gain ${n.gain.toFixed(3)} is over the cap`);
  }
  // Notes struck together (a sample peaks at about 0.85 × its gain).
  const byTime = new Map<string, number>();
  for (const n of p.notes) byTime.set(n.time.toFixed(4), (byTime.get(n.time.toFixed(4)) ?? 0) + n.gain);
  for (const [t, g] of byTime) if (g * 0.85 >= 1) fail(`${label}: notes at ${t}s add up to ${(g * 0.85).toFixed(2)} of full scale`);
}

function checkQuestion(q: Question, label: string) {
  const r = render(q);
  pieces++;
  checkPart(r.reference, `${label} reference`);
  checkPart(r.piece, label);
  if (r.reference.notes.some((n) => Math.abs(noteDb(n)) > 1e-6)) fail(`${label}: reference is not at mf`);
  if (r.reference.seconds < 1.5 || r.reference.seconds > 4) fail(`${label}: reference ${r.reference.seconds.toFixed(2)} s`);
  if (r.piece.seconds < 4 - 1e-9 || r.piece.seconds > 8 + 1e-9) fail(`${label}: piece ${r.piece.seconds.toFixed(2)} s`);
  // Voices keep their balance: the accompaniment always 6 dB under the melody.
  const mel = r.piece.notes.filter((n) => n.voice === 0);
  const levels = mel.map(noteDb);
  if (q.kind === "steady") {
    for (const d of r.piece.notes.map(noteDb)) if (Math.abs(d - steadyDb(q.answer)) > 1e-6) fail(`${label}: a note at ${d.toFixed(1)} dB, not ${steadyDb(q.answer)}`);
  } else if (q.kind === "change") {
    const up = q.answer === "cresc";
    for (let i = 1; i < levels.length; i++) if (up ? levels[i] < levels[i - 1] - 1e-9 : levels[i] > levels[i - 1] + 1e-9) fail(`${label}: note ${i + 1} goes the wrong way`);
    const rise = levels[levels.length - 1] - levels[0];
    if (up ? rise < 12 : rise > -12) fail(`${label}: only ${rise.toFixed(1)} dB from first to last note`);
    const e = r.piece.envelope;
    for (let k = 1; k <= 40; k++) {
      const a = dbAt(e, ((k - 1) / 40) * r.piece.seconds);
      const b = dbAt(e, (k / 40) * r.piece.seconds);
      if (up ? !(b > a) : !(b < a)) fail(`${label}: the envelope doesn't ${up ? "rise" : "fall"} at ${k}/40`);
    }
  } else {
    const e = r.piece.envelope;
    const jump = e.to - e.from;
    const up = q.answer === "subito-f";
    if (e.shape !== "step" || (up ? jump < 12 : jump > -12)) fail(`${label}: subito jump ${jump} dB`);
    const beat = 60 / q.bpm;
    const atBeat = e.at / beat;
    if (Math.abs(atBeat / q.melody.beatsPerBar - Math.round(atBeat / q.melody.beatsPerBar)) > 1e-6) fail(`${label}: the jump is not on a bar line`);
    if (e.at < 1.5 || r.piece.seconds - e.at < 1.5) fail(`${label}: jump at ${e.at.toFixed(2)} of ${r.piece.seconds.toFixed(2)} s`);
    const before = r.piece.notes.filter((n) => n.time < e.at - 1e-6).map(noteDb);
    const after = r.piece.notes.filter((n) => n.time >= e.at - 1e-6).map(noteDb);
    if (before.some((d) => Math.abs(d - e.from) > 1e-6) || after.some((d) => Math.abs(d - e.to) > 1e-6)) fail(`${label}: notes not steady on each side of the jump`);
  }
}

// Every melody × every answer × the ends of the tempo range × every key.
const ALL_ANSWERS: Answer[] = ["pp", "p", "mf", "f", "ff", "cresc", "dim", "subito-f", "subito-p"];
for (const m of MELODIES)
  for (const a of ALL_ANSWERS)
    for (const bpm of TEMPO_RANGE)
      for (const transpose of TRANSPOSES) {
        const q = question("hard", m, a, rand);
        checkQuestion({ ...q, bpm, transpose, repeats: repeatsFor(m, bpm, q.kind) }, `${m.id} ${a} ${bpm}bpm ${transpose}`);
      }

// --- rounds: the mix, and nothing but loudness tells the answers apart ---------------------
type Stats = { bpm: number[]; transpose: number[]; register: number[]; melodies: Set<string> };
for (const level of LEVELS) {
  const stats = new Map<Answer, Stats>();
  for (let n = 0; n < 3000; n++) {
    const round = buildRound(level, rand);
    if (round.length !== ROUND_LENGTH) fail(`${level}: ${round.length} questions`);
    for (let i = 1; i < round.length; i++) if (round[i].melody.id === round[i - 1].melody.id) fail(`${level}: ${round[i].melody.id} twice in a row`);
    const count = (k: Kind) => round.filter((q) => q.kind === k).length;
    if (level !== "hard" && count("steady") !== 10) fail(`${level}: not all steady`);
    if (level === "hard") {
      const c = (a: Answer) => round.filter((q) => q.answer === a).length;
      if (c("cresc") !== 2 || c("dim") !== 2 || count("subito") !== 3 || c("subito-f") < 1 || c("subito-p") < 1 || count("steady") !== 3) fail(`hard: wrong mix ${round.map((q) => q.answer).join(",")}`);
    }
    if (level === "easy") {
      const by = new Map<string, Answer[]>();
      for (const q of round) by.set(q.melody.id, [...(by.get(q.melody.id) ?? []), q.answer]);
      for (const [id, as] of by) if (as.length !== 2 || !as.includes("p") || !as.includes("f")) fail(`easy: ${id} not heard both soft and loud`);
    }
    if (level === "medium") {
      const by = new Map<string, Answer[]>();
      for (const q of round) by.set(q.melody.id, [...(by.get(q.melody.id) ?? []), q.answer]);
      const full = [...by.values()].filter((as) => ["p", "mf", "f"].every((a) => as.includes(a as Answer))).length;
      if (full < 3) fail("medium: fewer than 3 melodies at all three levels");
    }
    for (const q of round) {
      const options = answersFor(level, q.kind);
      if (!options.includes(q.answer)) fail(`${level}: answer ${q.answer} not on screen`);
      if (n < 60) checkQuestion(q, `${level} round ${n} ${q.melody.id} ${q.answer}`);
      const r = render(q);
      const mel = r.piece.notes.filter((x) => x.voice === 0).map((x) => x.midi);
      const s = stats.get(q.answer) ?? { bpm: [], transpose: [], register: [], melodies: new Set<string>() };
      s.bpm.push(q.bpm);
      s.transpose.push(q.transpose);
      s.register.push(median(mel));
      s.melodies.add(q.melody.id);
      stats.set(q.answer, s);
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const all = [...stats.values()];
  const meanBpm = mean(all.flatMap((s) => s.bpm));
  const meanT = mean(all.flatMap((s) => s.transpose));
  const meanReg = mean(all.flatMap((s) => s.register));
  for (const [a, s] of stats) {
    if (Math.abs(mean(s.bpm) - meanBpm) > 1.5) fail(`${level} ${a}: mean tempo ${mean(s.bpm).toFixed(1)} vs ${meanBpm.toFixed(1)}`);
    if (Math.min(...s.bpm) !== TEMPO_RANGE[0] || Math.max(...s.bpm) !== TEMPO_RANGE[1]) fail(`${level} ${a}: tempos don't cover the whole range`);
    if (Math.abs(mean(s.transpose) - meanT) > 0.3) fail(`${level} ${a}: mean key ${mean(s.transpose).toFixed(2)} vs ${meanT.toFixed(2)}`);
    if (new Set(s.transpose).size !== TRANSPOSES.length) fail(`${level} ${a}: not every key used`);
    if (Math.abs(mean(s.register) - meanReg) > 1) fail(`${level} ${a}: register ${mean(s.register).toFixed(1)} vs ${meanReg.toFixed(1)}`);
    if (s.melodies.size < MELODIES.length - 1) fail(`${level} ${a}: only ${s.melodies.size} melodies`);
  }
}

// Stars, credits, content.
if (starsFor(10) !== 3 || starsFor(9) !== 3 || starsFor(8) !== 2 || starsFor(6) !== 2 || starsFor(5) !== 1 || starsFor(0) !== 1) fail("stars");
const credits = readFileSync("lib/loudOrSoft/CREDITS.md", "utf8");
for (const m of MELODIES) {
  if (!credits.includes(`| ${m.id} |`) || !credits.includes(m.title)) fail(`${m.id} is not in CREDITS.md`);
  if (/[֐-׿]|israel|hebrew/i.test(`${m.title} ${m.source}`)) fail(`${m.id}: not allowed content`);
}

if (failures) {
  console.error(`\n${failures} problem(s) found.`);
  process.exit(1);
}
const gaps = (["easy", "medium", "hard"] as DynLevel[]).map((l) => {
  const as = answersFor(l, "steady");
  return `${l} ${as.map((a) => `${a} ${LEVEL_DB[a as Mark] >= 0 ? "+" : ""}${LEVEL_DB[a as Mark]}`).join(" / ")} dB`;
});
console.log(
  `✓ ${MELODIES.length} tunes, 9000 rounds, ${pieces} pieces checked: ${gaps.join("; ")}; loudest note ${dB(loudest).toFixed(1)} dBFS-gain (cap ${dB(CAP_GAIN).toFixed(1)}), cresc/dim really rise/fall, subito jumps ≥ 12 dB, tempo/key/register independent of the answer.`
);

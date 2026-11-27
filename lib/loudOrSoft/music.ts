// Loud or Soft ("Sleepy Town"): the music, the dynamics and the rounds. No
// browser code, so scripts/check-loud-or-soft.ts can check everything:
// loudness levels clearly apart and in order, crescendo / diminuendo really
// rising / falling, subito changes really sudden, the loudest level under
// the cap, and tempo, key and register independent of the answer.
//
// Device volume: how loud "loud" is depends on the tablet's volume, so the
// game never asks about absolute loudness. Each question first plays a
// short reference phrase at mezzo-forte (the "normal tune", which the
// child set to "comfortably medium" in the volume step), then the piece,
// and the child judges it against the reference.
//
// Like a real piano, louder is also brighter: every note is struck at its
// level (a per-note "velocity" gain) and a low-pass filter opens as the
// music gets louder (components/loudOrSoft/player.ts).
//
// Every melody is public domain, traditional, or an original written for
// Ritmo (lib/loudOrSoft/CREDITS.md). Same notation as Happy or Sad and
// Music Train ("C4:1", "r:1", "|" bar lines): voice 1 the melody, voice 2
// an accompaniment on every beat.

import { parseVoice } from "@/lib/happyOrSad/pieces";

export type DynLevel = "easy" | "medium" | "hard";
export type Mark = "pp" | "p" | "mp" | "mf" | "f" | "ff";
export type Steady = "pp" | "p" | "mf" | "f" | "ff";
export type Change = "cresc" | "dim";
export type Subito = "subito-f" | "subito-p";
export type Answer = Steady | Change | Subito;
export type Kind = "steady" | "change" | "subito";

export interface Melody {
  id: string;
  title: string;
  source: string;
  origin: "public-domain" | "traditional" | "original";
  beatsPerBar: number;
  voices: [string, string];
}

// --- the melodies -------------------------------------------------------------

export const MELODIES: Melody[] = [
  {
    id: "twinkle",
    title: "Twinkle, Twinkle, Little Star",
    source: "Traditional French (“Ah! vous dirai-je, maman”), 1761",
    origin: "traditional",
    beatsPerBar: 4,
    voices: ["C4:1 C4:1 G4:1 G4:1 | A4:1 A4:1 G4:2", "C3:1 G3:1 E3:1 G3:1 | F3:1 A3:1 E3:1 G3:1"],
  },
  {
    id: "frere-jacques",
    title: "Frère Jacques",
    source: "Traditional French",
    origin: "traditional",
    beatsPerBar: 4,
    voices: ["C4:1 D4:1 E4:1 C4:1 | E4:1 F4:1 G4:2", "C3:1 G3:1 E3:1 G3:1 | C3:1 A3:1 G3:1 E3:1"],
  },
  {
    id: "ode-to-joy",
    title: "Ode to Joy (Symphony No. 9)",
    source: "L. van Beethoven, 1824",
    origin: "public-domain",
    beatsPerBar: 4,
    voices: ["E4:1 E4:1 F4:1 G4:1 | G4:1 F4:1 E4:1 D4:1", "C3:1 G3:1 E3:1 G3:1 | G2:1 D3:1 B2:1 D3:1"],
  },
  {
    id: "au-clair",
    title: "Au clair de la lune",
    source: "Traditional French, 18th century",
    origin: "traditional",
    beatsPerBar: 4,
    voices: ["C4:1 C4:1 C4:1 D4:1 | E4:2 D4:2", "C3:1 G3:1 E3:1 G3:1 | C3:1 G3:1 G2:1 D3:1"],
  },
  {
    id: "mary-lamb",
    title: "Mary Had a Little Lamb",
    source: "Traditional American, 1830s",
    origin: "traditional",
    beatsPerBar: 4,
    voices: ["E4:1 D4:1 C4:1 D4:1 | E4:1 E4:1 E4:2", "C3:1 G3:1 E3:1 G3:1 | C3:1 G3:1 E3:1 G3:1"],
  },
  {
    id: "london-bridge",
    title: "London Bridge Is Falling Down",
    source: "Traditional English",
    origin: "traditional",
    beatsPerBar: 4,
    voices: ["G4:1.5 A4:0.5 G4:1 F4:1 | E4:1 F4:1 G4:2", "C3:1 G3:1 E3:1 G3:1 | C3:1 G3:1 E3:1 G3:1"],
  },
  {
    id: "brahms-lullaby",
    title: "Lullaby (Wiegenlied, Op. 49 No. 4)",
    source: "J. Brahms, 1868",
    origin: "public-domain",
    beatsPerBar: 3,
    voices: ["E4:0.5 E4:0.5 G4:2 | E4:0.5 E4:0.5 G4:2", "C3:1 G3:1 G3:1 | C3:1 G3:1 G3:1"],
  },
  {
    id: "sleepy-town",
    title: "Sleepy Town",
    source: "Original (Ritmo)",
    origin: "original",
    beatsPerBar: 3,
    voices: ["G4:1 E4:1 C4:1 | D4:1 F4:1 E4:1", "C3:1 G3:1 G3:1 | G2:1 D3:1 C3:1"],
  },
  {
    id: "night-parade",
    title: "Night Parade",
    source: "Original (Ritmo)",
    origin: "original",
    beatsPerBar: 4,
    voices: ["C4:0.5 E4:0.5 G4:1 A4:0.5 G4:0.5 E4:1 | F4:0.5 D4:0.5 B3:1 C4:2", "C3:1 G3:1 E3:1 G3:1 | G2:1 D3:1 C3:1 G3:1"],
  },
];

// --- loudness -------------------------------------------------------------------

// Each marking's level in dB, relative to mezzo-forte (the reference). Every
// step is at least 6 dB from its neighbour (a clearly heard difference);
// Easy's p and f are 18 dB apart.
export const LEVEL_DB: Record<Mark, number> = { pp: -20, p: -11, mp: -5, mf: 0, f: 7, ff: 13 };

// The note gain at mezzo-forte, and the cap: no note is ever struck louder
// than CAP_GAIN (ff is just under it), and a limiter (LIMITER) after the
// whole mix catches chord peaks, so nothing is ever painfully loud.
export const MF_GAIN = 0.17;
export const CAP_GAIN = 0.8;
export const LIMITER = { thresholdDb: -4, kneeDb: 0, ratio: 20, attack: 0.002, release: 0.12 };
// The melody over the accompaniment (the same for every answer).
export const MELODY_GAIN = 1;
export const ACCOMPANIMENT_GAIN = 0.5;

export const gainAt = (db: number) => Math.min(CAP_GAIN, MF_GAIN * Math.pow(10, db / 20));

// Louder = brighter: the low-pass filter's cutoff (Hz), from muffled at pp
// to fully open at ff, evenly in log-frequency per dB.
const BRIGHT_LOW: [number, number] = [LEVEL_DB.pp, 1100];
const BRIGHT_HIGH: [number, number] = [LEVEL_DB.ff, 14000];
export function brightnessHz(db: number): number {
  const k = Math.min(1, Math.max(0, (db - BRIGHT_LOW[0]) / (BRIGHT_HIGH[0] - BRIGHT_LOW[0])));
  return BRIGHT_LOW[1] * Math.pow(BRIGHT_HIGH[1] / BRIGHT_LOW[1], k);
}

// How "awake" Sleepy Town is at a level: 0 fast asleep (p and below), 1 a
// full party (f and above), up to 1.3 at ff (more fireworks).
export function wakeAt(db: number): number {
  return Math.max(0, Math.min(1.3, (db - LEVEL_DB.p) / (LEVEL_DB.f - LEVEL_DB.p)));
}

// A dynamics envelope: the level (dB) over a piece. `from` until `at`,
// then (ramp) moving evenly in dB to `to` by `until`, or (step) jumping to
// `to` at `at`.
export interface Envelope {
  from: number;
  to: number;
  at: number; // seconds
  until: number; // seconds (= at for a step)
  shape: "steady" | "ramp" | "step";
}

export function dbAt(e: Envelope, t: number): number {
  if (e.shape === "steady" || t <= e.at) return e.from;
  if (e.shape === "step" || t >= e.until) return e.to;
  return e.from + ((e.to - e.from) * (t - e.at)) / (e.until - e.at);
}

// --- a question -------------------------------------------------------------------

// Tempos (beats a minute) and keys (semitones from C): picked at random,
// whatever the answer, so neither is ever a clue.
export const TEMPO_RANGE: [number, number] = [96, 116];
export const TRANSPOSES = [-2, -1, 0, 1, 2, 3];
// The reference phrase: the piece's own opening (4 beats, or 6 in 3/4)
// at mf, then a short silence before the piece.
export const REFERENCE_GAP = 0.7;

export interface Question {
  level: DynLevel;
  kind: Kind;
  melody: Melody;
  answer: Answer;
  bpm: number;
  transpose: number;
  repeats: number;
}

export interface TimedNote {
  midi: number;
  time: number; // seconds from the start of its part
  seconds: number;
  gain: number;
  voice: number;
  db: number; // the dynamic it is struck at
}

export interface Part {
  notes: TimedNote[];
  seconds: number;
  envelope: Envelope;
}

export interface Rendered {
  reference: Part;
  piece: Part;
}

export const KIND_OF: Record<Answer, Kind> = {
  pp: "steady",
  p: "steady",
  mf: "steady",
  f: "steady",
  ff: "steady",
  cresc: "change",
  dim: "change",
  "subito-f": "subito",
  "subito-p": "subito",
};

// The answers on screen for a question, soft to loud.
export function answersFor(level: DynLevel, kind: Kind): Answer[] {
  if (kind === "change") return ["dim", "cresc"];
  if (kind === "subito") return ["subito-p", "subito-f"];
  if (level === "easy") return ["p", "f"];
  if (level === "medium") return ["p", "mf", "f"];
  return ["pp", "p", "f", "ff"];
}

// How loud an answer "feels" (for the wrong-answer reaction: a louder
// guess than the music wakes the grumpy cat, a softer one fizzles).
export const LOUDNESS_RANK: Record<Answer, number> = { pp: 0, p: 1, dim: 1.5, "subito-p": 1.5, mf: 2, "subito-f": 2.5, cresc: 2.5, f: 3, ff: 4 };

const melodyBeats = (m: Melody) => parseVoice(m.voices[0], 0).length;
export const referenceBeats = (m: Melody) => (m.beatsPerBar === 3 ? 6 : 4);

// Steady pieces: as many times through as it takes to last at least 4 s.
// Changing and subito pieces: at least two bars' worth more (8 beats in
// 4/4, 12 in 3/4), so the change has time to be heard. Never over 8 s.
export function repeatsFor(m: Melody, bpm: number, kind: Kind): number {
  const beats = melodyBeats(m);
  const secs = (beats * 60) / bpm;
  const atLeast = kind === "steady" ? 4 : Math.max(4, ((m.beatsPerBar === 3 ? 12 : 8) * 60) / bpm);
  return Math.max(1, Math.ceil(atLeast / secs - 1e-9));
}

// The envelope of a piece `seconds` long for an answer.
export function envelopeFor(answer: Answer, seconds: number, switchAt: number): Envelope {
  switch (answer) {
    case "cresc":
      return { from: LEVEL_DB.p, to: LEVEL_DB.f, at: 0, until: seconds, shape: "ramp" };
    case "dim":
      return { from: LEVEL_DB.f, to: LEVEL_DB.p, at: 0, until: seconds, shape: "ramp" };
    case "subito-f":
      return { from: LEVEL_DB.p, to: LEVEL_DB.f, at: switchAt, until: switchAt, shape: "step" };
    case "subito-p":
      return { from: LEVEL_DB.f, to: LEVEL_DB.p, at: switchAt, until: switchAt, shape: "step" };
    default:
      return { from: LEVEL_DB[answer], to: LEVEL_DB[answer], at: 0, until: 0, shape: "steady" };
  }
}

function part(q: Question, beatsLong: number, envelopeOf: (seconds: number, beatSec: number) => Envelope): Part {
  const voices = q.melody.voices.map((v, i) => parseVoice(v, i, q.transpose));
  const one = voices[0].length;
  const beat = 60 / q.bpm;
  const seconds = beatsLong * beat;
  const envelope = envelopeOf(seconds, beat);
  const notes: TimedNote[] = [];
  for (let start = 0; start < beatsLong - 1e-9; start += one) {
    for (const v of voices)
      for (const n of v.notes) {
        const b = start + n.start;
        if (b >= beatsLong - 1e-9) continue;
        const end = Math.min(b + n.beats, beatsLong);
        const time = b * beat;
        const db = dbAt(envelope, time + 1e-6);
        const voiceGain = n.voice === 0 ? MELODY_GAIN : ACCOMPANIMENT_GAIN;
        notes.push({ midi: n.midi, time, seconds: (end - b) * beat * 0.96, gain: gainAt(db) * voiceGain, voice: n.voice, db });
      }
  }
  notes.sort((a, b) => a.time - b.time || a.voice - b.voice);
  return { notes, seconds, envelope };
}

export function render(q: Question): Rendered {
  const one = melodyBeats(q.melody);
  const total = one * q.repeats;
  // Subito: the jump comes on a bar line half-way through.
  const bars = total / q.melody.beatsPerBar;
  const switchBeat = Math.round(bars / 2) * q.melody.beatsPerBar;
  return {
    reference: part(q, referenceBeats(q.melody), () => envelopeFor("mf", 0, 0)),
    piece: part(q, total, (seconds, beat) => envelopeFor(q.answer, seconds, switchBeat * beat)),
  };
}

// --- rounds -------------------------------------------------------------------------

export const ROUND_LENGTH = 10;

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pickOne = <T>(xs: T[], rand: () => number) => xs[Math.floor(rand() * xs.length) % xs.length];

export function question(level: DynLevel, melody: Melody, answer: Answer, rand: () => number): Question {
  const kind = KIND_OF[answer];
  const bpm = TEMPO_RANGE[0] + Math.floor(rand() * (TEMPO_RANGE[1] - TEMPO_RANGE[0] + 1));
  return { level, kind, melody, answer, bpm, transpose: pickOne(TRANSPOSES, rand), repeats: repeatsFor(melody, bpm, kind) };
}

// No melody twice in a row.
function spread(qs: Question[], rand: () => number): Question[] {
  for (let tries = 0; tries < 200; tries++) {
    const s = shuffle(qs, rand);
    if (s.every((q, i) => i === 0 || q.melody.id !== s[i - 1].melody.id)) return s;
  }
  return shuffle(qs, rand);
}

// Easy: 5 melodies, each once soft and once loud (the same melody in two
// dynamics). Medium: 3 melodies at p, mf and f, plus one more. Hard: 4
// getting louder / softer (2 each), 3 sudden changes (at least one each
// way) and 3 steady pieces from pp, p, f, ff.
export function buildRound(level: DynLevel, rand: () => number = Math.random): Question[] {
  const ms = shuffle(MELODIES, rand);
  if (level === "easy") return spread(ms.slice(0, 5).flatMap((m) => (["p", "f"] as Answer[]).map((a) => question(level, m, a, rand))), rand);
  if (level === "medium") {
    const qs = ms.slice(0, 3).flatMap((m) => (["p", "mf", "f"] as Answer[]).map((a) => question(level, m, a, rand)));
    qs.push(question(level, ms[3], pickOne<Answer>(["p", "mf", "f"], rand), rand));
    return spread(qs, rand);
  }
  const sub: Answer[] = shuffle<Answer>(["subito-f", "subito-p", pickOne<Answer>(["subito-f", "subito-p"], rand)], rand);
  const steady = shuffle<Answer>(["pp", "p", "f", "ff"], rand).slice(0, 3);
  const answers: Answer[] = ["cresc", "cresc", "dim", "dim", ...sub, ...steady];
  return spread(answers.map((a, i) => question(level, ms[i % ms.length], a, rand)), rand);
}

// 1–3 stars (no zero: the town always gets a little brighter).
export function starsFor(correct: number): 1 | 2 | 3 {
  if (correct >= 9) return 3;
  if (correct >= 6) return 2;
  return 1;
}

// --- words ----------------------------------------------------------------------------

export const LEVELS: Record<DynLevel, { label: string; detail: string }> = {
  easy: { label: "Easy", detail: "Soft or loud? The same tune, very soft or very loud" },
  medium: { label: "Medium", detail: "Soft, medium or loud: tiptoe, walk or drum" },
  hard: { label: "Hard", detail: "Getting louder or softer, sudden changes, and very soft (pp) or very loud (ff)" },
};

export interface AnswerInfo {
  title: string; // on the button
  word: string; // "soft", "getting louder"…
  mark: string; // pp, p, mf, f, ff, cresc., dim., sub. f, sub. p
  hairpin?: "cresc" | "dim";
}

export const ANSWER_INFO: Record<Answer, AnswerInfo> = {
  pp: { title: "Whisper", word: "very soft", mark: "pp" },
  p: { title: "Tiptoe", word: "soft", mark: "p" },
  mf: { title: "Walk", word: "medium", mark: "mf" },
  f: { title: "Drum", word: "loud", mark: "f" },
  ff: { title: "Fireworks", word: "very loud", mark: "ff" },
  cresc: { title: "Wake up", word: "getting louder", mark: "cresc.", hairpin: "cresc" },
  dim: { title: "Fall asleep", word: "getting softer", mark: "dim.", hairpin: "dim" },
  "subito-f": { title: "Surprise!", word: "suddenly loud", mark: "sub. f" },
  "subito-p": { title: "Hush!", word: "suddenly soft", mark: "sub. p" },
};

export const QUESTION_TEXT: Record<Kind, Record<DynLevel, string>> = {
  steady: { easy: "Is it soft or loud?", medium: "Soft, medium or loud?", hard: "How soft or loud is it?" },
  change: { easy: "", medium: "", hard: "Getting louder or getting softer?" },
  subito: { easy: "", medium: "", hard: "Suddenly loud or suddenly soft?" },
};

// Fast or Slow ("Music Train"): the music, the tempos and the rounds. No
// browser code, so scripts/check-fast-or-slow.ts can check everything:
// tempo ranges, the same melody at different tempos, equal loudness and
// register whatever the answer, and the beat clock the train runs on.
//
// Every melody is public domain, traditional, or an original written for
// Ritmo (lib/fastOrSlow/CREDITS.md). They're written here in C, two bars
// long, in the same notation as Happy or Sad ("C4:1", "E4:0.5", "r:1",
// "|" bar lines): voice 1 the melody, voice 2 an accompaniment that plays
// on every beat, so the beat can always be heard.

import { parseVoice } from "@/lib/happyOrSad/pieces";

export type TrainLevel = "easy" | "medium" | "hard";
export type Speed = "slow" | "medium" | "fast";
export type Change = "faster" | "slower";
export type Answer = Speed | Change;

export interface Melody {
  id: string;
  title: string;
  source: string;
  origin: "public-domain" | "traditional" | "original";
  beatsPerBar: number;
  voices: [string, string];
  // Hard's trap pieces: a slow piece full of short notes ("busy"), or a
  // fast one with only long notes ("calm"). Ordinary melodies have none.
  trap?: "busy" | "calm";
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
    voices: ["C4:1 D4:1 E4:1 C4:1 | C4:1 D4:1 E4:1 C4:1", "C3:1 G3:1 E3:1 G3:1 | C3:1 G3:1 E3:1 G3:1"],
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
    id: "mary-lamb",
    title: "Mary Had a Little Lamb",
    source: "Traditional American, 1830s",
    origin: "traditional",
    beatsPerBar: 4,
    voices: ["E4:1 D4:1 C4:1 D4:1 | E4:1 E4:1 E4:2", "C3:1 G3:1 E3:1 G3:1 | C3:1 G3:1 E3:1 G3:1"],
  },
  {
    id: "hot-cross-buns",
    title: "Hot Cross Buns",
    source: "Traditional English, 18th century",
    origin: "traditional",
    beatsPerBar: 4,
    voices: ["E4:1 D4:1 C4:2 | E4:1 D4:1 C4:2", "C3:1 G3:1 E3:1 G3:1 | C3:1 G3:1 E3:1 G3:1"],
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
    id: "choo-choo",
    title: "Choo-Choo Tune",
    source: "Original (Ritmo)",
    origin: "original",
    beatsPerBar: 4,
    voices: ["C4:0.5 E4:0.5 G4:1 G4:0.5 A4:0.5 G4:1 | F4:0.5 E4:0.5 D4:1 C4:2", "C3:1 G3:1 E3:1 G3:1 | G2:1 D3:1 C3:1 G3:1"],
  },
  {
    id: "little-engine",
    title: "The Little Engine",
    source: "Original (Ritmo)",
    origin: "original",
    beatsPerBar: 3,
    voices: ["G4:1 E4:1 E4:1 | F4:1 D4:1 D4:1", "C3:1 G3:1 G3:1 | G2:1 D3:1 D3:1"],
  },
];

// Hard's traps, in the same register as the melodies above: "busy" ones
// are full of quick notes but played SLOWLY; "calm" ones have only long
// notes but are played FAST. The beat (the accompaniment) tells the truth.
export const TRAPS: Melody[] = [
  {
    id: "busy-bee",
    title: "Busy Bee",
    source: "Original (Ritmo)",
    origin: "original",
    beatsPerBar: 4,
    trap: "busy",
    voices: [
      "C4:0.25 D4:0.25 E4:0.25 F4:0.25 G4:0.25 F4:0.25 E4:0.25 D4:0.25 C4:0.25 D4:0.25 E4:0.25 F4:0.25 G4:0.5 G4:0.5 | A4:0.25 G4:0.25 F4:0.25 E4:0.25 F4:0.25 E4:0.25 D4:0.25 C4:0.25 D4:0.25 E4:0.25 D4:0.25 C4:0.25 C4:1",
      "C3:1 G3:1 E3:1 G3:1 | F3:1 C3:1 G2:1 C3:1",
    ],
  },
  {
    id: "raindrop-run",
    title: "Raindrop Run",
    source: "Original (Ritmo)",
    origin: "original",
    beatsPerBar: 4,
    trap: "busy",
    voices: [
      "E4:0.25 G4:0.25 C5:0.25 G4:0.25 E4:0.25 G4:0.25 C5:0.25 G4:0.25 F4:0.25 A4:0.25 C5:0.25 A4:0.25 F4:0.25 A4:0.25 C5:0.25 A4:0.25 | G4:0.25 B4:0.25 D5:0.25 B4:0.25 G4:0.25 B4:0.25 D5:0.25 B4:0.25 C5:2",
      "C3:1 G3:1 F3:1 A3:1 | G2:1 D3:1 C3:1 G3:1",
    ],
  },
  {
    id: "sleepy-giant",
    title: "Sleepy Giant",
    source: "Original (Ritmo)",
    origin: "original",
    beatsPerBar: 4,
    trap: "calm",
    voices: ["E4:2 G4:2 | A4:4", "C3:1 G3:1 E3:1 G3:1 | F3:1 C4:1 A3:1 C4:1"],
  },
  {
    id: "long-clouds",
    title: "Long Clouds",
    source: "Original (Ritmo)",
    origin: "original",
    beatsPerBar: 4,
    trap: "calm",
    voices: ["G4:4 | C5:2 E4:2", "C3:1 G3:1 E3:1 G3:1 | A2:1 E3:1 C3:1 E3:1"],
  },
];

// --- tempos ---------------------------------------------------------------------

// Beats a minute. Easy and Medium: Largo / Andante / Allegro. Hard's fast
// pieces are Presto, and its changing pieces glide between the two ends.
export const TEMPO_RANGES: Record<TrainLevel, Partial<Record<Speed, [number, number]>>> = {
  easy: { slow: [60, 66], fast: [132, 152] },
  medium: { slow: [60, 66], medium: [92, 108], fast: [146, 160] },
  hard: { slow: [60, 66], fast: [168, 184] },
};
export const CHANGE_FROM_TO: Record<Change, [number, number]> = { faster: [66, 144], slower: [144, 66] };
export const CHANGE_BEATS = 12;

export const ITALIAN: Record<TrainLevel, Record<Speed, string>> = {
  easy: { slow: "Largo", medium: "Andante", fast: "Allegro" },
  medium: { slow: "Largo", medium: "Andante", fast: "Allegro" },
  hard: { slow: "Largo", medium: "Andante", fast: "Presto" },
};
export const CHANGE_ITALIAN: Record<Change, string> = { faster: "accelerando", slower: "ritardando" };

export type Driver = "turtle" | "dog" | "rabbit";
export const DRIVER_FOR: Record<Speed, Driver> = { slow: "turtle", medium: "dog", fast: "rabbit" };
export const DRIVER_NAME: Record<Driver, string> = { turtle: "Turtle", dog: "Dog", rabbit: "Rabbit" };
export const SPEED_WORD: Record<Speed, string> = { slow: "Slow", medium: "Medium", fast: "Fast" };

export function answersFor(level: TrainLevel): Speed[] {
  return level === "medium" ? ["slow", "medium", "fast"] : ["slow", "fast"];
}

// Keys (semitones from C): picked at random, whatever the answer, so the
// register is never a clue. Loudness is the same for every piece.
export const TRANSPOSES = [-2, -1, 0, 1, 2, 3];
export const VOLUME = 0.85;
export const MELODY_GAIN = 1;
export const ACCOMPANIMENT_GAIN = 0.5;

// --- a question -------------------------------------------------------------------

export interface Question {
  level: TrainLevel;
  melody: Melody;
  answer: Answer;
  // Steady pieces: one tempo. Changing pieces: from → to.
  bpm: number;
  bpmTo?: number;
  transpose: number;
  // How many times the two bars play (steady pieces): as many as fit in
  // 8 seconds, at least once.
  repeats: number;
}

export interface TimedNote {
  midi: number;
  time: number; // seconds from the start
  seconds: number;
  gain: number;
  voice: number;
}

// What plays and how the train moves: every note's time, and every beat's
// time, on one clock (seconds from the piece's start). The train's wheels,
// steam and scenery use `beats`; the piano uses `notes`.
export interface Rendered {
  notes: TimedNote[];
  beats: number[]; // time of beat 0, 1, 2, … (and one past the end)
  seconds: number;
  totalBeats: number;
}

const melodyBeats = (m: Melody) => parseVoice(m.voices[0], 0).length;

export function repeatsFor(m: Melody, bpm: number): number {
  const secs = (melodyBeats(m) * 60) / bpm;
  return Math.max(1, Math.floor(8 / secs + 1e-9));
}

// The beat times: steady, or (changing pieces) the tempo moving evenly
// (by the same ratio every beat) from `from` to `to` over the piece.
export function beatTimes(totalBeats: number, from: number, to = from): number[] {
  const out = [0];
  const n = Math.max(1, totalBeats - 1);
  for (let k = 0; k < totalBeats; k++) {
    const bpm = from * Math.pow(to / from, Math.min(k, n) / n);
    out.push(out[k] + 60 / bpm);
  }
  return out;
}

// A beat position (may be fractional) → seconds, and back. Between two
// beats time runs evenly.
export function timeAtBeat(beats: number[], b: number): number {
  if (b <= 0) return b * (beats[1] - beats[0]);
  const last = beats.length - 1;
  if (b >= last) return beats[last] + (b - last) * (beats[last] - beats[last - 1]);
  const k = Math.floor(b);
  return beats[k] + (b - k) * (beats[k + 1] - beats[k]);
}

export function beatAtTime(beats: number[], t: number): number {
  if (t <= 0) return t / (beats[1] - beats[0]);
  const last = beats.length - 1;
  if (t >= beats[last]) return last + (t - beats[last]) / (beats[last] - beats[last - 1]);
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] <= t) lo = mid;
    else hi = mid;
  }
  return lo + (t - beats[lo]) / (beats[lo + 1] - beats[lo]);
}

export function render(q: Question): Rendered {
  const voices = q.melody.voices.map((v, i) => parseVoice(v, i, q.transpose));
  const one = voices[0].length;
  const totalBeats = q.bpmTo !== undefined ? CHANGE_BEATS : one * q.repeats;
  const beats = beatTimes(totalBeats, q.bpm, q.bpmTo ?? q.bpm);
  const notes: TimedNote[] = [];
  for (let start = 0; start < totalBeats - 1e-9; start += one) {
    for (const v of voices) {
      for (const n of v.notes) {
        const b = start + n.start;
        if (b >= totalBeats - 1e-9) continue;
        const end = Math.min(b + n.beats, totalBeats);
        const time = timeAtBeat(beats, b);
        notes.push({
          midi: n.midi,
          time,
          seconds: (timeAtBeat(beats, end) - time) * 0.96,
          gain: n.voice === 0 ? MELODY_GAIN : ACCOMPANIMENT_GAIN,
          voice: n.voice,
        });
      }
    }
  }
  notes.sort((a, b) => a.time - b.time || a.voice - b.voice);
  return { notes, beats, seconds: beats[totalBeats], totalBeats };
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

const pickIn = ([lo, hi]: [number, number], rand: () => number) => lo + Math.floor(rand() * (hi - lo + 1));
const pickOne = <T>(xs: T[], rand: () => number) => xs[Math.floor(rand() * xs.length) % xs.length];

function steady(level: TrainLevel, melody: Melody, speed: Speed, rand: () => number): Question {
  const bpm = pickIn(TEMPO_RANGES[level][speed]!, rand);
  return { level, melody, answer: speed, bpm, transpose: pickOne(TRANSPOSES, rand), repeats: repeatsFor(melody, bpm) };
}

function changing(melody: Melody, change: Change, rand: () => number): Question {
  const [from, to] = CHANGE_FROM_TO[change];
  return { level: "hard", melody, answer: change, bpm: from, bpmTo: to, transpose: pickOne(TRANSPOSES, rand), repeats: 1 };
}

// No melody twice in a row.
function spread<T extends { melody: Melody }>(qs: T[], rand: () => number): T[] {
  for (let tries = 0; tries < 200; tries++) {
    const s = shuffle(qs, rand);
    if (s.every((q, i) => i === 0 || q.melody.id !== s[i - 1].melody.id)) return s;
  }
  return shuffle(qs, rand);
}

// Easy: 5 melodies, each once slow and once fast (the same melody at two
// tempos). Medium: 3 melodies at all three tempos, plus one more. Hard:
// 4 getting faster or slower, 4 traps (2 busy-but-slow, 2 calm-but-fast),
// and 2 ordinary pieces (Largo or Presto).
export function buildRound(level: TrainLevel, rand: () => number = Math.random): Question[] {
  if (level === "easy") {
    const ms = shuffle(MELODIES, rand).slice(0, 5);
    return spread(ms.flatMap((m) => [steady(level, m, "slow", rand), steady(level, m, "fast", rand)]), rand);
  }
  if (level === "medium") {
    const ms = shuffle(MELODIES, rand).slice(0, 4);
    const qs = ms.slice(0, 3).flatMap((m) => (["slow", "medium", "fast"] as Speed[]).map((s) => steady(level, m, s, rand)));
    qs.push(steady(level, ms[3], pickOne<Speed>(["slow", "medium", "fast"], rand), rand));
    return spread(qs, rand);
  }
  const ms = shuffle(MELODIES, rand);
  const busy = shuffle(TRAPS.filter((t) => t.trap === "busy"), rand);
  const calm = shuffle(TRAPS.filter((t) => t.trap === "calm"), rand);
  const qs: Question[] = [
    changing(ms[0], "faster", rand),
    changing(ms[1], "faster", rand),
    changing(ms[2], "slower", rand),
    changing(ms[3], "slower", rand),
    steady("hard", busy[0], "slow", rand),
    steady("hard", busy[1], "slow", rand),
    steady("hard", calm[0], "fast", rand),
    steady("hard", calm[1], "fast", rand),
    steady("hard", ms[4], "slow", rand),
    steady("hard", ms[5], "fast", rand),
  ];
  return spread(qs, rand);
}

// 1–3 stars (no zero: the train always gets somewhere).
export function starsFor(correct: number): 1 | 2 | 3 {
  if (correct >= 9) return 3;
  if (correct >= 6) return 2;
  return 1;
}

// The driver that goes with an answer (changing pieces: who drives first
// and who takes over half-way).
export function driversFor(a: Answer): [Driver, Driver] {
  if (a === "faster") return ["turtle", "rabbit"];
  if (a === "slower") return ["rabbit", "turtle"];
  return [DRIVER_FOR[a], DRIVER_FOR[a]];
}

// --- the scenery and the beat ------------------------------------------------------------

// The near trees (and bushes and poles) are one beat apart, so one passes
// the engine on every beat. Farther layers move more slowly (parallax).
export const PARALLAX = { hills: 0.12, farTrees: 0.4, near: 1, foreground: 1.35 };
// The wheels turn once per beat, and a puff of steam comes out on each.
export const WHEEL_DEGREES_PER_BEAT = 360;

// How far the near layer has moved (px) at a beat position, with `spacing`
// px between near trees.
export const nearOffsetAt = (beatPos: number, spacing: number) => beatPos * spacing;

// Where the near items are (px, from the screen's left) for a given layer
// offset: one every `spacing` px, placed so one is exactly at `engineX`
// whenever the offset is a whole number of beats.
export function nearItemXs(offset: number, spacing: number, engineX: number, width: number): number[] {
  const first = engineX - offset;
  const k0 = Math.ceil((-spacing - first) / spacing);
  const out: number[] = [];
  for (let k = k0; first + k * spacing < width + spacing; k++) out.push(first + k * spacing);
  return out;
}

// The steam puffs' times: one on every beat of the piece.
export const puffTimes = (r: Rendered) => r.beats.slice(0, r.totalBeats);

// --- settings ----------------------------------------------------------------------------

export const LEVELS: Record<TrainLevel, { label: string; detail: string }> = {
  easy: { label: "Easy", detail: "Fast or slow? The same tune at two very different speeds" },
  medium: { label: "Medium", detail: "Slow, medium or fast: turtle, dog or rabbit" },
  hard: { label: "Hard", detail: "Getting faster or slower? And tricky tunes: follow the beat!" },
};

// --- the ride ------------------------------------------------------------------------------
//
// After the child answers, the piece plays again and the train runs. How
// far it has gone is counted in beats (× the near trees' spacing = px), so
// the wheels (one turn per beat), the steam (a puff per beat) and the near
// trees (one past the engine per beat) all follow the music.
//   * Right answer: the train runs in time from the first beat.
//   * Wrong answer: the chosen driver can't keep the beat: the train lurches
//     stop-go (at its own pace, not the music's) until the first beat after
//     2 seconds, then the right driver takes over and it runs in time.

export interface Ride {
  // Distance in beats at time t (seconds from beat 0).
  distance: (t: number) => number;
  // When the steam puffs come out (seconds from beat 0).
  puffs: number[];
  // The wrong driver's part ends here (−1 when the answer was right).
  swapTime: number;
  swapBeat: number;
}

const WRONG_PACE: Record<Driver, number> = { turtle: 0.7, dog: 1.4, rabbit: 2.6 }; // beats a second
const LURCH_HZ = 1.7;

export function rideFor(r: Rendered, right: boolean, wrongDriver: Driver = "turtle"): Ride {
  const beatsDone = (t: number) => Math.max(0, beatAtTime(r.beats, t));
  if (right) return { distance: beatsDone, puffs: puffTimes(r), swapTime: -1, swapBeat: -1 };
  let k = r.beats.findIndex((b) => b >= 2);
  if (k < 0 || k > r.totalBeats - 1) k = Math.max(1, r.totalBeats - 1);
  const swapTime = r.beats[k];
  const lurch = (t: number) => t - Math.sin(2 * Math.PI * LURCH_HZ * t) / (2 * Math.PI * LURCH_HZ);
  // A whole number of beats' distance by the swap, so afterwards a tree
  // passes the engine exactly on each beat again.
  const m = Math.max(1, Math.round(lurch(swapTime) * WRONG_PACE[wrongDriver]));
  const distance = (t: number) => {
    if (t <= 0) return 0;
    if (t < swapTime) return (m * lurch(t)) / lurch(swapTime);
    return m + beatAtTime(r.beats, t) - k;
  };
  const stutter = [0.2, 0.45, 1.15, 1.3, 1.75].filter((x) => x < swapTime - 0.1);
  return { distance, puffs: [...stutter, ...r.beats.slice(k, r.totalBeats)], swapTime, swapBeat: k };
}

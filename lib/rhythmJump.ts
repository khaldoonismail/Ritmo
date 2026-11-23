// Rhythm Jump: the rhythms, their notation and their timing. No browser
// code, so scripts/check-rhythm-jump.ts can check every pattern: each bar
// adds up to its time signature, beaming follows the beat, and the lily
// pads' times match the note lengths exactly.
//
// Durations are in quarter-note beats (every time signature here is x/4).

export type RhythmLevel = "easy" | "medium" | "hard";
export type RhythmMode = "read" | "echo";
export type Tempo = "slow" | "normal" | "fast";

// q quarter · h half · e eighth · s sixteenth · dq dotted quarter · qr quarter rest
export type Token = "q" | "h" | "e" | "s" | "dq" | "qr";

export const TOKEN_BEATS: Record<Token, number> = { q: 1, h: 2, e: 0.5, s: 0.25, dq: 1.5, qr: 1 };
export const isRest = (t: Token) => t === "qr";

export const LEVELS: Record<
  RhythmLevel,
  { label: string; detail: string; bpm: number; meters: number[]; bars: Record<number, string[]> }
> = {
  easy: {
    label: "Easy",
    detail: "4/4 · quarter notes and quarter rests · slow",
    bpm: 66,
    meters: [4],
    bars: {
      4: ["q q q q", "q q q qr", "q qr q q", "q q qr q", "q qr q qr", "qr q q q", "q q qr qr", "qr q qr q"],
    },
  },
  medium: {
    label: "Medium",
    detail: "Adds eighth-note pairs and half notes · 2/4, 3/4 and 4/4",
    bpm: 76,
    meters: [2, 3, 4],
    bars: {
      2: ["q q", "e e q", "q e e", "e e e e", "h", "q qr", "e e qr"],
      3: ["q q q", "h q", "q h", "e e q q", "q e e q", "q q qr", "e e e e q", "h qr"],
      4: ["q q e e q", "h q q", "q q h", "e e e e h", "e e q qr q", "h h", "q qr e e q", "q q q q"],
    },
  },
  hard: {
    label: "Hard",
    detail: "Dotted quarter + eighth, sixteenths, simple syncopation",
    bpm: 72,
    meters: [2, 3, 4],
    bars: {
      2: ["dq e", "s s s s q", "q s s s s", "e q e", "e s s q", "s s e q", "q e e"],
      3: ["dq e q", "q dq e", "s s s s q q", "e q e q", "e s s e e q", "q s s e q"],
      4: ["dq e q q", "q dq e q", "s s s s q h", "e q e q q", "e s s q dq e", "q e q e q", "q q s s s s qr"],
    },
  },
};

export const TEMPO_FACTOR: Record<Tempo, number> = { slow: 0.8, normal: 1, fast: 1.2 };
export const TEMPO_LABELS: Record<Tempo, string> = { slow: "Slow", normal: "Normal", fast: "Fast" };
export const TEMPOS: Tempo[] = ["slow", "normal", "fast"];
export const MODE_LABELS: Record<RhythmMode, string> = { read: "Read & Tap", echo: "Listen & Echo" };

export function bpmFor(level: RhythmLevel, tempo: Tempo): number {
  return Math.round(LEVELS[level].bpm * TEMPO_FACTOR[tempo]);
}

export const PATTERNS_PER_ROUND = 8;

export interface Pattern {
  meter: number; // beats per bar (x/4)
  bars: Token[][];
}

export const parseBar = (s: string): Token[] => s.trim().split(/\s+/) as Token[];

// --- notation ----------------------------------------------------------------

export interface NoteEl {
  index: number; // in the whole pattern
  bar: number;
  token: Token;
  rest: boolean;
  beats: number;
  start: number; // beats from the start of the pattern
  startInBar: number;
  dotted: boolean;
  hollow: boolean; // half note
  // Beaming: the group (index into Layout.beams) this note is beamed in,
  // or a flag count for a short note on its own.
  beam: number | null;
  flags: number;
  syllable: string;
}

export interface Beam {
  notes: number[]; // element indexes, left to right
  // Second-level beams (sixteenths): runs of consecutive element indexes.
  secondary: number[][];
}

export interface Layout {
  meter: number;
  elements: NoteEl[];
  beams: Beam[];
  totalBeats: number;
}

// Short notes (eighths, sixteenths) are beamed together when they share a
// beat; a short note alone in its beat gets a flag. Dotted quarters,
// quarters and halves are never beamed; rests break beams.
export function layoutPattern(p: Pattern): Layout {
  const elements: NoteEl[] = [];
  const beams: Beam[] = [];
  let start = 0;
  p.bars.forEach((bar, b) => {
    let inBar = 0;
    let group: NoteEl[] = [];
    const closeGroup = () => {
      if (group.length >= 2) {
        const id = beams.length;
        const secondary: number[][] = [];
        let run: number[] = [];
        for (const n of group) {
          if (n.token === "s") run.push(n.index);
          else {
            if (run.length) secondary.push(run);
            run = [];
          }
        }
        if (run.length) secondary.push(run);
        beams.push({ notes: group.map((n) => n.index), secondary });
        group.forEach((n) => (n.beam = id));
      } else if (group.length === 1) {
        group[0].flags = group[0].token === "s" ? 2 : 1;
      }
      group = [];
    };
    for (const token of bar) {
      const beats = TOKEN_BEATS[token];
      const el: NoteEl = {
        index: elements.length,
        bar: b,
        token,
        rest: isRest(token),
        beats,
        start,
        startInBar: inBar,
        dotted: token === "dq",
        hollow: token === "h",
        beam: null,
        flags: 0,
        syllable: syllableFor(token, inBar),
      };
      const short = !el.rest && (token === "e" || token === "s");
      const beat = Math.floor(inBar + 1e-9);
      const fitsBeat = inBar + beats <= beat + 1 + 1e-9;
      if (short && fitsBeat && (group.length === 0 || Math.floor(group[0].startInBar + 1e-9) === beat)) {
        group.push(el);
      } else {
        closeGroup();
        if (short && fitsBeat) group.push(el);
        else if (short) el.flags = token === "s" ? 2 : 1;
      }
      elements.push(el);
      inBar += beats;
      start += beats;
    }
    closeGroup();
  });
  return { meter: p.meter, elements, beams, totalBeats: start };
}

// Rhythm syllables (Kodály style): Ta, Ti-ti, Ta-a, Ta-i, Ti-ka-ti-ka, Sh.
// A note on the beat starts with a capital ("Ti", "Ta"); off the beat it is
// "ti" (on the "and") or "ka" (on a sixteenth in between).
export function syllableFor(token: Token, startInBar: number): string {
  if (token === "qr") return "Sh";
  if (token === "h") return "Ta-a";
  if (token === "dq") return "Ta-i";
  const frac = Math.round((startInBar % 1) * 4); // sixteenth slot 0..3
  if (token === "q") return frac === 0 ? "Ta" : "Ta";
  if (frac === 0) return "Ti";
  if (frac === 2) return "ti";
  return "ka";
}

// --- timing ------------------------------------------------------------------

export interface Pad {
  element: number; // the note it belongs to
  time: number; // seconds from the pattern's first beat
  beats: number; // the note's length (pad size)
}

// One pad per note (none for rests), at the note's exact start.
export function padsFor(layout: Layout, bpm: number): Pad[] {
  const spb = 60 / bpm;
  return layout.elements.filter((e) => !e.rest).map((e) => ({ element: e.index, time: e.start * spb, beats: e.beats }));
}

export type Rating = "perfect" | "good" | "miss";

// Timing windows (seconds either side of the note). Easy is a little more
// forgiving. Each window is also kept under 45 % of the gap to the next and
// previous note, so a tap can never count for two notes.
export const WINDOWS: Record<RhythmLevel, { perfect: number; good: number }> = {
  easy: { perfect: 0.09, good: 0.18 },
  medium: { perfect: 0.075, good: 0.15 },
  hard: { perfect: 0.07, good: 0.14 },
};

export function windowsFor(pads: Pad[], level: RhythmLevel): { perfect: number; good: number }[] {
  const w = WINDOWS[level];
  return pads.map((p, i) => {
    const before = i > 0 ? p.time - pads[i - 1].time : Infinity;
    const after = i < pads.length - 1 ? pads[i + 1].time - p.time : Infinity;
    const cap = 0.45 * Math.min(before, after);
    const good = Math.min(w.good, cap);
    return { perfect: Math.min(w.perfect, good * 0.6), good };
  });
}

export function rate(offsetSeconds: number, win: { perfect: number; good: number }): Rating {
  const d = Math.abs(offsetSeconds);
  if (d <= win.perfect) return "perfect";
  if (d <= win.good) return "good";
  return "miss";
}

export const RATING_POINTS: Record<Rating, number> = { perfect: 1, good: 0.6, miss: 0 };
// A tap on a rest takes a little off.
export const SPLASH_PENALTY = 0.25;

// Timing accuracy 0..1 over a round, and its 1–3 stars.
export function accuracy(ratings: Rating[], splashes: number): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((a, r) => a + RATING_POINTS[r], 0) - splashes * SPLASH_PENALTY;
  return Math.max(0, Math.min(1, sum / ratings.length));
}

export function starsFor(acc: number): 1 | 2 | 3 {
  return acc >= 0.85 ? 3 : acc >= 0.6 ? 2 : 1;
}

// --- making a round ------------------------------------------------------------

function pick<T>(list: T[], rnd: () => number): T {
  return list[Math.floor(rnd() * list.length) % list.length];
}

const hasNote = (bar: Token[]) => bar.some((t) => !isRest(t));

// Medium must use something new (an eighth pair or a half note), Hard one of
// its own figures (dotted quarter, sixteenths or syncopation).
export function usesLevelFeature(level: RhythmLevel, p: Pattern): boolean {
  const tokens = p.bars.flat();
  if (level === "easy") return true;
  if (level === "medium") return tokens.includes("e") || tokens.includes("h");
  const layout = layoutPattern(p);
  const syncopated = layout.elements.some((e) => !e.rest && e.token === "q" && Math.abs((e.startInBar % 1) - 0.5) < 1e-9);
  return tokens.includes("dq") || tokens.includes("s") || syncopated;
}

// 8 patterns of 2 bars each, no two in a row the same, each starting with
// a note (a rest first is hard to feel), with at least 3 notes.
export function makeRound(level: RhythmLevel, rnd: () => number = Math.random): Pattern[] {
  const cfg = LEVELS[level];
  const out: Pattern[] = [];
  let guard = 0;
  while (out.length < PATTERNS_PER_ROUND && guard++ < 5000) {
    const meter = pick(cfg.meters, rnd);
    const pool = cfg.bars[meter].map(parseBar);
    const bars = [pick(pool, rnd), pick(pool, rnd)];
    const p: Pattern = { meter, bars };
    if (isRest(bars[0][0]) || !hasNote(bars[1])) continue;
    if (bars.flat().filter((t) => !isRest(t)).length < 3) continue;
    if (!usesLevelFeature(level, p)) continue;
    const prev = out[out.length - 1];
    if (prev && JSON.stringify(prev) === JSON.stringify(p)) continue;
    out.push(p);
  }
  return out;
}

// --- device delay (calibration) --------------------------------------------------

const CALIBRATION_KEY = "ritmo.rhythmJump.calibration";

// The device's measured delay (sound out + touch in), in ms, or null if
// never calibrated on this device.
export function loadCalibration(): number | null {
  try {
    const raw = localStorage.getItem(CALIBRATION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { ms?: unknown };
    return typeof v.ms === "number" && Number.isFinite(v.ms) ? v.ms : null;
  } catch {
    return null;
  }
}

export function saveCalibration(ms: number): void {
  try {
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify({ ms: Math.round(ms), at: new Date().toISOString() }));
  } catch {
    // blocked storage: it lasts for this visit only
  }
}

export const CALIBRATION_BEATS = 8;
export const CALIBRATION_BPM = 90;
export const MIN_DELAY_MS = -60;
export const MAX_DELAY_MS = 350;

// From each tap's offset (seconds, tap − beat) to the device delay: the
// median of the taps near a beat, or null if too few were near one.
export function delayFromOffsets(offsets: number[]): number | null {
  const near = offsets.filter((o) => Math.abs(o) <= 0.32).sort((a, b) => a - b);
  if (near.length < 5) return null;
  const mid = near.length / 2;
  const median = near.length % 2 ? near[Math.floor(mid)] : (near[mid - 1] + near[mid]) / 2;
  return Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, median * 1000));
}

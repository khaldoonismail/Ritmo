// Rhythm Jump: the rhythms, their notation and their timing. No browser
// code, so scripts/check-rhythm-jump.ts can check every pattern: each bar
// adds up to its time signature, beaming follows the beat, and the lily
// pads' times match the note lengths exactly.
//
// Durations are in quarter-note beats (every time signature here is x/4).

export type RhythmLevel = "easy" | "medium" | "hard";
export type RhythmMode = "read" | "echo";
export type Tempo = "slow" | "normal" | "fast";

// w whole · dh dotted half · h half · dq dotted quarter · q quarter ·
// e eighth · s sixteenth; rests: wr whole · hr half · qr quarter · er eighth
export type Token = "w" | "dh" | "h" | "dq" | "q" | "e" | "s" | "wr" | "hr" | "qr" | "er";

export const TOKEN_BEATS: Record<Token, number> = { w: 4, dh: 3, h: 2, dq: 1.5, q: 1, e: 0.5, s: 0.25, wr: 4, hr: 2, qr: 1, er: 0.5 };
export const isRest = (t: Token) => t === "qr" || t === "hr" || t === "wr" || t === "er";
// Hollow note heads, dots, and notes with no stem.
export const isHollow = (t: Token) => t === "h" || t === "dh" || t === "w";
export const isDotted = (t: Token) => t === "dq" || t === "dh";

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

// A pattern's timeline: the first click comes this long after it starts;
// it ends this long after its last beat (time for a late tap); then the
// pond waits before the next one (Listen & Echo shows the notation it just
// played, so a little longer).
export const START_LEAD_SECONDS = 0.35;
export const END_TAIL_SECONDS = 0.2;
export const BETWEEN_SECONDS: Record<RhythmMode, number> = { read: 0.9, echo: 1.7 };

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
        dotted: isDotted(token),
        hollow: isHollow(token),
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

// Rhythm syllables (Kodály style): Ta, Ti-ti, Ta-a, Ta-a-a, Ta-a-a-a,
// Ta-i, Ti-ka-ti-ka, Sh (every rest).
// A note on the beat starts with a capital ("Ti", "Ta"); off the beat it is
// "ti" (on the "and") or "ka" (on a sixteenth in between).
export function syllableFor(token: Token, startInBar: number): string {
  if (isRest(token)) return "Sh";
  if (token === "w") return "Ta-a-a-a";
  if (token === "dh") return "Ta-a-a";
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

// What a tap does. `rel` = the tap's time from the pattern's first beat
// (seconds, device delay already taken off); `results` = each note's
// rating so far (null = not judged yet).
//   * before the pattern (the count-in) or after it: nothing;
//   * within an unjudged note's window: that note (the nearest one);
//   * anywhere else — a rest, too early or late for any note, or a note
//     already tapped: a splash. `rest` = the rest's element when the tap
//     fell on one.
export type TapResult =
  | { kind: "ignore" }
  | { kind: "note"; pad: number; offset: number; rating: Rating }
  | { kind: "splash"; rest: number | null };

export function judgeTap(
  rel: number,
  layout: Layout,
  pads: Pad[],
  wins: { perfect: number; good: number }[],
  results: (Rating | null)[],
  spb: number
): TapResult {
  // The pattern starts at its first note's window, or at 0 (a little
  // before, as for rests below) if it starts with a rest.
  const firstEdge = Math.min(-0.06, pads.length ? pads[0].time - wins[0].good : 0);
  if (rel < firstEdge || rel > layout.totalBeats * spb + 0.15) return { kind: "ignore" };
  let best = -1;
  let bestD = Infinity;
  pads.forEach((p, i) => {
    if (results[i] !== null) return;
    const d = rel - p.time;
    if (Math.abs(d) <= wins[i].good && Math.abs(d) < Math.abs(bestD)) {
      best = i;
      bestD = d;
    }
  });
  if (best >= 0) return { kind: "note", pad: best, offset: bestD, rating: rate(bestD, wins[best]) };
  const rest = layout.elements.find((e) => e.rest && rel >= e.start * spb - 0.06 && rel < (e.start + e.beats) * spb - 0.06);
  return { kind: "splash", rest: rest ? rest.index : null };
}

// Lily pads coming in advance: only in Practice, which is only on Easy.
// Otherwise the child has to read (or remember) the rhythm: a pad only
// appears under the character when a note is tapped on time.
export const padsAhead = (level: RhythmLevel, practice: boolean) => practice && level === "easy";

export const RATING_POINTS: Record<Rating, number> = { perfect: 1, good: 0.6, miss: 0 };
// A splash (a tap on a rest, or a wrong tap) takes a little off.
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
//
// `barCount`: 2 for Read & Tap; 1 for Listen & Echo (two bars are too much
// to remember), then with at least 2 notes.
export function makeRound(level: RhythmLevel, rnd: () => number = Math.random, barCount: 1 | 2 = 2): Pattern[] {
  const cfg = LEVELS[level];
  const out: Pattern[] = [];
  let guard = 0;
  while (out.length < PATTERNS_PER_ROUND && guard++ < 5000) {
    const meter = pick(cfg.meters, rnd);
    const pool = cfg.bars[meter].map(parseBar);
    const bars = barCount === 1 ? [pick(pool, rnd)] : [pick(pool, rnd), pick(pool, rnd)];
    const p: Pattern = { meter, bars };
    if (isRest(bars[0][0]) || !hasNote(bars[bars.length - 1])) continue;
    if (bars.flat().filter((t) => !isRest(t)).length < (barCount === 1 ? 2 : 3)) continue;
    if (!usesLevelFeature(level, p)) continue;
    const prev = out[out.length - 1];
    if (prev && JSON.stringify(prev) === JSON.stringify(p)) continue;
    out.push(p);
  }
  return out;
}

// --- custom rhythms ---------------------------------------------------------------
//
// The teacher picks exactly which note values, rests and time signatures
// appear. Each value is a figure of one or more tokens. Where a figure may
// start in the bar keeps the notation proper:
//   * "beat": only on a beat (halves, beamed groups, quarter rests, …);
//   * "half": anywhere on an eighth (a single eighth, an eighth rest, and
//     a quarter, which off the beat is a simple syncopation: e q e);
//   * "even": a half rest only on beat 1 or 3.
// Two eighth rests never share a beat (that is a quarter rest).

export type NoteValueKey = "w" | "dh" | "h" | "dqe" | "q" | "ee" | "e" | "ssss" | "ess" | "sse";
export type RestValueKey = "wr" | "hr" | "qr" | "er";
export type ValueKey = NoteValueKey | RestValueKey;

export interface RhythmValue {
  key: ValueKey;
  label: string;
  rest: boolean;
  tokens: Token[];
  start: "beat" | "half" | "even";
}

export const NOTE_VALUES: RhythmValue[] = [
  { key: "w", label: "Whole note", rest: false, tokens: ["w"], start: "beat" },
  { key: "dh", label: "Dotted half", rest: false, tokens: ["dh"], start: "beat" },
  { key: "h", label: "Half note", rest: false, tokens: ["h"], start: "beat" },
  { key: "dqe", label: "Dotted quarter + eighth", rest: false, tokens: ["dq", "e"], start: "beat" },
  { key: "q", label: "Quarter note", rest: false, tokens: ["q"], start: "half" },
  { key: "ee", label: "Eighth-note pair", rest: false, tokens: ["e", "e"], start: "beat" },
  { key: "e", label: "Single eighths", rest: false, tokens: ["e"], start: "half" },
  { key: "ssss", label: "Four sixteenths", rest: false, tokens: ["s", "s", "s", "s"], start: "beat" },
  { key: "ess", label: "Eighth + two sixteenths", rest: false, tokens: ["e", "s", "s"], start: "beat" },
  { key: "sse", label: "Two sixteenths + eighth", rest: false, tokens: ["s", "s", "e"], start: "beat" },
];
export const REST_VALUES: RhythmValue[] = [
  { key: "wr", label: "Whole rest", rest: true, tokens: ["wr"], start: "beat" },
  { key: "hr", label: "Half rest", rest: true, tokens: ["hr"], start: "even" },
  { key: "qr", label: "Quarter rest", rest: true, tokens: ["qr"], start: "beat" },
  { key: "er", label: "Eighth rest", rest: true, tokens: ["er"], start: "half" },
];
export const ALL_VALUES: RhythmValue[] = [...NOTE_VALUES, ...REST_VALUES];
export const VALUE_BY_KEY = Object.fromEntries(ALL_VALUES.map((v) => [v.key, v])) as Record<ValueKey, RhythmValue>;
export const ALL_METERS = [2, 3, 4];
export const valueBeats = (v: RhythmValue) => v.tokens.reduce((a, t) => a + TOKEN_BEATS[t], 0);

// What the teacher chose (also what Stage 2 will save with homework).
export interface RhythmChoice {
  values: ValueKey[];
  meters: number[];
}

// The presets as choices (their games use the hand-made bar lists above).
export const PRESET_CHOICES: Record<RhythmLevel, RhythmChoice> = {
  easy: { values: ["q", "qr"], meters: [4] },
  medium: { values: ["h", "q", "ee", "qr"], meters: [2, 3, 4] },
  hard: { values: ["h", "dqe", "q", "ee", "e", "ssss", "ess", "sse", "qr"], meters: [2, 3, 4] },
};

// Clean up a choice: known values and meters only, in a fixed order.
export function normalizeChoice(c: { values?: unknown; meters?: unknown }): RhythmChoice {
  const vs = Array.isArray(c.values) ? c.values : [];
  const ms = Array.isArray(c.meters) ? c.meters : [];
  return {
    values: ALL_VALUES.map((v) => v.key).filter((k) => vs.includes(k)),
    meters: ALL_METERS.filter((m) => ms.includes(m)),
  };
}

const sameChoice = (a: RhythmChoice, b: RhythmChoice) => {
  const x = normalizeChoice(a);
  const y = normalizeChoice(b);
  return x.values.join() === y.values.join() && x.meters.join() === y.meters.join();
};

// The preset a choice is exactly, or null (custom).
export function presetOf(c: RhythmChoice): RhythmLevel | null {
  return (["easy", "medium", "hard"] as RhythmLevel[]).find((l) => sameChoice(c, PRESET_CHOICES[l])) ?? null;
}

// How fast and how forgiving a custom choice plays: like Hard with any
// sixteenths, dotted rhythms, single eighths or eighth rests; like Medium
// with eighth pairs, long notes or long rests, or not only 4/4; else Easy.
export function levelOfChoice(c: RhythmChoice): RhythmLevel {
  const p = presetOf(c);
  if (p) return p;
  const has = (...k: ValueKey[]) => k.some((x) => c.values.includes(x));
  if (has("dqe", "ssss", "ess", "sse", "e", "er")) return "hard";
  if (has("ee", "h", "dh", "w", "hr", "wr") || c.meters.some((m) => m !== 4)) return "medium";
  return "easy";
}

// Filling bars. Positions are in eighths (half beats) from the bar start.
function canStartAt(v: RhythmValue, pos: number, lastErOnBeat: boolean): boolean {
  if (v.start === "beat" && pos % 2 !== 0) return false;
  if (v.start === "even" && pos % 4 !== 0) return false;
  if (v.key === "er" && lastErOnBeat) return false;
  return true;
}

// Can the rest of a bar (from `pos`, in eighths, of `meter` beats) be
// filled with these values? Memoised per call.
function filler(values: RhythmValue[], meter: number) {
  const end = meter * 2;
  const memo = new Map<string, boolean>();
  const fits = (v: RhythmValue, pos: number, lastEr: boolean) => canStartAt(v, pos, lastEr) && pos + valueBeats(v) * 2 <= end + 1e-9;
  const after = (v: RhythmValue, pos: number) => ({ pos: pos + Math.round(valueBeats(v) * 2), lastEr: v.key === "er" && pos % 2 === 0 });
  const can = (pos: number, lastEr: boolean): boolean => {
    if (pos === end) return true;
    const k = `${pos}|${lastEr}`;
    const got = memo.get(k);
    if (got !== undefined) return got;
    let ok = false;
    for (const v of values) {
      if (!fits(v, pos, lastEr)) continue;
      const n = after(v, pos);
      if (can(n.pos, n.lastEr)) {
        ok = true;
        break;
      }
    }
    memo.set(k, ok);
    return ok;
  };
  return { can, fits, after, end };
}

// Can a bar of `meter` be filled starting with a note? (A pattern starts
// on a note, so this is what a meter needs to be playable.)
export function canFillBar(values: ValueKey[], meter: number): boolean {
  const vs = values.map((k) => VALUE_BY_KEY[k]);
  const f = filler(vs, meter);
  return vs.some((v) => !v.rest && f.fits(v, 0, false) && f.can(f.after(v, 0).pos, false));
}

// Could fillBar have made this bar from these values? The tokens must split
// into the chosen values, each where it may start (the server's check of a
// custom round, lib/roundCheck.ts).
export function barMatchesChoice(tokens: Token[], values: ValueKey[], meter: number): boolean {
  const vs = values.map((k) => VALUE_BY_KEY[k]);
  const f = filler(vs, meter);
  const memo = new Map<string, boolean>();
  const match = (i: number, pos: number, lastEr: boolean): boolean => {
    if (i === tokens.length) return pos === f.end;
    const k = `${i}|${pos}|${lastEr}`;
    const got = memo.get(k);
    if (got !== undefined) return got;
    let ok = false;
    for (const v of vs) {
      if (!f.fits(v, pos, lastEr)) continue;
      if (!v.tokens.every((t, j) => tokens[i + j] === t)) continue;
      const n = f.after(v, pos);
      if (match(i + v.tokens.length, n.pos, n.lastEr)) {
        ok = true;
        break;
      }
    }
    memo.set(k, ok);
    return ok;
  };
  return match(0, 0, false);
}

const PLURAL: Record<ValueKey, string> = {
  w: "whole notes",
  dh: "dotted halves",
  h: "half notes",
  dqe: "dotted quarter + eighth",
  q: "quarter notes",
  ee: "eighth-note pairs",
  e: "single eighths",
  ssss: "four sixteenths",
  ess: "eighth + two sixteenths",
  sse: "two sixteenths + eighth",
  wr: "whole rests",
  hr: "half rests",
  qr: "quarter rests",
  er: "eighth rests",
};
// Which value to suggest first when a bar can't be filled (simplest first).
const SUGGEST_ORDER: ValueKey[] = ["q", "qr", "ee", "h", "e", "er", "dh", "hr", "dqe", "ssss", "ess", "sse", "w", "wr"];
const joinWith = (xs: string[], word: string) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${word} ${xs[xs.length - 1]}`);

// A friendly reason a choice can't be played, or null if it can. E.g.
// "Only half notes can't fill a bar of 3/4. Add quarter notes, quarter
// rests or dotted halves, or untick 3/4."
export function choiceProblem(c: RhythmChoice): string | null {
  const notes = c.values.filter((k) => !VALUE_BY_KEY[k].rest);
  if (notes.length === 0) return "Choose at least one note value: rests alone have nothing to tap.";
  if (c.meters.length === 0) return "Choose at least one time signature.";
  for (const m of c.meters) {
    if (canFillBar(c.values, m)) continue;
    const fixes = SUGGEST_ORDER.filter((k) => !c.values.includes(k) && canFillBar([...c.values, k], m)).slice(0, 3);
    const only = `Only ${joinWith(c.values.map((k) => PLURAL[k]), "and")} can't fill a bar of ${m}/4.`;
    const others = c.meters.length > 1 ? `, or untick ${m}/4` : "";
    if (fixes.length === 0) return `${only} Untick ${m}/4.`;
    return `${only} Add ${joinWith(fixes.map((k) => PLURAL[k]), "or")}${others}.`;
  }
  return null;
}

// One bar: random values that fit, never into a dead end. `firstNote`:
// the bar must start with a note. Rests are chosen a little less often.
export function fillBar(values: ValueKey[], meter: number, rnd: () => number, firstNote: boolean): Token[] | null {
  const vs = values.map((k) => VALUE_BY_KEY[k]);
  const f = filler(vs, meter);
  const out: Token[] = [];
  let pos = 0;
  let lastEr = false;
  while (pos < f.end) {
    const options = vs.filter((v) => {
      if (pos === 0 && firstNote && v.rest) return false;
      if (!f.fits(v, pos, lastEr)) return false;
      const n = f.after(v, pos);
      return f.can(n.pos, n.lastEr);
    });
    if (options.length === 0) return null;
    const weights = options.map((v) => (v.rest ? 0.6 : 1));
    let r = rnd() * weights.reduce((a, b) => a + b, 0);
    let pickV = options[options.length - 1];
    for (let i = 0; i < options.length; i++) {
      r -= weights[i];
      if (r < 0) {
        pickV = options[i];
        break;
      }
    }
    out.push(...pickV.tokens);
    const n = f.after(pickV, pos);
    pos = n.pos;
    lastEr = n.lastEr;
  }
  return out;
}

// 8 patterns from a custom choice (two bars, or one for Listen & Echo):
// each starts with a note and has a note in its second bar; no two in a
// row the same (unless the choice allows only one pattern, e.g. only whole
// notes). [] if it can't be played.
export function makeCustomRound(c: RhythmChoice, rnd: () => number = Math.random, barCount: 1 | 2 = 2): Pattern[] {
  if (choiceProblem(c)) return [];
  const out: Pattern[] = [];
  let tries = 0;
  while (out.length < PATTERNS_PER_ROUND) {
    tries++;
    const meter = pick(c.meters, rnd);
    const a = fillBar(c.values, meter, rnd, true);
    if (!a) continue;
    let bars = [a];
    if (barCount === 2) {
      const b = fillBar(c.values, meter, rnd, false);
      if (!b) continue;
      if (!hasNote(b) && tries < 400) continue;
      bars = [a, b];
    }
    const p: Pattern = { meter, bars };
    const prev = out[out.length - 1];
    if (prev && JSON.stringify(prev) === JSON.stringify(p) && tries < 400) continue;
    out.push(p);
  }
  return out;
}

// The choice, remembered on this device.
const CHOICE_KEY = "ritmo.rhythmJump.rhythms";

export function loadChoice(): { selected: RhythmLevel | "custom"; choice: RhythmChoice } | null {
  try {
    const raw = localStorage.getItem(CHOICE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { selected?: unknown; values?: unknown; meters?: unknown };
    const choice = normalizeChoice(v);
    const selected = v.selected === "easy" || v.selected === "medium" || v.selected === "hard" || v.selected === "custom" ? v.selected : presetOf(choice) ?? "custom";
    return { selected, choice };
  } catch {
    return null;
  }
}

export function saveChoice(selected: RhythmLevel | "custom", choice: RhythmChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify({ selected, ...normalizeChoice(choice) }));
  } catch {
    // blocked storage: it lasts for this visit only
  }
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

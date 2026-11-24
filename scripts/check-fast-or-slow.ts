// Automated check for Music Train / Fast or Slow (lib/fastOrSlow/music.ts).
//
//   npm run check:fast-or-slow
//
//   * every tune: bars add up (read here with our own little parser), both
//     voices equally long, and the accompaniment plays on every beat;
//   * tempos: every level's ranges are ordered with clear gaps (Easy fast
//     at least twice Easy slow), fit their Italian words (Largo ≤ 66,
//     Andante 76–108, Allegro 120–168, Presto ≥ 168), and 3000 generated
//     rounds only use tempos inside them;
//   * every piece lasts 4–8 seconds, at both ends of every range;
//   * Easy / Medium use the SAME melody at different tempos: each round
//     has melodies heard at two (Easy) or three (Medium) tempos, and those
//     versions have exactly the same notes and rhythm, only faster/slower;
//   * loudness and register never give the answer away: one volume for
//     every piece, the same note levels, the same keys (transposition)
//     whatever the answer, and Hard's traps in the same register;
//   * Hard: getting faster/slower pieces really speed up / slow down,
//     beat by beat, from their start to their end tempo; traps have many
//     more notes per second when slow than when fast;
//   * the train runs exactly on the beat: on a right answer its distance
//     is a whole number of beats at every beat time, so a wheel turn ends,
//     a puff of steam starts and a near tree passes the engine on each
//     beat; on a wrong answer the stop-go part ends on a beat, the
//     distance never jumps or goes backwards, and from then on it is on
//     the beat again;
//   * rounds of 10 with the right mix, no melody twice in a row;
//   * every tune is in lib/fastOrSlow/CREDITS.md, nothing Hebrew/Israeli.

import { readFileSync } from "node:fs";
import {
  ACCOMPANIMENT_GAIN,
  CHANGE_BEATS,
  CHANGE_FROM_TO,
  ITALIAN,
  MELODIES,
  MELODY_GAIN,
  ROUND_LENGTH,
  TEMPO_RANGES,
  TRANSPOSES,
  TRAPS,
  WHEEL_DEGREES_PER_BEAT,
  buildRound,
  nearItemXs,
  nearOffsetAt,
  puffTimes,
  render,
  repeatsFor,
  rideFor,
  starsFor,
  type Melody,
  type Question,
  type Speed,
  type TrainLevel,
} from "../lib/fastOrSlow/music";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 50) console.error("✗ " + msg);
};
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const LEVELS: TrainLevel[] = ["easy", "medium", "hard"];

// --- independent notation reader --------------------------------------------------
const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function readVoice(v: string): { bars: number[]; notes: { midi: number; start: number; beats: number }[]; length: number } {
  const bars: number[] = [];
  const notes: { midi: number; start: number; beats: number }[] = [];
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
    if (p !== "r")
      for (const n of p.split("+")) {
        const m = /^([A-G])(#|b)?(\d)$/.exec(n)!;
        notes.push({ midi: 12 * (Number(m[3]) + 1) + STEP[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0), start: t, beats });
      }
    t += beats;
    bar += beats;
  }
  bars.push(bar);
  return { bars, notes, length: t };
}

const ALL: Melody[] = [...MELODIES, ...TRAPS];
for (const m of ALL) {
  const [mel, acc] = m.voices.map(readVoice);
  [mel, acc].forEach((v, i) => v.bars.forEach((b, n) => !near(b, m.beatsPerBar) && fail(`${m.id}: voice ${i + 1} bar ${n + 1} = ${b} beats, not ${m.beatsPerBar}`)));
  if (!near(mel.length, acc.length)) fail(`${m.id}: voices differ in length`);
  if (mel.bars.length !== 2) fail(`${m.id}: ${mel.bars.length} bars, expected 2`);
  for (let b = 0; b < acc.length; b++) if (!acc.notes.some((n) => near(n.start, b))) fail(`${m.id}: no accompaniment note on beat ${b + 1}`);
}

// --- tempo ranges ------------------------------------------------------------------
const ITALIAN_BANDS: Record<string, [number, number]> = { Largo: [40, 66], Andante: [76, 108], Allegro: [120, 168], Presto: [168, 200] };
for (const level of LEVELS) {
  const r = TEMPO_RANGES[level];
  const order = (["slow", "medium", "fast"] as Speed[]).filter((s) => r[s]);
  for (let i = 1; i < order.length; i++) {
    const lo = r[order[i - 1]]!;
    const hi = r[order[i]]!;
    if (!(hi[0] >= lo[1] * 1.35)) fail(`${level}: ${order[i]} (${hi}) is not clearly faster than ${order[i - 1]} (${lo})`);
  }
  if (r.slow && r.fast && r.fast[0] < r.slow[1] * 2) fail(`${level}: fast is not at least twice slow`);
  for (const s of order) {
    const [a, b] = r[s]!;
    const band = ITALIAN_BANDS[ITALIAN[level][s]];
    if (!(a >= band[0] && b <= band[1])) fail(`${level} ${s}: ${a}–${b} is not ${ITALIAN[level][s]} (${band})`);
  }
}

// Every piece 4–8 s at both ends of every range.
for (const level of LEVELS)
  for (const [s, range] of Object.entries(TEMPO_RANGES[level]))
    for (const bpm of range!)
      for (const m of level === "hard" ? ALL : MELODIES) {
        if (m.trap === "busy" && s !== "slow") continue;
        if (m.trap === "calm" && s !== "fast") continue;
        const q: Question = { level, melody: m, answer: s as Speed, bpm, transpose: 0, repeats: repeatsFor(m, bpm) };
        const secs = render(q).seconds;
        if (secs < 4 - 1e-6 || secs > 8 + 1e-6) fail(`${level} ${m.id} @${bpm}: ${secs.toFixed(2)} s`);
      }

// --- generated rounds ------------------------------------------------------------------
let seed = 5;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const transposesBy = new Map<string, number[]>();
const gainsBy = new Map<string, number[]>();
let pieces = 0;
let beatChecks = 0;

function checkRide(q: Question, label: string) {
  const r = render(q);
  const S = 250;
  const engineX = 700;
  // Right answer: on the beat everywhere.
  const ride = rideFor(r, true);
  for (let k = 0; k <= r.totalBeats; k++) {
    const d = ride.distance(r.beats[k]);
    if (!near(d, k, 1e-9)) fail(`${label}: distance ${d} at beat ${k}`);
    if (!near(((d * WHEEL_DEGREES_PER_BEAT) % 360 + 360) % 360 % 360, 0, 1e-6) && !near((d * WHEEL_DEGREES_PER_BEAT) % 360, 360, 1e-6)) fail(`${label}: wheel not round at beat ${k}`);
    const xs = nearItemXs(nearOffsetAt(d, S), S, engineX, 1400);
    if (!xs.some((x) => near(x, engineX, 1e-6))) fail(`${label}: no near tree at the engine on beat ${k}`);
    beatChecks++;
  }
  const puffs = puffTimes(r);
  if (puffs.length !== r.totalBeats || puffs.some((p, k) => !near(p, r.beats[k], 1e-12))) fail(`${label}: puffs not on the beats`);
  // Between beats the distance moves evenly forward.
  for (let k = 0; k < r.totalBeats; k++) {
    const mid = ride.distance((r.beats[k] + r.beats[k + 1]) / 2);
    if (!near(mid, k + 0.5, 1e-9)) fail(`${label}: half-way through beat ${k} the train is at ${mid}`);
  }
  // Wrong answer: stop-go, then on the beat from the swap.
  for (const wrong of ["turtle", "dog", "rabbit"] as const) {
    const w = rideFor(r, false, wrong);
    if (w.swapTime < 0 || !near(w.swapTime, r.beats[w.swapBeat], 1e-12)) fail(`${label}: swap not on a beat`);
    if (w.swapBeat >= r.totalBeats) fail(`${label}: swap after the end`);
    let last = 0;
    for (let t = 0; t <= r.seconds; t += 0.005) {
      const d = w.distance(t);
      if (d < last - 1e-9) fail(`${label} (${wrong}): goes backwards at ${t.toFixed(3)} s`);
      if (d - last > 0.2) fail(`${label} (${wrong}): jumps at ${t.toFixed(3)} s`);
      last = d;
    }
    const at = w.distance(w.swapTime);
    if (!near(at, Math.round(at), 1e-9)) fail(`${label} (${wrong}): not a whole number of beats at the swap`);
    for (let k = w.swapBeat; k <= r.totalBeats; k++) if (!near(w.distance(r.beats[k]) - at, k - w.swapBeat, 1e-9)) fail(`${label} (${wrong}): off the beat at beat ${k}`);
    const after = w.puffs.filter((p) => p >= w.swapTime - 1e-12);
    if (after.length !== r.totalBeats - w.swapBeat || after.some((p, i) => !near(p, r.beats[w.swapBeat + i], 1e-12))) fail(`${label} (${wrong}): puffs after the swap not on the beats`);
  }
}

for (const level of LEVELS) {
  for (let n = 0; n < 1000; n++) {
    const round = buildRound(level, rnd);
    if (round.length !== ROUND_LENGTH) fail(`${level}: round of ${round.length}`);
    round.forEach((q, i) => {
      if (i > 0 && round[i - 1].melody.id === q.melody.id) fail(`${level}: ${q.melody.id} twice in a row`);
      if (!TRANSPOSES.includes(q.transpose)) fail(`${level}: transpose ${q.transpose}`);
      const key = `${level}:${q.answer}`;
      transposesBy.set(key, [...(transposesBy.get(key) ?? []), q.transpose]);
      if (q.bpmTo === undefined) {
        const range = TEMPO_RANGES[level][q.answer as Speed];
        if (!range || q.bpm < range[0] || q.bpm > range[1]) fail(`${level}: ${q.answer} at ${q.bpm} BPM, outside ${range}`);
        if (q.melody.trap === "busy" && q.answer !== "slow") fail(`${level}: busy trap answered ${q.answer}`);
        if (q.melody.trap === "calm" && q.answer !== "fast") fail(`${level}: calm trap answered ${q.answer}`);
      } else {
        const [from, to] = CHANGE_FROM_TO[q.answer as "faster" | "slower"];
        if (q.bpm !== from || q.bpmTo !== to) fail(`${level}: change ${q.answer} ${q.bpm}→${q.bpmTo}`);
      }
      if (n < 60) {
        const r = render(q);
        if (r.seconds < 4 - 1e-6 || r.seconds > 8 + 1e-6) fail(`${level} ${q.melody.id}: ${r.seconds.toFixed(2)} s`);
        for (const note of r.notes) gainsBy.set(key, [...(gainsBy.get(key) ?? []), note.gain]);
        // Every beat has an accompaniment note starting exactly on it, so
        // the beat the train shows is the beat you hear.
        for (let k = 0; k < r.totalBeats; k++) if (!r.notes.some((x) => x.voice === 1 && near(x.time, r.beats[k], 1e-9))) fail(`${level} ${q.melody.id}: beat ${k} not heard`);
        if (n < 12) checkRide(q, `${level} ${q.melody.id} ${q.answer}`);
        pieces++;
      }
    });
    const count = (a: string) => round.filter((q) => q.answer === a).length;
    if (level === "easy") {
      if (count("slow") !== 5 || count("fast") !== 5) fail(`easy: ${count("slow")} slow / ${count("fast")} fast`);
      // The same melody at both tempos.
      const ids = new Set(round.map((q) => q.melody.id));
      for (const id of ids) {
        const qs = round.filter((q) => q.melody.id === id);
        if (new Set(qs.map((q) => q.answer)).size !== 2) fail(`easy: ${id} not heard at both tempos`);
        sameMusic(qs, "easy");
      }
    } else if (level === "medium") {
      for (const s of ["slow", "medium", "fast"]) if (count(s) < 3 || count(s) > 4) fail(`medium: ${count(s)} ${s}`);
      const atAllThree = [...new Set(round.map((q) => q.melody.id))].filter((id) => new Set(round.filter((q) => q.melody.id === id).map((q) => q.answer)).size === 3);
      if (atAllThree.length < 3) fail(`medium: only ${atAllThree.length} melodies at all three tempos`);
      for (const id of atAllThree) sameMusic(round.filter((q) => q.melody.id === id), "medium");
    } else {
      if (count("faster") !== 2 || count("slower") !== 2) fail(`hard: ${count("faster")} faster / ${count("slower")} slower`);
      if (round.filter((q) => q.melody.trap === "busy").length !== 2 || round.filter((q) => q.melody.trap === "calm").length !== 2) fail("hard: not 2 + 2 traps");
      if (count("slow") !== 3 || count("fast") !== 3) fail(`hard: ${count("slow")} slow / ${count("fast")} fast`);
    }
  }
}

// The versions of one melody: the same notes and rhythm (in beats, in C),
// only the tempo differs.
function sameMusic(qs: Question[], label: string) {
  const shape = (q: Question) => {
    const r = render(q);
    const spb = 60 / q.bpm;
    const one = readVoice(q.melody.voices[0]).length;
    return r.notes
      .filter((n) => n.time / spb < one - 1e-9)
      .map((n) => `${n.midi - q.transpose}@${(n.time / spb).toFixed(4)}/${(n.seconds / 0.96 / spb).toFixed(4)}`)
      .join(" ");
  };
  const first = shape(qs[0]);
  for (const q of qs.slice(1)) if (shape(q) !== first) fail(`${label}: ${q.melody.id} differs between tempos`);
  if (new Set(qs.map((q) => q.bpm)).size !== qs.length) fail(`${label}: ${qs[0].melody.id} at the same tempo twice`);
}

// Loudness: one level per voice, so every answer has the same mix.
for (const [key, gains] of gainsBy) {
  for (const g of gains) if (g !== MELODY_GAIN && g !== ACCOMPANIMENT_GAIN) fail(`${key}: note level ${g}`);
}
const meanGain = (key: string) => {
  const g = gainsBy.get(key) ?? [];
  return g.reduce((a, b) => a + b, 0) / Math.max(1, g.length);
};
for (const level of ["easy", "medium"] as TrainLevel[]) {
  const keys = [...gainsBy.keys()].filter((k) => k.startsWith(level));
  const means = keys.map(meanGain);
  if (Math.max(...means) - Math.min(...means) > 0.03) fail(`${level}: average note level differs by answer (${keys.map((k, i) => `${k} ${means[i].toFixed(3)}`).join(", ")})`);
}
const volumeUses = readFileSync("components/musicTrain/player.ts", "utf8").match(/gain\.value\s*=\s*([^;]+);/g) ?? [];
if (volumeUses.length !== 1 || !volumeUses[0].includes("VOLUME")) fail(`player: the volume must be the one VOLUME for every piece (${volumeUses.join(" ")})`);

// Register: the same keys whatever the answer.
for (const level of LEVELS) {
  const keys = [...transposesBy.keys()].filter((k) => k.startsWith(level));
  const all = keys.flatMap((k) => transposesBy.get(k)!);
  const mean = all.reduce((a, b) => a + b, 0) / all.length;
  for (const k of keys) {
    const xs = transposesBy.get(k)!;
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    if (Math.abs(m - mean) > 0.3) fail(`${k}: average key ${m.toFixed(2)} vs ${mean.toFixed(2)}`);
    if (new Set(xs).size !== TRANSPOSES.length) fail(`${k}: not every key used`);
  }
}
const meanPitch = (m: Melody) => {
  const ns = readVoice(m.voices[0]).notes;
  return ns.reduce((a, n) => a + n.midi * n.beats, 0) / ns.reduce((a, n) => a + n.beats, 0);
};
const busy = TRAPS.filter((t) => t.trap === "busy");
const calm = TRAPS.filter((t) => t.trap === "calm");
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const busyPitch = avg(busy.map(meanPitch));
const calmPitch = avg(calm.map(meanPitch));
if (Math.abs(busyPitch - calmPitch) > 3) fail(`traps: busy ones sit at ${busyPitch.toFixed(1)}, calm ones at ${calmPitch.toFixed(1)} (register gives it away)`);

// Traps: busy-but-slow really has more notes a second than calm-but-fast.
const notesPerSecond = (m: Melody, bpm: number) => {
  const v = readVoice(m.voices[0]);
  return v.notes.length / ((v.length * 60) / bpm);
};
const slowR = TEMPO_RANGES.hard.slow!;
const fastR = TEMPO_RANGES.hard.fast!;
const busiest = Math.min(...busy.map((m) => notesPerSecond(m, slowR[0])));
const calmest = Math.max(...calm.map((m) => notesPerSecond(m, fastR[1])));
if (!(busiest > calmest * 2.5)) fail(`traps: busy ${busiest.toFixed(2)} notes/s vs calm ${calmest.toFixed(2)} notes/s, not a real trap`);

// Getting faster / slower, beat by beat.
for (const m of MELODIES)
  for (const change of ["faster", "slower"] as const) {
    const [from, to] = CHANGE_FROM_TO[change];
    const q: Question = { level: "hard", melody: m, answer: change, bpm: from, bpmTo: to, transpose: 0, repeats: 1 };
    const r = render(q);
    if (r.totalBeats !== CHANGE_BEATS) fail(`${m.id} ${change}: ${r.totalBeats} beats`);
    const gaps = r.beats.slice(1, r.totalBeats + 1).map((b, k) => b - r.beats[k]);
    for (let k = 1; k < gaps.length; k++) {
      if (change === "faster" ? !(gaps[k] < gaps[k - 1]) : !(gaps[k] > gaps[k - 1])) fail(`${m.id} ${change}: beat ${k + 1} doesn't ${change === "faster" ? "speed up" : "slow down"}`);
    }
    if (!near(60 / gaps[0], from, 0.01) || !near(60 / gaps[gaps.length - 1], to, 0.01)) fail(`${m.id} ${change}: ${(60 / gaps[0]).toFixed(1)}→${(60 / gaps[gaps.length - 1]).toFixed(1)} BPM`);
    if (r.seconds < 4 || r.seconds > 8) fail(`${m.id} ${change}: ${r.seconds.toFixed(2)} s`);
    checkRide(q, `${m.id} ${change}`);
  }

// Stars, credits, content.
if (starsFor(10) !== 3 || starsFor(9) !== 3 || starsFor(8) !== 2 || starsFor(6) !== 2 || starsFor(5) !== 1 || starsFor(0) !== 1) fail("stars");
const credits = readFileSync("lib/fastOrSlow/CREDITS.md", "utf8");
for (const m of ALL) {
  if (!credits.includes(`| ${m.id} |`) || !credits.includes(m.title)) fail(`${m.id} is not in CREDITS.md`);
  if (/[֐-׿]|israel|hebrew/i.test(`${m.title} ${m.source}`)) fail(`${m.id}: not allowed content`);
}

if (failures) {
  console.error(`\n${failures} problem(s) found.`);
  process.exit(1);
}
console.log(
  `✓ ${ALL.length} tunes, 3000 rounds, ${pieces} pieces rendered: tempos in range, same melody at different tempos, equal loudness and register, ${beatChecks} beats with wheels, steam and trees exactly on the beat.`
);

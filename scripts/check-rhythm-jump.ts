// Automated check for Rhythm Jump's rhythms (lib/rhythmJump.ts).
//
//   npm run check:rhythm-jump
//
// Against facts written out here (not taken from the game's code):
//   * every bar in every level's pool adds up to its time signature
//     (quarter = 1, half = 2, eighth = ½, sixteenth = ¼, dotted quarter =
//     1½, quarter rest = 1);
//   * each level only uses its own note values (Easy: quarters and quarter
//     rests in 4/4; Medium adds eighths and halves in 2/4, 3/4, 4/4; Hard
//     adds dotted quarters, sixteenths and syncopation);
//   * beaming: eighths and sixteenths that share a beat are beamed
//     together (sixteenths with a second beam), a short note alone in its
//     beat has a flag (2 for a sixteenth), nothing longer is beamed, rests
//     are never in a beam, and no beam crosses a beat or a bar line;
//   * the notation's note heads (filled, hollow, dotted) and syllables;
//   * the pads: one per note, none for rests, each at the exact time the
//     notes before it add up to, at 3 tempos per level, and the timing
//     windows never let one tap count for two notes;
//   * 300 generated rounds per level: 8 patterns, 2 bars, start on a note,
//     use the level's new figures;
//   * stars and calibration maths.
// Exits with code 1 and lists failures if anything is wrong.

import {
  LEVELS,
  PATTERNS_PER_ROUND,
  TEMPOS,
  bpmFor,
  delayFromOffsets,
  layoutPattern,
  makeRound,
  padsFor,
  parseBar,
  rate,
  starsFor,
  accuracy,
  windowsFor,
  type Pattern,
  type RhythmLevel,
} from "../lib/rhythmJump";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 40) console.error("✗ " + msg);
};

// --- independent reference ------------------------------------------------------
const BEATS: Record<string, number> = { q: 1, h: 2, e: 0.5, s: 0.25, dq: 1.5, qr: 1 };
const ALLOWED: Record<RhythmLevel, string[]> = {
  easy: ["q", "qr"],
  medium: ["q", "qr", "e", "h"],
  hard: ["q", "qr", "e", "h", "s", "dq"],
};
const METERS: Record<RhythmLevel, number[]> = { easy: [4], medium: [2, 3, 4], hard: [2, 3, 4] };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// Expected beam groups for one bar: runs of e/s notes inside the same beat.
function expectedGroups(bar: string[]): { groups: number[][]; flags: Map<number, number> } {
  const groups: number[][] = [];
  const flags = new Map<number, number>();
  let pos = 0;
  let cur: number[] = [];
  let curBeat = -1;
  const close = () => {
    if (cur.length >= 2) groups.push(cur);
    else if (cur.length === 1) flags.set(cur[0], bar[cur[0]] === "s" ? 2 : 1);
    cur = [];
    curBeat = -1;
  };
  bar.forEach((t, i) => {
    const beat = Math.floor(pos + 1e-9);
    const short = t === "e" || t === "s";
    const inside = pos + BEATS[t] <= beat + 1 + 1e-9;
    if (short && inside) {
      if (cur.length && curBeat !== beat) close();
      cur.push(i);
      curBeat = beat;
    } else {
      close();
      if (short) flags.set(i, t === "s" ? 2 : 1);
    }
    pos += BEATS[t];
  });
  close();
  return { groups, flags };
}

function checkPattern(label: string, p: Pattern, level: RhythmLevel) {
  if (!METERS[level].includes(p.meter)) fail(`${label}: ${p.meter}/4 not allowed on ${level}`);
  const layout = layoutPattern(p);

  // Bars add up; tokens allowed.
  p.bars.forEach((bar, b) => {
    const sum = bar.reduce((a, t) => a + BEATS[t], 0);
    if (!near(sum, p.meter)) fail(`${label} bar ${b + 1} "${bar.join(" ")}" adds up to ${sum}, not ${p.meter}`);
    for (const t of bar) if (!ALLOWED[level].includes(t)) fail(`${label}: "${t}" not allowed on ${level}`);
  });
  if (!near(layout.totalBeats, p.meter * p.bars.length)) fail(`${label}: total ${layout.totalBeats} beats`);

  // Beams and flags, bar by bar, against the independent grouping.
  let offset = 0;
  const gameGroups = layout.beams.map((bm) => bm.notes);
  const expectedAll: number[][] = [];
  p.bars.forEach((bar) => {
    const { groups, flags } = expectedGroups(bar);
    groups.forEach((g) => expectedAll.push(g.map((i) => i + offset)));
    bar.forEach((t, i) => {
      const el = layout.elements[offset + i];
      if (el.token !== t) fail(`${label}: element ${offset + i} is ${el.token}, expected ${t}`);
      const wantFlags = flags.get(i) ?? 0;
      if (el.flags !== wantFlags) fail(`${label}: ${t} at bar position ${el.startInBar} has ${el.flags} flags, expected ${wantFlags}`);
      if (el.hollow !== (t === "h")) fail(`${label}: ${t} hollow=${el.hollow}`);
      if (el.dotted !== (t === "dq")) fail(`${label}: ${t} dotted=${el.dotted}`);
      if ((el.beam !== null) === (wantFlags > 0)) {
        if (el.beam !== null) fail(`${label}: ${t} is both beamed and flagged`);
      }
    });
    offset += bar.length;
  });
  if (JSON.stringify(gameGroups) !== JSON.stringify(expectedAll)) {
    fail(`${label}: beams ${JSON.stringify(gameGroups)}, expected ${JSON.stringify(expectedAll)}`);
  }
  for (const bm of layout.beams) {
    const els = bm.notes.map((i) => layout.elements[i]);
    if (els.some((e) => e.rest || e.beats >= 1)) fail(`${label}: a rest or long note in a beam`);
    if (new Set(els.map((e) => e.bar)).size !== 1) fail(`${label}: a beam crosses a bar line`);
    if (new Set(els.map((e) => Math.floor(e.startInBar + 1e-9))).size !== 1) fail(`${label}: a beam crosses a beat`);
    // Second beams join exactly the consecutive sixteenths.
    const sixteenths = els.filter((e) => e.token === "s").map((e) => e.index);
    const joined = bm.secondary.flat();
    if (JSON.stringify(sixteenths) !== JSON.stringify(joined)) fail(`${label}: second beams ${JSON.stringify(bm.secondary)} vs sixteenths ${sixteenths}`);
    for (const run of bm.secondary) if (run.length < 2) fail(`${label}: a lone sixteenth in a beam would need a half beam`);
  }

  // Syllables.
  for (const e of layout.elements) {
    const frac = Math.round((e.startInBar % 1) * 4);
    const want =
      e.token === "qr" ? "Sh" : e.token === "h" ? "Ta-a" : e.token === "dq" ? "Ta-i" : e.token === "q" ? "Ta" : frac === 0 ? "Ti" : frac === 2 ? "ti" : "ka";
    if (e.syllable !== want) fail(`${label}: ${e.token} at ${e.startInBar} says "${e.syllable}", expected "${want}"`);
  }

  // Pads at every tempo: exact times, none for rests, windows that never overlap.
  for (const tempo of TEMPOS) {
    const bpm = bpmFor(level, tempo);
    const spb = 60 / bpm;
    const pads = padsFor(layout, bpm);
    const flat = p.bars.flat();
    const notes = flat.filter((t) => t !== "qr").length;
    if (pads.length !== notes) fail(`${label} @${bpm}: ${pads.length} pads for ${notes} notes`);
    let t = 0;
    let k = 0;
    flat.forEach((tok, i) => {
      if (tok !== "qr") {
        const pad = pads[k++];
        if (!pad || pad.element !== i) fail(`${label} @${bpm}: pad ${k - 1} belongs to element ${pad?.element}, expected ${i}`);
        else {
          if (!near(pad.time, t)) fail(`${label} @${bpm}: pad for element ${i} at ${pad.time}s, expected ${t}s`);
          if (!near(pad.beats, BEATS[tok])) fail(`${label} @${bpm}: pad size ${pad.beats} for ${tok}`);
        }
      }
      t += BEATS[tok] * spb;
    });
    for (let i = 1; i < pads.length; i++) {
      // The gap between two pads is exactly the notes and rests between them.
      const between = flat.slice(pads[i - 1].element, pads[i].element).reduce((a, x) => a + BEATS[x], 0) * spb;
      if (!near(pads[i].time - pads[i - 1].time, between)) fail(`${label} @${bpm}: gap ${i} is not the note length`);
    }
    const wins = windowsFor(pads, level);
    for (let i = 1; i < pads.length; i++) {
      if (pads[i - 1].time + wins[i - 1].good >= pads[i].time - wins[i].good) fail(`${label} @${bpm}: windows of notes ${i - 1} and ${i} overlap`);
    }
    wins.forEach((w, i) => {
      if (!(w.perfect > 0 && w.perfect < w.good)) fail(`${label} @${bpm}: window ${i} perfect ${w.perfect} / good ${w.good}`);
      if (rate(0, w) !== "perfect" || rate(w.good * 0.99, w) !== "good" || rate(w.good * 1.01, w) !== "miss") fail(`${label}: ratings wrong at window ${i}`);
    });
  }
}

let patternsChecked = 0;
for (const level of ["easy", "medium", "hard"] as RhythmLevel[]) {
  const cfg = LEVELS[level];
  if (JSON.stringify(cfg.meters) !== JSON.stringify(METERS[level])) fail(`${level}: meters ${cfg.meters}`);
  // Every bar of the pool, alone and paired with every other bar.
  for (const meter of cfg.meters) {
    const pool = cfg.bars[meter].map(parseBar);
    for (let a = 0; a < pool.length; a++)
      for (let b = 0; b < pool.length; b++) {
        checkPattern(`${level} ${meter}/4 [${pool[a].join(" ")} | ${pool[b].join(" ")}]`, { meter, bars: [pool[a], pool[b]] }, level);
        patternsChecked++;
      }
  }
  // Generated rounds.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < 300; r++) {
    const round = makeRound(level, rnd);
    if (round.length !== PATTERNS_PER_ROUND) fail(`${level}: round of ${round.length}`);
    round.forEach((p, i) => {
      if (p.bars.length !== 2) fail(`${level}: pattern with ${p.bars.length} bars`);
      if (p.bars[0][0] === "qr") fail(`${level}: pattern starts with a rest`);
      if (p.bars.flat().filter((t) => t !== "qr").length < 3) fail(`${level}: fewer than 3 notes`);
      const tokens = p.bars.flat();
      if (level === "medium" && !tokens.some((t) => t === "e" || t === "h")) fail(`medium pattern without eighths or halves`);
      if (level === "hard") {
        const L = layoutPattern(p);
        const sync = L.elements.some((e) => e.token === "q" && near(e.startInBar % 1, 0.5));
        if (!tokens.some((t) => t === "dq" || t === "s") && !sync) fail(`hard pattern without a hard figure: ${tokens.join(" ")}`);
      }
      if (i > 0 && JSON.stringify(round[i - 1]) === JSON.stringify(p)) fail(`${level}: same pattern twice in a row`);
    });
  }
}

// Stars and calibration.
if (starsFor(1) !== 3 || starsFor(0.85) !== 3 || starsFor(0.84) !== 2 || starsFor(0.6) !== 2 || starsFor(0.59) !== 1 || starsFor(0) !== 1) fail("star thresholds");
if (!near(accuracy(["perfect", "good", "miss"], 0), 1.6 / 3)) fail("accuracy maths");
if (accuracy(["miss"], 3) !== 0) fail("accuracy below 0");
const d = delayFromOffsets([0.1, 0.12, 0.11, 0.09, 0.13, 0.5, -0.4, 0.1]);
// Near taps: 0.09 0.10 0.10 0.11 0.12 0.13 → median 105 ms (0.5 and −0.4 are ignored).
if (d === null || Math.abs(d - 105) > 0.001) fail(`calibration median ${d}`);
if (delayFromOffsets([0.1, 0.1, 0.5, 0.6]) !== null) fail("calibration with too few taps should fail");

if (failures) {
  console.error(`\n${failures} problem(s) found.`);
  process.exit(1);
}
console.log(`✓ ${patternsChecked} two-bar patterns × 3 tempos and 900 generated rounds: bars add up, beaming is right, pads match the note lengths exactly.`);

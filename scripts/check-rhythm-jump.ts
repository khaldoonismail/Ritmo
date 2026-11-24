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
//   * taps: nothing in the count-in or after the end; on time on a note =
//     Perfect for that note, a bit late = Good; a tap on a rest, a note
//     tapped twice, or a tap outside every window = a splash;
//   * lily pads come in advance only in Practice, only on Easy;
//   * custom rhythms: 3000 random choices of note values, rests and time
//     signatures. Whether each can be played is worked out here by brute
//     force (every way to fill a bar with the chosen figures, placed
//     properly: long notes and beamed groups on a beat, a half rest on
//     beat 1 or 3, never two eighth rests in one beat); the playable ones
//     must give 8 patterns whose bars add up, beam right and split into
//     only the chosen figures; the others must be blocked with a message
//     (and suggested fixes must really fix it);
//   * the presets' hand-made bars use only their preset's checkboxes;
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
  judgeTap,
  padsAhead,
  PRESET_CHOICES,
  choiceProblem,
  levelOfChoice,
  makeCustomRound,
  presetOf,
  type RhythmChoice,
  type ValueKey,
  type Pattern,
  type Rating,
  type RhythmLevel,
} from "../lib/rhythmJump";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 40) console.error("✗ " + msg);
};

// --- independent reference ------------------------------------------------------
const BEATS: Record<string, number> = { w: 4, dh: 3, h: 2, dq: 1.5, q: 1, e: 0.5, s: 0.25, wr: 4, hr: 2, qr: 1, er: 0.5 };
const RESTS = ["wr", "hr", "qr", "er"];
const isRestT = (t: string) => RESTS.includes(t);

// The custom figures, written out again here: tokens, rest or note, and
// where each may start ("beat", "half" = any eighth, "even" = beat 1 or 3).
const FIGURES: Record<ValueKey, { tokens: string[]; rest: boolean; start: "beat" | "half" | "even" }> = {
  w: { tokens: ["w"], rest: false, start: "beat" },
  dh: { tokens: ["dh"], rest: false, start: "beat" },
  h: { tokens: ["h"], rest: false, start: "beat" },
  dqe: { tokens: ["dq", "e"], rest: false, start: "beat" },
  q: { tokens: ["q"], rest: false, start: "half" },
  ee: { tokens: ["e", "e"], rest: false, start: "beat" },
  e: { tokens: ["e"], rest: false, start: "half" },
  ssss: { tokens: ["s", "s", "s", "s"], rest: false, start: "beat" },
  ess: { tokens: ["e", "s", "s"], rest: false, start: "beat" },
  sse: { tokens: ["s", "s", "e"], rest: false, start: "beat" },
  wr: { tokens: ["wr"], rest: true, start: "beat" },
  hr: { tokens: ["hr"], rest: true, start: "even" },
  qr: { tokens: ["qr"], rest: true, start: "beat" },
  er: { tokens: ["er"], rest: true, start: "half" },
};
const KEYS = Object.keys(FIGURES) as ValueKey[];
// The words the game's messages use for each value (to check suggestions).
const PLURAL_HERE: Record<string, string> = {
  w: "whole notes", dh: "dotted halves", h: "half notes", dqe: "dotted quarter + eighth", q: "quarter notes",
  ee: "eighth-note pairs", e: "single eighths", ssss: "four sixteenths", ess: "eighth + two sixteenths",
  sse: "two sixteenths + eighth", wr: "whole rests", hr: "half rests", qr: "quarter rests", er: "eighth rests",
};
const figBeats = (k: ValueKey) => FIGURES[k].tokens.reduce((a, t) => a + BEATS[t], 0);
const placeOk = (k: ValueKey, pos: number, prev: { key: ValueKey; pos: number } | null) => {
  const f = FIGURES[k];
  const onBeat = near(pos % 1, 0);
  if (f.start === "beat" && !onBeat) return false;
  if (f.start === "even" && !(near(pos, 0) || near(pos, 2))) return false;
  // Two eighth rests in the same beat.
  if (k === "er" && prev?.key === "er" && Math.floor(prev.pos + 1e-9) === Math.floor(pos + 1e-9)) return false;
  return true;
};

// Can these tokens be split into the chosen figures, placed properly?
// `must`: a value that has to be used at least once.
function splitsInto(bar: string[], keys: ValueKey[], must?: ValueKey): boolean {
  const go = (i: number, pos: number, prev: { key: ValueKey; pos: number } | null, used = false): boolean => {
    if (i === bar.length) return !must || used;
    return keys.some((k) => {
      const t = FIGURES[k].tokens;
      if (bar.slice(i, i + t.length).join() !== t.join()) return false;
      if (!placeOk(k, pos, prev)) return false;
      return go(i + t.length, pos + figBeats(k), { key: k, pos }, used || k === must);
    });
  };
  return go(0, 0, null);
}

// Brute force: is there any bar of `meter` from these figures that starts
// with a note? (Search every sequence; small enough at ≤ 16 eighths.)
function playableBar(keys: ValueKey[], meter: number): boolean {
  const go = (pos: number, prev: { key: ValueKey; pos: number } | null, first: boolean): boolean => {
    if (near(pos, meter)) return true;
    if (pos > meter + 1e-9) return false;
    return keys.some((k) => {
      if (first && FIGURES[k].rest) return false;
      if (!placeOk(k, pos, prev)) return false;
      if (pos + figBeats(k) > meter + 1e-9) return false;
      return go(pos + figBeats(k), { key: k, pos }, false);
    });
  };
  return go(0, null, true);
}
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

function checkPattern(label: string, p: Pattern, level: RhythmLevel, custom?: RhythmChoice) {
  if (custom) {
    if (!custom.meters.includes(p.meter)) fail(`${label}: ${p.meter}/4 not chosen`);
    p.bars.forEach((bar, b) => {
      if (!splitsInto(bar, custom.values)) fail(`${label}: bar ${b + 1} "${bar.join(" ")}" is not made of only the chosen values ${custom.values.join(",")}`);
    });
  } else if (!METERS[level].includes(p.meter)) fail(`${label}: ${p.meter}/4 not allowed on ${level}`);
  const layout = layoutPattern(p);

  // Bars add up; tokens allowed.
  p.bars.forEach((bar, b) => {
    const sum = bar.reduce((a, t) => a + BEATS[t], 0);
    if (!near(sum, p.meter)) fail(`${label} bar ${b + 1} "${bar.join(" ")}" adds up to ${sum}, not ${p.meter}`);
    if (!custom) for (const t of bar) if (!ALLOWED[level].includes(t)) fail(`${label}: "${t}" not allowed on ${level}`);
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
      if (el.hollow !== ["h", "dh", "w"].includes(t)) fail(`${label}: ${t} hollow=${el.hollow}`);
      if (el.dotted !== ["dq", "dh"].includes(t)) fail(`${label}: ${t} dotted=${el.dotted}`);
      if (el.rest !== isRestT(t)) fail(`${label}: ${t} rest=${el.rest}`);
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
      isRestT(e.token) ? "Sh" : e.token === "w" ? "Ta-a-a-a" : e.token === "dh" ? "Ta-a-a" : e.token === "h" ? "Ta-a" : e.token === "dq" ? "Ta-i" : e.token === "q" ? "Ta" : frac === 0 ? "Ti" : frac === 2 ? "ti" : "ka";
    if (e.syllable !== want) fail(`${label}: ${e.token} at ${e.startInBar} says "${e.syllable}", expected "${want}"`);
  }

  // Pads at every tempo: exact times, none for rests, windows that never overlap.
  for (const tempo of TEMPOS) {
    const bpm = bpmFor(level, tempo);
    const spb = 60 / bpm;
    const pads = padsFor(layout, bpm);
    const flat = p.bars.flat();
    const notes = flat.filter((t) => !isRestT(t)).length;
    if (pads.length !== notes) fail(`${label} @${bpm}: ${pads.length} pads for ${notes} notes`);
    let t = 0;
    let k = 0;
    flat.forEach((tok, i) => {
      if (!isRestT(tok)) {
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

    // Taps (times worked out from the tokens here, not from the pads).
    const total = flat.reduce((a, x) => a + BEATS[x], 0) * spb;
    const none = pads.map(() => null);
    const tap = (rel: number, results: (Rating | null)[] = none) => judgeTap(rel, layout, pads, wins, results, spb);
    if (tap(-p.meter * spb * 0.5).kind !== "ignore") fail(`${label} @${bpm}: a tap in the count-in should do nothing`);
    if (tap(total + 0.5).kind !== "ignore") fail(`${label} @${bpm}: a tap after the end should do nothing`);
    let at = 0;
    flat.forEach((tok, i) => {
      const len = BEATS[tok] * spb;
      if (isRestT(tok)) {
        // Middle of a rest: a splash on that rest.
        const r = tap(at + len / 2);
        if (r.kind !== "splash" || r.rest !== i) fail(`${label} @${bpm}: tap on the rest ${i} gave ${JSON.stringify(r)}`);
      } else {
        const k = flat.slice(0, i).filter((x) => !isRestT(x)).length;
        const onTime = tap(at);
        if (onTime.kind !== "note" || onTime.pad !== k || onTime.rating !== "perfect") fail(`${label} @${bpm}: on-time tap on note ${i} gave ${JSON.stringify(onTime)}`);
        // The same note tapped again: a wrong tap, so a splash.
        const done = none.map((_, j) => (j === k ? "perfect" : null)) as (Rating | null)[];
        if (tap(at, done).kind !== "splash") fail(`${label} @${bpm}: tapping note ${i} twice should splash`);
        // Just outside its window (and every other note's): a splash.
        if (tap(at + wins[k].good * 1.05).kind !== "splash") fail(`${label} @${bpm}: a late tap after note ${i}'s window should splash`);
        // A little late but in the window: "good", for that note.
        const late = tap(at + (wins[k].perfect + wins[k].good) / 2);
        if (late.kind !== "note" || late.pad !== k || late.rating !== "good") fail(`${label} @${bpm}: a slightly late tap on note ${i} gave ${JSON.stringify(late)}`);
      }
      at += len;
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

// --- presets as checkboxes ----------------------------------------------------------
for (const level of ["easy", "medium", "hard"] as RhythmLevel[]) {
  const c = PRESET_CHOICES[level];
  if (presetOf(c) !== level) fail(`${level}: its checkboxes aren't recognised as ${level}`);
  if (JSON.stringify([...c.meters].sort()) !== JSON.stringify(METERS[level])) fail(`${level}: preset time signatures ${c.meters}`);
  for (const m of LEVELS[level].meters)
    for (const bar of LEVELS[level].bars[m]) if (!splitsInto(parseBar(bar), c.values)) fail(`${level}: hand-made bar "${bar}" uses a value not ticked in the preset`);
  // Every ticked value is really used somewhere in the preset's bars.
  for (const k of c.values) {
    const used = LEVELS[level].meters.some((m) => LEVELS[level].bars[m].some((bar) => splitsInto(parseBar(bar), c.values, k)));
    if (!used) fail(`${level}: "${k}" is ticked but no hand-made bar uses it`);
  }
}

// --- custom choices ---------------------------------------------------------------
{
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let playable = 0;
  let blocked = 0;
  const named: [RhythmChoice, boolean][] = [
    [{ values: ["h"], meters: [3] }, false], // the example: only half notes in 3/4
    [{ values: ["h"], meters: [2, 4] }, true],
    [{ values: ["w"], meters: [4] }, true],
    [{ values: ["w"], meters: [2] }, false],
    [{ values: ["dh"], meters: [3] }, true],
    [{ values: ["qr", "hr"], meters: [4] }, false], // rests only
    [{ values: ["q"], meters: [] }, false],
    [{ values: ["dqe"], meters: [3] }, false],
    [{ values: ["dqe", "q"], meters: [3] }, true],
    [{ values: ["e", "er"], meters: [2, 3, 4] }, true],
    [{ values: ["ssss", "ess", "sse"], meters: [3] }, true],
    [{ values: ["h", "hr"], meters: [3] }, false], // a half rest can't start on beat 2
  ];
  const checkChoice = (c: RhythmChoice, label: string, expect?: boolean) => {
    const can = c.values.some((k) => !FIGURES[k].rest) && c.meters.length > 0 && c.meters.every((m) => playableBar(c.values, m));
    if (expect !== undefined && can !== expect) fail(`${label}: the brute force says ${can}, expected ${expect}`);
    const problem = choiceProblem(c);
    const round = makeCustomRound(c, rnd);
    if (!can) {
      blocked++;
      if (!problem) fail(`${label}: can't be played but isn't blocked`);
      if (round.length) fail(`${label}: can't be played but made a round`);
      // Suggested fixes must really fix the bar they're about.
      const m = problem?.match(/bar of (\d)\/4/);
      if (m) {
        const meter = Number(m[1]);
        if (playableBar(c.values, meter)) fail(`${label}: the message blames ${meter}/4, which works`);
        for (const [k, word] of Object.entries(PLURAL_HERE)) {
          if (problem!.includes(`Add`) && problem!.split("Add")[1].includes(word) && !playableBar([...c.values, k as ValueKey], meter))
            fail(`${label}: suggests adding ${word}, which doesn't fix ${meter}/4`);
        }
      }
      return;
    }
    playable++;
    if (problem) fail(`${label}: can be played but is blocked: ${problem}`);
    if (round.length !== PATTERNS_PER_ROUND) return fail(`${label}: round of ${round.length}`);
    const lvl = levelOfChoice(c);
    round.forEach((p, i) => {
      const pl = `${label} #${i + 1} ${p.meter}/4 [${p.bars.map((b) => b.join(" ")).join(" | ")}]`;
      if (p.bars.length !== 2) fail(`${pl}: ${p.bars.length} bars`);
      if (isRestT(p.bars[0][0])) fail(`${pl}: starts with a rest`);
      checkPattern(pl, p, lvl, c);
    });
  };
  named.forEach(([c, ok]) => checkChoice(c, `custom ${c.values.join(",")} in ${c.meters.join(",") || "no"} meter`, ok));
  for (let n = 0; n < 3000; n++) {
    const values = KEYS.filter(() => rnd() < (n % 3 === 0 ? 0.15 : 0.35));
    const meters = [2, 3, 4].filter(() => rnd() < 0.5);
    if (!meters.length && n % 10) meters.push(2 + Math.floor(rnd() * 3));
    checkChoice({ values, meters }, `custom ${values.join(",") || "(none)"} in ${meters.join(",") || "no"}/4`);
  }
  console.log(`  custom: ${playable} playable choices (8 patterns each checked), ${blocked} impossible ones blocked`);
  if (playable < 500 || blocked < 300) fail(`too few of one kind: ${playable} playable, ${blocked} blocked`);
}

// Pads in advance: only in Practice, and Practice only on Easy.
if (padsAhead("easy", false) || !padsAhead("easy", true) || padsAhead("medium", true) || padsAhead("hard", true)) fail("pads shown in advance outside Easy Practice");

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
console.log(`✓ ${patternsChecked} two-bar patterns × 3 tempos and 900 generated rounds: bars add up, beaming is right, pads match the note lengths exactly, taps and splashes are judged right; custom choices fill bars with only the chosen values, impossible ones are blocked.`);

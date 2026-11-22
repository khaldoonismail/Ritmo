// Automated check for the piano sound every game uses (lib/playNote.ts with
// the recorded samples in lib/pianoSamples.ts).
//
//   npm run check:piano-sound
//
// Checked against facts written out here (A4 = 440 Hz, equal temperament,
// sample file names read as note names), not taken from the game's code:
//   * the 22 sample files are there (A1, C2, D♯2 … C7, one every 3
//     semitones) and small;
//   * every note the games can play (MIDI 32–97) is at most 1.5 semitones
//     from its recording;
//   * with the samples loaded, every way a game plays a note (Note
//     Reading's playNote, Up or Down's playPianoMidi, Piano Hop's playKey,
//     Happy or Sad's schedulePianoTone) plays a recording;
//   * before the samples load, and when they fail to load, the same calls
//     fall back to the synthesized tone at the exact frequency;
//   * pitch exactness is measured, not assumed: each recording is decoded
//     (needs ffmpeg) and its real pitch measured; a played sample's pitch
//     is that measured pitch × the playback rate the game sets, and must
//     be within 1 cent of the note (a real piano is stretch tuned, so the
//     game corrects each recording). Without ffmpeg this is only checked
//     against the file names (±25 cents), with a warning.
// Exits with code 1 and lists failures if anything is wrong.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "public/sounds/piano/v1");

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 40) console.error("✗ " + msg);
};

// --- independent reference facts ----------------------------------------------
const hzOf = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// "Ds4" → D♯4 → 63
function midiOfFile(name: string): number {
  const m = /^([A-G])(s?)(\d)$/.exec(name);
  if (!m) throw new Error(`bad sample name ${name}`);
  return 12 * (Number(m[3]) + 1) + LETTER[m[1]] + (m[2] ? 1 : 0);
}
const EXPECTED_FILES = ["A1", ...[2, 3, 4, 5, 6].flatMap((o) => ["C", "Ds", "Fs", "A"].map((n) => n + o)), "C7"];
const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

// --- a stand-in for the browser's audio ------------------------------------------
type Played = { kind: "synth"; hz: number } | { kind: "sample"; file: string; rate: number };
let played: Played[] = [];
class FakeParam {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
  setTargetAtTime() {
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}
class FakeNode {
  connect() {}
  disconnect() {}
}
class FakeOscillator extends FakeNode {
  type = "sine";
  frequency = new FakeParam();
  onended: (() => void) | null = null;
  start() {
    // Only the first oscillator of a note is its fundamental.
    played.push({ kind: "synth", hz: this.frequency.value });
  }
  stop() {}
}
type FakeBuffer = { file: string; duration: number };
class FakeBufferSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  playbackRate = new FakeParam();
  onended: (() => void) | null = null;
  start() {
    if (!this.buffer) throw new Error("buffer source started without a buffer");
    played.push({ kind: "sample", file: this.buffer.file, rate: this.playbackRate.value });
  }
  stop() {}
}
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = new FakeNode();
  resume() {
    return Promise.resolve();
  }
  addEventListener() {}
  createGain() {
    return Object.assign(new FakeNode(), { gain: new FakeParam() });
  }
  createOscillator() {
    return new FakeOscillator();
  }
  createBufferSource() {
    return new FakeBufferSource();
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { type: "lowpass", frequency: new FakeParam() });
  }
}
// "Decodes" the fake bytes: the file name travels inside them.
class FakeOfflineAudioContext {
  decodeAudioData(bytes: ArrayBuffer, ok: (b: FakeBuffer) => void, bad: (e: unknown) => void) {
    const file = new TextDecoder().decode(bytes);
    if (file === "garbage") bad(new Error("cannot decode"));
    else ok({ file, duration: 4 });
  }
}
let fetchMode: "ok" | "404" | "garbage" = "ok";
const g = globalThis as unknown as Record<string, unknown>;
g.window = Object.assign(globalThis, {
  AudioContext: FakeAudioContext,
  OfflineAudioContext: FakeOfflineAudioContext,
  addEventListener() {},
  setTimeout,
  clearTimeout,
});
g.document = { addEventListener() {}, hidden: false };
g.fetch = async (url: string) => {
  const file = path.basename(url, ".mp3");
  if (!url.startsWith("/sounds/piano/v1/")) throw new Error(`unexpected fetch ${url}`);
  if (fetchMode === "404") return { ok: false, arrayBuffer: async () => new ArrayBuffer(0) };
  const bytes = new TextEncoder().encode(fetchMode === "garbage" ? "garbage" : file).buffer;
  return { ok: true, arrayBuffer: async () => bytes };
};
const settle = () => new Promise((r) => setImmediate(r));

// --- measuring a recording's pitch -------------------------------------------------
// Decodes 1 s of the file (from 0.15 s, after the hammer) to mono floats.
function decodeFile(file: string): Float32Array | null {
  try {
    const out = execFileSync(
      "ffmpeg",
      ["-v", "error", "-i", file, "-ss", "0.15", "-t", "1.0", "-ac", "1", "-ar", "44100", "-f", "f32le", "-"],
      { maxBuffer: 1 << 24 }
    );
    return new Float32Array(out.buffer, out.byteOffset, out.byteLength / 4);
  } catch {
    return null;
  }
}
// Energy at frequency f (Goertzel, Hann window).
function power(x: Float32Array, f: number, rate = 44100): number {
  const w = (2 * Math.PI * f) / rate;
  const k = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  const n = x.length;
  for (let i = 0; i < n; i++) {
    const s = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))) + k * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  return s1 * s1 + s2 * s2 - k * s1 * s2;
}
// The pitch, searched ±60 cents around `expected` in 0.5-cent steps:
// the fundamental's strongest frequency, or (low notes, whose fundamental
// is weak) the 2nd partial's, halved. Piano partials run slightly sharp,
// which only the 2nd-partial reading feels (by a few cents).
function measure(x: Float32Array, expected: number): number {
  let best = expected;
  let bestScore = -1;
  const partial = expected < 120 ? 2 : 1;
  for (let c = -60; c <= 60; c += 0.5) {
    const f = expected * 2 ** (c / 1200);
    const p = power(x, f * partial);
    if (p > bestScore) {
      bestScore = p;
      best = f;
    }
  }
  return best;
}

async function main() {
  // Loaded with require, like components/ loads lib/ (lib/ is an ES module
  // package): one copy of the audio engine for the whole check.
  const S = require("@/lib/pianoSamples") as typeof import("@/lib/pianoSamples");
  const N = require("@/lib/playNote") as typeof import("@/lib/playNote");
  const { playKey } = require("@/components/pianoHop/sound") as typeof import("@/components/pianoHop/sound");

  // Files.
  if (JSON.stringify(S.SAMPLE_MIDIS.map(S.sampleName)) !== JSON.stringify(EXPECTED_FILES)) {
    fail(`sample list ${S.SAMPLE_MIDIS.map(S.sampleName).join(",")} ≠ ${EXPECTED_FILES.join(",")}`);
  }
  for (const name of EXPECTED_FILES) {
    const file = path.join(DIR, `${name}.mp3`);
    if (!existsSync(file)) fail(`missing ${file}`);
    else if (statSync(file).size > 60_000) fail(`${name}.mp3 is ${statSync(file).size} bytes (keep under 60 KB)`);
    if (S.SAMPLE_MIDIS.map(S.sampleUrl).indexOf(`/sounds/piano/v1/${name}.mp3`) < 0) fail(`${name}.mp3 not used`);
  }
  const extra = readdirSync(DIR).filter((f) => !EXPECTED_FILES.includes(path.basename(f, ".mp3")));
  if (extra.length) fail(`unexpected files in ${DIR}: ${extra.join(", ")}`);
  if (!existsSync(path.join(ROOT, "public/sounds/piano/CREDITS.md"))) fail("public/sounds/piano/CREDITS.md missing");

  // Every note the games play: Note Reading spans A♭1 (32) to about F♯6;
  // Happy or Sad 35–86; Up or Down 55–81; Piano Hop 60–84.
  const MIDIS = Array.from({ length: 97 - 32 + 1 }, (_, i) => 32 + i);
  for (const m of MIDIS) {
    const { sampleMidi } = S.nearestSample(m);
    if (Math.abs(m - sampleMidi) > 1.5) fail(`MIDI ${m} plays sample ${sampleMidi}, ${m - sampleMidi} semitones away`);
  }

  // The recordings' real pitch (Hz), measured from the files.
  const measuredHz = new Map<string, number>();
  for (const name of EXPECTED_FILES) {
    const x = decodeFile(path.join(DIR, `${name}.mp3`));
    if (!x) break;
    const f0 = hzOf(midiOfFile(name));
    const hz = measure(x, f0);
    const c = cents(hz, f0);
    if (process.env.VERBOSE) console.log(`  ${name}.mp3 is ${c.toFixed(1)} cents from ${f0.toFixed(2)} Hz`);
    if (Math.abs(c) > 30) fail(`${name}.mp3 is ${c.toFixed(1)} cents off ${f0.toFixed(2)} Hz: wrong file?`);
    measuredHz.set(name, hz);
  }
  const haveMeasure = measuredHz.size === EXPECTED_FILES.length;
  // The measurer itself: a low and a middle recording, shifted by a known
  // +20 cents, must read 20 cents higher.
  if (haveMeasure) {
    const tmp = mkdtempSync(path.join(tmpdir(), "ritmo-pitch-"));
    try {
      for (const name of ["C2", "A4"]) {
        const out = path.join(tmp, `${name}.wav`);
        const rate = 44100 * 2 ** (20 / 1200);
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(DIR, `${name}.mp3`), "-af", `asetrate=${rate},aresample=44100`, out]);
        const x = decodeFile(out);
        const shift = x ? cents(measure(x, hzOf(midiOfFile(name))), measuredHz.get(name)!) : NaN;
        if (!(Math.abs(shift - 20) <= 1)) fail(`pitch measurer read a +20 cent shift of ${name} as ${shift.toFixed(1)}`);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  if (!haveMeasure) console.warn("! ffmpeg not found: recordings not measured; sample pitches checked against their note names (±25 cents).");
  else console.log(`✓ ${measuredHz.size} recordings measured (a real piano's stretch tuning: up to ${Math.max(...EXPECTED_FILES.map((n) => Math.abs(cents(measuredHz.get(n)!, hzOf(midiOfFile(n)))))).toFixed(1)} cents off).`);
  // A played sample's pitch: the recording's measured pitch × playback rate.
  const SAMPLE_TOLERANCE = haveMeasure ? 1 : 25;

  // Note Reading's written notes, every spelling.
  const STEPS = ["C", "D", "E", "F", "G", "A", "B"] as const;
  const written: { step: (typeof STEPS)[number]; octave: number; accidental: "sharp" | "flat" | null; midi: number }[] = [];
  for (let octave = 1; octave <= 6; octave++)
    for (const step of STEPS)
      for (const accidental of [null, "sharp", "flat"] as const) {
        const midi = 12 * (octave + 1) + LETTER[step] + (accidental === "sharp" ? 1 : accidental === "flat" ? -1 : 0);
        if (midi >= 32 && midi <= 97) written.push({ step, octave, accidental, midi });
      }

  const ctx = new FakeAudioContext() as unknown as AudioContext;
  type Way = [string, (midi: number) => void, number];
  const ways = (): Way[] => [
    ["playPianoMidi", (m) => N.playPianoMidi(m), 0],
    ["playKey", (m) => playKey(m), 0],
    ["schedulePianoTone", (m) => N.schedulePianoTone(ctx, ctx.destination, m, 1, 0.5, 0.55, 2), 0],
  ];
  const run = (label: string, expect: "synth" | "sample") => {
    let count = 0;
    const check = (what: string, midi: number) => {
      const first = played[0];
      if (!first) return fail(`${label}: ${what} MIDI ${midi} played nothing`);
      if (first.kind !== expect) return fail(`${label}: ${what} MIDI ${midi} played the ${first.kind}, expected the ${expect}`);
      if (expect === "sample" && played.some((p) => p.kind === "synth")) fail(`${label}: ${what} MIDI ${midi} also started the synth`);
      const hz =
        first.kind === "synth" ? first.hz : (measuredHz.get(first.file) ?? hzOf(midiOfFile(first.file))) * first.rate;
      const tolerance = first.kind === "synth" ? 0.01 : SAMPLE_TOLERANCE;
      if (Math.abs(cents(hz, hzOf(midi))) > tolerance) fail(`${label}: ${what} MIDI ${midi} plays ${hz.toFixed(3)} Hz, expected ${hzOf(midi).toFixed(3)}`);
      count++;
    };
    for (const [name, play] of ways())
      for (const m of MIDIS) {
        played = [];
        play(m);
        check(name, m);
      }
    for (const n of written) {
      played = [];
      N.playNote(n);
      check(`playNote ${n.step}${n.accidental === "sharp" ? "♯" : n.accidental === "flat" ? "♭" : ""}${n.octave}`, n.midi);
    }
    return count;
  };

  // Before any loading: the synth.
  S.resetPianoSamplesForTest();
  const before = run("not loaded", "synth");

  // Files missing (404) or broken: still the synth, never silent.
  for (const mode of ["404", "garbage"] as const) {
    S.resetPianoSamplesForTest();
    fetchMode = mode;
    S.preloadPianoSamples();
    for (let i = 0; i < 5; i++) await settle();
    if (S.pianoSamplesReady() !== 0) fail(`${mode}: ${S.pianoSamplesReady()} samples reported ready`);
    run(`load ${mode}`, "synth");
  }

  // Loaded: the recordings.
  S.resetPianoSamplesForTest();
  fetchMode = "ok";
  S.preloadPianoSamples();
  S.preloadPianoSamples(); // a second page asking again loads nothing new
  for (let i = 0; i < 5; i++) await settle();
  if (S.pianoSamplesReady() !== EXPECTED_FILES.length) fail(`only ${S.pianoSamplesReady()} of ${EXPECTED_FILES.length} samples ready`);
  const after = run("loaded", "sample");
  console.log(
    `✓ ${before} note plays checked on the synth fallback (exact) and ${after} on the samples (within ${SAMPLE_TOLERANCE} cent${SAMPLE_TOLERANCE === 1 ? "" : "s"}).`
  );

  if (failures) {
    console.error(`\n${failures} problem(s) found.`);
    process.exit(1);
  }
  console.log("Every game note plays the exact right pitch, on the recorded piano or the fallback tone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

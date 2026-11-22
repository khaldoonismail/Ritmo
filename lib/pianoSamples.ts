// Recorded piano samples for every note the games play (Salamander Grand
// Piano by Alexander Holm, CC BY 3.0; see public/sounds/piano/CREDITS.md).
//
// There is one recording every 3 semitones, A1 to C7 (22 short mono MP3s,
// about 32 KB each). Any other note plays the nearest recording, sped up
// or slowed down by at most 1.5 semitones, which keeps the pitch exact
// (playbackRate = 2^(semitones / 12), corrected for each recording's own
// tuning, see SAMPLE_TUNING_CENTS) and still sounds natural.
//
// The files only load on pages that call preloadPianoSamples() (the game
// pages), once per visit: the bytes stay in memory across client-side
// navigation and the browser caches the files for a year (next.config.mjs;
// the "v1" folder changes if the files ever do). Until a note's recording
// has loaded, or if loading fails, lib/playNote.ts plays its synthesized
// tone instead, so a note is never silent.
//
// Decoding uses an OfflineAudioContext, so loading never creates or wakes
// the shared AudioContext before a tap (the iPhone needs that tap). An
// AudioBuffer can be played on any context, so the buffers also survive
// the shared context being replaced after an iOS interruption.

export const PIANO_SAMPLE_DIR = "/sounds/piano/v1";

// File names, low to high: C, D♯, F♯ and A of each octave.
const NAMES = ["C", "Ds", "Fs", "A"] as const;
const NAME_SEMITONES: Record<(typeof NAMES)[number], number> = { C: 0, Ds: 3, Fs: 6, A: 9 };
export const LOWEST_SAMPLE_MIDI = 33; // A1
export const HIGHEST_SAMPLE_MIDI = 96; // C7

export function sampleName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const name = NAMES.find((n) => NAME_SEMITONES[n] === pc);
  if (!name) throw new Error(`no sample at MIDI ${midi}`);
  return `${name}${Math.floor(midi / 12) - 1}`;
}

export const SAMPLE_MIDIS: number[] = [];
for (let m = LOWEST_SAMPLE_MIDI; m <= HIGHEST_SAMPLE_MIDI; m += 3) SAMPLE_MIDIS.push(m);

export function sampleUrl(sampleMidi: number): string {
  return `${PIANO_SAMPLE_DIR}/${sampleName(sampleMidi)}.mp3`;
}

// How far each recording is from its exact note, in cents (measured by
// scripts/check-piano-sound.ts). A real piano is "stretch" tuned, its
// bass a little flat and its treble a little sharp; the games want exact
// equal-temperament pitch (A4 = 440 Hz), so playback corrects it.
export const SAMPLE_TUNING_CENTS: Record<string, number> = {
  A1: -7.5, C2: -10, Ds2: -6, Fs2: -5,
  A2: 1.5, C3: -7.5, Ds3: -2, Fs3: -6,
  A3: 1, C4: -1.5, Ds4: 1, Fs4: -3,
  A4: 0.5, C5: 5, Ds5: 3.5, Fs5: 4.5,
  A5: 7, C6: 8.5, Ds6: 6.5, Fs6: 12.5,
  A6: 14.5, C7: 23.5,
};

// The recording that plays `midi`, and how much to speed it up: the
// semitones from its note, less its own tuning error.
export function nearestSample(midi: number): { sampleMidi: number; rate: number } {
  const clamped = Math.min(HIGHEST_SAMPLE_MIDI, Math.max(LOWEST_SAMPLE_MIDI, midi));
  const sampleMidi = LOWEST_SAMPLE_MIDI + Math.round((clamped - LOWEST_SAMPLE_MIDI) / 3) * 3;
  const cents = 100 * (midi - sampleMidi) - (SAMPLE_TUNING_CENTS[sampleName(sampleMidi)] ?? 0);
  return { sampleMidi, rate: Math.pow(2, cents / 1200) };
}

type Entry = { bytes: Promise<ArrayBuffer | null>; buffer: AudioBuffer | null; decoding: boolean; failed: boolean };
const entries = new Map<number, Entry>();
let decoder: BaseAudioContext | null = null;

function getDecoder(): BaseAudioContext | null {
  if (decoder) return decoder;
  const w = window as unknown as {
    OfflineAudioContext?: typeof OfflineAudioContext;
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  };
  const Ctor = w.OfflineAudioContext || w.webkitOfflineAudioContext;
  if (!Ctor) return null;
  try {
    decoder = new Ctor(1, 1, 44100);
  } catch {
    decoder = null;
  }
  return decoder;
}

// Callback form: older Safari has no promise-returning decodeAudioData.
function decode(c: BaseAudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    try {
      const p = c.decodeAudioData(bytes, resolve, reject) as Promise<AudioBuffer> | undefined;
      p?.catch?.(reject);
    } catch (e) {
      reject(e);
    }
  });
}

function load(sampleMidi: number): Entry {
  let e = entries.get(sampleMidi);
  if (e) return e;
  const bytes = fetch(sampleUrl(sampleMidi))
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
  e = { bytes, buffer: null, decoding: true, failed: false };
  entries.set(sampleMidi, e);
  const entry = e;
  bytes
    .then((b) => {
      const c = getDecoder();
      if (!b || !c) throw new Error("no sample");
      return decode(c, b);
    })
    .then((buffer) => {
      entry.buffer = buffer;
    })
    .catch(() => {
      entry.failed = true;
    })
    .finally(() => {
      entry.decoding = false;
    });
  return entry;
}

// Starts loading every recording (call when a game page opens).
export function preloadPianoSamples(): void {
  if (typeof window === "undefined" || typeof fetch === "undefined") return;
  for (const m of SAMPLE_MIDIS) load(m);
}

// The loaded recording for `midi` and its playback rate, or null (still
// loading, failed, or never preloaded: the caller plays the synth tone).
export function pianoSampleFor(midi: number): { buffer: AudioBuffer; rate: number; sampleMidi: number } | null {
  const { sampleMidi, rate } = nearestSample(midi);
  const e = entries.get(sampleMidi);
  if (!e?.buffer) return null;
  return { buffer: e.buffer, rate, sampleMidi };
}

// How many recordings are ready (for ?debug and the checks).
export function pianoSamplesReady(): number {
  let n = 0;
  for (const e of entries.values()) if (e.buffer) n++;
  return n;
}

// For the automated checks only: forget everything loaded.
export function resetPianoSamplesForTest(): void {
  entries.clear();
  decoder = null;
}

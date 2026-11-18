import { noteFrequency, type NoteSpec } from "@/lib/noteReading";

// Plays a Note Reading answer out loud with Web Audio: a short, soft
// piano-like tone (a triangle wave plus a quieter octave partial, with a
// fast attack and a ~1.6s fade). No audio files needed.
//
// Browsers only let a page make sound after a tap/click, so players call
// unlockNoteAudio() from a click handler (answering, "Start", "Show
// answer"...) and the reveal can then play on its own.

let ctx: AudioContext | null = null;

// Shared with the Note Runner background music (components/noteRunner/music.ts)
// so one tap unlocks both.
export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function unlockNoteAudio(): void {
  const c = getAudioContext();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

export function playNote(note: Pick<NoteSpec, "step" | "octave" | "accidental">): void {
  const c = getAudioContext();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});

  const freq = noteFrequency(note);
  const now = c.currentTime + 0.02;
  const duration = 1.6;

  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.35, now + 0.015);
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  master.connect(c.destination);

  const partials: [OscillatorType, number, number][] = [
    ["triangle", 1, 1],
    ["sine", 2, 0.25],
  ];
  for (const [type, multiple, level] of partials) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * multiple, now);
    gain.gain.setValueAtTime(level, now);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }
}

// A clearer, piano-like tone for ear training (Up or Down): a sine
// fundamental with a few quieter overtones that fade faster than it, a
// quick "hammer" attack, and a firm release after `seconds`, so one note
// has stopped before the next starts. `delay` is seconds from now.
// Returns false if the browser has no Web Audio.
export function playPianoMidi(midi: number, delay = 0, seconds = 0.85): boolean {
  const c = getAudioContext();
  if (!c) return false;
  if (c.state === "suspended") c.resume().catch(() => {});
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const start = c.currentTime + 0.02 + delay;
  const end = start + seconds;

  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, start);
  out.gain.exponentialRampToValueAtTime(0.42, start + 0.006);
  out.gain.setValueAtTime(0.42, end - 0.12);
  out.gain.exponentialRampToValueAtTime(0.0001, end);
  out.connect(c.destination);

  // [overtone, level, how long it takes to fade to a tenth]
  const partials: [number, number, number][] = [
    [1, 1, 1.4],
    [2, 0.45, 0.6],
    [3, 0.2, 0.35],
    [4, 0.09, 0.22],
  ];
  for (const [multiple, level, fade] of partials) {
    if (freq * multiple > 9000) continue;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * multiple, start);
    g.gain.setValueAtTime(level, start);
    g.gain.setTargetAtTime(level * 0.1, start + 0.01, fade / 2.3);
    osc.connect(g);
    g.connect(out);
    osc.start(start);
    osc.stop(end + 0.02);
    osc.onended = () => g.disconnect();
  }
  window.setTimeout(() => out.disconnect(), (end - c.currentTime + 0.2) * 1000);
  return true;
}

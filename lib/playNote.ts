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

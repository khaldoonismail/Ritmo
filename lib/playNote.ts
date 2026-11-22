import { noteFrequency, type NoteSpec } from "@/lib/noteReading";

// Plays a Note Reading answer out loud with Web Audio: a short, soft
// piano-like tone (a triangle wave plus a quieter octave partial, with a
// fast attack and a ~1.6s fade). No audio files needed.
//
// Browsers only let a page make sound after a tap/click, so players call
// unlockNoteAudio() from a click handler (answering, "Start", "Show
// answer"...) and the reveal can then play on its own.

let ctx: AudioContext | null = null;

// iPhone / iPad: ask for the "playback" audio session (Safari 17+), so the
// game sounds play even with the silent switch on, like a music app.
// Other browsers don't have navigator.audioSession and skip this.
function requestPlaybackSession(): void {
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== "playback") session.type = "playback";
  } catch {
    // not supported
  }
}

function createContext(): AudioContext | null {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  requestPlaybackSession();
  try {
    const c = new Ctor();
    // iOS moves the context to "interrupted" (a call, Siri, an alarm,
    // another app's audio) or "suspended" (locked screen). Try to come
    // back on our own when the page is visible; if iOS still wants a tap,
    // the next touch does it (see installUnlock).
    c.addEventListener("statechange", () => {
      if (c === ctx && c.state !== "running" && c.state !== "closed" && !document.hidden) {
        c.resume().catch(() => {});
      }
    });
    return c;
  } catch {
    return null;
  }
}

// Shared with the Note Runner background music (components/noteRunner/music.ts)
// so one tap unlocks both.
export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx || ctx.state === "closed") ctx = createContext();
  installUnlock();
  return ctx;
}

export function unlockNoteAudio(): void {
  requestPlaybackSession();
  const c = getAudioContext();
  if (!c || c.state === "running") return;
  c.resume().catch(() => {});
  // Rarely, iOS leaves a context "interrupted" for good after a call. If a
  // tap can't bring it back, start a fresh one (the old one is dead anyway).
  const stuck = c;
  window.setTimeout(() => {
    if (stuck === ctx && (stuck.state as string) === "interrupted" && !document.hidden) {
      stuck.close().catch(() => {});
      ctx = createContext();
      ctx?.resume().catch(() => {});
    }
  }, 600);
}

// Every touch, click or key (not just the first) resumes the sound, so it
// also comes back after iOS interrupted it. Listeners are on window in the
// capture phase, so they run even where a game stops the event.
let unlockInstalled = false;
function installUnlock(): void {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const onGesture = () => {
    if (!ctx || ctx.state !== "running") unlockNoteAudio();
  };
  for (const type of ["pointerdown", "touchend", "click", "keydown"]) {
    window.addEventListener(type, onGesture, { capture: true, passive: true });
  }
  // Coming back to the app: iOS often needs a nudge.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && ctx && ctx.state !== "running") ctx.resume().catch(() => {});
  });
}

// Start listening for the first touch as soon as a page with sound loads,
// so even a tap before any sound was asked for unlocks it.
if (typeof window !== "undefined") installUnlock();

export function playNote(note: Pick<NoteSpec, "step" | "octave" | "accidental">): void {
  const c = getAudioContext();
  if (!c) return;
  if (c.state !== "running") c.resume().catch(() => {});

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
  if (c.state !== "running") c.resume().catch(() => {});
  schedulePianoTone(c, c.destination, midi, c.currentTime + 0.02 + delay, seconds);
  return true;
}

// The same piano tone, scheduled at an exact context time on any output
// node (Happy or Sad plays whole pieces through one gain it can stop).
// `gain` scales the loudness (1 = Up or Down's level); `partials` 2 is a
// lighter tone for accompaniment on slow devices.
export function schedulePianoTone(
  c: AudioContext,
  dest: AudioNode,
  midi: number,
  start: number,
  seconds: number,
  gain = 1,
  partials = 4
): void {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const end = start + Math.max(0.15, seconds);
  const peak = 0.42 * gain;

  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, start);
  out.gain.exponentialRampToValueAtTime(peak, start + 0.006);
  out.gain.setValueAtTime(peak, Math.max(start + 0.01, end - 0.12));
  out.gain.exponentialRampToValueAtTime(0.0001, end);
  out.connect(dest);

  // [overtone, level, how long it takes to fade to a tenth]
  const all: [number, number, number][] = [
    [1, 1, 1.4],
    [2, 0.45, 0.6],
    [3, 0.2, 0.35],
    [4, 0.09, 0.22],
  ];
  for (const [multiple, level, fade] of all.slice(0, partials)) {
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
}

// Short, quiet feedback sounds (about 0.2 s), so they never cover the
// next notes. Each is ONE steady pitch with no slide, so in an
// ear-training game it can't hint "up" or "down":
//   correct  a soft, bright "ding"
//   wrong    a soft, low "bump"
export function playFeedback(kind: "correct" | "wrong"): void {
  const c = getAudioContext();
  if (!c) return;
  if (c.state !== "running") c.resume().catch(() => {});
  const start = c.currentTime + 0.01;
  const correct = kind === "correct";
  const length = correct ? 0.22 : 0.18;
  const peak = correct ? 0.09 : 0.12;

  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, start);
  out.gain.exponentialRampToValueAtTime(peak, start + 0.006);
  out.gain.exponentialRampToValueAtTime(0.0001, start + length);
  // Rounds the "bump" off so it is a soft thud, not a buzz.
  const soften = c.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.setValueAtTime(correct ? 6000 : 700, start);
  soften.connect(out);
  out.connect(c.destination);

  const partials: [OscillatorType, number, number][] = correct
    ? [["sine", 1318.5, 1], ["sine", 2637, 0.25]]
    : [["triangle", 155.6, 1]];
  for (const [type, freq, level] of partials) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(level, start);
    osc.connect(g);
    g.connect(soften);
    osc.start(start);
    osc.stop(start + length + 0.02);
    osc.onended = () => g.disconnect();
  }
  window.setTimeout(() => out.disconnect(), (length + 0.3) * 1000);
}

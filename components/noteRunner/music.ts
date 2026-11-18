import { getAudioContext } from "@/lib/playNote";

// Soft background music for Note Runner, made in code with Web Audio (no
// audio files). A calm 8-bar tune in C major (C – Am – F – G) at 84 BPM:
// a music-box melody, a gentle arpeggio and a soft bass. The melody plays
// every other time round so the loop stays calm.
//
// Kept light for old tablets: one oscillator per note, a few notes per
// beat, scheduled ~0.4 s ahead from a 150 ms timer (no per-frame work).
// It shares the note sounds' AudioContext, so the tap that unlocks the
// note sounds unlocks the music too.

const BPM = 84;
const STEP = 60 / BPM / 2; // one eighth note, in seconds
const STEPS_PER_BAR = 8;
const BARS = 8;
const LOOP_STEPS = STEPS_PER_BAR * BARS;
const LOOKAHEAD = 0.4;
const TICK_MS = 150;

// Overall loudness: quiet next to the answer note (which peaks at 0.35).
const MUSIC_VOLUME = 0.09;
// While an answer note sounds, the music drops to this share.
const DUCK_LEVEL = 0.2;

type Voice = "melody" | "arp" | "bass";
// [bar, step in bar, length in steps, MIDI note]
type Note = [number, number, number, number];

const MELODY: Note[] = [
  // C
  [0, 0, 2, 76], [0, 2, 2, 79], [0, 4, 2, 76], [0, 6, 2, 72],
  // Am
  [1, 0, 2, 72], [1, 2, 2, 76], [1, 4, 4, 81],
  // F
  [2, 0, 2, 81], [2, 2, 2, 79], [2, 4, 2, 77], [2, 6, 2, 81],
  // G
  [3, 0, 6, 79],
  // C
  [4, 0, 2, 76], [4, 2, 2, 79], [4, 4, 2, 84], [4, 6, 2, 79],
  // Am
  [5, 0, 2, 81], [5, 2, 2, 79], [5, 4, 4, 76],
  // F → G
  [6, 0, 2, 77], [6, 2, 2, 81], [6, 4, 2, 79], [6, 6, 2, 74],
  // C
  [7, 0, 8, 72],
];

// Chord per half bar: arpeggio tones (quarter notes) and bass root/fifth.
const C = { arp: [60, 64, 67, 64], bass: [48, 55] };
const AM = { arp: [57, 60, 64, 60], bass: [45, 52] };
const F = { arp: [53, 57, 60, 57], bass: [41, 48] };
const G = { arp: [55, 59, 62, 59], bass: [43, 50] };
const HALF_BARS = [C, C, AM, AM, F, F, G, G, C, C, AM, AM, F, G, C, C];

function buildLoop(): { step: number; length: number; midi: number; voice: Voice }[] {
  const events: { step: number; length: number; midi: number; voice: Voice }[] = [];
  HALF_BARS.forEach((chord, h) => {
    const base = h * 4;
    // Two arpeggio quarter notes per half bar.
    const offset = (h % 2) * 2;
    events.push({ step: base, length: 3, midi: chord.arp[offset], voice: "arp" });
    events.push({ step: base + 2, length: 3, midi: chord.arp[offset + 1], voice: "arp" });
    events.push({ step: base, length: 4, midi: chord.bass[h % 2], voice: "bass" });
  });
  for (const [bar, s, length, midi] of MELODY) {
    events.push({ step: bar * STEPS_PER_BAR + s, length, midi, voice: "melody" });
  }
  return events;
}

const LOOP = buildLoop();
// Events grouped by step, so each tick only looks at the steps it plays.
const BY_STEP: (typeof LOOP)[] = Array.from({ length: LOOP_STEPS }, (_, i) => LOOP.filter((e) => e.step === i));

const VOICES: Record<Voice, { type: OscillatorType; level: number; release: number }> = {
  melody: { type: "triangle", level: 0.55, release: 0.5 },
  arp: { type: "sine", level: 0.3, release: 0.35 },
  bass: { type: "sine", level: 0.45, release: 0.3 },
};

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class RunnerMusic {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null; // on/off and pause fades
  private duckGain: GainNode | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private loopCount = 0;
  private live = new Set<OscillatorNode>();

  private setup(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const ctx = getAudioContext();
    if (!ctx) return null;
    try {
      const out = ctx.createGain();
      out.gain.setValueAtTime(0, ctx.currentTime);
      const duck = ctx.createGain();
      duck.gain.setValueAtTime(1, ctx.currentTime);
      // Rounds off the triangle wave so it stays soft.
      const soften = ctx.createBiquadFilter();
      soften.type = "lowpass";
      soften.frequency.setValueAtTime(2200, ctx.currentTime);
      soften.connect(duck);
      duck.connect(out);
      out.connect(ctx.destination);
      this.ctx = ctx;
      this.out = out;
      this.duckGain = duck;
      this.input = soften;
    } catch {
      return null;
    }
    return this.ctx;
  }

  private input: AudioNode | null = null;

  get playing(): boolean {
    return this.timer !== null;
  }

  // Starts (or continues after pause) the loop. Call from a tap, or after
  // one: browsers only allow sound once the page has been tapped.
  play(): void {
    const ctx = this.setup();
    if (!ctx || !this.out || this.timer !== null) return;
    if (ctx.state !== "running") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(MUSIC_VOLUME, now + 0.6);
    this.nextTime = now + 0.08;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  // Fades out and holds the place in the tune.
  pause(): void {
    this.halt(0.15);
  }

  // Fades out and goes back to the start of the tune.
  stop(): void {
    this.halt(0.6);
    this.step = 0;
    this.loopCount = 0;
  }

  // Drops the music for a moment so the answer note is heard clearly.
  duck(seconds = 1.1): void {
    const ctx = this.ctx;
    const g = this.duckGain?.gain;
    if (!ctx || !g) return;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(DUCK_LEVEL, now + 0.05);
    g.setValueAtTime(DUCK_LEVEL, now + seconds);
    g.linearRampToValueAtTime(1, now + seconds + 0.7);
  }

  dispose(): void {
    this.halt(0.05);
    const out = this.out;
    window.setTimeout(() => out?.disconnect(), 200);
    this.ctx = null;
    this.out = null;
    this.duckGain = null;
    this.input = null;
  }

  private halt(fade: number): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    const now = ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + fade);
    // Notes already scheduled ahead must not sound after the fade.
    for (const osc of this.live) {
      try {
        osc.stop(now + fade + 0.02);
      } catch {
        // already stopped
      }
    }
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    // After the tab was throttled, jump forward instead of playing catch-up.
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      const withMelody = this.loopCount % 2 === 0;
      for (const e of BY_STEP[this.step]) {
        if (e.voice === "melody" && !withMelody) continue;
        this.note(this.nextTime, e.length * STEP, e.midi, e.voice);
      }
      this.nextTime += STEP;
      this.step++;
      if (this.step >= LOOP_STEPS) {
        this.step = 0;
        this.loopCount++;
      }
    }
  }

  private note(at: number, length: number, midi: number, voice: Voice): void {
    const ctx = this.ctx;
    if (!ctx || !this.input) return;
    const v = VOICES[voice];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = v.type;
    osc.frequency.setValueAtTime(midiToFreq(midi), at);
    const end = at + length + v.release;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(v.level, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(v.level * 0.5, at + Math.min(length, 0.4));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(this.input);
    osc.start(at);
    osc.stop(end + 0.02);
    this.live.add(osc);
    osc.onended = () => {
      this.live.delete(osc);
      gain.disconnect();
    };
  }
}

// On/off choice, remembered on this device. On unless turned off.
const STORAGE_KEY = "ritmo.noteRunner.music";

export function loadMusicOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveMusicOn(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // private mode or blocked storage: the choice lasts for this visit only
  }
}

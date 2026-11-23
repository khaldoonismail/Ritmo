import { getAudioContext, schedulePianoTone } from "@/lib/playNote";

// Rhythm Jump's sounds, all on the shared AudioContext (lib/playNote.ts:
// iPhone silent-switch fix, recovery after interruptions).
//
// The beat is scheduled ahead on the audio clock (ctx.currentTime), never
// with timers, so it is rock steady even when the page is busy: a pattern's
// whole count-in, metronome and (Listen & Echo) rhythm are scheduled the
// moment it starts. Each pattern gets its own "bus" (a gain), so pausing
// silences everything still waiting to play at once.

export class BeatBus {
  readonly ctx: AudioContext;
  private bus: GainNode;
  private live = new Set<AudioScheduledSourceNode>();

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(ctx.destination);
  }

  private track(n: AudioScheduledSourceNode) {
    this.live.add(n);
    n.onended = () => this.live.delete(n);
  }

  // A soft woodblock "tok" on each beat; a lower, rounder drum on the first
  // beat of a bar (and for calibration).
  click(at: number, accent: boolean, loud = 1) {
    const c = this.ctx;
    const g = c.createGain();
    const peak = (accent ? 0.32 : 0.2) * loud;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + (accent ? 0.16 : 0.07));
    g.connect(this.bus);
    const o = c.createOscillator();
    o.type = "sine";
    if (accent) {
      o.frequency.setValueAtTime(190, at);
      o.frequency.exponentialRampToValueAtTime(95, at + 0.12);
    } else {
      o.frequency.setValueAtTime(1050, at);
    }
    o.connect(g);
    o.start(at);
    o.stop(at + 0.2);
    this.track(o);
    if (accent) {
      // A little "tick" on top so the drum is heard on small speakers.
      const t = c.createOscillator();
      const tg = c.createGain();
      t.frequency.setValueAtTime(1500, at);
      tg.gain.setValueAtTime(0.0001, at);
      tg.gain.exponentialRampToValueAtTime(0.12 * loud, at + 0.002);
      tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
      t.connect(tg);
      tg.connect(this.bus);
      t.start(at);
      t.stop(at + 0.06);
      this.track(t);
    }
  }

  // One note of the rhythm (Listen & Echo), on the piano.
  note(at: number, seconds: number) {
    schedulePianoTone(this.ctx, this.bus, 72, at, Math.min(0.7, Math.max(0.12, seconds * 0.85)), 0.9, 3);
  }

  // Silences everything this bus still has to play.
  cancel() {
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(this.bus.gain.value, now);
    this.bus.gain.linearRampToValueAtTime(0, now + 0.03);
    for (const n of this.live) {
      try {
        n.stop(now + 0.04);
      } catch {
        // already stopped
      }
    }
    this.live.clear();
    const bus = this.bus;
    window.setTimeout(() => bus.disconnect(), 200);
  }
}

let noise: AudioBuffer | null = null;
function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const b = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noise = b;
  return b;
}

// Instant feedback for a tap (played the moment the child taps):
//   hop    a soft water "plop" (brighter for Perfect)
//   splash a funny splash (a tap on a rest)
//   wobble a soft low "boing" (a missed note)
export function playTapSound(kind: "perfect" | "good" | "splash" | "wobble"): void {
  const c = getAudioContext();
  if (!c) return;
  if (c.state !== "running") c.resume().catch(() => {});
  const at = c.currentTime + 0.005;
  if (kind === "splash") {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(2200, at);
    f.frequency.exponentialRampToValueAtTime(500, at + 0.35);
    f.Q.value = 0.9;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
    src.connect(f);
    f.connect(g);
    g.connect(c.destination);
    src.start(at);
    src.stop(at + 0.45);
    // Plus a "bloop" falling.
    const o = c.createOscillator();
    const og = c.createGain();
    o.frequency.setValueAtTime(700, at);
    o.frequency.exponentialRampToValueAtTime(180, at + 0.25);
    og.gain.setValueAtTime(0.0001, at);
    og.gain.exponentialRampToValueAtTime(0.14, at + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    o.connect(og);
    og.connect(c.destination);
    o.start(at);
    o.stop(at + 0.3);
    return;
  }
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  if (kind === "wobble") {
    o.frequency.setValueAtTime(220, at);
    o.frequency.linearRampToValueAtTime(180, at + 0.12);
    o.frequency.linearRampToValueAtTime(210, at + 0.22);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.1, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
  } else {
    const top = kind === "perfect" ? 1400 : 1000;
    o.frequency.setValueAtTime(top * 0.45, at);
    o.frequency.exponentialRampToValueAtTime(top, at + 0.06);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.16, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
  }
  o.connect(g);
  g.connect(c.destination);
  o.start(at);
  o.stop(at + 0.32);
}

// The audio-clock time of an input event, corrected for the device's
// measured delay: what the child meant to hit. `event.timeStamp` is when
// the touch happened (before any busy frame delayed the handler).
export function tapTime(c: AudioContext, eventTimeStamp: number, delayMs: number): number {
  const sinceEvent = Math.max(0, Math.min(0.25, (performance.now() - eventTimeStamp) / 1000));
  return c.currentTime - sinceEvent - delayMs / 1000;
}

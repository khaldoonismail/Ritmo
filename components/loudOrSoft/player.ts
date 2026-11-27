import { getAudioContext, schedulePianoTone } from "@/lib/playNote";
import { LIMITER, brightnessHz, type Envelope, type Part, type Rendered } from "@/lib/loudOrSoft/music";

// Plays Sleepy Town's music on the piano (lib/playNote.ts: the shared
// AudioContext with the iPhone silent-switch fix, recorded samples with the
// synth as fallback). The chain:
//
//   notes (each struck at its level: a "velocity" gain)
//     → low-pass filter (opens as the music gets louder: louder = brighter)
//     → limiter (nothing ever gets painfully loud)
//     → output (faded out by stop())
//
// Everything is scheduled on the audio clock up front, so the town can
// follow the music exactly (dbAt(envelope, now - pieceStart)).

export interface Playing {
  // Audio-clock times: the reference phrase (or null), the piece, the end.
  referenceStart: number | null;
  pieceStart: number;
  end: number;
}

export class TownPlayer {
  private out: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private timers: number[] = [];
  private token = 0;

  // Plays the reference phrase (if `withReference`), a short silence, then
  // the piece. `onPiece` runs as the piece starts, `onEnd` after it.
  play(r: Rendered, opts: { withReference: boolean; gap: number; onPiece?: () => void; onEnd?: () => void; lead?: number }): Playing | null {
    this.stop();
    const c = getAudioContext();
    if (!c) return null;
    if (c.state !== "running") c.resume().catch(() => {});
    const t0 = c.currentTime + (opts.lead ?? 0.12);
    const parts: { part: Part; start: number }[] = [];
    let referenceStart: number | null = null;
    let pieceStart = t0;
    if (opts.withReference) {
      referenceStart = t0;
      parts.push({ part: r.reference, start: t0 });
      pieceStart = t0 + r.reference.seconds + opts.gap;
    }
    parts.push({ part: r.piece, start: pieceStart });
    const end = pieceStart + r.piece.seconds;
    this.chain(c, parts, end);
    const token = ++this.token;
    const at = (time: number, f: () => void) => {
      this.timers.push(
        window.setTimeout(() => {
          if (token === this.token) f();
        }, Math.max(0, (time - c.currentTime) * 1000))
      );
    };
    if (opts.onPiece) at(pieceStart, opts.onPiece);
    at(end + 0.25, () => {
      const o = this.out;
      this.out = null;
      if (o) window.setTimeout(() => o.disconnect(), 600);
      opts.onEnd?.();
    });
    return { referenceStart, pieceStart, end };
  }

  // The volume step: one part, over and over until stop().
  loop(part: Part, gap: number, onEach?: () => void) {
    this.stop();
    const c = getAudioContext();
    if (!c) return false;
    const token = ++this.token;
    const once = () => {
      if (token !== this.token) return;
      const start = c.currentTime + 0.12;
      this.chain(c, [{ part, start }], start + part.seconds, true);
      onEach?.();
      this.timers.push(window.setTimeout(once, (part.seconds + gap + 0.12) * 1000));
    };
    once();
    return true;
  }

  private chain(c: AudioContext, parts: { part: Part; start: number }[], end: number, keep = false) {
    if (!keep || !this.out) {
      const out = c.createGain();
      out.gain.value = 1;
      out.connect(c.destination);
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = LIMITER.thresholdDb;
      limiter.knee.value = LIMITER.kneeDb;
      limiter.ratio.value = LIMITER.ratio;
      limiter.attack.value = LIMITER.attack;
      limiter.release.value = LIMITER.release;
      limiter.connect(out);
      this.out = out;
      this.limiter = limiter;
    }
    const limiter = this.limiter!;
    for (const { part, start } of parts) {
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 0.5;
      automate(filter.frequency, part.envelope, start);
      filter.connect(limiter);
      for (const n of part.notes) schedulePianoTone(c, filter, n.midi, start + n.time, n.seconds, n.gain, n.voice === 0 ? 4 : 3);
      window.setTimeout(() => filter.disconnect(), (end - c.currentTime + 1.5) * 1000);
    }
  }

  stop() {
    this.token++;
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    const o = this.out;
    const c = getAudioContext();
    if (o && c) {
      o.gain.cancelScheduledValues(c.currentTime);
      o.gain.setValueAtTime(o.gain.value, c.currentTime);
      o.gain.linearRampToValueAtTime(0, c.currentTime + 0.06);
      window.setTimeout(() => o.disconnect(), 120);
    }
    this.out = null;
    this.limiter = null;
  }
}

// The filter follows the dynamics: steady, a smooth ramp (cresc. / dim.),
// or a near-instant jump (subito).
function automate(p: AudioParam, e: Envelope, start: number) {
  p.setValueAtTime(brightnessHz(e.from), start);
  if (e.shape === "ramp") {
    p.setValueAtTime(brightnessHz(e.from), start + e.at);
    p.exponentialRampToValueAtTime(brightnessHz(e.to), start + e.until);
  } else if (e.shape === "step") {
    p.setValueAtTime(brightnessHz(e.from), start + e.at - 0.015);
    p.linearRampToValueAtTime(brightnessHz(e.to), start + e.at + 0.005);
  }
}

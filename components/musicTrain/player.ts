import { getAudioContext, schedulePianoTone } from "@/lib/playNote";
import { VOLUME, type Rendered } from "@/lib/fastOrSlow/music";

// Plays a Music Train piece on the piano (lib/playNote.ts: the shared
// AudioContext with the iPhone silent-switch fix, recorded samples with the
// synth as fallback). Every note is scheduled on the audio clock up front;
// `play` returns that clock's time of beat 0, which the train's animation
// uses too, so the wheels, steam and trees land exactly on the beat.

export class TrainPlayer {
  private master: GainNode | null = null;
  private endTimer: number | null = null;
  private token = 0;

  // Starts `r` (stopping anything playing). `onEnd` runs after its last
  // note. Returns the audio time of beat 0, or null without Web Audio.
  play(r: Rendered, onEnd?: () => void, lead = 0.12): number | null {
    this.stop();
    const c = getAudioContext();
    if (!c) return null;
    if (c.state !== "running") c.resume().catch(() => {});
    const master = c.createGain();
    master.gain.value = VOLUME;
    master.connect(c.destination);
    this.master = master;
    const t0 = c.currentTime + lead;
    for (const n of r.notes) schedulePianoTone(c, master, n.midi, t0 + n.time, n.seconds, n.gain, n.voice === 0 ? 4 : 3);
    const token = ++this.token;
    this.endTimer = window.setTimeout(() => {
      if (token !== this.token) return;
      this.endTimer = null;
      const m = this.master;
      this.master = null;
      if (m) window.setTimeout(() => m.disconnect(), 400);
      onEnd?.();
    }, (lead + r.seconds + 0.25) * 1000);
    return t0;
  }

  stop() {
    this.token++;
    if (this.endTimer !== null) window.clearTimeout(this.endTimer);
    this.endTimer = null;
    const m = this.master;
    const c = getAudioContext();
    if (m && c) {
      m.gain.cancelScheduledValues(c.currentTime);
      m.gain.setValueAtTime(m.gain.value, c.currentTime);
      m.gain.linearRampToValueAtTime(0, c.currentTime + 0.06);
      window.setTimeout(() => m.disconnect(), 120);
    }
    this.master = null;
  }
}

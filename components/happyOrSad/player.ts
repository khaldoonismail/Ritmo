import { getAudioContext, schedulePianoTone } from "@/lib/playNote";
import { parsePiece, type Piece } from "@/lib/happyOrSad/pieces";

// Plays one Happy or Sad piece on the piano tone (lib/playNote.ts, the
// shared AudioContext with the iPhone silent-switch fix). Every note goes
// through one gain, so "Hear again", Pause and the next piece can stop it
// at once. The melody is a little louder than the accompaniment.

const ACCOMPANIMENT = 0.55;

export class PiecePlayer {
  private master: GainNode | null = null;
  private endTimer: number | null = null;
  private token = 0;

  constructor(private light = false) {}

  get playing(): boolean {
    return this.master !== null;
  }

  // Starts `piece` (stopping anything playing). `onEnd` runs when its last
  // note has faded, unless it's stopped first. Returns its length in
  // seconds, or 0 without Web Audio.
  play(piece: Piece, onEnd?: () => void): number {
    this.stop();
    const c = getAudioContext();
    if (!c) return 0;
    if (c.state !== "running") c.resume().catch(() => {});
    const parsed = parsePiece(piece);
    const spb = 60 / piece.bpm;
    const master = c.createGain();
    master.gain.value = piece.volume;
    master.connect(c.destination);
    this.master = master;
    const t0 = c.currentTime + 0.08;
    for (const n of parsed.notes) {
      const melody = n.voice === 0;
      schedulePianoTone(
        c,
        master,
        n.midi,
        t0 + n.start * spb,
        n.beats * spb * 0.96,
        melody ? 1 : ACCOMPANIMENT,
        melody ? (this.light ? 3 : 4) : this.light ? 2 : 3
      );
    }
    const token = ++this.token;
    this.endTimer = window.setTimeout(() => {
      if (token !== this.token) return;
      this.endTimer = null;
      this.release();
      onEnd?.();
    }, (parsed.seconds + 0.35) * 1000);
    return parsed.seconds;
  }

  stop() {
    this.token++;
    if (this.endTimer !== null) window.clearTimeout(this.endTimer);
    this.endTimer = null;
    const m = this.master;
    const c = getAudioContext();
    if (m && c) {
      // A very short fade so stopping never clicks.
      m.gain.cancelScheduledValues(c.currentTime);
      m.gain.setValueAtTime(m.gain.value, c.currentTime);
      m.gain.linearRampToValueAtTime(0, c.currentTime + 0.06);
      window.setTimeout(() => m.disconnect(), 120);
    }
    this.master = null;
  }

  private release() {
    const m = this.master;
    this.master = null;
    if (m) window.setTimeout(() => m.disconnect(), 300);
  }
}

import { playPianoMidi } from "@/lib/playNote";

// Every key sound in Piano Hop goes through here, so
// scripts/check-piano-hop.ts can check that each key plays its own pitch.
// Uses the same clear piano tone as Up or Down (lib/playNote.ts), on the
// shared AudioContext (iPhone silent-switch and interruption handling
// included).

export const KEY_SOUND_SECONDS = 1.1;

// Plays a key's note `delay` seconds from now.
export function playKey(midi: number, delay = 0): boolean {
  return playPianoMidi(midi, delay, KEY_SOUND_SECONDS);
}

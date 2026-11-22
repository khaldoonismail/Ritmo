import { useEffect } from "react";
import { preloadPianoSamples } from "@/lib/pianoSamples";

// Game pages call this so their notes play on the recorded piano
// (lib/pianoSamples.ts). `enabled` false (a quiz with no notes) loads
// nothing; loading happens once per visit however often it's called.
export function usePianoSamples(enabled = true): void {
  useEffect(() => {
    if (enabled) preloadPianoSamples();
  }, [enabled]);
}

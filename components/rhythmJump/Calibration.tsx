"use client";

import { useEffect, useRef, useState } from "react";
import { RotateDeviceOverlay, usePhonePortrait, useShortLandscape } from "@/components/RotateDevice";
import { getAudioContext, unlockNoteAudio } from "@/lib/playNote";
import { colors } from "@/lib/theme";
import { CALIBRATION_BEATS, CALIBRATION_BPM, delayFromOffsets, saveCalibration } from "@/lib/rhythmJump";
import { BeatBus, tapTime } from "./beat";
import { BeatDots } from "./RhythmJumpGame";

// "Tap along with the drum 8 times": measures this device's delay (sound
// out + touch in) so taps are judged on what the child heard. 4 soft
// count-in clicks, then 8 drum beats at 90 BPM; the delay is the median of
// the taps' offsets from the beats (lib/rhythmJump.ts), saved on the
// device as soon as it is measured.

type Stage = "intro" | "running" | "done" | "again";

export default function Calibration({
  previousMs,
  onDone,
  onCancel,
}: {
  previousMs: number | null;
  onDone: (ms: number) => void;
  onCancel: () => void;
}) {
  const compact = useShortLandscape();
  const phonePortrait = usePhonePortrait();
  const [stage, setStage] = useState<Stage>("intro");
  const [taps, setTaps] = useState(0);
  const [beat, setBeat] = useState(-1); // 0..3 count-in, 4..11 drum
  const [result, setResult] = useState<number | null>(null);
  const runRef = useRef<{ bus: BeatBus; first: number; beats: number[]; taps: number[]; end: number } | null>(null);
  const spb = 60 / CALIBRATION_BPM;

  const start = () => {
    unlockNoteAudio();
    const c = getAudioContext();
    if (!c) return;
    if (c.state !== "running") c.resume().catch(() => {});
    runRef.current?.bus.cancel();
    const bus = new BeatBus(c);
    const first = c.currentTime + 0.5;
    for (let k = 0; k < 4; k++) bus.click(first + k * spb, false, 0.8);
    const beats: number[] = [];
    for (let k = 0; k < CALIBRATION_BEATS; k++) {
      const at = first + (4 + k) * spb;
      beats.push(at);
      bus.click(at, true, 1.3);
    }
    runRef.current = { bus, first, beats, taps: [], end: beats[beats.length - 1] + 0.6 };
    setTaps(0);
    setResult(null);
    setStage("running");
  };

  // Follow the beat (the drum grows on each beat) and finish at the end.
  useEffect(() => {
    if (stage !== "running") return;
    let raf = 0;
    let last = -2;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const r = runRef.current;
      const c = getAudioContext();
      if (!r || !c) return;
      const now = c.currentTime;
      const b = now < r.first ? -1 : Math.floor((now - r.first) / spb);
      if (b !== last) {
        last = b;
        setBeat(b);
      }
      if (now > r.end) {
        const offsets = r.taps.map((t) => {
          let best = Infinity;
          for (const bt of r.beats) if (Math.abs(t - bt) < Math.abs(best)) best = t - bt;
          return best;
        });
        const ms = delayFromOffsets(offsets);
        // Saved right away, so "saved on this device" is true even if the
        // child leaves now.
        if (ms !== null) saveCalibration(ms);
        setResult(ms);
        setStage(ms === null ? "again" : "done");
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, spb]);

  useEffect(() => () => runRef.current?.bus.cancel(), []);

  const tap = (timeStamp: number) => {
    const r = runRef.current;
    const c = getAudioContext();
    if (stage !== "running" || !r || !c) return;
    const t = tapTime(c, timeStamp, 0);
    if (t < r.beats[0] - 0.4) return; // during the count-in
    r.taps.push(t);
    setTaps(r.taps.length);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) tap(e.timeStamp);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const drumBeat = beat >= 4 ? beat - 4 : -1;
  const counting = stage === "running" && beat >= 0 && beat < 4;

  return (
    <main
      onPointerDown={(e) => {
        if ((e.target as Element).closest("button")) return;
        e.preventDefault();
        tap(e.timeStamp);
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(#9ED8F5, #E9F8FF 55%, #7FCBE8 55%, #4FA9D6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        touchAction: "none",
        userSelect: "none",
        color: colors.textPrimary,
      }}
    >
      <div
        style={{
          background: colors.background,
          borderRadius: 22,
          padding: compact ? "0.8rem 1.25rem" : "1.5rem 1.5rem",
          width: "min(460px, 100%)",
          maxHeight: "100%",
          overflowY: "auto",
          boxSizing: "border-box",
          textAlign: "center",
          display: "flex",
          flexDirection: compact ? "row" : "column",
          alignItems: "center",
          gap: compact ? 18 : 12,
          boxShadow: "0 6px 0 rgba(0,0,0,0.12)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            fontSize: compact ? "3.2rem" : "4.5rem",
            lineHeight: 1,
            transform: drumBeat >= 0 ? "scale(1.18)" : "scale(1)",
            transition: "transform 0.09s",
            flex: "0 0 auto",
          }}
          key={beat}
        >
          🥁
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 10, alignItems: "center", minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: compact ? "1.25rem" : "1.6rem", fontWeight: 900 }}>
            {stage === "done" ? "All set!" : stage === "again" ? "Let's try that again" : "Tap along with the drum"}
          </h1>
          {stage === "intro" && (
            <>
              <p style={{ margin: 0, fontWeight: 600, opacity: 0.75, lineHeight: 1.4 }}>
                After 4 soft clicks, the drum plays {CALIBRATION_BEATS} times. Tap the screen (or Space) exactly with each drum. This tells
                the game how quick this device is, so your timing is judged fairly.
                {previousMs !== null && ` (Now: ${Math.round(previousMs)} ms.)`}
              </p>
              <button type="button" onClick={start} style={primary}>
                I&apos;m ready
              </button>
              <button type="button" onClick={onCancel} style={secondary}>
                {previousMs === null ? "Skip for now" : "Cancel"}
              </button>
            </>
          )}
          {stage === "running" && (
            <>
              <div style={{ fontWeight: 900, fontSize: compact ? "1.1rem" : "1.3rem", color: counting ? "#F28C28" : colors.blueText }}>
                {counting ? `Get ready… ${beat + 1}` : beat >= 4 ? "Tap with the drum!" : "Listen…"}
              </div>
              <BeatDots beat={drumBeat} total={CALIBRATION_BEATS} size={compact ? 10 : 13} />
              <div style={{ fontWeight: 700, opacity: 0.6 }}>
                Taps: {taps} / {CALIBRATION_BEATS}
              </div>
            </>
          )}
          {stage === "done" && result !== null && (
            <>
              <p style={{ margin: 0, fontWeight: 600, opacity: 0.75 }}>
                This device&apos;s delay: <strong>{Math.round(result)} ms</strong>. It&apos;s saved on this device.
              </p>
              <button type="button" onClick={() => onDone(result)} style={primary}>
                Let&apos;s play!
              </button>
              <button type="button" onClick={start} style={secondary}>
                Try again
              </button>
            </>
          )}
          {stage === "again" && (
            <>
              <p style={{ margin: 0, fontWeight: 600, opacity: 0.75 }}>
                Not enough taps were close to the drum. Tap right when you hear each drum.
              </p>
              <button type="button" onClick={start} style={primary}>
                Try again
              </button>
              <button type="button" onClick={onCancel} style={secondary}>
                {previousMs === null ? "Skip for now" : "Cancel"}
              </button>
            </>
          )}
        </div>
      </div>
      {phonePortrait && <RotateDeviceOverlay />}
    </main>
  );
}

const primary: React.CSSProperties = {
  fontSize: "1.15rem",
  fontWeight: 900,
  padding: "0.8rem 1.4rem",
  borderRadius: "14px",
  border: "none",
  background: colors.greenButton,
  boxShadow: `0 4px 0 ${colors.greenButtonShadow}`,
  color: colors.white,
  cursor: "pointer",
  width: "100%",
};

const secondary: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 800,
  padding: "0.6rem",
  borderRadius: "14px",
  border: "2px solid #E3DCCD",
  background: colors.white,
  color: colors.textPrimary,
  cursor: "pointer",
  width: "100%",
};

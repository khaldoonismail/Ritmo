"use client";

import { useEffect, useRef, useState } from "react";
import { ExitButton } from "@/components/GameExit";
import { useShortLandscape } from "@/components/RotateDevice";
import { unlockNoteAudio } from "@/lib/playNote";
import { colors } from "@/lib/theme";
import { MELODIES, render } from "@/lib/loudOrSoft/music";
import { TownPlayer } from "./player";
import { TOWN_CSS, Town } from "./Town";

// "Set your volume", before the first round on a device: how loud "loud"
// is depends on the tablet's volume, so the child turns it until the
// normal tune (Twinkle, Twinkle at mezzo-forte, the same level as every
// question's reference phrase) sounds comfortably medium. It plays over and
// over until "Sounds good!". Remembered on this device.

const KEY = "ritmo.sleepyTown.volumeSet";

export function volumeIsSet(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function markVolumeSet() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // private mode: ask again next time
  }
}

const TUNE = render({
  level: "easy",
  kind: "steady",
  melody: MELODIES.find((m) => m.id === "twinkle")!,
  answer: "mf",
  bpm: 104,
  transpose: 0,
  repeats: 1,
}).piece;

export default function VolumeStep({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const compact = useShortLandscape();
  const player = useRef<TownPlayer | null>(null);
  if (!player.current) player.current = new TownPlayer();
  const [beat, setBeat] = useState(0);
  const [portrait, setPortrait] = useState(false);

  const start = () => {
    unlockNoteAudio();
    player.current!.loop(TUNE, 0.9, () => setBeat((b) => b + 1));
  };

  useEffect(() => {
    const p = player.current!;
    const onSize = () => setPortrait(window.innerHeight > window.innerWidth);
    onSize();
    window.addEventListener("resize", onSize);
    start();
    return () => {
      p.stop();
      window.removeEventListener("resize", onSize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = () => {
    player.current!.stop();
    markVolumeSet();
    onDone();
  };

  return (
    <main style={{ position: "fixed", inset: 0, background: "#262A5C", color: colors.textPrimary, display: "grid", placeItems: "center", overflow: "hidden" }}>
      <style>{`${TOWN_CSS} @keyframes st-meter { 0%,100% { transform: scaleY(.35) } 50% { transform: scaleY(1) } }`}</style>
      <Town wake={0} decorations={0} compact={compact} portrait={portrait} />
      <div style={{ position: "absolute", inset: 0, background: "rgba(20,22,60,0.55)" }} />
      <div style={{ position: "absolute", top: "max(10px, env(safe-area-inset-top))", right: 12, zIndex: 3 }}>
        <ExitButton
          onClick={() => {
            player.current!.stop();
            onCancel();
          }}
          compact={compact}
        />
      </div>
      <div
        role="dialog"
        aria-label="Set your volume"
        style={{
          position: "relative",
          background: colors.white,
          borderRadius: 26,
          padding: compact ? "12px 20px" : "26px 34px",
          width: compact ? "min(560px, calc(100vw - 140px))" : "min(560px, calc(100vw - 32px))",
          boxSizing: "border-box",
          boxShadow: "0 6px 0 rgba(0,0,0,0.25)",
          textAlign: "center",
          display: "flex",
          flexDirection: compact ? "row" : "column",
          alignItems: "center",
          gap: compact ? 16 : 14,
        }}
      >
        <SpeakerIcon size={compact ? 52 : 76} />
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 12, alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: compact ? 20 : 28 }}>Set your volume</div>
          <div style={{ fontWeight: 650, fontSize: compact ? 14 : 17, lineHeight: 1.35, opacity: 0.8, maxWidth: 440 }}>
            Turn the volume up or down until this tune sounds <b>comfortably medium</b>: not a whisper, not too loud.
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: compact ? 18 : 26 }} aria-hidden="true">
            {[10, 18, 26, 16, 22, 12, 20, 8].map((v, i) => (
              <span
                key={`${i}-${beat}`}
                style={{
                  width: 7,
                  height: compact ? v * 0.65 : v,
                  background: "#8EE07A",
                  borderRadius: 3,
                  border: "2px solid #2B2745",
                  transformOrigin: "bottom",
                  animation: `st-meter ${0.5 + (i % 3) * 0.12}s ease-in-out infinite`,
                }}
              />
            ))}
            <span style={{ marginLeft: 8, fontWeight: 800, fontSize: 14, opacity: 0.6 }}>playing…</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              onClick={start}
              style={{ fontWeight: 900, fontSize: compact ? 15 : 17, padding: compact ? "8px 14px" : "12px 18px", borderRadius: 999, border: `2px solid ${colors.blueText}`, background: colors.blueBackground, color: colors.blueText, minHeight: 44, cursor: "pointer" }}
            >
              🔊 Play again
            </button>
            <button
              type="button"
              onClick={done}
              style={{ fontWeight: 900, fontSize: compact ? 16 : 19, padding: compact ? "8px 18px" : "12px 26px", borderRadius: 999, border: "none", background: colors.greenButton, boxShadow: `0 4px 0 ${colors.greenButtonShadow}`, color: colors.white, minHeight: 44, cursor: "pointer" }}
            >
              Sounds good! ✓
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

// A loudspeaker with sound waves, drawn (not emoji).
export function SpeakerIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ flex: "0 0 auto" }}>
      <circle cx={32} cy={32} r={31} fill="#FFFFFF" />
      <circle cx={32} cy={32} r={27.5} fill="#8FC3F2" />
      <g stroke="#2B2745" strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round">
        <path d="M14,26 L22,26 L32,17 L32,47 L22,38 L14,38 Z" fill="#FFFFFF" />
        <path d="M38,26 Q42,32 38,38" fill="none" />
        <path d="M43,21 Q50,32 43,43" fill="none" />
      </g>
    </svg>
  );
}

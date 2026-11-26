"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import { RunnerCard, RunnerPickerScreen, useRunnerChoice } from "@/components/characters/RunnerChoice";
import type { HappyOrSadLevel } from "@/lib/happyOrSad/pieces";
import { HAPPY_OR_SAD_LABELS, HAPPY_OR_SAD_LEVELS, type Labels } from "@/lib/happyOrSad/round";
import { usePianoSamples } from "@/lib/usePianoSamples";

// Happy or Sad ("Weather Village"), stage 1: hear whether music is happy
// (major) or sad (minor) and grow a village. An unlisted page (not in the
// library, no database). Three.js is only in the game's chunk.

const loadGame = () => import("@/components/happyOrSad/HappyOrSadGame");
const HappyOrSadGame = dynamic(loadGame, {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#BFE3F5" }}>
      <p style={{ fontWeight: 800 }}>Loading Happy or Sad…</p>
    </main>
  ),
});

const LEVELS = HAPPY_OR_SAD_LEVELS;
const LABELS = HAPPY_OR_SAD_LABELS;

export default function HappyOrSadPage() {
  // Start loading the piano samples while the child picks a level.
  usePianoSamples();
  const [level, setLevel] = useState<HappyOrSadLevel>("easy");
  const [labels, setLabels] = useState<Labels>("mood");
  const [runKey, setRunKey] = useState<number | null>(null);
  const { runner, chosen, picking, setPicking, save } = useRunnerChoice();

  useEffect(() => {
    loadGame().catch(() => {});
  }, []);

  if (runKey !== null) {
    return (
      <HappyOrSadGame
        key={runKey}
        level={level}
        labels={labels}
        character={runner}
        autoStart
        onChangeSettings={() => setRunKey(null)}
      />
    );
  }

  if (picking) {
    return (
      <RunnerPickerScreen
        initial={runner}
        mode={picking}
        onDone={(c) => {
          unlockNoteAudio();
          save(c);
          setPicking(null);
          if (picking === "start") setRunKey(Date.now());
        }}
      />
    );
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: colors.background,
        color: colors.textPrimary,
        padding: "1.25rem 16px 2.5rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "min(520px, 100%)", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Link href="/" style={{ color: "inherit", fontWeight: 800, textDecoration: "none", opacity: 0.7 }}>
          ✕ Exit
        </Link>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", lineHeight: 1 }}>☀️🏡🌧️</div>
          <h1 style={{ margin: "0.4rem 0 0.2rem", fontSize: "2rem", fontWeight: 900 }}>Happy or Sad</h1>
          <p style={{ margin: 0, fontWeight: 600, opacity: 0.75, lineHeight: 1.45 }}>
            Listen to a short piece of music. Is it happy or sad? Every right answer builds your village and
            changes its weather. 10 pieces a round.
          </p>
        </div>
        <section style={card} role="radiogroup" aria-label="Level">
          <div style={{ fontWeight: 900 }}>Level</div>
          {LEVELS.map((l) => (
            <button key={l.key} type="button" role="radio" aria-checked={l.key === level} onClick={() => setLevel(l.key)} style={choice(l.key === level)}>
              <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>{l.label}</div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", opacity: 0.75 }}>{l.detail}</div>
            </button>
          ))}
        </section>
        <section style={card} role="radiogroup" aria-label="Answer names">
          <div style={{ fontWeight: 900 }}>Answer names</div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {LABELS.map((l) => (
              <button
                key={l.key}
                type="button"
                role="radio"
                aria-checked={l.key === labels}
                onClick={() => setLabels(l.key)}
                style={{ ...choice(l.key === labels), flex: 1, textAlign: "center", fontWeight: 900 }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </section>
        <RunnerCard runner={runner} onChange={() => setPicking("change")} />
        <button
          type="button"
          onClick={() => {
            unlockNoteAudio();
            if (!chosen) setPicking("start");
            else setRunKey(Date.now());
          }}
          style={{
            fontSize: "1.25rem",
            fontWeight: 900,
            padding: "0.95rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.greenButton,
            boxShadow: solidShadow(4, colors.greenButtonShadow),
            color: colors.white,
            cursor: "pointer",
          }}
        >
          Play!
        </button>
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.85rem", fontWeight: 700, opacity: 0.6 }}>
          Computer: ← sun, → cloud, H hear again · Tablet or phone: tap · Sound on 🔊
        </p>
      </div>
    </main>
  );
}

const card: React.CSSProperties = {
  background: colors.white,
  borderRadius: radius.card,
  padding: "1rem",
  boxShadow: solidShadow(4, colors.rosterCardShadow),
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
};

function choice(on: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "0.75rem 0.9rem",
    borderRadius: "14px",
    border: `2px solid ${on ? colors.blueText : colors.neutralGray}`,
    background: on ? colors.blueBackground : colors.white,
    color: colors.textPrimary,
    cursor: "pointer",
  };
}

"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import { RunnerCard, RunnerPickerScreen, useRunnerChoice } from "@/components/characters/RunnerChoice";
import { NAMING_LABELS, type NamingSystem } from "@/lib/noteReading";
import { PIANO_LEVELS, type PianoLevel } from "@/lib/pianoHop";

// Piano Hop, stage 1: learn where the notes are on a piano keyboard. An
// unlisted page (not in the library, no database). Three.js is only in the
// game's chunk, loaded by this page alone.

const loadGame = () => import("@/components/pianoHop/PianoHopGame");
const PianoHopGame = dynamic(loadGame, {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#BFE3F5" }}>
      <p style={{ fontWeight: 800 }}>Loading Piano Hop…</p>
    </main>
  ),
});

const LEVEL_KEYS: PianoLevel[] = ["easy", "medium", "hard"];
const NAMINGS: NamingSystem[] = ["solfege", "letters"];

export default function PianoHopPage() {
  const [level, setLevel] = useState<PianoLevel>("easy");
  const [naming, setNaming] = useState<NamingSystem>("solfege");
  const [runKey, setRunKey] = useState<number | null>(null);
  const { runner, chosen, picking, setPicking, save } = useRunnerChoice();

  // Start downloading the 3D code while the child picks settings.
  useEffect(() => {
    loadGame().catch(() => {});
  }, []);

  if (runKey !== null) {
    return (
      <PianoHopGame
        key={runKey}
        level={level}
        naming={naming}
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
          <div style={{ fontSize: "3rem", lineHeight: 1 }}>🎹🐇</div>
          <h1 style={{ margin: "0.4rem 0 0.2rem", fontSize: "2rem", fontWeight: 900 }}>Piano Hop</h1>
          <p style={{ margin: 0, fontWeight: 600, opacity: 0.75, lineHeight: 1.45 }}>
            A note name appears at the top. Hop onto a piano key with that name before time runs out. Look
            for the groups of 2 and 3 black keys to find your way! 3 hearts.
          </p>
        </div>
        <section style={card} role="radiogroup" aria-label="Level">
          <div style={{ fontWeight: 900 }}>Level</div>
          {LEVEL_KEYS.map((key) => {
            const on = key === level;
            return (
              <button key={key} type="button" role="radio" aria-checked={on} onClick={() => setLevel(key)} style={choice(on)}>
                <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>{PIANO_LEVELS[key].label}</div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", opacity: 0.75 }}>{PIANO_LEVELS[key].detail}</div>
              </button>
            );
          })}
        </section>
        <section style={card} role="radiogroup" aria-label="Note names">
          <div style={{ fontWeight: 900 }}>Note names</div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {NAMINGS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={n === naming}
                onClick={() => setNaming(n)}
                style={{ ...choice(n === naming), flex: 1, textAlign: "center", fontWeight: 900 }}
              >
                {NAMING_LABELS[n]}
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
          Hop!
        </button>
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.85rem", fontWeight: 700, opacity: 0.6 }}>
          Computer: ← → keys, then Space · Tablet or phone: tap a key · Sound on 🔊
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
